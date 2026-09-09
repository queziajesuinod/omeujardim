'use strict';

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });

const Fastify = require('fastify');
const db = require('./db/models');

function criarApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      // O log NUNCA pode carregar conteúdo do diário nem token.
      // Esta lista é obrigação, não conforto.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.senha',
          'req.body.texto',
          'req.body.testemunho',
          'req.body.titulo',
          'req.body.pessoa',
          'req.body.refresh',
          // O texto do diário chega aninhado (POST /registros e lote /sync), não
          // em req.body.texto. Sem estes caminhos, a garantia "log nunca carrega
          // diário" ficava furada se algum handler ou plugin logasse o corpo.
          'req.body.anotacao.texto',
          'req.body.anotacao.tags',
          'req.body.registros[*].anotacao.texto',
          'req.body.registros[*].anotacao.tags',
        ],
        censor: '[oculto]',
      },
      serializers: {
        // Sem a querystring: ela carrega o segredo do webhook (?segredo=) e a
        // tag do diário (?tag=), que não podem ir para o log.
        req: (req) => ({ metodo: req.method, url: req.url.split('?')[0], ip: req.ip }),
      },
    },
    // Confia no proxy só se houver um. Errar isso quebra o rate limit por IP.
    trustProxy: process.env.NODE_ENV === 'production',
    bodyLimit: 256 * 1024,
  });

  app.register(require('@fastify/sensible'));
  app.register(require('./plugins/seguranca'));
  app.register(require('./plugins/autenticacao'), { db });
  app.register(require('./plugins/sessao-web'));

  app.decorate('db', db);

  // Guarda por papel. O admin é coringa: passa em tudo, sem precisar acumular os
  // outros papéis. exigirPapel() sem argumento = só admin. Use depois de
  // exigirLoginQualquer, que põe req.user.
  app.decorate('exigirPapel', function (...aceitos) {
    return async function (req, reply) {
      const u = await db.Usuario.findByPk(req.user.sub, { attributes: ['papeis'] });
      const papeis = u?.papeis || [];
      req.papeis = papeis;
      if (papeis.includes('admin') || aceitos.some((p) => papeis.includes(p))) return;
      return reply.code(403).send({ erro: 'sem_permissao' });
    };
  });

  // Dia devocional no fuso da pessoa (YYYY-MM-DD). O acesso por assinatura usa
  // o mesmo conceito de dia do resto do app, sem a hora derrubar quem paga.
  function diaNoFuso(fuso) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: fuso || 'America/Sao_Paulo' }).format(new Date());
  }

  // Resumo de acesso por assinatura, para o login e o /v1/eu decidirem a rota.
  // Staff (quem tem papéis) é isento: usa o app sem assinar.
  app.decorate('resumoAssinatura', async function (usuario) {
    const { resumoAcesso } = require('./lib/assinatura');
    if ((usuario.papeis || []).length) return { status: 'isento', usavel: true, motivo: null };
    const a = await db.Assinatura.findOne({
      where: { usuarioId: usuario.id },
      order: [['criado_em', 'DESC']],
    });
    return resumoAcesso(a, diaNoFuso(usuario.fuso));
  });

  // Guarda de rota de produto: exige assinatura usável. Use depois de
  // exigirLoginQualquer. 402 (Payment Required) para o app levar a assinar.
  app.decorate('exigirAssinatura', async function (req, reply) {
    const usuario = await db.Usuario.findByPk(req.user.sub, { attributes: ['id', 'papeis', 'fuso'] });
    const resumo = await app.resumoAssinatura(usuario);
    if (resumo.usavel) return;
    return reply.code(402).send({ erro: 'assinatura_necessaria', motivo: resumo.motivo });
  });

  app.get('/saude', { config: { rateLimit: false } }, async () => ({
    ok: true,
    versao: require('../package.json').version,
  }));

  app.register(require('./rotas/auth'), { prefix: '/v1/auth' });
  app.register(require('./rotas/praticas'), { prefix: '/v1' });
  app.register(require('./rotas/registros'), { prefix: '/v1' });
  app.register(require('./rotas/oracao'), { prefix: '/v1' });
  app.register(require('./rotas/jardim'), { prefix: '/v1' });
  app.register(require('./rotas/trilhas'), { prefix: '/v1' });
  app.register(require('./rotas/estacoes'), { prefix: '/v1' });
  app.register(require('./rotas/conta'), { prefix: '/v1' });
  app.register(require('./rotas/admin'), { prefix: '/v1' });
  app.register(require('./rotas/intercessao'), { prefix: '/v1' });
  app.register(require('./rotas/gestao-trilhas'), { prefix: '/v1' });
  app.register(require('./rotas/gestao-estacoes'), { prefix: '/v1' });
  app.register(require('./rotas/lembretes'), { prefix: '/v1' });
  app.register(require('./rotas/assinaturas'), { prefix: '/v1' });
  app.register(require('./rotas/webhooks'), { prefix: '/v1' });
  app.register(require('./rotas/documentos'), { prefix: '/v1' });
  app.register(require('./rotas/sync'), { prefix: '/v1' });

  return app;
}

async function principal() {
  const app = criarApp();
  try {
    await db.sequelize.authenticate();
    app.log.info('banco conectado');
    // Nunca sequelize.sync() aqui. Schema muda por migração, sempre.
    await app.listen({ port: Number(process.env.PORT || 3333), host: '0.0.0.0' });
  } catch (erro) {
    app.log.error(erro);
    process.exit(1);
  }

  // Expurgo das contas excluídas há mais de 30 dias: ao subir e depois uma vez
  // por dia. Em deploy com mais de uma instância, prefira um cron externo
  // chamando `npm run expurgar`, para não rodar em paralelo à toa.
  const { expurgarVencidos } = require('./lib/expurgo');
  const rodarExpurgo = async () => {
    try {
      const n = await expurgarVencidos(db);
      if (n) app.log.info({ expurgadas: n }, 'contas expurgadas');
    } catch (e) {
      app.log.error({ erro: e.message }, 'falha no expurgo');
    }
  };
  rodarExpurgo();
  const relogioExpurgo = setInterval(rodarExpurgo, 24 * 60 * 60 * 1000);
  relogioExpurgo.unref?.();

  // Fechamento das assinaturas vencidas: ao subir e uma vez por dia. Em deploy
  // com mais de uma instância, prefira um cron externo (`npm run
  // fechar-assinaturas`) para não rodar em paralelo.
  const { fecharVencidas } = require('./lib/fechar-assinaturas');
  const rodarFechamento = async () => {
    try {
      const n = await fecharVencidas(db);
      if (n) app.log.info({ encerradas: n }, 'assinaturas encerradas');
    } catch (e) {
      app.log.error({ erro: e.message }, 'falha ao fechar assinaturas');
    }
  };
  rodarFechamento();
  const relogioFechamento = setInterval(rodarFechamento, 24 * 60 * 60 * 1000);
  relogioFechamento.unref?.();

  // Lembretes: em produção, prefira um cron externo (`* * * * * npm run
  // lembretes`), que não corre o risco de disparar em duas instâncias ao mesmo
  // tempo. Em máquina única de desenvolvimento, LEMBRETES_INLINE=true liga o
  // relógio de minuto aqui dentro.
  let relogioLembretes;
  if (process.env.LEMBRETES_INLINE === 'true') {
    const { rodar } = require('./tarefas/enviar-lembretes');
    const rodarLembretes = async () => {
      try {
        const { pessoas, pushes } = await rodar();
        if (pessoas) app.log.info({ pessoas, pushes }, 'lembretes enviados');
      } catch (e) {
        app.log.error({ erro: e.message }, 'falha nos lembretes');
      }
    };
    relogioLembretes = setInterval(rodarLembretes, 60 * 1000);
    relogioLembretes.unref?.();
    app.log.info('lembretes inline ligados (a cada minuto)');
  }

  // Conferência de PIX pendentes: rede de segurança para quando o webhook não
  // chega. Ao subir e a cada minuto (PIX_POLL_MIN). Em deploy com mais de uma
  // instância, prefira um cron externo (`npm run conferir-pix`). Desligue com
  // PIX_POLL_INLINE=false. Só consulta a Efí quando há PIX pendente recente.
  let relogioPix;
  if (process.env.PIX_POLL_INLINE !== 'false') {
    const { conferirPixPendentes } = require('./lib/conferir-pix');
    const rodarPix = async () => {
      try {
        const n = await conferirPixPendentes(db, app.log);
        if (n) app.log.info({ confirmados: n }, 'pix confirmados por polling');
      } catch (e) {
        app.log.error({ erro: e.message }, 'falha no polling de pix');
      }
    };
    rodarPix();
    const min = Math.max(1, Number(process.env.PIX_POLL_MIN || 1));
    relogioPix = setInterval(rodarPix, min * 60 * 1000);
    relogioPix.unref?.();
    app.log.info(`polling de PIX ligado (a cada ${min} min)`);
  }

  for (const sinal of ['SIGINT', 'SIGTERM']) {
    process.on(sinal, async () => {
      app.log.info('encerrando');
      clearInterval(relogioExpurgo);
      clearInterval(relogioFechamento);
      if (relogioLembretes) clearInterval(relogioLembretes);
      if (relogioPix) clearInterval(relogioPix);
      await app.close();
      await db.sequelize.close();
      process.exit(0);
    });
  }
}

if (require.main === module) principal();

module.exports = { criarApp };
