'use strict';

/**
 * Vincula uma anotação do diário ao dia de trilha que a motivou. Guardar
 * `trilha_id` mais a ordem do dia basta para reabrir o devocional daquele dia
 * e relembrar o contexto do que se escreveu — sem duplicar o conteúdo da
 * trilha dentro do diário.
 *
 * As duas colunas são nulas quando a anotação não nasceu de uma trilha, que é
 * a maioria. Não há índice: a leitura do diário é sempre por `usuario_id`,
 * nunca por trilha, então um índice aqui só custaria escrita sem pagar leitura.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('anotacao', 'trilha_id', { type: Sequelize.UUID });
    await queryInterface.addColumn('anotacao', 'trilha_dia_ordem', { type: Sequelize.SMALLINT });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('anotacao', 'trilha_dia_ordem');
    await queryInterface.removeColumn('anotacao', 'trilha_id');
  },
};
