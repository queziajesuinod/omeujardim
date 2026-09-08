'use strict';

// Roda o fechamento das assinaturas uma vez e sai. Serve para cron externo
// além do agendamento interno que o servidor já faz ao subir.
//   node src/tarefas/fechar-assinaturas.js

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
const db = require('../db/models');
const { fecharVencidas } = require('../lib/fechar-assinaturas');

(async () => {
  try {
    const n = await fecharVencidas(db);
    console.log(`assinaturas encerradas: ${n}`);
  } catch (e) {
    console.error('falha ao fechar assinaturas:', e.message);
    process.exitCode = 1;
  } finally {
    await db.sequelize.close();
  }
})();
