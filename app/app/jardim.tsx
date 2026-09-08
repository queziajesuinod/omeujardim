// O jardim: a leitura gentil da caminhada. Chama, calendário e conquistas.
//
// Aqui as regras da marca aparecem em pixel: a chama pausa mas não zera, o
// calendário nunca tem vermelho (dia sem rega é só neutro), e quem volta depois
// de sumir é recebido com "que bom te ver", não com um placar de prejuízo.

import { useMemo } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { interpolateColor } from 'react-native-reanimated';
import { IconeConquista } from '../componentes/IconeConquista';
import { BarraNavegacao } from '../componentes/BarraNavegacao';
import { Cabecalho } from '../componentes/Cabecalho';
import { useCores } from '../lib/tema-contexto';
import { useLarguraConteudo } from '../lib/layout';
import { useJardim } from '../lib/jardim';
import { diaDevocional } from '../lib/id';
import { espaco, forma, tipo } from '../tema/tema';

function Chama({ cor, tamanho = 44 }: { cor: string; tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      <Path d="M12 2c2.4 3.6 3.7 6 3.7 8.4a3.7 3.7 0 1 1-7.4 0C8.3 8 9.6 5.6 12 2z" fill={cor} />
    </Svg>
  );
}

// O tom do quadradinho por intensidade do dia: quanto mais do dia foi regado,
// mais escuro o verde. Dia sem rega é cinza neutro — nunca vermelho.
//
// A rampa é derivada do PRÓPRIO tema (brandSoft → brand), então cresce de forma
// monotônica no claro e no escuro. O tom do meio já foi uma cor de marca fixa
// (marca.broto): no escuro ela ficava mais escura que o vazio e invertia a
// leitura de "quanto foi regado". Agora não há valor fixo, só os tokens do tema.
function corDoDia(fracao: number, c: { surface2: string; brandSoft: string; brand: string }) {
  if (fracao <= 0) return c.surface2;
  return interpolateColor(Math.min(fracao, 1), [0, 1], [c.brandSoft, c.brand]);
}

export default function Jardim() {
  const c = useCores();
  const maxLargura = useLarguraConteudo();
  const hoje = useMemo(() => diaDevocional(), []);
  const jardim = useJardim(hoje);

  if (jardim.isLoading) {
    return (
      <SafeAreaView style={[estilos.centro, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} />
      </SafeAreaView>
    );
  }

  const j = jardim.data;
  const conquistadas = (j?.conquistas ?? []).filter((q) => q.conquistada);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      <Cabecalho titulo="Jardim" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]} showsVerticalScrollIndicator={false}>
        {j?.voltaPorCima ? (
          <View style={[estilos.boasVindas, { backgroundColor: c.brandSoft }]}>
            <Text style={[tipo.l2, { color: c.brand }]}>Que bom te ver de novo.</Text>
            <Text style={[tipo.u3, { color: c.ink2, marginTop: espaco.e1 }]}>
              Nada murchou na sua ausência. É só continuar de onde parou.
            </Text>
          </View>
        ) : null}

        {/* A chama. Acesa em latão quente; em pausa, apenas mais quieta. */}
        <View style={[estilos.chama, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Chama cor={j?.emPausa ? c.ink3 : c.accentFill} />
          <View style={{ flex: 1 }}>
            <Text style={[tipo.d4, { color: c.ink }]}>
              {j?.chama ?? 0} {j?.chama === 1 ? 'dia' : 'dias'} de constância
            </Text>
            <Text style={[tipo.u3, { color: c.ink3, marginTop: espaco.e1 }]}>
              {j?.emPausa ? 'Em pausa, sem perder nada.' : 'Acesa hoje.'}
              {typeof j?.escudos === 'number' ? `  ${j.escudos} ${j.escudos === 1 ? 'escudo' : 'escudos'} de graça neste mês.` : ''}
            </Text>
          </View>
        </View>

        {/* Calendário dos 30 dias. Sem vermelho: ausência é neutra. */}
        <Text style={[tipo.u4, { color: c.ink3, letterSpacing: 1.3, marginTop: espaco.e6, marginBottom: espaco.e3 }]}>
          ÚLTIMOS 30 DIAS
        </Text>
        <View style={estilos.calendario}>
          {(j?.calendario ?? []).map((d) => (
            <View
              key={d.data}
              accessibilityLabel={`${d.data}: ${d.previstas > 0 ? `${d.feitas} de ${d.previstas}` : d.regou ? 'regado' : 'sem rega'}`}
              // Tom de verde por intensidade do dia. Vazio é cinza neutro, nunca vermelho.
              style={[estilos.dia, { backgroundColor: corDoDia(d.fracao, c) }]}
            />
          ))}
        </View>

        {/* Conquistas: só as que a pessoa realmente fez. Nada de mostrar troféu
            trancado como cobrança do que falta — o jardim não cobra. */}
        {conquistadas.length > 0 ? (
          <>
            <Text style={[tipo.u4, { color: c.ink3, letterSpacing: 1.3, marginTop: espaco.e6, marginBottom: espaco.e3 }]}>
              CONQUISTAS · {conquistadas.length}
            </Text>
            <View style={{ gap: espaco.e3 }}>
              {conquistadas.map((q) => (
                <View key={q.codigo} style={[estilos.conquista, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <View style={[estilos.selo, { backgroundColor: c.brand }]}>
                    <IconeConquista codigo={q.codigo} cor={c.onBrand} tamanho={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[tipo.u2, { color: c.ink }]}>{q.nome}</Text>
                    <Text style={[tipo.u3, { color: c.ink3, marginTop: 1 }]}>{q.descricao}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={[tipo.u3, { color: c.ink3, marginTop: espaco.e6 }]}>
            As conquistas aparecem aqui conforme você caminha. Ainda no começo, e está tudo bem.
          </Text>
        )}

      </ScrollView>
      <BarraNavegacao />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  corpo: { paddingHorizontal: espaco.e5, paddingTop: espaco.e2, paddingBottom: espaco.e8, maxWidth: 440, width: '100%', alignSelf: 'center' },
  boasVindas: { padding: espaco.e5, borderRadius: forma.card, marginTop: espaco.e4 },
  chama: {
    flexDirection: 'row', alignItems: 'center', gap: espaco.e4,
    padding: espaco.e5, borderRadius: forma.card, borderWidth: 1, marginTop: espaco.e5,
  },
  calendario: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.e2 },
  dia: { width: 34, height: 34, borderRadius: forma.campo },
  conquista: {
    flexDirection: 'row', alignItems: 'center', gap: espaco.e3,
    padding: espaco.e4, borderRadius: forma.card, borderWidth: 1,
  },
  selo: {
    width: 30, height: 30, borderRadius: forma.pilula,
    alignItems: 'center', justifyContent: 'center', flex: 0,
  },
});
