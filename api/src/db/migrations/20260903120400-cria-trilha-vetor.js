'use strict';

/**
 * Trilhas de conteúdo, com busca semântica por pgvector.
 *
 * Onde o vetor entra, e onde NÃO entra:
 *
 * ENTRA no conteúdo autoral. Os devocionais do "Não temas", o material dos
 * evangelhos, os microplanos por tema. Isso permite a pessoa perguntar
 * "tem algo sobre medo de perder o emprego?" e receber o dia certo, mesmo
 * que o texto nunca diga a palavra "emprego".
 *
 * NÃO ENTRA no diário. O texto do diário está cifrado no banco, e gerar o
 * embedding no servidor exigiria decifrar, o que anula a decisão de segurança.
 * Se um dia a busca semântica do diário for desejada, ela roda no aparelho.
 *
 * Dimensão 384: é o tamanho de saída dos modelos multilíngues pequenos, que
 * rodam barato e entendem português. Se trocar de modelo, a dimensão muda e
 * esta coluna precisa de nova migração.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');

    await queryInterface.createTable('trilha', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      titulo: { type: Sequelize.STRING(160), allowNull: false },
      autor: { type: Sequelize.STRING(120), allowNull: false },
      tema: { type: Sequelize.STRING(60) },
      dias: { type: Sequelize.SMALLINT, allowNull: false },
      gratuita: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      publicada_em: { type: Sequelize.DATE },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      removido_em: { type: Sequelize.DATE },
    });

    await queryInterface.createTable('trilha_dia', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      trilha_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'trilha', key: 'id' }, onDelete: 'CASCADE',
      },
      ordem: { type: Sequelize.SMALLINT, allowNull: false },
      titulo: { type: Sequelize.STRING(160), allowNull: false },
      corpo: { type: Sequelize.TEXT, allowNull: false },
      referencia: { type: Sequelize.STRING(60) },
      pergunta: { type: Sequelize.TEXT },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('trilha_dia', ['trilha_id', 'ordem'], {
      unique: true, name: 'trilha_dia_ordem_uk',
    });

    // Conteúdo é público e imutável, então pode ter busca textual em claro.
    await queryInterface.sequelize.query(`
      ALTER TABLE trilha_dia ADD COLUMN busca tsvector
        GENERATED ALWAYS AS (
          to_tsvector('portugues_sem_acento', coalesce(titulo,'') || ' ' || coalesce(corpo,''))
        ) STORED;
    `);
    await queryInterface.sequelize.query('CREATE INDEX trilha_dia_busca_gin ON trilha_dia USING gin (busca);');

    // O vetor. Preenchido por um job, não pela requisição do usuário.
    await queryInterface.sequelize.query('ALTER TABLE trilha_dia ADD COLUMN embedding vector(384);');

    /**
     * HNSW em vez de IVFFlat: não precisa de treino prévio, aceita tabela
     * crescendo aos poucos, e a busca fica boa desde o primeiro dia.
     * Com catálogo de conteúdo (centenas ou milhares de linhas, não milhões),
     * o custo de construção é irrelevante.
     */
    await queryInterface.sequelize.query(`
      CREATE INDEX trilha_dia_embedding_hnsw ON trilha_dia
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('trilha_dia');
    await queryInterface.dropTable('trilha');
  },
};
