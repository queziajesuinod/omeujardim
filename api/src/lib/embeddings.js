'use strict';

// Embeddings multilíngues de 384 dimensões, com transformers.js rodando local.
// O modelo baixa uma vez e fica em cache no disco.
//
// LIMITE HONESTO: se o modelo não estiver disponível (sem rede, ambiente
// enxuto), `gerarEmbedding` devolve null. A busca então cai no modo textual
// (tsvector com stemming em português e unaccent), que não precisa de modelo —
// acha por palavra, mas não por sentido. A busca semântica é a camada de cima.

// e5-small: 384 dims (cabe no schema) e treinado para RECUPERAÇÃO, não só
// paráfrase. Ele exige prefixos: "query:" no que se busca, "passage:" no que é
// indexado. Sem os prefixos, a qualidade cai muito.
const MODELO = 'Xenova/multilingual-e5-small';

let pipePromise = null;

async function obterPipe() {
  if (!pipePromise) {
    const { pipeline } = await import('@xenova/transformers');
    pipePromise = pipeline('feature-extraction', MODELO);
  }
  return pipePromise;
}

/**
 * Devolve um vetor de 384 floats normalizados, ou null se não deu.
 * `tipo` é 'passage' (conteúdo indexado) ou 'query' (o que a pessoa busca).
 */
async function gerarEmbedding(texto, tipo = 'passage') {
  try {
    const pipe = await obterPipe();
    const entrada = `${tipo}: ${String(texto).slice(0, 2000)}`;
    const saida = await pipe(entrada, { pooling: 'mean', normalize: true });
    return Array.from(saida.data);
  } catch {
    return null;
  }
}

/** Formata para o literal que o pgvector aceita: [0.1,0.2,...]. */
function paraVetorSql(lista) {
  return `[${lista.join(',')}]`;
}

module.exports = { gerarEmbedding, paraVetorSql };
