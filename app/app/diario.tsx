// O diário: a linha do tempo do que se ouviu.
//
// O texto chega decifrado do servidor. A busca por palavra dentro do diário
// NÃO existe na web (o texto está cifrado no servidor e não há índice local);
// por isso o filtro aqui é por tag, que o servidor compara pelo índice cego
// sem saber qual é. No aparelho, a busca por palavra roda local (FTS5).

import { useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet, ActivityIndicator, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { Botao } from '../componentes/Botao';
import { Cabecalho } from '../componentes/Cabecalho';
import { BarraNavegacao } from '../componentes/BarraNavegacao';
import { useCores } from '../lib/tema-contexto';
import { useAviso } from '../lib/aviso';
import { useLarguraConteudo } from '../lib/layout';
import { useDiario, useExcluirAnotacao } from '../lib/diario';
import { espaco, forma, tipo, fontes } from '../tema/tema';

function dataLonga(dataRef: string) {
  return new Date(`${dataRef}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export default function Diario() {
  const c = useCores();
  const avisar = useAviso();
  const maxLargura = useLarguraConteudo();
  const [rascunho, setRascunho] = useState('');
  const [tag, setTag] = useState<string | undefined>(undefined);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const diario = useDiario(tag);
  const excluir = useExcluirAnotacao();

  const itens = diario.data ?? [];

  function apagar(id: string) {
    excluir.mutate(id, {
      onSuccess: () => { setConfirmando(null); avisar('Anotação apagada. A rega do dia continua.'); },
      onError: () => avisar('Não deu para apagar agora. Tente de novo.', { duracaoMs: 5000 }),
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      <Cabecalho titulo="Diário" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]} keyboardShouldPersistTaps="handled">
        {/* Busca por tag, em pílula, como no mockup. */}
        <View style={[estilos.busca, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Circle cx={11} cy={11} r={6.5} stroke={c.ink3} strokeWidth={1.75} fill="none" />
            <Path d="M16 16l4 4" stroke={c.ink3} strokeWidth={1.75} strokeLinecap="round" />
          </Svg>
          <TextInput
            value={rascunho}
            onChangeText={setRascunho}
            placeholder="Filtrar por tag: gratidão, medo…"
            placeholderTextColor={c.ink3}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => setTag(rascunho.trim() || undefined)}
            style={[estilos.buscaInput, tipo.l3, { color: c.ink }]}
          />
          {tag ? (
            <Pressable onPress={() => { setRascunho(''); setTag(undefined); }} accessibilityLabel="Limpar filtro">
              <Text style={[tipo.u3, { color: c.ink3 }]}>Limpar</Text>
            </Pressable>
          ) : null}
        </View>
        {Platform.OS === 'web' ? (
          <Text style={[tipo.u4, { color: c.ink3, marginTop: espaco.e2, letterSpacing: 0 }]}>
            Na web, a busca é por tag e referência. A busca por palavra dentro do
            texto não existe aqui: ele fica cifrado no servidor.
          </Text>
        ) : null}

        {diario.isLoading ? (
          <View style={{ paddingVertical: espaco.e7 }}>
            <ActivityIndicator color={c.brand} />
          </View>
        ) : itens.length === 0 ? (
          <View style={[estilos.vazio, { borderColor: c.line }]}>
            <Text style={[tipo.d4, { color: c.ink }]}>
              {tag ? 'Nada com essa tag' : 'Diário em branco'}
            </Text>
            <Text style={[tipo.l2, { color: c.ink2, textAlign: 'center', marginTop: espaco.e2 }]}>
              {tag
                ? 'Nenhuma anotação carrega essa tag ainda.'
                : 'O que você ouvir hoje começa aqui. Escreva a primeira.'}
            </Text>
            {!tag ? (
              <View style={{ marginTop: espaco.e5 }}>
                <Botao onPress={() => router.push('/anotar')}>Escrever o que ouvi</Botao>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: espaco.e3, marginTop: espaco.e5 }}>
            {itens.map((a) => (
              <View key={a.id} style={[estilos.entrada, { backgroundColor: c.surface, borderColor: c.line }]}>
                <View style={estilos.entradaTopo}>
                  <Text style={[tipo.u4, { color: c.ink3 }]}>
                    {dataLonga(a.dataRef).toUpperCase()}
                  </Text>
                  {a.referencia ? (
                    <Text style={{ fontSize: 11, fontFamily: fontes.uiForte, color: c.accent }}>{a.referencia}</Text>
                  ) : null}
                </View>

                {/* Nasceu de uma trilha: mostra o vínculo, para a anotação não
                    ficar solta do contexto que a motivou. */}
                {a.trilha ? (
                  <View style={[estilos.trilhaTag, { backgroundColor: c.brandSoft }]}>
                    <Text style={[tipo.u4, { color: c.brand, letterSpacing: 0 }]} numberOfLines={1}>
                      Trilha: {a.trilha.titulo}{a.trilhaDiaOrdem ? ` · dia ${a.trilhaDiaOrdem}` : ''}
                    </Text>
                  </View>
                ) : null}

                <Text style={[estilos.entradaTexto, { color: c.ink2 }]}>{a.texto}</Text>

                {confirmando === a.id ? (
                  <View style={[estilos.confirmar, { borderTopColor: c.line }]}>
                    <Text style={[tipo.u3, { color: c.ink2, flex: 1 }]}>
                      Apagar do diário? A rega do dia continua.
                    </Text>
                    <Pressable onPress={() => setConfirmando(null)} hitSlop={8} style={estilos.acaoToque}>
                      <Text style={[tipo.u3, { color: c.ink3 }]}>Cancelar</Text>
                    </Pressable>
                    <Pressable onPress={() => apagar(a.id)} hitSlop={8} disabled={excluir.isPending} style={estilos.acaoToque}>
                      <Text style={[tipo.u3, { color: c.alert }]}>Apagar</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={estilos.acoes}>
                    {a.trilha ? (
                      <Pressable
                        onPress={() => router.push({ pathname: '/relembrar', params: { id: a.id } })}
                        hitSlop={8}
                        style={estilos.acaoToque}
                      >
                        <Text style={[tipo.u3, { color: c.brand }]}>Ver o dia</Text>
                      </Pressable>
                    ) : <View />}
                    <Pressable onPress={() => setConfirmando(a.id)} hitSlop={8} style={estilos.acaoToque}>
                      <Text style={[tipo.u3, { color: c.ink3 }]}>Apagar</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <BarraNavegacao />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  corpo: { paddingHorizontal: espaco.e5, paddingTop: espaco.e2, paddingBottom: espaco.e8, maxWidth: 440, width: '100%', alignSelf: 'center' },
  busca: {
    flexDirection: 'row', alignItems: 'center', gap: espaco.e2,
    borderRadius: forma.pilula, borderWidth: 1.5,
    paddingHorizontal: espaco.e4, minHeight: forma.toqueMinimo,
  },
  buscaInput: { flex: 1, paddingVertical: 0 },
  vazio: {
    marginTop: espaco.e6, padding: espaco.e6, borderRadius: forma.card,
    borderWidth: 1, borderStyle: 'dashed', alignItems: 'center',
  },
  entrada: { padding: espaco.e5, borderRadius: forma.card, borderWidth: 1 },
  entradaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  entradaTexto: { fontFamily: fontes.leituraLeve, fontSize: 15, lineHeight: 23, marginTop: espaco.e2 },
  trilhaTag: {
    alignSelf: 'flex-start', marginTop: espaco.e2,
    paddingVertical: espaco.e1, paddingHorizontal: espaco.e3, borderRadius: forma.pilula,
  },
  acoes: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: espaco.e3,
  },
  confirmar: {
    flexDirection: 'row', alignItems: 'center', gap: espaco.e4,
    marginTop: espaco.e3, paddingTop: espaco.e3, borderTopWidth: 1,
  },
  acaoToque: { paddingVertical: espaco.e2 },
});
