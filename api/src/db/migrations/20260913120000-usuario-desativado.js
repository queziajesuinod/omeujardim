'use strict';

/**
 * Desativação de conta pelo admin. Diferente de excluir: a conta e os dados
 * ficam, mas quem está desativado não entra e tem as sessões encerradas. É
 * reversível — reativar limpa a data. Excluir continua sendo soft delete em
 * `removido_em`, com expurgo real em 30 dias (ver lib/expurgo.js).
 *
 * Nula = conta ativa. Preenchida = desativada naquele instante.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('usuario', 'desativado_em', {
      type: Sequelize.DATE,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('usuario', 'desativado_em');
  },
};
