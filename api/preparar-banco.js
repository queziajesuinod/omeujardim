// Script de uso único: cria as extensões e a configuração de busca
// 'portugues_sem_acento' que a migração 20260903120400 precisa, e remove
// as tabelas que ficaram pela metade nas tentativas anteriores.
// Rode UMA vez com: node preparar-banco.js  (depois pode apagar este arquivo)
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

const extensoes = fs.readFileSync(
  path.resolve(__dirname, 'src/db/extensoes.sql'),
  'utf8'
);

const seq = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});

(async () => {
  try {
    await seq.authenticate();
    console.log('Conectado ao banco.');

    // 1. cria pgcrypto, unaccent, pg_trgm e a config 'portugues_sem_acento'
    await seq.query(extensoes);
    console.log('Extensões e configuração de busca aplicadas.');

    // 2. remove as tabelas que a migração criou antes de falhar
    await seq.query('DROP TABLE IF EXISTS trilha_dia; DROP TABLE IF EXISTS trilha;');
    console.log('Tabelas parciais (trilha, trilha_dia) removidas.');

    console.log('\nPronto. Agora rode: npm run migrar');
  } catch (e) {
    console.error('FALHOU:', e.message);
    process.exitCode = 1;
  } finally {
    await seq.close();
  }
})();
