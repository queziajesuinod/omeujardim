'use strict';

const { novoId } = require('../../lib/id');

module.exports = (sequelize, DataTypes) => {
  const Disciplina = sequelize.define('Disciplina', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    codigo: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    nome: { type: DataTypes.STRING(80), allowNull: false },
    icone: { type: DataTypes.STRING(40), allowNull: false },
    ordem: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // Inativa some do catálogo do app, mas não some de quem já usa. Ver a
    // migração 20260918120000 e o invariante "nada murcha" em CLAUDE.md.
    ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, { tableName: 'disciplina' });

  Disciplina.associate = (db) => {
    Disciplina.hasMany(db.Pratica, { foreignKey: 'disciplinaId', as: 'praticas' });
  };

  return Disciplina;
};
