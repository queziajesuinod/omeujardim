// O interruptor do mockup: uma pílula 44×26 com um botão que desliza. Ligado
// em musgo, com o botão à direita; desligado em cinza-terra, botão à esquerda.
//
// Move-se com mola curta, respeitando quem pediu menos movimento. O estado não
// é só a posição: o accessibilityRole="switch" conta o resto para o leitor.

import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useCores, useMovimentoReduzido } from '../lib/tema-contexto';
import { forma, movimento } from '../tema/tema';

export function Interruptor({ ligado, aoAlternar, rotulo }: { ligado: boolean; aoAlternar: () => void; rotulo?: string }) {
  const c = useCores();
  const reduzido = useMovimentoReduzido();

  const botao = useAnimatedStyle(() => {
    const destino = ligado ? 20 : 2; // 44 - 20 - 2 = 22 à direita; 2 à esquerda
    return { left: reduzido ? destino : withSpring(destino, movimento.rapido) };
  });

  return (
    <Pressable
      onPress={aoAlternar}
      accessibilityRole="switch"
      accessibilityState={{ checked: ligado }}
      accessibilityLabel={rotulo}
      // O trilho tem 26px de altura; o hitSlop leva o alvo de toque aos 44px
      // mínimos, importante onde o interruptor é o único controle (intercessão).
      hitSlop={{ top: 9, bottom: 9 }}
      style={[
        estilos.trilho,
        {
          backgroundColor: ligado ? c.brand : c.surface2,
          borderColor: ligado ? c.brand : c.line,
        },
      ]}
    >
      <Animated.View style={[estilos.botao, { backgroundColor: c.onBrand }, botao]} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  trilho: {
    width: 44,
    height: 26,
    borderRadius: forma.pilula,
    borderWidth: 1,
    justifyContent: 'center',
  },
  botao: {
    width: 20,
    height: 20,
    borderRadius: forma.pilula,
    position: 'absolute',
    top: 2,
  },
});
