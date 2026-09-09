// ---------------------------------------------------------------------------
// Confere na Efí os PIX pendentes recentes e credita os pagos. Rede de segurança
// para quando o webhook não chega.
//
// Como rodar em produção: um cron externo, `* * * * * npm run conferir-pix`. Em
// máquina única, PIX_POLL_INLINE não sendo 'false' (padrão) já liga o relógio
// dentro do servidor.js — não precisa deste script.
// ---------------------------------------------------------------------------

'use strict';

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../../.env') });

const db = require('../db/models');
const { conferirPixPendentes } = require('../lib/conferir-pix');

async function principal() {
  const pagos = await conferirPixPendentes(db, console);
  console.log(`conferir-pix: ${pagos} pagamento(s) confirmado(s).`);
  await db.sequelize.close();
}

if (require.main === module) {
  principal().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { principal };
