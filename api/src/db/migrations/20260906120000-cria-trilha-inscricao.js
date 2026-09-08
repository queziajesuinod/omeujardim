'use strict';

/**
 * A trilha vira jornada: a pessoa participa (inscrição) e rega um dia de cada
 * vez. O avanço é pelo calendário — o dia de hoje é calculado a partir de
 * `iniciada_em` —, então é possível ficar para trás. Um dia não regado nunca
 * some nem fica vermelho: ele vira uma semente a resgatar. Ver o princípio
 * "nada murcha, ausência nunca é vermelha" no CLAUDE.md.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('trilha_inscricao', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      usuario_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'usuario', key: 'id' }, onDelete: 'CASCADE',
      },
      trilha_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'trilha', key: 'id' }, onDelete: 'RESTRICT',
      },
      // O dia devocional em que a pessoa começou. O "dia atual" da trilha é
      // contado a partir daqui, no fuso dela, calculado no cliente.
      iniciada_em: { type: Sequelize.DATEONLY, allowNull: false },
      concluida_em: { type: Sequelize.DATEONLY },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      removido_em: { type: Sequelize.DATE },
    });

    // Uma inscrição ativa por pessoa e trilha. Reparticipar reativa a mesma.
    await queryInterface.addIndex('trilha_inscricao', ['usuario_id', 'trilha_id'], {
      unique: true, name: 'trilha_inscricao_usuario_trilha_uk', where: { removido_em: null },
    });

    await queryInterface.createTable('trilha_rega', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      inscricao_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'trilha_inscricao', key: 'id' }, onDelete: 'CASCADE',
      },
      trilha_dia_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'trilha_dia', key: 'id' }, onDelete: 'RESTRICT',
      },
      // A ordem do dia dentro da trilha (1..N). Redundante com o dia, mas deixa
      // a consulta de progresso e a unicidade simples e rápidas.
      ordem: { type: Sequelize.SMALLINT, allowNull: false },
      // O dia devocional em que a rega aconteceu — pode ser hoje (dia atual) ou
      // o dia do resgate de uma semente antiga.
      data_ref: { type: Sequelize.DATEONLY, allowNull: false },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    // Um dia da trilha só se rega uma vez por inscrição.
    await queryInterface.addIndex('trilha_rega', ['inscricao_id', 'ordem'], {
      unique: true, name: 'trilha_rega_inscricao_ordem_uk',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('trilha_rega');
    await queryInterface.dropTable('trilha_inscricao');
  },
};
