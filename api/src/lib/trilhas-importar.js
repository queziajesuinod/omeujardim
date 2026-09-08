'use strict';

// Importação de trilha a partir de markdown. Usada pelo CLI (npm run trilhas) e
// pela rota de autoria do painel (o trilheiro cola o markdown). Idempotente por
// título: reimportar substitui a trilha (o CASCADE apaga os dias antigos).
//
// Formato:
//   ---
//   titulo: ...
//   autor: ...
//   tema: ...
//   gratuita: true
//   ---
//   ## Título do dia
//   referencia: Livro 0.0     (linha opcional)
//   corpo em um ou mais parágrafos
//   pergunta: ...             (linha opcional)

const { gerarEmbedding, paraVetorSql } = require('./embeddings');

function parse(md) {
  const meta = {};
  let corpo = md;
  const fm = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (fm) {
    for (const linha of fm[1].split('\n')) {
      const kv = linha.match(/^(\w+):\s*(.*)$/);
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
      const titulo = linhas.shift().trim();
      const blocos = [];
      let pergunta = null;
      let buffer = [];
      const flush = () => {
        const txt = buffer.join('\n').trim();
        if (txt) blocos.push({ tipo: 'texto', texto: txt });
        buffer = [];
      };
      for (const l of linhas) {
        const ref = l.match(/^referencia:\s*(.+)$/i);
        const lnk = l.match(/^link:\s*(.+)$/i);
        const per = l.match(/^pergunta:\s*(.+)$/i);
        if (ref) {
          flush();
          // referencia: Citação | versículo (o versículo é opcional)
          const partes = ref[1].split('|').map((s) => s.trim());
          blocos.push(partes.length >= 2 && partes[1]
            ? { tipo: 'referencia', ref: partes[0], texto: partes.slice(1).join('|').trim() }
            : { tipo: 'referencia', ref: partes[0] });
        } else if (lnk) {
          flush();
          const partes = lnk[1].split('|').map((s) => s.trim());
          if (partes.length >= 2 && partes[1]) blocos.push({ tipo: 'link', rotulo: partes[0], url: partes.slice(1).join('|').trim() });
          else if (partes[0]) blocos.push({ tipo: 'link', rotulo: 'Abrir', url: partes[0] });
        } else if (per) {
          pergunta = per[1].trim();
        } else if (l.trim() === '') {
          flush();
        } else {
          buffer.push(l);
        }
      }
      flush();
      // corpo = texto plano do dia, para a busca e o embedding.
      const corpo = blocos
        .map((b) => (b.tipo === 'texto' ? b.texto : b.tipo === 'referencia' ? `${b.ref} ${b.texto || ''}` : ''))
        .join('\n').trim();
      return { titulo, blocos, pergunta, corpo };
    });

  return { meta, dias };
}

/**
 * Cria (ou substitui) a trilha e seus dias, depois gera os embeddings.
 * Os embeddings são feitos DEPOIS do commit, de propósito: gerar vetor carrega o
 * modelo e é lento; não vale segurar uma transação aberta por isso. Dia sem
 * embedding continua achável pela busca textual.
 */
async function importarMarkdown(db, md, opts = {}) {
  const { disponivelEm = null, publicar = true, bloquearPublicada = false } = opts;
  const { Trilha, TrilhaDia, sequelize } = db;
  const { meta, dias } = parse(md);
  if (!meta.titulo) throw new Error('O front-matter precisa de um "titulo".');
  if (dias.length === 0) throw new Error('Nenhum dia encontrado. Cada dia começa com "## ".');

  // Editar (reimportar de mesmo título) tem duas travas:
  //  - Com participantes: recriar apagaria o progresso deles. Sempre recusa.
  //  - Publicada: editar no ar muda o conteúdo debaixo de quem lê. O painel
  //    (bloquearPublicada) exige despublicar antes. O seed não passa por isso.
  const existente = await Trilha.findOne({ where: { titulo: meta.titulo } });
  if (existente) {
    const [{ n }] = await sequelize.query(
      'SELECT COUNT(*)::int AS n FROM trilha_inscricao WHERE trilha_id = :id',
      { replacements: { id: existente.id }, type: sequelize.QueryTypes.SELECT }
    );
    if (n > 0) {
      throw new Error('Esta trilha tem participantes e não pode ser editada. Publique com outro título.');
    }
    if (bloquearPublicada && existente.publicadaEm) {
      throw new Error('Esta trilha está publicada. Despublique antes de editar.');
    }
  }

  const { trilha, diasCriados } = await sequelize.transaction(async (t) => {
    let trilha;
    if (existente) {
      // Editar no lugar: mantém o id da trilha, então links, catálogo e a tela
      // aberta continuam válidos. Trocam só os dias — seguro porque já se
      // conferiu que não há participantes (as regas referenciam o dia por id).
      await sequelize.query('DELETE FROM trilha_dia WHERE trilha_id = :id', { replacements: { id: existente.id }, transaction: t });
      await existente.update({
        autor: meta.autor || 'Autoria do jardim',
        tema: meta.tema || null,
        dias: dias.length,
        publicadaEm: publicar ? (existente.publicadaEm || new Date()) : null,
        disponivelEm: disponivelEm || null,
      }, { transaction: t });
      trilha = existente;
    } else {
      trilha = await Trilha.create({
        titulo: meta.titulo,
        autor: meta.autor || 'Autoria do jardim',
        tema: meta.tema || null,
        dias: dias.length,
        publicadaEm: publicar ? new Date() : null,
        disponivelEm: disponivelEm || null,
      }, { transaction: t });
    }

    const diasCriados = [];
    for (const [i, d] of dias.entries()) {
      const td = await TrilhaDia.create({
        trilhaId: trilha.id, ordem: i + 1, titulo: d.titulo,
        corpo: d.corpo, blocos: d.blocos, pergunta: d.pergunta,
      }, { transaction: t });
      diasCriados.push({ id: td.id, ...d });
    }
    return { trilha, diasCriados };
  });

  let comEmbedding = 0;
  for (const d of diasCriados) {
    const vetor = await gerarEmbedding(`${d.titulo}. ${d.corpo} ${d.pergunta || ''}`.trim(), 'passage');
    if (vetor) {
      await sequelize.query('UPDATE trilha_dia SET embedding = CAST(:v AS vector) WHERE id = :id',
        { replacements: { v: paraVetorSql(vetor), id: d.id } });
      comEmbedding++;
    }
  }

  return { trilha, dias: diasCriados.length, comEmbedding };
}

module.exports = { parse, importarMarkdown };
