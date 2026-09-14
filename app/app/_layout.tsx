// Raiz do app. Carrega as fontes da marca, monta o tema e só então mostra a
// navegação. Sem esperar a fonte, a primeira tela pisca em Arial e depois
// troca, o que é exatamente o tipo de sobressalto que a marca não faz.

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { YoungSerif_400Regular } from '@expo-google-fonts/young-serif';
import { SourceSerif4_300Light, SourceSerif4_400Regular } from '@expo-google-fonts/source-serif-4';
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree';
import { ProvedorTema, useCores } from '../lib/tema-contexto';
import { ProvedorAviso } from '../lib/aviso';
import { ProvedorSessao, useSessao } from '../lib/sessao';
import { useAssinatura } from '../lib/assinatura';
import { iniciarCapturaInstalar } from '../lib/lembrete';
import { carregarInicioDia } from '../lib/inicio-dia';

SplashScreen.preventAutoHideAsync();

// Uma instância por app. Remontar a cada render jogaria o cache fora.
const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      // Rede de celular cai o tempo todo; tentar de novo uma vez basta, e não
      // deixa a tela presa em "carregando" quando o servidor respondeu 4xx.
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Navegacao() {
  const c = useCores();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        // Transição nativa, sem customizar. Ver seção 07 do manual.
        animation: 'simple_push',
      }}
    >
      {/* Anotar é uma folha que sobe sobre a tela anterior, como no mockup. */}
      <Stack.Screen
        name="anotar"
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack>
  );
}

// Guarda de rota. Sem sessão, só entrar e cadastro são acessíveis; com sessão,
// essas duas somem do caminho. Enquanto ainda descobrimos (autenticado null),
// segura na splash em vez de piscar a tela errada.
function Guarda() {
  const { autenticado } = useSessao();
  const assinatura = useAssinatura();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (autenticado === null) return;
    const raiz = segments[0];
    const emAuth = raiz === 'entrar' || raiz === 'cadastro';
    const emAssinatura = raiz === 'assinar' || raiz === 'reativar';
    // Páginas públicas: a landing (porta de venda, divulgada no Instagram) e os
    // textos legais (as lojas exigem uma URL pública). Não mudam a raiz: quem
    // abre '/' segue indo ao app.
    const emPublico = emAuth || raiz === 'inicio' || raiz === 'termos' || raiz === 'privacidade';

    if (!autenticado) {
      if (!emPublico) router.replace('/entrar');
      return;
    }
    // Autenticado numa tela de entrada: volta para o app.
    if (emAuth) { router.replace('/hoje'); return; }

    // Gate de assinatura. Espera o estado carregar para não decidir errado.
    if (assinatura.isLoading || !assinatura.data) return;
    const { usavel, motivo } = assinatura.data;
    if (!usavel) {
      // Encerrada leva a reativar; o resto (sem assinatura, trial não iniciado,
      // pagamento pendente) leva a assinar.
      if (!emAssinatura) router.replace(motivo === 'encerrada' ? '/reativar' : '/assinar');
    } else if (raiz === 'reativar') {
      // Quem é usável não tem o que fazer no reengajamento. Já /assinar é
      // permitido de propósito: quem está em teste pode entrar para pagar antes
      // do vencimento, e quem é ativo para confirmar novo preço ou trocar a forma
      // de pagamento. A própria tela devolve ao app quando o pagamento entra.
      router.replace('/hoje');
    }
  }, [autenticado, segments, assinatura.data, assinatura.isLoading]);

  useEffect(() => {
    if (autenticado !== null) SplashScreen.hideAsync();
  }, [autenticado]);

  if (autenticado === null) return null;
  return <Navegacao />;
}

export default function Raiz() {
  const [fontesProntas] = useFonts({
    YoungSerif_400Regular,
    SourceSerif4_300Light,
    SourceSerif4_400Regular,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
  });

  // Segura o balão de "instalar app" do navegador para oferecer na hora certa
  // (depois da terceira rega), em vez de deixá-lo aparecer na primeira visita.
  useEffect(() => { iniciarCapturaInstalar(); }, []);

  // Aplica a hora de início do dia salva, antes de qualquer cálculo de rega.
  useEffect(() => { carregarInicioDia(); }, []);

  // A splash só sai quando a fonte carregou E a sessão foi decidida (a Guarda
  // cuida da segunda parte). Sem a fonte, a primeira tela piscaria em Arial.
  if (!fontesProntas) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={cliente}>
        <ProvedorSessao>
          <ProvedorTema>
            <ProvedorAviso>
              <Guarda />
            </ProvedorAviso>
          </ProvedorTema>
        </ProvedorSessao>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
