const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './testes',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  snapshotPathTemplate: '{testDir}/referencias/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      // 0.2 é o padrão e deixa passar mudança de cor sutil. 0.1 é mais rígido.
      threshold: 0.1,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    colorScheme: 'light', // o tema vem do parâmetro ?tema=, não da preferência do SO
    deviceScaleFactor: 1,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // CHROMIUM_PATH permite usar um Chromium já instalado na máquina,
          // em vez de baixar outro. No CI fica vazio e o Playwright usa o dele.
          executablePath: process.env.CHROMIUM_PATH || undefined,
          // deixa a renderização de fonte determinística entre máquinas
          args: ['--font-render-hinting=none', '--disable-lcd-text'],
        },
      },
    },
  ],
});
