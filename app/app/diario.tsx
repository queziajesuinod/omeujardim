// O diário: a linha do tempo do que se ouviu, agrupada por mês.
//
// Filtros que cabem na regra de segurança (o servidor NÃO lê o texto do diário):
//  - origem (nasceu de trilha ou livre), período e referência são metadados, e
//    filtram no servidor;
//  - busca por palavra dentro do texto roda no APARELHO (FTS5), então só existe
//    no nativo. Na web o texto fica cifrado no servidor e não é pesquisável; lá
//    o campo de busca filtra por referência.

import { useMemo, useState } from 'react';
import { SectionList, ScrollView, Text, View, Pressable, StyleSheet, ActivityIndicator, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { Botao } from '../componentes/Botao';
import { Cabecalho } from '../componentes/Cabecalho';
import { BarraNavegacao } from '../componentes/BarraNavegacao';
import { useCores } from '../lib/tema-contexto';
import { useAviso } from '../lib/aviso';
import { useLarguraConteudo } from '../lib/layout';
import { useDiarioInfinito, useMesesDiario, useExcluirAnotacao, type FiltrosDiario } from '../lib/diario';
import { buscarLocal } from '../lib/fila-offline';
import { espaco, forma, tipo, fontes } from '../tema/tema';

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type Origem = 'todas' | 'trilha' | 'livre';
type Periodo = 'tudo' | 'mes' | 'trimestre' | 'ano';

// A forma mínima que a tela renderiza. Cobre tanto a anotação do servidor
// (com vínculo de trilha) quanto o resultado da busca local (sem vínculo).
type ItemDiario = {
  id: string;
  dataRef: string;
  texto: string;
  referencia: string | null;
  trilha?: { id: string; titulo: string } | null;
  trilhaDiaOrdem?: number | null;
};

function dataLonga(dataRef: string) {
  return new Date(`${dataRef}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

// "Setembro de 2026" a partir de "AAAA-MM".
function nomeMes(aaaaMM: string): string {
  const [a, m] = aaaaMM.split('-').map(Number);
  const s = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Início do período (rolando a partir de hoje). 'tudo' não restringe.
function desdeDe(periodo: Periodo): string | undefined {
  if (periodo === 'tudo') return undefined;
  const d = new Date();
  if (periodo === 'mes') d.setMonth(d.getMonth() - 1);
  else if (periodo === 'trimestre') d.setMonth(d.getMonth() - 3);
  else d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

// Itens já vêm ordenados por data (desc), então agrupar por mês é uma passada só.
function agrupar(itens: ItemDiario[]): { title: string; data: ItemDiario[] }[] {
  const secoes: { title: string; data: ItemDiario[] }[] = [];
  let chave = '';
  for (const a of itens) {
    const k = a.dataRef.slice(0, 7);
    if (k !== chave) { chave = k; secoes.push({ title: nomeMes(k), data: [] }); }
    secoes[secoes.length - 1].data.push(a);
  }
  return secoes;
}

function primeiroDia(aaaaMM: string) {
  return `${aaaaMM}-01`;
}
// O mês seguinte a "AAAA-MM". Serve de fim exclusivo ao abrir um mês do canteiro.
function proximoMes(aaaaMM: string) {
  const [a, m] = aaaaMM.split('-').map(Number);
  const d = new Date(a, m, 1); // m (1-based) como índice 0-based já aponta o mês seguinte
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// O canteiro: uma grade de meses, cada um com a contagem de anotações, em tons
// de verde. Um mês quieto é neutro, nunca vermelho — nada de culpa por ausência.
// Toca um mês com anotações e a linha do tempo abre naquele mês.
function Canteiro({ c, maxLargura, aoAbrirMes }: {
  c: ReturnType<typeof useCores>; maxLargura: number; aoAbrirMes: (mes: string) => void;
}) {
  const q = useMesesDiario();
  if (q.isLoading) {
    return <View style={{ paddingVertical: espaco.e7 }}><ActivityIndicator color={c.brand} /></View>;
  }
  const dados = q.data ?? [];
  if (dados.length === 0) {
    return (
      <View style={[estilos.corpo, { maxWidth: maxLargura }]}>
        <View style={[estilos.vazio, { borderColor: c.line }]}>
          <Text style={[tipo.d4, { color: c.ink }]}>Canteiro em terra</Text>
          <Text style={[tipo.l2, { color: c.ink2, textAlign: 'center', marginTop: espaco.e2 }]}>
            Quando você escrever, cada mês vira uma muda aqui. Comece hoje.
          </Text>
          <View style={{ marginTop: espaco.e5 }}>
            <Botao onPress={() => router.push('/anotar')}>Escrever o que ouvi</Botao>
          </View>
        </View>
      </View>
    );
  }

  const mapa = new Map(dados.map((m) => [m.mes, m.total]));
  const hojeMes = new Date().toISOString().slice(0, 7);
  const anoInicial = Number(dados[0].mes.slice(0, 4));
  const anoAtual = new Date().getFullYear();
  const anos: number[] = [];
  for (let a = anoAtual; a >= anoInicial; a--) anos.push(a);

  return (
    <ScrollView contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]} showsVerticalScrollIndicator={false}>
      <Text style={[tipo.u3, { color: c.ink3, marginTop: espaco.e2 }]}>
        Cada mês, o que você semeou. Mais verde, mais anotações; um mês quieto não é falha.
      </Text>
      {anos.map((ano) => (
        <View key={ano} style={{ marginTop: espaco.e5 }}>
          <Text style={[tipo.u2, { color: c.ink, marginBottom: espaco.e2 }]}>{ano}</Text>
          <View style={estilos.gradeMes}>
            {MESES_ABREV.map((abrev, i) => {
              const mm = String(i + 1).padStart(2, '0');
              const key = `${ano}-${mm}`;
              const futuro = key > hojeMes;
              const total = mapa.get(key) || 0;
              const forte = total >= 5;
              const bg = futuro ? 'transparent' : total === 0 ? c.surface2 : forte ? c.brand : c.brandSoft;
              const fg = forte && !futuro ? c.onBrand : total > 0 ? c.brand : c.ink3;
              const conteudo = (
                <>
                  <Text style={[tipo.u4, { color: fg, letterSpacing: 0 }]}>{abrev.toUpperCase()}</Text>
                  <Text style={{ fontFamily: fontes.display, fontSize: 18, lineHeight: 22, color: fg }}>
                    {futuro ? '' : total > 0 ? total : '·'}
                  </Text>
                </>
              );
              const estilo = [estilos.muda, {
                backgroundColor: bg,
                borderColor: futuro ? c.line : 'transparent',
                borderWidth: futuro ? 1 : 0,
                borderStyle: (futuro ? 'dashed' : 'solid') as 'dashed' | 'solid',
              }];
              return total > 0 && !futuro ? (
                <Pressable
                  key={key}
                  style={estilo}
                  onPress={() => aoAbrirMes(key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${abrev} de ${ano}, ${total} anotações. Toque para abrir.`}
                >
                  {conteudo}
                </Pressable>
              ) : (
                <View key={key} style={estilo} accessibilityLabel={`${abrev} de ${ano}, sem anotações`}>
                  {conteudo}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Chip({ ativo, rotulo, onPress, c }: { ativo: boolean; rotulo: string; onPress: () => void; c: ReturnType<typeof useCores> }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      style={[estilos.chip, { borderColor: ativo ? c.brand : c.line, backgroundColor: ativo ? c.brandSoft : 'transparent' }]}
    >
      <Text style={[tipo.u4, { color: ativo ? c.brand : c.ink2, letterSpacing: 0 }]}>{rotulo}</Text>
    </Pressable>
  );
}

export default function Diario() {
  const c = useCores();
  const avisar = useAviso();
  const maxLargura = useLarguraConteudo();
  const naWeb = Platform.OS === 'web';

  const [vista, setVista] = useState<'linha' | 'canteiro'>('linha');
  const [mesEspecifico, setMesEspecifico] = useState<string | null>(null);
  const [origem, setOrigem] = useState<Origem>('todas');
  const [periodo, setPeriodo] = useState<Periodo>('tudo');
  const [rascunho, setRascunho] = useState('');
  const [ref, setRef] = useState('');            // filtro por referência (web)
  const [termo, setTermo] = useState('');         // busca por palavra (nativo, FTS)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const excluir = useExcluirAnotacao();

  // Busca por palavra é modo à parte: some no aparelho, toma a tela quando ativa.
  const buscaNativa = !naWeb && termo.trim().length > 0;
  const desde = desdeDe(periodo);

  // Um mês aberto pelo canteiro vira uma janela exata [1º dia, 1º dia do mês
  // seguinte); senão, vale o período rolante dos chips.
  const filtros: FiltrosDiario = {
    origem: origem === 'todas' ? undefined : origem,
    desde: mesEspecifico ? primeiroDia(mesEspecifico) : desde,
    antes: mesEspecifico ? primeiroDia(proximoMes(mesEspecifico)) : undefined,
    ref: naWeb ? (ref.trim() || undefined) : undefined,
  };
  const q = useDiarioInfinito(filtros, vista === 'linha' && !buscaNativa);

  // Busca por palavra é global (varre todo o diário local); os filtros de período
  // e origem valem para a linha do tempo, não para ela.
  const locais = useMemo(
    () => (buscaNativa ? (buscarLocal(termo) as ItemDiario[]) : ([] as ItemDiario[])),
    [buscaNativa, termo]
  );

  const itens: ItemDiario[] = buscaNativa ? locais : ((q.data?.pages.flat() ?? []) as ItemDiario[]);
  const secoes = useMemo(() => agrupar(itens), [itens]);

  const carregando = !buscaNativa && q.isLoading;
  const temFiltro = origem !== 'todas' || periodo !== 'tudo' || !!mesEspecifico || (naWeb && !!ref.trim());

  function submeterBusca() {
    const t = rascunho.trim();
    if (naWeb) setRef(t);
    else setTermo(t);
  }
  function limparBusca() {
    setRascunho(''); setRef(''); setTermo('');
  }
  function limparTudo() {
    limparBusca(); setOrigem('todas'); setPeriodo('tudo'); setMesEspecifico(null);
  }
  function abrirMes(mes: string) {
    setMesEspecifico(mes); setPeriodo('tudo'); setVista('linha');
  }
  function alternarExpandir(id: string) {
    setExpandidos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function apagar(id: string) {
    excluir.mutate(id, {
      onSuccess: () => { setConfirmando(null); avisar('Anotação apagada. A rega do dia continua.'); },
      onError: () => avisar('Não deu para apagar agora. Tente de novo.', { duracaoMs: 5000 }),
    });
  }

  const buscaAtiva = naWeb ? !!ref.trim() : buscaNativa;

  function renderItem({ item: a }: { item: ItemDiario }) {
    const expandido = expandidos.has(a.id);
    const longo = (a.texto?.length ?? 0) > 160;
    return (
      <View style={[estilos.entrada, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={estilos.entradaTopo}>
          <Text style={[tipo.u4, { color: c.ink3 }]}>{dataLonga(a.dataRef).toUpperCase()}</Text>
          {a.referencia ? (
            <Text style={{ fontSize: 11, fontFamily: fontes.uiForte, color: c.accent }}>{a.referencia}</Text>
          ) : null}
        </View>

        {a.trilha ? (
          <View style={[estilos.trilhaTag, { backgroundColor: c.brandSoft }]}>
            <Text style={[tipo.u4, { color: c.brand, letterSpacing: 0 }]} numberOfLines={1}>
              Trilha: {a.trilha.titulo}{a.trilhaDiaOrdem ? ` · dia ${a.trilhaDiaOrdem}` : ''}
            </Text>
          </View>
        ) : null}

        <Text style={[estilos.entradaTexto, { color: c.ink2 }]} numberOfLines={expandido ? undefined : 4}>
          {a.texto}
        </Text>
        {longo ? (
          <Pressable onPress={() => alternarExpandir(a.id)} hitSlop={6} style={{ marginTop: espaco.e1 }}>
            <Text style={[tipo.u3, { color: c.ink3 }]}>{expandido ? 'ler menos' : 'ler mais'}</Text>
          </Pressable>
        ) : null}

        {confirmando === a.id ? (
          <View style={[estilos.confirmar, { borderTopColor: c.line }]}>
            <Text style={[tipo.u3, { color: c.ink2, flex: 1 }]}>Apagar do diário? A rega do dia continua.</Text>
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
              <Pressable onPress={() => router.push({ pathname: '/relembrar', params: { id: a.id } })} hitSlop={8} style={estilos.acaoToque}>
                <Text style={[tipo.u3, { color: c.brand }]}>Ver o dia</Text>
              </Pressable>
            ) : <View />}
            <Pressable onPress={() => setConfirmando(a.id)} hitSlop={8} style={estilos.acaoToque}>
              <Text style={[tipo.u3, { color: c.ink3 }]}>Apagar</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      <Cabecalho titulo="Diário" />

      <View style={[estilos.filtros, { maxWidth: maxLargura }]}>
        {/* Alterna entre a linha do tempo e o canteiro (a visão-mapa por mês). */}
        <View style={estilos.chips}>
          <Chip c={c} ativo={vista === 'linha'} rotulo="Linha do tempo" onPress={() => setVista('linha')} />
          <Chip c={c} ativo={vista === 'canteiro'} rotulo="Canteiro" onPress={() => setVista('canteiro')} />
        </View>

        {vista === 'linha' ? (
          <>
            {/* Busca: no aparelho, por palavra (FTS); na web, por referência. */}
            <View style={[estilos.busca, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Circle cx={11} cy={11} r={6.5} stroke={c.ink3} strokeWidth={1.75} fill="none" />
                <Path d="M16 16l4 4" stroke={c.ink3} strokeWidth={1.75} strokeLinecap="round" />
              </Svg>
              <TextInput
                value={rascunho}
                onChangeText={setRascunho}
                placeholder={naWeb ? 'Filtrar por referência: Salmos…' : 'Buscar no que escrevi…'}
                placeholderTextColor={c.ink3}
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={submeterBusca}
                style={[estilos.buscaInput, tipo.l3, { color: c.ink }]}
              />
              {buscaAtiva ? (
                <Pressable onPress={limparBusca} accessibilityLabel="Limpar busca">
                  <Text style={[tipo.u3, { color: c.ink3 }]}>Limpar</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Filtros só valem para a linha do tempo, não para a busca local. */}
            {buscaNativa ? (
              <Text style={[tipo.u4, { color: c.ink3, letterSpacing: 0 }]}>
                Busca por palavra, aqui no aparelho. Some ao limpar.
              </Text>
            ) : (
              <>
                <View style={estilos.chips}>
                  <Chip c={c} ativo={origem === 'todas'} rotulo="Tudo" onPress={() => setOrigem('todas')} />
                  <Chip c={c} ativo={origem === 'trilha'} rotulo="De trilhas" onPress={() => setOrigem('trilha')} />
                  <Chip c={c} ativo={origem === 'livre'} rotulo="Livres" onPress={() => setOrigem('livre')} />
                </View>
                {mesEspecifico ? (
                  // Um mês aberto pelo canteiro: um selo removível no lugar dos períodos.
                  <Pressable
                    onPress={() => setMesEspecifico(null)}
                    accessibilityRole="button"
                    accessibilityLabel={`Mês ${nomeMes(mesEspecifico)}. Toque para ver todo o tempo.`}
                    style={[estilos.chip, { alignSelf: 'flex-start', flexDirection: 'row', gap: espaco.e2, borderColor: c.brand, backgroundColor: c.brandSoft }]}
                  >
                    <Text style={[tipo.u4, { color: c.brand, letterSpacing: 0 }]}>{nomeMes(mesEspecifico)}</Text>
                    <Text style={[tipo.u4, { color: c.brand }]}>✕</Text>
                  </Pressable>
                ) : (
                  <View style={estilos.chips}>
                    <Chip c={c} ativo={periodo === 'tudo'} rotulo="Todo o tempo" onPress={() => setPeriodo('tudo')} />
                    <Chip c={c} ativo={periodo === 'mes'} rotulo="Mês" onPress={() => setPeriodo('mes')} />
                    <Chip c={c} ativo={periodo === 'trimestre'} rotulo="3 meses" onPress={() => setPeriodo('trimestre')} />
                    <Chip c={c} ativo={periodo === 'ano'} rotulo="Ano" onPress={() => setPeriodo('ano')} />
                  </View>
                )}
              </>
            )}
          </>
        ) : null}
      </View>

      {vista === 'canteiro' ? (
        <Canteiro c={c} maxLargura={maxLargura} aoAbrirMes={abrirMes} />
      ) : carregando ? (
        <View style={{ paddingVertical: espaco.e7 }}><ActivityIndicator color={c.brand} /></View>
      ) : (
        <SectionList
          sections={secoes}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          stickySectionHeadersEnabled
          contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({ section }) => (
            <View style={[estilos.cabMes, { backgroundColor: c.bg }]}>
              <Text style={[tipo.u4, { color: c.ink3, letterSpacing: 1 }]}>
                {section.title.toUpperCase()} · {section.data.length}
              </Text>
            </View>
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (!buscaNativa && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }}
          ListFooterComponent={
            !buscaNativa && q.isFetchingNextPage ? (
              <View style={{ paddingVertical: espaco.e5 }}><ActivityIndicator color={c.brand} /></View>
            ) : null
          }
          ListEmptyComponent={
            <View style={[estilos.vazio, { borderColor: c.line }]}>
              <Text style={[tipo.d4, { color: c.ink }]}>
                {buscaAtiva ? 'Nada encontrado' : temFiltro ? 'Nada com esses filtros' : 'Diário em branco'}
              </Text>
              <Text style={[tipo.l2, { color: c.ink2, textAlign: 'center', marginTop: espaco.e2 }]}>
                {buscaAtiva
                  ? 'Tente outra palavra ou referência.'
                  : temFiltro
                    ? 'Nenhuma anotação neste recorte. Ajuste os filtros.'
                    : 'O que você ouvir hoje começa aqui. Escreva a primeira.'}
              </Text>
              {buscaAtiva || temFiltro ? (
                <Pressable onPress={limparTudo} style={{ marginTop: espaco.e4 }}>
                  <Text style={[tipo.u3, { color: c.brand }]}>Limpar filtros</Text>
                </Pressable>
              ) : (
                <View style={{ marginTop: espaco.e5 }}>
                  <Botao onPress={() => router.push('/anotar')}>Escrever o que ouvi</Botao>
                </View>
              )}
            </View>
          }
        />
      )}
      <BarraNavegacao />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  filtros: {
    paddingHorizontal: espaco.e5, paddingTop: espaco.e2, paddingBottom: espaco.e3,
    gap: espaco.e2, width: '100%', alignSelf: 'center',
  },
  corpo: { paddingHorizontal: espaco.e5, paddingBottom: espaco.e8, maxWidth: 440, width: '100%', alignSelf: 'center' },
  busca: {
    flexDirection: 'row', alignItems: 'center', gap: espaco.e2,
    borderRadius: forma.pilula, borderWidth: 1.5,
    paddingHorizontal: espaco.e4, minHeight: forma.toqueMinimo,
  },
  buscaInput: { flex: 1, paddingVertical: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.e2 },
  chip: {
    paddingVertical: espaco.e1, paddingHorizontal: espaco.e3,
    borderRadius: forma.pilula, borderWidth: 1.5, minHeight: 36, justifyContent: 'center',
  },
  gradeMes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.e2 },
  muda: {
    width: 72, height: 60, borderRadius: forma.card,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  cabMes: { paddingTop: espaco.e4, paddingBottom: espaco.e2 },
  vazio: {
    marginTop: espaco.e6, padding: espaco.e6, borderRadius: forma.card,
    borderWidth: 1, borderStyle: 'dashed', alignItems: 'center',
  },
  entrada: { padding: espaco.e5, borderRadius: forma.card, borderWidth: 1, marginBottom: espaco.e3 },
  entradaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  entradaTexto: { fontFamily: fontes.leituraLeve, fontSize: 15, lineHeight: 23, marginTop: espaco.e2 },
  trilhaTag: {
    alignSelf: 'flex-start', marginTop: espaco.e2,
    paddingVertical: espaco.e1, paddingHorizontal: espaco.e3, borderRadius: forma.pilula,
  },
  acoes: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: espaco.e3 },
  confirmar: {
    flexDirection: 'row', alignItems: 'center', gap: espaco.e4,
    marginTop: espaco.e3, paddingTop: espaco.e3, borderTopWidth: 1,
  },
  acaoToque: { paddingVertical: espaco.e2 },
});
