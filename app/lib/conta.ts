// Conta e direitos do titular (LGPD): quem sou eu, exportar meus dados,
// revogar consentimento, excluir a conta.

import { Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chamar } from './api';

export type Eu = {
  id: string;
  nome: string;
  email: string;
  inicioDoDia?: string | null;
  consentimentoRevogadoEm: string | null;
  whatsappNumero?: string | null;
  whatsappOptInEm?: string | null;
  criado_em?: string;
};

export function useEu() {
  return useQuery({ queryKey: ['eu'], queryFn: () => chamar('/v1/eu') as Promise<Eu> });
}

/** Atualiza a hora de início do dia no servidor. Espera 'HH:MM'. */
export function useAtualizarInicioDia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inicioDoDia: string) => chamar('/v1/eu', 'PATCH', { inicioDoDia }) as Promise<Eu>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eu'] }),
  });
}

/**
 * Exporta tudo (LGPD art. 18, V). Na web, baixa um .json. No nativo faltaria o
 * acesso a arquivo/compartilhamento; fica para quando houver app de loja.
 */
export async function exportarDados(): Promise<boolean> {
  const dados = await chamar('/v1/meus-dados');
  if (Platform.OS !== 'web') return false;

  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meu-jardim.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

export function useRevogarConsentimento() {
  return useMutation({ mutationFn: () => chamar('/v1/consentimento/revogar', 'POST') });
}

export function useExcluirConta() {
  return useMutation({
    mutationFn: () => chamar('/v1/minha-conta', 'DELETE') as Promise<{ ok: boolean; expurgoEm: string }>,
  });
}
