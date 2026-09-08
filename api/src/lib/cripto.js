// ---------------------------------------------------------------------------
// Cifra o conteúdo do diário antes de gravar no banco.
//
// Por que isso existe: sob a LGPD, convicção religiosa é dado pessoal SENSÍVEL
// (art. 5º, II). O texto que a pessoa escreve no devocional é a definição
// disso. Um dump de banco vazado com esse conteúdo em texto puro é um problema
// muito maior do que uma lista de e-mails vazada.
//
// AES-256-GCM: cifra e autentica ao mesmo tempo, então adulteração é detectada.
// IV de 12 bytes, aleatório por mensagem, nunca reutilizado.
//
// LIMITE HONESTO: com o texto cifrado, o Postgres não consegue fazer busca
// textual nele. A busca do diário roda no celular, contra a cópia local do
// SQLite, que o app já tem por ser offline primeiro. O servidor guarda, não lê.
// ---------------------------------------------------------------------------

const crypto = require('node:crypto');

const ALGO = 'aes-256-gcm';
const VERSAO = 'v1';

function chave(nomeVariavel = 'CRIPTO_CHAVE') {
  const bruta = process.env[nomeVariavel];
  if (!bruta) throw new Error(`${nomeVariavel} não está definida no ambiente.`);
  const buf = Buffer.from(bruta, 'base64');
  if (buf.length !== 32) {
    throw new Error(`${nomeVariavel} precisa ter 32 bytes em base64. Gere com: openssl rand -base64 32`);
  }
  return buf;
}

/**
 * Cifra um texto. Devolve uma string única, pronta para uma coluna text.
 * Formato: v1.<iv base64>.<tag base64>.<conteúdo base64>
 */
function cifrar(textoPuro) {
  if (textoPuro == null || textoPuro === '') return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv(ALGO, chave(), iv);
  const dados = Buffer.concat([c.update(String(textoPuro), 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return [VERSAO, iv.toString('base64'), tag.toString('base64'), dados.toString('base64')].join('.');
}

/**
 * Decifra. Tenta a chave atual e, se falhar, a anterior, para permitir
 * rotação de chave sem parar o serviço.
 */
function decifrar(guardado) {
  if (!guardado) return null;
  const [versao, ivB64, tagB64, dadosB64] = String(guardado).split('.');
  if (versao !== VERSAO) throw new Error(`Versão de cifra desconhecida: ${versao}`);

  const tentar = (nomeChave) => {
    const d = crypto.createDecipheriv(ALGO, chave(nomeChave), Buffer.from(ivB64, 'base64'));
    d.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([d.update(Buffer.from(dadosB64, 'base64')), d.final()]).toString('utf8');
  };

  try {
    return tentar('CRIPTO_CHAVE');
  } catch (e) {
    if (process.env.CRIPTO_CHAVE_ANTERIOR) return tentar('CRIPTO_CHAVE_ANTERIOR');
    throw e;
  }
}

/**
 * Índice cego para busca exata por tag, sem revelar a tag.
 * HMAC com a mesma chave: o servidor consegue comparar, mas não ler.
 * Só use em valor de baixa cardinalidade e não sensível por si só.
 */
function indiceCego(valor) {
  return crypto.createHmac('sha256', chave()).update(String(valor).toLowerCase().trim()).digest('base64url');
}

module.exports = { cifrar, decifrar, indiceCego };
