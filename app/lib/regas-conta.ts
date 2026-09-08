// Um contador simples de quantas vezes a pessoa já regou, no aparelho.
//
// Serve a UMA decisão: quando convidar a instalar o PWA e ligar o lembrete. O
// manual é claro — não na primeira visita, e sim depois da terceira rega, quando
// já houve valor. Pedir permissão cedo demais é o jeito mais rápido de ganhar
// um "bloquear" definitivo do navegador.
//
// Não é métrica de produto nem substitui a constância do servidor; é só um
// gatilho local de interface. Por isso mora aqui, fora de lib/seguro.

import { lerPreferencia, gravarPreferencia } from './preferencia';

const CHAVE = 'jd_total_regas';

export async function totalRegas(): Promise<number> {
  const bruto = await lerPreferencia(CHAVE);
  const n = bruto ? parseInt(bruto, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** Soma uma rega e devolve o novo total. */
export async function registrarRega(): Promise<number> {
  const novo = (await totalRegas()) + 1;
  await gravarPreferencia(CHAVE, String(novo));
  return novo;
}
