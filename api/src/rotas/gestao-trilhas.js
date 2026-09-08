'use strict';

const { z } = require('zod');
const { importarMarkdown } = require('../lib/trilhas-importar');

const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Autoria e agendamento de trilhas — o painel do trilheiro. Guardado por
// trilheiro ou admin. Conteúdo autoral, sem nada de usuário aqui.

module.exports = async function rotasGestaoTrilhas(app) {
  const { Trilha, TrilhaDia, sequelize } = app.db;

  app.addHook('preHandler', app.exigirLoginQualquer);
  app.addHook('preHandler', app.exigirPapel('trilheiro'));

  /** Todas as trilhas, inclusive rascunhos e agendadas, para gerenciar. O
   * `temInscritos` decide, no painel, o que dá para editar ou excluir. */
  app.get('/admin/trilhas', async () => {
    const trilhas = await Trilha.findAll({
      attributes: [
        'id', 'titulo', 'autor', 'tema', 'dias', 'publicadaEm', 'disponivelEm',
        [sequelize.literal('EXISTS (SELECT 1 FROM trilha_inscricao ti WHERE ti.trilha_id = "Trilha".id AND ti.removido_em IS NULL)'), 'temInscritos'],
      ],
      order: [['criado_em', 'DESC']],
    });
    return trilhas;
  });

  /** Uma trilha com os dias, para o painel recarregar no editor e editar. */
  app.get('/admin/trilhas/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const trilha = await Trilha.findByPk(id, {
      include: [{ model: TrilhaDia, as: 'conteudo' }],
      order: [[{ model: TrilhaDia, as: 'conteudo' }, 'ordem', 'ASC']],
    });
    if (!trilha) return reply.code(404).send({ erro: 'trilha_nao_encontrada' });
    return trilha;
  });

  /**
   * Autoria por markdown: o trilheiro cola o texto no formato do importador.
   * Idempotente por título. Pode nascer publicada e/ou agendada ("em breve").
   */
  app.post('/admin/trilhas/importar', async (req, reply) => {
    const { markdown, disponivelEm, publicar } = z.object({
      markdown: z.string().min(20),
      disponivelEm: z.string().regex(DATA).nullable().optional(),
      publicar: z.boolean().default(true),
    }).parse(req.body);

    try {
      // bloquearPublicada: pelo painel, editar exige despublicar antes.
      const r = await importarMarkdown(app.db, markdown, { disponivelEm: disponivelEm ?? null, publicar, bloquearPublicada: true });
      return reply.code(201).send({ trilha: r.trilha, dias: r.dias, comEmbedding: r.comEmbedding });
    } catch (e) {
      return reply.code(422).send({ erro: 'markdown_invalido', mensagem: e.message });
    }
  });

  /** Publicar, despublicar, ou reagendar a estreia. */
  app.patch('/admin/trilhas/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const dados = z.object({
      publicar: z.boolean().optional(),
      disponivelEm: z.string().regex(DATA).nullable().optional(),
    }).parse(req.body);

    const trilha = await Trilha.findByPk(id);
    if (!trilha) return reply.code(404).send({ erro: 'trilha_nao_encontrada' });

    if (dados.publicar !== undefined) trilha.publicadaEm = dados.publicar ? (trilha.publicadaEm || new Date()) : null;
    if (dados.disponivelEm !== undefined) trilha.disponivelEm = dados.disponivelEm;
    await trilha.save();
    return trilha;
  });

  /**
   * Remover uma trilha. Recusa se houver participantes: apagá-la levaria o
   * progresso deles junto. Sem inscritos, remove a trilha (e os dias por
   * CASCADE). Publicada sem ninguém dentro pode ser excluída.
   */
  app.delete('/admin/trilhas/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const trilha = await Trilha.findByPk(id);
    if (!trilha) return reply.code(404).send({ erro: 'trilha_nao_encontrada' });

    const [{ n }] = await sequelize.query(
      'SELECT COUNT(*)::int AS n FROM trilha_inscricao WHERE trilha_id = :id AND removido_em IS NULL',
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );
    if (n > 0) {
      return reply.code(409).send({ erro: 'trilha_com_participantes', mensagem: 'Esta trilha tem participantes e não pode ser excluída.' });
    }
    await sequelize.query('DELETE FROM trilha WHERE id = :id', { replacements: { id } });
    return reply.code(204).send();
  });
};
