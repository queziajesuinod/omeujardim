'use strict';

// Conciliação dos webhooks da Efí com a nossa base. Idempotente: o mesmo evento
// chegando duas vezes (a Efí reenvia) não cobra nem estende duas vezes. A
// decisão de estado da assinatura passa por lib/assinatura.js. Ver PLANO.

const { novoId } = require('./id');
const dominio = require('./assinatura');

// Estados de cobrança da Efí que contam como pago / como falha.
const PAGO = new Set(['paid', 'settled', 'approved', 'confirmed', 'link_paid']);
const FALHA = new Set(['unpaid', 'canceled', 'declined', 'expired', 'contested']);
const ESTORNO = new Set(['refunded', 'chargeback']);

const diaNoFuso = (fuso) => new Intl.DateTimeFormat('en-CA', { timeZone: fuso || 'America/Sao_Paulo' }).format(new Date());

/** Extrai os campos do evento da Efí de forma tolerante a formato. */
function ler(ev) {
  const ids = ev.identifiers || ev.identificadores || {};
  const status = (ev.status && (ev.status.current || ev.status)) || ev.type || null;
  return {
    chargeId: ids.charge_id != null ? String(ids.charge_id) : null,
    subId: ids.subscription_id != null ? String(ids.subscription_id) : null,
    customId: ev.custom_id != null ? String(ev.custom_id) : null,
    valorCentavos: ev.value != null ? Number(ev.value) : null,
    status,
  };
}

/**
 * Aplica um evento do webhook de cobranças/assinaturas. Acha a assinatura (pelo
 * id na Efí ou pelo custom_id = usuário), garante a linha de cobrança e move a
 * máquina de estados. Devolve o que fez, para o log e os testes.
 */
async function aplicarEventoEfi(db, ev) {
  const { Assinatura, Cobranca, Usuario } = db;
  const e = ler(ev);
  if (!e.status) return { acao: 'ignorado', motivo: 'sem_status' };

  let assinatura = null;
  if (e.subId) assinatura = await Assinatura.findOne({ where: { efiAssinaturaId: e.subId } });
  if (!assinatura && e.customId) {
    assinatura = await Assinatura.findOne({ where: { usuarioId: e.customId }, order: [['criado_em', 'DESC']] });
  }
  if (!assinatura) return { acao: 'ignorado', motivo: 'assinatura_desconhecida' };

  // Garante a linha de cobrança (as cobranças recorrentes trazem charge_id novo).
  let cobranca = null;
  if (e.chargeId) {
    cobranca = await Cobranca.findOne({ where: { efiChargeId: e.chargeId } });
    if (!cobranca) {
      cobranca = await Cobranca.create({
        id: novoId(), assinaturaId: assinatura.id, usuarioId: assinatura.usuarioId,
        metodo: assinatura.metodo, valorCentavos: e.valorCentavos || assinatura.valorCentavos,
        status: 'pendente', efiChargeId: e.chargeId,
      });
    }
  }

  const usuario = await Usuario.findByPk(assinatura.usuarioId, { attributes: ['fuso'] });
  const hoje = diaNoFuso(usuario?.fuso);

  if (PAGO.has(e.status)) {
    if (cobranca && cobranca.status === 'pago') return { acao: 'repetido', chargeId: e.chargeId };
    if (cobranca) await cobranca.update({ status: 'pago', pagoEm: new Date() });
    await assinatura.update(dominio.aoConfirmarPagamento(assinatura, hoje, assinatura.ciclo));
    return { acao: 'pago', assinatura: assinatura.id, chargeId: e.chargeId };
  }
  if (ESTORNO.has(e.status)) {
    if (cobranca) await cobranca.update({ status: 'estornada' });
    return { acao: 'estornado', chargeId: e.chargeId };
  }
  if (FALHA.has(e.status)) {
    if (cobranca) await cobranca.update({ status: e.status === 'expired' ? 'expirada' : 'recusada' });
    // Uma falha não derruba quem ainda está no período pago; marca inadimplente
    // para a rotina diária encerrar quando o período vencer.
    if (!['cancelada', 'encerrada'].includes(assinatura.status)) {
      await assinatura.update({ status: 'inadimplente' });
    }
    return { acao: 'falha', status: e.status, chargeId: e.chargeId };
  }
  return { acao: 'ignorado', motivo: 'status_' + e.status };
}

/**
 * Marca uma cobrança PIX como paga e estende a assinatura — mas SÓ com a
 * confirmação vinda da própria Efí (`verificado`), nunca com base no corpo do
 * webhook, que é forjável. `verificado` = { status, valorCentavos, pagoCentavos }
 * de `efi.consultarPix(txid)`. Sem CONCLUIDA e sem o valor esperado, não credita.
 */
async function aplicarPixPago(db, txid, verificado) {
  const { Cobranca, Assinatura, Usuario } = db;
  const cobranca = await Cobranca.findOne({ where: { efiTxid: String(txid) } });
  if (!cobranca) return { acao: 'ignorado', motivo: 'txid_desconhecido' };
  if (cobranca.status === 'pago') return { acao: 'repetido', txid };

  // A Efí é a única fonte da verdade sobre o pagamento. Sem confirmação de que
  // o PIX foi concluído, nada é creditado — é o que fecha a fraude do txid.
  if (!verificado || verificado.status !== 'CONCLUIDA') {
    return { acao: 'ignorado', motivo: 'nao_confirmado_na_efi' };
  }
  // E pelo valor certo: um PIX de R$0,01 não pode liberar a mensalidade.
  if (verificado.pagoCentavos == null || verificado.pagoCentavos < cobranca.valorCentavos) {
    return { acao: 'ignorado', motivo: 'valor_insuficiente' };
  }

  await cobranca.update({ status: 'pago', pagoEm: new Date() });
  const assinatura = await Assinatura.findByPk(cobranca.assinaturaId);
  const usuario = await Usuario.findByPk(cobranca.usuarioId, { attributes: ['fuso'] });
  await assinatura.update(dominio.aoConfirmarPagamento(assinatura, diaNoFuso(usuario?.fuso), assinatura.ciclo));
  return { acao: 'pago', txid, assinatura: assinatura.id };
}

module.exports = { aplicarEventoEfi, aplicarPixPago, PAGO, FALHA, ESTORNO };
