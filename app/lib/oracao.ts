// Lista de oração, pela API. Título, pessoa e testemunho chegam decifrados; o
// servidor guarda cifrado e nunca lê. Diferente do diário e da rega, oração não
// é offline-primeiro por ora: criar e responder exigem rede.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chamar } from './api';
import { uuidv7 } from './id';

export type Status = 'pedindo' | 'respondido' | 'arquivado';

// Categoria não sensível, só para intercessão agregada. Slug no banco, rótulo aqui.
export const CATEGORIAS = [
  { slug: 'saude', nome: 'Saúde' },
  { slug: 'trabalho', nome: 'Trabalho' },
  { slug: 'familia', nome: 'Família' },
  { slug: 'direcao', nome: 'Direção' },
  { slug: 'luto', nome: 'Luto' },
  { slug: 'gratidao', nome: 'Gratidão' },
  { slug: 'outros', nome: 'Outros' },
] as const;

export type Pedido = {
  id: string;
  titulo: string;
  pessoa: string | null;
  testemunho: string | null;
  status: Status;
  respondidoEm: string | null;
  lembreteEm: string | null;
  categoria: string | null;
  compartilharIntercessao: boolean;
  criado_em?: string;
};

export function useOracoes() {
  return useQuery({
    queryKey: ['oracoes'],
    queryFn: () => chamar('/v1/oracoes') as Promise<Pedido[]>,
  });
}

export function useCriarPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { titulo: string; pessoa?: string; categoria?: string; compartilharIntercessao?: boolean }) =>
      chamar('/v1/oracoes', 'POST', { id: uuidv7(), ...p }) as Promise<Pedido>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['oracoes'] }),
  });
}

export type Alteracao = {
  id: string;
  status?: Status;
  testemunho?: string;
  titulo?: string;
  pessoa?: string;
  categoria?: string | null;
  compartilharIntercessao?: boolean;
};

export function useAtualizarPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dados }: Alteracao) =>
      chamar(`/v1/oracoes/${id}`, 'PATCH', dados) as Promise<Pedido>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['oracoes'] }),
  });
}
