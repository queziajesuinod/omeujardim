// Folha de registro: escrever o que se ouviu.
//
// É o coração do produto: não é só marcar que fez, é registrar o que veio. O
// texto grava local na hora e sobe CIFRADO junto da rega, na mesma transação.
// Regar sem escrever continua valendo; escrever é a camada que dá valor com o
// tempo, então nunca é obrigatório.

import { useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Campo } from '../componentes/Campo';
import { Botao } from '../componentes/Botao';
import { Chip } from '../componentes/Etiquetas';
import { useCores } from '../lib/tema-contexto';
import { useAviso } from '../lib/aviso';
import { usePraticas } from '../lib/praticas';
import { anotar } from '../lib/fila-offline';
import type { Anotacao } from '../lib/diario';
import { enviarBruto } from '../lib/api';
import { sincronizar } from '../lib/fila-offline';
import { diaDevocional } from '../lib/id';
import { voltar } from '../lib/voltar';
import { espaco, forma, tipo, fontes } from '../tema/tema';

export default function Anotar() {
  const c = useCores();
  const qc = useQueryClient();
  const avisar = useAviso();
  const { pratica: praticaParam, referencia: refParam, pergunta, trilha, dia } = useLocalSearchParams<{
    pratica?: string; referencia?: string; pergunta?: string; trilha?: string; dia?: string;
  }>();
  const praticas = usePraticas();

  // Vínculo com o dia de trilha, quando a folha veio de uma. Vazio caso contrário.
  const trilhaId = typeof trilha === 'string' && trilha ? trilha : undefined;
  const trilhaDiaOrdem = typeof dia === 'string' && dia ? Number(dia) : undefined;

  const dataRef = useMemo(() => diaDevocional(), []);
  const [praticaId, setPraticaId] = useState<string | undefined>(
    typeof praticaParam === 'string' ? praticaParam : undefined
  );
  const [texto, setTexto] = useState('');
  const [referencia, setReferencia] = useState(typeof refParam === 'string' ? refParam : '');
  const [tagsBrutas, setTagsBrutas] = useState('');
  const [salvando, setSalvando] = useState(false);
  // Trava síncrona contra toque duplo. O estado `salvando` só desabilita o botão
  // no próximo render; toque nervoso entra de novo antes disso e, sem esta trava,
  // cada entrada gera uma anotação com id novo — é o diário duplicado.
  const enviando = useRef(false);

  const lista = praticas.data ?? [];
  const escolhida = praticaId ?? lista[0]?.id;

  async function salvar() {
    if (enviando.current) return;
    if (!escolhida || !texto.trim()) return;
    enviando.current = true;
    setSalvando(true);
    try {
      const tags = tagsBrutas.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8);
      const { registroId, anotacaoId } = await anotar(escolhida, dataRef, {
        texto: texto.trim(),
        referencia: referencia.trim() || undefined,
        tags,
        trilhaId,
        trilhaDiaOrdem,
      });
      // Mostra a anotação no diário JÁ, sem esperar a rede. Sem isto o diário
      // abre lendo do servidor (na web não há cópia local) e a reflexão só
      // aparece depois do sync — o que parece falha e leva a regar de novo.
      // O vínculo com a trilha (título) chega no refetch do sync.
      const nova: Anotacao = {
        id: anotacaoId,
        registroId,
        referencia: referencia.trim() || null,
        dataRef,
        texto: texto.trim(),
        trilhaId: trilhaId ?? null,
        trilhaDiaOrdem: trilhaDiaOrdem ?? null,
        trilha: null,
      };
      qc.setQueryData<Anotacao[]>(['diario', ''], (prev) => [nova, ...(prev ?? [])]);
      sincronizar(enviarBruto)
        .then(() => {
          qc.invalidateQueries({ queryKey: ['diario'] });
          qc.invalidateQueries({ queryKey: ['constancia'] });
        })
        .catch(() => {});
      // Confirma e fecha a folha. O aviso vive na raiz, então sobrevive à troca
      // de tela e aparece já no diário.
      avisar('Regado. Guardado no diário.');
      router.replace('/diario');
    } catch {
      // Gravação local falhou (raro). Não fecha a folha e diz o que houve, em
      // vez de sumir em silêncio com o que a pessoa escreveu. Libera para tentar
      // de novo.
      enviando.current = false;
      avisar('Não consegui guardar agora. Tente de novo.', { duracaoMs: 5000 });
    } finally {
      setSalvando(false);
    }
  }

  if (lista.length === 0 && !praticas.isLoading) {
    return (
      <SafeAreaView style={[estilos.centro, { backgroundColor: c.bg }]}>
        <Text style={[tipo.l2, { color: c.ink2, textAlign: 'center' }]}>
          Escolha ao menos uma prática antes de escrever. O que você ouve nasce
          de uma delas.
        </Text>
        <View style={{ height: espaco.e4 }} />
        <Botao onPress={() => router.replace('/praticas')}>Escolher práticas</Botao>
      </SafeAreaView>
    );
  }

  const podeSalvar = !!escolhida && texto.trim().length > 0 && !salvando;

  const praticaNome = lista.find((p) => p.id === escolhida)?.disciplina?.nome;

  return (
    <View style={[estilos.fundo, { backgroundColor: c.overlay }]}>
      {/* Toque fora fecha a folha, como um sheet de verdade. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => voltar()} accessibilityLabel="Fechar" />

      <View style={[estilos.folha, { backgroundColor: c.surface }]}>
        <View style={[estilos.puxador, { backgroundColor: c.line }]} />
        <ScrollView contentContainerStyle={estilos.corpo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={[tipo.d4, { color: c.ink }]}>{praticaNome ?? 'Escrever'}</Text>
          <Text style={[tipo.u3, { color: c.ink3, marginTop: 4 }]}>
            {new Date(`${dataRef}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>

          {/* Quando vem de uma trilha, a pergunta do dia abre a folha. */}
          {typeof pergunta === 'string' && pergunta ? (
            <View style={[estilos.prompt, { backgroundColor: c.brandSoft }]}>
              <Text style={[tipo.u4, { color: c.brand }]}>RESPONDENDO</Text>
              <Text style={[tipo.l3, { color: c.ink, fontStyle: 'italic', marginTop: espaco.e1 }]}>{pergunta}</Text>
            </View>
          ) : null}

          {/* De qual prática nasce esta reflexão. */}
          <View style={[estilos.chips, { marginTop: espaco.e4 }]}>
            {lista.map((p) => (
              <Chip
                key={p.id}
                rotulo={p.disciplina?.nome ?? 'Prática'}
                ativo={p.id === escolhida}
                onPress={() => setPraticaId(p.id)}
              />
            ))}
          </View>

          <View style={{ marginTop: espaco.e4, gap: espaco.e3 }}>
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="Duas linhas bastam."
              placeholderTextColor={c.ink3}
              multiline
              textAlignVertical="top"
              maxLength={280}
              style={[estilos.area, { backgroundColor: c.surface, borderColor: c.line, color: c.ink }]}
            />
            <View style={estilos.rodapeArea}>
              <Text style={[tipo.u3, { color: c.ink3 }]}>Só você lê isto.</Text>
              <Text style={[tipo.u3, { color: c.ink3 }]}>{texto.length} / 280</Text>
            </View>

            <Campo
              rotulo="Referência (opcional)"
              value={referencia}
              onChangeText={setReferencia}
              placeholder="João 15, Salmo 23…"
              autoCapitalize="words"
            />
            <Campo
              rotulo="Tags (opcional, separadas por vírgula)"
              value={tagsBrutas}
              onChangeText={setTagsBrutas}
              placeholder="gratidão, medo, provisão"
              autoCapitalize="none"
            />
          </View>

          <View style={{ marginTop: espaco.e5, gap: espaco.e3 }}>
            <Botao bloco haptico onPress={salvar} carregando={salvando} desabilitado={!podeSalvar}>
              Regar
            </Botao>
            <Pressable onPress={() => voltar()}>
              <Text style={[tipo.u3, { color: c.ink3, textAlign: 'center' }]}>Agora não</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espaco.e5 },
  fundo: { flex: 1, justifyContent: 'flex-end' },
  folha: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%', maxWidth: 440, width: '100%', alignSelf: 'center',
    paddingTop: espaco.e2,
  },
  puxador: {
    width: 40, height: 4, borderRadius: forma.pilula,
    alignSelf: 'center', marginTop: espaco.e2, marginBottom: espaco.e2,
  },
  corpo: { paddingHorizontal: espaco.e5, paddingTop: espaco.e2, paddingBottom: espaco.e6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.e2 },
  area: {
    borderRadius: forma.campo, borderWidth: 1.5,
    paddingHorizontal: espaco.e4, paddingTop: espaco.e3, paddingBottom: espaco.e3,
    minHeight: 96,
    fontFamily: fontes.leitura, fontSize: 16, lineHeight: 25,
  },
  rodapeArea: { flexDirection: 'row', justifyContent: 'space-between' },
  prompt: { marginTop: espaco.e4, padding: espaco.e4, borderRadius: forma.card },
});
