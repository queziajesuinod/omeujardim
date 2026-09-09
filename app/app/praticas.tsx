// Escolha de práticas. Onde a pessoa decide o que vai cultivar.
//
// Vocabulário da marca: semeia uma prática, poda quando não quer mais. Nada
// aqui compara pessoas, nada fica vermelho, e a remoção é "podar", não
// "excluir". A tela guarda tudo de uma vez no fim, calculando o que mudou.

import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Botao } from '../componentes/Botao';
import { Cabecalho } from '../componentes/Cabecalho';
import { BarraNavegacao } from '../componentes/BarraNavegacao';
import { Interruptor } from '../componentes/Interruptor';
import { IconeDisciplina } from '../componentes/IconeDisciplina';
import { useCores, useMovimentoReduzido } from '../lib/tema-contexto';
import { useAviso } from '../lib/aviso';
import { useLarguraConteudo } from '../lib/layout';
import { voltar } from '../lib/voltar';
import { fontes } from '../tema/tema';
import {
  useDisciplinas, usePraticas, useSalvarPratica, usePodarPratica,
  type Pratica,
} from '../lib/praticas';
import { espaco, forma, tipo } from '../tema/tema';

// 0 = domingo, seguindo o padrão do model Pratica.
const DIAS = [
  { i: 0, curto: 'D', nome: 'domingo' },
  { i: 1, curto: 'S', nome: 'segunda' },
  { i: 2, curto: 'T', nome: 'terça' },
  { i: 3, curto: 'Q', nome: 'quarta' },
  { i: 4, curto: 'Q', nome: 'quinta' },
  { i: 5, curto: 'S', nome: 'sexta' },
  { i: 6, curto: 'S', nome: 'sábado' },
];

type Escolha = { ativa: boolean; metaPorSemana: number; diasSemana: number[] };

const mesmosDias = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

function resumoFrequencia(e: Escolha) {
  if (e.diasSemana.length === 7) return 'todos os dias';
  return `${e.diasSemana.length} dias por semana`;
}

export default function Praticas() {
  const c = useCores();
  const avisar = useAviso();
  const reduzido = useMovimentoReduzido();
  const maxLargura = useLarguraConteudo();

  const disciplinas = useDisciplinas();
  const praticas = usePraticas();
  const salvar = useSalvarPratica();
  const podar = usePodarPratica();

  const [sel, setSel] = useState<Record<string, Escolha>>({});
  const [guardando, setGuardando] = useState(false);
  const semeado = useRef(false);

  // Semeia o estado local com as práticas que já existem, uma vez só, para
  // não apagar o que a pessoa está editando quando a lista revalida.
  useEffect(() => {
    if (semeado.current || !praticas.data) return;
    const inicial: Record<string, Escolha> = {};
    for (const p of praticas.data) {
      inicial[p.disciplinaId] = {
        ativa: true,
        // A meta ("X vezes por semana") é o número de dias marcados — os dois são
        // a mesma coisa. Isto também conserta dados antigos em que divergiam.
        metaPorSemana: p.diasSemana.length,
        diasSemana: p.diasSemana,
      };
    }
    setSel(inicial);
    semeado.current = true;
  }, [praticas.data]);

  function alternar(discId: string) {
    setSel((s) => {
      const atual = s[discId];
      if (atual?.ativa) return { ...s, [discId]: { ...atual, ativa: false } };
      return {
        ...s,
        [discId]: atual
          ? { ...atual, ativa: true }
          : { ativa: true, metaPorSemana: 7, diasSemana: [0, 1, 2, 3, 4, 5, 6] },
      };
    });
  }

  // + e − mexem nos DIAS (a meta é o número de dias): + marca o próximo dia livre,
  // − desmarca o último dia. Nunca zera nem passa de sete.
  function ajustarMeta(discId: string, delta: number) {
    setSel((s) => {
      const atual = s[discId];
      if (!atual) return s;
      const dias = new Set(atual.diasSemana);
      if (delta > 0) {
        for (let d = 0; d < 7; d++) if (!dias.has(d)) { dias.add(d); break; }
      } else {
        if (dias.size <= 1) return s;
        for (let d = 6; d >= 0; d--) if (dias.has(d)) { dias.delete(d); break; }
      }
      const diasSemana = [...dias].sort((a, b) => a - b);
      return { ...s, [discId]: { ...atual, diasSemana, metaPorSemana: diasSemana.length } };
    });
  }

  function alternarDia(discId: string, dia: number) {
    setSel((s) => {
      const atual = s[discId];
      if (!atual) return s;
      const tem = atual.diasSemana.includes(dia);
      // Nunca deixa a pessoa ficar sem nenhum dia: um plano de zero dias não
      // é um plano. O servidor também recusaria.
      if (tem && atual.diasSemana.length === 1) return s;
      const diasSemana = tem
        ? atual.diasSemana.filter((d) => d !== dia)
        : [...atual.diasSemana, dia];
      // A meta acompanha os dias escolhidos: marcar/desmarcar um dia muda o "X
      // vezes por semana" junto.
      return { ...s, [discId]: { ...atual, diasSemana, metaPorSemana: diasSemana.length } };
    });
  }

  async function guardar() {
    if (!disciplinas.data) return;
    const porDisc = new Map<string, Pratica>(
      (praticas.data ?? []).map((p) => [p.disciplinaId, p]),
    );
    setGuardando(true);
    try {
      const ops: Promise<unknown>[] = [];
      for (const disc of disciplinas.data) {
        const e = sel[disc.id];
        const existente = porDisc.get(disc.id);
        if (e?.ativa) {
          const mudou = !existente
            || existente.metaPorSemana !== e.metaPorSemana
            || !mesmosDias(existente.diasSemana, e.diasSemana);
          if (mudou) {
            ops.push(salvar.mutateAsync({
              disciplinaId: disc.id,
              metaPorSemana: e.metaPorSemana,
              diasSemana: e.diasSemana,
            }));
          }
        } else if (existente) {
          ops.push(podar.mutateAsync(existente.id));
        }
      }
      await Promise.all(ops);
      router.replace('/hoje');
    } catch {
      // Se alguma gravação falhar, não avança em silêncio: diz o que houve para
      // a pessoa poder tentar de novo em vez de achar que guardou.
      avisar('Não consegui guardar suas práticas agora. Tente de novo.', { duracaoMs: 5000 });
    } finally {
      setGuardando(false);
    }
  }

  if (disciplinas.isLoading || praticas.isLoading) {
    return (
      <SafeAreaView style={[estilos.centro, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} />
      </SafeAreaView>
    );
  }

  if (disciplinas.isError) {
    return (
      <SafeAreaView style={[estilos.centro, { backgroundColor: c.bg }]}>
        <Text style={[tipo.l2, { color: c.ink2, textAlign: 'center' }]}>
          Não consegui carregar as disciplinas agora. Verifique a conexão e tente de novo.
        </Text>
        <View style={{ height: espaco.e4 }} />
        <Botao onPress={() => disciplinas.refetch()}>Tentar de novo</Botao>
      </SafeAreaView>
    );
  }

  const escolhidas = Object.values(sel).filter((e) => e.ativa).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      <Cabecalho titulo="O que você quer plantar" aoVoltar={() => voltar()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]} showsVerticalScrollIndicator={false}>
        <Text style={[estilos.intro, { color: c.ink2 }]}>
          Comece com duas ou três. Dá para mudar depois, e mudar não é desistir.
        </Text>

        <View style={{ gap: espaco.e3, marginTop: espaco.e5 }}>
          {disciplinas.data!.map((disc, i) => {
            const e = sel[disc.id];
            const ativa = !!e?.ativa;
            return (
              <Animated.View
                key={disc.id}
                entering={reduzido ? undefined : FadeInDown.delay(i * 40).duration(260)}
              >
                <View
                  style={[
                    estilos.cartao,
                    forma.folha,
                    {
                      backgroundColor: ativa ? c.brandSoft : c.surface,
                      borderColor: ativa ? 'transparent' : c.line,
                    },
                  ]}
                >
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityState={{ checked: ativa }}
                    accessibilityLabel={disc.nome}
                    onPress={() => alternar(disc.id)}
                    style={estilos.cabecalho}
                  >
                    {/* O anel mostra sempre o ícone da disciplina; muda de fundo com o estado. */}
                    <View style={[estilos.anel, { backgroundColor: ativa ? c.surface : c.surface2 }]}>
                      <IconeDisciplina codigo={disc.icone || disc.codigo} cor={ativa ? c.brand : c.ink3} tamanho={20} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[tipo.u2, { color: c.ink }]}>{disc.nome}</Text>
                      {ativa && e ? (
                        <Text style={[tipo.u3, { color: c.brand, marginTop: 2 }]}>
                          {resumoFrequencia(e)}
                        </Text>
                      ) : null}
                    </View>
                    {/* O seletor à direita: a escolha propriamente dita. */}
                    <Interruptor ligado={ativa} aoAlternar={() => alternar(disc.id)} rotulo={disc.nome} />
                  </Pressable>

                  {ativa && e && (
                    <View style={estilos.controles}>
                      <View style={estilos.linhaMeta}>
                        <Text style={[tipo.u3, { color: c.ink2 }]}>
                          {e.metaPorSemana} {e.metaPorSemana === 1 ? 'vez' : 'vezes'} por semana
                        </Text>
                        <View style={estilos.stepper}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Diminuir a meta"
                            onPress={() => ajustarMeta(disc.id, -1)}
                            style={[estilos.passo, { borderColor: c.line }]}
                          >
                            <Text style={[tipo.u1, { color: c.ink }]}>−</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Aumentar a meta"
                            onPress={() => ajustarMeta(disc.id, +1)}
                            style={[estilos.passo, { borderColor: c.line }]}
                          >
                            <Text style={[tipo.u1, { color: c.ink }]}>+</Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={estilos.dias}>
                        {DIAS.map((d) => {
                          const marcado = e.diasSemana.includes(d.i);
                          return (
                            <Pressable
                              key={d.i}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: marcado }}
                              accessibilityLabel={d.nome}
                              onPress={() => alternarDia(disc.id, d.i)}
                              style={[
                                estilos.dia,
                                {
                                  backgroundColor: marcado ? c.brand : 'transparent',
                                  borderColor: marcado ? c.brand : c.line,
                                },
                              ]}
                            >
                              <Text style={[tipo.u3, { color: marcado ? c.onBrand : c.ink2 }]}>
                                {d.curto}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              </Animated.View>
            );
          })}
        </View>

        <View style={{ marginTop: espaco.e6, gap: espaco.e3 }}>
          <Botao
            bloco
            haptico
            onPress={guardar}
            carregando={guardando}
            desabilitado={escolhidas === 0}
          >
            {guardando ? 'Guardando' : escolhidas > 0 ? 'Guardar minhas práticas' : 'Escolha ao menos uma'}
          </Botao>
          <Pressable onPress={() => voltar()}>
            <Text style={[tipo.u3, { color: c.ink3, textAlign: 'center' }]}>Agora não</Text>
          </Pressable>
        </View>
      </ScrollView>
      <BarraNavegacao />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espaco.e5 },
  corpo: { paddingHorizontal: espaco.e5, paddingTop: espaco.e2, paddingBottom: espaco.e8, maxWidth: 440, width: '100%', alignSelf: 'center' },
  intro: { fontFamily: fontes.leituraLeve, fontSize: 17, lineHeight: 26 },
  cartao: { borderWidth: 1, paddingVertical: espaco.e3, paddingHorizontal: espaco.e4 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: espaco.e3, minHeight: forma.toqueMinimo },
  anel: {
    width: 36, height: 36, borderRadius: forma.pilula,
    alignItems: 'center', justifyContent: 'center',
  },
  controles: { marginTop: espaco.e3, gap: espaco.e3 },
  linhaMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', gap: espaco.e2 },
  passo: {
    width: forma.toqueMinimo, height: forma.toqueMinimo, borderRadius: forma.campo, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  dias: { flexDirection: 'row', gap: espaco.e2, flexWrap: 'wrap' },
  dia: {
    width: 40, height: 40, borderRadius: forma.pilula, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
});
