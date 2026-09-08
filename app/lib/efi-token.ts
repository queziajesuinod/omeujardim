// Tokenização do cartão — versão nativa (stub). O alvo inicial é o PWA, então a
// tokenização real vive em efi-token.web.ts. No app nativo (loja, depois), entra
// a biblioteca nativa da Efí. Até lá, avisamos com honestidade.

export type Cartao = {
  numero: string;
  cvv: string;
  mesValidade: string;  // MM
  anoValidade: string;  // AAAA
  nome: string;         // titular, como impresso no cartão
  documento: string;    // CPF só dígitos
  bandeira?: string;    // visa, mastercard...
};

export async function tokenizarCartao(_c: Cartao): Promise<{ payment_token: string; mascara: string }> {
  throw new Error('Pagamento por cartão está disponível na versão web por ora.');
}
