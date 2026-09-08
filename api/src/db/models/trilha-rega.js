'use strict';

const { novoId } = require('../../lib/id');

// A rega de um dia da trilha. Não é paranoid: sair da trilha leva o progresso
// junto (CASCADE da inscrição), e uma rega desfeita não guarda lápide.

module.exports = (sequelize, DataTypes) => {
  const TrilhaRega = sequelize.define('TrilhaRega', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    inscricaoId: { type: DataTypes.UUID, allowNull: false },
    trilhaDiaId: { type: DataTypes.UUID, allowNull: false },
    ordem: { type: DataTypes.SMALLINT, allowNull: false },
    dataRef: { type: DataTypes.DATEONLY, allowNull: false },
  }, { tableName: 'trilha_rega', paranoid: false });

  TrilhaRega.associate = (db) => {
    TrilhaRega.belongsTo(db.TrilhaInscricao, { foreignKey: 'inscricaoId' });
  };

  return TrilhaRega;
};
