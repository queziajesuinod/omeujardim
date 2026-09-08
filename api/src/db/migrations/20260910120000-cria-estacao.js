'use strict';

/**
 * Fatia E · Estações. O cronograma do ano.
 *
 * Uma estação é uma temporada com conteúdo por dia e por prática: qual leitura,
 * qual meditação, qual memorização aparece a cada dia. A pessoa escolhe uma
 * estação para seguir; a tela Hoje passa a mostrar em que estação ela está, o
 * dia atual, e o conteúdo daquele dia.
 *
 * `estacao_dia` é a matriz (ordem × disciplina): um conteúdo por dia por prática.
 * `estacao_inscricao` guarda quem segue o quê e desde quando — uma ativa por
 * pessoa (o índice único parcial cuida disso). O avanço é pelo calendário, como
 * nas trilhas: o dia atual vem de `iniciada_em`.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('estacao', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      nome: { type: Sequelize.STRING(160), allowNull: false },
      tema: { type: Sequelize.STRING(60) },
      descricao: { type: Sequelize.TEXT },
      dias: { type: Sequelize.SMALLINT, allowNull: false },
      publicada_em: { type: Sequelize.DATE },
      disponivel_em: { type: Sequelize.DATEONLY },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      removido_em: { type: Sequelize.DATE },
    });

    await queryInterface.createTable('estacao_dia', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      estacao_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'estacao', key: 'id' }, onDelete: 'CASCADE',
      },
      ordem: { type: Sequelize.SMALLINT, allowNull: false },
      // O código da disciplina a que este conteúdo pertence (leitura, meditacao…).
      disciplina_codigo: { type: Sequelize.STRING(40), allowNull: false },
      titulo: { type: Sequelize.STRING(160), allowNull: false },
      corpo: { type: Sequelize.TEXT, allowNull: false },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    // Um conteúdo por dia por disciplina.
    await queryInterface.addIndex('estacao_dia', ['estacao_id', 'ordem', 'disciplina_codigo'], {
      unique: true, name: 'estacao_dia_unico',
    });

    await queryInterface.createTable('estacao_inscricao', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      usuario_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'usuario', key: 'id' }, onDelete: 'CASCADE',
      },
      estacao_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'estacao', key: 'id' }, onDelete: 'RESTRICT',
      },
      iniciada_em: { type: Sequelize.DATEONLY, allowNull: false },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      removido_em: { type: Sequelize.DATE },
    });
    // Uma estação ativa por pessoa. Trocar de estação encerra a anterior.
    await queryInterface.addIndex('estacao_inscricao', ['usuario_id'], {
      unique: true, name: 'estacao_inscricao_uma_ativa', where: { removido_em: null },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('estacao_inscricao');
    await queryInterface.dropTable('estacao_dia');
    await queryInterface.dropTable('estacao');
  },
};
