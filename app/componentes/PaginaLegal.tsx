// Página pública de um documento legal (termos ou privacidade), em /termos e
// /privacidade. Lê o texto do painel por GET /v1/documentos/:chave (público) e
// o apresenta para leitura — indexável, com tema claro/escuro. Serve tanto para
// o PWA quanto para a URL que as lojas exigem.

import { ScrollView, View, Text, Pressable, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Head from 'expo-router/head';
import Svg, { Path } from 'react-native-svg';
import { useCores } from '../lib/tema-contexto';
import { useDocumento, type ChaveDocumento } from '../lib/documentos';
import { espaco, tipo, fontes, marca } from '../tema/tema';

const SUPORTE = 'suporte@omeujardim.app';

const META: Record<ChaveDocumento, { titulo: string; descricao: string; outra: ChaveDocumento; outraRotulo: string }> = {
  termos: {
    titulo: 'Termos de Uso',
    descricao: 'Termos de Uso do o meu jardim: como funciona a conta, a assinatura e o uso do app.',
    outra: 'privacidade', outraRotulo: 'Política de Privacidade',
  },
  privacidade: {
    titulo: 'Política de Privacidade',
    descricao: 'Política de Privacidade do o meu jardim: como cuidamos dos seus dados, conforme a LGPD.',
    outra: 'termos', outraRotulo: 'Termos de Uso',
  },
};

/** A marca: o jardim fechado (o arco) com o broto dentro. */
function Marca({ cor, tamanho = 26 }: { cor: string; tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 64 64">
      <Path d="M12 57 V28 a20 20 0 0 1 40 0 V57" fill="none" stroke={cor} strokeWidth={5} strokeLinecap="round" />
      <Path d="M32 53 V41" fill="none" stroke={cor} strokeWidth={4} strokeLinecap="round" />
      <Path d="M31 43 C 22 42.5, 17.6 36, 18.4 28 C 27 29, 31.8 35, 31 43 Z" fill={cor} />
      <Path d="M33 43 C 42 42.5, 46.4 36, 45.6 28 C 37 29, 32.2 35, 33 43 Z" fill={cor} />
    </Svg>
  );
}

const ehTituloCaixaAlta = (b: string) => b === b.toUpperCase() && /[A-ZÀ-Ÿ]/.test(b);
const ehSecao = (b: string) => /^\d+\.\s+\S/.test(b) && !/^\d+\.\d/.test(b);

/** Renderiza o corpo (texto puro do painel) com um realce leve nos títulos. */
function Corpo({ texto }: { texto: string }) {
  const c = useCores();
  const blocos = texto.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocos.map((b, i) => {
        const umaLinha = !b.includes('\n');
        // O título do topo (ex.: "TERMOS DE USO — O MEU JARDIM") vem do próprio
        // corpo; escondemos porque já mostramos o título da página acima.
        if (i === 0 && umaLinha && ehTituloCaixaAlta(b)) return null;
        if (umaLinha && ehSecao(b)) {
          return <Text key={i} style={[tipo.d4, { color: c.brand, marginTop: espaco.e6 }]}>{b}</Text>;
        }
        if (umaLinha && ehTituloCaixaAlta(b)) {
          return <Text key={i} style={[tipo.d3, { color: c.ink, marginTop: espaco.e6 }]}>{b}</Text>;
        }
        return <Text key={i} style={[estilos.paragrafo, { color: c.ink2 }]}>{b}</Text>;
      })}
    </>
  );
}

export function PaginaLegal({ chave }: { chave: ChaveDocumento }) {
  const c = useCores();
  const doc = useDocumento(chave);
  const meta = META[chave];
  const titulo = doc.data?.titulo ?? meta.titulo;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'left', 'right']}>
      <Head>
        <title>{`${meta.titulo} — o meu jardim`}</title>
        <meta name="description" content={meta.descricao} />
        <meta property="og:title" content={`${meta.titulo} — o meu jardim`} />
        <meta property="og:type" content="article" />
      </Head>

      <ScrollView contentContainerStyle={estilos.corpo} showsVerticalScrollIndicator={false}>
        {/* Cabeçalho: marca (leva ao início) e voltar */}
        <View style={estilos.topo}>
          <Pressable onPress={() => router.push('/inicio')} style={estilos.logo} hitSlop={8} accessibilityRole="link" accessibilityLabel="Início">
            <Marca cor={c.brand} />
            <Text style={[tipo.u2, { color: c.brand }]}>o meu jardim</Text>
          </Pressable>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.push('/inicio'))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Voltar">
            <Text style={[tipo.u3, { color: c.ink3 }]}>Voltar</Text>
          </Pressable>
        </View>

        <Text style={[tipo.d2, { color: c.ink, marginTop: espaco.e5 }]}>{titulo}</Text>
        {doc.data?.versao ? (
          <Text style={[tipo.u3, { color: c.ink3, marginTop: espaco.e2 }]}>Versão {doc.data.versao}</Text>
        ) : null}

        <View style={{ marginTop: espaco.e4 }}>
          {doc.isLoading ? (
            <ActivityIndicator color={c.brand} style={{ marginTop: espaco.e6 }} />
          ) : doc.data ? (
            <Corpo texto={doc.data.corpo} />
          ) : (
            <Text style={[estilos.paragrafo, { color: c.ink2, marginTop: espaco.e4 }]}>
              Este texto ainda não foi publicado. Se precisar dele, fale com a gente em{' '}
              <Text onPress={() => Linking.openURL(`mailto:${SUPORTE}`)} style={{ fontFamily: fontes.uiForte, color: c.brand }}>{SUPORTE}</Text>.
            </Text>
          )}
        </View>

        {/* Rodapé: link cruzado e contato */}
        <View style={[estilos.rodape, { borderTopColor: c.line }]}>
          <Pressable onPress={() => router.push(`/${meta.outra}`)} hitSlop={8}>
            <Text style={[tipo.u2, { color: c.brand }]}>{meta.outraRotulo}</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(`mailto:${SUPORTE}`)} hitSlop={8}>
            <Text style={[tipo.u3, { color: c.ink3 }]}>{SUPORTE}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  corpo: {
    paddingHorizontal: espaco.e5,
    paddingTop: espaco.e3,
    paddingBottom: espaco.e8,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { flexDirection: 'row', alignItems: 'center', gap: espaco.e2 },
  paragrafo: { fontFamily: fontes.leituraLeve, fontSize: 16, lineHeight: 26, marginTop: espaco.e3 },
  rodape: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: espaco.e8, paddingTop: espaco.e5, borderTopWidth: 1,
  },
});
