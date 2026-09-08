// Gera um par de chaves VAPID e imprime as linhas prontas para o .env.
// Roda uma vez por ambiente: `npm run vapid`. A privada é segredo, trate como
// senha. Trocar o par depois invalida todas as assinaturas já feitas.

const webpush = require('web-push');

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('# Chaves VAPID para Web Push. A privada é segredo.');
console.log(`VAPID_PUBLIC=${publicKey}`);
console.log(`VAPID_PRIVATE=${privateKey}`);
console.log('VAPID_CONTATO=mailto:jardim@omeujardim.app.br');
