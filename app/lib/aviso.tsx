// Aviso passageiro (toast). Uma linha curta que confirma uma ação e some
// sozinha — "Regado", por exemplo.
//
// Por que na raiz do app: quem rega numa folha que se fecha (anotar) precisa
// ver a confirmação na tela seguinte. Se o aviso morasse na folha, ele sumiria
// junto com ela antes de aparecer. Aqui ele sobrevive à troca de tela.
//
// Sem emoji e sem exclamação, como todo texto de sistema (ver CLAUDE.md). Toda
// animação passa por useMovimentoReduzido.

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useCores, useMovimentoReduzido } from './tema-contexto';
import { espaco, forma, movimento, tipo } from '../tema/tema';

type Opcoes = { duracaoMs?: number };
type Avisar = (mensagem: string, opcoes?: Opcoes) => void;
const Contexto = createContext<Avisar>(() => {});

// Confirmação some rápido; erro precisa de mais tempo para ser lido.
const DURACAO_PADRAO = 2600;

/** Chame `avisar('Regado')` de qualquer tela. Erros: `avisar(msg, { duracaoMs })`. */
export function useAviso() {
  return useContext(Contexto);
}

export function ProvedorAviso({ children }: { children: React.ReactNode }) {
  const c = useCores();
  const reduzido = useMovimentoReduzido();
  const insets = useSafeAreaInsets();
  const [mensagem, setMensagem] = useState('');
  const opacidade = useSharedValue(0);
  const desloca = useSharedValue(-8);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  const avisar = useCallback<Avisar>((texto, opcoes) => {
    setMensagem(texto);
    // Leitor de tela: sem isto, VoiceOver/TalkBack nunca leem o aviso — a camada
    // é pointerEvents=none e o texto entra e sai sem receber foco. Como alguns
    // erros de sistema só existem como aviso, eles precisam ser falados.
    AccessibilityInfo.announceForAccessibility(texto);
    if (relogio.current) clearTimeout(relogio.current);
    opacidade.value = reduzido ? 1 : withTiming(1, { duration: movimento.msPadrao });
    desloca.value = reduzido ? 0 : withTiming(0, { duration: movimento.msPadrao });
    relogio.current = setTimeout(() => {
      opacidade.value = reduzido ? 0 : withTiming(0, { duration: movimento.msPadrao });
      desloca.value = reduzido ? -8 : withTiming(-8, { duration: movimento.msPadrao });
    }, opcoes?.duracaoMs ?? DURACAO_PADRAO);
  }, [reduzido, opacidade, desloca]);

  const animado = useAnimatedStyle(() => ({
    opacity: opacidade.value,
    transform: [{ translateY: desloca.value }],
  }));

  return (
    <Contexto.Provider value={avisar}>
      {children}
      {/* pointerEvents none: o aviso nunca rouba o toque da tela por baixo. */}
      <View pointerEvents="none" style={[estilos.camada, { top: insets.top + espaco.e3 }]}>
        <Animated.View style={[estilos.pilula, { backgroundColor: c.ink }, animado]}>
          <Text style={[tipo.u3, { color: c.bg, letterSpacing: 0 }]} numberOfLines={2}>{mensagem}</Text>
        </Animated.View>
      </View>
    </Contexto.Provider>
  );
}

const estilos = StyleSheet.create({
  camada: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: espaco.e5 },
  pilula: {
    borderRadius: forma.pilula,
    paddingVertical: espaco.e3,
    paddingHorizontal: espaco.e5,
    maxWidth: 440,
  },
});
