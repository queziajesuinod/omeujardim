'use strict';

// Todas as defesas de borda num lugar só. Se algo de segurança não está aqui,
// deveria estar, ou tem um comentário dizendo por que não.

const fp = require('fastify-plugin');

module.exports = fp(async function seguranca(app) {
  // Cabeçalhos de proteção. A API não serve HTML, então CSP fica restritiva.
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'no-referrer' },
  });

  // CORS por lista fixa. Nunca reflita a origem recebida.
  const permitidas = (process.env.CORS_ORIGENS || '').split(',').map((o) => o.trim()).filter(Boolean);
  await app.register(require('@fastify/cors'), {
    origin(origem, cb) {
      // App nativo não manda Origin, e isso é normal.
      if (!origem) return cb(null, true);
      cb(null, permitidas.includes(origem));
    },
    credentials: true,
    maxAge: 86400,
  });

  // Limite geral. O login tem limite próprio, bem mais apertado.
  //
  // ATENÇÃO com mais de uma instância: o armazenamento padrão é a memória do
  // processo. Com 3 instâncias atrás de um balanceador, um limite de 10 por
  // 15 minutos vira 30 na prática, e a proteção contra força bruta se dissolve
  // sem nenhum erro aparecer em lugar nenhum. Assim que existir a segunda
  // instância, REDIS_URL passa a ser obrigatório.
  let redis;
  if (process.env.REDIS_URL) {
    const Redis = require('ioredis');
    redis = new Redis(process.env.REDIS_URL, { connectTimeout: 500, maxRetriesPerRequest: 1 });
    app.addHook('onClose', async () => redis.quit());
  } else if (process.env.NODE_ENV === 'production') {
    app.log.warn('REDIS_URL ausente: rate limit por processo. Só é seguro com UMA instância.');
  }

  await app.register(require('@fastify/rate-limit'), {
    global: true,
    redis,
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.user?.sub || req.ip,
    // O plugin (v10) LANÇA o retorno desta função. Se ela devolver um objeto
    // simples, o nosso setErrorHandler não acha statusCode e responde 500 em
    // vez de 429. Então ela precisa vir como Error, com o status do contexto
    // (429 no limite, 403 em ban).
    errorResponseBuilder: (_req, ctx) => {
      const e = new Error('Muitas tentativas em pouco tempo. Espere um minuto.');
      e.statusCode = ctx.statusCode;
      e.code = 'muitas_requisicoes';
      return e;
    },
  });

  // Corpo pequeno: nada nesta API precisa de megabytes.
  app.addHook('onRequest', async (req, reply) => {
    const tamanho = Number(req.headers['content-length'] || 0);
    if (tamanho > 256 * 1024) {
      return reply.code(413).send({ erro: 'corpo_grande', mensagem: 'Conteúdo grande demais.' });
    }
  });

  // O erro que sai para o cliente nunca carrega stack, SQL nem nome de coluna.
  app.setErrorHandler((erro, req, reply) => {
    // Entrada inválida (zod) é erro do cliente, não do servidor: 400, não 500.
    if (erro?.name === 'ZodError' || Array.isArray(erro?.issues)) {
      const mensagem = (erro.issues || []).map((i) => i.message).join(' ') || 'Dados inválidos.';
      req.log.warn({ rota: req.routeOptions?.url }, 'entrada inválida');
      return reply.code(400).send({ erro: 'entrada_invalida', mensagem });
    }
    const status = erro.statusCode || 500;
    // O log interno guarda o detalhe, e sem nada do diário. (routeOptions.url,
    // não routerPath: este último saiu no Fastify 5 e vinha sempre vazio.)
    req.log.error({ erro: erro.message, rota: req.routeOptions?.url, status }, 'falha na requisição');
    if (status >= 500) {
      return reply.code(500).send({ erro: 'erro_interno', mensagem: 'Algo falhou aqui. Tente de novo.' });
    }
    reply.code(status).send({ erro: erro.code || 'requisicao_invalida', mensagem: erro.message });
  });
});
