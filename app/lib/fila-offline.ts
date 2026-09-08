// Sincronização offline primeiro, no padrão caixa de saída.
//
// O contexto que decide o desenho: a pessoa registra oração às 5h da manhã,
// no ônibus, no culto, em lugar sem sinal. Se o app depender de rede para
// gravar, ele falha exatamente no momento de uso.
//
// Como funciona:
// 1. Gravar é sempre local e imediato. A tela nunca espera a rede.
// 2. A operação entra numa fila local com o id JÁ gerado (UUIDv7).
// 3. Quando há rede, a fila sobe em ordem. Subir duas vezes não duplica,
//    porque o id é o mesmo e o servidor faz findOrCreate por id.
//
// É por isso que o id vem do cliente. Sem isso, sincronização vira lógica de
// resolução de conflito, que é onde esse tipo de app costuma morrer.

import * as SQLite from 'expo-sqlite';
import { uuidv7 } from './id';

const banco = SQLite.openDatabaseSync('jardim.db');

export function prepararBanco() {
  banco.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS fila (
      id TEXT PRIMARY KEY,
      rota TEXT NOT NULL,
      metodo TEXT NOT NULL,
      corpo TEXT NOT NULL,
      tentativas INTEGER NOT NULL DEFAULT 0,
      erro TEXT,
      criado_em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS registro (
      id TEXT PRIMARY KEY,
      pratica_id TEXT NOT NULL,
      data_ref TEXT NOT NULL,
      duracao_min INTEGER,
      sincronizado INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS registro_pratica_dia ON registro (pratica_id, data_ref);
    CREATE TABLE IF NOT EXISTS anotacao (
      id TEXT PRIMARY KEY,
      registro_id TEXT,
      texto TEXT NOT NULL,
      referencia TEXT,
      data_ref TEXT NOT NULL,
      sincronizado INTEGER NOT NULL DEFAULT 0
    );
    -- Busca do diário roda AQUI, no aparelho, porque no servidor o texto está
    -- cifrado e não é pesquisável. Ver seção de segurança do manual.
    CREATE VIRTUAL TABLE IF NOT EXISTS anotacao_busca USING fts5(
      texto, referencia, content='anotacao', content_rowid='rowid'
    );
  `);
}

/** Regar: grava local na hora e enfileira. A tela nunca espera. */
export function regar(praticaId: string, dataRef: string, duracaoMin?: number) {
  const id = uuidv7();
  banco.runSync(
    'INSERT OR IGNORE INTO registro (id, pratica_id, data_ref, duracao_min) VALUES (?, ?, ?, ?)',
    [id, praticaId, dataRef, duracaoMin ?? null]
  );
  enfileirar('/v1/registros', 'POST', { id, praticaId, dataRef, duracaoMin, origem: 'app' });
  return id;
}

/**
 * Desregar: desfaz uma rega marcada sem querer. Apaga o registro local (e a
 * anotação ligada, com o índice FTS), remove o POST ainda pendente e enfileira
 * o DELETE, que é idempotente no servidor.
 */
export function desregar(praticaId: string, dataRef: string) {
  const reg = banco.getFirstSync<{ id: string }>(
    'SELECT id FROM registro WHERE pratica_id = ? AND data_ref = ?', [praticaId, dataRef]
  );
  if (reg) {
    const anots = banco.getAllSync<{ rowid: number }>('SELECT rowid FROM anotacao WHERE registro_id = ?', [reg.id]);
    for (const a of anots) banco.runSync('DELETE FROM anotacao_busca WHERE rowid = ?', [a.rowid]);
    banco.runSync('DELETE FROM anotacao WHERE registro_id = ?', [reg.id]);
    banco.runSync('DELETE FROM registro WHERE id = ?', [reg.id]);
  }
  // Remove o POST ainda não sincronizado desse dia/prática.
  const posts = banco.getAllSync<{ id: string; corpo: string }>(
    "SELECT id, corpo FROM fila WHERE rota = '/v1/registros' AND metodo = 'POST'"
  );
  for (const item of posts) {
    try {
      const c = JSON.parse(item.corpo);
      if (c.praticaId === praticaId && c.dataRef === dataRef) banco.runSync('DELETE FROM fila WHERE id = ?', [item.id]);
    } catch { /* corpo ilegível: ignora */ }
  }
  enfileirar('/v1/registros', 'DELETE', { praticaId, dataRef });
}

type Anotacao = {
  texto: string; referencia?: string; tags?: string[];
  // Vínculo com o dia de trilha que motivou a reflexão, quando veio de uma.
  trilhaId?: string; trilhaDiaOrdem?: number;
};

/**
 * Regar com reflexão: grava a rega e a anotação local na hora, e enfileira as
 * duas juntas num POST só. O texto sobe para o servidor cifrado (o model cuida
 * disso); aqui no aparelho ele fica em claro de propósito, porque é contra esta
 * cópia local que a busca por palavra do diário roda.
 */
export function anotar(praticaId: string, dataRef: string, anotacao: Anotacao, duracaoMin?: number) {
  const registroId = uuidv7();
  const anotacaoId = uuidv7();

  banco.runSync(
    'INSERT OR IGNORE INTO registro (id, pratica_id, data_ref, duracao_min) VALUES (?, ?, ?, ?)',
    [registroId, praticaId, dataRef, duracaoMin ?? null]
  );
  const r = banco.runSync(
    'INSERT INTO anotacao (id, registro_id, texto, referencia, data_ref) VALUES (?, ?, ?, ?, ?)',
    [anotacaoId, registroId, anotacao.texto, anotacao.referencia ?? null, dataRef]
  );
  // Índice FTS: é aqui que a busca por palavra do diário acontece no aparelho.
  banco.runSync(
    'INSERT INTO anotacao_busca (rowid, texto, referencia) VALUES (?, ?, ?)',
    [r.lastInsertRowId, anotacao.texto, anotacao.referencia ?? '']
  );

  enfileirar('/v1/registros', 'POST', {
    id: registroId, praticaId, dataRef, duracaoMin, origem: 'app',
    anotacao: {
      id: anotacaoId, texto: anotacao.texto, referencia: anotacao.referencia, tags: anotacao.tags ?? [],
      trilhaId: anotacao.trilhaId, trilhaDiaOrdem: anotacao.trilhaDiaOrdem,
    },
  });
  return { registroId, anotacaoId };
}

/**
 * Apaga uma anotação do banco local e do índice de busca. A rega FICA: apagar a
 * reflexão não desfaz o dia. Chamada depois que o servidor confirma o DELETE.
 *
 * Também tira a anotação de qualquer POST ainda na fila — SEM apagar o POST,
 * porque a rega do dia precisa subir mesmo assim. Se não fizesse isso, um POST
 * que ficou na fila (subiu, mas a resposta se perdeu na rede) recriaria no
 * reenvio a reflexão apagada: o servidor faz findOrCreate por id. Ver o
 * invariante "apagar reflexão não volta".
 */
export function apagarAnotacaoLocal(id: string) {
  const a = banco.getFirstSync<{ rowid: number }>('SELECT rowid FROM anotacao WHERE id = ?', [id]);
  if (a) {
    banco.runSync('DELETE FROM anotacao_busca WHERE rowid = ?', [a.rowid]);
    banco.runSync('DELETE FROM anotacao WHERE id = ?', [id]);
  }

  const posts = banco.getAllSync<{ id: string; corpo: string }>(
    "SELECT id, corpo FROM fila WHERE rota = '/v1/registros' AND metodo = 'POST'"
  );
  for (const item of posts) {
    try {
      const c = JSON.parse(item.corpo);
      if (c.anotacao?.id === id) {
        delete c.anotacao;
        banco.runSync('UPDATE fila SET corpo = ? WHERE id = ?', [JSON.stringify(c), item.id]);
      }
    } catch { /* corpo ilegível: ignora */ }
  }
}

/** Busca por palavra no diário, local (FTS5). No servidor o texto está cifrado. */
export function buscarLocal(termo: string) {
  const t = termo.trim();
  if (!t) return [];
  return banco
    .getAllSync<{ id: string; texto: string; referencia: string | null; data_ref: string }>(
      `SELECT a.id, a.texto, a.referencia, a.data_ref
         FROM anotacao_busca b JOIN anotacao a ON a.rowid = b.rowid
        WHERE anotacao_busca MATCH ?
        ORDER BY a.data_ref DESC`,
      [`${t}*`]
    )
    .map((x) => ({ id: x.id, texto: x.texto, referencia: x.referencia, dataRef: x.data_ref }));
}

function enfileirar(rota: string, metodo: string, corpo: unknown) {
  banco.runSync(
    'INSERT INTO fila (id, rota, metodo, corpo, criado_em) VALUES (?, ?, ?, ?, ?)',
    [uuidv7(), rota, metodo, JSON.stringify(corpo), new Date().toISOString()]
  );
}

/**
 * Sobe a fila. Chame ao abrir o app, ao voltar do segundo plano e quando a
 * rede voltar. Falha de rede mantém o item; erro 4xx que não é 429 descarta,
 * porque repetir requisição inválida para sempre é como se cria fila zumbi.
 */
export async function sincronizar(enviar: (rota: string, metodo: string, corpo: any) => Promise<Response>) {
  const itens = banco.getAllSync<{ id: string; rota: string; metodo: string; corpo: string; tentativas: number }>(
    'SELECT * FROM fila ORDER BY criado_em ASC LIMIT 50'
  );

  for (const item of itens) {
    try {
      const resposta = await enviar(item.rota, item.metodo, JSON.parse(item.corpo));

      if (resposta.ok || resposta.status === 409) {
        // 409 significa que já existe lá. Para nós, sucesso.
        banco.runSync('DELETE FROM fila WHERE id = ?', [item.id]);
        continue;
      }

      if (resposta.status >= 400 && resposta.status < 500 && resposta.status !== 429) {
        banco.runSync('DELETE FROM fila WHERE id = ?', [item.id]);
        continue;
      }

      throw new Error(`HTTP ${resposta.status}`);
    } catch (e: any) {
      // Recuo exponencial simples: para depois de 8 tentativas e guarda o erro
      // para a tela de ajustes poder mostrar "algo não subiu".
      const t = item.tentativas + 1;
      if (t >= 8) {
        banco.runSync('UPDATE fila SET tentativas = ?, erro = ? WHERE id = ?', [t, String(e.message), item.id]);
      } else {
        banco.runSync('UPDATE fila SET tentativas = ? WHERE id = ?', [t, item.id]);
      }
      break; // rede caiu, não adianta insistir nos próximos agora
    }
  }
}

export function pendentes() {
  return banco.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM fila')?.n ?? 0;
}

/**
 * Ids das práticas já regadas numa data, lidos do banco LOCAL. É a fonte da
 * verdade offline: mesmo sem rede, e depois de fechar e abrir o app, a tela
 * Hoje sabe o que já foi regado no dia.
 */
export function regadasHoje(dataRef: string): string[] {
  return banco
    .getAllSync<{ pratica_id: string }>('SELECT pratica_id FROM registro WHERE data_ref = ?', [dataRef])
    .map((r) => r.pratica_id);
}
