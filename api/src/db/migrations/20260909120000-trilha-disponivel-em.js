'use strict';

/**
 * Fatia C · Trilheiro. Agendamento de trilhas.
 *
 * `disponivel_em` é a data de estreia: antes dela, a trilha aparece no catálogo
 * como "em breve" e ainda não dá para participar. Nula, a trilha está disponível
 * assim que for publicada. Separado de `publicada_em` (que controla se aparece):
 * uma trilha pode estar publicada e visível, mas ainda "em breve".
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('trilha', 'disponivel_em', {
      type: Sequelize.DATEONLY,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('trilha', 'disponivel_em');
  },
};
