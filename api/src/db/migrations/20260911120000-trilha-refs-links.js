'use strict';

/**
 * Trilhas: um dia pode ter VÁRIAS referências bíblicas e VÁRIOS links (vídeo,
 * música, algo fora do app). E sai a marca "gratuita" — o acesso passará a ser
 * por assinatura, então não há mais trilha de graça vs. paga por trilha.
 *
 *  - trilha_dia.referencias: text[]  (substitui o antigo referencia único)
 *  - trilha_dia.links: jsonb         ([{ rotulo, url }])
 *  - trilha.gratuita: removida
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('trilha_dia', 'referencias', {
      type: Sequelize.ARRAY(Sequelize.TEXT), allowNull: false, defaultValue: [],
    });
    await queryInterface.addColumn('trilha_dia', 'links', {
      type: Sequelize.JSONB, allowNull: false, defaultValue: [],
    });
    // Migra a referência única existente para o array.
    await queryInterface.sequelize.query(
      "UPDATE trilha_dia SET referencias = ARRAY[referencia]::text[] WHERE referencia IS NOT NULL AND referencia <> ''"
    );
    await queryInterface.removeColumn('trilha_dia', 'referencia');
    await queryInterface.removeColumn('trilha', 'gratuita');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('trilha', 'gratuita', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
    await queryInterface.addColumn('trilha_dia', 'referencia', { type: Sequelize.STRING(60) });
    await queryInterface.sequelize.query(
      'UPDATE trilha_dia SET referencia = referencias[1] WHERE array_length(referencias, 1) >= 1'
    );
    await queryInterface.removeColumn('trilha_dia', 'links');
    await queryInterface.removeColumn('trilha_dia', 'referencias');
  },
};
