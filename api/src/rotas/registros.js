'use strict';

const { z } = require('zod');
const { idValido } = require('../lib/id');

// O id vem do celular. Ele é aceito, mas validado: precisa ser UUID v7.
const idDoCliente = z.string().refine(idValido, 'Id precisa ser um UUID versão 7.');

const regar = z.object({
  id: idDoCliente,
  praticaId: z.string().uuid(),
  dataRef: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.'),
  duracaoMin: z.number().int().min(1).max(1440).optional(),
  origem: z.enum(['app', 'widget', 'importacao']).default('app'),
  anotacao: z.object({
    id: idDoCliente,
    texto: z.string().trim().min(1).max(4000),
    referencia: z.string().max(60).optional(),
    tags: z.array(z.string().max(30)).max(8).default([]),
    // Quando a reflexão nasceu de um dia de trilha, o vínculo vem junto: assim
    // o diário sabe reabrir aquele devocional depois, para relembrar.
    trilhaId: z.string().uuid().optional(),
    trilhaDiaOrdem: z.number().int().min(1).max(366).optional(),
  }).optional(),
});

module.exports = async function rotasRegistros(app) {
  const { Registro, Pratica, Anotacao, sequelize } = app.db;

  // Tudo aqui exige login.
  // Aceita as duas origens: Bearer do app nativo e cookie do navegador.
  app.addHook('preHandler', app.exigirLoginQualquer);
  app.addHook('preHandler', app.exigirAssinatura);

  /**
   * Regar. Recebe o lote que o celular acumulou offline.
   * Idempotente pelo id: mandar duas vezes não cria dois.
   */
  app.post('/registros', async (req, reply) => {
    const dados = regar.parse(req.body);
    const usuarioId = req.user.sub;

    // Autorização por objeto: a prática precisa ser DESTA pessoa.
    // Sem esta linha existe IDOR, que é a falha número 1 da OWASP para APIs.
    const pratica = await Pratica.findOne({ where: { id: dados.praticaId, usuarioId } });
    if (!pratica) return reply.code(404).send({ erro: 'pratica_nao_encontrada' });

    const resultado = await sequelize.transaction(async (t) => {
      const registro = await Registro.regar({ ...dados, usuarioId }, t);

      if (dados.anotacao) {
        await Anotacao.findOrCreate({
          where: { id: dados.anotacao.id },
          defaults: {
            id: dados.anotacao.id,
            usuarioId,
            registroId: registro.id,
            texto: dados.anotacao.texto,       // cifra sozinho no model
            tags: dados.anotacao.tags,          // vira HMAC sozinho
            referencia: dados.anotacao.referencia,
            trilhaId: dados.anotacao.trilhaId,
            trilhaDiaOrdem: dados.anotacao.trilhaDiaOrdem,
            dataRef: dados.dataRef,
          },
          transaction: t,
        });
      }
      return registro;
    });

    return reply.code(201).send(resultado);
  });

  /**
   * Desregar: desfazer uma rega marcada sem querer. Some a rega do dia e, se
   * havia reflexão junto, ela some também — desmarcar é desfazer o dia inteiro.
   * Idempotente: se já não existe, responde 204 do mesmo jeito. Valida posse da
   * prática (404, não 403) para não haver IDOR.
   */
  app.delete('/registros', async (req, reply) => {
    const { praticaId, dataRef } = z.object({
      praticaId: z.string().uuid(),
      dataRef: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.'),
    }).parse(req.body ?? {});
    const usuarioId = req.user.sub;

    const pratica = await Pratica.findOne({ where: { id: praticaId, usuarioId } });
    if (!pratica) return reply.code(404).send({ erro: 'pratica_nao_encontrada' });

    const registro = await Registro.findOne({ where: { praticaId, dataRef, usuarioId } });
    if (!registro) return reply.code(204).send();

    await sequelize.transaction(async (t) => {
      await Anotacao.destroy({ where: { registroId: registro.id }, transaction: t });
      await registro.destroy({ transaction: t });
    });
    return reply.code(204).send();
  });

  /** Constância dos últimos 30 dias, a métrica de destaque da tela Hoje. */
  app.get('/constancia', async (req) => {
    const { dias } = z.object({ dias: z.coerce.number().int().min(7).max(365).default(30) }).parse(req.query);
    return Registro.constancia(req.user.sub, dias);
  });

  /**
   * Linha do tempo do diário. O texto sai decifrado (é toJSON do model que
   * decide), a paginação é por data com o cursor `antes`, e o filtro por tag
   * usa o índice cego: o servidor compara sem saber qual é a tag.
   *
   * O que NÃO existe aqui: busca por palavra dentro do texto. No servidor ele
   * está cifrado e não é pesquisável, por decisão de segurança. Essa busca roda
   * no aparelho, contra a cópia local. Na web, filtra-se por tag e referência.
   */
  app.get('/diario', async (req) => {
    const q = z.object({
      tag: z.string().trim().min(1).max(30).optional(),
      antes: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.').optional(),
      limite: z.coerce.number().int().min(1).max(100).default(30),
    }).parse(req.query);

    if (q.tag) return Anotacao.porTag(req.user.sub, q.tag);

    const { Op } = app.db.Sequelize;
    const where = { usuarioId: req.user.sub };
    if (q.antes) where.dataRef = { [Op.lt]: q.antes };

    return Anotacao.findAll({
      where,
      include: [{ association: 'trilha', attributes: ['id', 'titulo'] }],
      order: [['dataRef', 'DESC'], ['criado_em', 'DESC']],
      limit: q.limite,
    });
  });

  /**
   * Uma anotação, para relembrar o dia da trilha que a motivou. Devolve o texto
   * decifrado e o vínculo com a trilha; o app junta o devocional daquele dia.
   * Valida posse (404, não 403): "existe mas não é sua" já seria informação.
   */
  app.get('/diario/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const anotacao = await Anotacao.findOne({
      where: { id, usuarioId: req.user.sub },
      include: [{ association: 'trilha', attributes: ['id', 'titulo'] }],
    });
    if (!anotacao) return reply.code(404).send({ erro: 'anotacao_nao_encontrada' });
    return anotacao;
  });

  /**
   * Apagar uma anotação do diário. Some só o texto — a rega do dia FICA, porque
   * nada regride: a constância não pode cair porque alguém apagou uma reflexão.
   * Idempotente: se já não existe (ou não é sua), responde 204 do mesmo jeito,
   * sem revelar se existia.
   */
  app.delete('/diario/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const anotacao = await Anotacao.findOne({ where: { id, usuarioId: req.user.sub } });
    if (!anotacao) return reply.code(204).send();
    await anotacao.destroy();
    return reply.code(204).send();
  });

  /**
   * Exportação dos dados do titular (LGPD art. 18, V).
   * Devolve tudo em JSON legível, com o diário já decifrado, porque a lei
   * pede formato que a pessoa consiga usar.
   */
  app.get('/meus-dados', {
    config: { rateLimit: { max: 3, timeWindow: '1 day' } },
  }, async (req, reply) => {
    const usuarioId = req.user.sub;
    const [usuario, praticas, registros, anotacoes, pedidos] = await Promise.all([
      app.db.Usuario.findByPk(usuarioId),
      Pratica.findAll({ where: { usuarioId }, include: ['disciplina'] }),
      Registro.findAll({ where: { usuarioId }, order: [['dataRef', 'ASC']] }),
      Anotacao.findAll({ where: { usuarioId }, order: [['dataRef', 'ASC']] }),
      app.db.PedidoOracao.findAll({ where: { usuarioId } }),
    ]);

    reply.header('Content-Disposition', 'attachment; filename="meu-jardim.json"');
    return {
      geradoEm: new Date().toISOString(),
      usuario,
      praticas,
      registros,
      anotacoes,   // toJSON já devolve o texto decifrado
      pedidos,
    };
  });
};
