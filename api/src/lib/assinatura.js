'use strict';

// Domínio da assinatura: a máquina de estados e a regra de acesso, sem I/O.
// Rota nenhuma decide estado na mão — passa por aqui. Assim dá para testar a
// regra sozinha, sem banco nem Efí. Ver PLANO-ASSINATURAS.md.
//
// Datas de acesso são DIA (YYYY-MM-DD), no fuso da pessoa: quem assina 23h50 e
// quem assina 00h10 caem no mesmo dia devocional, como no resto do app.

/** Soma dias a um dia YYYY-MM-DD, sem escorregar de fuso. */
function somarDias(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Soma meses a um dia YYYY-MM-DD. */
function somarMeses(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

const PASSO_CICLO = { mensal: (iso) => somarMeses(iso, 1), anual: (iso) => somarMeses(iso, 12) };

/** O fim de um período que começa em `inicio`, conforme o ciclo. */
function fimDoPeriodo(inicio, ciclo) {
  return (PASSO_CICLO[ciclo] || PASSO_CICLO.mensal)(inicio);
}

/**
 * A pessoa pode usar o app com esta assinatura hoje?
 * - trial: até o fim dos dias grátis
 * - ativa: sempre
 * - cancelada: até o fim do período já pago
 * - qualquer outro (iniciada, inadimplente, encerrada, nenhuma): não
 */
function assinaturaUsavel(a, hoje) {
  if (!a) return false;
  if (a.status === 'ativa') return true;
  if (a.status === 'trial') return !!a.trialAte && hoje <= a.trialAte;
  if (a.status === 'cancelada') return !!a.periodoFim && hoje <= a.periodoFim;
  return false;
}

/**
 * Por que está bloqueada, para o app saber o que mostrar. `encerrada` leva a
 * reativar; `pendente`/`sem_assinatura` levam a assinar pela primeira vez.
 */
function motivoBloqueio(a, hoje) {
  if (!a) return 'sem_assinatura';
  if (a.status === 'encerrada') return 'encerrada';
  if (a.status === 'cancelada' && !(a.periodoFim && hoje <= a.periodoFim)) return 'encerrada';
  if (a.status === 'trial' && !(a.trialAte && hoje <= a.trialAte)) return 'encerrada';
  if (a.status === 'inadimplente') return 'inadimplente';
  if (a.status === 'iniciada') return 'pendente';
  return 'sem_assinatura';
}

/** O que vai na resposta de login e em /v1/eu, para o app decidir a rota. */
function resumoAcesso(a, hoje) {
  const usavel = assinaturaUsavel(a, hoje);
  return {
    status: a ? a.status : 'nenhuma',
    usavel,
    metodo: a?.metodo ?? null,
    motivo: usavel ? null : motivoBloqueio(a, hoje),
    periodoFim: a?.periodoFim ?? null,
    trialAte: a?.trialAte ?? null,
    proximaCobranca: a?.proximaCobranca ?? null,
    valorCentavos: a?.valorCentavos ?? null,
    // Troca de preço pendente (o app mostra e pede novo aceite). Nulo = sem troca.
    precoNovoCentavos: a?.precoNovoCentavos ?? null,
    trocaPrecoEm: a?.trocaPrecoEm ?? null,
  };
}

/**
 * Campos de uma assinatura nova que começa em trial hoje. A 1ª cobrança e o fim
 * do acesso caem no fim do trial; o pagamento confirmado depois estende o
 * período (ver `aoConfirmarPagamento`).
 */
function iniciarTrial(hoje, trialDias) {
  const fim = somarDias(hoje, trialDias);
  return {
    status: 'trial',
    trialAte: fim,
    periodoInicio: hoje,
    periodoFim: fim,
    proximaCobranca: fim,
  };
}

/** Campos de uma assinatura que já começa cobrando hoje (sem trial). */
function iniciarAtiva(hoje, ciclo) {
  const fim = fimDoPeriodo(hoje, ciclo);
  return {
    status: 'ativa',
    trialAte: null,
    periodoInicio: hoje,
    periodoFim: fim,
    proximaCobranca: fim,
  };
}

/**
 * Transição ao confirmar um pagamento (webhook da Efí). Estende o período pago
 * a partir do fim atual (ou de hoje, o que for maior) e volta para ativa.
 */
function aoConfirmarPagamento(a, hoje, ciclo) {
  const base = a.periodoFim && a.periodoFim > hoje ? a.periodoFim : hoje;
  const fim = fimDoPeriodo(base, ciclo);
  return { status: 'ativa', periodoInicio: base, periodoFim: fim, proximaCobranca: fim };
}

/**
 * Cancelamento pela pessoa ou pelo admin: para as cobranças agora, mantém o
 * acesso até o fim do período já pago. Sem estorno (decisão do plano).
 */
function aoCancelar(agora) {
  return { status: 'cancelada', canceladaEm: agora, proximaCobranca: null };
}

/**
 * A rotina diária decide o que fazer com uma assinatura, sem tocar no banco.
 * Devolve o próximo status ('encerrada') quando o acesso venceu, ou null quando
 * não há nada a fazer hoje.
 */
function fechamentoDoDia(a, hoje) {
  if (a.status === 'cancelada' && a.periodoFim && hoje > a.periodoFim) return 'encerrada';
  // Trial ou período que venceu sem virar ativa (o pagamento não confirmou).
  if (a.status === 'trial' && a.trialAte && hoje > a.trialAte) return 'encerrada';
  if (a.status === 'inadimplente' && a.periodoFim && hoje > a.periodoFim) return 'encerrada';
  return null;
}

module.exports = {
  somarDias,
  somarMeses,
  fimDoPeriodo,
  assinaturaUsavel,
  motivoBloqueio,
  resumoAcesso,
  iniciarTrial,
  iniciarAtiva,
  aoConfirmarPagamento,
  aoCancelar,
  fechamentoDoDia,
};
