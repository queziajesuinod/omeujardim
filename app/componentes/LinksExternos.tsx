// Links externos de um dia da trilha (vídeo, música, algo fora do app). Viram
// botões no padrão da marca, com o ícone de "abre fora", e abrem no navegador
// ou app externo. O rótulo e a URL vêm da autoria da trilha.

import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useCores } from '../lib/tema-contexto';
import { espaco, forma, tipo } from '../tema/tema';
import type { TrilhaLink } from '../lib/trilhas';

export function LinksExternos({ links }: { links?: TrilhaLink[] }) {
  const c = useCores();
  if (!links || links.length === 0) return null;

  return (
    <View style={{ gap: espaco.e2, marginTop: espaco.e3 }}>
      {links.map((l, i) => (
        <Pressable
          key={`${l.url}-${i}`}
          accessibilityRole="link"
          accessibilityLabel={l.rotulo}
          onPress={() => Linking.openURL(l.url).catch(() => {})}
          style={[estilos.botao, { borderColor: c.brand }]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M14 4h6v6M20 4l-8 8M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"
              stroke={c.brand} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[tipo.u2, { color: c.brand }]} numberOfLines={1}>{l.rotulo}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco.e2,
    borderWidth: 1.5, borderRadius: forma.pilula, minHeight: forma.botao.md, paddingHorizontal: espaco.e4,
  },
});
