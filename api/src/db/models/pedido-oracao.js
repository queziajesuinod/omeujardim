'use strict';

const { novoId } = require('../../lib/id');
const { cifrar, decifrar } = require('../../lib/cripto');

/** Cria um par de campos: coluna cifrada no banco, texto claro no código. */
function campoCifrado(nomeColuna) {
  return {
    type: require('sequelize').DataTypes.VIRTUAL,
    get() {
      const g = this.getDataValue(nomeColuna);
      return g ? decifrar(g) : null;
    },
    set(valor) {
      this.setDataValue(nomeColuna, cifrar(valor));
    },
  };
}

module.exports = (sequelize, DataTypes) => {
  const PedidoOracao = sequelize.define('PedidoOracao', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    usuarioId: { type: DataTypes.UUID, allowNull: false },

    tituloCifrado: { type: DataTypes.TEXT, allowNull: false, field: 'titulo_cifrado' },
    pessoaCifrada: { type: DataTypes.TEXT, field: 'pessoa_cifrada' },
    testemunhoCifrado: { type: DataTypes.TEXT, field: 'testemunho_cifrado' },

    // O nome da pessoa por quem se ora é dado dela, não de quem ora.
    // Ela nunca consentiu com nada. Vai cifrado, e nunca sai em telemetria.
    titulo: campoCifrado('tituloCifrado'),
    pessoa: campoCifrado('pessoaCifrada'),
    testemunho: campoCifrado('testemunhoCifrado'),

    status: {
      type: DataTypes.ENUM('pedindo', 'respondido', 'arquivado'),
      allowNull: false, defaultValue: 'pedindo',
    },
    respondidoEm: DataTypes.DATEONLY,
    lembreteEm: DataTypes.TIME,

    // Categoria NÃO sensível e opt-in de intercessão. É o único par que pode ser
    // agregado no painel do intercessor; título, pessoa e testemunho, jamais.
    categoria: DataTypes.STRING(30),
    compartilharIntercessao: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    tableName: 'pedido_oracao',
    validate: {
      respondidoCoerente() {
        if (this.status === 'respondido' && !this.respondidoEm) {
          throw new Error('Pedido respondido precisa da data em que foi respondido.');
        }
        if (this.status !== 'respondido' && this.respondidoEm) {
          throw new Error('Só pedido respondido tem data de resposta.');
        }
      },
    },
  });

  PedidoOracao.associate = (db) => {
    PedidoOracao.belongsTo(db.Usuario, { foreignKey: 'usuarioId' });
  };

  PedidoOracao.prototype.toJSON = function () {
    const { tituloCifrado, pessoaCifrada, testemunhoCifrado, ...resto } = this.get();
    return { ...resto, titulo: this.titulo, pessoa: this.pessoa, testemunho: this.testemunho };
  };

  return PedidoOracao;
};
