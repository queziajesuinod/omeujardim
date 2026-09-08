// Preferência de interface (por ora, o tema), guardada no aparelho.
//
// Por que não passa por lib/seguro: seguro é para credencial e diário, dado
// que não pode vazar. Tema é escolha de interface, não segredo. Misturar os
// dois faria a regra "token nunca em lugar comum" perder o sentido de tanto
// repetir. No aparelho usamos SecureStore por já estar disponível; na web,
// localStorage (ver preferencia.web.ts). A diferença mora na extensão .web.ts.

import * as SecureStore from 'expo-secure-store';

export async function lerPreferencia(chave: string): Promise<string | null> {
  return SecureStore.getItemAsync(chave);
}

export async function gravarPreferencia(chave: string, valor: string): Promise<void> {
  await SecureStore.setItemAsync(chave, valor);
}
