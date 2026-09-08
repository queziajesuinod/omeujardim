// Versão web da fila offline, em IndexedDB.
//
// Por que não o expo-sqlite aqui: o suporte web dele está em alpha e exige
// configurar WASM no Metro mais os cabeçalhos COOP e COEP no servidor, para
// liberar SharedArrayBuffer. Esses cabeçalhos quebram embutidos de terceiros
// e complicam a hospedagem. Para o que a fila precisa fazer, IndexedDB puro
// resolve e não cobra nada disso.
//
// O que se perde, e precisa aparecer na interface: sem SQLite não há FTS5,
// então a busca por palavra dentro do diário não existe na web. O texto está
// cifrado no servidor e ele também não pode buscar. Sobram os filtros por tag
// e por referência bíblica, que funcionam no servidor.

import { uuidv7 } from './id';

const BANCO = 'jardim';
const VERSAO = 1;

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const req = indexedDB.open(BANCO, VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('fila')) {
        const fila = db.createObjectStore('fila', { keyPath: 'id' });
        fila.createIndex('criadoEm', 'criadoEm');
      }
      if (!db.objectStoreNames.contains('registro')) {
        const reg = db.createObjectStore('registro', { keyPath: 'id' });
        // Mesma regra do celular e do servidor: uma rega por prática por dia.
        reg.createIndex('praticaDia', ['praticaId', 'dataRef'], { unique: true });
      }
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}

function transacao<T>(db: IDBDatabase, lojas: string[], modo: IDBTransactionMode, fn: (t: IDBTransaction) => T) {
  return new Promise<T>((ok, erro) => {
    const t = db.transaction(lojas, modo);
    const r = fn(t);
    t.oncomplete = () => ok(r);
    t.onerror = () => erro(t.error);
  });
}

/** Grava local na hora e enfileira. A tela nunca espera a rede. */
export async function regar(praticaId: string, dataRef: string, duracaoMin?: number) {
  const db = await abrir();
  const id = uuidv7();

  await transacao(db, ['registro', 'fila'], 'readwrite', (t) => {
    // O índice único faz a segunda rega do mesmo dia falhar, e isso é o certo.
    // O erro é engolido: para a pessoa, regar de novo no mesmo dia não é erro.
    const pedido = t.objectStore('registro').add({ id, praticaId, dataRef, duracaoMin, sincronizado: 0 });
    pedido.onerror = (e) => e.preventDefault();

    t.objectStore('fila').add({
      id: uuidv7(),
      rota: '/v1/registros',
      metodo: 'POST',
      corpo: { id, praticaId, dataRef, duracaoMin, origem: 'app' },
      tentativas: 0,
      criadoEm: new Date().toISOString(),
    });
  });

  return id;
}

/**
 * Desregar: desfaz uma rega marcada sem querer. Apaga o registro local, remove
 * o POST ainda pendente (se a rega nem subiu) e enfileira o DELETE no servidor.
 * O DELETE é idempotente lá, então mesmo que o POST já tenha subido, some certo.
 */
export async function desregar(praticaId: string, dataRef: string) {
  const db = await abrir();
  await transacao(db, ['registro', 'fila'], 'readwrite', (t) => {
    const registros = t.objectStore('registro');
    const chave = registros.index('praticaDia').getKey([praticaId, dataRef]);
    chave.onsuccess = () => { if (chave.result != null) registros.delete(chave.result); };

    const fila = t.objectStore('fila');
    const todos = fila.getAll();
    todos.onsuccess = () => {
      for (const item of todos.result as any[]) {
        if (item.rota === '/v1/registros' && item.metodo === 'POST'
          && item.corpo?.praticaId === praticaId && item.corpo?.dataRef === dataRef) {
          fila.delete(item.id);
        }
      }
    };

    fila.add({
      id: uuidv7(), rota: '/v1/registros', metodo: 'DELETE',
      corpo: { praticaId, dataRef }, tentativas: 0, criadoEm: new Date().toISOString(),
    });
  });
}

type Anotacao = {
  texto: string; referencia?: string; tags?: string[];
  // Vínculo com o dia de trilha que motivou a reflexão, quando veio de uma.
  trilhaId?: string; trilhaDiaOrdem?: number;
};

/**
 * Regar com reflexão. Grava a rega local e enfileira a rega mais a anotação
 * num POST só; o texto sobe cifrado (o servidor cuida). Aqui NÃO guardamos o
 * texto localmente: sem SQLite não há FTS, então a busca por palavra do diário
 * não existe na web, e o diário se lê do servidor. Filtro por tag e referência
 * seguem funcionando.
 */
export async function anotar(praticaId: string, dataRef: string, anotacao: Anotacao, duracaoMin?: number) {
  const db = await abrir();
  const registroId = uuidv7();
  const anotacaoId = uuidv7();

  await transacao(db, ['registro', 'fila'], 'readwrite', (t) => {
    const pedido = t.objectStore('registro').add({ id: registroId, praticaId, dataRef, duracaoMin, sincronizado: 0 });
    pedido.onerror = (e) => e.preventDefault();

    t.objectStore('fila').add({
      id: uuidv7(),
      rota: '/v1/registros',
      metodo: 'POST',
      corpo: {
        id: registroId, praticaId, dataRef, duracaoMin, origem: 'app',
        anotacao: {
          id: anotacaoId, texto: anotacao.texto, referencia: anotacao.referencia, tags: anotacao.tags ?? [],
          trilhaId: anotacao.trilhaId, trilhaDiaOrdem: anotacao.trilhaDiaOrdem,
        },
      },
      tentativas: 0,
      criadoEm: new Date().toISOString(),
    });
  });

  return { registroId, anotacaoId };
}

/**
 * Par da versão nativa. Na web o texto do diário não fica guardado localmente
 * (sem FTS), então não há cópia local para apagar. Mas o POST enfileirado pode
 * carregar a anotação: tira a anotação do corpo SEM apagar o POST, para a rega
 * do dia ainda subir e para um reenvio não recriar a reflexão apagada (o
 * servidor faz findOrCreate por id). Ver "apagar reflexão não volta".
 */
export async function apagarAnotacaoLocal(id: string) {
  const db = await abrir();
  await transacao(db, ['fila'], 'readwrite', (t) => {
    const fila = t.objectStore('fila');
    const todos = fila.getAll();
    todos.onsuccess = () => {
      for (const item of todos.result as any[]) {
        if (item.rota === '/v1/registros' && item.metodo === 'POST' && item.corpo?.anotacao?.id === id) {
          const { anotacao, ...corpo } = item.corpo;
          fila.put({ ...item, corpo });
        }
      }
    };
  });
}

/** Não há busca por palavra na web. Mantida para a interface bater com o nativo. */
export function buscarLocal(_termo: string): { id: string; texto: string; referencia: string | null; dataRef: string }[] {
  return [];
}

/**
 * Sobe a fila. Mesma política de erro da versão nativa: falha de rede mantém
 * o item, erro 4xx que não é 429 descarta, para não criar fila zumbi.
 */
export async function sincronizar(enviar: (rota: string, metodo: string, corpo: any) => Promise<Response>) {
  const db = await abrir();
  const itens: any[] = await new Promise((ok, erro) => {
    const req = db.transaction('fila').objectStore('fila').index('criadoEm').getAll(undefined, 50);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });

  for (const item of itens) {
    try {
      const resposta = await enviar(item.rota, item.metodo, item.corpo);

      if (resposta.ok || resposta.status === 409) {
        await transacao(db, ['fila'], 'readwrite', (t) => t.objectStore('fila').delete(item.id));
        continue;
      }
      if (resposta.status >= 400 && resposta.status < 500 && resposta.status !== 429) {
        await transacao(db, ['fila'], 'readwrite', (t) => t.objectStore('fila').delete(item.id));
        continue;
      }
      throw new Error(`HTTP ${resposta.status}`);
    } catch {
      await transacao(db, ['fila'], 'readwrite', (t) =>
        t.objectStore('fila').put({ ...item, tentativas: item.tentativas + 1 })
      );
      break; // rede caiu, não insiste nos próximos agora
    }
  }
}

export async function pendentes() {
  const db = await abrir();
  return new Promise<number>((ok, erro) => {
    const req = db.transaction('fila').objectStore('fila').count();
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}

/**
 * Ids das práticas já regadas numa data, lidos do IndexedDB local. Mesma
 * função da versão nativa, para a tela Hoje não saber da diferença.
 */
export async function regadasHoje(dataRef: string): Promise<string[]> {
  const db = await abrir();
  const itens: any[] = await new Promise((ok, erro) => {
    const req = db.transaction('registro').objectStore('registro').getAll();
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
  return itens.filter((r) => r.dataRef === dataRef).map((r) => r.praticaId);
}

/** Existe na versão nativa, não existe aqui. Mantida para a interface bater. */
export function prepararBanco() {
  return abrir();
}
