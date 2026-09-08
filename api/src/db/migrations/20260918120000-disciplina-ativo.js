'use strict';

/**
 * Ativa/inativa uma disciplina do catálogo sem apagá-la. Inativar tira do
 * catálogo de novas práticas no app, mas quem já a usa continua com ela e o
 * histórico permanece — nada murcha por ausência (invariante em CLAUDE.md).
 *
 * Não usamos o soft delete (removido_em) para isto: inativar é reversível e
 * frequente, o remover é definitivo. São coisas diferentes.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('disciplina', 'ativo', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('disciplina', 'ativo');
  },
};
