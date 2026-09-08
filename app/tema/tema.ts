// GERADO POR tema/gerar-tema.js. Não edite à mão.
// Fonte: design-system/tokens.css, versão 1.2.1, 2026-09-03.

export const marca = {
    musgo: '#2F5A43',
    broto: '#6FA97F',
    latao: '#A8761F',
    lataoTexto: '#8E641A',
    terra: '#9C4F3B',
    orvalho: '#EDF0E7',
    papel: '#F8F9F4',
    noite: '#101610',
    nevoa: '#C9D2C2',
} as const;

export const temaClaro = {
    bg: '#EDF0E7',
    surface: '#F8F9F4',
    surface2: '#E3E9DE',
    line: '#CFD8C8',
    ink: '#141A14',
    ink2: '#3C4A3E',
    ink3: '#626F63',
    brand: '#2F5A43',
    brandForte: '#25462F',
    brandSoft: '#DCE7DC',
    onBrand: '#F8F9F4',
    accent: '#8E641A',
    accentFill: '#A8761F',
    accentSoft: '#F1E5CB',
    onAccentSoft: '#7F5915',
    onAccentFill: '#101610',
    alert: '#9C4F3B',
    alertSoft: '#F2DED7',
    foco: '#A8761F',
    overlay: 'rgba(16, 22, 16, .55)',
    offBg: '#E3E9DE',
    offInk: '#8C978C',
} as const;

export const temaEscuro = {
    bg: '#101610',
    surface: '#19201A',
    surface2: '#222A22',
    line: '#313A30',
    ink: '#E7ECE3',
    ink2: '#BCC7B9',
    ink3: '#8B978B',
    brand: '#7FB894',
    brandForte: '#9BCCAD',
    brandSoft: '#1E2C22',
    onBrand: '#101610',
    accent: '#DDAE55',
    accentFill: '#DDAE55',
    accentSoft: '#2C2413',
    onAccentSoft: '#DDAE55',
    onAccentFill: '#101610',
    alert: '#DD8974',
    alertSoft: '#331C16',
    foco: '#DDAE55',
    overlay: 'rgba(0, 0, 0, .65)',
    offBg: '#222A22',
    offInk: '#6E7A6E',
} as const;

export type Cores = typeof temaClaro;

export const espaco = {
  e1: 4,
  e2: 8,
  e3: 12,
  e4: 16,
  e5: 24,
  e6: 32,
  e7: 48,
  e8: 72,
} as const;

export const forma = {
  campo: 8,
  card: 14,
  pilula: 999,
  // O raio folha do sistema: cantos opostos arredondados.
  folha: { borderTopLeftRadius: 26, borderTopRightRadius: 5, borderBottomRightRadius: 26, borderBottomLeftRadius: 5 },
  botao: { sm: 36, md: 44, lg: 52 },
  toqueMinimo: 44,
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
