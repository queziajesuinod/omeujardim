// ---------------------------------------------------------------------------
// Web Push, o transporte do lembrete.
//
// As chaves VAPID identificam o SERVIDOR para o serviço de push do navegador.
// São um par: a pública vai para o cliente assinar, a privada assina cada
// envio e nunca sai daqui. Geradas uma vez com `npm run vapid` e guardadas no
// .env. Sem elas, o push simplesmente não liga — e a gente diz isso em vez de
// fingir que mandou.
//
// O que este módulo NÃO faz: montar o texto. O corpo da notificação vem de
// lib/lembrete.js, que garante que nada do diário entra na prévia.
// ---------------------------------------------------------------------------

const webpush = require('web-push');

let ligado = false;

function iniciar() {
  const pub = process.env.VAPID_PUBLIC;
  const priv = process.env.VAPID_PRIVATE;
  const contato = process.env.VAPID_CONTATO || 'mailto:jardim@omeujardim.app.br';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(contato, pub, priv);
  ligado = true;
  return true;
}

iniciar();

function estaLigado() {
  return ligado;
}

function chavePublica() {
  return process.env.VAPID_PUBLIC || null;
}

/**
 * Entrega uma mensagem a uma assinatura.
 *
 * Devolve o desfecho em vez de estourar, para o chamador decidir o que fazer:
 *  - 'ok'       entregue
 *  - 'expirada' o navegador cancelou (404/410): a linha deve ser apagada
 *  - 'erro'     falha temporária: tenta de novo na próxima remessa
 */
async function enviar(assinatura, payload) {
  if (!ligado) return 'erro';
  const inscricao = {
    endpoint: assinatura.endpoint,
    keys: { p256dh: assinatura.p256dh, auth: assinatura.auth },
  };
  try {
    await webpush.sendNotification(inscricao, JSON.stringify(payload), { TTL: 3600 });
    return 'ok';
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) return 'expirada';
    return 'erro';
  }
}

module.exports = { estaLigado, chavePublica, enviar };
