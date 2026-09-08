// Renderiza o mini devocional do dia: a sequência de blocos, na ordem em que
// a autora escreveu. Só o bloco de referência ganha a caixa cor de terra; texto
// é texto corrido; link vira botão que abre fora.

import { View, Text, StyleSheet } from 'react-native';
import { useCores } from '../lib/tema-contexto';
import { LinksExternos } from './LinksExternos';
import { espaco, forma, tipo, fontes } from '../tema/tema';
import type { Bloco } from '../lib/trilhas';

export function BlocosTrilha({ blocos }: { blocos: Bloco[] }) {
  const c = useCores();
  return (
    <View style={{ gap: espaco.e3 }}>
      {blocos.map((b, i) => {
        if (b.tipo === 'texto') {
          return <Text key={i} style={[estilos.texto, { color: c.ink2 }]}>{b.texto}</Text>;
        }
        if (b.tipo === 'referencia') {
          return (
            <View key={i} style={[estilos.versiculo, { backgroundColor: c.accentSoft }]}>
              {b.texto ? <Text style={[estilos.texto, { color: c.ink }]}>{b.texto}</Text> : null}
              <Text style={[tipo.u4, { color: c.accent, marginTop: b.texto ? espaco.e2 : 0 }]}>{b.ref.toUpperCase()}</Text>
            </View>
          );
        }
        if (b.tipo === 'link') {
          return <LinksExternos key={i} links={[{ rotulo: b.rotulo, url: b.url }]} />;
        }
        return null;
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  texto: { fontFamily: fontes.leituraLeve, fontSize: 17, lineHeight: 27 },
  versiculo: { padding: espaco.e4, borderRadius: forma.card },
});
