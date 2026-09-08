'use strict';

const { novoId } = require('../../lib/id');

module.exports = (sequelize, DataTypes) => {
  const EstacaoInscricao = sequelize.define('EstacaoInscricao', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    usuarioId: { type: DataTypes.UUID, allowNull: false },
    estacaoId: { type: DataTypes.UUID, allowNull: false },
    iniciadaEm: { type: DataTypes.DATEONLY, allowNull: false },
  }, { tableName: 'estacao_inscricao' });

  EstacaoInscricao.associate = (db) => {
    EstacaoInscricao.belongsTo(db.Usuario, { foreignKey: 'usuarioId' });
    EstacaoInscricao.belongsTo(db.Estacao, { foreignKey: 'estacaoId', as: 'estacao' });
  };

  return EstacaoInscricao;
};
