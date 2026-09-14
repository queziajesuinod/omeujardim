'use strict';

/**
 * Descrição própria da trilha: a apresentação autoral do que a trilha percorre.
 *
 * Antes, a tela de convite montava a apresentação a partir do primeiro dia
 * (título e primeiro parágrafo do dia 1). Isso amarrava a apresentação ao
 * conteúdo do dia 1, que nem sempre resume a trilha. `descricao` é um texto
 * livre, escrito pela autora, para instruir o que será tratado ao longo da
 * trilha — como o `descricao` que a estação já tem. Nula, a tela cai no antigo
 * "começa assim" do dia 1.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('trilha', 'descricao', {
      type: Sequelize.TEXT,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('trilha', 'descricao');
  },
};
