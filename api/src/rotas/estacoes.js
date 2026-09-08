'use strict';

const { z } = require('zod');

const dataRefZod = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data_ref precisa ser YYYY-MM-DD.');

function diasEntre(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

module.exports = async function rotasEstacoes(app) {
  const { Estacao, EstacaoDia } = app.db;
  const { Op } = app.db.Sequelize;

  /** Catálogo público das estações publicadas. */
  app.get('/estacoes', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (_req, reply) => {
    const estacoes = await Estacao.findAll({
      where: { publicadaEm: { [Op.ne]: null } },
      attributes: ['id', 'nome', 'tema', 'descricao', 'dias', 'disponivelEm'],
      order: [['publicadaEm', 'DESC']],
    });
    reply.header('Cache-Control', 'public, max-age=600');
    return estacoes;
  });

  /**
   * O andamento da estação ATIVA agora — a mesma para todo mundo. A pessoa não
   * escolhe: ao entrar no app ela já está na estação que está rodando, no dia em
   * que a estação está. O dia é contado a partir da ESTREIA da estação
   * (disponivel_em), não de quando a pessoa se cadastrou: quem entra no 3º dia vê
   * o 3º dia. Quando a estação passa do último dia, ela deixa de aparecer.
   */
  app.get('/estacoes/andamento', { preHandler: [app.exigirLoginQualquer, app.exigirAssinatura] }, async (req) => {
    const { dataRef } = z.object({ dataRef: dataRefZod }).parse(req.query);

    // Publicadas, já estreadas (disponivel_em <= hoje), da estreia mais recente
    // para a mais antiga. A ativa é a primeira que ainda não passou do total.
    const candidatas = await Estacao.findAll({
      where: { publicadaEm: { [Op.ne]: null }, disponivelEm: { [Op.lte]: dataRef } },
      order: [['disponivelEm', 'DESC']],
    });
    const ativa = candidatas.find((e) => diasEntre(e.disponivelEm, dataRef) + 1 <= e.dias);
    if (!ativa) return { seguindo: false };

    const diaAtual = diasEntre(ativa.disponivelEm, dataRef) + 1;
    const conteudo = await EstacaoDia.findAll({
      where: { estacaoId: ativa.id, ordem: diaAtual },
      attributes: ['disciplinaCodigo', 'titulo', 'corpo'],
      order: [['disciplinaCodigo', 'ASC']],
    });

    return {
      seguindo: true,
      estacao: { id: ativa.id, nome: ativa.nome, tema: ativa.tema },
      diaAtual,
      total: ativa.dias,
      conteudo,
    };
  });
};
