// ---------------------------------------------------------------------------
// A remessa de lembretes, uma vez por minuto.
//
// Como rodar em produção: um cron externo, `* * * * * npm run lembretes`. Em
// máquina única de desenvolvimento, ligue LEMBRETES_INLINE=true e o servidor
// dispara sozinho a cada minuto (ver servidor.js).
//
// O que a tarefa garante:
//  - Cada pessoa recebe no SEU horário deslocado (lib/lembrete.js), nunca todo
//    mundo no mesmo segundo. Ver o comentário lá sobre o pico auto-infligido.
//  - Quem já regou hoje não é cutucado. O lembrete chama quem faltou, não cobra
//    quem veio.
//  - A prévia NUNCA carrega conteúdo do diário. Ou é texto fixo, ou é o TEMA
//    do dia da trilha (conteúdo autoral, público) — nunca o que a pessoa escreveu.
//  - Quem participa de uma trilha e tem o dia de hoje pendente recebe um
//    lembrete que cita o tema do dia e leva direto à trilha.
//  - WhatsApp só como alternativa de quem optou e não tem push ativo.
// ---------------------------------------------------------------------------

'use strict';

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../../.env') });

const { Op } = require('sequelize');
const db = require('../db/models');
const { horarioDoLembrete, textoDoLembrete } = require('../lib/lembrete');
const push = require('../lib/push');
const whatsapp = require('../lib/whatsapp');

const DIAS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Horário base do lembrete de quem participa de uma trilha mas não marcou
// horário em nenhuma prática. Deslocado por pessoa como os demais.
const HORA_TRILHA = process.env.LEMBRETE_TRILHA_HORA || '07:00';

/** Partes do relógio local de uma pessoa, no fuso dela. */
function partesLocais(fuso, quando) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  }).formatToParts(quando).reduce((o, p) => { o[p.type] = p.value; return o; }, {});
  const hora = partes.hour === '24' ? '00' : partes.hour;  // meia-noite vem '24' em alguns ICUs
  return {
    data: `${partes.year}-${partes.month}-${partes.day}`,
    hm: `${hora}:${partes.minute}`,
    diaSemana: DIAS[partes.weekday],
  };
}

function menosUmDia(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function diaDaSemanaDe(iso) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

function diasEntre(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function diaAtualDe(iniciadaEm, hoje, total) {
  return Math.max(1, Math.min(total, diasEntre(iniciadaEm, hoje) + 1));
}

/**
 * O dia de trilha pendente hoje, se houver. Devolve o tema (título do dia) para
 * o lembrete citar — conteúdo autoral, nunca do diário. Prefere a primeira
 * trilha com o dia de hoje ainda não regado.
 */
async function trilhaDoDiaPendente(inscricoes, dataDev) {
  for (const insc of inscricoes) {
    if (insc.concluidaEm) continue;
    const total = insc.trilha?.dias ?? 0;
    if (!total) continue;
    const diaAtual = diaAtualDe(insc.iniciadaEm, dataDev, total);
    const feito = (insc.regas ?? []).some((r) => r.ordem === diaAtual);
    if (feito) continue;
    const dia = await db.TrilhaDia.findOne({ where: { trilhaId: insc.trilhaId, ordem: diaAtual } });
    if (dia) {
      return { trilhaId: insc.trilhaId, tituloTrilha: insc.trilha.titulo, tituloDia: dia.titulo };
    }
  }
  return null;
}

/** Manda um lembrete já montado para uma pessoa. Devolve quantos pushes saíram. */
async function avisar(usuario, payload) {
  const assinaturas = await db.AssinaturaPush.findAll({ where: { usuarioId: usuario.id } });
  let entregues = 0;
  for (const a of assinaturas) {
    const r = await push.enviar(a, payload);
    if (r === 'ok') { entregues++; await a.update({ ultimoEnvioEm: new Date() }); }
    else if (r === 'expirada') { await a.destroy(); }  // navegador cancelou: some
  }

  // WhatsApp é o plano B de quem não tem push vivo e optou por ele.
  if (entregues === 0 && usuario.whatsappOptInEm && usuario.whatsappNumero) {
    await whatsapp.enviar(usuario.whatsappNumero, payload.corpo);
  }

  return entregues;
}

async function rodar(agora = new Date()) {
  const atributosUsuario = ['id', 'fuso', 'inicioDoDia', 'whatsappNumero', 'whatsappOptInEm'];

  // Duas fontes de lembrete: práticas com horário marcado, e trilhas em
  // andamento. Uma pessoa pode ter as duas, uma, ou nenhuma.
  const praticas = await db.Pratica.findAll({
    where: { ativa: true, lembreteEm: { [Op.ne]: null } },
    include: [{ model: db.Usuario, required: true, attributes: atributosUsuario }],
  });
  const inscricoes = await db.TrilhaInscricao.findAll({
    include: [
      { model: db.Usuario, required: true, attributes: atributosUsuario },
      { model: db.Trilha, as: 'trilha', attributes: ['id', 'titulo', 'dias'] },
      { model: db.TrilhaRega, as: 'regas', attributes: ['ordem'] },
    ],
  });

  // Agrupa por pessoa: um push por pessoa por minuto, no máximo.
  const porUsuario = new Map();
  const entrada = (u) => {
    if (!porUsuario.has(u.id)) porUsuario.set(u.id, { usuario: u, praticas: [], inscricoes: [] });
    return porUsuario.get(u.id);
  };
  for (const p of praticas) { if (p.Usuario) entrada(p.Usuario).praticas.push(p); }
  for (const i of inscricoes) { if (i.Usuario) entrada(i.Usuario).inscricoes.push(i); }

  let pessoas = 0;
  let pushes = 0;
  for (const { usuario, praticas: doUsuario, inscricoes: minhasTrilhas } of porUsuario.values()) {
    const { data, hm } = partesLocais(usuario.fuso || 'America/Sao_Paulo', agora);
    const inicio = String(usuario.inicioDoDia || '04:00:00').slice(0, 5);
    const dataDev = hm < inicio ? menosUmDia(data) : data;
    const dsDev = diaDaSemanaDe(dataDev);

    // Os horários-base de hoje: os das práticas previstas; se não houver
    // nenhum e a pessoa está numa trilha, o horário padrão da trilha.
    const praticasHoje = doUsuario.filter((p) => p.diasSemana.includes(dsDev));
    const bases = [...new Set(praticasHoje.map((p) => String(p.lembreteEm).slice(0, 5)))];
    if (bases.length === 0 && minhasTrilhas.length > 0) bases.push(HORA_TRILHA);

    const noPonto = bases.some((b) => horarioDoLembrete(usuario.id, b) === hm);
    if (!noPonto) continue;

    // O tema do dia da trilha tem prioridade: é o conteúdo mais vivo do dia.
    const trilha = await trilhaDoDiaPendente(minhasTrilhas, dataDev);
    let payload;
    if (trilha) {
      payload = {
        titulo: 'O meu jardim',
        corpo: `${trilha.tituloTrilha}: ${trilha.tituloDia}`,
        url: `/trilha?id=${trilha.trilhaId}`,
      };
    } else {
      // Sem trilha pendente: só cutuca quem tem prática por fazer hoje.
      if (praticasHoje.length === 0) continue;
      const jaRegou = await db.Registro.count({ where: { usuarioId: usuario.id, dataRef: dataDev } });
      if (jaRegou) continue;
      payload = {
        titulo: 'O meu jardim',
        corpo: textoDoLembrete(usuario.id, new Date(`${dataDev}T12:00:00Z`)),
        url: '/hoje',
      };
    }

    pushes += await avisar(usuario, payload);
    pessoas++;
  }

  return { pessoas, pushes };
}

// Execução avulsa (cron externo): roda uma vez, informa e sai.
async function principal() {
  if (!push.estaLigado()) {
    console.warn('VAPID não configurado: push desligado. Rode `npm run vapid` e ponha no .env.');
  }
  const { pessoas, pushes } = await rodar();
  console.log(`lembretes: ${pessoas} pessoa(s), ${pushes} push(es).`);
  await db.sequelize.close();
}

if (require.main === module) {
  principal().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { rodar, partesLocais };
