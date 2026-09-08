'use strict';

const { z } = require('zod');
const { gerarEmbedding, paraVetorSql } = require('../lib/embeddings');

const dataRefZod = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data_ref precisa ser YYYY-MM-DD.');

/** Quantos dias entre duas datas-calendário (b - a), sem fuso a atrapalhar. */
function diasEntre(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** O dia atual da trilha: contado do início, preso entre 1 e o total. */
function diaAtualDe(iniciadaEm, hoje, total) {
  const n = diasEntre(iniciadaEm, hoje) + 1;
  return Math.max(1, Math.min(total, n));
}

module.exports = async function rotasTrilhas(app) {
  const { Trilha, TrilhaDia, TrilhaInscricao, TrilhaRega, sequelize } = app.db;
  const { Op } = sequelize.Sequelize;

  const colunasDia = `d.id, d.ordem, d.titulo, d.corpo, d.pergunta,
    t.id AS "trilhaId", t.titulo AS "trilhaTitulo"`;

  /** Catálogo público das trilhas publicadas. */
  app.get('/trilhas', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
  }, async (_req, reply) => {
    const trilhas = await Trilha.findAll({
      where: { publicadaEm: { [Op.ne]: null } },
      order: [['publicadaEm', 'DESC']],
    });
    reply.header('Cache-Control', 'public, max-age=600');
    return trilhas;
  });

  /**
   * Busca no conteúdo. Semântica quando há embeddings e o modelo responde
   * (acha pelo sentido, mesmo sem a palavra exata); senão cai na busca textual
   * por tsvector, com stemming em português e sem acento. O `modo` na resposta
   * diz qual das duas rodou.
   *
   * Definida ANTES de /trilhas/:id de propósito, para "buscar" não ser lido
   * como um id.
   */
  app.get('/trilhas/buscar', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req) => {
    const { q } = z.object({ q: z.string().trim().min(2).max(200) }).parse(req.query);

    const vetor = await gerarEmbedding(q, 'query');
    if (vetor) {
      const resultados = await sequelize.query(
        `SELECT ${colunasDia}, 1 - (d.embedding <=> CAST(:v AS vector)) AS score
           FROM trilha_dia d JOIN trilha t ON t.id = d.trilha_id
          WHERE d.embedding IS NOT NULL
          ORDER BY d.embedding <=> CAST(:v AS vector)
          LIMIT 5`,
        { replacements: { v: paraVetorSql(vetor) }, type: sequelize.QueryTypes.SELECT }
      );
      return { modo: 'semantica', resultados };
    }

    const resultados = await sequelize.query(
      `SELECT ${colunasDia}, ts_rank(d.busca, plainto_tsquery('portugues_sem_acento', :q)) AS score
         FROM trilha_dia d JOIN trilha t ON t.id = d.trilha_id
        WHERE d.busca @@ plainto_tsquery('portugues_sem_acento', :q)
        ORDER BY score DESC
        LIMIT 5`,
      { replacements: { q }, type: sequelize.QueryTypes.SELECT }
    );
    return { modo: 'textual', resultados };
  });

  /** Uma trilha com os seus dias em ordem. */
  app.get('/trilhas/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const trilha = await Trilha.findByPk(id, {
      include: [{ model: TrilhaDia, as: 'conteudo' }],
      order: [[{ model: TrilhaDia, as: 'conteudo' }, 'ordem', 'ASC']],
    });
    if (!trilha) return reply.code(404).send({ erro: 'trilha_nao_encontrada' });
    reply.header('Cache-Control', 'public, max-age=600');
    return trilha;
  });

  // --- A jornada: participar, acompanhar, regar --------------------------
  //
  // O avanço é pelo calendário: o dia atual vem de `iniciada_em`. Um dia não
  // regado no passado é uma "semente perdida" que a pessoa pode resgatar
  // quando quiser — nunca some, nunca fica vermelho.

  /** As trilhas de que a pessoa participa, com o progresso, para o catálogo. */
  app.get('/minhas-trilhas', { preHandler: [app.exigirLoginQualquer, app.exigirAssinatura] }, async (req) => {
    const { dataRef } = z.object({ dataRef: dataRefZod }).parse(req.query);
    const inscricoes = await TrilhaInscricao.findAll({
      where: { usuarioId: req.user.sub },
      include: [{ model: Trilha, as: 'trilha' }, { model: TrilhaRega, as: 'regas', attributes: ['ordem'] }],
    });
    return inscricoes.map((i) => ({
      trilhaId: i.trilhaId,
      diaAtual: diaAtualDe(i.iniciadaEm, dataRef, i.trilha.dias),
      total: i.trilha.dias,
      feitos: i.regas.length,
      concluidaEm: i.concluidaEm,
    }));
  });

  /**
   * Participar de uma trilha. Idempotente por (pessoa, trilha): reenviar não
   * cria a segunda. Se a pessoa já tinha saído, reativa a inscrição e recomeça
   * a contagem a partir de hoje.
   */
  app.post('/trilhas/:id/participar', { preHandler: [app.exigirLoginQualquer, app.exigirAssinatura] }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { dataRef } = z.object({ dataRef: dataRefZod }).parse(req.body ?? {});

    const trilha = await Trilha.findByPk(id);
    if (!trilha || !trilha.publicadaEm) return reply.code(404).send({ erro: 'trilha_nao_encontrada' });

    // Ainda não estreou: "em breve". Não dá para participar do que não começou.
    if (trilha.disponivelEm && trilha.disponivelEm > dataRef) {
      return reply.code(409).send({ erro: 'ainda_nao_disponivel', mensagem: 'Esta trilha começa em breve.' });
    }

    // Inclui as removidas para poder reativar em vez de esbarrar no índice único.
    const existente = await TrilhaInscricao.findOne({
      where: { usuarioId: req.user.sub, trilhaId: id }, paranoid: false,
    });
    if (existente) {
      if (existente.removidoEm) await existente.restore();
      if (existente.removidoEm || !existente.iniciadaEm) await existente.update({ iniciadaEm: dataRef, concluidaEm: null });
      return reply.code(200).send(existente);
    }
    const inscricao = await TrilhaInscricao.create({ usuarioId: req.user.sub, trilhaId: id, iniciadaEm: dataRef });
    return reply.code(201).send(inscricao);
  });

  /** Sair de uma trilha. Soft delete: o progresso fica, e voltar recomeça. */
  app.delete('/trilhas/:id/participar', { preHandler: [app.exigirLoginQualquer, app.exigirAssinatura] }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const inscricao = await TrilhaInscricao.findOne({ where: { usuarioId: req.user.sub, trilhaId: id } });
    if (!inscricao) return reply.code(404).send({ erro: 'inscricao_nao_encontrada' });
    await inscricao.destroy();
    return reply.code(204).send();
  });

  /** O andamento da pessoa nesta trilha: dia atual e o que já foi regado. */
  app.get('/trilhas/:id/andamento', { preHandler: [app.exigirLoginQualquer, app.exigirAssinatura] }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { dataRef } = z.object({ dataRef: dataRefZod }).parse(req.query);

    const inscricao = await TrilhaInscricao.findOne({
      where: { usuarioId: req.user.sub, trilhaId: id },
      include: [{ model: Trilha, as: 'trilha' }, { model: TrilhaRega, as: 'regas', attributes: ['ordem', 'dataRef'] }],
    });
    if (!inscricao) return { participando: false };

    return {
      participando: true,
      iniciadaEm: inscricao.iniciadaEm,
      concluidaEm: inscricao.concluidaEm,
      total: inscricao.trilha.dias,
      diaAtual: diaAtualDe(inscricao.iniciadaEm, dataRef, inscricao.trilha.dias),
      regados: inscricao.regas.map((r) => r.ordem),
    };
  });

  /**
   * Regar um dia da trilha. Aceita o dia de hoje ou um dia perdido no passado
   * (o resgate). Nunca um dia futuro: não dá para regar o que ainda não veio.
   * Idempotente por (inscrição, ordem).
   */
  app.post('/trilhas/:id/regar', { preHandler: [app.exigirLoginQualquer, app.exigirAssinatura] }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { ordem, dataRef } = z.object({
      ordem: z.number().int().min(1),
      dataRef: dataRefZod,
    }).parse(req.body);

    const inscricao = await TrilhaInscricao.findOne({
      where: { usuarioId: req.user.sub, trilhaId: id },
      include: [{ model: Trilha, as: 'trilha' }],
    });
    if (!inscricao) return reply.code(404).send({ erro: 'inscricao_nao_encontrada' });

    const total = inscricao.trilha.dias;
    const diaAtual = diaAtualDe(inscricao.iniciadaEm, dataRef, total);
    if (ordem > diaAtual) return reply.code(409).send({ erro: 'dia_futuro', mensagem: 'Esse dia ainda não chegou.' });

    const dia = await TrilhaDia.findOne({ where: { trilhaId: id, ordem } });
    if (!dia) return reply.code(404).send({ erro: 'dia_nao_encontrado' });

    await TrilhaRega.findOrCreate({
      where: { inscricaoId: inscricao.id, ordem },
      defaults: { inscricaoId: inscricao.id, trilhaDiaId: dia.id, ordem, dataRef },
    });

    const feitos = await TrilhaRega.count({ where: { inscricaoId: inscricao.id } });
    if (feitos >= total && !inscricao.concluidaEm) await inscricao.update({ concluidaEm: dataRef });

    const regados = (await TrilhaRega.findAll({
      where: { inscricaoId: inscricao.id }, attributes: ['ordem'],
    })).map((r) => r.ordem);

    return reply.code(201).send({ regados, diaAtual, total, concluida: feitos >= total });
  });
};
