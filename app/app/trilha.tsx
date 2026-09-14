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
  // Dia aberto para leitura: enquanto está aberto, a tela mostra só ele; o resto
  // some. Ao voltar, aberta vira null e a tela retoma o estado normal. Vale para
  // qualquer dia já vivido (regado, de hoje ou perdido) — o dia futuro não abre,
  // porque ainda não chegou.
  const diaAberto = aberta != null ? dias.find((d) => d.ordem === aberta && estadoDe(d.ordem) !== 'futuro') : undefined;
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
          // Antes de entrar: a apresentação da trilha e o convite.
          <View style={{ marginTop: espaco.e4 }}>
            {t?.descricao ? (
              // A apresentação autoral: o que a trilha percorre. Escrita pela
              // autora, não tirada do dia 1.
              <Text style={[estilos.apresentacao, { color: c.ink2 }]}>{t.descricao}</Text>
            ) : dias[0] ? (
              // Sem descrição própria (trilhas antigas): o antigo "começa assim"
              // ainda dá uma amostra a partir do dia 1.
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
          // Foco: só o dia aberto. Some tudo o mais até a pessoa voltar. Aberto
          // por qualquer dia já vivido, então a etiqueta e a ação seguem o estado.
          <View style={[estilos.dia, { backgroundColor: c.surface, borderColor: c.line, marginTop: espaco.e4 }]}>
            {(() => {
              const e = estadoDe(diaAberto.ordem);
              return (
                <Text style={[tipo.u4, { color: e === 'hoje' ? c.brand : c.ink3 }]}>
                  {e === 'hoje' ? `HOJE · DIA ${diaAberto.ordem}` : e === 'regado' ? `DIA ${diaAberto.ordem} · REGADO` : `DIA ${diaAberto.ordem}`}
                </Text>
              );
            })()}
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
              {regados.has(diaAberto.ordem) ? (
                // Já regado: nada regride. Só relembrar e, se quiser, escrever mais.
                <>
                  <View style={[estilos.regado, { backgroundColor: c.brandSoft }]}>
                    <IconeCheck cor={c.brand} />
                    <Text style={[tipo.u3, { color: c.brand }]}>Regado</Text>
                  </View>
                  {diaAberto.pergunta ? (
                    <Pressable onPress={() => responder(diaAberto)} style={{ marginTop: espaco.e3 }}>
                      <Text style={[tipo.u3, { color: c.brand, textAlign: 'center' }]}>Escrever no diário</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <Botao bloco haptico onPress={() => regarEResponder(diaAberto)} carregando={regar.isPending}>
                  Regar e guardar no diário
                </Botao>
              )}
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

            {/* O canteiro: o caminho inteiro num relance. Antes era uma lista de
                uma linha por dia — virava uma parede em trilhas longas. Agora
                cada dia é uma muda; toque para reler um dia já vivido, abrir o de
                hoje ou resgatar um que ficou para trás. O que ainda não chegou
                fica apagado (traço tracejado, nunca opacity — princípio da marca)
                e não abre. */}
            <View style={{ marginTop: espaco.e6 }}>
              <Text style={[tipo.u4, { color: c.ink3, marginBottom: espaco.e2 }]}>O CANTEIRO</Text>
              <Text style={[tipo.u3, { color: c.ink3, marginBottom: espaco.e3 }]}>
                Toque um dia para reler. Os que ainda não chegaram aparecem apagados.
              </Text>
              <View style={estilos.canteiro}>
                {dias.map((d) => {
                  const e = estadoDe(d.ordem);
                  const futuro = e === 'futuro';
                  const numero = (
                    <Text style={{
                      fontSize: 14, fontFamily: fontes.uiForte,
                      color: e === 'regado' ? c.onBrand : e === 'hoje' ? c.accent : futuro ? c.ink3 : c.ink2,
                    }}>{d.ordem}</Text>
                  );
                  const estiloMuda = [estilos.muda, {
                    backgroundColor: e === 'regado' ? c.brand : e === 'hoje' ? c.accentSoft : futuro ? c.surface2 : 'transparent',
                    borderColor: e === 'hoje' ? c.accent : e === 'perdido' ? c.line : 'transparent',
                    borderStyle: (e === 'perdido' ? 'dashed' : 'solid') as 'dashed' | 'solid',
                    borderWidth: e === 'hoje' || e === 'perdido' ? 1.5 : 0,
                  }];
                  return futuro ? (
                    <View key={d.id} style={estiloMuda} accessible accessibilityLabel={`Dia ${d.ordem}, ${d.titulo}, em breve`}>
                      {numero}
                    </View>
                  ) : (
                    <Pressable
                      key={d.id}
                      onPress={() => setAberta(d.ordem)}
                      style={estiloMuda}
                      accessibilityRole="button"
                      accessibilityLabel={`Dia ${d.ordem}, ${d.titulo}, ${e === 'regado' ? 'regado' : e === 'hoje' ? 'de hoje' : 'a resgatar'}. Toque para abrir.`}
                    >
                      {numero}
                    </Pressable>
                  );
                })}
              </View>
              {/* Legenda: estado nunca é só cor — cada um tem forma e rótulo. */}
              <View style={estilos.legenda}>
                <ItemLegenda c={c} rotulo="regado" preenchido />
                <ItemLegenda c={c} rotulo="hoje" anel />
                <ItemLegenda c={c} rotulo="resgatar" tracejado />
                <ItemLegenda c={c} rotulo="em breve" neutro />
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

// Uma entrada da legenda do canteiro: a mesma forma da muda, em miniatura, para
// que o estado seja lido pela forma além da cor.
function ItemLegenda({
  c, rotulo, preenchido, anel, tracejado, neutro,
}: {
  c: ReturnType<typeof useCores>;
  rotulo: string;
  preenchido?: boolean;
  anel?: boolean;
  tracejado?: boolean;
  neutro?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: preenchido ? c.brand : anel ? c.accentSoft : neutro ? c.surface2 : 'transparent',
        borderWidth: anel || tracejado ? 1.5 : 0,
        borderStyle: tracejado ? 'dashed' : 'solid',
        borderColor: anel ? c.accent : tracejado ? c.line : 'transparent',
      }} />
      <Text style={[tipo.u4, { color: c.ink3, letterSpacing: 0 }]}>{rotulo}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  corpo: { paddingHorizontal: espaco.e5, paddingTop: espaco.e2, paddingBottom: espaco.e8, maxWidth: 440, width: '100%', alignSelf: 'center' },
  dia: { padding: espaco.e5, borderRadius: forma.card, borderWidth: 1 },
  apresentacao: { fontFamily: fontes.leituraLeve, fontSize: 17, lineHeight: 27 },
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
  // O canteiro: mudas que quebram linha. Cada muda é um alvo de toque de 44,
  // dentro do mínimo da plataforma, então 30 dias cabem em poucas linhas em vez
  // de 30 linhas inteiras.
  canteiro: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.e2 },
  muda: {
    width: 44, height: 44, borderRadius: forma.pilula,
    alignItems: 'center', justifyContent: 'center',
  },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.e3, marginTop: espaco.e3 },
});
