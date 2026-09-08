// Estado do jardim, pela API. Tudo calculado no servidor a partir das regas.

import { useQuery } from '@tanstack/react-query';
import { chamar } from './api';

export type DiaCalendario = {
  data: string;
  regou: boolean;
  feitas: number;
  previstas: number;
  fracao: number; // 0..1: quanto do dia previsto foi regado
};
export type Conquista = { codigo: string; nome: string; descricao: string; conquistada: boolean };

export type Jardim = {
  chama: number;
  emPausa: boolean;
  escudos: number;
  voltaPorCima: boolean;
  calendario: DiaCalendario[];
  conquistas: Conquista[];
};

export function useJardim(hoje: string) {
  return useQuery({
    queryKey: ['jardim', hoje],
    queryFn: () => chamar(`/v1/jardim?hoje=${hoje}`) as Promise<Jardim>,
  });
}
