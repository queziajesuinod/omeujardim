'use strict';

const crypto = require('node:crypto');
const efi = require('../lib/efi');
const { aplicarEventoEfi, aplicarPixPago } = require('../lib/conciliacao');

// Webhooks da Efí. Sempre respondem 200 rápido (a Efí reenvia em caso de erro,
// e um 500 vira reentrega infinita). A conciliação é idempotente. Ver PLANO.
//
// Duas naturezas:
//  - Cobranças/assinaturas: a Efí manda só um `notification` (token). A gente
//    resolve o token pela API autenticada — isso já prova a origem. Como defesa
//    a mais, se EFI_WEBHOOK_SEGREDO estiver setado, exigimos ?segredo= igual.
//    (A Efí só chama a URL que registramos, então o segredo vai na querystring
//    que nós mesmos definimos — o servidor não loga a query, ver servidor.js.)
//  - PIX: NÃO confiamos no corpo (é forjável). Para cada txid, reconsultamos a
//    Efí (efi.consultarPix) e só creditamos com CONCLUIDA no valor esperado.

const PLACEHOLDER = (v) => v === undefined || v === '' || v === 'troque';

/** Comparação em tempo constante, tolerante a comprimentos diferentes. */
function segredoConfere(recebido, esperado) {
  if (typeof recebido !== 'string') return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async function rotasWebhooks(app) {
  const { db } = app;

  function origemOk(req) {
    const esperado = process.env.EFI_WEBHOOK_SEGREDO;
    if (PLACEHOLDER(esperado)) {
      // Sem segredo configurado: em produção falha FECHADO (não confia em
      // ninguém), em vez de aceitar qualquer origem. Em dev, aceita para o
      // teste local sem túnel nem segredo.
      return process.env.NODE_ENV !== 'production';
    }
    return segredoConfere(req.query.segredo, esperado);
  }

  app.post('/webhooks/efi', { config: { rateLimit: false } }, async (req, reply) => {
    if (!origemOk(req)) return reply.code(401).send();

    const token = req.body?.notification;
    // A Efí faz um ping sem token ao cadastrar a URL. Responder 200 é o esperado.
    if (!token) return { ok: true };

    let eventos = [];
    try {
      eventos = await efi.resolverNotificacao(token);
    } catch (e) {
      req.log.error({ erro: typeof e === 'string' ? e : e.message }, 'falha ao resolver notificacao da Efí');
      return { ok: true }; // não pede reentrega: sem o token resolvido, nada a fazer
    }

    for (const ev of eventos) {
      try {
        const r = await aplicarEventoEfi(db, ev);
        if (r.acao !== 'ignorado' && r.acao !== 'repetido') req.log.info(r, 'webhook cobranca aplicado');
      } catch (e) {
        req.log.error({ erro: e.message }, 'falha ao aplicar evento da Efí');
      }
    }
    return { ok: true };
  });

  app.post('/webhooks/efi/pix', { config: { rateLimit: false } }, async (req, reply) => {
    if (!origemOk(req)) return reply.code(401).send();
    const pix = Array.isArray(req.body?.pix) ? req.body.pix : [];
    for (const p of pix) {
      if (!p.txid) continue;
      try {
        // Nunca confie no corpo: reconsulta a Efí pelo txid. É ela quem diz se,
        // e por quanto, o PIX foi pago. Se a Efí não estiver configurada, isto
        // lança e o catch impede qualquer crédito (falha fechado).
        const verificado = await efi.consultarPix(p.txid);
        const r = await aplicarPixPago(db, p.txid, verificado);
        if (r.acao === 'pago') req.log.info(r, 'webhook pix aplicado');
      } catch (e) {
        req.log.error({ erro: e.message }, 'falha ao aplicar pix da Efí');
      }
    }
    return { ok: true };
  });
};
