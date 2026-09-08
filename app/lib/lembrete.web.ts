// Lembrete na web: Web Push de verdade.
//
// O fluxo, sem mágica: pega a chave pública VAPID no servidor, pede permissão
// ao navegador (só quando a pessoa toca no botão, nunca na abertura), assina no
// PushManager e manda a assinatura para o servidor guardar. Desligar desfaz os
// dois lados.
//
// A captura do "instalar app" é o evento beforeinstallprompt, que o Chrome
// dispara uma vez e nós seguramos para oferecer no momento certo — depois da
// terceira rega, não antes.

import { chamar } from './api';

export type EstadoLembrete = 'ligado' | 'desligado' | 'negado' | 'indisponivel';

export const suportaPush =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

// A chave VAPID chega em base64url; o PushManager quer um Uint8Array.
function chaveParaBytes(base64Url: string): Uint8Array {
  const preenchimento = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + preenchimento).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(base64);
  // ArrayBuffer explícito: o PushManager tipa applicationServerKey como
  // BufferSource sobre ArrayBuffer, não sobre o ArrayBufferLike genérico.
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

async function registrar(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export async function estadoLembrete(): Promise<EstadoLembrete> {
  if (!suportaPush) return 'indisponivel';
  if (Notification.permission === 'denied') return 'negado';
  const reg = await navigator.serviceWorker.getRegistration();
  const assinatura = reg ? await reg.pushManager.getSubscription() : null;
  return assinatura ? 'ligado' : 'desligado';
}

export async function ligarLembrete(): Promise<EstadoLembrete> {
  if (!suportaPush) return 'indisponivel';

  const { ligado, chave } = await chamar('/v1/lembretes/chave');
  if (!ligado || !chave) return 'indisponivel';

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') return permissao === 'denied' ? 'negado' : 'desligado';

  const reg = (await registrar()) || (await navigator.serviceWorker.ready);
  if (!reg) return 'indisponivel';
  await navigator.serviceWorker.ready;

  const existente = await reg.pushManager.getSubscription();
  const assinatura =
    existente ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,             // exigência do navegador: todo push vira notificação visível
      applicationServerKey: chaveParaBytes(chave) as BufferSource,
    }));

  const j = assinatura.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
  await chamar('/v1/lembretes/assinatura', 'POST', { endpoint: j.endpoint, keys: j.keys });
  return 'ligado';
}

export async function desligarLembrete(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const assinatura = reg ? await reg.pushManager.getSubscription() : null;
  if (!assinatura) return;
  await chamar('/v1/lembretes/assinatura', 'DELETE', { endpoint: assinatura.endpoint }).catch(() => {});
  await assinatura.unsubscribe().catch(() => {});
}

// --- Instalar o PWA -------------------------------------------------------

let promptInstalar: any = null;

export function iniciarCapturaInstalar(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();          // segura o balão automático; a gente escolhe a hora
    promptInstalar = e;
  });
  window.addEventListener('appinstalled', () => { promptInstalar = null; });
}

export function podeInstalar(): boolean {
  return !!promptInstalar;
}

export async function instalar(): Promise<boolean> {
  if (!promptInstalar) return false;
  promptInstalar.prompt();
  const { outcome } = await promptInstalar.userChoice;
  promptInstalar = null;
  return outcome === 'accepted';
}

// --- WhatsApp -------------------------------------------------------------

export async function ligarWhatsapp(numero: string): Promise<void> {
  await chamar('/v1/lembretes/whatsapp', 'PUT', { numero });
}

export async function desligarWhatsapp(): Promise<void> {
  await chamar('/v1/lembretes/whatsapp', 'DELETE');
}
