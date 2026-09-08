// Guarda de credenciais e trava do diário.
//
// Regra que não se quebra: token NUNCA em AsyncStorage. AsyncStorage é um
// arquivo comum, legível em aparelho com root ou por backup. Token vai em
// SecureStore, que usa Keychain no iOS e Keystore no Android.

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const ACESSO = 'jardim.token.acesso';
const REFRESH = 'jardim.token.refresh';

/**
 * O refresh exige que o aparelho esteja desbloqueado, e não sai em backup
 * para outro aparelho. Se o celular for restaurado em outro, a sessão morre.
 */
const OPCOES_REFRESH: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function guardarSessao(acesso: string, refresh: string) {
  await SecureStore.setItemAsync(ACESSO, acesso, OPCOES_REFRESH);
  await SecureStore.setItemAsync(REFRESH, refresh, OPCOES_REFRESH);
}

export async function lerAcesso() {
  return SecureStore.getItemAsync(ACESSO, OPCOES_REFRESH);
}

export async function lerRefresh() {
  return SecureStore.getItemAsync(REFRESH, OPCOES_REFRESH);
}

export async function limparSessao() {
  await Promise.all([SecureStore.deleteItemAsync(ACESSO), SecureStore.deleteItemAsync(REFRESH)]);
}

/**
 * Trava do diário por biometria.
 * Opcional e desligada por padrão: pedir digital para abrir devocional todo dia
 * é atrito demais. Vale ligar só para quem divide o celular com outra pessoa,
 * e é justamente essa a explicação que aparece na tela de ajustes.
 */
export async function destravarDiario(motivo = 'Abrir seu diário'): Promise<boolean> {
  const temHardware = await LocalAuthentication.hasHardwareAsync();
  const temCadastro = await LocalAuthentication.isEnrolledAsync();
  if (!temHardware || !temCadastro) return true; // sem biometria, não bloqueia o acesso

  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: motivo,
    cancelLabel: 'Agora não',
    disableDeviceFallback: false,
  });
  return r.success;
}
