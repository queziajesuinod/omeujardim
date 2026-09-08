// Teste de contraste WCAG 2.1 sobre os tokens.
// Não abre navegador: lê tokens.css, resolve as variáveis e calcula a razão.
// Falha o build se alguém escurecer um fundo ou clarear um texto sem perceber.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'tokens.css'), 'utf8');

function bloco(seletor) {
  const i = CSS.indexOf(seletor);
  if (i === -1) throw new Error(`Bloco não encontrado em tokens.css: ${seletor}`);
  const ini = CSS.indexOf('{', i);
  const fim = CSS.indexOf('}', ini);
  return CSS.slice(ini + 1, fim);
}

function lerTokens(texto) {
  const mapa = {};
  for (const m of texto.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    mapa[m[1]] = m[2].trim();
  }
  return mapa;
}

const claro = lerTokens(bloco(':root {'));
const escuro = { ...claro, ...lerTokens(bloco(':root[data-tema="escuro"]')) };

function hex(tema, token) {
  let v = tema[token];
  if (!v) throw new Error(`Token ausente: ${token}`);
  let guarda = 0;
  while (v.startsWith('var(')) {
    v = tema[v.slice(4, -1).trim()];
    if (++guarda > 5) throw new Error(`Referência circular em ${token}`);
  }
  if (!/^#([0-9a-f]{6})$/i.test(v)) throw new Error(`Token ${token} não é hex de 6 dígitos: ${v}`);
  return v;
}

const lin = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const lum = (h) => {
  const n = parseInt(h.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const razao = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [rótulo, token de frente, token de fundo, mínimo]
// 4.5 = texto normal AA · 3 = texto grande e elemento de interface AA
const PARES = [
  ['texto principal sobre fundo', '--ink', '--bg', 4.5],
  ['texto principal sobre superfície', '--ink', '--surface', 4.5],
  ['texto secundário sobre fundo', '--ink-2', '--bg', 4.5],
  ['texto terciário sobre fundo', '--ink-3', '--bg', 4.5],
  ['texto terciário sobre superfície', '--ink-3', '--surface', 4.5],
  ['marca como texto sobre fundo', '--brand', '--bg', 4.5],
  ['marca como texto sobre superfície', '--brand', '--surface', 4.5],
  ['marca sobre verde claro (cartão regada, testemunho)', '--brand', '--brand-soft', 4.5],
  ['texto do botão primário', '--on-brand', '--brand', 4.5],
  ['acento como texto sobre fundo', '--accent', '--bg', 4.5],
  ['acento como texto sobre superfície', '--accent', '--surface', 4.5],
  ['acento sobre acento claro (chip)', '--on-accent-soft', '--accent-soft', 4.5],
  ['alerta sobre superfície', '--alert', '--surface', 4.5],
  ['alerta sobre alerta claro', '--alert', '--alert-soft', 4.5],
  ['anel de foco sobre fundo', '--foco', '--bg', 3],
  ['borda de marca sobre superfície', '--brand', '--surface', 3],
];

// Pares que sabidamente não servem para texto. O teste garante que continuem
// reprovando, para ninguém "promover" o broto a cor de texto sem discussão.
const PROIBIDOS_COMO_TEXTO = [['broto', '--broto', '--surface']];

for (const [nomeTema, tema] of [['claro', claro], ['escuro', escuro]]) {
  test.describe(`contraste, tema ${nomeTema}`, () => {
    for (const [rotulo, frente, fundo, minimo] of PARES) {
      test(`${rotulo} tem ao menos ${minimo}:1`, () => {
        const r = razao(hex(tema, frente), hex(tema, fundo));
        expect(
          Number(r.toFixed(2)),
          `${frente} sobre ${fundo} deu ${r.toFixed(2)}:1, mínimo ${minimo}:1`
        ).toBeGreaterThanOrEqual(minimo);
      });
    }
    // Só no tema claro: no escuro o broto tem contraste suficiente, mas continua
    // reservado a preenchimento por coerência do sistema, o que é regra de manual
    // e não de contraste.
    for (const [rotulo, frente, fundo] of (nomeTema === 'claro' ? PROIBIDOS_COMO_TEXTO : [])) {
      test(`${rotulo} continua proibido como texto`, () => {
        const r = razao(hex(tema, frente), hex(tema, fundo));
        expect(
          r,
          `${frente} agora tem ${r.toFixed(2)}:1 sobre ${fundo}. Se isso foi intencional, atualize a regra e o manual.`
        ).toBeLessThan(4.5);
      });
    }
  });
}
