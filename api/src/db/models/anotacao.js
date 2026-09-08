'use strict';

const { novoId } = require('../../lib/id');
const { cifrar, decifrar, indiceCego } = require('../../lib/cripto');

module.exports = (sequelize, DataTypes) => {
  const Anotacao = sequelize.define('Anotacao', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    usuarioId: { type: DataTypes.UUID, allowNull: false },
    registroId: DataTypes.UUID,

    // A coluna real. Ninguém escreve nela direto.
    textoCifrado: { type: DataTypes.TEXT, allowNull: false, field: 'texto_cifrado' },

    /**
     * Campo virtual: quem usa o model lê e escreve "texto" normalmente, e a
     * cifra acontece sozinha. Isso importa porque a única forma de garantir
     * que nada entra em claro é tirar a decisão das mãos de quem escreve a
     * rota, seis meses depois, com pressa.
     */
    texto: {
      type: DataTypes.VIRTUAL,
      get() {
        const guardado = this.getDataValue('textoCifrado');
        return guardado ? decifrar(guardado) : null;
      },
      set(valor) {
        this.setDataValue('textoCifrado', cifrar(valor));
      },
    },

    referencia: DataTypes.STRING(60),

    // De qual dia de trilha esta anotação nasceu. Nulo quando não veio de
    // trilha. Guarda a ordem do dia, não o id do trilha_dia: a ordem é estável
    // e basta para reabrir o devocional daquele dia e relembrar o contexto.
    trilhaId: DataTypes.UUID,
    trilhaDiaOrdem: DataTypes.SMALLINT,

    tagsCegas: { type: DataTypes.ARRAY(DataTypes.STRING(64)), allowNull: false, defaultValue: [] },

    /** Também virtual: entra e sai como lista de palavras, guarda como HMAC. */
    tags: {
      type: DataTypes.VIRTUAL,
      set(lista) {
        const limpas = (Array.isArray(lista) ? lista : []).map((t) => indiceCego(t));
        this.setDataValue('tagsCegas', limpas);
      },
    },

    dataRef: { type: DataTypes.DATEONLY, allowNull: false },
  }, {
    tableName: 'anotacao',
  });

  Anotacao.associate = (db) => {
    Anotacao.belongsTo(db.Usuario, { foreignKey: 'usuarioId' });
    Anotacao.belongsTo(db.Registro, { foreignKey: 'registroId', as: 'registro' });
    // Vínculo com a trilha que motivou a anotação. É conteúdo público, então
    // só o título viaja para a resposta; o dia se acha depois pela ordem.
    Anotacao.belongsTo(db.Trilha, { foreignKey: 'trilhaId', as: 'trilha' });
  };

  /** Busca por tag sem o servidor saber qual é a tag. */
  Anotacao.porTag = function (usuarioId, tag) {
    return Anotacao.findAll({
      where: {
        usuarioId,
        tagsCegas: { [sequelize.Sequelize.Op.contains]: [indiceCego(tag)] },
      },
      include: [{ association: 'trilha', attributes: ['id', 'titulo'] }],
      order: [['dataRef', 'DESC']],
    });
  };

  /** O texto cifrado jamais vai para a resposta HTTP. */
  Anotacao.prototype.toJSON = function () {
    const { textoCifrado, tagsCegas, ...resto } = this.get();
    return { ...resto, texto: this.texto };
  };

  return Anotacao;
};
