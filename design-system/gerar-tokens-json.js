// Gera tokens.json a partir de tokens.css.
// Uma fonte só. O JSON serve para o Figma e para o app nativo, se um dia existir.
// Rode: node gerar-tokens-json.js

const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.join(__dirname, 'tokens.css'), 'utf8');
const VERSAO = require('./package.json').version;

function bloco(seletor) {
  const i = CSS.indexOf(seletor);
  const ini = CSS.indexOf('{', i);
  const fim = CSS.indexOf('}', ini);
  return CSS.slice(ini + 1, fim);
}
function ler(texto) {
  const m = {};
  for (const t of texto.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) m[t[1].slice(2)] = t[2].trim();
  return m;
}

const claro = ler(bloco(':root {'));
const escuro = ler(bloco(':root[data-tema="escuro"]'));

const grupo = (mapa, chaves) =>
  Object.fromEntries(chaves.filter((k) => mapa[k]).map((k) => [k, { valor: mapa[k] }]));

const MARCA = ['musgo', 'broto', 'latao', 'latao-texto', 'terra', 'orvalho', 'papel', 'noite', 'nevoa'];
const SEMANTICOS = [
  'bg', 'surface', 'surface-2', 'line', 'ink', 'ink-2', 'ink-3',
  'brand', 'brand-forte', 'brand-soft', 'on-brand',
  'accent', 'accent-fill', 'accent-soft', 'on-accent-soft', 'on-accent-fill',
  'alert', 'alert-soft', 'foco', 'overlay', 'off-bg', 'off-ink',
];
const TIPO = ['display', 'leitura', 'ui', 'mono',
  't-d1', 't-d2', 't-d3', 't-d4', 't-l1', 't-l2', 't-l3', 't-u1', 't-u2', 't-u3', 't-u4',
  'p-leve', 'p-normal', 'p-medio', 'p-forte'];
const ESPACO = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'];
const FORMA = ['r-campo', 'r-card', 'r-folha', 'r-pilula', 'btn-sm', 'btn-md', 'btn-lg', 'toque-min'];
const MOVIMENTO = ['t-rapido', 't-padrao', 't-crescer'];
const LAYOUT = ['bp-gr', 'bp-tb', 'bp-dk', 'largura-leitura', 'largura-app', 'largura-max'];

const saida = {
  nome: 'o meu jardim',
  versao: VERSAO,
  gerado_em: new Date().toISOString().slice(0, 10),
  aviso: 'Arquivo gerado. Edite tokens.css e rode node gerar-tokens-json.js.',
  cor: {
    marca: grupo(claro, MARCA),
    claro: grupo(claro, SEMANTICOS),
    escuro: grupo(escuro, SEMANTICOS),
  },
  tipografia: grupo(claro, TIPO),
  espaco: grupo(claro, ESPACO),
  forma: grupo(claro, FORMA),
  movimento: grupo(claro, MOVIMENTO),
  layout: grupo(claro, LAYOUT),
};

fs.writeFileSync(path.join(__dirname, 'tokens.json'), JSON.stringify(saida, null, 2) + '\n');
const n = Object.values(saida).filter((v) => typeof v === 'object').length;
console.log(`tokens.json gerado, versão ${VERSAO}, ${n} grupos.`);
