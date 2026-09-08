'use strict';

const { novoId } = require('../../lib/id');

module.exports = (sequelize, DataTypes) => {
  const AssinaturaPush = sequelize.define('AssinaturaPush', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    usuarioId: { type: DataTypes.UUID, allowNull: false },
    endpoint: { type: DataTypes.TEXT, allowNull: false },
    p256dh: { type: DataTypes.TEXT, allowNull: false },
    auth: { type: DataTypes.TEXT, allowNull: false },
    ultimoEnvioEm: DataTypes.DATE,
  }, {
    tableName: 'assinatura_push',
    // Assinatura de push não guarda lápide: expirou, some. Ver a migração.
    paranoid: false,
  });

  AssinaturaPush.associate = (db) => {
    AssinaturaPush.belongsTo(db.Usuario, { foreignKey: 'usuarioId' });
  };

  return AssinaturaPush;
};
