// UUIDv7 no celular, sem depender de biblioteca nativa.
//
// Precisa gerar id no aparelho porque o app grava offline e só depois
// sincroniza. O id nasce junto com o registro, não quando a rede volta.

import * as Crypto from 'expo-crypto';

/**
 * UUIDv7 conforme a RFC 9562:
 * 48 bits de timestamp em milissegundos, 4 bits de versão, 12 bits aleatórios,
 * 2 bits de variante e 62 bits aleatórios.
 * O resultado é ordenável no tempo, o que dá índice saudável no Postgres.
 */
export function uuidv7(): string {
  const bytes = Crypto.getRandomBytes(16);
  const ms = Date.now();

  // timestamp nos 6 primeiros bytes, big-endian
  bytes[0] = (ms / 2 ** 40) & 0xff;
  bytes[1] = (ms / 2 ** 32) & 0xff;
  bytes[2] = (ms / 2 ** 24) & 0xff;
  bytes[3] = (ms / 2 ** 16) & 0xff;
  bytes[4] = (ms / 2 ** 8) & 0xff;
  bytes[5] = ms & 0xff;

  bytes[6] = (bytes[6] & 0x0f) | 0x70; // versão 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** O instante embutido no id, útil para ordenar sem consultar o servidor. */
export function instanteDoId(id: string): Date {
  return new Date(parseInt(id.replace(/-/g, '').slice(0, 12), 16));
}

// A hora em que o dia devocional começa, configurável em Ajustes. Fica num
// módulo mutável para diaDevocional() ler sem parâmetro em toda chamada; quem
// muda (lib/inicio-dia) atualiza aqui e persiste no aparelho.
let horaInicio = 4;

export function definirInicioDia(hora: number): void {
  if (Number.isInteger(hora) && hora >= 0 && hora <= 23) horaInicio = hora;
}

export function inicioDiaAtual(): number {
  return horaInicio;
}

/**
 * O dia devocional da pessoa, que começa às 4h (por padrão) no fuso dela.
 * Quem ora 23h50 e quem ora 00h10 precisa cair no mesmo dia.
 */
export function diaDevocional(agora = new Date(), inicioHora = horaInicio): string {
  const d = new Date(agora);
  if (d.getHours() < inicioHora) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
