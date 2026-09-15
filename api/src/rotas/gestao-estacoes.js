'use strict';

const { z } = require('zod');
const { importarEstacao } = require('../lib/estacoes-importar');

const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Autoria e agendamento das estações — o cronograma do ano. Conteúdo autoral.
// Trilheiro (autor de conteúdo) ou admin.

module.exports = async function rotasGestaoEstacoes(app) {
  const { Estacao, EstacaoDia, sequelize } = app.db;

  app.addHook('preHandler', app.exigirLoginQualquer);
  app.addHook('preHandler', app.exigirPapel('trilheiro'));

  /** Todas as estações, inclusive rascunhos e agendadas. */
  app.get('/admin/estacoes', async () => {
    return Estacao.findAll({
      attributes: ['id', 'nome', 'tema', 'dias', 'publicadaEm', 'disponivelEm'],
      order: [['criado_em', 'DESC']],
    });
  });

  /**
   * Uma estação com os dias, para o painel visualizar o conteúdo publicado. Cada
   * dia tem uma linha por disciplina (o painel agrupa por ordem ao mostrar).
   */
  app.get('/admin/estacoes/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const estacao = await Estacao.findByPk(id);
    if (!estacao) return reply.code(404).send({ erro: 'estacao_nao_encontrada' });
    const conteudo = await EstacaoDia.findAll({
      where: { estacaoId: id },
      attributes: ['ordem', 'disciplinaCodigo', 'titulo', 'corpo'],
      order: [['ordem', 'ASC'], ['disciplinaCodigo', 'ASC']],
    });
    return { ...estacao.toJSON(), conteudo };
  });

  /** Autoria por markdown: conteúdo por dia por disciplina. Idempotente por nome. */
  app.post('/admin/estacoes/importar', async (req, reply) => {
    const { markdown, disponivelEm, publicar } = z.object({
      markdown: z.string().min(20),
      disponivelEm: z.string().regex(DATA).nullable().optional(),
      publicar: z.boolean().default(true),
    }).parse(req.body);

    try {
      const r = await importarEstacao(app.db, markdown, { disponivelEm: disponivelEm ?? null, publicar });
      return reply.code(201).send({ estacao: r.estacao, dias: r.dias, itens: r.itens });
    } catch (e) {
      return reply.code(422).send({ erro: 'markdown_invalido', mensagem: e.message });
    }
  });

  /** Publicar, despublicar, ou reagendar a estreia. */
  app.patch('/admin/estacoes/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const dados = z.object({
      publicar: z.boolean().optional(),
      disponivelEm: z.string().regex(DATA).nullable().optional(),
    }).parse(req.body);

    const estacao = await Estacao.findByPk(id);
    if (!estacao) return reply.code(404).send({ erro: 'estacao_nao_encontrada' });
    if (dados.publicar !== undefined) estacao.publicadaEm = dados.publicar ? (estacao.publicadaEm || new Date()) : null;
    if (dados.disponivelEm !== undefined) estacao.disponivelEm = dados.disponivelEm;
    await estacao.save();
    return estacao;
  });

  /** Remover uma estação — leva os dias (CASCADE) e as inscrições, em ordem. */
  app.delete('/admin/estacoes/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const estacao = await Estacao.findByPk(id);
    if (!estacao) return reply.code(404).send({ erro: 'estacao_nao_encontrada' });
    await sequelize.transaction(async (t) => {
      await sequelize.query('DELETE FROM estacao_inscricao WHERE estacao_id = :id', { replacements: { id }, transaction: t });
      await sequelize.query('DELETE FROM estacao WHERE id = :id', { replacements: { id }, transaction: t });
    });
    return reply.code(204).send();
  });
};
