'use strict';

/**
 * Usuário e sessão.
 *
 * Notas de decisão:
 * - id é UUID gerado pela aplicação, não pelo banco, porque o celular também
 *   gera id offline. O default do banco existe só como rede de segurança.
 * - e-mail guarda a versão normalizada em coluna separada, com índice único.
 *   Assim "Maria@Gmail.com" e "maria@gmail.com" são a mesma conta.
 * - consentimento tem data e versão do texto aceito. A LGPD exige provar
 *   QUANDO e A QUÊ a pessoa consentiu, não só que consentiu.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('usuario', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      email: { type: Sequelize.STRING(320), allowNull: false },
      email_normalizado: { type: Sequelize.STRING(320), allowNull: false },
      email_confirmado_em: { type: Sequelize.DATE },
      nome: { type: Sequelize.STRING(120), allowNull: false },
      senha_hash: { type: Sequelize.STRING(255), allowNull: false },

      // Fuso e início do dia devocional. Ver seção 06 do manual:
      // o dia começa às 4h no fuso da pessoa, não à meia-noite UTC.
      fuso: { type: Sequelize.STRING(64), allowNull: false, defaultValue: 'America/Sao_Paulo' },
      inicio_do_dia: { type: Sequelize.TIME, allowNull: false, defaultValue: '04:00:00' },

      // LGPD: prova de consentimento
      consentimento_versao: { type: Sequelize.STRING(16) },
      consentimento_em: { type: Sequelize.DATE },
      consentimento_sensivel_em: { type: Sequelize.DATE }, // art. 11, destacado
      consentimento_revogado_em: { type: Sequelize.DATE },

      // Bloqueio por tentativa de login
      tentativas_falhas: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      bloqueado_ate: { type: Sequelize.DATE },

      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      removido_em: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('usuario', ['email_normalizado'], {
      unique: true,
      name: 'usuario_email_normalizado_uk',
      where: { removido_em: null },
    });

    await queryInterface.createTable('sessao', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      usuario_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'usuario', key: 'id' },
        onDelete: 'CASCADE',
      },
      // Guarda o HASH do refresh token, nunca o token. Se o banco vazar,
      // ninguém consegue se passar por ninguém.
      refresh_hash: { type: Sequelize.STRING(255), allowNull: false },
      familia: { type: Sequelize.UUID, allowNull: false }, // detecção de reuso
      dispositivo: { type: Sequelize.STRING(200) },
      expira_em: { type: Sequelize.DATE, allowNull: false },
      revogada_em: { type: Sequelize.DATE },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('sessao', ['usuario_id'], { name: 'sessao_usuario_idx' });
    await queryInterface.addIndex('sessao', ['refresh_hash'], { unique: true, name: 'sessao_refresh_uk' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sessao');
    await queryInterface.dropTable('usuario');
  },
};
