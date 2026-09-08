'use strict';

const { z } = require('zod');

// Painel do intercessor. A regra de ouro: NADA de título, nome de terceiro ou
// testemunho sai daqui — eles seguem cifrados e privados. O intercessor recebe
// apenas o que a pessoa escolheu compartilhar (compartilhar_intercessao) e só
// em AGREGADO: quantas orações por categoria, e o termômetro de respondidas.

module.exports = async function rotasIntercessao(app) {
  const { sequelize } = app.db;
  const SELECT = sequelize.QueryTypes.SELECT;

  app.addHook('preHandler', app.exigirLoginQualquer);
  app.addHook('preHandler', app.exigirPapel('intercessor'));

  /**
   * O quadro da intercessão: categorias em oração (agregado) e o termômetro de
   * respondidas. Só conta pedidos com compartilhar_intercessao = true.
   */
  app.get('/admin/intercessao', async (req) => {
    const { periodo } = z.object({
      periodo: z.enum(['mes', '3meses', 'ano']).default('mes'),
    }).parse(req.query);
    const dias = periodo === 'ano' ? 365 : periodo === '3meses' ? 90 : 30;

    const porCategoria = await sequelize.query(
      `SELECT COALESCE(categoria, 'outros') AS categoria, COUNT(*)::int AS n
         FROM pedido_oracao
        WHERE removido_em IS NULL AND compartilhar_intercessao = true AND status = 'pedindo'
        GROUP BY COALESCE(categoria, 'outros')
        ORDER BY n DESC`,
      { type: SELECT }
    );

    const [tot] = await sequelize.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'respondido')::int AS respondidas
         FROM pedido_oracao
        WHERE removido_em IS NULL AND compartilhar_intercessao = true`,
      { type: SELECT }
    );

    const [{ n: respondidasPeriodo }] = await sequelize.query(
      `SELECT COUNT(*)::int AS n FROM pedido_oracao
        WHERE removido_em IS NULL AND compartilhar_intercessao = true
          AND status = 'respondido' AND respondido_em > CURRENT_DATE - :dias::int`,
      { replacements: { dias }, type: SELECT }
    );

    const emOracao = porCategoria.reduce((s, c) => s + c.n, 0);
    const termometro = tot.total > 0 ? Math.round((tot.respondidas / tot.total) * 100) : 0;

    return {
      periodo,
      emOracao,
      porCategoria,
      respondidas: tot.respondidas,
      total: tot.total,
      termometro,
      respondidasPeriodo,
    };
  });
};
