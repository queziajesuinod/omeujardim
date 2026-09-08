'use strict';

// Importa as trilhas de src/conteudo/trilhas/*.md para o banco e gera os
// embeddings de cada dia. Idempotente por título. Rode com: npm run trilhas
// A lógica mora em lib/trilhas-importar (compartilhada com a autoria do painel).

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db/models');
const { importarMarkdown } = require('../lib/trilhas-importar');

const DIR = path.resolve(__dirname, '../conteudo/trilhas');

(async () => {
  await db.sequelize.authenticate();
  const arquivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.md'));

  for (const arq of arquivos) {
    try {
      const r = await importarMarkdown(db, fs.readFileSync(path.join(DIR, arq), 'utf8'));
      console.log(`✓ ${r.trilha.titulo} — ${r.dias} dias (${r.comEmbedding} com embedding)`);
    } catch (e) {
      console.log(`(pulado) ${arq}: ${e.message}`);
    }
  }

  await db.sequelize.close();
})().catch(async (e) => {
  console.error('falha ao importar:', e.message);
  try { await db.sequelize.close(); } catch {}
  process.exit(1);
});
