'use strict';

/**
 * Assinaturas e cobrança (ver PLANO-ASSINATURAS.md).
 *
 * `assinatura` guarda o ciclo de vida de uma assinatura da pessoa: o estado
 * (trial, ativa, cancelada, encerrada…), o método, o valor e as datas que
 * decidem o acesso. `cobranca` guarda cada transação, para conciliar com a Efí
 * e mostrar o histórico à pessoa.
 *
 * Nenhum dado de cartão mora aqui — só `payment_token` de passagem e os ids da
 * Efí para conciliação. O número do cartão nunca toca este banco (PCI).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('assinatura', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      usuario_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'usuario', key: 'id' }, onDelete: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('iniciada', 'trial', 'ativa', 'inadimplente', 'cancelada', 'encerrada'),
        allowNull: false, defaultValue: 'iniciada',
      },
      metodo: { type: Sequelize.ENUM('cartao', 'pix'), allowNull: false, defaultValue: 'cartao' },
      ciclo: { type: Sequelize.ENUM('mensal', 'anual'), allowNull: false, defaultValue: 'mensal' },
      valor_centavos: { type: Sequelize.INTEGER, allowNull: false },
      // Datas que decidem o acesso. `periodo_fim` é o "pago até"; `trial_ate` é o
      // fim dos 7 dias grátis. Calculadas no fuso da pessoa, guardadas como dia.
      trial_ate: { type: Sequelize.DATEONLY },
      periodo_inicio: { type: Sequelize.DATEONLY },
      periodo_fim: { type: Sequelize.DATEONLY },
      proxima_cobranca: { type: Sequelize.DATEONLY },
      cancelada_em: { type: Sequelize.DATE },
      // Conciliação com a Efí. Ids, nunca dado de cartão.
      efi_plano_id: { type: Sequelize.STRING(64) },
      efi_assinatura_id: { type: Sequelize.STRING(64) },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      removido_em: { type: Sequelize.DATE },
    });

    // O gate de login procura a assinatura da pessoa por aqui.
    await queryInterface.addIndex('assinatura', ['usuario_id'], { name: 'assinatura_usuario_idx' });
    // A rotina diária varre por estado e datas de fechamento/cobrança.
    await queryInterface.addIndex('assinatura', ['status', 'periodo_fim'], { name: 'assinatura_status_fim_idx' });
    await queryInterface.addIndex('assinatura', ['status', 'proxima_cobranca'], { name: 'assinatura_status_cobranca_idx' });
    // O id da assinatura na Efí é único quando existe (evita duplicar por webhook).
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX assinatura_efi_uk ON assinatura (efi_assinatura_id) WHERE efi_assinatura_id IS NOT NULL'
    );

    await queryInterface.createTable('cobranca', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      assinatura_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'assinatura', key: 'id' }, onDelete: 'CASCADE',
      },
      usuario_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'usuario', key: 'id' }, onDelete: 'CASCADE',
      },
      metodo: { type: Sequelize.ENUM('cartao', 'pix'), allowNull: false },
      status: {
        type: Sequelize.ENUM('pendente', 'pago', 'recusada', 'estornada', 'expirada'),
        allowNull: false, defaultValue: 'pendente',
      },
      valor_centavos: { type: Sequelize.INTEGER, allowNull: false },
      vencimento: { type: Sequelize.DATEONLY },
      pago_em: { type: Sequelize.DATE },
      // Ids da Efí. `efi_txid` é do PIX; `efi_charge_id` é o id da cobrança.
      efi_charge_id: { type: Sequelize.STRING(64) },
      efi_txid: { type: Sequelize.STRING(64) },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      removido_em: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('cobranca', ['assinatura_id'], { name: 'cobranca_assinatura_idx' });
    await queryInterface.addIndex('cobranca', ['usuario_id'], { name: 'cobranca_usuario_idx' });
    // O webhook é idempotente: a mesma cobrança da Efí não vira duas linhas.
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX cobranca_efi_charge_uk ON cobranca (efi_charge_id) WHERE efi_charge_id IS NOT NULL'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('cobranca');
    await queryInterface.dropTable('assinatura');
  },
};
