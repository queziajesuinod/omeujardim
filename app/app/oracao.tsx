// Lista de oração. Pedir, e voltar para ver o que foi respondido.
//
// Regras da marca aplicadas aqui:
// - o estado é ESCRITO, não só colorido: "Respondida em 4 de setembro", não um
//   ponto verde solto. Cor sozinha não passa em leitor de tela nem em daltonismo.
// - nada de vermelho: pedido pendente não é erro, é espera. Respondido usa a
//   cor da marca; arquivado fica apenas mais quieto.
// - o testemunho aparece ABERTO na lista, não escondido atrás de um toque: é a
//   melhor parte, a colheita, e o app não a esconde.

import { useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Campo } from '../componentes/Campo';
import { Botao } from '../componentes/Botao';
import { BarraNavegacao } from '../componentes/BarraNavegacao';
import { Cabecalho, AcaoMais } from '../componentes/Cabecalho';
import { Folha } from '../componentes/Folha';
import { Chip } from '../componentes/Etiquetas';
import { Interruptor } from '../componentes/Interruptor';
import { useCores } from '../lib/tema-contexto';
import { useAviso } from '../lib/aviso';
import { useLarguraConteudo } from '../lib/layout';
import { useOracoes, useCriarPedido, useAtualizarPedido, CATEGORIAS, type Pedido } from '../lib/oracao';
import { espaco, forma, tipo } from '../tema/tema';

function dataCurta(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
}

function haQuantoTempo(iso?: string | null) {
  if (!iso) return '';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'há 1 mês' : `há ${meses} meses`;
}

export default function Oracao() {
  const c = useCores();
  const avisar = useAviso();
  const maxLargura = useLarguraConteudo();
  const oracoes = useOracoes();
  const criar = useCriarPedido();
  const atualizar = useAtualizarPedido();

  // Sem isto, uma mutação que falha some sem dizer nada e a lista fica como estava.
  const aoFalhar = () => avisar('Não consegui salvar agora. Tente de novo.', { duracaoMs: 5000 });

  const [titulo, setTitulo] = useState('');
  const [pessoa, setPessoa] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [compartilhar, setCompartilhar] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [testemunho, setTestemunho] = useState('');

  function adicionar() {
    if (!titulo.trim()) return;
    criar.mutate(
      {
        titulo: titulo.trim(),
        pessoa: pessoa.trim() || undefined,
        categoria: categoria ?? undefined,
        compartilharIntercessao: compartilhar,
      },
      { onSuccess: () => {
        setTitulo(''); setPessoa(''); setCategoria(null); setCompartilhar(false); setMostrarForm(false);
      }, onError: aoFalhar }
    );
  }

  function confirmarResposta(id: string) {
    atualizar.mutate(
      { id, status: 'respondido', testemunho: testemunho.trim() || undefined },
      { onSuccess: () => { setRespondendo(null); setTestemunho(''); }, onError: aoFalhar }
    );
  }

  const lista = oracoes.data ?? [];
  const pedindo = lista.filter((p) => p.status === 'pedindo');
  const respondidas = lista.filter((p) => p.status === 'respondido');
  const arquivadas = lista.filter((p) => p.status === 'arquivado');

  // Cartao e Grupo são CHAMADOS como função — Cartao({ p }) — e não usados como
  // <Cartao/>. Motivo: eles são definidos aqui dentro, então a cada render do
  // Oracao ganhariam identidade nova; usados como componente, o React
  // desmontaria e remontaria a subárvore a cada tecla, e o TextInput do
  // testemunho perderia o foco (o teclado nem abria de forma estável). Chamados
  // como função, viram elementos inline e o campo continua montado. NÃO troque
  // de volta para <Cartao/> / <Grupo/>.
  function Cartao({ p }: { p: Pedido }) {
    const respondido = p.status === 'respondido';
    const arquivado = p.status === 'arquivado';
    // O ponto de estado, com anel. Nunca vermelho: pedido pendente é espera.
    const dot = respondido
      ? { cor: c.brand, anel: c.brandSoft }
      : arquivado
        ? { cor: c.surface2, anel: 'transparent' }
        : { cor: c.line, anel: c.surface2 };

    return (
      <View
        key={p.id}
        style={[
          estilos.cartao,
          {
            backgroundColor: arquivado ? 'transparent' : c.surface,
            borderColor: c.line,
            borderStyle: arquivado ? 'dashed' : 'solid',
          },
        ]}
      >
        <View style={[estilos.anelDot, { backgroundColor: dot.anel }]}>
          <View style={[estilos.dot, { backgroundColor: dot.cor }]} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[tipo.u2, { color: arquivado ? c.ink2 : c.ink }]}>{p.titulo}</Text>
          {p.pessoa ? (
            <Text style={[tipo.u3, { color: c.ink3, marginTop: 2 }]}>{p.pessoa}</Text>
          ) : null}

          {/* O testemunho, aberto, na caixa da colheita. Estado escrito, não só cor. */}
          {respondido && (p.testemunho || p.respondidoEm) ? (
            <View style={[estilos.colheita, { backgroundColor: c.brandSoft }]}>
              <Text style={[tipo.u4, { color: c.brand, marginBottom: espaco.e1 }]}>
                {p.respondidoEm ? `RESPONDIDA EM ${dataCurta(p.respondidoEm).toUpperCase()}` : 'RESPONDIDA'}
              </Text>
              {p.testemunho ? (
                <Text style={[tipo.l3, { color: c.ink2 }]}>{p.testemunho}</Text>
              ) : null}
            </View>
          ) : arquivado ? (
            <Text style={[tipo.u3, { color: c.ink3, marginTop: 2 }]}>arquivada, não é mais o caso</Text>
          ) : null}

          {respondendo === p.id ? (
            <View style={{ marginTop: espaco.e3, gap: espaco.e2 }}>
              <Campo
                rotulo="O que aconteceu? (testemunho, opcional)"
                value={testemunho}
                onChangeText={setTestemunho}
                placeholder="como a resposta veio…"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{ minHeight: 72, paddingTop: espaco.e2 }}
              />
              <View style={estilos.acoes}>
                <Botao tamanho="sm" onPress={() => confirmarResposta(p.id)}>Confirmar</Botao>
                <Pressable onPress={() => { setRespondendo(null); setTestemunho(''); }} hitSlop={8} style={estilos.acaoToque}>
                  <Text style={[tipo.u3, { color: c.ink3 }]}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={[estilos.acoes, { marginTop: espaco.e3 }]}>
              {p.status === 'pedindo' && (
                <Pressable onPress={() => { setRespondendo(p.id); setTestemunho(''); }} hitSlop={8} style={estilos.acaoToque}>
                  <Text style={[tipo.u3, { color: c.brand }]}>Respondida</Text>
                </Pressable>
              )}
              {(p.status === 'respondido' || p.status === 'arquivado') && (
                <Pressable onPress={() => atualizar.mutate({ id: p.id, status: 'pedindo' }, { onError: aoFalhar })} hitSlop={8} style={estilos.acaoToque}>
                  <Text style={[tipo.u3, { color: c.ink2 }]}>Reabrir</Text>
                </Pressable>
              )}
              {p.status !== 'arquivado' && (
                <Pressable onPress={() => atualizar.mutate({ id: p.id, status: 'arquivado' }, { onError: aoFalhar })} hitSlop={8} style={estilos.acaoToque}>
                  <Text style={[tipo.u3, { color: c.ink3 }]}>Arquivar</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <Text style={[tipo.u3, { color: c.ink3, marginTop: 2 }]}>{haQuantoTempo(p.criado_em)}</Text>
      </View>
    );
  }

  function Grupo({ nome, itens }: { nome: string; itens: Pedido[] }) {
    if (itens.length === 0) return null;
    return (
      <View style={{ marginTop: espaco.e6 }}>
        <Text style={[tipo.u4, { color: c.ink3, letterSpacing: 1.3, marginBottom: espaco.e3 }]}>
          {nome.toUpperCase()} · {itens.length}
        </Text>
        <View style={{ gap: espaco.e3 }}>
          {itens.map((p) => Cartao({ p }))}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      <Cabecalho
        titulo="Oração"
        acao={<AcaoMais aoTocar={() => setMostrarForm((v) => !v)} rotulo="Adicionar pedido" />}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]} keyboardShouldPersistTaps="handled">
        {oracoes.isLoading ? (
          <View style={{ paddingVertical: espaco.e7 }}>
            <ActivityIndicator color={c.brand} />
          </View>
        ) : lista.length === 0 ? (
          <View style={[estilos.vazio, { borderColor: c.line }]}>
            <Text style={[tipo.l2, { color: c.ink2, textAlign: 'center' }]}>
              Sua lista está vazia. O primeiro pedido começa aqui em cima.
            </Text>
          </View>
        ) : (
          <>
            {Grupo({ nome: 'Em oração', itens: pedindo })}
            {Grupo({ nome: 'Respondidas', itens: respondidas })}
            {Grupo({ nome: 'Arquivadas', itens: arquivadas })}
          </>
        )}

      </ScrollView>
      <BarraNavegacao />

      <Folha visivel={mostrarForm} aoFechar={() => setMostrarForm(false)} titulo="Novo pedido de oração">
        <View style={{ gap: espaco.e3 }}>
          <Campo
            rotulo="Pelo que orar?"
            value={titulo}
            onChangeText={setTitulo}
            placeholder="uma frase, um nome, um peso do coração…"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ minHeight: 88, paddingTop: espaco.e3 }}
          />
          <Campo rotulo="Por quem? (opcional)" value={pessoa} onChangeText={setPessoa} placeholder="um nome" />

          <Text style={[tipo.u3, { color: c.ink2 }]}>Categoria (opcional)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.e2 }}>
            {CATEGORIAS.map((cat) => (
              <Chip
                key={cat.slug}
                rotulo={cat.nome}
                ativo={categoria === cat.slug}
                onPress={() => setCategoria((atual) => (atual === cat.slug ? null : cat.slug))}
              />
            ))}
          </View>

          {/* Opt-in de intercessão: sem nome, sem texto, só a categoria. */}
          <View style={[estilos.optin, { borderColor: c.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[tipo.u2, { color: c.ink }]}>Deixar intercessores orarem</Text>
              <Text style={[tipo.u4, { color: c.ink3, marginTop: 2 }]}>
                Só a categoria é compartilhada — nunca o que você escreveu nem o nome de ninguém.
              </Text>
            </View>
            <Interruptor ligado={compartilhar} aoAlternar={() => setCompartilhar((v) => !v)} rotulo="Compartilhar para intercessão" />
          </View>

          <Botao bloco onPress={adicionar} carregando={criar.isPending} desabilitado={!titulo.trim()}>
            Adicionar à lista
          </Botao>
        </View>
      </Folha>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  corpo: { paddingHorizontal: espaco.e5, paddingTop: espaco.e2, paddingBottom: espaco.e8, maxWidth: 440, width: '100%', alignSelf: 'center' },
  cartao: {
    flexDirection: 'row', alignItems: 'flex-start', gap: espaco.e3,
    padding: espaco.e4, borderRadius: forma.card, borderWidth: 1,
  },
  anelDot: {
    width: 16, height: 16, borderRadius: forma.pilula, marginTop: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: forma.pilula },
  colheita: { marginTop: espaco.e2, padding: espaco.e3, borderRadius: forma.campo },
  optin: {
    flexDirection: 'row', alignItems: 'center', gap: espaco.e3,
    padding: espaco.e4, borderRadius: forma.card, borderWidth: 1,
  },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco.e5 },
  acaoToque: { paddingVertical: espaco.e2 },
  vazio: {
    marginTop: espaco.e6, padding: espaco.e6, borderRadius: forma.card,
    borderWidth: 1, borderStyle: 'dashed', alignItems: 'center',
  },
});
