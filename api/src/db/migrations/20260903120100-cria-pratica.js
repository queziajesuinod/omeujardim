'use strict';

/**
 * Disciplina (catálogo) e prática (a configuração de cada pessoa).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('disciplina', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      codigo: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      nome: { type: Sequelize.STRING(80), allowNull: false },
      icone: { type: Sequelize.STRING(40), allowNull: false },
      ordem: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      removido_em: { type: Sequelize.DATE },
    });

    await queryInterface.createTable('pratica', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      usuario_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'usuario', key: 'id' }, onDelete: 'CASCADE',
      },
      disciplina_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'disciplina', key: 'id' }, onDelete: 'RESTRICT',
      },
      meta_por_semana: { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 7 },
      // 0 = domingo. Array nativo do Postgres, não string separada por vírgula.
      dias_semana: { type: Sequelize.ARRAY(Sequelize.SMALLINT), allowNull: false, defaultValue: [0, 1, 2, 3, 4, 5, 6] },
      janela_inicio: { type: Sequelize.TIME },
      janela_fim: { type: Sequelize.TIME },
      lembrete_em: { type: Sequelize.TIME },
      ativa: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      removido_em: { type: Sequelize.DATE },
    });

    // A mesma pessoa não configura a mesma disciplina duas vezes.
    await queryInterface.addIndex('pratica', ['usuario_id', 'disciplina_id'], {
      unique: true, name: 'pratica_usuario_disciplina_uk', where: { removido_em: null },
    });
    await queryInterface.addIndex('pratica', ['usuario_id', 'ativa'], { name: 'pratica_usuario_ativa_idx' });

    await queryInterface.addConstraint('pratica', {
      fields: ['meta_por_semana'],
      type: 'check',
      name: 'pratica_meta_valida',
      where: { meta_por_semana: { [Sequelize.Op.between]: [1, 21] } },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pratica');
    await queryInterface.dropTable('disciplina');
  },
};
