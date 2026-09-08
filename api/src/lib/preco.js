'use strict';

// Preço vigente do plano. É o mais recente em `plano_preco`; sem nenhum, cai no
// valor do .env (EFI_PLANO_VALOR_CENTAVOS), que serve de semente. Mudar o preço
// vigente não toca em quem já assinou — cada assinatura congela o seu valor no
// nascimento. Ver PLANO-ASSINATURAS.md.

async function precoVigente(db) {
  const row = await db.PlanoPreco.findOne({ order: [['vigenteDesde', 'DESC'], ['criado_em', 'DESC']] });
  if (row) return { valorCentavos: row.valorCentavos, rotulo: row.rotulo, id: row.id, vigenteDesde: row.vigenteDesde };
  return { valorCentavos: Number(process.env.EFI_PLANO_VALOR_CENTAVOS || 0), rotulo: 'inicial', id: null, vigenteDesde: null };
}

/** Quantas assinaturas ativas/trial estão num valor diferente do vigente. */
async function contarEmPrecoAntigo(db, valorVigente) {
  return db.Assinatura.count({
    where: {
      status: ['trial', 'ativa', 'inadimplente'],
      valorCentavos: { [db.Sequelize.Op.ne]: valorVigente },
    },
  });
}

module.exports = { precoVigente, contarEmPrecoAntigo };
