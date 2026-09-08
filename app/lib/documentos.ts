// Textos legais (termos e privacidade), lidos da API. São públicos — o cadastro
// os mostra antes de existir sessão. O texto é editável no painel pela autora.

import { useQuery } from '@tanstack/react-query';
import { chamar } from './api';

export type ChaveDocumento = 'termos' | 'privacidade';

export type DocumentoLegal = {
  chave: ChaveDocumento;
  titulo: string;
  corpo: string;
  versao: string | null;
  atualizadoEm: string;
};

export function useDocumento(chave: ChaveDocumento | null) {
  return useQuery({
    queryKey: ['documento', chave],
    queryFn: () => chamar(`/v1/documentos/${chave}`) as Promise<DocumentoLegal>,
    enabled: !!chave,
    staleTime: 1000 * 60 * 10,
    retry: 0, // 404 quando ainda não foi publicado; não insiste
  });
}
