// Botão do design system em React Native.
// Todos os estados do manual: repouso, pressionado, foco, desabilitado, carregando.
// Nenhum valor literal: tudo vem de tema.ts, que vem de tokens.css.

import React from 'react';
import { ActivityIndicator, Pressable, Text, StyleSheet, AccessibilityInfo, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { espaco, forma, movimento, tipo } from '../tema/tema';
import { useCores, useMovimentoReduzido } from '../lib/tema-contexto';

const PressableAnimado = Animated.createAnimatedComponent(Pressable);

type Props = {
  children: string;
  onPress?: () => void;
  variante?: 'primario' | 'vazado' | 'quieto';
  tamanho?: 'sm' | 'md' | 'lg';
  bloco?: boolean;
  carregando?: boolean;
  desabilitado?: boolean;
  /** Só ligue em ação de gravar. Vibrar em tudo cansa. */
  haptico?: boolean;
  rotulo?: string;
};

export function Botao({
  children, onPress, variante = 'primario', tamanho = 'md',
  bloco, carregando, desabilitado, haptico, rotulo,
}: Props) {
  const c = useCores();
  const reduzido = useMovimentoReduzido();
  const escala = useSharedValue(1);

  const inativo = desabilitado || carregando;

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  const fundo = {
    primario: inativo ? c.offBg : c.brand,
    vazado: 'transparent',
    quieto: c.surface2,
  }[variante];

  const tinta = {
    primario: inativo ? c.offInk : c.onBrand,
    vazado: inativo ? c.offInk : c.brand,
    quieto: c.ink2,
  }[variante];

  return (
    <PressableAnimado
      accessibilityRole="button"
      accessibilityLabel={rotulo ?? children}
      accessibilityState={{ disabled: !!inativo, busy: !!carregando }}
      disabled={inativo}
      hitSlop={tamanho === 'sm' ? 4 : 0}  // o pequeno tem 36px, o toque precisa de 44
      onPressIn={() => {
        // Recuo de 2%: perceptível no dedo, invisível como movimento.
        escala.value = reduzido ? 1 : withSpring(0.98, movimento.rapido);
      }}
      onPressOut={() => {
        escala.value = reduzido ? 1 : withSpring(1, movimento.rapido);
      }}
      onPress={() => {
        if (haptico) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={[
        estilos.base,
        {
          backgroundColor: fundo,
          borderColor: variante === 'vazado' ? (inativo ? c.offBg : c.brand) : 'transparent',
          minHeight: forma.botao[tamanho],
          paddingHorizontal: tamanho === 'sm' ? espaco.e4 : espaco.e5,
          alignSelf: bloco ? 'stretch' : 'flex-start',
        },
        animado,
      ]}
    >
      {carregando && <ActivityIndicator size="small" color={tinta} style={{ marginRight: espaco.e2 }} />}
      <Text style={[tipo.u2, { color: tinta, fontSize: tamanho === 'sm' ? 13 : tamanho === 'lg' ? 17 : 15 }]}>
        {children}
      </Text>
    </PressableAnimado>
  );
}

const estilos = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: forma.pilula,
    borderWidth: 1.5,
  },
});
