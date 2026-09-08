// Trilhas de conteúdo, pela API. O catálogo e os dias são públicos; a busca
// é semântica (acha pelo sentido) quando o servidor tem o modelo, e cai para
// textual (por palavra) quando não. O `modo` diz qual rodou.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chamar } from './api';
import { diaDevocional } from './id';

export type TrilhaLink = { rotulo: string; url: string };

// O dia é um mini devocional: uma sequência ordenada de blocos.
export type Bloco =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'referencia'; ref: string; texto?: string | null }
  | { tipo: 'link'; rotulo: string; url: string };

export type TrilhaDia = {
  id: string;
  ordem: number;
  titulo: string;
  blocos: Bloco[];
  pergunta: string | null;
};

export type Trilha = {
  id: string;
  titulo: string;
  autor: string;
  tema: string | null;
  dias: number;
  disponivelEm: string | null;
  criado_em?: string;
  conteudo?: TrilhaDia[];
};

// A busca devolve o dia em texto plano (corpo), não os blocos.
export type Resultado = {
  id: string;
  ordem: number;
  titulo: string;
  corpo: string;
  pergunta: string | null;
  trilhaId: string;
  trilhaTitulo: string;
  score: number;
};

export function useTrilhas() {
  return useQuery({
    queryKey: ['trilhas'],
    queryFn: () => chamar('/v1/trilhas') as Promise<Trilha[]>,
    staleTime: 1000 * 60 * 10,
  });
}

export function useTrilha(id?: string) {
  return useQuery({
    queryKey: ['trilha', id],
    queryFn: () => chamar(`/v1/trilhas/${id}`) as Promise<Trilha>,
    enabled: !!id,
  });
}

export function buscarTrilhas(q: string) {
  return chamar(`/v1/trilhas/buscar?q=${encodeURIComponent(q)}`) as Promise<{
    modo: 'semantica' | 'textual';
    resultados: Resultado[];
  }>;
}

// --- A jornada: participar, andamento, regar ------------------------------

export type Andamento =
  | { participando: false }
  | {
      participando: true;
      iniciadaEm: string;
      concluidaEm: string | null;
      total: number;
      diaAtual: number;
      regados: number[];
    };

export function useAndamento(id?: string) {
  return useQuery({
    queryKey: ['andamento', id],
    queryFn: () => chamar(`/v1/trilhas/${id}/andamento?dataRef=${diaDevocional()}`) as Promise<Andamento>,
    enabled: !!id,
  });
}

export function useParticipar(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => chamar(`/v1/trilhas/${id}/participar`, 'POST', { dataRef: diaDevocional() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['andamento', id] });
      qc.invalidateQueries({ queryKey: ['minhas-trilhas'] });
    },
  });
}

export function useRegarTrilha(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ordem: number) =>
      chamar(`/v1/trilhas/${id}/regar`, 'POST', { ordem, dataRef: diaDevocional() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['andamento', id] });
      qc.invalidateQueries({ queryKey: ['minhas-trilhas'] });
    },
  });
}

export type ProgressoTrilha = {
  trilhaId: string;
  diaAtual: number;
  total: number;
  feitos: number;
  concluidaEm: string | null;
};

export function useMinhasTrilhas() {
  return useQuery({
    queryKey: ['minhas-trilhas'],
    queryFn: () => chamar(`/v1/minhas-trilhas?dataRef=${diaDevocional()}`) as Promise<ProgressoTrilha[]>,
  });
}
