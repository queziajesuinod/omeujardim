'use strict';

const { novoId } = require('../../lib/id');

module.exports = (sequelize, DataTypes) => {
  const Sessao = sequelize.define('Sessao', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    usuarioId: { type: DataTypes.UUID, allowNull: false },
    // Guarda o hash do refresh, nunca o token. Banco vazado não vira acesso.
    refreshHash: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    // Família liga os refresh sucessivos do mesmo login. Reuso derruba a família.
    familia: { type: DataTypes.UUID, allowNull: false },
    dispositivo: DataTypes.STRING(200),
    expiraEm: { type: DataTypes.DATE, allowNull: false },
    revogadaEm: DataTypes.DATE,
  }, {
    tableName: 'sessao',
    paranoid: false, // sessão morta some de verdade
    defaultScope: { attributes: { exclude: ['refreshHash'] } },
    scopes: { comHash: { attributes: { include: ['refreshHash'] } } },
  });

  Sessao.associate = (db) => {
    Sessao.belongsTo(db.Usuario, { foreignKey: 'usuarioId' });
  };

  /** Limpeza periódica. Rode num cron diário. */
  Sessao.limparExpiradas = function () {
    return Sessao.destroy({
      where: { expiraEm: { [sequelize.Sequelize.Op.lt]: new Date() } },
    });
  };

  return Sessao;
};
