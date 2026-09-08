'use strict';

const { novoId } = require('../../lib/id');

module.exports = (sequelize, DataTypes) => {
  const Assinatura = sequelize.define('Assinatura', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    usuarioId: { type: DataTypes.UUID, allowNull: false },
    status: {
      type: DataTypes.ENUM('iniciada', 'trial', 'ativa', 'inadimplente', 'cancelada', 'encerrada'),
      allowNull: false, defaultValue: 'iniciada',
    },
    metodo: { type: DataTypes.ENUM('cartao', 'pix'), allowNull: false, defaultValue: 'cartao' },
    ciclo: { type: DataTypes.ENUM('mensal', 'anual'), allowNull: false, defaultValue: 'mensal' },
    valorCentavos: { type: DataTypes.INTEGER, allowNull: false },
    trialAte: DataTypes.DATEONLY,
    periodoInicio: DataTypes.DATEONLY,
    periodoFim: DataTypes.DATEONLY,
    proximaCobranca: DataTypes.DATEONLY,
    canceladaEm: DataTypes.DATE,
    // Migração de preço: quando o admin direciona esta conta para o preço novo,
    // guarda aqui o valor e a data do aviso. A troca só vale após novo aceite.
    precoNovoCentavos: DataTypes.INTEGER,
    trocaPrecoEm: DataTypes.DATEONLY,
    efiPlanoId: DataTypes.STRING(64),
    efiAssinaturaId: DataTypes.STRING(64),
  }, {
    tableName: 'assinatura',
  });

  Assinatura.associate = (db) => {
    Assinatura.belongsTo(db.Usuario, { foreignKey: 'usuarioId' });
    Assinatura.hasMany(db.Cobranca, { foreignKey: 'assinaturaId', as: 'cobrancas' });
  };

  return Assinatura;
};
