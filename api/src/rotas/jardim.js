'use strict';

const { z } = require('zod');
const { calcularJardim } = require('../lib/jardim');

module.exports = async function rotasJardim(app) {
  const { Registro, Anotacao, PedidoOracao, Pratica, sequelize } = app.db;

  app.addHook('preHandler', app.exigirLoginQualquer);
  app.addHook('preHandler', app.exigirAssinatura);

  /**
   * Estado do jardim: chama, escudos, calendário de 30 dias e conquistas.
   * O cliente manda `hoje` (o dia devocional dele, que começa às 4h), para o
   * calendário e a pausa baterem com o fuso da pessoa.
   */
  app.get('/jardim', async (req) => {
    const { hoje } = z.object({
      hoje: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.').optional(),
    }).parse(req.query);

    const usuarioId = req.user.sub;
    const dia = hoje || new Date().toISOString().slice(0, 10);

    const [datasRows, contagensRows, praticas, anotacoes, oracoesRespondidas, constancia] = await Promise.all([
      // to_char garante a string 'AAAA-MM-DD', sem susto de fuso ao serializar.
      sequelize.query(
        "SELECT DISTINCT to_char(data_ref, 'YYYY-MM-DD') AS data_ref FROM registro WHERE usuario_id = :u AND removido_em IS NULL",
        { replacements: { u: usuarioId }, type: sequelize.QueryTypes.SELECT }
      ),
      // Quantas práticas distintas foram regadas em cada dia: dá a "fração do
      // dia" do quadradinho do calendário.
      sequelize.query(
        "SELECT to_char(data_ref, 'YYYY-MM-DD') AS data_ref, COUNT(DISTINCT pratica_id)::int AS n FROM registro WHERE usuario_id = :u AND removido_em IS NULL GROUP BY data_ref",
        { replacements: { u: usuarioId }, type: sequelize.QueryTypes.SELECT }
      ),
      // As práticas ativas e seus dias, para saber quantas eram previstas por
      // dia da semana (o denominador da fração).
      Pratica.findAll({ where: { usuarioId, ativa: true }, attributes: ['diasSemana'] }),
      Anotacao.count({ where: { usuarioId } }),
      PedidoOracao.count({ where: { usuarioId, status: 'respondido' } }),
      Registro.constancia(usuarioId, 30),
    ]);

    const regadasPorDia = Object.fromEntries(contagensRows.map((r) => [r.data_ref, r.n]));
    const previstasPorSemana = [0, 0, 0, 0, 0, 0, 0];
    for (const p of praticas) for (const d of p.diasSemana || []) previstasPorSemana[d] += 1;

    return calcularJardim({
      datas: datasRows.map((r) => r.data_ref),
      hoje: dia,
      anotacoes,
      oracoesRespondidas,
      praticasAtivas: praticas.length,
      constancia,
      regadasPorDia,
      previstasPorSemana,
    });
  });
};
