// Estação de conteúdo, pela API. A pessoa NÃO escolhe: ela já está na estação
// que está rodando (a mesma para todo mundo), no dia em que a estação está. A
// Hoje mostra em que estação está, o dia atual, e o conteúdo do dia por prática.

import { useQuery } from '@tanstack/react-query';
import { chamar } from './api';
import { diaDevocional } from './id';

export type ItemDia = { disciplinaCodigo: string; titulo: string; corpo: string };

export type AndamentoEstacao =
  | { seguindo: false }
  | {
      seguindo: true;
      estacao: { id: string; nome: string; tema: string | null };
      diaAtual: number;
      total: number;
      conteudo: ItemDia[];
    };

export function useAndamentoEstacao() {
  return useQuery({
    queryKey: ['estacao-andamento'],
    queryFn: () => chamar(`/v1/estacoes/andamento?dataRef=${diaDevocional()}`) as Promise<AndamentoEstacao>,
  });
}
