// A raiz manda direto para a tela do dia.
// Quando existir login, é aqui que entra a decisão: com sessão vai para /hoje,
// sem sessão vai para /entrar.
import { Redirect } from 'expo-router';

export default function Inicio() {
  return <Redirect href="/hoje" />;
}
