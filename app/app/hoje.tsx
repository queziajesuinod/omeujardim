// Tela Hoje. A primeira que existe e a mais usada do app.
//
// Agora ligada de verdade: as práticas vêm de /v1/praticas, o número em
// destaque de /v1/constancia, e regar grava LOCAL na hora pela fila offline,
// sem a tela esperar a rede. O que subiu ou não fica por conta da fila.

import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { CartaoPratica } from '../componentes/CartaoPratica';
import { Botao } from '../componentes/Botao';
import { Broto } from '../componentes/Broto';
import { BarraNavegacao } from '../componentes/BarraNavegacao';
import { ConviteLembrete } from '../componentes/ConviteLembrete';
import { GearAjustes } from '../componentes/GearAjustes';
import { Folha } from '../componentes/Folha';
import { IconeDisciplina, IconeCheck } from '../componentes/IconeDisciplina';
import { useCores, useMovimentoReduzido } from '../lib/tema-contexto';
import { useLarguraConteudo } from '../lib/layout';
import { useSessao } from '../lib/sessao';
import { usePraticas, useConstancia, type Pratica } from '../lib/praticas';
import { useAndamentoEstacao } from '../lib/estacoes';
import { regar, desregar, sincronizar, prepararBanco, regadasHoje } from '../lib/fila-offline';
import { registrarRega } from '../lib/regas-conta';
import { lerPreferencia, gravarPreferencia } from '../lib/preferencia';
import { enviarBruto } from '../lib/api';
import { diaDevocional } from '../lib/id';
import { espaco, forma, tipo } from '../tema/tema';

const CHAVE_CONVITE = 'jd_convite_lembrete';

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function detalheDe(estado: 'a-regar' | 'regada' | 'fora-do-dia') {
  if (estado === 'regada') return 'regada hoje';
  if (estado === 'fora-do-dia') return 'fora do dia';
  return 'ainda não';
}

export default function Hoje() {
  const c = useCores();
  const reduzido = useMovimentoReduzido();
  const { usuario } = useSessao();
  const qc = useQueryClient();
  const maxLargura = useLarguraConteudo();

  const praticas = usePraticas();
  const constancia = useConstancia(30);
  const estacao = useAndamentoEstacao();

  const dataRef = useMemo(() => diaDevocional(), []);
  const diaSemana = useMemo(() => new Date(`${dataRef}T12:00:00`).getDay(), [dataRef]);

  const [regadas, setRegadas] = useState<Set<string>>(new Set());
  const [mostrarConvite, setMostrarConvite] = useState(false);
  const [perguntarDiario, setPerguntarDiario] = useState<Pratica | null>(null);
  const [desmarcar, setDesmarcar] = useState<Pratica | null>(null);

  // A cada foco (abrir, ou voltar do editor de anotação): prepara o banco
  // local, relê o que já foi regado hoje (fonte da verdade offline) e sobe a
  // fila pendente, se houver rede.
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      prepararBanco();
      (async () => {
        try {
          const ids = await regadasHoje(dataRef);
          if (vivo) setRegadas(new Set(ids));
        } catch {
          // banco local ainda não pronto: começa vazio, sem drama.
        }
      })();
      sincronizar(enviarBruto)
        .then(() => qc.invalidateQueries({ queryKey: ['constancia'] }))
        .catch(() => {});
      return () => { vivo = false; };
    }, [dataRef, qc])
  );

  function atualizarContagens() {
    // Constância (número da Hoje) e jardim (chama e calendário) dependem das
    // regas; recalcula os dois quando algo muda.
    qc.invalidateQueries({ queryKey: ['constancia'] });
    qc.invalidateQueries({ queryKey: ['jardim'] });
  }

  async function aoRegar(pratica: Pratica) {
    await regar(pratica.id, dataRef);
    setRegadas((s) => new Set(s).add(pratica.id));
    // Empurra a fila e atualiza as contagens quando o registro sobe.
    sincronizar(enviarBruto).then(atualizarContagens).catch(() => {});

    // Na terceira rega, e só uma vez, oferece o lembrete — senão, oferece
    // escrever no diário. Regar sem escrever continua valendo; escrever é a
    // camada que dá valor com o tempo, então é convite, nunca obrigação.
    const total = await registrarRega();
    const jaConvidou = total === 3 ? await lerPreferencia(CHAVE_CONVITE) : 'sim';
    if (total === 3 && !jaConvidou) { setMostrarConvite(true); return; }

    // Com estação, ao regar o diário já abre DIRETO, direcionado com a referência
    // da instrução do dia (sem o passo "quer escrever?"). Sem estação, o convite.
    const codigo = pratica.disciplina?.codigo;
    const it = estacao.data?.seguindo
      ? estacao.data.conteudo.find((x) => x.disciplinaCodigo === codigo)
      : undefined;
    if (it) router.push({ pathname: '/anotar', params: { pratica: pratica.id, referencia: it.titulo } });
    else setPerguntarDiario(pratica);
  }

  async function fecharConvite() {
    setMostrarConvite(false);
    await gravarPreferencia(CHAVE_CONVITE, 'fechado');
  }

  async function confirmarDesmarcar() {
    const pratica = desmarcar;
    setDesmarcar(null);
    if (!pratica) return;
    await desregar(pratica.id, dataRef);
    setRegadas((s) => { const n = new Set(s); n.delete(pratica.id); return n; });
    sincronizar(enviarBruto).then(atualizarContagens).catch(() => {});
  }

  if (praticas.isLoading) {
    return (
      <SafeAreaView style={[estilos.centro, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} />
      </SafeAreaView>
    );
  }

  const lista = praticas.data ?? [];
  const previstas = lista.filter((p) => p.diasSemana.includes(diaSemana));
  const feitas = previstas.filter((p) => regadas.has(p.id)).length;
  const nome = usuario?.nome?.split(' ')[0];

  // Conteúdo do dia da estação, indexado pelo código da disciplina, para entrar
  // logo abaixo do check da prática correspondente. Só aparece o que a pessoa
  // marcou para o dia; conteúdo de estação sem prática no dia não é mostrado.
  const conteudoEstacao = (estacao.data?.seguindo ? estacao.data.conteudo : []) ?? [];
  const conteudoPorCodigo = Object.fromEntries(conteudoEstacao.map((it) => [it.disciplinaCodigo, it]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'left', 'right']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]} showsVerticalScrollIndicator={false}>
        <View style={estilos.topo}>
          <View style={{ flex: 1 }}>
            <Text style={[tipo.u4, { color: c.ink3, letterSpacing: 1.3 }]}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text style={[tipo.d3, { color: c.ink, marginTop: espaco.e2 }]}>
              {saudacao()}{nome ? `, ${nome}` : ''}
            </Text>
          </View>
          <GearAjustes />
        </View>

        {/* A métrica de destaque é constância, não sequência. Ver manual da marca. */}
        <Pressable
          onPress={() => router.push('/jardim')}
          style={[estilos.constancia, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Text style={[tipo.u3, { color: c.ink3 }]}>Constância dos últimos 30 dias</Text>
          {constancia.data ? (
            <>
              <Text style={[tipo.d2, { color: c.brand, marginTop: espaco.e1 }]}>
                {constancia.data.percentual}%
              </Text>
              <Text style={[tipo.u4, { color: c.ink3, marginTop: espaco.e1 }]}>
                {constancia.data.diasRegados} {constancia.data.diasRegados === 1 ? 'dia regado' : 'dias regados'} nos últimos 30
              </Text>
            </>
          ) : (
            <Text style={[tipo.u3, { color: c.ink3, marginTop: espaco.e2 }]}>Somando os seus dias.</Text>
          )}
          <Text style={[tipo.u4, { color: c.brand, marginTop: espaco.e3 }]}>Ver o jardim</Text>
        </Pressable>

        {/* Quando há estação rodando, ela entra em cena: as práticas de hoje vêm dela. */}
        {estacao.data?.seguindo ? (
          <View style={[estilos.estacaoBanner, { backgroundColor: c.brandSoft }]}>
            <Text style={[tipo.u4, { color: c.brand }]}>VOCÊ ENTROU NA ESTAÇÃO</Text>
            <Text style={[tipo.d4, { color: c.ink, marginTop: espaco.e1 }]}>{estacao.data.estacao.nome}</Text>
            <Text style={[tipo.u3, { color: c.ink2, marginTop: espaco.e1 }]}>
              Dia {estacao.data.diaAtual} de {estacao.data.total} · as práticas de hoje vêm dela
            </Text>
          </View>
        ) : null}

        {lista.length === 0 ? (
          // Estado vazio: terra limpa. Sem culpa, com um convite.
          <View style={[estilos.vazio, { borderColor: c.line }]}>
            <Broto cor={c.brand} tamanho={56} />
            <Text style={[tipo.d4, { color: c.ink, marginTop: espaco.e3 }]}>Terra limpa</Text>
            <Text style={[tipo.l2, { color: c.ink2, textAlign: 'center', marginTop: espaco.e2 }]}>
              Você ainda não escolheu o que cultivar. Comece por uma prática.
              Dá para mudar quando quiser.
            </Text>
            <View style={{ marginTop: espaco.e5 }}>
              <Botao onPress={() => router.push('/praticas')}>Escolher práticas</Botao>
            </View>
          </View>
        ) : previstas.length === 0 ? (
          // Nada previsto para este dia da semana. Descanso não é falha.
          <View style={[estilos.vazio, { borderColor: c.line, borderStyle: 'solid', backgroundColor: c.surface }]}>
            <Broto cor={c.brand} tamanho={44} />
            <Text style={[tipo.d4, { color: c.ink, marginTop: espaco.e3 }]}>Dia de descanso</Text>
            <Text style={[tipo.l2, { color: c.ink2, textAlign: 'center', marginTop: espaco.e2 }]}>
              Você não plantou nada para hoje. Descansar também é parte do cultivo.
            </Text>
            <View style={{ marginTop: espaco.e4 }}>
              <Botao variante="vazado" onPress={() => router.push('/anotar')}>Escrever mesmo assim</Botao>
            </View>
          </View>
        ) : (
          <>
            <Text style={[tipo.u4, { color: c.ink3, marginTop: espaco.e6, marginBottom: espaco.e3 }]}>
              HOJE · {feitas} DE {previstas.length}
            </Text>

            <View style={{ gap: espaco.e3 }}>
              {previstas.map((p, i) => {
                const estado = regadas.has(p.id) ? 'regada' : 'a-regar';
                const conteudo = conteudoPorCodigo[p.disciplina?.codigo ?? ''];
                return (
                  <Animated.View
                    key={p.id}
                    entering={reduzido ? undefined : FadeInDown.delay(i * 60).duration(280)}
                  >
                    <CartaoPratica
                      titulo={p.disciplina?.nome ?? 'Prática'}
                      detalhe={detalheDe(estado)}
                      estado={estado}
                      icone={estado === 'regada'
                        ? <IconeCheck cor={c.onBrand} tamanho={20} />
                        : <IconeDisciplina codigo={p.disciplina?.icone || p.disciplina?.codigo || ''} cor={c.brand} tamanho={20} />}
                      onRegar={() => aoRegar(p)}
                      onDesregar={() => setDesmarcar(p)}
                    />
                    {/* A orientação da estação é só a INSTRUÇÃO desta prática (não tem
                        check nem abre diário próprio): quem leva ao diário é o check
                        acima. Assim não há duas aberturas para a mesma direção. */}
                    {conteudo ? (
                      <View style={[estilos.itemEstacao, { backgroundColor: c.brandSoft, borderColor: c.brandSoft, marginTop: espaco.e2 }]}>
                        <Text style={[tipo.u2, { color: c.ink }]}>{conteudo.titulo}</Text>
                        <Text style={[tipo.l3, { color: c.ink2, marginTop: espaco.e1 }]}>{conteudo.corpo}</Text>
                      </View>
                    ) : null}
                  </Animated.View>
                );
              })}
            </View>

            <View style={{ marginTop: espaco.e6 }}>
              <Botao bloco haptico onPress={() => router.push('/anotar')}>Escrever o que ouvi</Botao>
            </View>
          </>
        )}

        {mostrarConvite ? <ConviteLembrete aoFechar={fecharConvite} /> : null}
      </ScrollView>
      <BarraNavegacao />

      {/* Ao marcar, o convite (nunca a obrigação) de registrar o que ouviu. */}
      <Folha visivel={!!perguntarDiario} aoFechar={() => setPerguntarDiario(null)} titulo="Regada">
        <Text style={[tipo.l2, { color: c.ink2 }]}>
          Quer escrever o que ouviu em {perguntarDiario?.disciplina?.nome ?? 'sua prática'}?
          Regar sem escrever também vale.
        </Text>
        <View style={{ marginTop: espaco.e4, gap: espaco.e3 }}>
          <Botao
            bloco
            onPress={() => {
              const p = perguntarDiario;
              setPerguntarDiario(null);
              if (!p) return;
              // Com estação, o diário já vai direcionado com a referência da
              // instrução do dia (a leitura, o tema da meditação/oração...).
              const it = conteudoPorCodigo[p.disciplina?.codigo ?? ''];
              router.push({
                pathname: '/anotar',
                params: it ? { pratica: p.id, referencia: it.titulo } : { pratica: p.id },
              });
            }}
          >
            Escrever no diário
          </Botao>
          <Pressable onPress={() => setPerguntarDiario(null)}>
            <Text style={[tipo.u3, { color: c.ink3, textAlign: 'center' }]}>Agora não</Text>
          </Pressable>
        </View>
      </Folha>

      {/* Desfazer uma rega marcada sem querer. */}
      <Folha visivel={!!desmarcar} aoFechar={() => setDesmarcar(null)} titulo="Desmarcar esta rega?">
        <Text style={[tipo.l2, { color: c.ink2 }]}>
          {desmarcar?.disciplina?.nome ?? 'Esta prática'} volta a aparecer como não regada hoje.
          Se você escreveu algo no diário junto, ele também sai.
        </Text>
        <View style={{ marginTop: espaco.e4, gap: espaco.e3 }}>
          <Botao bloco variante="vazado" onPress={confirmarDesmarcar}>Desmarcar</Botao>
          <Pressable onPress={() => setDesmarcar(null)}>
            <Text style={[tipo.u3, { color: c.ink3, textAlign: 'center' }]}>Manter regada</Text>
          </Pressable>
        </View>
      </Folha>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  corpo: { padding: espaco.e5, paddingBottom: espaco.e8, width: '100%', alignSelf: 'center' },
  topo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espaco.e3 },
  itemEstacao: { padding: espaco.e4, borderRadius: forma.card, borderWidth: 1 },
  estacaoBanner: { marginTop: espaco.e5, padding: espaco.e5, borderRadius: forma.card },
  constancia: {
    marginTop: espaco.e5,
    padding: espaco.e5,
    borderRadius: forma.card,
    borderWidth: 1,
  },
  vazio: {
    marginTop: espaco.e6,
    padding: espaco.e6,
    borderRadius: forma.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
});
