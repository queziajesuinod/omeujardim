// A hora de início do dia, guardada no aparelho e refletida no cálculo do dia
// devocional. Carregada na abertura (antes de qualquer rega) e sincronizada com
// o que o servidor guarda, para os dois concordarem.

import { lerPreferencia, gravarPreferencia } from './preferencia';
import { definirInicioDia } from './id';

const CHAVE = 'jd_inicio_dia';

/** Lê a preferência local e aplica ao cálculo do dia. Chamar na abertura. */
export async function carregarInicioDia(): Promise<void> {
  const bruto = await lerPreferencia(CHAVE);
  const h = bruto ? parseInt(bruto, 10) : NaN;
  if (Number.isFinite(h)) definirInicioDia(h);
}

/** Define a hora, aplica agora e persiste. */
export async function salvarInicioDia(hora: number): Promise<void> {
  definirInicioDia(hora);
  await gravarPreferencia(CHAVE, String(hora));
}

/** Extrai a hora (0-23) de um 'HH:MM:SS' que veio do servidor. */
export function horaDe(inicioDoDia?: string | null): number {
  const h = inicioDoDia ? parseInt(inicioDoDia.slice(0, 2), 10) : 4;
  return Number.isFinite(h) ? h : 4;
}
