'use strict';

// A camada de jogo, calculada a partir das regas. Aqui moram as regras da marca
// que NÃO podem ser quebradas:
//   - a chama pausa, nunca zera (é monótona: só cresce ou espera);
//   - ausência não é punida nem pintada de vermelho;
//   - quem volta depois de sumir é recebido, não cobrado.
//
// Função pura de propósito: recebe datas e contagens, devolve o estado. Sem
// banco aqui, para ser fácil de conferir e de testar.

const DIA = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const emMs = (data) => Date.parse(`${data}T00:00:00Z`);
const diasEntre = (a, b) => Math.round((emMs(b) - emMs(a)) / DIA);

const CONQUISTAS = [
  { codigo: 'primeira_semente', nome: 'Primeira semente', descricao: 'Sua primeira rega.', regra: (d) => d.totalDias >= 1 },
  { codigo: 'semeador', nome: 'Semeador', descricao: 'Sete dias regados.', regra: (d) => d.totalDias >= 7 },
  { codigo: 'estacao', nome: 'Uma estação', descricao: 'Trinta dias regados.', regra: (d) => d.totalDias >= 30 },
  { codigo: 'jardineiro', nome: 'Jardineiro', descricao: 'Cem dias regados.', regra: (d) => d.totalDias >= 100 },
  { codigo: 'terra_fertil', nome: 'Terra fértil', descricao: 'Oitenta por cento de constância em trinta dias.', regra: (d) => d.percentual >= 80 },
  { codigo: 'volta_por_cima', nome: 'Volta por cima', descricao: 'Voltou depois de uma pausa longa.', regra: (d) => d.voltouAlgumaVez },
  { codigo: 'escriba', nome: 'Escriba', descricao: 'Dez anotações no diário.', regra: (d) => d.anotacoes >= 10 },
  { codigo: 'colheita', nome: 'Colheita', descricao: 'Uma oração respondida.', regra: (d) => d.oracoesRespondidas >= 1 },
  { codigo: 'variedade', nome: 'Jardim variado', descricao: 'Três práticas ou mais.', regra: (d) => d.praticasAtivas >= 3 },
  { codigo: 'constante', nome: 'Constante', descricao: 'Vinte e um dos últimos trinta dias regados.', regra: (d) => d.diasRegados >= 21 },
];

function calcularJardim({ datas, hoje, anotacoes = 0, oracoesRespondidas = 0, praticasAtivas = 0, constancia, regadasPorDia = {}, previstasPorSemana = [] }) {
  const conjunto = new Set(datas);
  const ordenadas = [...conjunto].sort();

  // A chama: dias de constância acumulados. Só cresce; ausência não a diminui.
  const chama = ordenadas.length;
  const emPausa = !conjunto.has(hoje);

  // Escudos de graça do mês: dois, menos os dias devocionais que passaram em
  // branco neste mês até hoje. É um indicador gentil, não uma punição.
  const [ano, mes] = hoje.split('-');
  const inicioMes = `${ano}-${mes}-01`;
  const primeira = ordenadas[0];
  // Só conta como "perdido" a partir do dia em que a pessoa começou: dias antes
  // da primeira rega (ou de a conta existir) não são ausência dela.
  const inicioContagem = primeira && primeira > inicioMes ? primeira : inicioMes;
  let perdidosNoMes = 0;
  if (primeira && inicioContagem <= hoje) {
    const diasNoIntervalo = diasEntre(inicioContagem, hoje) + 1;
    const regadosNoIntervalo = ordenadas.filter((d) => d >= inicioContagem && d <= hoje).length;
    perdidosNoMes = Math.max(0, diasNoIntervalo - regadosNoIntervalo);
  }
  const escudos = Math.max(0, 2 - perdidosNoMes);

  // Voltou por cima: houve, em algum momento, uma pausa de sete dias ou mais
  // entre duas regas. E "agora", se a última rega (hoje ou ontem) veio logo
  // depois de uma pausa dessas, o app recebe com festa.
  let voltouAlgumaVez = false;
  for (let i = 1; i < ordenadas.length; i++) {
    if (diasEntre(ordenadas[i - 1], ordenadas[i]) >= 7) { voltouAlgumaVez = true; break; }
  }
  const ultima = ordenadas[ordenadas.length - 1];
  const penultima = ordenadas[ordenadas.length - 2];
  const voltaPorCima = Boolean(ultima && penultima && diasEntre(ultima, hoje) <= 1 && diasEntre(penultima, ultima) >= 7);

  // Calendário dos últimos 30 dias, do mais antigo ao mais novo. Sem vermelho:
  // dia sem rega é apenas neutro. Cada dia carrega a FRAÇÃO do que era previsto
  // e foi feito — o quadradinho enche conforme isso, cheio quando o dia inteiro
  // foi regado.
  const base = emMs(hoje);
  const calendario = [];
  for (let i = 29; i >= 0; i--) {
    const dia = iso(base - i * DIA);
    const feitas = regadasPorDia[dia] || 0;
    const previstas = previstasPorSemana[new Date(emMs(dia)).getUTCDay()] || 0;
    // Sem previstas conhecidas mas com rega, conta como cheio (fez o que havia).
    const fracao = previstas > 0 ? Math.min(1, feitas / previstas) : (conjunto.has(dia) ? 1 : 0);
    calendario.push({ data: dia, regou: conjunto.has(dia), feitas, previstas, fracao });
  }

  const ctx = {
    totalDias: chama, anotacoes, oracoesRespondidas, praticasAtivas,
    percentual: constancia?.percentual ?? 0, diasRegados: constancia?.diasRegados ?? 0,
    voltouAlgumaVez,
  };
  const conquistas = CONQUISTAS.map(({ regra, ...c }) => ({ ...c, conquistada: Boolean(regra(ctx)) }));

  return { chama, emPausa, escudos, voltaPorCima, calendario, conquistas };
}

module.exports = { calcularJardim };
