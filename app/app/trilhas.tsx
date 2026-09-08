// Trilhas: o conteúdo autoral. Catálogo em cima, busca por sentido embaixo.
//
// A busca é a parte que a marca se orgulha: você descreve o que sente e vem o
// dia certo, mesmo sem acertar a palavra. Quando o servidor não tem o modelo,
// ela ainda funciona por palavra, e a tela diz honestamente qual modo rodou.

import { useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { BarraNavegacao } from '../componentes/BarraNavegacao';
import { Cabecalho } from '../componentes/Cabecalho';
import { useCores } from '../lib/tema-contexto';
import { useTrilhas, useMinhasTrilhas, buscarTrilhas, type Resultado } from '../lib/trilhas';
import { useLarguraConteudo } from '../lib/layout';
import { diaDevocional } from '../lib/id';
import { espaco, forma, tipo, fontes } from '../tema/tema';

function dataCurta(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
}

function dataCriacao(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Trilhas() {
  const c = useCores();
  const trilhas = useTrilhas();
  const minhas = useMinhasTrilhas();
  const progresso = new Map((minhas.data ?? []).map((p) => [p.trilhaId, p]));
  const maxLargura = useLarguraConteudo();
  const hoje = diaDevocional();

  const [q, setQ] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [modo, setModo] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);

  async function buscar() {
    const termo = q.trim();
    if (termo.length < 2) return;
    setBuscando(true);
    try {
      const r = await buscarTrilhas(termo);
      setModo(r.modo);
      setResultados(r.resultados);
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }

  function limpar() {
    setQ('');
    setResultados(null);
    setModo(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      <Cabecalho titulo="Trilhas" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]} keyboardShouldPersistTaps="handled">
        {/* Busca por sentido, em pílula. Descreva o que sente; vem o dia certo. */}
        <View style={[estilos.busca, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Circle cx={11} cy={11} r={6.5} stroke={c.ink3} strokeWidth={1.75} fill="none" />
            <Path d="M16 16l4 4" stroke={c.ink3} strokeWidth={1.75} strokeLinecap="round" />
          </Svg>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="descreva o que sente: medo de perder o emprego"
            placeholderTextColor={c.ink3}
            returnKeyType="search"
            onSubmitEditing={buscar}
            style={[estilos.buscaInput, tipo.l3, { color: c.ink }]}
          />
          {resultados ? (
            <Pressable onPress={limpar} accessibilityLabel="Limpar busca">
              <Text style={[tipo.u3, { color: c.ink3 }]}>Limpar</Text>
            </Pressable>
          ) : null}
        </View>

        {buscando ? (
          <View style={{ paddingVertical: espaco.e6 }}><ActivityIndicator color={c.brand} /></View>
        ) : resultados ? (
          <View style={{ marginTop: espaco.e5 }}>
            <Text style={[tipo.u4, { color: c.ink3, letterSpacing: 1.1, marginBottom: espaco.e3 }]}>
              {resultados.length === 0 ? 'NADA ENCONTRADO' : `RESULTADOS · BUSCA ${modo === 'semantica' ? 'POR SENTIDO' : 'POR PALAVRA'}`}
            </Text>
            <View style={{ gap: espaco.e3 }}>
              {resultados.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => router.push({ pathname: '/trilha', params: { id: d.trilhaId } })}
                  style={[estilos.cartao, { backgroundColor: c.surface, borderColor: c.line }]}
                >
                  <Text style={[tipo.u4, { color: c.ink3, letterSpacing: 1 }]}>{d.trilhaTitulo.toUpperCase()}</Text>
                  <Text style={[tipo.u1, { color: c.ink, marginTop: espaco.e1 }]}>{d.titulo}</Text>
                  <Text style={[tipo.l3, { color: c.ink3, marginTop: espaco.e1 }]} numberOfLines={2}>{d.corpo}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={{ marginTop: espaco.e6, gap: espaco.e3 }}>
            {trilhas.isLoading ? (
              <ActivityIndicator color={c.brand} />
            ) : (
              // As que você já ativou vêm primeiro, com destaque; depois as demais.
              [...(trilhas.data ?? [])]
                .sort((a, b) => (progresso.has(b.id) ? 1 : 0) - (progresso.has(a.id) ? 1 : 0))
                .map((t) => {
                const p = progresso.get(t.id);
                const emBreve = !!t.disponivelEm && t.disponivelEm > hoje;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => router.push({ pathname: '/trilha', params: { id: t.id } })}
                    style={[estilos.cartao, {
                      backgroundColor: emBreve ? c.accentSoft : p ? c.brandSoft : c.surface,
                      borderColor: emBreve ? 'transparent' : p ? c.brand : c.line,
                    }]}
                  >
                    {emBreve ? <Text style={[tipo.u4, { color: c.accent, marginBottom: 4 }]}>EM BREVE</Text> : null}
                    <Text style={[estilos.tituloTrilha, { color: c.ink }]}>{t.titulo}</Text>
                    <Text style={[tipo.u3, { color: c.ink3, marginTop: 4 }]}>
                      {emBreve
                        ? `${t.autor} · em breve, chega em ${dataCurta(t.disponivelEm!)}`
                        : p
                          ? (p.concluidaEm ? `${t.autor} · trilha inteira regada` : `${t.autor} · dia ${p.diaAtual} de ${p.total}`)
                          : `${t.autor} · ${t.dias} ${t.dias === 1 ? 'dia' : 'dias'}`}
                    </Text>
                    {!emBreve && !p && t.criado_em ? (
                      <Text style={[tipo.u4, { color: c.ink3, marginTop: 4, letterSpacing: 0 }]}>criada em {dataCriacao(t.criado_em)}</Text>
                    ) : null}
                    {p && !emBreve ? (
                      <View style={[estilos.barraFundo, { backgroundColor: c.surface2, borderColor: c.line }]}>
                        <View style={[estilos.barraCheia, { backgroundColor: c.brand, width: `${Math.round((p.feitos / p.total) * 100)}%` }]} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })
            )}
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
  cartao: { padding: espaco.e5, borderRadius: forma.card, borderWidth: 1 },
  tituloTrilha: { fontFamily: fontes.display, fontSize: 19, lineHeight: 23 },
  barraFundo: { height: 8, borderRadius: forma.pilula, borderWidth: 1, marginTop: espaco.e3, overflow: 'hidden' },
  barraCheia: { height: '100%', borderRadius: forma.pilula },
});
