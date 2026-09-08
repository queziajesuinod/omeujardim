// Leitura do diário, pela API. O texto chega decifrado (o servidor decide isso
// no toJSON do model); as tags não voltam, porque viram HMAC e não são
// reversíveis. O filtro por tag manda a palavra e o servidor compara o índice
// cego, sem saber qual é.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chamar } from './api';
import { apagarAnotacaoLocal } from './fila-offline';

export type Anotacao = {
  id: string;
  registroId: string | null;
  referencia: string | null;
  dataRef: string;
  texto: string;
  // Vínculo com o dia de trilha que motivou a reflexão, quando veio de uma.
  trilhaId: string | null;
  trilhaDiaOrdem: number | null;
  trilha: { id: string; titulo: string } | null;
  criado_em?: string;
};

export function useDiario(tag?: string) {
  const limpa = tag?.trim();
  return useQuery({
    queryKey: ['diario', limpa ?? ''],
    queryFn: () =>
      chamar(`/v1/diario${limpa ? `?tag=${encodeURIComponent(limpa)}` : ''}`) as Promise<Anotacao[]>,
  });
}

/** Uma anotação, para relembrar o dia da trilha que a motivou. */
export function useAnotacao(id?: string) {
  return useQuery({
    queryKey: ['anotacao', id],
    queryFn: () => chamar(`/v1/diario/${id}`) as Promise<Anotacao>,
    enabled: !!id,
  });
}

/**
 * Apaga uma anotação. Some só o texto: a rega do dia fica, porque nada regride.
 * O servidor apaga primeiro; depois some a cópia local (só existe no nativo).
 */
export function useExcluirAnotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await chamar(`/v1/diario/${id}`, 'DELETE');
      await Promise.resolve(apagarAnotacaoLocal(id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diario'] }),
  });
}
