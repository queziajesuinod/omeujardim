// Cartão de prática, o componente mais tocado do app.
//
// A animação aqui é a única do app que pode se dar ao luxo de ser notada,
// porque ela marca o momento em que a pessoa registra a rega. Ainda assim
// dura menos de 700ms e não usa confete, brilho nem som.
//
// Regras de marca aplicadas em código:
// - o cartão regado fica CHEIO de verde, nunca riscado;
// - o cartão fora do dia não usa opacity, usa traço tracejado e cor legível;
// - nada disso anima se a pessoa pediu menos movimento no sistema.

import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withSequence, withTiming, FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { espaco, forma, movimento, tipo } from '../tema/tema';
import { useCores, useMovimentoReduzido } from '../lib/tema-contexto';

type Estado = 'a-regar' | 'regada' | 'fora-do-dia';

type Props = {
  titulo: string;
  detalhe: string;
  estado: Estado;
  icone: React.ReactNode;
  onRegar?: () => void;
  onDesregar?: () => void;
};

export function CartaoPratica({ titulo, detalhe, estado, icone, onRegar, onDesregar }: Props) {
  const c = useCores();
  const reduzido = useMovimentoReduzido();
  const brotar = useSharedValue(estado === 'regada' ? 1 : 0);

  const anelAnimado = useAnimatedStyle(() => ({
    transform: [{ scale: 0.9 + brotar.value * 0.1 }],
    opacity: 0.4 + brotar.value * 0.6,
  }));

  function regar() {
    if (estado !== 'a-regar') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    brotar.value = reduzido
      ? 1
      // Cresce um pouco além e assenta. É a única "graça" visual do app.
      : withSequence(
          withSpring(1.12, movimento.rapido),
          withSpring(1, movimento.crescer),
        );
    onRegar?.();
  }

  // Tocar num cartão já regado abre o desfazer (quem confirma é a tela Hoje).
  function aoTocar() {
    if (estado === 'a-regar') regar();
    else if (estado === 'regada') onDesregar?.();
  }

  const regada = estado === 'regada';
  const fora = estado === 'fora-do-dia';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${detalhe}`}
      accessibilityState={{ selected: regada, disabled: fora }}
      accessibilityHint={estado === 'a-regar' ? 'Toque duas vezes para regar' : estado === 'regada' ? 'Toque duas vezes para desmarcar' : undefined}
      onPress={aoTocar}
      disabled={fora}
      style={({ pressed }) => [
        estilos.base,
        forma.folha,
        {
          backgroundColor: regada ? c.brandSoft : fora ? 'transparent' : c.surface,
          borderColor: regada ? 'transparent' : pressed ? c.brand : c.line,
          borderStyle: fora ? 'dashed' : 'solid',
        },
      ]}
    >
      <Animated.View
        style={[
          estilos.anel,
          { backgroundColor: regada ? c.brand : fora ? c.offBg : c.brandSoft },
          regada && anelAnimado,
        ]}
      >
        {icone}
      </Animated.View>

      <View style={estilos.texto}>
        <Text style={[tipo.u2, { color: fora ? c.ink2 : c.ink }]} numberOfLines={1}>
          {titulo}
        </Text>
        {/* Entra deslizando de baixo quando o texto muda para "regada hoje" */}
        <Animated.Text
          key={detalhe}
          entering={reduzido ? undefined : FadeIn.duration(movimento.msPadrao)}
          style={[tipo.u3, { color: regada ? c.brand : c.ink3 }]}
          numberOfLines={1}
        >
          {detalhe}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.e3,
    paddingVertical: espaco.e4,
    paddingHorizontal: espaco.e5,
    borderWidth: 1,
    minHeight: forma.toqueMinimo + espaco.e5,
  },
  anel: { width: 36, height: 36, borderRadius: forma.pilula, alignItems: 'center', justifyContent: 'center' },
  texto: { flex: 1, minWidth: 0 },
});
