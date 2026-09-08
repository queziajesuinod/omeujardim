// Assinatura encerrada. Quem cancelou (ou deixou vencer) e volta cai aqui: sem
// culpa, sem cobrança escondida — só o convite de reabrir o jardim. A conta e o
// que ela escreveu continuam guardados; nada murcha por ausência.

import { ScrollView, Text, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Botao } from '../componentes/Botao';
import { useCores } from '../lib/tema-contexto';
import { useLarguraConteudo } from '../lib/layout';
import { useSessao } from '../lib/sessao';
import { espaco, tipo, fontes } from '../tema/tema';

export default function Reativar() {
  const c = useCores();
  const maxLargura = useLarguraConteudo();
  const { sair } = useSessao();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]}>
        <View style={{ flexGrow: 1 }} />
        <View style={{ alignItems: 'center', gap: espaco.e3 }}>
          <Svg width={56} height={56} viewBox="0 0 64 64">
            <Path d="M12 57 V28 a20 20 0 0 1 40 0 V57" fill="none" stroke={c.brand} strokeWidth={5} strokeLinecap="round" />
            <Path d="M32 53 V41" fill="none" stroke={c.brand} strokeWidth={4} strokeLinecap="round" />
            <Path d="M31 43 C 22 42.5, 17.6 36, 18.4 28 C 27 29, 31.8 35, 31 43 Z" fill={c.brand} />
            <Path d="M33 43 C 42 42.5, 46.4 36, 45.6 28 C 37 29, 32.2 35, 33 43 Z" fill={c.brand} />
          </Svg>
          <Text style={[tipo.d3, { color: c.ink, textAlign: 'center' }]}>Que bom te ver de novo</Text>
          <Text style={[estilos.texto, { color: c.ink2 }]}>
            Sua assinatura está encerrada, então o jardim está em repouso. Tudo o
            que você cultivou continua aqui, esperando. Para regar de novo, é só
            reativar.
          </Text>
        </View>
        <View style={{ flexGrow: 1 }} />

        <Botao bloco onPress={() => router.replace('/assinar')}>
          Reativar assinatura
        </Botao>
        <Pressable onPress={sair} style={{ marginTop: espaco.e5, alignSelf: 'center' }}>
          <Text style={[tipo.u3, { color: c.ink3 }]}>Sair da conta</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  corpo: { paddingHorizontal: espaco.e5, paddingTop: 56, paddingBottom: 40, maxWidth: 440, width: '100%', alignSelf: 'center', flexGrow: 1 },
  texto: { fontFamily: fontes.leituraLeve, fontSize: 17, lineHeight: 26, textAlign: 'center', maxWidth: 320 },
});
