'use strict';

const { novoId } = require('../../lib/id');

module.exports = (sequelize, DataTypes) => {
  const TrilhaInscricao = sequelize.define('TrilhaInscricao', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    usuarioId: { type: DataTypes.UUID, allowNull: false },
    trilhaId: { type: DataTypes.UUID, allowNull: false },
    iniciadaEm: { type: DataTypes.DATEONLY, allowNull: false },
    concluidaEm: DataTypes.DATEONLY,
  }, { tableName: 'trilha_inscricao' });

  TrilhaInscricao.associate = (db) => {
    TrilhaInscricao.belongsTo(db.Usuario, { foreignKey: 'usuarioId' });
    TrilhaInscricao.belongsTo(db.Trilha, { foreignKey: 'trilhaId', as: 'trilha' });
    TrilhaInscricao.hasMany(db.TrilhaRega, { foreignKey: 'inscricaoId', as: 'regas' });
  };

  return TrilhaInscricao;
};
