'use strict';

/**
 * O dia da trilha vira um mini devocional: uma SEQUÊNCIA ordenada de blocos,
 * com vários de cada tipo, intercalados. A ordem importa:
 *
 *   [ {tipo:'texto', texto}, {tipo:'referencia', ref, texto?}, {tipo:'texto'...},
 *     {tipo:'link', rotulo, url} ]
 *
 * Só o bloco 'referencia' ganha a caixa cor de terra no app. A pergunta segue
 * num campo à parte (dispara o "responder no diário").
 *
 * `corpo` é MANTIDO como o texto plano do dia — dele depende a coluna gerada
 * `busca` (tsvector) e é o que alimenta o embedding. O importador passa a
 * preencher os dois: `blocos` (estrutura) e `corpo` (texto concatenado).
 * Só `referencias` e `links` saem, pois agora vivem dentro de `blocos`.
 */
const SELECT = require('sequelize').QueryTypes.SELECT;

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('trilha_dia', 'blocos', {
      type: Sequelize.JSONB, allowNull: false, defaultValue: [],
    });

    const linhas = await queryInterface.sequelize.query(
      'SELECT id, corpo, referencias, links FROM trilha_dia', { type: SELECT }
    );
    for (const l of linhas) {
      const blocos = [];
      if (l.corpo && String(l.corpo).trim()) blocos.push({ tipo: 'texto', texto: l.corpo });
      for (const ref of (l.referencias || [])) blocos.push({ tipo: 'referencia', ref });
      for (const lk of (l.links || [])) blocos.push({ tipo: 'link', rotulo: lk.rotulo, url: lk.url });
      await queryInterface.sequelize.query(
        'UPDATE trilha_dia SET blocos = :b::jsonb WHERE id = :id',
        { replacements: { b: JSON.stringify(blocos), id: l.id } }
      );
    }

    await queryInterface.removeColumn('trilha_dia', 'referencias');
    await queryInterface.removeColumn('trilha_dia', 'links');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('trilha_dia', 'referencias', { type: Sequelize.ARRAY(Sequelize.TEXT), allowNull: false, defaultValue: [] });
    await queryInterface.addColumn('trilha_dia', 'links', { type: Sequelize.JSONB, allowNull: false, defaultValue: [] });

    const linhas = await queryInterface.sequelize.query('SELECT id, blocos FROM trilha_dia', { type: SELECT });
    for (const l of linhas) {
      const blocos = l.blocos || [];
      const referencias = blocos.filter((b) => b.tipo === 'referencia').map((b) => b.ref);
      const links = blocos.filter((b) => b.tipo === 'link').map((b) => ({ rotulo: b.rotulo, url: b.url }));
      await queryInterface.sequelize.query(
        'UPDATE trilha_dia SET referencias = :r::text[], links = :l::jsonb WHERE id = :id',
        { replacements: { r: `{${referencias.map((x) => `"${x}"`).join(',')}}`, l: JSON.stringify(links), id: l.id } }
      );
    }
    await queryInterface.removeColumn('trilha_dia', 'blocos');
  },
};
