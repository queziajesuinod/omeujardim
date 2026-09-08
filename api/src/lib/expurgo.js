'use strict';

// Expurgo real das contas excluídas há mais de `dias` dias.
//
// O DELETE em SQL cru é hard delete de verdade, não o soft delete do paranoid,
// e o CASCADE das chaves estrangeiras leva junto práticas, registros, diário e
// orações da pessoa. É aqui que "excluir a conta" vira dado que sumiu do banco.

async function expurgarVencidos(db, dias = 30) {
  const { sequelize } = db;
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const vencidos = await sequelize.query(
    'SELECT id FROM usuario WHERE removido_em IS NOT NULL AND removido_em < :limite',
    { replacements: { limite }, type: sequelize.QueryTypes.SELECT }
  );

  for (const { id } of vencidos) {
    await sequelize.query('DELETE FROM usuario WHERE id = :id', { replacements: { id } });
  }
  return vencidos.length;
}

module.exports = { expurgarVencidos };
