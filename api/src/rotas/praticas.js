'use strict';

const { z } = require('zod');
const { idValido } = require('../lib/id');

// O id vem do celular, ordenável no tempo, para a sincronização ser idempotente.
// Aceito, mas validado: precisa ser UUID v7. Opcional aqui porque a prática
// também pode nascer na web, onde o servidor gera.
const idDoCliente = z.string().refine(idValido, 'Id precisa ser um UUID versão 7.');

const dias = z.array(z.number().int().min(0).max(6)).min(1).max(7);

const novaPratica = z.object({
  id: idDoCliente.optional(),
  disciplinaId: z.string().uuid(),
  metaPorSemana: z.number().int().min(1).max(21).default(7),
  diasSemana: dias.default([0, 1, 2, 3, 4, 5, 6]),
  lembreteEm: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM.').optional(),
});

module.exports = async function rotasPraticas(app) {
  const { Disciplina, Pratica } = app.db;

  /**
   * Catálogo de disciplinas. Público e cacheável: é conteúdo do produto,
   * igual para todo mundo, sem nada de ninguém dentro. Não exige login.
   */
  app.get('/disciplinas', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
  }, async (_req, reply) => {
    // Só as ativas: uma disciplina inativada pela autora some do catálogo de
    // novas práticas. Quem já a tem segue com ela (vem por GET /praticas).
    const disciplinas = await Disciplina.findAll({ where: { ativo: true }, order: [['ordem', 'ASC']] });
    // Cache curto de propósito: quando a autora cria ou ajusta uma prática no
    // painel, ela precisa aparecer no app quase na hora, não daqui a uma hora.
    reply.header('Cache-Control', 'public, max-age=60');
    return disciplinas;
  });

  /** As práticas ativas DESTA pessoa, com a disciplina embutida para a tela. */
  app.get('/praticas', { preHandler: [app.exigirLoginQualquer, app.exigirAssinatura] }, async (req) => {
    return Pratica.findAll({
      where: { usuarioId: req.user.sub, ativa: true },
      include: ['disciplina'],
      order: [[{ model: Disciplina, as: 'disciplina' }, 'ordem', 'ASC']],
    });
  });

  /**
   * Semear uma prática, ou reajustar a que já existe.
   *
   * Idempotente por (usuário, disciplina): o índice único do banco só deixa
   * uma prática ativa por disciplina. Reenviar não cria a segunda, atualiza a
   * meta e os dias — que é exatamente o que a tela de escolha faz ao salvar.
   */
  app.post('/praticas', { preHandler: [app.exigirLoginQualquer, app.exigirAssinatura] }, async (req, reply) => {
    const dados = novaPratica.parse(req.body);
    const usuarioId = req.user.sub;

    // A disciplina precisa existir. Como é catálogo público, basta existir;
    // não há posse a validar aqui.
    const disciplina = await Disciplina.findByPk(dados.disciplinaId);
    if (!disciplina) return reply.code(404).send({ erro: 'disciplina_nao_encontrada' });

    const [pratica, criada] = await Pratica.findOrCreate({
      where: { usuarioId, disciplinaId: dados.disciplinaId },
      defaults: {
        id: dados.id,
        usuarioId,
        disciplinaId: dados.disciplinaId,
        metaPorSemana: dados.metaPorSemana,
        diasSemana: dados.diasSemana,
        lembreteEm: dados.lembreteEm,
      },
    });

    if (!criada) {
      // Já existia: reativa (caso tenha sido podada antes) e atualiza os alvos.
      await pratica.update({
        ativa: true,
        metaPorSemana: dados.metaPorSemana,
        diasSemana: dados.diasSemana,
        lembreteEm: dados.lembreteEm,
      });
    }

    await pratica.reload({ include: ['disciplina'] });
    return reply.code(criada ? 201 : 200).send(pratica);
  });

  /**
   * Podar uma prática. Soft delete (o model é paranoid), então o histórico de
   * registros continua de pé.
   *
   * Valida posse e responde 404, não 403: dizer "existe, mas não é sua" já
   * entrega que ela existe. Ver invariante de IDOR no CLAUDE.md.
   */
  app.delete('/praticas/:id', { preHandler: [app.exigirLoginQualquer, app.exigirAssinatura] }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const pratica = await Pratica.findOne({ where: { id, usuarioId: req.user.sub } });
    if (!pratica) return reply.code(404).send({ erro: 'pratica_nao_encontrada' });

    await pratica.destroy();
    return reply.code(204).send();
  });
};
