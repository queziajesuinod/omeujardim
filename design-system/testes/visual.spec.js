// Teste visual de regressão.
// Tira uma foto de cada componente, nos dois temas, e compara com a referência.
// Gere as referências no CI, nunca na sua máquina: renderização de fonte muda
// entre sistemas operacionais e isso produz diferença falsa.

const path = require('path');
const { test, expect } = require('@playwright/test');

const GALERIA = 'file://' + path.join(__dirname, '..', 'galeria.html');

const COMPONENTES = [
  'botao-variantes',
  'botao-tamanhos',
  'chip',
  'pratica',
  'campo',
  'oracao',
  'progresso',
  'navegacao',
  'aviso',
  'calendario',
  'vazio',
  'folha',
];

const TEMAS = ['claro', 'escuro'];

async function abrir(page, tema) {
  await page.goto(`${GALERIA}?tema=${tema}`);
  await page.evaluate(() => document.fonts.ready);
  // congela a roda de carregamento para a foto não sair borrada
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
}

for (const tema of TEMAS) {
  test.describe(`visual, tema ${tema}`, () => {
    for (const comp of COMPONENTES) {
      test(comp, async ({ page }) => {
        await abrir(page, tema);
        const alvo = page.locator(`[data-comp="${comp}"]`);
        await expect(alvo).toHaveScreenshot(`${comp}-${tema}.png`, { maxDiffPixelRatio: 0.01 });
      });
    }
  });
}

// Estados que só existem em interação, e por isso passam despercebidos em revisão manual
test.describe('estados de interação', () => {
  test('botão com foco visível', async ({ page }) => {
    await abrir(page, 'claro');
    await page.locator('.jd-btn').first().focus();
    await expect(page.locator('[data-comp="botao-variantes"]')).toHaveScreenshot('botao-foco.png');
  });

  test('campo de anotação com foco', async ({ page }) => {
    await abrir(page, 'claro');
    await page.locator('#a1').focus();
    await expect(page.locator('[data-comp="campo"]')).toHaveScreenshot('campo-foco.png');
  });

  test('cartão de prática com ponteiro em cima', async ({ page }) => {
    await abrir(page, 'claro');
    await page.locator('.jd-pratica').first().hover();
    await expect(page.locator('[data-comp="pratica"]')).toHaveScreenshot('pratica-hover.png');
  });
});

// A largura de 360 px com fonte em 200% é onde layout de devocional costuma quebrar
test.describe('breakpoints', () => {
  for (const [nome, largura] of [['base', 360], ['grande', 480], ['tablet', 768], ['desktop', 1024]]) {
    test(`galeria inteira em ${nome}, ${largura}px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await abrir(page, 'claro');
      await expect(page).toHaveScreenshot(`galeria-${nome}.png`, { fullPage: true, maxDiffPixelRatio: 0.01 });
    });
  }

  test('nada estoura a lateral em 360px com fonte a 200%', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await abrir(page, 'claro');
    await page.addStyleTag({ content: 'html{font-size:200%}' });
    const estoura = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(estoura, 'Algum elemento força rolagem horizontal').toBe(false);
  });
});
