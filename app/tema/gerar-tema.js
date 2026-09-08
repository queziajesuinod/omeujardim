// ---------------------------------------------------------------------------
// Converte design-system/tokens.json em tema/tema.ts, para React Native.
//
// A regra que sustenta tudo: os tokens têm UMA fonte, o tokens.css do design
// system. O CSS gera o JSON, o JSON gera o TS. Ninguém digita hex no app.
// Se alguém digitar, o teste tokens.spec.js do design system reprova.
//
// Rode: node tema/gerar-tema.js ../design-system/tokens.json
// ---------------------------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');

const origem = process.argv[2] || path.resolve(__dirname, '../../design-system/tokens.json');
const destino = path.resolve(__dirname, 'tema.ts');
const tokens = JSON.parse(fs.readFileSync(origem, 'utf8'));

const camel = (s) => s.replace(/-(\w)/g, (_, c) => c.toUpperCase());
const px = (v) => Number(String(v).replace('px', ''));

function cores(grupo) {
  return Object.entries(grupo)
    .map(([nome, { valor }]) => `    ${camel(nome)}: '${valor}',`)
    .join('\n');
}

function numeros(grupo, transformar = px) {
  return Object.entries(grupo)
    .filter(([, { valor }]) => /^\d/.test(String(valor)))
    .map(([nome, { valor }]) => `  ${camel(nome)}: ${transformar(valor)},`)
    .join('\n');
}

const ts = `// GERADO POR tema/gerar-tema.js. Não edite à mão.
// Fonte: design-system/tokens.css, versão ${tokens.versao}, ${tokens.gerado_em}.

export const marca = {
${cores(tokens.cor.marca)}
} as const;

export const temaClaro = {
${cores(tokens.cor.claro)}
} as const;

export const temaEscuro = {
${cores(tokens.cor.escuro)}
} as const;

export type Cores = typeof temaClaro;

export const espaco = {
${numeros(tokens.espaco)}
} as const;

export const forma = {
  campo: ${px(tokens.forma['r-campo'].valor)},
  card: ${px(tokens.forma['r-card'].valor)},
  pilula: 999,
  // O raio folha do sistema: cantos opostos arredondados.
  folha: { borderTopLeftRadius: 26, borderTopRightRadius: 5, borderBottomRightRadius: 26, borderBottomLeftRadius: 5 },
  botao: { sm: ${px(tokens.forma['btn-sm'].valor)}, md: ${px(tokens.forma['btn-md'].valor)}, lg: ${px(tokens.forma['btn-lg'].valor)} },
  toqueMinimo: ${px(tokens.forma['toque-min'].valor)},
} as const;

export const fontes = {
  display: 'YoungSerif_400Regular',
  leitura: 'SourceSerif4_400Regular',
  leituraLeve: 'SourceSerif4_300Light',
  ui: 'Figtree_400Regular',
  uiMedio: 'Figtree_500Medium',
  uiForte: 'Figtree_600SemiBold',
} as const;

export const tipo = {
  d1: { fontSize: 48, lineHeight: 50, fontFamily: fontes.display },
  d2: { fontSize: 36, lineHeight: 40, fontFamily: fontes.display },
  d3: { fontSize: 28, lineHeight: 32, fontFamily: fontes.display },
  d4: { fontSize: 22, lineHeight: 28, fontFamily: fontes.display },
  l1: { fontSize: 19, lineHeight: 31, fontFamily: fontes.leituraLeve },
  l2: { fontSize: 17, lineHeight: 27, fontFamily: fontes.leitura },
  l3: { fontSize: 15, lineHeight: 23, fontFamily: fontes.leitura },
  u1: { fontSize: 16, lineHeight: 25, fontFamily: fontes.ui },
  u2: { fontSize: 15, lineHeight: 21, fontFamily: fontes.uiForte },
  u3: { fontSize: 13, lineHeight: 19, fontFamily: fontes.ui },
  u4: { fontSize: 11, lineHeight: 15, letterSpacing: 1.3, fontFamily: fontes.uiForte },
} as const;

// Reanimated trabalha com mola, não com curva de bézier. Estes três valores
// são a tradução dos tokens --t-rapido, --t-padrao e --t-crescer, calibrados
// para dar a mesma sensação: nada pisca, nada salta.
export const movimento = {
  rapido: { damping: 22, stiffness: 320, mass: 0.7 },
  padrao: { damping: 20, stiffness: 190, mass: 0.9 },
  crescer: { damping: 18, stiffness: 90, mass: 1.1 },
  // Duração para quem precisa de withTiming em vez de mola.
  msRapido: 160,
  msPadrao: 240,
  msCrescer: 640,
} as const;
`;

fs.writeFileSync(destino, ts);
console.log(`tema.ts gerado a partir de ${path.basename(origem)}, versão ${tokens.versao}.`);
