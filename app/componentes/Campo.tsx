// Campo de texto do design system. Rótulo em cima, dica de erro embaixo.
// Quando é senha (secureTextEntry), ganha o botão de olho para revelar.
// Nenhum valor literal: cor, espaço e forma vêm de tema.ts.

import React, { useState } from 'react';
import { TextInput, Text, View, Pressable, StyleSheet, type TextInputProps } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { espaco, forma, tipo } from '../tema/tema';
import { useCores } from '../lib/tema-contexto';

type Props = TextInputProps & {
  rotulo: string;
  erro?: string;
};

function IconeOlho({ aberto, cor }: { aberto: boolean; cor: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={cor} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={12} r={3} stroke={cor} strokeWidth={1.75} />
      {!aberto ? <Line x1={3} y1={3} x2={21} y2={21} stroke={cor} strokeWidth={1.75} strokeLinecap="round" /> : null}
    </Svg>
  );
}

export function Campo({ rotulo, erro, style, secureTextEntry, ...resto }: Props) {
  const c = useCores();
  const [focado, setFocado] = useState(false);
  const [revelado, setRevelado] = useState(false);
  const ehSenha = !!secureTextEntry;

  return (
    <View style={{ gap: espaco.e1 }}>
      <Text style={[tipo.u3, { color: c.ink2 }]}>{rotulo}</Text>
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          placeholderTextColor={c.ink3}
          secureTextEntry={ehSenha && !revelado}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          style={[
            estilos.campo,
            tipo.u1,
            {
              backgroundColor: c.surface,
              color: c.ink,
              // Estado nunca é só cor: o erro engrossa o traço além de tingi-lo.
              borderColor: erro ? c.alert : focado ? c.foco : c.line,
              borderWidth: erro || focado ? 1.5 : 1,
            },
            ehSenha ? { paddingRight: 48 } : null,
            style,
          ]}
          {...resto}
        />
        {ehSenha ? (
          <Pressable
            onPress={() => setRevelado((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={revelado ? 'Ocultar senha' : 'Mostrar senha'}
            hitSlop={8}
            style={estilos.olho}
          >
            <IconeOlho aberto={revelado} cor={c.ink3} />
          </Pressable>
        ) : null}
      </View>
      {erro ? <Text style={[tipo.u3, { color: c.alert }]}>{erro}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: {
    borderRadius: forma.campo,
    paddingHorizontal: espaco.e4,
    minHeight: forma.toqueMinimo,
  },
  olho: {
    position: 'absolute', right: espaco.e3, height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
});
