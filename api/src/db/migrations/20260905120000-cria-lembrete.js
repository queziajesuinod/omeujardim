'use strict';

/**
 * Fatia 9 · Lembrete.
 *
 * Duas coisas: onde guardar a assinatura de Web Push de cada aparelho, e o
 * opt-in de WhatsApp de cada pessoa.
 *
 * A assinatura de push NÃO é paranoid. Quando o navegador diz que ela expirou
 * (410 Gone), a linha some de vez: assinatura morta não tem histórico que valha
 * a pena guardar, e mantê-la só faz a próxima remessa falhar de novo.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('assinatura_push', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      usuario_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'usuario', key: 'id' }, onDelete: 'CASCADE',
      },
      // O endpoint é a identidade do aparelho no serviço de push. Único: o mesmo
      // navegador reassinando atualiza a linha, não cria a segunda.
      endpoint: { type: Sequelize.TEXT, allowNull: false },
      p256dh: { type: Sequelize.TEXT, allowNull: false },
      auth: { type: Sequelize.TEXT, allowNull: false },
      ultimo_envio_em: { type: Sequelize.DATE },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('assinatura_push', ['endpoint'], {
      unique: true, name: 'assinatura_push_endpoint_uk',
    });
    await queryInterface.addIndex('assinatura_push', ['usuario_id'], {
      name: 'assinatura_push_usuario_idx',
    });

    // WhatsApp é a alternativa para quem não instala o PWA. Só com opt-in
    // explícito (a data marca o consentimento) e o número guardado à parte.
    await queryInterface.addColumn('usuario', 'whatsapp_numero', {
      type: Sequelize.STRING(20),
    });
    await queryInterface.addColumn('usuario', 'whatsapp_opt_in_em', {
      type: Sequelize.DATE,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('usuario', 'whatsapp_opt_in_em');
    await queryInterface.removeColumn('usuario', 'whatsapp_numero');
    await queryInterface.dropTable('assinatura_push');
  },
};
