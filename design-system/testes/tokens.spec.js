// Teste de deriva de token.
// Impede que valores literais voltem a aparecer fora de tokens.css.
// É o teste que mantém o design system sendo um sistema, e não uma pasta de CSS.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const RAIZ = path.join(__dirname, '..');
const ARQUIVOS = ['componentes.css'];

// Exceções conscientes. Qualquer adição aqui exige justificativa no CHANGELOG.
const PERMITIDO = [
  /rgba\(0,\s*0,\s*0/,           // sombra preta pura, definida só em tokens.css
  /border:\s*1(\.5)?px solid/,   // espessura de traço não é token
  /width:\s*\d+px/,              // dimensão intrínseca de componente
  /height:\s*\d+px/,
  /min-height:\s*\d+px/,
  /max-width:\s*\d+px/,
  /max-height:\s*\d+px/,
  /\d+ms linear/,                // duração da roda de carregamento
  /translateY\(1px\)/,
  /outline(-offset)?:/,
  /box-shadow:\s*0 0 0 \dpx var/,
  /@media \(min-width: \d+px\)/,
];

function linhasSuspeitas(conteudo, regex) {
  return conteudo
    .split('\n')
    .map((linha, i) => ({ n: i + 1, linha: linha.trim() }))
    .filter(({ linha }) => regex.test(linha))
    .filter(({ linha }) => !PERMITIDO.some((p) => p.test(linha)));
}

for (const arquivo of ARQUIVOS) {
  const conteudo = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');

  test(`${arquivo} não contém cor literal`, () => {
    const achados = linhasSuspeitas(conteudo, /#[0-9a-fA-F]{3,8}\b|\brgba?\(/);
    expect(
      achados.map((a) => `linha ${a.n}: ${a.linha}`).join('\n'),
      'Use um token de tokens.css em vez de escrever a cor'
    ).toBe('');
  });

  test(`${arquivo} não contém px de espaçamento fora da escala`, () => {
    const achados = linhasSuspeitas(conteudo, /(padding|margin|gap)[^:]*:\s*[^;]*\d+px/);
    expect(
      achados.map((a) => `linha ${a.n}: ${a.linha}`).join('\n'),
      'Espaçamento vem de --e1 a --e8'
    ).toBe('');
  });

  test(`${arquivo} não contém duração de transição literal`, () => {
    const achados = linhasSuspeitas(conteudo, /transition[^;]*\d+m?s/);
    expect(
      achados.map((a) => `linha ${a.n}: ${a.linha}`).join('\n'),
      'Duração vem de --t-rapido, --t-padrao ou --t-crescer'
    ).toBe('');
  });
}

test('tokens.css declara os dois temas com o mesmo conjunto de tokens semânticos', () => {
  const css = fs.readFileSync(path.join(RAIZ, 'tokens.css'), 'utf8');
  const pegar = (seletor) => {
    const i = css.indexOf(seletor);
    const ini = css.indexOf('{', i);
    const fim = css.indexOf('}', ini);
    return new Set([...css.slice(ini + 1, fim).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  };
  const escuroExplicito = pegar(':root[data-tema="escuro"]');
  const escuroSistema = pegar(':root:not([data-tema="claro"])');
  const faltando = [...escuroExplicito].filter((t) => !escuroSistema.has(t));
  const sobrando = [...escuroSistema].filter((t) => !escuroExplicito.has(t));
  expect(
    [...faltando, ...sobrando].join(', '),
    'O bloco de preferência do sistema e o de escolha explícita precisam redefinir exatamente os mesmos tokens, senão um dos caminhos renderiza meio tema'
  ).toBe('');
});
