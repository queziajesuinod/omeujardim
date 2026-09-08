// ---------------------------------------------------------------------------
// Identificadores: UUIDv7.
//
// A escolha, e o porquê, está na seção 04 do manual. Resumo:
// UUIDv7 tem os 48 bits mais significativos como timestamp em milissegundos,
// então ele é ordenável no tempo. Isso resolve o problema do UUIDv4 no Postgres,
// que é inserção aleatória no índice B-tree, causando divisão de página e
// índice inchado. E resolve o problema do TSID, que precisa de um id de nó
// coordenado entre quem gera.
//
// O ponto decisivo para este app: o celular gera o id offline, sem falar com o
// servidor. Isso torna a sincronização idempotente de graça, porque o registro
// que subiu duas vezes tem o mesmo id nas duas.
// ---------------------------------------------------------------------------

const { v7: uuidv7, validate, version } = require('uuid');

/** Gera um id novo, ordenável no tempo. */
function novoId() {
  return uuidv7();
}

/** Valida que a string é um UUID de verdade, na versão 7. */
function idValido(valor) {
  return typeof valor === 'string' && validate(valor) && version(valor) === 7;
}

/**
 * Extrai o instante embutido no UUIDv7.
 * Útil em suporte: dá para saber quando o registro nasceu no celular,
 * mesmo que ele só tenha chegado ao servidor dias depois.
 */
function instanteDoId(id) {
  if (!idValido(id)) return null;
  const hex = id.replace(/-/g, '').slice(0, 12);
  return new Date(parseInt(hex, 16));
}

/**
 * Aceita id vindo do cliente, mas nunca confia cegamente.
 * O cliente escolhe o id, o servidor decide se ele é aceitável.
 */
function idDoClienteOuNovo(idRecebido) {
  return idValido(idRecebido) ? idRecebido : novoId();
}

module.exports = { novoId, idValido, instanteDoId, idDoClienteOuNovo };
