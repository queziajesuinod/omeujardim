// Cliente da API, ciente de que web e nativo se autenticam diferente.
//
// Na web: cookie httpOnly vai sozinho, e nós só precisamos mandar o token
// de CSRF de volta no cabeçalho.
// No nativo: Authorization: Bearer, mais o cabeçalho X-Cliente para o
// servidor saber que não deve gravar cookie.

import { Platform } from 'react-native';
import { lerAcesso, lerRefresh, guardarSessao } from './seguro';
// @ts-ignore o arquivo .web exporta lerCsrf/guardarCsrf; no nativo eles não existem.
import * as seguroWeb from './seguro';

const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333';

export class ErroApi extends Error {
  constructor(public status: number, public codigo: string, mensagem: string) {
    super(mensagem);
  }
}

// A sessão registra aqui o que fazer quando nem o refresh salva a sessão.
// Sem isto, um token morto deixaria a pessoa presa numa tela que só dá 401.
let aoExpirar: (() => void) | null = null;
export function definirAoExpirar(fn: () => void) {
  aoExpirar = fn;
}

/**
 * Renova o acesso em silêncio. Devolve true se conseguiu.
 *
 * Exportada porque a web também a usa na abertura: como o app e a API vivem em
 * origens diferentes em dev, o JavaScript não lê o cookie de sessão para saber
 * se está logado; então pergunta ao servidor via refresh, que de quebra
 * devolve um CSRF novo e utilizável.
 */
export async function renovar(): Promise<boolean> {
  try {
    let corpo: Record<string, unknown> = {};
    const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json' };
    if (Platform.OS === 'web') {
      // O refresh vive num cookie httpOnly de path /v1/auth; o navegador o
      // envia sozinho. O JavaScript nem o vê, que é o ponto.
    } else {
      const refresh = await lerRefresh();
      if (!refresh) return false;
      cabecalhos['X-Cliente'] = 'app';
      corpo = { refresh, dispositivo: 'app' };
    }
    const resp = await fetch(`${BASE}/v1/auth/refresh`, {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify(corpo),
      credentials: Platform.OS === 'web' ? 'include' : 'omit',
    });
    if (!resp.ok) return false;
    const dados = await resp.json().catch(() => ({}));
    if (Platform.OS === 'web') {
      if (dados.csrf) (seguroWeb as any).guardarCsrf?.(dados.csrf);
    } else if (dados.acesso) {
      await guardarSessao(dados.acesso, dados.refresh);
    }
    return true;
  } catch {
    return false;
  }
}

export async function chamar(rota: string, metodo = 'GET', corpo?: unknown, jaRenovou = false): Promise<any> {
  // Content-Type só quando há corpo: o Fastify recusa corpo vazio com
  // application/json (FST_ERR_CTP_EMPTY_JSON_BODY), o que quebraria um POST ou
  // DELETE sem corpo, como revogar consentimento ou excluir a conta.
  const cabecalhos: Record<string, string> = {};
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';

  if (Platform.OS === 'web') {
    const csrf = (seguroWeb as any).lerCsrf?.();
    if (csrf && metodo !== 'GET') cabecalhos['X-CSRF-Token'] = csrf;
  } else {
    cabecalhos['X-Cliente'] = 'app';
    const token = await lerAcesso();
    if (token) cabecalhos.Authorization = `Bearer ${token}`;
  }

  const resposta = await fetch(`${BASE}${rota}`, {
    method: metodo,
    headers: cabecalhos,
    body: corpo ? JSON.stringify(corpo) : undefined,
    // Sem isto o navegador não envia o cookie de sessão para outra origem.
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
  });

  // Acesso expirado: tenta renovar uma vez em silêncio e refaz a chamada.
  // Não faz isso nas próprias rotas de auth, para não entrar em laço.
  if (resposta.status === 401 && !jaRenovou && !rota.startsWith('/v1/auth/')) {
    if (await renovar()) return chamar(rota, metodo, corpo, true);
    aoExpirar?.();
  }

  if (resposta.status === 204) return null;

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ErroApi(resposta.status, dados.erro || 'erro', dados.mensagem || 'Algo falhou aqui.');
  }
  return dados;
}

/** Usada pela fila offline: devolve a Response crua, sem lançar erro. */
export async function enviarBruto(rota: string, metodo: string, corpo: unknown) {
  const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json' };
  if (Platform.OS === 'web') {
    const csrf = (seguroWeb as any).lerCsrf?.();
    if (csrf) cabecalhos['X-CSRF-Token'] = csrf;
  } else {
    cabecalhos['X-Cliente'] = 'app';
    const token = await lerAcesso();
    if (token) cabecalhos.Authorization = `Bearer ${token}`;
  }
  return fetch(`${BASE}${rota}`, {
    method: metodo,
    headers: cabecalhos,
    body: JSON.stringify(corpo),
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
  });
}
