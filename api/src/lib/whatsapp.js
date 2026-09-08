// ---------------------------------------------------------------------------
// Lembrete por WhatsApp — a alternativa para quem não instala o PWA.
//
// O envio de verdade exige um provedor (Meta Cloud API ou Twilio) com número
// aprovado e template registrado. Esse provedor NÃO está ligado neste
// ambiente. Enquanto WHATSAPP_TOKEN não existir, a função não finge: ela
// devolve 'sem_provedor' e registra a intenção, para o dia em que ligarmos.
//
// Duas regras que não se dobram, independentes de provedor:
//  1. Nada do diário na mensagem. O corpo vem de lib/lembrete.js, que já cuida.
//  2. Saída em TODA mensagem. Opt-in não vale nada sem saída fácil.
// ---------------------------------------------------------------------------

const SAIDA = 'Para parar, responda SAIR.';

/** Monta o texto final, sempre com a linha de saída. */
function montarMensagem(corpo) {
  return `${corpo}\n\n${SAIDA}`;
}

/**
 * Entrega (ou registra a intenção de entregar) um lembrete por WhatsApp.
 * Devolve { estado, texto }: 'enviado', 'sem_provedor' ou 'erro'.
 */
async function enviar(numero, corpo) {
  const texto = montarMensagem(corpo);

  if (!process.env.WHATSAPP_TOKEN) {
    return { estado: 'sem_provedor', texto };
  }

  // Quando houver provedor, o POST vai aqui. Mantido explícito de propósito:
  // ligar o WhatsApp é uma decisão de produto (custo por mensagem, aprovação
  // de template), não um detalhe de implementação para deixar meio pronto.
  return { estado: 'sem_provedor', texto };
}

module.exports = { enviar, montarMensagem };
