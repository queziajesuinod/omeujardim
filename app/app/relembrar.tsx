// Relembrar: o dia de trilha que motivou uma anotação, lado a lado com o que
// se escreveu.
//
// Por que a tela existe: uma reflexão no diário, meses depois, perde o contexto
// se a pessoa não lembra a qual devocional ela respondia. Aqui o dia da trilha
// volta por inteiro — o versículo, o texto, a pergunta — junto da resposta, para
// relembrar sem sair do diário.
//
// O texto do diário NÃO viaja por parâmetro de rota (ele é sensível e a URL
// fica no histórico); só o id da anotação viaja, e o texto vem decifrado do
// servidor, como no resto do diário.

import { ScrollView, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Cabecalho } from '../componentes/Cabecalho';
import { BarraNavegacao } from '../componentes/BarraNavegacao';
import { BlocosTrilha } from '../componentes/BlocosTrilha';
import { useCores } from '../lib/tema-contexto';
import { useLarguraConteudo } from '../lib/layout';
import { useAnotacao } from '../lib/diario';
import { useTrilha } from '../lib/trilhas';
import { voltar } from '../lib/voltar';
import { espaco, forma, tipo, fontes } from '../tema/tema';

function dataLonga(dataRef: string) {
  return new Date(`${dataRef}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export default function Relembrar() {
  const c = useCores();
  const maxLargura = useLarguraConteudo();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const anotacaoId = typeof id === 'string' ? id : undefined;

  const anot = useAnotacao(anotacaoId);
  const trilhaId = anot.data?.trilhaId ?? undefined;
  const trilha = useTrilha(trilhaId);

  const carregando = anot.isLoading || (!!trilhaId && trilha.isLoading);
  const dia = trilha.data?.conteudo?.find((d) => d.ordem === anot.data?.trilhaDiaOrdem);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      <Cabecalho titulo="Relembrar" aoVoltar={() => voltar('/diario')} />

      {carregando ? (
        <View style={estilos.centro}>
          <ActivityIndicator color={c.brand} />
        </View>
      ) : !anot.data ? (
        <View style={estilos.centro}>
          <Text style={[tipo.l2, { color: c.ink2, textAlign: 'center' }]}>
            Não encontramos esta anotação.
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]} showsVerticalScrollIndicator={false}>
          {anot.data.trilha ? (
            <Text style={[tipo.u3, { color: c.ink3 }]}>
              {anot.data.trilha.titulo}{anot.data.trilhaDiaOrdem ? ` · dia ${anot.data.trilhaDiaOrdem}` : ''}
            </Text>
          ) : null}

          {/* O devocional daquele dia, por inteiro. */}
          {dia ? (
            <View style={[estilos.dia, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Text style={[tipo.u4, { color: c.brand }]}>O DEVOCIONAL DAQUELE DIA</Text>
              <Text style={[estilos.tituloDia, { color: c.ink }]}>{dia.titulo}</Text>

              <View style={{ marginTop: espaco.e3 }}>
                <BlocosTrilha blocos={dia.blocos} />
              </View>

              {dia.pergunta ? (
                <>
                  <View style={[estilos.divisor, { backgroundColor: c.line }]} />
                  <Text style={[tipo.u2, { color: c.ink }]}>{dia.pergunta}</Text>
                </>
              ) : null}
            </View>
          ) : anot.data.trilha ? (
            <View style={[estilos.aviso, { backgroundColor: c.surface2 }]}>
              <Text style={[tipo.l3, { color: c.ink2 }]}>
                O conteúdo deste dia não está disponível agora. O que você escreveu
                segue aqui embaixo.
              </Text>
            </View>
          ) : (
            <View style={[estilos.aviso, { backgroundColor: c.surface2 }]}>
              <Text style={[tipo.l3, { color: c.ink2 }]}>
                Esta anotação não veio de uma trilha.
              </Text>
            </View>
          )}

          {/* A resposta: o que se ouviu naquele dia. */}
          <View style={[estilos.resposta, { backgroundColor: c.brandSoft, marginTop: espaco.e5 }]}>
            <View style={estilos.respostaTopo}>
              <Text style={[tipo.u4, { color: c.brand }]}>O QUE VOCÊ OUVIU</Text>
              {anot.data.referencia ? (
                <Text style={{ fontSize: 11, fontFamily: fontes.uiForte, color: c.accent }}>{anot.data.referencia}</Text>
              ) : null}
            </View>
            <Text style={[tipo.u4, { color: c.ink3, marginTop: espaco.e1, letterSpacing: 0 }]}>
              {dataLonga(anot.data.dataRef)}
            </Text>
            <Text style={[estilos.respostaTexto, { color: c.ink }]}>{anot.data.texto}</Text>
          </View>
        </ScrollView>
      )}

      <BarraNavegacao />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espaco.e5 },
  corpo: { paddingHorizontal: espaco.e5, paddingTop: espaco.e2, paddingBottom: espaco.e8, maxWidth: 440, width: '100%', alignSelf: 'center' },
  dia: { marginTop: espaco.e4, padding: espaco.e5, borderRadius: forma.card, borderWidth: 1 },
  tituloDia: { fontFamily: fontes.display, fontSize: 22, lineHeight: 27, marginTop: espaco.e1 },
  divisor: { height: 1, marginVertical: espaco.e4 },
  aviso: { marginTop: espaco.e4, padding: espaco.e4, borderRadius: forma.card },
  resposta: { padding: espaco.e5, borderRadius: forma.card },
  respostaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  respostaTexto: { fontFamily: fontes.leitura, fontSize: 16, lineHeight: 25, marginTop: espaco.e3 },
});
