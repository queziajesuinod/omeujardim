'use strict';

const { z } = require('zod');
const { novoId } = require('../lib/id');
const { gerarHash, conferir, validarForca } = require('../lib/senha');

// A versão do texto de consentimento que está no ar. Ao mudar o texto,
// suba a versão e peça de novo. Consentimento antigo não vale para texto novo.
const VERSAO_CONSENTIMENTO = '2026-09-03';

const cadastro = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  senha: z.string().min(10).max(128),
  fuso: z.string().max(64).default('America/Sao_Paulo'),
  // LGPD art. 11: dado sensível exige consentimento específico e destacado.
  // Duas caixas separadas, e nenhuma delas marcada por padrão no app.
  aceitaTermos: z.literal(true),
  aceitaDadosSensiveis: z.literal(true),
});

const login = z.object({
  email: z.string().trim().email().max(320),
  senha: z.string().max(128),
  dispositivo: z.string().max(200).optional(),
});

module.exports = async function rotasAuth(app) {
  const { Usuario } = app.db;

  app.post('/cadastro', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const dados = cadastro.parse(req.body);

    const problemas = validarForca(dados.senha);
    if (problemas.length) return reply.code(422).send({ erro: 'senha_fraca', mensagem: problemas.join(' ') });

    const jaExiste = await Usuario.findOne({ where: { emailNormalizado: dados.email.toLowerCase() } });
    // Resposta idêntica exista ou não a conta, para não virar consulta de
    // "quem usa o app". Quem já tem conta recebe e-mail avisando, quem não tem
    // recebe o de confirmação.
    if (jaExiste) {
      // Gasta o mesmo tempo de um hash que o caminho de conta nova gasta abaixo,
      // para o relógio não revelar se o e-mail já tem conta.
      await gerarHash('senha-de-enganacao-para-igualar-o-tempo');
      return reply.code(202).send({ ok: true });
    }

    const agora = new Date();
    const usuario = await Usuario.create({
      id: novoId(),
      nome: dados.nome,
      email: dados.email,
      senhaHash: await gerarHash(dados.senha),
      fuso: dados.fuso,
      consentimentoVersao: VERSAO_CONSENTIMENTO,
      consentimentoEm: agora,
      consentimentoSensivelEm: agora,
    });

    req.log.info({ usuarioId: usuario.id }, 'conta criada');
    return reply.code(202).send({ ok: true });
  });

  app.post('/login', {
    // Limite apertado: é aqui que mora a força bruta. Em produção, deixe baixo
    // (10). Em desenvolvimento, LOGIN_RATE_MAX mais alto evita travar os testes.
    config: { rateLimit: { max: Number(process.env.LOGIN_RATE_MAX || 10), timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const dados = login.parse(req.body);
    const generico = { erro: 'credenciais_invalidas', mensagem: 'E-mail ou senha não conferem.' };

    const usuario = await Usuario.scope('comSenha').findOne({
      where: { emailNormalizado: dados.email.toLowerCase() },
    });

    // Mesmo sem usuário, gasta o tempo de um hash, para o tempo de resposta
    // não revelar se o e-mail existe.
    if (!usuario) {
      await gerarHash('senha-de-enganacao-para-igualar-o-tempo');
      return reply.code(401).send(generico);
    }

    const bloqueada = !!(usuario.bloqueadoAte && usuario.bloqueadoAte > new Date());

    // Confere a senha assim mesmo (tempo constante), mesmo bloqueada ou
    // desativada, para o tempo de resposta não revelar o estado da conta.
    const { ok, precisaRehash } = await conferir(usuario.senhaHash, dados.senha);

    // Conta desativada pelo admin: não entra, mas só depois de conferir a senha.
    if (ok && usuario.desativadoEm) {
      return reply.code(403).send({
        erro: 'conta_desativada',
        mensagem: 'Esta conta está desativada. Fale com o suporte.',
      });
    }

    // Conta bloqueada por tentativas: responde IGUAL a credencial errada. Uma
    // conta inexistente nunca bloqueia (não há linha para contar), então um 429
    // 'conta_bloqueada' entregava que o e-mail existe. O bloqueio segue valendo
    // no servidor — nem a senha certa entra enquanto dura, e não incrementa mais.
    if (bloqueada) return reply.code(401).send(generico);

    if (!ok) {
      const falhas = usuario.tentativasFalhas + 1;
      await usuario.update({
        tentativasFalhas: falhas,
        bloqueadoAte: falhas >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
      });
      return reply.code(401).send(generico);
    }

    if (precisaRehash) await usuario.update({ senhaHash: await gerarHash(dados.senha) });
    if (usuario.tentativasFalhas) await usuario.update({ tentativasFalhas: 0, bloqueadoAte: null });

    const tokens = await app.emitirTokens(usuario, dados.dispositivo);

    // Cliente web pede cookie; app nativo recebe o token no corpo.
    // O app manda X-Cliente: app, o navegador não manda nada.
    const assinatura = await app.resumoAssinatura(usuario);
    if (req.headers['x-cliente'] !== 'app') {
      const csrf = app.gravarSessaoWeb(reply, tokens, req);
      return { csrf, usuario: usuario.toJSON(), assinatura };
    }
    return { ...tokens, usuario: usuario.toJSON(), assinatura };
  });

  app.post('/refresh', {
    // Em produção, 60/hora sobra para uma sessão (renova a cada 15 min). Em dev,
    // os reloads do app e do painel estouram; REFRESH_RATE_MAX sobe o teto.
    config: { rateLimit: { max: Number(process.env.REFRESH_RATE_MAX || 60), timeWindow: '1 hour' } },
  }, async (req, reply) => {
    // No app o refresh vem no corpo. Na web ele vem no cookie e o
    // JavaScript nem sabe que ele existe, que é justamente o ponto.
    const doCookie = req.cookies?.[app.nomesCookies(req).REFRESH];
    const corpo = z.object({
      refresh: z.string().min(20).optional(),
      dispositivo: z.string().max(200).optional(),
    }).parse(req.body || {});

    const refresh = corpo.refresh || doCookie;
    if (!refresh) {
      return reply.code(401).send({ erro: 'refresh_ausente', mensagem: 'Faça login novamente.' });
    }

    const tokens = await app.rotacionarTokens(refresh, corpo.dispositivo);

    if (!corpo.refresh) {
      const csrf = app.gravarSessaoWeb(reply, tokens, req);
      return { csrf };
    }
    return tokens;
  });

  app.post('/sair', { preHandler: [app.exigirLoginQualquer] }, async (req, reply) => {
    await app.encerrarSessoes(req.user.sub);
    app.limparSessaoWeb(reply, req);
    return { ok: true };
  });
};
