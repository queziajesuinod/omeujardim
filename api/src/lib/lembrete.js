// ---------------------------------------------------------------------------
// Espalhamento do lembrete diário.
//
// O erro que parece certo: "o lembrete é às 6h, então mando todo mundo às 6h".
//
// O que acontece de verdade: 30 mil notificações saem no mesmo segundo, o
// serviço de push limita ou enfileira, e pior, 30 mil pessoas abrem o app no
// mesmo minuto. Você mesma constrói o pico que vai derrubar o seu servidor.
// É negação de serviço feita em casa, com hora marcada.
//
// A correção é um deslocamento determinístico por pessoa, derivado do id.
// Determinístico importa: a pessoa recebe sempre no mesmo horário, então o
// lembrete continua sendo um hábito, não uma loteria.
// ---------------------------------------------------------------------------

const crypto = require('node:crypto');

/**
 * Deslocamento estável, em minutos, dentro da janela.
 * O mesmo usuário sempre recebe o mesmo deslocamento.
 */
function deslocamentoMin(usuarioId, janelaMin = 20) {
  const h = crypto.createHash('sha256').update(String(usuarioId)).digest();
  return h.readUInt16BE(0) % janelaMin;
}

/**
 * Horário real de envio para esta pessoa.
 * Janela de 20 minutos transforma um pico de 30 mil por segundo em uma média
 * de 25 por segundo, que qualquer serviço de push engole sem reclamar.
 */
function horarioDoLembrete(usuarioId, horaBase = '06:00', janelaMin = 20) {
  const [h, m] = horaBase.split(':').map(Number);
  const total = h * 60 + m + deslocamentoMin(usuarioId, janelaMin);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Divide a lista de destinatários em remessas do tamanho que o serviço aceita.
 * O Expo Push recebe até 100 mensagens por chamada.
 */
function emRemessas(lista, tamanho = 100) {
  const remessas = [];
  for (let i = 0; i < lista.length; i += tamanho) remessas.push(lista.slice(i, i + tamanho));
  return remessas;
}

/**
 * Texto do lembrete. Nunca inclui conteúdo do diário, e nunca cobra.
 * A prévia da notificação aparece na tela de bloqueio, onde qualquer pessoa
 * que pegar o celular consegue ler.
 */
const TEXTOS = [
  'A viração do dia. Seu jardim está aberto.',
  'Bom dia. Cinco minutos bastam.',
  'Seu jardim espera por você.',
  'Hora de regar.',
];

function textoDoLembrete(usuarioId, dia = new Date()) {
  const h = crypto.createHash('sha256')
    .update(`${usuarioId}:${dia.toISOString().slice(0, 10)}`)
    .digest();
  return TEXTOS[h[0] % TEXTOS.length];
}

module.exports = { deslocamentoMin, horarioDoLembrete, emRemessas, textoDoLembrete };
