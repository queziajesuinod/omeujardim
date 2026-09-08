'use strict';

/**
 * Fatia D · Intercessor.
 *
 * A oração ganha uma CATEGORIA opcional e não sensível (saúde, trabalho,
 * família…) e um opt-in explícito para intercessão. Isso é o que torna o painel
 * do intercessor possível SEM quebrar a privacidade: título, nome de terceiro e
 * testemunho seguem cifrados e nunca saem; o intercessor vê apenas a categoria
 * agregada de quem escolheu compartilhar, e o termômetro de respondidas.
 *
 * A categoria é texto plano de propósito: ela NÃO é dado sensível (não revela
 * quem, nem o quê em detalhe), e precisa ser agregável em contagem. Por isso não
 * é cifrada como os demais campos.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pedido_oracao', 'categoria', {
      type: Sequelize.STRING(30),
    });
    await queryInterface.addColumn('pedido_oracao', 'compartilhar_intercessao', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
    // Achar rápido as orações compartilhadas por categoria, para o painel.
    await queryInterface.addIndex('pedido_oracao', ['compartilhar_intercessao', 'categoria'], {
      name: 'pedido_oracao_intercessao_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('pedido_oracao', 'pedido_oracao_intercessao_idx');
    await queryInterface.removeColumn('pedido_oracao', 'compartilhar_intercessao');
    await queryInterface.removeColumn('pedido_oracao', 'categoria');
  },
};
