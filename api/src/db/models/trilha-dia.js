'use strict';

const { novoId } = require('../../lib/id');

// A coluna `busca` (tsvector) é GERADA pelo banco e a `embedding` (vector 384)
// é escrita pelo importador via SQL cru — nenhuma das duas entra no model, para
// o Sequelize não tentar gerenciá-las. Esta tabela não tem removido_em, então
// paranoid é desligado explicitamente (senão o global ligaria e quebraria).

module.exports = (sequelize, DataTypes) => {
  const TrilhaDia = sequelize.define('TrilhaDia', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    trilhaId: { type: DataTypes.UUID, allowNull: false },
    ordem: { type: DataTypes.SMALLINT, allowNull: false },
    titulo: { type: DataTypes.STRING(160), allowNull: false },
    // corpo = texto plano do dia (alimenta a busca `busca` e o embedding).
    corpo: { type: DataTypes.TEXT, allowNull: false },
    // blocos = o mini devocional em sequência: texto / referencia / link.
    blocos: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    pergunta: DataTypes.TEXT,
  }, { tableName: 'trilha_dia', paranoid: false });

  TrilhaDia.associate = (db) => {
    TrilhaDia.belongsTo(db.Trilha, { foreignKey: 'trilhaId', as: 'trilha' });
  };

  return TrilhaDia;
};
