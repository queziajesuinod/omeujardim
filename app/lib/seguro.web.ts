// Versão web de lib/seguro.ts. O Metro escolhe este arquivo sozinho quando
// a plataforma é web, pela extensão .web.ts. A interface é a mesma, o que
// muda é onde a credencial mora.
//
// A diferença que importa: na web NÃO existe token guardado pelo app.
// O acesso e o refresh vivem em cookie httpOnly, que o JavaScript não lê,
// justamente para que um XSS não consiga roubar a sessão e usá-la depois.
// O que o front guarda é só o token de CSRF, que sozinho não vale nada.

let csrfEmMemoria: string | null = null;

/** Na web, o servidor já gravou os cookies. Guardamos só o token de CSRF. */
export async function guardarSessao(_acesso: string, _refresh: string) {
  // Nada a fazer: quem manda o cookie é o servidor, e ele é httpOnly.
}

export function guardarCsrf(token: string) {
  csrfEmMemoria = token;
}

/**
 * Lê o token de CSRF. Em memória primeiro, e o cookie como reserva para o
 * caso de a aba ter sido recarregada.
 */
export function lerCsrf(): string | null {
  if (csrfEmMemoria) return csrfEmMemoria;
  const achado = document.cookie.split('; ').find((c) => c.startsWith('jd_csrf='));
  return achado ? decodeURIComponent(achado.split('=')[1]) : null;
}

/** Não há token para ler: quem autentica é o cookie enviado pelo navegador. */
export async function lerAcesso() {
  return null;
}

export async function lerRefresh() {
  return null;
}

export async function limparSessao() {
  csrfEmMemoria = null;
  // Quem apaga os cookies httpOnly é o servidor, em POST /v1/auth/sair.
}

/**
 * Biometria não existe na web. Devolver true mantém a mesma assinatura da
 * versão nativa sem travar o acesso ao diário no navegador.
 *
 * Consequência de produto que precisa aparecer na interface: quem usa pela
 * web e divide o computador não tem a trava do diário. Diga isso na tela de
 * ajustes, em vez de deixar a pessoa supor que a proteção existe.
 */
export async function destravarDiario(_motivo?: string): Promise<boolean> {
  return true;
}
