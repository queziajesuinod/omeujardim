'use strict';

const { z } = require('zod');
const { idValido } = require('../lib/id');

const idDoCliente = z.string().refine(idValido, 'Id precisa ser um UUID versão 7.');
const HORA = /^\d{2}:\d{2}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Categorias não sensíveis, para a intercessão agregada. Slugs sem acento no
// banco; o rótulo bonito é do cliente. Nunca revelam quem, nem o quê em detalhe.
const CATEGORIAS = ['saude', 'trabalho', 'familia', 'direcao', 'luto', 'gratidao', 'outros'];

const novoPedido = z.object({
  id: idDoCliente.optional(),
  titulo: z.string().trim().min(1).max(280),
  pessoa: z.string().trim().min(1).max(120).optional(),
  lembreteEm: z.string().regex(HORA, 'Use HH:MM.').optional(),
  categoria: z.enum(CATEGORIAS).optional(),
  compartilharIntercessao: z.boolean().optional(),
});

const atualizar = z.object({
  status: z.enum(['pedindo', 'respondido', 'arquivado']).optional(),
  testemunho: z.string().trim().max(2000).optional(),
  respondidoEm: z.string().regex(DATA, 'Use AAAA-MM-DD.').optional(),
  titulo: z.string().trim().min(1).max(280).optional(),
  pessoa: z.string().trim().min(1).max(120).optional(),
  categoria: z.enum(CATEGORIAS).nullable().optional(),
  compartilharIntercessao: z.boolean().optional(),
});

module.exports = async function rotasOracao(app) {
  const { PedidoOracao } = app.db;

  app.addHook('preHandler', app.exigirLoginQualquer);
  app.addHook('preHandler', app.exigirAssinatura);

  /** Os pedidos DESTA pessoa. Título, pessoa e testemunho saem decifrados. */
  app.get('/oracoes', async (req) => {
    const { status } = z.object({
      status: z.enum(['pedindo', 'respondido', 'arquivado']).optional(),
    }).parse(req.query);

    const where = { usuarioId: req.user.sub };
    if (status) where.status = status;
    return PedidoOracao.findAll({ where, order: [['criado_em', 'DESC']] });
  });

  /** Criar um pedido. Nasce em "pedindo". Título e pessoa cifram sozinhos. */
  app.post('/oracoes', async (req, reply) => {
    const dados = novoPedido.parse(req.body);
    const pedido = await PedidoOracao.create({
      id: dados.id,
      usuarioId: req.user.sub,
      titulo: dados.titulo,
      pessoa: dados.pessoa,
      lembreteEm: dados.lembreteEm,
      categoria: dados.categoria,
      compartilharIntercessao: dados.compartilharIntercessao ?? false,
    });
    return reply.code(201).send(pedido);
  });

  /**
   * Atualizar: responder (com testemunho), arquivar, reabrir, ou editar o texto.
   *
   * A coerência do "respondidoEm" é garantida aqui e reforçada por CHECK no
   * banco: só pedido respondido tem data de resposta. Ao sair de respondido, a
   * data é limpa. Valida posse e responde 404, não 403 (ver IDOR no CLAUDE.md).
   */
  app.patch('/oracoes/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const dados = atualizar.parse(req.body);

    const pedido = await PedidoOracao.findOne({ where: { id, usuarioId: req.user.sub } });
    if (!pedido) return reply.code(404).send({ erro: 'pedido_nao_encontrado' });

    if (dados.titulo !== undefined) pedido.titulo = dados.titulo;
    if (dados.pessoa !== undefined) pedido.pessoa = dados.pessoa;
    if (dados.testemunho !== undefined) pedido.testemunho = dados.testemunho;
    if (dados.categoria !== undefined) pedido.categoria = dados.categoria;
    if (dados.compartilharIntercessao !== undefined) pedido.compartilharIntercessao = dados.compartilharIntercessao;

    if (dados.status) {
      pedido.status = dados.status;
      pedido.respondidoEm = dados.status === 'respondido'
        ? (dados.respondidoEm || new Date().toISOString().slice(0, 10))
        : null;
    }

    await pedido.save();
    return pedido;
  });
};
