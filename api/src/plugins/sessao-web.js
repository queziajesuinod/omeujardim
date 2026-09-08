'use strict';

// ---------------------------------------------------------------------------
// Sessão para a web, por cookie, convivendo com o Bearer do app nativo.
//
// Por que a web não pode usar o mesmo esquema do app:
// no app, o token vive no Keychain e no Keystore, que só o app abre. Na web
// não existe equivalente. Guardar token em localStorage significa que qualquer
// XSS lê a sessão inteira e a leva embora. Cookie httpOnly não é lido por
// JavaScript nenhum, então um XSS pode até agir em nome da pessoa enquanto a
// aba está aberta, mas não consegue roubar a credencial e usar depois.
//
// A troca: cookie é enviado pelo navegador automaticamente, o que abre a porta
// para CSRF. Por isso vem o token de dupla submissão junto. Um problema não
// substitui o outro, os dois precisam ser resolvidos.
// ---------------------------------------------------------------------------

const fp = require('fastify-plugin');
const crypto = require('node:crypto');

// Painel e PWA são os DOIS clientes web e falam com o mesmo host de API. Cookie
// é indexado por (host, nome), não por origem nem por porta: com nomes iguais, o
// login de um sobrescreve o cookie do outro e derruba a sessão da outra aba. Por
// isso cada cliente web tem seu próprio espaço de cookie, escolhido pelo header
// X-Cliente. O nativo não entra aqui: ele usa Bearer e não grava cookie.
const COOKIES = {
  padrao: { ACESSO: 'jd_acesso', REFRESH: 'jd_refresh', CSRF: 'jd_csrf' },
  painel: { ACESSO: 'jd_painel_acesso', REFRESH: 'jd_painel_refresh', CSRF: 'jd_painel_csrf' },
};

function nomesCookies(req) {
  return req?.headers?.['x-cliente'] === 'painel' ? COOKIES.painel : COOKIES.padrao;
}

module.exports = fp(async function sessaoWeb(app) {
  await app.register(require('@fastify/cookie'));

  const producao = process.env.NODE_ENV === 'production';

  const baseCookie = {
    httpOnly: true,
    secure: producao,      // em produção, só por HTTPS
    sameSite: 'lax',       // 'lax' deixa o link de e-mail funcionar; 'strict' quebraria
    path: '/',
    signed: false,
  };

  /** Grava a sessão nos cookies e devolve o token de CSRF para o front. */
  app.decorate('gravarSessaoWeb', function (reply, { acesso, refresh }, req) {
    const nomes = nomesCookies(req);
    const csrf = crypto.randomBytes(24).toString('base64url');

    reply.setCookie(nomes.ACESSO, acesso, { ...baseCookie, maxAge: 15 * 60 });
    reply.setCookie(nomes.REFRESH, refresh, {
      ...baseCookie,
      path: '/v1/auth',   // o refresh só é enviado para a rota que o usa
      maxAge: Number(process.env.REFRESH_EXPIRA_DIAS || 30) * 24 * 60 * 60,
    });
    // Este NÃO é httpOnly de propósito: o JavaScript precisa lê-lo para
    // devolvê-lo no cabeçalho. É a metade visível da dupla submissão.
    reply.setCookie(nomes.CSRF, csrf, { ...baseCookie, httpOnly: false, maxAge: 15 * 60 });

    return csrf;
  });

  app.decorate('limparSessaoWeb', function (reply, req) {
    const nomes = nomesCookies(req);
    for (const [nome, opcoes] of [
      [nomes.ACESSO, baseCookie],
      [nomes.REFRESH, { ...baseCookie, path: '/v1/auth' }],
      [nomes.CSRF, { ...baseCookie, httpOnly: false }],
    ]) {
      reply.clearCookie(nome, opcoes);
    }
  });

  /**
   * Login que aceita as duas origens.
   * O app nativo manda Authorization: Bearer. O navegador manda cookie.
   * Uma API só, dois jeitos de provar quem é, sem duplicar rota.
   */
  app.decorate('exigirLoginQualquer', async function (req, reply) {
    const cabecalho = req.headers.authorization;

    if (cabecalho && cabecalho.startsWith('Bearer ')) {
      try {
        await req.jwtVerify();
        req.origemSessao = 'app';
        return;
      } catch {
        return reply.code(401).send({ erro: 'nao_autenticado', mensagem: 'Faça login novamente.' });
      }
    }

    const nomes = nomesCookies(req);
    const doCookie = req.cookies?.[nomes.ACESSO];
    if (!doCookie) {
      return reply.code(401).send({ erro: 'nao_autenticado', mensagem: 'Faça login novamente.' });
    }

    try {
      req.user = app.jwt.verify(doCookie);
      req.origemSessao = 'web';
    } catch {
      return reply.code(401).send({ erro: 'nao_autenticado', mensagem: 'Faça login novamente.' });
    }

    // CSRF só se aplica a quem veio por cookie, e só em método que altera algo.
    // O Bearer é imune por construção: o navegador não o envia sozinho.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const doCabecalho = req.headers['x-csrf-token'];
      const doCookieCsrf = req.cookies?.[nomes.CSRF];

      const iguais =
        typeof doCabecalho === 'string' &&
        typeof doCookieCsrf === 'string' &&
        doCabecalho.length === doCookieCsrf.length &&
        crypto.timingSafeEqual(Buffer.from(doCabecalho), Buffer.from(doCookieCsrf));

      if (!iguais) {
        return reply.code(403).send({
          erro: 'csrf_invalido',
          mensagem: 'Sua sessão expirou. Atualize a página e tente de novo.',
        });
      }

      // Segunda barreira, barata: a origem precisa estar na lista.
      // Cobre o caso de o cookie de CSRF vazar por subdomínio.
      const origem = req.headers.origin;
      const permitidas = (process.env.CORS_ORIGENS || '').split(',').map((o) => o.trim());
      if (origem && !permitidas.includes(origem)) {
        return reply.code(403).send({ erro: 'origem_nao_permitida' });
      }
    }
  });

  // Exposto para o refresh ler o cookie certo conforme o X-Cliente da requisição.
  app.decorate('nomesCookies', nomesCookies);
});
