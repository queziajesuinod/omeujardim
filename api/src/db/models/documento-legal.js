'use strict';

const { novoId } = require('../../lib/id');

module.exports = (sequelize, DataTypes) => {
  const DocumentoLegal = sequelize.define('DocumentoLegal', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    chave: { type: DataTypes.STRING(20), allowNull: false }, // 'termos' | 'privacidade'
    titulo: { type: DataTypes.STRING(160), allowNull: false },
    corpo: { type: DataTypes.TEXT, allowNull: false },
    versao: DataTypes.STRING(20),
    publicadoEm: DataTypes.DATE,
  }, {
    tableName: 'documento_legal',
  });

  return DocumentoLegal;
};
