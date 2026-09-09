// Molde do HTML de cada página no web (expo-router, saída estática). É aqui que
// controlamos o <head>: PWA (manifest + ícones + service worker) para o Chrome
// oferecer "Instalar" e criar o atalho com o ícone, e Open Graph para o link,
// quando compartilhado, vir com a logo e o título automaticamente.
//
// Só afeta a WEB. O nativo não usa este arquivo.

import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// URL pública do site, para as imagens de compartilhamento serem absolutas (o
// WhatsApp e afins não seguem caminho relativo ao raspar o link).
const SITE = 'https://omeujardim.app';
const DESC =
  'Constância em oração, leitura da Palavra e as outras disciplinas. Seu jardim é fechado: só você lê o que escreve nele.';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* PWA: instalável (Chrome/Android) e ícone na tela inicial. */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2F5A43" />
        <link rel="icon" type="image/png" href="/icone-192.png" />
        <link rel="apple-touch-icon" href="/icone-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="O meu jardim" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* Compartilhamento: logo e título automáticos no link (Open Graph + Twitter). */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="O meu jardim" />
        <meta property="og:title" content="O meu jardim" />
        <meta property="og:description" content={DESC} />
        <meta property="og:url" content={SITE} />
        <meta property="og:image" content={`${SITE}/icone-512.png`} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="O meu jardim" />
        <meta name="twitter:description" content={DESC} />
        <meta name="twitter:image" content={`${SITE}/icone-512.png`} />

        {/*
          O Chrome só oferece "Instalar" se um service worker estiver registrado.
          Hoje o SW só registrava ao ligar lembrete; aqui garantimos o registro no
          carregamento de toda visita. O sw.js tem um handler de fetch (no-op), que
          é o outro critério de instalabilidade.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function(){}); }); }`,
          }}
        />

        {/* Reset de estilo do ScrollView no web — exigido pelo expo-router. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
