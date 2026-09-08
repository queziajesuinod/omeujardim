// Acessibilidade automatizada com axe-core.
// Pega cerca de 40% dos problemas reais. O resto é teste manual com teclado
// e leitor de tela, descrito em VERSIONAMENTO.md.

const path = require('path');
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const GALERIA = 'file://' + path.join(__dirname, '..', 'galeria.html');

for (const tema of ['claro', 'escuro']) {
  test(`galeria sem violação de acessibilidade, tema ${tema}`, async ({ page }) => {
    await page.goto(`${GALERIA}?tema=${tema}`);
    await page.evaluate(() => document.fonts.ready);
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const resumo = r.violations.map((v) => `${v.id} (${v.nodes.length}x): ${v.help}`).join('\n');
    expect(resumo).toBe('');
  });
}

test('todo alvo de toque tem ao menos 44px de altura, exceto o botão pequeno', async ({ page }) => {
  await page.goto(GALERIA);
  const pequenos = await page.evaluate(() => {
    const fora = [];
    for (const el of document.querySelectorAll('button, a[href], textarea')) {
      if (el.classList.contains('jd-btn--sm') || el.classList.contains('jd-tag')) continue;
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 44) fora.push(`${el.className || el.tagName} tem ${Math.round(r.height)}px`);
    }
    return fora;
  });
  expect(pequenos.join('\n'), 'Alvo abaixo de 44px sem ser variante pequena declarada').toBe('');
});

test('todo botão só de ícone tem nome acessível', async ({ page }) => {
  await page.goto(GALERIA);
  const semNome = await page.evaluate(() =>
    [...document.querySelectorAll('.jd-btn--icone')]
      .filter((b) => !b.getAttribute('aria-label') && !b.textContent.trim())
      .map((b) => b.outerHTML.slice(0, 80))
  );
  expect(semNome.join('\n')).toBe('');
});

test('o estado da lista de oração não depende só de cor', async ({ page }) => {
  await page.goto(GALERIA);
  const respondida = page.locator('.jd-ora--resp');
  await expect(respondida).toContainText('Respondida em');
});
