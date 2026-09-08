// Tokenização do cartão na WEB, pelo Efí.js (pacote payment-token-efi). O
// número, o CVV e a validade vão direto do navegador para a Efí, que devolve um
// `payment_token`. O nosso servidor nunca vê o cartão — só o token. Isso nos
// mantém fora do escopo pesado de PCI. Ver PLANO-ASSINATURAS.md.
//
// O identificador de conta (payee code) é PÚBLICO e vem de EXPO_PUBLIC_EFI_*.

export type Cartao = {
  numero: string;
  cvv: string;
  mesValidade: string;  // MM
  anoValidade: string;  // AAAA
  nome: string;         // titular, como impresso no cartão
  documento: string;    // CPF só dígitos
  bandeira?: string;    // visa, mastercard, elo...
};

const PAYEE = process.env.EXPO_PUBLIC_EFI_PAYEE_CODE || '';
const AMBIENTE = process.env.EXPO_PUBLIC_EFI_SANDBOX === 'false' ? 'production' : 'sandbox';

export async function tokenizarCartao(c: Cartao): Promise<{ payment_token: string; mascara: string }> {
  if (!PAYEE || PAYEE === 'troque') {
    throw new Error('Configuração de pagamento ausente (EXPO_PUBLIC_EFI_PAYEE_CODE).');
  }
  const mod = await import('payment-token-efi');
  const EfiPay: any = (mod as any).default || mod;
  const numero = c.numero.replace(/\s/g, '');

  const bandeira = c.bandeira || (await EfiPay.CreditCard
    .setAccount(PAYEE).setEnvironment(AMBIENTE).setCardNumber(numero).verifyCardBrand());

  const resultado = await EfiPay.CreditCard
    .setAccount(PAYEE)
    .setEnvironment(AMBIENTE)
    .setCreditCardData({
      brand: bandeira,
      number: numero,
      cvv: c.cvv,
      expirationMonth: c.mesValidade,
      expirationYear: c.anoValidade,
      holderName: c.nome,
      holderDocument: c.documento,
      reuse: true, // recorrência: o token pode ser reusado pela assinatura
    })
    .getPaymentToken();

  if (resultado?.error || !resultado?.payment_token) {
    throw new Error(resultado?.error_description || 'Não consegui validar o cartão. Confira os dados.');
  }
  return { payment_token: resultado.payment_token, mascara: resultado.card_mask };
}
