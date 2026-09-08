// O cabeçalho padrão do mockup: uma linha só, com a seta de voltar (quando a
// tela veio de outra), o título em Young Serif 22, e um espaço à direita para
// uma ação — o "+" da oração, por exemplo.
//
// Telas de raiz (as que moram na barra inferior) não têm seta: entram por um
// espaçador de 8px, para o título nascer alinhado com o corpo abaixo.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useCores } from '../lib/tema-contexto';
import { tipo, forma } from '../tema/tema';

export function Cabecalho({
  titulo, aoVoltar, acao,
}: {
  titulo: string;
  aoVoltar?: () => void;
  acao?: React.ReactNode;
}) {
  const c = useCores();
  return (
    <View style={estilos.linha}>
      {aoVoltar ? (
        <Pressable onPress={aoVoltar} accessibilityRole="button" accessibilityLabel="Voltar" style={estilos.toque}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5 8 12l7 7" stroke={c.ink2} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      ) : (
        <View style={{ width: 8 }} />
      )}
      <Text style={[tipo.d4, { color: c.ink, flexGrow: 1 }]} numberOfLines={1}>{titulo}</Text>
      {acao ?? null}
    </View>
  );
}

/** Botão redondo de ação no cabeçalho: o "+" da oração e afins. */
export function AcaoMais({ aoTocar, rotulo }: { aoTocar: () => void; rotulo: string }) {
  const c = useCores();
  return (
    <Pressable onPress={aoTocar} accessibilityRole="button" accessibilityLabel={rotulo} style={[estilos.redondo, { borderColor: c.brand }]}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M12 5v14M5 12h14" stroke={c.brand} strokeWidth={1.9} strokeLinecap="round" />
      </Svg>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 44,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  toque: {
    width: forma.toqueMinimo,
    height: forma.toqueMinimo,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  redondo: {
    width: forma.toqueMinimo,
    height: forma.toqueMinimo,
    borderRadius: forma.pilula,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
