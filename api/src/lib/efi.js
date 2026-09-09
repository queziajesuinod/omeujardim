'use strict';

// Adaptador único sobre o SDK da Efí. TODO contato com a Efí passa por aqui —
// criar plano, assinatura recorrente no cartão, cobrança PIX avulsa, cancelar,
// e resolver a notificação do webhook. Isola o SDK para trocar sandbox/produção
// por config e para testar o resto do sistema com um mock. Ver PLANO-ASSINATURAS.
//
// PCI: o número do cartão nunca chega aqui. O Efí.js no cliente tokeniza e nos
// manda um `payment_token`; é só isso que passa para a Efí.

const path = require('node:path');
const fs = require('node:fs');

const PLACEHOLDERS = new Set([undefined, '', 'troque', 'seu_client_id', 'seu_client_secret']);

/** A configuração está completa o bastante para falar com a Efí? */
function configurada() {
  return (
    !PLACEHOLDERS.has(process.env.EFI_CLIENT_ID) &&
    !PLACEHOLDERS.has(process.env.EFI_CLIENT_SECRET) &&
    !PLACEHOLDERS.has(process.env.EFI_CERTIFICADO)
  );
}

/** O valor e o ciclo do plano, vindos do .env. Um lugar só decide o preço. */
function plano() {
  return {
    valorCentavos: Number(process.env.EFI_PLANO_VALOR_CENTAVOS || 0),
    ciclo: process.env.EFI_PLANO_CICLO || 'mensal',
    trialDias: Number(process.env.EFI_TRIAL_DIAS || 7),
    nome: process.env.EFI_PLANO_NOME || 'O meu jardim',
  };
}

/** Meses de um ciclo, para o `interval` do plano da Efí. */
const INTERVALO = { mensal: 1, anual: 12 };

let cliente = null;
/** Constrói (uma vez) o cliente do SDK. Lança claro se faltar configuração. */
function obterCliente() {
  if (!configurada()) {
    const erro = new Error('Efí não configurada: defina EFI_CLIENT_ID, EFI_CLIENT_SECRET e EFI_CERTIFICADO no .env.');
    erro.codigo = 'efi_nao_configurada';
    throw erro;
  }
  if (cliente) return cliente;
  const EfiPay = require('sdk-node-apis-efi');

  // Caminho relativo resolvido a partir de api/ (dois níveis acima daqui), para
  // não depender de onde o processo foi iniciado.
  const resolver = (p) => (path.isAbsolute(p) ? p : path.resolve(__dirname, '../..', p));
  const certificado = resolver(process.env.EFI_CERTIFICADO);

  const opcoes = {
    sandbox: process.env.EFI_SANDBOX !== 'false',
    client_id: process.env.EFI_CLIENT_ID,
    client_secret: process.env.EFI_CLIENT_SECRET,
    certificate: certificado,
  };

  // A Efí aceita .p12 (só `certificate`) ou .pem. Quando é .pem o SDK EXIGE
  // `pemKey`; como o nosso .pem carrega o certificado e a chave no mesmo arquivo,
  // o mesmo caminho serve para os dois (é o que o erro da Efí pede). Detecta pelo
  // CONTEÚDO, não pela extensão, porque o arquivo pode ter sido salvo como .p12
  // mas conter PEM. Override explícito por EFI_PEM_KEY, se um dia a chave for
  // um arquivo separado.
  if (!PLACEHOLDERS.has(process.env.EFI_PEM_KEY)) {
    opcoes.pemKey = resolver(process.env.EFI_PEM_KEY);
  } else {
    let ehPem = /\.pem$/i.test(certificado);
    if (!ehPem) {
      try { ehPem = fs.readFileSync(certificado, 'utf8').includes('-----BEGIN'); } catch { /* binário/.p12 */ }
    }
    if (ehPem) opcoes.pemKey = certificado;
  }

  cliente = new EfiPay(opcoes);
  return cliente;
}

// Cache em memória do id do plano, para não recriar a cada chamada. O ideal é
// fixar EFI_PLANO_ID no .env; sem ele, criamos uma vez por processo e logamos.
let planoIdMemoria = null;

/** Garante o plano recorrente na Efí e devolve o `plan_id` (número). */
async function garantirPlano(log) {
  if (process.env.EFI_PLANO_ID) return Number(process.env.EFI_PLANO_ID);
  if (planoIdMemoria) return planoIdMemoria;
  const p = plano();
  const efi = obterCliente();
  const r = await efi.createPlan({}, {
    name: p.nome,
    interval: INTERVALO[p.ciclo] || 1,
    repeats: null, // recorrência sem fim; quem encerra é o cancelamento
  });
  planoIdMemoria = r.data.plan_id;
  log?.warn?.({ planoId: planoIdMemoria }, 'plano da Efí criado — fixe EFI_PLANO_ID no .env para não recriar');
  return planoIdMemoria;
}

/** Converte centavos para o formato que a Efí espera em cada API. */
const paraReais = (centavos) => Number((centavos / 100).toFixed(2));

/**
 * Cria uma assinatura recorrente no cartão e faz a 1ª cobrança (one-step).
 * `payment_token` vem do Efí.js no cliente; `cliente` traz os dados do titular.
 * Devolve { efiAssinaturaId, charge, status }.
 */
async function assinarCartao({ payment_token, cliente: titular, valorCentavos, customId, notificationUrl }, log) {
  const efi = obterCliente();
  const planId = await garantirPlano(log);

  // A Efí valida notification_url contra ^https?://.+ e recusa se vier vazio.
  // Em dev (sem túnel), simplesmente não mandamos — a Efí usa a URL do painel.
  const metadata = {};
  if (customId) metadata.custom_id = String(customId);
  if (notificationUrl && /^https?:\/\/.+/.test(notificationUrl)) metadata.notification_url = notificationUrl;

  const r = await efi.createOneStepSubscription({ id: planId }, {
    items: [{ name: plano().nome, value: valorCentavos, amount: 1 }],
    metadata,
    payment: {
      credit_card: {
        payment_token,
        // Sem `installments`: assinatura recorrente não tem parcela (a Efí
        // recusa a propriedade no schema de assinatura).
        customer: {
          name: titular.nome,
          cpf: titular.cpf,
          email: titular.email,
          phone_number: titular.telefone,
          birth: titular.nascimento,
        },
      },
    },
  });
  return {
    efiAssinaturaId: String(r.data.subscription_id),
    charge: r.data.charge,       // { id, status, total }
    status: r.data.status,
  };
}

/**
 * Cria uma cobrança PIX avulsa de uma mensalidade. Devolve { txid, qrcode,
 * imagemQrcode }. Requer EFI_PIX_CHAVE configurada e o app com escopo de PIX.
 */
async function cobrarPix({ valorCentavos, cliente: titular, expiraSeg = 3600 }) {
  if (PLACEHOLDERS.has(process.env.EFI_PIX_CHAVE)) {
    const erro = new Error('PIX não configurado: defina EFI_PIX_CHAVE no .env.');
    erro.codigo = 'pix_nao_configurado';
    throw erro;
  }
  const efi = obterCliente();
  const cob = await efi.pixCreateImmediateCharge({}, {
    calendario: { expiracao: expiraSeg },
    devedor: titular.cpf ? { cpf: titular.cpf, nome: titular.nome } : undefined,
    valor: { original: paraReais(valorCentavos).toFixed(2) },
    chave: process.env.EFI_PIX_CHAVE,
    solicitacaoPagador: 'Assinatura O meu jardim',
  });
  const qr = await efi.pixGenerateQRCode({ id: cob.loc.id });
  return { txid: cob.txid, qrcode: qr.qrcode, imagemQrcode: qr.imagemQrcode };
}

/**
 * Consulta uma cobrança PIX pelo txid, direto na Efí. É a única fonte da verdade
 * sobre se um PIX foi pago: o corpo do webhook é forjável, este endpoint não.
 * Devolve status ('CONCLUIDA' quando pago), o valor esperado e o total pago, os
 * dois em centavos inteiros (dinheiro nunca em float que sobrevive).
 */
async function consultarPix(txid) {
  const efi = obterCliente();
  // As APIs de PIX do SDK devolvem o corpo direto (sem .data), diferente das de
  // cobrança/assinatura — mesmo padrão de pixCreateImmediateCharge acima.
  const cob = await efi.pixDetailCharge({ txid });
  const original = cob?.valor?.original;
  const pagoReais = Array.isArray(cob?.pix)
    ? cob.pix.reduce((soma, p) => soma + Number(p.valor || 0), 0)
    : 0;
  return {
    status: cob?.status || null,
    valorCentavos: original != null ? Math.round(Number(original) * 100) : null,
    pagoCentavos: Math.round(pagoReais * 100),
  };
}

/** Cancela a assinatura recorrente na Efí (para as cobranças futuras). */
async function cancelar(efiAssinaturaId) {
  const efi = obterCliente();
  return efi.cancelSubscription({ id: Number(efiAssinaturaId) });
}

/**
 * Resolve o token de notificação do webhook de cobranças/assinaturas: a Efí só
 * manda o token; a gente busca os eventos por ele (isso já é a validação de
 * origem, pois só a nossa API autenticada consegue resolver). Devolve o array
 * de eventos (o último é o estado mais recente).
 */
async function resolverNotificacao(token) {
  const efi = obterCliente();
  const r = await efi.getNotification({ token });
  return r.data || [];
}

/**
 * Extrai um motivo legível do erro da Efí, que pode vir como string, objeto
 * { error, error_description } ou lista de { property, message }. Para o log e
 * para mostrar à pessoa o que a operadora respondeu (ex.: "não autorizada").
 */
function motivoErro(e) {
  if (!e) return 'erro desconhecido';
  if (typeof e === 'string') return e;
  const item = (x) => {
    if (typeof x === 'string') return x;
    const campo = x.property || x.name || x.campo || x.path;
    const msg = x.message || x.reason || x.mensagem;
    return [campo, msg].filter(Boolean).join(': ') || JSON.stringify(x);
  };
  const d = e.error_description ?? e.mensagem ?? e.message;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map(item).join('; ');
  if (d && typeof d === 'object') return item(d);
  return e.error || JSON.stringify(e);
}

module.exports = {
  configurada,
  plano,
  obterCliente,
  garantirPlano,
  assinarCartao,
  cobrarPix,
  consultarPix,
  cancelar,
  resolverNotificacao,
  motivoErro,
};
