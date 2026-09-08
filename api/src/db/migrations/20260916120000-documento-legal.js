'use strict';

/**
 * Textos legais editáveis: Termos de uso e Política de privacidade. Ficam no
 * banco (não no código) para a autora poder ajustar sem deploy. O app lê o
 * texto vigente e mostra numa modal, e o cadastro aponta para ele.
 *
 * `chave` é única ('termos' | 'privacidade'). `versao` permite, no futuro,
 * amarrar o consentimento à versão do texto que a pessoa aceitou.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('documento_legal', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      chave: { type: Sequelize.STRING(20), allowNull: false },
      titulo: { type: Sequelize.STRING(160), allowNull: false },
      corpo: { type: Sequelize.TEXT, allowNull: false },
      versao: { type: Sequelize.STRING(20) },
      publicado_em: { type: Sequelize.DATE },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      removido_em: { type: Sequelize.DATE },
    });
    await queryInterface.addIndex('documento_legal', ['chave'], {
      unique: true, name: 'documento_legal_chave_uk', where: { removido_em: null },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('documento_legal');
  },
};
