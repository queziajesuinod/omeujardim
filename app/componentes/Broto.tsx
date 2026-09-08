// O broto da marca, o símbolo do app. Caule e duas folhas, desenhado uma vez
// e tingido pelo tema (não tem hex aqui). Traçados vindos de
// assets/svg/broto-mono.svg, inline para funcionar em web e nativo sem
// transformer de SVG.

import Svg, { Path } from 'react-native-svg';

export function Broto({ tamanho = 64, cor }: { tamanho?: number; cor: string }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 64 64" accessibilityLabel="broto">
      <Path d="M32 55 V38" fill="none" stroke={cor} strokeWidth={5} strokeLinecap="round" />
      <Path d="M30.6 41 C 20 40.5, 14.6 33, 15.6 23 C 26 24, 31.6 31, 30.6 41 Z" fill={cor} />
      <Path d="M33.4 41 C 44 40.5, 49.4 33, 48.4 23 C 38 24, 32.4 31, 33.4 41 Z" fill={cor} />
    </Svg>
  );
}
