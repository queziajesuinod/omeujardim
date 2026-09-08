'use strict';

/**
 * Papéis de acesso (RBAC). Uma pessoa pode acumular papéis: alguém é trilheiro
 * E intercessor, o admin vê tudo. Guardado como array no próprio usuário — o
 * conjunto de papéis é pequeno e fixo, então não precisa de tabela à parte.
 *
 * Papéis: 'admin', 'trilheiro', 'intercessor'. Quem não tem nenhum é usuário
 * comum (o app devocional), que é o caso da esmagadora maioria.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('usuario', 'papeis', {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: false,
      defaultValue: [],
    });
    // Índice GIN para achar rápido quem tem um papel (o painel lista por papel).
    await queryInterface.addIndex('usuario', ['papeis'], {
      name: 'usuario_papeis_idx', using: 'gin',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('usuario', 'usuario_papeis_idx');
    await queryInterface.removeColumn('usuario', 'papeis');
  },
};
