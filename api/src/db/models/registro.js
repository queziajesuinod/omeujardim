'use strict';

const { novoId } = require('../../lib/id');

module.exports = (sequelize, DataTypes) => {
  const Registro = sequelize.define('Registro', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    usuarioId: { type: DataTypes.UUID, allowNull: false },
    praticaId: { type: DataTypes.UUID, allowNull: false },
    dataRef: { type: DataTypes.DATEONLY, allowNull: false },
    duracaoMin: { type: DataTypes.SMALLINT, validate: { min: 1, max: 1440 } },
    concluidoEm: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    origem: { type: DataTypes.ENUM('app', 'widget', 'importacao'), allowNull: false, defaultValue: 'app' },
  }, { tableName: 'registro' });

  Registro.associate = (db) => {
    Registro.belongsTo(db.Usuario, { foreignKey: 'usuarioId' });
    Registro.belongsTo(db.Pratica, { foreignKey: 'praticaId', as: 'pratica' });
    Registro.hasOne(db.Anotacao, { foreignKey: 'registroId', as: 'anotacao' });
  };

  /**
   * Grava a rega de forma idempotente, sob concorrência real.
   *
   * Existem DOIS caminhos de duplicata, e eles são diferentes:
   *
   * 1. Mesmo id. Toque duplo, retry de rede, a fila offline subindo duas vezes.
   *    `findOrCreate` resolve sozinho.
   *
   * 2. Ids DIFERENTES para a mesma prática no mesmo dia. Acontece quando a
   *    pessoa tem dois aparelhos, ou reinstalou o app e o id local mudou.
   *    Aqui o `findOrCreate` NÃO ajuda: ele procura por id, não acha, tenta
   *    inserir, e bate no índice único (pratica_id, data_ref).
   *
   *    Medido com 12 requisições simultâneas: 1 passa e 11 estouram
   *    SequelizeUniqueConstraintError. O banco fica certo, com uma linha só,
   *    mas 11 pessoas recebem erro 500 por uma ação que deu certo.
   *
   * A solução é deixar o Postgres decidir, com ON CONFLICT DO NOTHING sem
   * alvo, que cobre as duas restrições de uma vez. Sem alvo é de propósito:
   * dá para citar só um índice por cláusula, e aqui os dois importam.
   * Quem perdeu a corrida lê a linha vencedora e devolve 200, não 500.
   *
   * Detalhe que evita dor de cabeça: violação de unicidade dentro de uma
   * transação ABORTA a transação inteira. ON CONFLICT não levanta violação,
   * então a transação segue viva para gravar a anotação junto.
   */
  Registro.regar = async function ({ id, usuarioId, praticaId, dataRef, duracaoMin, origem }, transacao) {
    const [inseridos] = await sequelize.query(
      `INSERT INTO registro (id, usuario_id, pratica_id, data_ref, duracao_min, origem, concluido_em, criado_em, atualizado_em)
       VALUES (:id, :usuarioId, :praticaId, :dataRef, :duracaoMin, :origem, now(), now(), now())
       ON CONFLICT DO NOTHING
       RETURNING *`,
      {
        replacements: { id, usuarioId, praticaId, dataRef, duracaoMin: duracaoMin ?? null, origem: origem || 'app' },
        transaction: transacao,
        type: sequelize.QueryTypes.INSERT,
      }
    );

    if (inseridos && inseridos.length) {
      return Registro.build(inseridos[0], { isNewRecord: false });
    }

    // Alguém chegou antes. A rega dessa pessoa nesse dia já existe, e isso
    // é sucesso, não erro. Devolve a linha que venceu.
    return Registro.findOne({
      where: { praticaId, dataRef },
      transaction: transacao,
    });
  };

  /**
   * Constância dos últimos N dias, que é a métrica de destaque do produto.
   * Deliberadamente NÃO existe um método sequencia() com regra de zerar:
   * a chama pausa, ela não zera. Ver princípio "nada murcha" no manual da marca.
   */
  Registro.constancia = async function (usuarioId, dias = 30) {
    const [linha] = await sequelize.query(
      `SELECT COUNT(DISTINCT data_ref)::int AS dias_regados
         FROM registro
        WHERE usuario_id = :usuarioId
          AND removido_em IS NULL
          AND data_ref > CURRENT_DATE - :dias::int`,
      { replacements: { usuarioId, dias }, type: sequelize.QueryTypes.SELECT }
    );
    return { diasRegados: linha.dias_regados, janela: dias, percentual: Math.round((linha.dias_regados / dias) * 100) };
  };

  return Registro;
};
