'use strict';

// Importação de estação a partir de markdown. Cada dia tem uma linha por
// disciplina, no formato:  codigo | titulo | corpo
//
//   ---
//   nome: Estação de plantio
//   tema: fundamentos
//   descricao: Quarenta dias para firmar a raiz.
//   ---
//   ## Dia 1
//   leitura | João 1.1-18 | O Verbo se fez carne. Leia devagar.
//   meditacao | O silêncio | Cinco minutos parada, só ouvindo.
//   memorizacao | Salmo 1.1 | Bem-aventurado o homem...
//   ## Dia 2
//   ...
//
// Idempotente por nome. Reimportar substitui (o CASCADE apaga os dias antigos).

function parse(md) {
  const meta = {};
  let corpo = md;
  const fm = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (fm) {
    for (const l of fm[1].split('\n')) {
      const kv = l.match(/^(\w+):\s*(.*)$/);
      if (kv) meta[kv[1]] = kv[2].trim();
    }
    corpo = fm[2];
  }

  const dias = corpo
    .split(/^##\s+/m)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((bloco) => {
      const linhas = bloco.split('\n');
      linhas.shift(); // o cabeçalho "Dia N" — a ordem vem da posição
      const itens = [];
      for (const l of linhas) {
        const t = l.trim();
        if (!t) continue;
        const partes = t.split('|').map((p) => p.trim());
        if (partes.length < 2 || !partes[0]) continue;
        const [codigo, titulo, ...resto] = partes;
        itens.push({ disciplinaCodigo: codigo.toLowerCase(), titulo, corpo: resto.join(' | ') });
      }
      return itens;
    });

  return { meta, dias };
}

async function importarEstacao(db, md, opts = {}) {
  const { disponivelEm = null, publicar = true } = opts;
  const { Estacao, EstacaoDia, sequelize } = db;
  const { meta, dias } = parse(md);
  if (!meta.nome) throw new Error('O front-matter precisa de um "nome".');
  if (dias.length === 0) throw new Error('Nenhum dia encontrado. Cada dia começa com "## ".');

  const existente = await Estacao.findOne({ where: { nome: meta.nome } });
  if (existente) {
    const [{ n }] = await sequelize.query(
      'SELECT COUNT(*)::int AS n FROM estacao_inscricao WHERE estacao_id = :id AND removido_em IS NULL',
      { replacements: { id: existente.id }, type: sequelize.QueryTypes.SELECT }
    );
    if (n > 0) {
      throw new Error('Já existe uma estação com esse nome e com participantes. Renomeie a nova, ou remova a antiga no painel antes de reimportar.');
    }
  }

  const estacao = await sequelize.transaction(async (t) => {
    await sequelize.query('DELETE FROM estacao WHERE nome = :nm', { replacements: { nm: meta.nome }, transaction: t });
    const estacao = await Estacao.create({
      nome: meta.nome,
      tema: meta.tema || null,
      descricao: meta.descricao || null,
      dias: dias.length,
      publicadaEm: publicar ? new Date() : null,
      disponivelEm: disponivelEm || null,
    }, { transaction: t });

    for (const [i, itens] of dias.entries()) {
      for (const it of itens) {
        await EstacaoDia.create({
          estacaoId: estacao.id, ordem: i + 1,
          disciplinaCodigo: it.disciplinaCodigo, titulo: it.titulo, corpo: it.corpo,
        }, { transaction: t });
      }
    }
    return estacao;
  });

  return { estacao, dias: dias.length, itens: dias.reduce((s, d) => s + d.length, 0) };
}

module.exports = { parse, importarEstacao };
