'use strict';

const { novoId } = require('../../lib/id');

module.exports = (sequelize, DataTypes) => {
  const PlanoPreco = sequelize.define('PlanoPreco', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    valorCentavos: { type: DataTypes.INTEGER, allowNull: false },
    rotulo: DataTypes.STRING(80),
    vigenteDesde: { type: DataTypes.DATEONLY, allowNull: false },
  }, {
    tableName: 'plano_preco',
  });

  return PlanoPreco;
};
