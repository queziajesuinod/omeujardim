// Service worker do "O meu jardim" — só o que o lembrete precisa.
//
// De propósito, NÃO faz cache offline de telas aqui. O offline do app é a fila
// de regas (IndexedDB), não um cache de HTML que envelhece e engana. Este
// worker existe para uma coisa: receber o push e mostrar a notificação.
//
// A prévia mostra apenas o texto que veio do servidor, que por construção nunca
// carrega conteúdo do diário. Ainda assim, nada de corpo sensível é montado
// aqui: se o payload vier vazio, cai num texto neutro.

self.addEventListener('install', (evento) => {
  // Assume o controle sem esperar a próxima visita.
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

// O Chrome só considera o app instalável (e dispara o beforeinstallprompt) se o
// service worker tiver um handler de fetch. Este é de PROPÓSITO um no-op: não
// chama respondWith, então a rede segue normal — sem cache de HTML (ver acima).
self.addEventListener('fetch', () => {});

self.addEventListener('push', (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch (e) {
    dados = {};
  }

  const titulo = dados.titulo || 'O meu jardim';
  const corpo = dados.corpo || 'Seu jardim está aberto.';
  const url = dados.url || '/hoje';

  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: corpo,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'lembrete-diario',        // uma por dia: uma nova substitui, não empilha
      renotify: false,
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || '/hoje';

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      // Se o app já está aberto numa aba, foca nela em vez de abrir outra.
      for (const janela of janelas) {
        if ('focus' in janela) {
          janela.navigate && janela.navigate(destino);
          return janela.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino);
    })
  );
});
