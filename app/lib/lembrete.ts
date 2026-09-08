// Versão nativa do lembrete. Nesta fatia, o lembrete é Web Push (PWA), então no
// app nativo ele ainda não existe — e a gente diz isso em vez de fingir um
// botão que não faz nada. Quando entrar o expo-notifications, é aqui que mora.
//
// A web tem a implementação de verdade em lembrete.web.ts; o Metro escolhe pela
// extensão. Toda a interface pública é a mesma, para a tela não precisar saber
// em qual plataforma está.

export type EstadoLembrete = 'ligado' | 'desligado' | 'negado' | 'indisponivel';

export const suportaPush = false;

export async function estadoLembrete(): Promise<EstadoLembrete> {
  return 'indisponivel';
}

export async function ligarLembrete(): Promise<EstadoLembrete> {
  return 'indisponivel';
}

export async function desligarLembrete(): Promise<void> {}

export function podeInstalar(): boolean {
  return false;
}

export async function instalar(): Promise<boolean> {
  return false;
}

export function iniciarCapturaInstalar(): void {}

export async function ligarWhatsapp(numero: string): Promise<void> {
  const { chamar } = await import('./api');
  await chamar('/v1/lembretes/whatsapp', 'PUT', { numero });
}

export async function desligarWhatsapp(): Promise<void> {
  const { chamar } = await import('./api');
  await chamar('/v1/lembretes/whatsapp', 'DELETE');
}
