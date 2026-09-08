'use strict';

/**
 * Lista de oração.
 *
 * Atenção de privacidade que vale mais que o código: esta tabela guarda dados
 * de TERCEIROS que nunca usaram o app e nunca consentiram com nada. O nome da
 * pessoa por quem se ora é dado pessoal dela, não de quem ora.
 *
 * Por isso: nome e testemunho vão cifrados, esses campos nunca entram em
 * telemetria, e a exportação de dados do titular inclui esta tabela.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pedido_oracao', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      usuario_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'usuario', key: 'id' }, onDelete: 'CASCADE',
      },
      titulo_cifrado: { type: Sequelize.TEXT, allowNull: false },
      pessoa_cifrada: { type: Sequelize.TEXT },
      status: {
        type: Sequelize.ENUM('pedindo', 'respondido', 'arquivado'),
        allowNull: false, defaultValue: 'pedindo',
      },
      respondido_em: { type: Sequelize.DATEONLY },
      testemunho_cifrado: { type: Sequelize.TEXT },
      lembrete_em: { type: Sequelize.TIME },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      removido_em: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('pedido_oracao', ['usuario_id', 'status'], {
      name: 'oracao_usuario_status_idx',
    });

    // Coerência: respondido exige data, e só respondido tem data.
    await queryInterface.sequelize.query(`
      ALTER TABLE pedido_oracao ADD CONSTRAINT oracao_respondido_coerente
      CHECK ((status = 'respondido' AND respondido_em IS NOT NULL)
          OR (status <> 'respondido' AND respondido_em IS NULL));
    `);

    // Trilha de auditoria dos direitos do titular (LGPD art. 18).
    // Toda exportação e toda exclusão fica registrada, com prazo de resposta.
    await queryInterface.createTable('solicitacao_titular', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      usuario_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'usuario', key: 'id' }, onDelete: 'CASCADE',
      },
      tipo: {
        type: Sequelize.ENUM('acesso', 'portabilidade', 'correcao', 'eliminacao', 'revogacao'),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('recebida', 'em_andamento', 'concluida', 'recusada'),
        allowNull: false, defaultValue: 'recebida',
      },
      motivo_recusa: { type: Sequelize.TEXT },
      prazo_em: { type: Sequelize.DATE, allowNull: false },
      concluida_em: { type: Sequelize.DATE },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('solicitacao_titular', ['status', 'prazo_em'], {
      name: 'solicitacao_prazo_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('solicitacao_titular');
    await queryInterface.dropTable('pedido_oracao');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_pedido_oracao_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_solicitacao_titular_tipo";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_solicitacao_titular_status";');
  },
};
