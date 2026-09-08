// Máscaras de entrada, aplicadas enquanto a pessoa digita. Trabalham só com os
// dígitos, então colar com pontuação ou apagar no meio nunca quebra o formato.
// A API recebe sempre os dígitos limpos (ver soDigitos).

export function soDigitos(v: string): string {
  return (v || '').replace(/\D/g, '');
}

/** Agrupa dígitos em blocos com separadores, sem sobrar separador no fim. */
function agrupar(digitos: string, tamanhos: number[], separadores: string[]): string {
  let saida = '';
  let i = 0;
  for (let g = 0; g < tamanhos.length && i < digitos.length; g++) {
    if (g > 0) saida += separadores[g - 1];
    saida += digitos.slice(i, i + tamanhos[g]);
    i += tamanhos[g];
  }
  return saida;
}

/** CPF (000.000.000-00) até 11 dígitos; a partir de 12, CNPJ (00.000.000/0000-00). */
export function mascaraCpfCnpj(v: string): string {
  const d = soDigitos(v).slice(0, 14);
  return d.length <= 11
    ? agrupar(d, [3, 3, 3, 2], ['.', '.', '-'])
    : agrupar(d, [2, 3, 3, 4, 2], ['.', '.', '/', '-']);
}

/** Celular/telefone: (00) 00000-0000 com 11 dígitos, (00) 0000-0000 com 10. */
export function mascaraTelefone(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (!d) return '';
  const onze = d.length > 10;
  const ddd = d.slice(0, 2);
  const meio = onze ? d.slice(2, 7) : d.slice(2, 6);
  const fim = onze ? d.slice(7, 11) : d.slice(6, 10);
  let saida = '(' + ddd;
  if (d.length >= 2) saida += ') ';
  saida += meio;
  if (fim) saida += '-' + fim;
  return saida.trim();
}

/** Validade do cartão: MM/AA. */
export function mascaraValidade(v: string): string {
  const d = soDigitos(v).slice(0, 4);
  return d.length <= 2 ? d : d.slice(0, 2) + '/' + d.slice(2);
}

/** Data no formato brasileiro: DD/MM/AAAA. */
export function mascaraData(v: string): string {
  const d = soDigitos(v).slice(0, 8);
  let saida = d.slice(0, 2);
  if (d.length > 2) saida += '/' + d.slice(2, 4);
  if (d.length > 4) saida += '/' + d.slice(4, 8);
  return saida;
}

/** Número do cartão em blocos de 4. */
export function mascaraCartao(v: string): string {
  return soDigitos(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/** Converte DD/MM/AAAA para AAAA-MM-DD (o que a API espera). Vazio se incompleto. */
export function dataParaISO(v: string): string {
  const d = soDigitos(v);
  if (d.length !== 8) return '';
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}
