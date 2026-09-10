// Versão web da fila offline, em IndexedDB — resiliente quando o IndexedDB não
// abre.
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
//
// RESILIÊNCIA (o modo memória): em vários navegadores de APARELHO o IndexedDB
// não abre — Safari em navegação privada, o navegador embutido de apps como
// Instagram e WhatsApp, e alguns PWAs no iOS bloqueiam ou zeram o
// armazenamento. Antes, quando isso acontecia, a gravação local lançava e a
// AÇÃO INTEIRA falhava ("Não consegui guardar"), mesmo online e com a API
// pronta — regar e escrever no diário simplesmente não funcionavam nesses
// aparelhos. Agora, se o IndexedDB falha, caímos numa fila EM MEMÓRIA: a pessoa
// perde o offline (a fila não sobrevive a recarregar a página), mas a ação
// funciona, porque o app sincroniza logo em seguida e o servidor grava. Regra:
// online sempre grava; o offline é o luxo que alguns navegadores tiram.

import { uuidv7 } from './id';

const BANCO = 'jardim';
const VERSAO = 1;

// Fila e registros EM MEMÓRIA, usados só quando o IndexedDB não abre. Vivem
// enquanto a aba estiver aberta; como o sincronizar é chamado logo após cada
// ação, a fila esvazia para o servidor antes de recarregar a página importar.
type ItemFila = {
  id: string; rota: string; metodo: string; corpo: any; tentativas: number; criadoEm: string;
};
type ItemRegistro = { id: string; praticaId: string; dataRef: string; duracaoMin?: number };
let filaMem: ItemFila[] = [];
let registroMem: ItemRegistro[] = [];
// Uma vez que o IndexedDB falha, não insistimos a cada chamada: fica no modo
// memória pelo resto da sessão. Recarregar a página tenta de novo do zero.
let idbIndisponivel = false;

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    if (typeof indexedDB === 'undefined') { erro(new Error('sem indexedDB')); return; }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(BANCO, VERSAO);
    } catch (e) {
      // Alguns navegadores lançam já no open (aba privada, embutido restrito).
      erro(e);
      return;
    }
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
    req.onblocked = () => erro(new Error('indexedDB bloqueado'));
  });
}

/** Abre o IndexedDB, ou devolve null (uma vez só) quando ele não está disponível. */
async function abrirOuMemoria(): Promise<IDBDatabase | null> {
  if (idbIndisponivel) return null;
  try {
    return await abrir();
  } catch {
    idbIndisponivel = true;
    return null;
  }
}

function transacao<T>(db: IDBDatabase, lojas: string[], modo: IDBTransactionMode, fn: (t: IDBTransaction) => T) {
  return new Promise<T>((ok, erro) => {
    const t = db.transaction(lojas, modo);
    const r = fn(t);
    t.oncomplete = () => ok(r);
    // Rejeita só quando a transação ABORTA. Um erro de request já tratado com
    // preventDefault (o índice único do registro, numa segunda rega do mesmo
    // dia) ainda borbulha até a transação; se ouvíssemos 'error' aqui, uma rega
    // repetida — que na verdade completa — seria rejeitada e a tela mostraria
    // "não consegui guardar" sem motivo. Quem precisa falhar, aborta.
    t.onabort = () => erro(t.error || new Error('transação abortada'));
  });
}

function novoItemFila(rota: string, metodo: string, corpo: any): ItemFila {
  return { id: uuidv7(), rota, metodo, corpo, tentativas: 0, criadoEm: new Date().toISOString() };
}

/** Grava local na hora e enfileira. A tela nunca espera a rede. */
export async function regar(praticaId: string, dataRef: string, duracaoMin?: number) {
  const id = uuidv7();
  const corpo = { id, praticaId, dataRef, duracaoMin, origem: 'app' };
  const db = await abrirOuMemoria();

  if (!db) {
    // Sem IndexedDB: guarda na memória e deixa o sincronizar seguinte gravar.
    if (!registroMem.some((r) => r.praticaId === praticaId && r.dataRef === dataRef)) {
      registroMem.push({ id, praticaId, dataRef, duracaoMin });
    }
    filaMem.push(novoItemFila('/v1/registros', 'POST', corpo));
    return id;
  }

  try {
    await transacao(db, ['registro', 'fila'], 'readwrite', (t) => {
      // O índice único faz a segunda rega do mesmo dia falhar, e isso é o certo.
      // preventDefault engole o erro sem abortar a transação: regar de novo no
      // mesmo dia não é erro para a pessoa.
      const pedido = t.objectStore('registro').add({ id, praticaId, dataRef, duracaoMin, sincronizado: 0 });
      pedido.onerror = (e) => e.preventDefault();
      t.objectStore('fila').add(novoItemFila('/v1/registros', 'POST', corpo));
    });
  } catch {
    // Transação abortou por algo fora do índice único (ex.: cota cheia). Não
    // perde a ação: enfileira na memória para o próximo sincronizar.
    filaMem.push(novoItemFila('/v1/registros', 'POST', corpo));
  }
  return id;
}

/**
 * Desregar: desfaz uma rega marcada sem querer. Apaga o registro local, remove
 * o POST ainda pendente (se a rega nem subiu) e enfileira o DELETE no servidor.
 * O DELETE é idempotente lá, então mesmo que o POST já tenha subido, some certo.
 */
export async function desregar(praticaId: string, dataRef: string) {
  const del = novoItemFila('/v1/registros', 'DELETE', { praticaId, dataRef });

  // Memória primeiro: cobre o modo sem IndexedDB e limpa qualquer POST em
  // memória ainda não enviado desse dia/prática.
  registroMem = registroMem.filter((r) => !(r.praticaId === praticaId && r.dataRef === dataRef));
  filaMem = filaMem.filter(
    (i) => !(i.rota === '/v1/registros' && i.metodo === 'POST'
      && i.corpo?.praticaId === praticaId && i.corpo?.dataRef === dataRef)
  );

  const db = await abrirOuMemoria();
  if (!db) { filaMem.push(del); return; }

  try {
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

      fila.add(del);
    });
  } catch {
    filaMem.push(del);
  }
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
  const registroId = uuidv7();
  const anotacaoId = uuidv7();
  const corpo = {
    id: registroId, praticaId, dataRef, duracaoMin, origem: 'app',
    anotacao: {
      id: anotacaoId, texto: anotacao.texto, referencia: anotacao.referencia, tags: anotacao.tags ?? [],
      trilhaId: anotacao.trilhaId, trilhaDiaOrdem: anotacao.trilhaDiaOrdem,
    },
  };
  const db = await abrirOuMemoria();

  if (!db) {
    if (!registroMem.some((r) => r.praticaId === praticaId && r.dataRef === dataRef)) {
      registroMem.push({ id: registroId, praticaId, dataRef, duracaoMin });
    }
    filaMem.push(novoItemFila('/v1/registros', 'POST', corpo));
    return { registroId, anotacaoId };
  }

  try {
    await transacao(db, ['registro', 'fila'], 'readwrite', (t) => {
      const pedido = t.objectStore('registro').add({ id: registroId, praticaId, dataRef, duracaoMin, sincronizado: 0 });
      pedido.onerror = (e) => e.preventDefault();
      t.objectStore('fila').add(novoItemFila('/v1/registros', 'POST', corpo));
    });
  } catch {
    filaMem.push(novoItemFila('/v1/registros', 'POST', corpo));
  }
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
  // Memória: mesma limpeza, para o modo sem IndexedDB.
  for (const item of filaMem) {
    if (item.rota === '/v1/registros' && item.metodo === 'POST' && item.corpo?.anotacao?.id === id) {
      const { anotacao, ...corpo } = item.corpo;
      item.corpo = corpo;
    }
  }

  const db = await abrirOuMemoria();
  if (!db) return;
  try {
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
  } catch {
    // Fila ilegível: nada a fazer, o servidor já recebeu o DELETE por outra via.
  }
}

/** Não há busca por palavra na web. Mantida para a interface bater com o nativo. */
export function buscarLocal(_termo: string): { id: string; texto: string; referencia: string | null; dataRef: string }[] {
  return [];
}

/**
 * Envia um item da fila. Devolve true quando pode ser removido da fila (subiu,
 * já existia, ou é erro 4xx definitivo que não adianta repetir), false quando a
 * rede caiu e é para parar e tentar depois.
 */
async function enviarItem(
  enviar: (rota: string, metodo: string, corpo: any) => Promise<Response>,
  item: ItemFila
): Promise<boolean> {
  const resposta = await enviar(item.rota, item.metodo, item.corpo);
  if (resposta.ok || resposta.status === 409) return true;
  if (resposta.status >= 400 && resposta.status < 500 && resposta.status !== 429) return true;
  throw new Error(`HTTP ${resposta.status}`);
}

/**
 * Sobe a fila. Mesma política de erro da versão nativa: falha de rede mantém
 * o item, erro 4xx que não é 429 descarta, para não criar fila zumbi. Esvazia
 * primeiro a fila em memória (a que segura a ação da vez em aparelhos sem
 * IndexedDB), depois a do IndexedDB, quando existe.
 */
export async function sincronizar(enviar: (rota: string, metodo: string, corpo: any) => Promise<Response>) {
  // 1) Fila em memória.
  if (filaMem.length) {
    const emOrdem = [...filaMem].sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1));
    for (const item of emOrdem) {
      try {
        if (await enviarItem(enviar, item)) {
          filaMem = filaMem.filter((x) => x.id !== item.id);
        }
      } catch {
        item.tentativas += 1;
        break; // rede caiu, não insiste nos próximos agora
      }
    }
  }

  // 2) Fila do IndexedDB, se disponível.
  const db = await abrirOuMemoria();
  if (!db) return;

  let itens: ItemFila[];
  try {
    itens = await new Promise<ItemFila[]>((ok, erro) => {
      const req = db.transaction('fila').objectStore('fila').index('criadoEm').getAll(undefined, 50);
      req.onsuccess = () => ok(req.result as ItemFila[]);
      req.onerror = () => erro(req.error);
    });
  } catch {
    return;
  }

  for (const item of itens) {
    try {
      if (await enviarItem(enviar, item)) {
        await transacao(db, ['fila'], 'readwrite', (t) => t.objectStore('fila').delete(item.id));
        continue;
      }
    } catch {
      await transacao(db, ['fila'], 'readwrite', (t) =>
        t.objectStore('fila').put({ ...item, tentativas: item.tentativas + 1 })
      ).catch(() => {});
      break; // rede caiu, não insiste nos próximos agora
    }
  }
}

export async function pendentes() {
  const db = await abrirOuMemoria();
  if (!db) return filaMem.length;
  try {
    const n = await new Promise<number>((ok, erro) => {
      const req = db.transaction('fila').objectStore('fila').count();
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });
    return n + filaMem.length;
  } catch {
    return filaMem.length;
  }
}

/**
 * Ids das práticas já regadas numa data, lidos do IndexedDB local (e da memória,
 * quando o IndexedDB não está disponível). Mesma função da versão nativa, para a
 * tela Hoje não saber da diferença.
 */
export async function regadasHoje(dataRef: string): Promise<string[]> {
  const memoria = registroMem.filter((r) => r.dataRef === dataRef).map((r) => r.praticaId);
  const db = await abrirOuMemoria();
  if (!db) return memoria;
  try {
    const itens: any[] = await new Promise((ok, erro) => {
      const req = db.transaction('registro').objectStore('registro').getAll();
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });
    const doBanco = itens.filter((r) => r.dataRef === dataRef).map((r) => r.praticaId);
    return Array.from(new Set([...doBanco, ...memoria]));
  } catch {
    return memoria;
  }
}

/** Existe na versão nativa, não existe aqui. Mantida para a interface bater. */
export function prepararBanco() {
  return abrirOuMemoria();
}
