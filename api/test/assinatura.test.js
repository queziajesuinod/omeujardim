'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const a = require('../src/lib/assinatura');

test('somarDias e somarMeses não escorregam de fuso', () => {
  assert.equal(a.somarDias('2026-09-04', 7), '2026-09-11');
  assert.equal(a.somarDias('2026-01-31', 1), '2026-02-01');
  assert.equal(a.somarMeses('2026-09-04', 1), '2026-10-04');
  assert.equal(a.somarMeses('2026-12-15', 1), '2027-01-15');
});

test('assinaturaUsavel respeita cada estado e suas datas', () => {
  assert.equal(a.assinaturaUsavel(null, '2026-09-04'), false);
  assert.equal(a.assinaturaUsavel({ status: 'ativa' }, '2026-09-04'), true);
  assert.equal(a.assinaturaUsavel({ status: 'trial', trialAte: '2026-09-11' }, '2026-09-11'), true);
  assert.equal(a.assinaturaUsavel({ status: 'trial', trialAte: '2026-09-11' }, '2026-09-12'), false);
  assert.equal(a.assinaturaUsavel({ status: 'cancelada', periodoFim: '2026-10-04' }, '2026-10-04'), true);
  assert.equal(a.assinaturaUsavel({ status: 'cancelada', periodoFim: '2026-10-04' }, '2026-10-05'), false);
  assert.equal(a.assinaturaUsavel({ status: 'iniciada' }, '2026-09-04'), false);
  assert.equal(a.assinaturaUsavel({ status: 'inadimplente' }, '2026-09-04'), false);
  assert.equal(a.assinaturaUsavel({ status: 'encerrada' }, '2026-09-04'), false);
});

test('motivoBloqueio leva à rota certa no app', () => {
  assert.equal(a.motivoBloqueio(null, '2026-09-04'), 'sem_assinatura');
  assert.equal(a.motivoBloqueio({ status: 'iniciada' }, '2026-09-04'), 'pendente');
  assert.equal(a.motivoBloqueio({ status: 'inadimplente' }, '2026-09-04'), 'inadimplente');
  assert.equal(a.motivoBloqueio({ status: 'encerrada' }, '2026-09-04'), 'encerrada');
  assert.equal(a.motivoBloqueio({ status: 'cancelada', periodoFim: '2026-10-04' }, '2026-10-05'), 'encerrada');
  assert.equal(a.motivoBloqueio({ status: 'trial', trialAte: '2026-09-11' }, '2026-09-12'), 'encerrada');
});

test('iniciarTrial dá 7 dias grátis com a 1ª cobrança no fim', () => {
  const t = a.iniciarTrial('2026-09-04', 7);
  assert.equal(t.status, 'trial');
  assert.equal(t.trialAte, '2026-09-11');
  assert.equal(t.periodoFim, '2026-09-11');
  assert.equal(t.proximaCobranca, '2026-09-11');
});

test('iniciarAtiva cobra hoje e paga por um mês', () => {
  const t = a.iniciarAtiva('2026-09-04', 'mensal');
  assert.equal(t.status, 'ativa');
  assert.equal(t.periodoFim, '2026-10-04');
  assert.equal(t.trialAte, null);
});

test('aoConfirmarPagamento estende a partir do fim atual, sem perder dias', () => {
  // Pagamento confirmado dentro do período: soma ao fim futuro.
  const dentro = a.aoConfirmarPagamento({ periodoFim: '2026-09-11' }, '2026-09-11', 'mensal');
  assert.equal(dentro.status, 'ativa');
  assert.equal(dentro.periodoFim, '2026-10-11');
  // Pagamento após o fim: conta a partir de hoje.
  const depois = a.aoConfirmarPagamento({ periodoFim: '2026-09-11' }, '2026-09-20', 'mensal');
  assert.equal(depois.periodoFim, '2026-10-20');
});

test('aoCancelar para as cobranças e marca a data', () => {
  const agora = new Date('2026-09-06T12:00:00Z');
  const c = a.aoCancelar(agora);
  assert.equal(c.status, 'cancelada');
  assert.equal(c.proximaCobranca, null);
  assert.equal(c.canceladaEm, agora);
});

test('fechamentoDoDia só encerra o que venceu', () => {
  assert.equal(a.fechamentoDoDia({ status: 'ativa' }, '2026-09-04'), null);
  assert.equal(a.fechamentoDoDia({ status: 'cancelada', periodoFim: '2026-10-04' }, '2026-10-04'), null);
  assert.equal(a.fechamentoDoDia({ status: 'cancelada', periodoFim: '2026-10-04' }, '2026-10-05'), 'encerrada');
  assert.equal(a.fechamentoDoDia({ status: 'trial', trialAte: '2026-09-11' }, '2026-09-12'), 'encerrada');
  assert.equal(a.fechamentoDoDia({ status: 'trial', trialAte: '2026-09-11' }, '2026-09-11'), null);
});
