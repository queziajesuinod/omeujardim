// Assinatura, pelo lado do app. O estado vem de GET /v1/assinatura; as ações
// (trial, assinar no cartão, PIX, cancelar) batem nas rotas do titular. O
// número do cartão nunca passa por aqui nem pelo nosso servidor: o Efí.js
// tokeniza no aparelho e só o token viaja (ver lib/efi-token). Ver PLANO.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chamar } from './api';
import { useSessao } from './sessao';

export type StatusAssinatura =
  | 'nenhuma' | 'isento' | 'iniciada' | 'trial' | 'ativa' | 'inadimplente' | 'cancelada' | 'encerrada';

export type Cobranca = {
  id: string;
  metodo: 'cartao' | 'pix';
  status: 'pendente' | 'pago' | 'recusada' | 'estornada' | 'expirada';
  valorCentavos: number;
  pagoEm: string | null;
  vencimento: string | null;
  criado_em: string;
};

export type Assinatura = {
  status: StatusAssinatura;
  usavel: boolean;
  motivo: 'sem_assinatura' | 'pendente' | 'inadimplente' | 'encerrada' | null;
  periodoFim: string | null;
  trialAte: string | null;
  proximaCobranca: string | null;
  valorCentavos: number | null;
  precoNovoCentavos: number | null;
  trocaPrecoEm: string | null;
  plano: { valorCentavos: number; ciclo: string; trialDias: number; nome: string };
  cobrancas: Cobranca[];
};

export function reais(centavos?: number | null): string {
  return ((centavos ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function useAssinatura() {
  const { autenticado } = useSessao();
  return useQuery({
    queryKey: ['assinatura'],
    queryFn: () => chamar('/v1/assinatura') as Promise<Assinatura>,
    enabled: autenticado === true,
    staleTime: 1000 * 30,
  });
}

export function useInvalidarAssinatura() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['assinatura'] });
}

export type DadosCartao = {
  payment_token: string;
  nome: string;       // titular, nome completo (a Efí exige nome e sobrenome)
  cpf: string;
  telefone: string;
  nascimento: string; // AAAA-MM-DD
};

export function iniciarTrial() {
  return chamar('/v1/assinatura/iniciar-trial', 'POST', {});
}

export function assinarCartao(d: DadosCartao) {
  // `pago` diz se a Efí confirmou a 1ª cobrança na hora. Falso = cartão em
  // análise: a assinatura fica pendente e o webhook libera quando aprovar.
  return chamar('/v1/assinatura/assinar', 'POST', { ...d, aceitaRecorrencia: true }) as Promise<{
    status: string; periodoFim: string | null; pago: boolean;
  }>;
}

export function pagarPix(cpf?: string) {
  return chamar('/v1/assinatura/pix', 'POST', cpf ? { cpf } : {}) as Promise<{
    txid: string; qrcode: string; imagemQrcode: string;
  }>;
}

export function cancelarAssinatura() {
  return chamar('/v1/assinatura/cancelar', 'POST', {});
}
