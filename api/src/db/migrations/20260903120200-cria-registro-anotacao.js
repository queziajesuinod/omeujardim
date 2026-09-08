'use strict';

/**
 * Registro (a rega) e anotação (o que a pessoa ouviu).
 *
 * A anotação é o dado mais sensível do app inteiro e por isso:
 * - o texto é gravado cifrado, em texto_cifrado, nunca em claro;
 * - não existe índice de busca no servidor, a busca roda no celular;
 * - as tags viram índice cego, para dar filtro sem revelar conteúdo.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('registro', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      usuario_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'usuario', key: 'id' }, onDelete: 'CASCADE',
      },
      pratica_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'pratica', key: 'id' }, onDelete: 'CASCADE',
      },
      // Dia devocional no fuso da pessoa, calculado no cliente. É DATEONLY
      // de propósito: quem ora 23h50 e quem ora 00h10 não podem cair em dias
      // diferentes por causa de UTC.
      data_ref: { type: Sequelize.DATEONLY, allowNull: false },
      duracao_min: { type: Sequelize.SMALLINT },
      // Quando de fato aconteceu, com fuso. Serve para a conquista "antes do sol".
      concluido_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      origem: { type: Sequelize.ENUM('app', 'widget', 'importacao'), allowNull: false, defaultValue: 'app' },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      removido_em: { type: Sequelize.DATE },
    });

    // A trava que impede o toque duplo de virar dois registros.
    // Como o id vem do cliente e é UUIDv7, a sincronização já é idempotente,
    // mas esta restrição garante a regra de negócio no banco.
    await queryInterface.addIndex('registro', ['pratica_id', 'data_ref'], {
      unique: true, name: 'registro_pratica_dia_uk', where: { removido_em: null },
    });
    // Índice da consulta mais quente do app: a tela Hoje e o calendário.
    await queryInterface.addIndex('registro', ['usuario_id', 'data_ref'], { name: 'registro_usuario_dia_idx' });

    await queryInterface.createTable('anotacao', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      usuario_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'usuario', key: 'id' }, onDelete: 'CASCADE',
      },
      registro_id: {
        type: Sequelize.UUID,
        references: { model: 'registro', key: 'id' }, onDelete: 'SET NULL',
      },
      // AES-256-GCM. Formato v1.<iv>.<tag>.<dados>. Ver src/lib/cripto.js.
      texto_cifrado: { type: Sequelize.TEXT, allowNull: false },
      // Referência bíblica fica em claro: é ponteiro público, não confissão.
      referencia: { type: Sequelize.STRING(60) },
      // HMAC das tags, para filtrar sem ler.
      tags_cegas: { type: Sequelize.ARRAY(Sequelize.STRING(64)), allowNull: false, defaultValue: [] },
      data_ref: { type: Sequelize.DATEONLY, allowNull: false },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      removido_em: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('anotacao', ['usuario_id', 'data_ref'], { name: 'anotacao_usuario_dia_idx' });
    await queryInterface.addIndex('anotacao', ['tags_cegas'], { using: 'gin', name: 'anotacao_tags_gin' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('anotacao');
    await queryInterface.dropTable('registro');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_registro_origem";');
  },
};
