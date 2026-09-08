'use strict';

const { novoId } = require('../../lib/id');

module.exports = (sequelize, DataTypes) => {
  const Pratica = sequelize.define('Pratica', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    usuarioId: { type: DataTypes.UUID, allowNull: false },
    disciplinaId: { type: DataTypes.UUID, allowNull: false },
    metaPorSemana: {
      type: DataTypes.SMALLINT, allowNull: false, defaultValue: 7,
      validate: { min: 1, max: 21 },
    },
    diasSemana: {
      type: DataTypes.ARRAY(DataTypes.SMALLINT), allowNull: false, defaultValue: [0, 1, 2, 3, 4, 5, 6],
      validate: {
        valores(lista) {
          if (!lista.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
            throw new Error('Dias da semana precisam ser números de 0 a 6.');
          }
        },
      },
    },
    janelaInicio: DataTypes.TIME,
    janelaFim: DataTypes.TIME,
    lembreteEm: DataTypes.TIME,
    ativa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, { tableName: 'pratica' });

  Pratica.associate = (db) => {
    Pratica.belongsTo(db.Usuario, { foreignKey: 'usuarioId' });
    Pratica.belongsTo(db.Disciplina, { foreignKey: 'disciplinaId', as: 'disciplina' });
    Pratica.hasMany(db.Registro, { foreignKey: 'praticaId', as: 'registros' });
  };

  /** A prática está prevista para este dia da semana? */
  Pratica.prototype.previstaEm = function (diaDaSemana) {
    return this.ativa && this.diasSemana.includes(diaDaSemana);
  };

  return Pratica;
};
