'use strict';

const { novoId } = require('../../lib/id');

module.exports = (sequelize, DataTypes) => {
  const Trilha = sequelize.define('Trilha', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    titulo: { type: DataTypes.STRING(160), allowNull: false },
    autor: { type: DataTypes.STRING(120), allowNull: false },
    tema: DataTypes.STRING(60),
    // Apresentação autoral do que a trilha percorre. Antes vinha do dia 1.
    descricao: DataTypes.TEXT,
    dias: { type: DataTypes.SMALLINT, allowNull: false },
    publicadaEm: DataTypes.DATE,
    // Data de estreia. Antes dela, "em breve" no catálogo. Ver a migração.
    disponivelEm: DataTypes.DATEONLY,
  }, { tableName: 'trilha' });

  Trilha.associate = (db) => {
    Trilha.hasMany(db.TrilhaDia, { foreignKey: 'trilhaId', as: 'conteudo' });
  };

  return Trilha;
};
