'use strict';

// Fechamento diário das assinaturas: encerra o que venceu.
//
// Uma assinatura cancelada só perde o acesso quando o período pago fecha; um
// trial (ou período inadimplente) sem pagamento confirmado também vira
// `encerrada` no dia seguinte ao vencimento. A decisão de "o que fazer hoje"
// mora em lib/assinatura.js (domínio puro); aqui é só o laço e o banco.
//
// Ao encerrar, NÃO mexemos em desativado_em: ao logar depois, a pessoa é levada
// a assinar de novo, não barrada. Ver PLANO-ASSINATURAS.md.

async function fecharVencidas(db) {
  const { fechamentoDoDia } = require('./assinatura');
  const { Assinatura, Usuario } = db;

  const candidatas = await Assinatura.findAll({
    where: { status: ['trial', 'cancelada', 'inadimplente'] },
    include: [{ model: Usuario, attributes: ['fuso'] }],
  });

  let encerradas = 0;
  for (const a of candidatas) {
    const fuso = a.Usuario?.fuso || 'America/Sao_Paulo';
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(new Date());
    const proximo = fechamentoDoDia(a, hoje);
    if (!proximo) continue;
    // Update condicional pelo status que lemos: se um webhook de pagamento
    // mudou a assinatura nesse meio-tempo (ex.: virou 'ativa' com período novo),
    // o WHERE não casa e não encerramos por engano quem acabou de pagar.
    const [n] = await Assinatura.update(
      { status: proximo },
      { where: { id: a.id, status: a.status } }
    );
    if (n > 0) encerradas++;
  }
  return encerradas;
}

module.exports = { fecharVencidas };
