// Voltar seguro. router.back() estoura o aviso "GO_BACK não tratado" quando a
// tela foi aberta direto por URL (deep link) ou via replace, sem pilha. Aqui a
// gente confere se há para onde voltar; se não, cai numa tela padrão.

import { router } from 'expo-router';

export function voltar(padrao: string = '/hoje') {
  if (router.canGoBack()) router.back();
  else router.replace(padrao as never);
}
