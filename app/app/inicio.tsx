// Landing pública, em /inicio. A porta de venda: quem chega deslogado (do
// Instagram, de um link) conhece o app e cai no cadastro que já existe.
//
// É rota nativa do expo-router, então no web sai como /inicio.html estático e
// indexável (web.output: static), e reaproveita o design system inteiro — cores,
// tipografia, o botão, o tema claro/escuro. Nada de valor literal fora dos tokens.

import { ScrollView, View, Text, Pressable, StyleSheet, Linking, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Head from 'expo-router/head';
import Svg, { Path } from 'react-native-svg';
import { Botao } from '../componentes/Botao';
import { useCores } from '../lib/tema-contexto';
import { espaco, forma, tipo, fontes, marca } from '../tema/tema';

const INSTAGRAM = 'https://www.instagram.com/omeujardim.app/';
const SUPORTE = 'suporte@omeujardim.app';
const MAXW = 960;

/** A marca do app: o jardim fechado (o arco) com o broto dentro. */
function Marca({ cor, tamanho = 56 }: { cor: string; tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 64 64">
      <Path d="M12 57 V28 a20 20 0 0 1 40 0 V57" fill="none" stroke={cor} strokeWidth={5} strokeLinecap="round" />
      <Path d="M32 53 V41" fill="none" stroke={cor} strokeWidth={4} strokeLinecap="round" />
      <Path d="M31 43 C 22 42.5, 17.6 36, 18.4 28 C 27 29, 31.8 35, 31 43 Z" fill={cor} />
      <Path d="M33 43 C 42 42.5, 46.4 36, 45.6 28 C 37 29, 32.2 35, 33 43 Z" fill={cor} />
    </Svg>
  );
}

function Check({ cor, tamanho = 18 }: { cor: string; tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.6 10 17.5 19.5 7" stroke={cor} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Ícones dos benefícios, no mesmo traço simples do resto do app.
const ICONES: Record<string, string[]> = {
  regar: ['M12 2c2.4 3.6 3.7 6 3.7 8.4a3.7 3.7 0 1 1-7.4 0C8.3 8 9.6 5.6 12 2z'],
  trilha: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
  estacao: ['M12 2v6M7 13c0-3 2-5 5-5s5 2 5 5c0 2-1 3-2 4M8 22h8'],
  oracao: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z'],
  intercessao: ['M12 8m-3.2 0a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0', 'M6.5 20a5.5 5.5 0 0 1 11 0', 'M19.5 20a4 4 0 0 0-3-3.8', 'M4.5 20a4 4 0 0 1 3-3.8'],
  jardim: ['M12 22a7 7 0 0 1-1-14C15 7 17 5 19 2c1 2 2 4 2 8 0 6-5 12-9 12z', 'M3 21c0-3 2-5 5-6'],
  // privacidade
  cifra: ['M7 11V8a5 5 0 0 1 10 0v3', 'M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z', 'M12 15v2'],
  aparelho: ['M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z', 'M11 18h2'],
  consentimento: ['M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z', 'M9 12l2 2 4-4'],
  exportar: ['M12 4v9', 'M8.5 8.5 12 5l3.5 3.5', 'M5 20h14'],
};

function IconeBeneficio({ nome, cor }: { nome: string; cor: string }) {
  const paths = ICONES[nome] ?? [];
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
      {paths.map((d, i) => (
        <Path key={i} d={d} stroke={cor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

const BENEFICIOS = [
  { icone: 'regar', titulo: 'Regar', texto: 'Cuide de uma disciplina a cada dia — oração, leitura, meditação, jejum, gratidão — e dê um passo mais perto de Deus.' },
  { icone: 'trilha', titulo: 'Trilhas da Palavra', texto: 'Caminhe devocionais autorais, um dia de cada vez. Faltou um dia? A semente fica para resgatar.' },
  { icone: 'estacao', titulo: 'Estações', texto: 'Viva cada estação com Deus, guiada e sem pressa, no seu ritmo.' },
  { icone: 'oracao', titulo: 'Oração que não esquece', texto: 'Lembra você de orar e guarda as respostas ao longo do caminho, para não esquecer a fidelidade de Deus.' },
  { icone: 'intercessao', titulo: 'Intercessão em unidade', texto: 'Compartilhe a área da vida, nunca o pedido em si, e tenha pessoas orando em unidade com você.' },
  { icone: 'jardim', titulo: 'Seu jardim de constância', texto: 'A presença cultivada, viva e visível. A constância de 30 dias acolhe as pausas: nada zera, nada condena.' },
];

const PASSOS = [
  { n: '1', titulo: 'Semeie', texto: 'Escolha as disciplinas que quer cultivar e comece uma trilha da Palavra.' },
  { n: '2', titulo: 'Regue', texto: 'Cada dia, registre a prática e escreva o que ouviu. O encontro fica guardado, só seu.' },
  { n: '3', titulo: 'Permaneça', texto: 'Veja o seu jardim florescer. E se faltar um dia, a misericórdia se renova a cada manhã.' },
];

const FAQ = [
  { q: 'E se eu faltar um dia?', a: 'Nada murcha, nada zera. Aqui a constância é movida pela graça — a misericórdia do Senhor se renova a cada manhã. O dia que ficou para trás pode ser resgatado com calma.' },
  { q: 'Meu diário é mesmo privado?', a: 'Sim. O texto vai cifrado, a busca acontece no seu aparelho e o servidor não lê o que você escreveu. Você pode exportar ou apagar seus dados quando quiser.' },
  { q: 'Preciso de cartão para testar?', a: 'Não. São sete dias gratuitos sem cobrança. Se decidir continuar, é R$ 19,90 por mês, no cartão ou no PIX.' },
  { q: 'Como funciona a intercessão?', a: 'Você compartilha apenas a área da vida em oração, nunca o pedido específico. Outras pessoas oram em unidade com você, sem expor a sua intimidade.' },
];

export default function Inicio() {
  const c = useCores();
  const { width } = useWindowDimensions();
  const compacto = width < 720;

  const irCadastrar = () => router.push('/cadastro');

  // Bloco de coluna centralizada, para o conteúdo respirar em tela grande.
  const Secao = ({ children, fundo, style }: any) => (
    <View style={[{ backgroundColor: fundo, width: '100%', alignItems: 'center', paddingHorizontal: espaco.e5, paddingVertical: compacto ? espaco.e7 : espaco.e8 }, style]}>
      <View style={{ width: '100%', maxWidth: MAXW }}>{children}</View>
    </View>
  );

  const Kicker = ({ children, claro }: { children: string; claro?: boolean }) => (
    <Text style={[tipo.u4, { color: claro ? marca.broto : c.accent, textTransform: 'uppercase', marginBottom: espaco.e3 }]}>{children}</Text>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <Head>
        <title>O meu jardim — mais perto da presença de Deus, um dia de cada vez</title>
        <meta name="description" content="Um app para cultivar a presença de Deus no cotidiano: trilhas da Palavra, diário do que você ouve e um jardim de constância movido pela graça. Sete dias grátis." />
        <meta property="og:title" content="O meu jardim" />
        <meta property="og:description" content="Mais perto da presença de Deus, um dia de cada vez. Sete dias grátis." />
        <meta property="og:type" content="website" />
      </Head>

      <ScrollView contentContainerStyle={{ alignItems: 'center' }} showsVerticalScrollIndicator={false}>

        {/* Cabeçalho enxuto */}
        <View style={{ width: '100%', maxWidth: MAXW, paddingHorizontal: espaco.e5, paddingTop: espaco.e4, paddingBottom: espaco.e2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.e2 }}>
            <Marca cor={c.brand} tamanho={30} />
            <Text style={[tipo.d4, { color: c.brand }]}>o meu jardim</Text>
          </View>
          <Pressable onPress={() => router.push('/entrar')} hitSlop={8}>
            <Text style={[tipo.u2, { color: c.ink2 }]}>Entrar</Text>
          </Pressable>
        </View>

        {/* Hero */}
        <Secao fundo={c.bg} style={{ paddingTop: espaco.e6 }}>
          <View style={{ alignItems: 'center' }}>
            <Marca cor={c.brand} tamanho={64} />
            <Text style={[tipo.l3, { color: c.ink3, marginTop: espaco.e3, fontFamily: fontes.leituraLeve }]}>Jardim fechado és tu, fonte selada</Text>
            <Text style={[compacto ? tipo.d2 : tipo.d1, { color: c.ink, textAlign: 'center', marginTop: espaco.e4, maxWidth: 760 }]}>
              Mais perto da presença de Deus, um dia de cada vez.
            </Text>
            <Text style={[tipo.l1, { color: c.ink2, textAlign: 'center', marginTop: espaco.e4, maxWidth: 620 }]}>
              Um lugar para regar, no cotidiano, as sementes que vêm da Palavra. Trilhas devocionais, um diário do que você ouve, e um jardim de constância movido pela graça.
            </Text>
            <View style={{ marginTop: espaco.e5, alignItems: 'center', gap: espaco.e3 }}>
              <Botao tamanho="lg" haptico onPress={irCadastrar}>Começar — 7 dias grátis</Botao>
              <Text style={[tipo.u3, { color: c.ink3 }]}>Sem cartão para experimentar. Cancele quando quiser.</Text>
            </View>
          </View>
        </Secao>

        {/* Dor -> alívio (oração) */}
        <Secao fundo={c.surface2}>
          <Kicker>Aquela oração que foi respondida</Kicker>
          <Text style={[compacto ? tipo.d4 : tipo.d3, { color: c.brand, maxWidth: 780 }]}>
            Quantas orações já foram respondidas na sua vida — e você não se lembrou de agradecer?
          </Text>
          <Text style={[tipo.l1, { color: c.ink2, marginTop: espaco.e4, maxWidth: 700 }]}>
            O meu jardim lembra você de orar, para que nenhum pedido se perca no corre do dia. E guarda as respostas que vêm ao longo da caminhada, para você olhar para trás e ver a fidelidade de Deus escrita no seu próprio tempo.
          </Text>
        </Secao>

        {/* Conceito */}
        <Secao fundo={c.bg}>
          <Kicker>O conceito</Kicker>
          <Text style={[compacto ? tipo.d3 : tipo.d2, { color: c.ink, maxWidth: 780 }]}>
            A Bíblia começa num jardim. E termina num jardim.
          </Text>
          <Text style={[tipo.l1, { color: c.ink2, marginTop: espaco.e4, maxWidth: 720 }]}>
            No Éden, Deus caminhava com o homem. Na Nova Jerusalém, volta a habitar com o seu povo. A presença relacional de Deus é o fio que costura toda a Escritura — e a vida devocional é entrar, hoje, nessa mesma corrente. O meu jardim existe para cultivar essa proximidade no seu cotidiano.
          </Text>
        </Secao>

        {/* Benefícios */}
        <Secao fundo={c.surface2}>
          <Kicker>O que você recebe</Kicker>
          <Text style={[compacto ? tipo.d3 : tipo.d2, { color: c.ink }]}>Cada recurso conduz à presença.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.e4, marginTop: espaco.e6 }}>
            {BENEFICIOS.map((b) => (
              <View key={b.titulo} style={[estilos.cartao, { backgroundColor: c.surface, borderColor: c.line, flexGrow: 1, flexBasis: compacto ? '100%' : 280, minWidth: compacto ? '100%' : 260 }]}>
                <IconeBeneficio nome={b.icone} cor={c.brand} />
                <Text style={[tipo.d4, { color: c.ink, marginTop: espaco.e3 }]}>{b.titulo}</Text>
                <Text style={[tipo.l3, { color: c.ink2, marginTop: espaco.e2 }]}>{b.texto}</Text>
              </View>
            ))}
          </View>
        </Secao>

        {/* Passos */}
        <Secao fundo={c.bg}>
          <Kicker>Simples desde o primeiro dia</Kicker>
          <Text style={[compacto ? tipo.d3 : tipo.d2, { color: c.ink }]}>Semear, regar, permanecer.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.e5, marginTop: espaco.e6 }}>
            {PASSOS.map((p) => (
              <View key={p.n} style={{ flexGrow: 1, flexBasis: compacto ? '100%' : 260, minWidth: compacto ? '100%' : 220 }}>
                <View style={[estilos.num, { backgroundColor: c.brand }]}>
                  <Text style={{ fontFamily: fontes.display, fontSize: 20, color: c.onBrand }}>{p.n}</Text>
                </View>
                <Text style={[tipo.d4, { color: c.brand, marginTop: espaco.e3 }]}>{p.titulo}</Text>
                <Text style={[tipo.l2, { color: c.ink2, marginTop: espaco.e2 }]}>{p.texto}</Text>
              </View>
            ))}
          </View>
        </Secao>

        {/* Privacidade (bloco verde): painel de garantias, em cartões */}
        <Secao fundo={marca.musgo}>
          <Kicker claro>O que é íntimo, fica íntimo</Kicker>
          <Text style={[compacto ? tipo.d3 : tipo.d2, { color: marca.papel, maxWidth: 720 }]}>
            A sua intimidade com Deus é só sua.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.e4, marginTop: espaco.e6 }}>
            {[
              { icone: 'cifra', titulo: 'Diário cifrado', texto: 'O que você escreve, só quem realmente precisa saber vai saber: o nosso Deus.' },
              { icone: 'aparelho', titulo: 'Busca no seu aparelho', texto: 'A busca roda no seu aparelho, no seu secreto particular.' },
              { icone: 'consentimento', titulo: 'Consentimento específico', texto: 'Compartilhar áreas para oração é só com a sua permissão clara.' },
              { icone: 'exportar', titulo: 'No seu controle', texto: 'Exportar ou apagar tudo, a um toque.' },
            ].map((p) => (
              <View
                key={p.titulo}
                style={{
                  backgroundColor: '#25462F',
                  borderColor: 'rgba(248,249,244,0.12)', borderWidth: 1, ...forma.folha,
                  padding: espaco.e5, flexGrow: 1, flexBasis: compacto ? '100%' : '46%', minWidth: compacto ? '100%' : 320,
                }}
              >
                <IconeBeneficio nome={p.icone} cor={marca.broto} />
                <Text style={[tipo.d4, { color: marca.papel, marginTop: espaco.e3 }]}>{p.titulo}</Text>
                <Text style={[tipo.l3, { color: '#C7D6C7', marginTop: espaco.e2 }]}>{p.texto}</Text>
              </View>
            ))}
          </View>
        </Secao>

        {/* Preço */}
        <Secao fundo={c.bg}>
          <View style={{ alignItems: 'center' }}>
            <Kicker>O plano</Kicker>
            <Text style={[compacto ? tipo.d3 : tipo.d2, { color: c.ink, textAlign: 'center' }]}>Comece hoje. A primeira semente é agora.</Text>
            <View style={[estilos.precoCard, { backgroundColor: c.surface, borderColor: c.line }]}>
              <View style={[estilos.selo, { backgroundColor: c.accentSoft }]}>
                <Text style={[tipo.u4, { color: c.accent, textTransform: 'uppercase' }]}>7 dias grátis</Text>
              </View>
              <Text style={{ fontFamily: fontes.display, fontSize: 56, color: c.brand, marginTop: espaco.e4 }}>
                R$ 19,90<Text style={[tipo.u1, { color: c.ink3, fontFamily: fontes.uiMedio }]}> /mês</Text>
              </Text>
              <Text style={[tipo.l3, { color: c.ink2, fontStyle: 'italic', marginTop: espaco.e2, textAlign: 'center' }]}>
                uma semente para manter o app ativo e plantar novos conteúdos
              </Text>
              <View style={{ gap: espaco.e3, marginTop: espaco.e5, marginBottom: espaco.e5, alignSelf: 'stretch' }}>
                {[
                  'Acesso completo a trilhas, estações e diário',
                  'Oração com lembretes e respostas guardadas',
                  'Intercessão em unidade, respeitando a sua privacidade',
                  'Cartão ou PIX. Cancele quando quiser',
                ].map((item) => (
                  <View key={item} style={{ flexDirection: 'row', gap: espaco.e3 }}>
                    <View style={{ marginTop: 2 }}><Check cor={c.brand} /></View>
                    <Text style={[tipo.l3, { color: c.ink2, flex: 1 }]}>{item}</Text>
                  </View>
                ))}
              </View>
              <Botao bloco tamanho="lg" haptico onPress={irCadastrar}>Assinar e começar</Botao>
              <Text style={[tipo.u3, { color: c.ink3, marginTop: espaco.e3, textAlign: 'center' }]}>Sete dias para experimentar sem cobrança. Sem cartão preso.</Text>
            </View>
          </View>
        </Secao>

        {/* FAQ */}
        <Secao fundo={c.surface2}>
          <Kicker>Perguntas comuns</Kicker>
          <Text style={[compacto ? tipo.d3 : tipo.d2, { color: c.ink }]}>Antes de plantar a primeira semente.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.e5, marginTop: espaco.e6 }}>
            {FAQ.map((f) => (
              <View key={f.q} style={{ flexGrow: 1, flexBasis: compacto ? '100%' : 400, minWidth: compacto ? '100%' : 320 }}>
                <Text style={[tipo.d4, { color: c.ink }]}>{f.q}</Text>
                <Text style={[tipo.l2, { color: c.ink2, marginTop: espaco.e2 }]}>{f.a}</Text>
              </View>
            ))}
          </View>
          <Text style={[tipo.l2, { color: c.ink2, marginTop: espaco.e6 }]}>
            Ainda tem uma dúvida? Fale com a gente em{' '}
            <Text onPress={() => Linking.openURL(`mailto:${SUPORTE}`)} style={{ fontFamily: fontes.uiForte, color: c.accent }}>{SUPORTE}</Text>.
          </Text>
        </Secao>

        {/* CTA final (bloco verde) */}
        <Secao fundo={marca.musgo}>
          <View style={{ alignItems: 'center' }}>
            <Marca cor={marca.papel} tamanho={52} />
            <Text style={[compacto ? tipo.d2 : tipo.d1, { color: marca.papel, textAlign: 'center', marginTop: espaco.e4 }]}>
              Do jardim ao jardim. Deus com a gente.
            </Text>
            <Text style={[tipo.l1, { color: '#D6E2D6', textAlign: 'center', marginTop: espaco.e4, maxWidth: 560 }]}>
              A história toda caminha para um encontro. O meu jardim é onde, todo dia, você dá um passo em direção a Ele.
            </Text>
            <View style={{ marginTop: espaco.e5 }}>
              <Botao tamanho="lg" variante="quieto" haptico onPress={irCadastrar}>Começar — 7 dias grátis</Botao>
            </View>
            <Text style={[tipo.l3, { color: '#9FB6A4', fontStyle: 'italic', marginTop: espaco.e5, textAlign: 'center' }]}>
              “Eis o tabernáculo de Deus com os homens.” — Apocalipse 21.3
            </Text>
          </View>
        </Secao>

        {/* Rodapé */}
        <View style={{ width: '100%', backgroundColor: marca.noite, alignItems: 'center', paddingHorizontal: espaco.e5, paddingVertical: espaco.e7 }}>
          <View style={{ width: '100%', maxWidth: MAXW, gap: espaco.e4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.e2 }}>
              <Marca cor={marca.papel} tamanho={26} />
              <Text style={[tipo.d4, { color: marca.papel }]}>o meu jardim</Text>
            </View>
            <Text style={[tipo.l3, { color: '#9FB6A4', maxWidth: 360 }]}>
              Constância espiritual movida pela graça. Mais perto da presença de Deus, um dia de cada vez.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.e5, marginTop: espaco.e2 }}>
              <Pressable onPress={() => Linking.openURL(INSTAGRAM)} hitSlop={8}>
                <Text style={[tipo.u2, { color: marca.papel }]}>Instagram</Text>
              </Pressable>
              <Pressable onPress={() => Linking.openURL(`mailto:${SUPORTE}`)} hitSlop={8}>
                <Text style={[tipo.u2, { color: marca.papel }]}>{SUPORTE}</Text>
              </Pressable>
              <Pressable onPress={irCadastrar} hitSlop={8}>
                <Text style={[tipo.u2, { color: marca.papel }]}>Criar conta</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/termos')} hitSlop={8}>
                <Text style={[tipo.u2, { color: marca.papel }]}>Termos</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/privacidade')} hitSlop={8}>
                <Text style={[tipo.u2, { color: marca.papel }]}>Privacidade</Text>
              </Pressable>
            </View>
            <Text style={[tipo.u3, { color: '#6E7A6E', marginTop: espaco.e3 }]}>© O meu jardim. Todos os direitos reservados.</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, padding: espaco.e5, ...forma.folha },
  num: { width: 44, height: 44, borderRadius: forma.pilula, alignItems: 'center', justifyContent: 'center' },
  precoCard: {
    borderWidth: 1, ...forma.folha, padding: espaco.e6, marginTop: espaco.e6,
    maxWidth: 480, width: '100%', alignItems: 'center',
  },
  selo: { paddingVertical: espaco.e1, paddingHorizontal: espaco.e4, borderRadius: forma.pilula },
});
