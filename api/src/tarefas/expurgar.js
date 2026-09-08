'use strict';

// Roda o expurgo uma vez e sai. Serve para cron externo (ex.: Railway/Doppler
// schedule) além do agendamento interno que o servidor já faz ao subir.
//   node src/tarefas/expurgar.js

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
const db = require('../db/models');
const { expurgarVencidos } = require('../lib/expurgo');

(async () => {
  try {
    const n = await expurgarVencidos(db);
    console.log(`contas expurgadas: ${n}`);
  } catch (e) {
    console.error('falha no expurgo:', e.message);
    process.exitCode = 1;
  } finally {
    await db.sequelize.close();
  }
})();
