'use strict';

const { novoId } = require('../../lib/id');

// Um conteúdo por dia por disciplina. Sem removido_em: a tabela é gerida por
// recriação (o CASCADE da estação apaga os dias antigos na reimportação).

module.exports = (sequelize, DataTypes) => {
  const EstacaoDia = sequelize.define('EstacaoDia', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    estacaoId: { type: DataTypes.UUID, allowNull: false },
    ordem: { type: DataTypes.SMALLINT, allowNull: false },
    disciplinaCodigo: { type: DataTypes.STRING(40), allowNull: false },
    titulo: { type: DataTypes.STRING(160), allowNull: false },
    corpo: { type: DataTypes.TEXT, allowNull: false },
  }, { tableName: 'estacao_dia', paranoid: false });

  EstacaoDia.associate = (db) => {
    EstacaoDia.belongsTo(db.Estacao, { foreignKey: 'estacaoId', as: 'estacao' });
  };

  return EstacaoDia;
};
