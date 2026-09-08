// Versão web de lib/preferencia.ts. O Metro escolhe este arquivo sozinho na
// web, pela extensão .web.ts.
//
// Aqui localStorage é adequado: tema é preferência de interface, não credencial.
// A regra de nunca guardar TOKEN em localStorage continua valendo, e é cumprida
// em lib/seguro.web.ts, onde a sessão vive em cookie httpOnly.

export async function lerPreferencia(chave: string): Promise<string | null> {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export async function gravarPreferencia(chave: string, valor: string): Promise<void> {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    // localStorage pode estar indisponível (aba anônima com cookies bloqueados).
    // Sem drama: o tema apenas volta ao padrão na próxima abertura.
  }
}
