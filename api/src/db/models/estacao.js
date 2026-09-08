'use strict';

const { novoId } = require('../../lib/id');

module.exports = (sequelize, DataTypes) => {
  const Estacao = sequelize.define('Estacao', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    nome: { type: DataTypes.STRING(160), allowNull: false },
    tema: DataTypes.STRING(60),
    descricao: DataTypes.TEXT,
    dias: { type: DataTypes.SMALLINT, allowNull: false },
    publicadaEm: DataTypes.DATE,
    disponivelEm: DataTypes.DATEONLY,
  }, { tableName: 'estacao' });

  Estacao.associate = (db) => {
    Estacao.hasMany(db.EstacaoDia, { foreignKey: 'estacaoId', as: 'conteudo' });
  };

  return Estacao;
};
