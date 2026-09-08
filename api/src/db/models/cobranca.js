'use strict';

const { novoId } = require('../../lib/id');

module.exports = (sequelize, DataTypes) => {
  const Cobranca = sequelize.define('Cobranca', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    assinaturaId: { type: DataTypes.UUID, allowNull: false },
    usuarioId: { type: DataTypes.UUID, allowNull: false },
    metodo: { type: DataTypes.ENUM('cartao', 'pix'), allowNull: false },
    status: {
      type: DataTypes.ENUM('pendente', 'pago', 'recusada', 'estornada', 'expirada'),
      allowNull: false, defaultValue: 'pendente',
    },
    valorCentavos: { type: DataTypes.INTEGER, allowNull: false },
    vencimento: DataTypes.DATEONLY,
    pagoEm: DataTypes.DATE,
    efiChargeId: DataTypes.STRING(64),
    efiTxid: DataTypes.STRING(64),
  }, {
    tableName: 'cobranca',
  });

  Cobranca.associate = (db) => {
    Cobranca.belongsTo(db.Assinatura, { foreignKey: 'assinaturaId' });
    Cobranca.belongsTo(db.Usuario, { foreignKey: 'usuarioId' });
  };

  return Cobranca;
};
