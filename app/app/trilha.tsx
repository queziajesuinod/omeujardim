// Uma trilha como jornada.
//
// Antes de participar, a trilha se apresenta e convida. Depois, ela entrega um
// dia de cada vez: o dia de hoje aparece por inteiro, com o versículo e a
// pergunta, e a resposta vai para o diário.
//
// O avanço é pelo calendário, então dá para ficar para trás. Um dia não regado
// não some nem fica vermelho: vira uma semente a resgatar, que a pessoa escolhe
// quando regar. Nada murcha por ausência — princípio da marca, em CLAUDE.md.

import { useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Botao } from '../componentes/Botao';
import { Cabecalho } from '../componentes/Cabecalho';
import { BarraNavegacao } from '../componentes/BarraNavegacao';
import { BlocosTrilha } from '../componentes/BlocosTrilha';
import { useCores } from '../lib/tema-contexto';
import { useLarguraConteudo } from '../lib/layout';
import { useTrilha, useAndamento, useParticipar, useRegarTrilha, type TrilhaDia } from '../lib/trilhas';
import { diaDevocional } from '../lib/id';
import { voltar } from '../lib/voltar';
import { espaco, forma, tipo, fontes } from '../tema/tema';

function dataCurta(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
}

type Estado = 'regado' | 'hoje' | 'perdido' | 'futuro';

export default function Trilha() {
  const c = useCores();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const trilhaId = typeof id === 'string' ? id : undefined;

  const maxLargura = useLarguraConteudo();
  // Qual semente está aberta para leitura. Resgatar não rega de cara: primeiro
  // abre o dia por inteiro, e a rega só acontece pelo botão dentro da leitura.
  const [aberta, setAberta] = useState<number | null>(null);
  const trilha = useTrilha(trilhaId);
  const and = useAndamento(trilhaId);
  const participar = useParticipar(trilhaId ?? '');
  const regar = useRegarTrilha(trilhaId ?? '');

  if (trilha.isLoading || and.isLoading) {
    return (
      <SafeAreaView style={[estilos.centro, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} />
      </SafeAreaView>
    );
  }

  const t = trilha.data;
  const dias = t?.conteudo ?? [];
  const info = and.data;
  const participando = info?.participando === true;
  const regados = new Set(participando ? info!.regados : []);
  const diaAtual = participando ? info!.diaAtual : 0;
  const total = t?.dias ?? dias.length;

  function estadoDe(ordem: number): Estado {
    if (regados.has(ordem)) return 'regado';
    if (ordem === diaAtual) return 'hoje';
    if (ordem < diaAtual) return 'perdido';
    return 'futuro';
  }

  const diaDeHoje = dias.find((d) => d.ordem === diaAtual);
  // Semente aberta para leitura: enquanto ela está aberta, a tela mostra só esse
  // dia, e o dia de hoje e o resto somem. Ao regar, aberta volta a null e a tela
  // retoma o estado normal. Um dia já regado deixa de ser semente e fecha sozinho.
  const diaAberto = aberta != null ? dias.find((d) => d.ordem === aberta && estadoDe(d.ordem) === 'perdido') : undefined;
  const perdidos = participando ? dias.filter((d) => estadoDe(d.ordem) === 'perdido') : [];
  const concluida = participando && !!info!.concluidaEm;
  const emBreve = !!t?.disponivelEm && t.disponivelEm > diaDevocional();

  function responder(d: TrilhaDia) {
    const refs = d.blocos.filter((b) => b.tipo === 'referencia').map((b) => (b as { ref: string }).ref).join(', ');
    // Leva o vínculo da trilha junto: assim a anotação sabe de qual dia nasceu,
    // e o diário pode reabrir esse devocional depois, para relembrar.
    router.push({
      pathname: '/anotar',
      params: { referencia: refs, pergunta: d.pergunta ?? '', trilha: trilhaId ?? '', dia: String(d.ordem) },
    });
  }

  // Regar o dia e levar a reflexão para o diário, como no mockup.
  function regarEResponder(d: TrilhaDia) {
    regar.mutate(d.ordem, { onSuccess: () => { setAberta(null); responder(d); } });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      <Cabecalho
        titulo={t?.titulo ?? ''}
        aoVoltar={() => voltar('/trilhas')}
        acao={participando ? (
          <Text style={[tipo.u4, { color: c.ink3 }]}>DIA {diaAtual} DE {total}</Text>
        ) : t ? (
          <Text style={[tipo.u4, { color: c.ink3 }]}>{total} DIAS</Text>
        ) : undefined}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]} showsVerticalScrollIndicator={false}>
        <Text style={[tipo.u3, { color: c.ink3 }]}>{t?.autor}</Text>

        {!participando ? (
          // Antes de entrar: o convite.
          <View style={{ marginTop: espaco.e4 }}>
            {dias[0] ? (
              <View style={[estilos.dia, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Text style={[tipo.u4, { color: c.ink3 }]}>COMEÇA ASSIM</Text>
                <Text style={[estilos.tituloDia, { color: c.ink }]}>{dias[0].titulo}</Text>
                <Text style={[estilos.corpoDia, { color: c.ink2, marginTop: espaco.e2 }]} numberOfLines={4}>
                  {(dias[0].blocos.find((b) => b.tipo === 'texto') as { texto?: string } | undefined)?.texto ?? ''}
                </Text>
              </View>
            ) : null}
            <View style={{ marginTop: espaco.e5 }}>
              {emBreve ? (
                <View style={[estilos.colheita, { backgroundColor: c.accentSoft }]}>
                  <Text style={[tipo.u4, { color: c.accent }]}>EM BREVE</Text>
                  <Text style={[tipo.l2, { color: c.ink, marginTop: espaco.e1 }]}>
                    Esta trilha começa em {dataCurta(t!.disponivelEm!)}. Volte aqui para caminhar desde o primeiro dia.
                  </Text>
                </View>
              ) : (
                <>
                  <Botao bloco haptico onPress={() => participar.mutate()} carregando={participar.isPending}>
                    Participar desta trilha
                  </Botao>
                  <Text style={[tipo.u4, { color: c.ink3, textAlign: 'center', marginTop: espaco.e3, letterSpacing: 0 }]}>
                    Um dia de cada vez, no seu ritmo. Se faltar um dia, dá para resgatar depois.
                  </Text>
                </>
              )}
            </View>
          </View>
        ) : concluida ? (
          <View style={[estilos.colheita, { backgroundColor: c.brandSoft, marginTop: espaco.e4 }]}>
            <Text style={[tipo.d4, { color: c.brand }]}>Trilha inteira regada.</Text>
            <Text style={[tipo.l3, { color: c.ink2, marginTop: espaco.e1 }]}>
              Você caminhou os {total} dias. O que ficou está no seu diário.
            </Text>
          </View>
        ) : diaAberto ? (
          // Foco: só a semente sendo lida. Some tudo o mais até ela ser regada.
          <View style={[estilos.dia, { backgroundColor: c.surface, borderColor: c.line, marginTop: espaco.e4 }]}>
            <Text style={[tipo.u4, { color: c.ink3 }]}>DIA {diaAberto.ordem}</Text>
            <Text style={[estilos.tituloDia, { color: c.ink }]}>{diaAberto.titulo}</Text>

            <View style={{ marginTop: espaco.e3 }}>
              <BlocosTrilha blocos={diaAberto.blocos} />
            </View>

            {diaAberto.pergunta ? (
              <>
                <View style={[estilos.divisor, { backgroundColor: c.line }]} />
                <Text style={[tipo.u2, { color: c.ink }]}>{diaAberto.pergunta}</Text>
              </>
            ) : null}

            <View style={{ marginTop: espaco.e4 }}>
              <Botao bloco haptico onPress={() => regarEResponder(diaAberto)} carregando={regar.isPending}>
                Regar e guardar no diário
              </Botao>
              <Pressable onPress={() => setAberta(null)} style={{ marginTop: espaco.e3 }}>
                <Text style={[tipo.u3, { color: c.ink3, textAlign: 'center' }]}>Voltar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {/* O dia de hoje, por inteiro. */}
            {diaDeHoje ? (
              <View style={[estilos.dia, { backgroundColor: c.surface, borderColor: c.line, marginTop: espaco.e4 }]}>
                <Text style={[tipo.u4, { color: c.brand }]}>HOJE · DIA {diaDeHoje.ordem}</Text>
                <Text style={[estilos.tituloDia, { color: c.ink }]}>{diaDeHoje.titulo}</Text>

                <View style={{ marginTop: espaco.e3 }}>
                  <BlocosTrilha blocos={diaDeHoje.blocos} />
                </View>

                {diaDeHoje.pergunta ? (
                  <>
                    <View style={[estilos.divisor, { backgroundColor: c.line }]} />
                    <Text style={[tipo.u2, { color: c.ink }]}>{diaDeHoje.pergunta}</Text>
                  </>
                ) : null}

                <View style={{ marginTop: espaco.e4 }}>
                  {regados.has(diaAtual) ? (
                    <>
                      <View style={[estilos.regado, { backgroundColor: c.brandSoft }]}>
                        <IconeCheck cor={c.brand} />
                        <Text style={[tipo.u3, { color: c.brand }]}>Regado hoje</Text>
                      </View>
                      {diaDeHoje.pergunta ? (
                        <Pressable onPress={() => responder(diaDeHoje)} style={{ marginTop: espaco.e3 }}>
                          <Text style={[tipo.u3, { color: c.brand, textAlign: 'center' }]}>Escrever no diário</Text>
                        </Pressable>
                      ) : null}
                    </>
                  ) : (
                    <Botao bloco haptico onPress={() => regarEResponder(diaDeHoje)} carregando={regar.isPending}>
                      Regar e guardar no diário
                    </Botao>
                  )}
                </View>
              </View>
            ) : null}

            {/* As sementes a resgatar: dias que passaram sem rega. Sem culpa. */}
            {perdidos.length > 0 ? (
              <View style={{ marginTop: espaco.e6 }}>
                <Text style={[tipo.u4, { color: c.ink3, marginBottom: espaco.e2 }]}>
                  SEMENTES A RESGATAR · {perdidos.length}
                </Text>
                <Text style={[tipo.u3, { color: c.ink3, marginBottom: espaco.e3 }]}>
                  Dias que ficaram para trás. Nada murchou: escolha uma semente e regue quando quiser.
                </Text>
                <View style={{ gap: espaco.e3 }}>
                  {perdidos.map((d) => (
                    <View key={d.id} style={[estilos.semente, { backgroundColor: 'transparent', borderColor: c.line }]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[tipo.u4, { color: c.ink3 }]}>DIA {d.ordem}</Text>
                        <Text style={[tipo.u2, { color: c.ink2, marginTop: 2 }]} numberOfLines={1}>{d.titulo}</Text>
                      </View>
                      <Botao tamanho="sm" variante="vazado" onPress={() => setAberta(d.ordem)}>
                        Ler e regar
                      </Botao>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* O caminho inteiro, para orientação. */}
            <View style={{ marginTop: espaco.e6 }}>
              <Text style={[tipo.u4, { color: c.ink3, marginBottom: espaco.e3 }]}>O CAMINHO</Text>
              <View style={{ gap: espaco.e2 }}>
                {dias.map((d) => {
                  const e = estadoDe(d.ordem);
                  const cor = e === 'regado' ? c.brand : e === 'hoje' ? c.accent : c.ink3;
                  return (
                    <View key={d.id} style={estilos.passo}>
                      <View style={[estilos.marcador, {
                        backgroundColor: e === 'regado' ? c.brand : e === 'hoje' ? c.accentSoft : c.surface2,
                        borderColor: e === 'hoje' ? c.accent : 'transparent',
                      }]}>
                        {e === 'regado'
                          ? <IconeCheck cor={c.onBrand} />
                          : <Text style={{ fontSize: 11, fontFamily: fontes.uiForte, color: e === 'hoje' ? c.accent : c.ink3 }}>{d.ordem}</Text>}
                      </View>
                      <Text style={[tipo.u3, { color: e === 'futuro' ? c.ink3 : c.ink2, flex: 1 }]} numberOfLines={1}>
                        {d.titulo}
                      </Text>
                      <Text style={[tipo.u4, { color: cor, letterSpacing: 0 }]}>
                        {e === 'regado' ? 'regado' : e === 'hoje' ? 'hoje' : e === 'perdido' ? 'resgatar' : 'em breve'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <BarraNavegacao />
    </SafeAreaView>
  );
}

function IconeCheck({ cor }: { cor: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.6 10 17.5 19.5 7" stroke={cor} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  corpo: { paddingHorizontal: espaco.e5, paddingTop: espaco.e2, paddingBottom: espaco.e8, maxWidth: 440, width: '100%', alignSelf: 'center' },
  dia: { padding: espaco.e5, borderRadius: forma.card, borderWidth: 1 },
  tituloDia: { fontFamily: fontes.display, fontSize: 22, lineHeight: 27, marginTop: espaco.e1 },
  corpoDia: { fontFamily: fontes.leituraLeve, fontSize: 17, lineHeight: 27 },
  versiculo: { marginTop: espaco.e3, padding: espaco.e4, borderRadius: forma.card },
  divisor: { height: 1, marginVertical: espaco.e4 },
  regado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco.e2, paddingVertical: espaco.e3, borderRadius: forma.pilula },
  colheita: { padding: espaco.e5, borderRadius: forma.card },
  semente: {
    flexDirection: 'row', alignItems: 'center', gap: espaco.e3,
    padding: espaco.e4, borderRadius: forma.card, borderWidth: 1, borderStyle: 'dashed',
  },
  passo: { flexDirection: 'row', alignItems: 'center', gap: espaco.e3 },
  marcador: {
    width: 26, height: 26, borderRadius: forma.pilula, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
});
