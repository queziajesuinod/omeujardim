// Concede (ou remove) um papel de acesso ao painel.
//
//   npm run papel -- fulano@exemplo.com admin
//   npm run papel -- fulano@exemplo.com -intercessor   (o "-" remove)
//
// Papéis válidos: admin, trilheiro, intercessor. É de propósito uma tarefa de
// linha de comando: dar acesso ao painel é ato administrativo, não vive numa
// tela pública.

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../../.env') });

const db = require('../db/models');

const PAPEIS = ['admin', 'trilheiro', 'intercessor'];

async function principal() {
  const [, , email, papelBruto] = process.argv;
  if (!email || !papelBruto) {
    console.error('uso: npm run papel -- <email> <papel|-papel>');
    process.exit(1);
  }

  const remover = papelBruto.startsWith('-');
  const papel = remover ? papelBruto.slice(1) : papelBruto;
  if (!PAPEIS.includes(papel)) {
    console.error(`papel inválido: ${papel}. Use um de: ${PAPEIS.join(', ')}`);
    process.exit(1);
  }

  const usuario = await db.Usuario.findOne({ where: { emailNormalizado: email.toLowerCase().trim() } });
  if (!usuario) {
    console.error(`usuário não encontrado: ${email}`);
    process.exit(1);
  }

  const atuais = new Set(usuario.papeis || []);
  if (remover) atuais.delete(papel);
  else atuais.add(papel);
  const papeis = [...atuais];

  await usuario.update({ papeis });
  console.log(`${email} agora tem papéis: ${papeis.length ? papeis.join(', ') : '(nenhum)'}`);
  await db.sequelize.close();
}

principal().catch((e) => { console.error(e.message); process.exit(1); });
