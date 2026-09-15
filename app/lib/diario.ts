// Leitura do diário, pela API. O texto chega decifrado (o servidor decide isso
// no toJSON do model); as tags não voltam, porque viram HMAC e não são
// reversíveis. O filtro por tag manda a palavra e o servidor compara o índice
// cego, sem saber qual é.

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chamar } from './api';
import { apagarAnotacaoLocal } from './fila-offline';

const PAGINA = 30;

export type FiltrosDiario = {
  origem?: 'trilha' | 'livre';
  desde?: string;   // AAAA-MM-DD, início do período (>=)
  antes?: string;   // AAAA-MM-DD, fim exclusivo (<) — usado para abrir um mês
  ref?: string;     // referência (metadado; funciona na web)
  tag?: string;     // índice cego
};

export type MesDiario = { mes: string; total: number };

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

/**
 * Linha do tempo do diário, paginada por offset e filtrável por origem, período
 * (a partir de `desde`), referência e tag. A busca por palavra dentro do texto
 * NÃO vem daqui — roda no aparelho (FTS), porque no servidor o texto é cifrado.
 */
export function useDiarioInfinito(f: FiltrosDiario, habilitado = true) {
  return useInfiniteQuery({
    queryKey: ['diario', f],
    enabled: habilitado,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams();
      if (f.origem) p.set('origem', f.origem);
      if (f.desde) p.set('desde', f.desde);
      if (f.antes) p.set('antes', f.antes);
      if (f.ref) p.set('ref', f.ref);
      if (f.tag) p.set('tag', f.tag);
      p.set('deslocamento', String(pageParam));
      p.set('limite', String(PAGINA));
      return chamar(`/v1/diario?${p.toString()}`) as Promise<Anotacao[]>;
    },
    // Próxima página só quando a atual veio cheia; o offset é o total já carregado.
    getNextPageParam: (ultima, todas) =>
      ultima.length < PAGINA ? undefined : todas.reduce((n, pg) => n + pg.length, 0),
  });
}

/** Contagem de anotações por mês, para o canteiro (a visão-mapa). */
export function useMesesDiario() {
  return useQuery({
    queryKey: ['diario-meses'],
    queryFn: () => chamar('/v1/diario/meses') as Promise<MesDiario[]>,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diario'] });
      qc.invalidateQueries({ queryKey: ['diario-meses'] });
    },
  });
}
