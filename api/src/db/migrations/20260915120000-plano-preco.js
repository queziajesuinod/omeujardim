'use strict';

/**
 * Preço versionado com grandfathering (ver PLANO-ASSINATURAS.md).
 *
 * `plano_preco` guarda o histórico de preços; o vigente é o mais recente. Cada
 * `assinatura` já congela o seu `valor_centavos` no momento em que nasce, então
 * mudar o preço vigente afeta só quem assinar dali para frente — os antigos
 * seguem no valor deles.
 *
 * Para migrar um cliente antigo, o admin marca `preco_novo_centavos` (e a data
 * do aviso em `troca_preco_em`); o app mostra a mudança e a pessoa dá um novo
 * aceite, que cria uma assinatura no valor novo. Sem aceite, segue no antigo.
 * Aumento de cobrança recorrente exige aviso e novo consentimento (CDC + regras
 * de cartão) — por isso não se troca o valor no débito sem passar por aqui.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('plano_preco', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      valor_centavos: { type: Sequelize.INTEGER, allowNull: false },
      // Um rótulo humano para lembrar por que este preço existe (ex.: "lançamento").
      rotulo: { type: Sequelize.STRING(80) },
      vigente_desde: { type: Sequelize.DATEONLY, allowNull: false },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      removido_em: { type: Sequelize.DATE },
    });
    await queryInterface.addIndex('plano_preco', ['vigente_desde'], { name: 'plano_preco_vigencia_idx' });

    await queryInterface.addColumn('assinatura', 'preco_novo_centavos', { type: Sequelize.INTEGER });
    await queryInterface.addColumn('assinatura', 'troca_preco_em', { type: Sequelize.DATEONLY });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('assinatura', 'troca_preco_em');
    await queryInterface.removeColumn('assinatura', 'preco_novo_centavos');
    await queryInterface.dropTable('plano_preco');
  },
};
