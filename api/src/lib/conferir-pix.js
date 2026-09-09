'use strict';

// Rede de segurança do PIX: confere na Efí os pagamentos PENDENTES recentes e
// credita os que já foram pagos. Serve para quando o webhook não chega (ou
// chega errado). Reusa a conciliação idempotente (aplicarPixPago só credita com
// CONCLUIDA no valor certo), então rodar de novo num já pago não faz nada.
//
// Só olha PIX recentes: cobrança velha não vira paga do nada, e evita consultar
// a Efí à toa. Janela ajustável por PIX_POLL_HORAS.

const efi = require('./efi');
const { aplicarPixPago } = require('./conciliacao');

const LOOKBACK_HORAS = Number(process.env.PIX_POLL_HORAS || 48);
const LIMITE = 200;

/**
 * Confere os PIX pendentes recentes e credita os pagos. Devolve quantos viraram
 * pagos. Erro num txid não derruba o lote (loga e segue).
 */
async function conferirPixPendentes(db, log) {
  if (!efi.configurada()) return 0;
  const { Op } = db.Sequelize;
  const desde = new Date(Date.now() - LOOKBACK_HORAS * 60 * 60 * 1000);

  const pendentes = await db.Cobranca.findAll({
    where: {
      metodo: 'pix',
      status: 'pendente',
      efiTxid: { [Op.ne]: null },
      criado_em: { [Op.gte]: desde },
    },
    attributes: ['id', 'efiTxid'],
    order: [['criado_em', 'DESC']],
    limit: LIMITE,
  });

  let pagos = 0;
  for (const c of pendentes) {
    try {
      const verificado = await efi.consultarPix(c.efiTxid);
      const r = await aplicarPixPago(db, c.efiTxid, verificado);
      if (r.acao === 'pago') {
        pagos++;
        log?.info?.({ txid: c.efiTxid, assinatura: r.assinatura }, 'pix confirmado por polling');
      }
    } catch (e) {
      log?.error?.({ txid: c.efiTxid, erro: efi.motivoErro(e) }, 'falha ao conferir pix no polling');
    }
  }
  return pagos;
}

module.exports = { conferirPixPendentes };
