// Dados de disciplinas e práticas, pela API, com TanStack Query.
//
// O catálogo de disciplinas é público e quase imutável, então fica em cache
// longo. As práticas são da pessoa e mudam quando ela semeia ou poda, então
// toda mutação invalida a lista.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chamar } from './api';
import { uuidv7 } from './id';

export type Disciplina = {
  id: string;
  codigo: string;
  nome: string;
  icone: string;
  ordem: number;
};

export type Pratica = {
  id: string;
  disciplinaId: string;
  metaPorSemana: number;
  diasSemana: number[];
  lembreteEm: string | null;
  ativa: boolean;
  disciplina?: Disciplina;
};

export function useDisciplinas() {
  return useQuery({
    queryKey: ['disciplinas'],
    queryFn: () => chamar('/v1/disciplinas') as Promise<Disciplina[]>,
    // Cache curto: uma prática nova criada no painel aparece no app em cerca de
    // um minuto, não em uma hora. O catálogo é pequeno, então revalidar é barato.
    staleTime: 1000 * 60,
  });
}

export function usePraticas() {
  return useQuery({
    queryKey: ['praticas'],
    queryFn: () => chamar('/v1/praticas') as Promise<Pratica[]>,
  });
}

export type SalvarPratica = {
  disciplinaId: string;
  metaPorSemana: number;
  diasSemana: number[];
};

export function useSalvarPratica() {
  const qc = useQueryClient();
  return useMutation({
    // O id nasce no cliente (UUID v7), para a criação ser idempotente se o
    // envio repetir. Se a prática já existir no servidor, ele ignora este id
    // e apenas reajusta a meta e os dias.
    mutationFn: (p: SalvarPratica) =>
      chamar('/v1/praticas', 'POST', { id: uuidv7(), ...p }) as Promise<Pratica>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['praticas'] }),
  });
}

export function usePodarPratica() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => chamar(`/v1/praticas/${id}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['praticas'] }),
  });
}

export type Constancia = { diasRegados: number; janela: number; percentual: number };

/** A métrica de destaque da tela Hoje. Constância, não sequência: nunca zera. */
export function useConstancia(dias = 30) {
  return useQuery({
    queryKey: ['constancia', dias],
    queryFn: () => chamar(`/v1/constancia?dias=${dias}`) as Promise<Constancia>,
  });
}
