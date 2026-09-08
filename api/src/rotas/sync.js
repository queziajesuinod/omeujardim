'use strict';

// ---------------------------------------------------------------------------
// Sincronização em lote.
//
// O problema que isto resolve: às 6h da manhã, milhares de pessoas abrem o app
// ao mesmo tempo e cada uma esvazia a fila local. Se cada item virar uma
// requisição, uma pessoa com 5 dias offline dispara 15 requisições, e mil
// pessoas viram 15 mil requisições no mesmo minuto, cada uma com o custo de
// handshake, verificação de token e conexão de banco.
//
// Com o lote, a mesma pessoa faz UMA requisição, uma transação, uma conexão.
// O ganho não é de CPU, é de fila: a conexão de banco fica presa por 40 ms em
// vez de por 15 idas e voltas.
// ---------------------------------------------------------------------------

const { z } = require('zod');
const { idValido } = require('../lib/id');

const idDoCliente = z.string().refine(idValido, 'Id precisa ser um UUID versão 7.');

const item = z.object({
  id: idDoCliente,
  praticaId: z.string().uuid(),
  dataRef: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duracaoMin: z.number().int().min(1).max(1440).optional(),
  origem: z.enum(['app', 'widget', 'importacao']).default('app'),
  anotacao: z.object({
    id: idDoCliente,
    texto: z.string().trim().min(1).max(4000),
    referencia: z.string().max(60).optional(),
    tags: z.array(z.string().max(30)).max(8).default([]),
    // Mesmo vínculo de trilha do POST avulso: sobe junto no lote offline.
    trilhaId: z.string().uuid().optional(),
    trilhaDiaOrdem: z.number().int().min(1).max(366).optional(),
  }).optional(),
});

// O teto existe para o lote não virar uma transação de dez segundos segurando
// uma conexão do pool. Quem tem mais que isso manda em várias remessas.
const lote = z.object({ registros: z.array(item).min(1).max(200) });

module.exports = async function rotasSync(app) {
  const { Registro, Pratica, Anotacao, sequelize } = app.db;

  // Aceita as duas origens: Bearer do app nativo e cookie do navegador.
  app.addHook('preHandler', app.exigirLoginQualquer);
  app.addHook('preHandler', app.exigirAssinatura);

  app.post('/sync', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req) => {
    const { registros } = lote.parse(req.body);
    const usuarioId = req.user.sub;

    // Uma consulta só para autorizar o lote inteiro, em vez de uma por item.
    // Sem isto, um lote de 200 itens faz 200 SELECTs antes de gravar nada.
    const praticasDoUsuario = await Pratica.findAll({
      where: { usuarioId },
      attributes: ['id'],
      raw: true,
    });
    const permitidas = new Set(praticasDoUsuario.map((p) => p.id));

    const aceitos = [];
    const recusados = [];

    await sequelize.transaction(async (t) => {
      for (const r of registros) {
        if (!permitidas.has(r.praticaId)) {
          // Não é erro do lote inteiro: o app precisa saber qual item caiu,
          // para tirar da fila em vez de tentar para sempre.
          recusados.push({ id: r.id, motivo: 'pratica_nao_encontrada' });
          continue;
        }

        const registro = await Registro.regar({ ...r, usuarioId }, t);

        if (r.anotacao) {
          await Anotacao.findOrCreate({
            where: { id: r.anotacao.id },
            defaults: {
              id: r.anotacao.id,
              usuarioId,
              registroId: registro.id,
              texto: r.anotacao.texto,
              tags: r.anotacao.tags,
              referencia: r.anotacao.referencia,
              trilhaId: r.anotacao.trilhaId,
              trilhaDiaOrdem: r.anotacao.trilhaDiaOrdem,
              dataRef: r.dataRef,
            },
            transaction: t,
          });
        }

        aceitos.push(r.id);
      }
    });

    return { aceitos, recusados, recebidos: registros.length };
  });
};
