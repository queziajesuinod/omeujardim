// Criar conta.
//
// Duas caixas de consentimento, separadas e vazias por padrão. A segunda é a
// que a LGPD (art. 11) exige em destaque, porque convicção religiosa é dado
// sensível: ela não vem marcada, não é escondida em "li e aceito", e o texto
// diz que dá para revogar. Sem as duas marcadas, o botão não habilita.

import { useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Campo } from '../componentes/Campo';
import { Botao } from '../componentes/Botao';
import { Folha } from '../componentes/Folha';
import { useCores } from '../lib/tema-contexto';
import { useLarguraConteudo } from '../lib/layout';
import { voltar } from '../lib/voltar';
import { useSessao } from '../lib/sessao';
import { useDocumento, type ChaveDocumento } from '../lib/documentos';
import { ErroApi } from '../lib/api';
import { espaco, forma, tipo, fontes } from '../tema/tema';

/** A marca: o jardim fechado (o arco) com o broto dentro. */
function Marca({ cor }: { cor: string }) {
  return (
    <Svg width={60} height={60} viewBox="0 0 64 64">
      <Path d="M12 57 V28 a20 20 0 0 1 40 0 V57" fill="none" stroke={cor} strokeWidth={5} strokeLinecap="round" />
      <Path d="M32 53 V41" fill="none" stroke={cor} strokeWidth={4} strokeLinecap="round" />
      <Path d="M31 43 C 22 42.5, 17.6 36, 18.4 28 C 27 29, 31.8 35, 31 43 Z" fill={cor} />
      <Path d="M33 43 C 42 42.5, 46.4 36, 45.6 28 C 37 29, 32.2 35, 33 43 Z" fill={cor} />
    </Svg>
  );
}

function mensagemDoErro(e: unknown): string {
  if (e instanceof ErroApi) {
    if (e.status === 422) return e.message; // senha fraca: o servidor lista o que falta
    if (e.status === 429) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    if (e.status === 503) return 'O servidor está ocupado agora. Aguarde um instante.';
    return e.message;
  }
  return 'Não consegui falar com o servidor. Verifique a conexão e tente de novo.';
}

function Consentimento({
  marcado, aoTocar, children,
}: { marcado: boolean; aoTocar: () => void; children: React.ReactNode }) {
  const c = useCores();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
      onPress={aoTocar}
      style={estilos.consent}
      hitSlop={6}
    >
      <View style={[estilos.caixa, { borderColor: marcado ? c.brand : c.line, backgroundColor: marcado ? c.brand : 'transparent' }]}>
        {marcado ? (
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M5 12l5 5L20 6" stroke={c.onBrand} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : null}
      </View>
      <Text style={[tipo.u3, { color: c.ink2, flex: 1 }]}>{children}</Text>
    </Pressable>
  );
}

export default function Cadastro() {
  const c = useCores();
  const maxLargura = useLarguraConteudo();
  const { cadastrar } = useSessao();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [aceitaSensiveis, setAceitaSensiveis] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [docAberto, setDocAberto] = useState<ChaveDocumento | null>(null);
  const doc = useDocumento(docAberto);

  async function enviar() {
    setErro(null);
    setCarregando(true);
    try {
      const r = await cadastrar({ nome: nome.trim(), email: email.trim(), senha });
      if (r === 'ja_existe') {
        setErro('Já existe uma conta com esse e-mail. Tente entrar.');
      }
      // 'entrou' → a guarda de rota leva para /hoje.
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setCarregando(false);
    }
  }

  const podeEnviar =
    nome.trim().length >= 2 &&
    email.trim().length > 3 &&
    senha.length >= 10 &&
    aceitaTermos &&
    aceitaSensiveis &&
    !carregando;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]} keyboardShouldPersistTaps="handled">
        {/* Voltar discreto, sem barra pesada: a tela é um convite, não um formulário burocrático. */}
        <Pressable onPress={() => voltar('/entrar')} style={estilos.voltar} hitSlop={8} accessibilityRole="button" accessibilityLabel="Voltar">
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={c.ink3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[tipo.u3, { color: c.ink3 }]}>Voltar</Text>
        </Pressable>

        {/* Marca e boas-vindas */}
        <View style={estilos.marca}>
          <Marca cor={c.brand} />
          <Text style={[tipo.d3, { color: c.ink, marginTop: espaco.e2 }]}>o meu jardim</Text>
          <Text style={[estilos.intro, { color: c.ink2 }]}>
            Comece o seu jardim. Leva um minuto, e o que você escreve fica só seu.
          </Text>
        </View>

        {/* O formulário, num cartão de folha */}
        <View style={[estilos.cartao, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={{ gap: espaco.e4 }}>
            <Campo rotulo="Nome" value={nome} onChangeText={setNome} autoComplete="name" placeholder="como te chamamos" />
            <Campo
              rotulo="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              placeholder="voce@exemplo.com"
            />
            <Campo
              rotulo="Senha"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              autoComplete="new-password"
              placeholder="pelo menos 10 caracteres"
            />
          </View>

          <View style={[estilos.divisor, { backgroundColor: c.line }]} />

          <View style={{ gap: espaco.e3 }}>
            <Consentimento marcado={aceitaTermos} aoTocar={() => setAceitaTermos((v) => !v)}>
              Li e concordo com os termos de uso e a política de privacidade.
            </Consentimento>
            <View style={estilos.linksDocs}>
              <Pressable onPress={() => setDocAberto('termos')}>
                <Text style={[tipo.u3, { color: c.brand }]}>Ler os termos de uso</Text>
              </Pressable>
              <Text style={[tipo.u3, { color: c.ink3 }]}> · </Text>
              <Pressable onPress={() => setDocAberto('privacidade')}>
                <Text style={[tipo.u3, { color: c.brand }]}>Política de privacidade</Text>
              </Pressable>
            </View>

            {/* Dado sensível em destaque (LGPD art. 11): num painel próprio, nunca escondido. */}
            <View style={[estilos.destaque, { backgroundColor: c.brandSoft, borderColor: c.line }]}>
              <Text style={[tipo.u2, { color: c.brand, marginBottom: espaco.e2 }]}>Um cuidado a mais, porque isto é íntimo</Text>
              <Consentimento marcado={aceitaSensiveis} aoTocar={() => setAceitaSensiveis((v) => !v)}>
                Autorizo o o meu jardim a guardar, cifrado e só para mim, o que eu
                registrar da minha caminhada com Deus, que revela a minha convicção
                religiosa (um dado sensível). Posso revogar quando quiser.
              </Consentimento>
            </View>
          </View>

          {erro ? <Text style={[tipo.u3, { color: c.alert, marginTop: espaco.e2 }]}>{erro}</Text> : null}

          <Botao bloco haptico onPress={enviar} carregando={carregando} desabilitado={!podeEnviar}>
            Criar conta
          </Botao>
        </View>

        <View style={estilos.rodape}>
          <Text style={[tipo.u3, { color: c.ink3 }]}>Já tem conta? </Text>
          <Link href="/entrar" replace>
            <Text style={[tipo.u2, { color: c.brand }]}>Entrar</Text>
          </Link>
        </View>
      </ScrollView>

      <Folha visivel={docAberto !== null} aoFechar={() => setDocAberto(null)} titulo={doc.data?.titulo ?? 'Carregando…'}>
        {doc.isLoading ? (
          <ActivityIndicator color={c.brand} />
        ) : doc.data ? (
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: espaco.e4 }}>
            <Text style={[estilos.docTexto, { color: c.ink2 }]}>{doc.data.corpo}</Text>
          </ScrollView>
        ) : (
          <Text style={[tipo.u3, { color: c.ink3 }]}>
            Este texto ainda não foi publicado. Fale com o suporte se precisar dele antes de aceitar.
          </Text>
        )}
      </Folha>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  corpo: {
    paddingHorizontal: espaco.e5,
    paddingTop: espaco.e3,
    paddingBottom: espaco.e8,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  voltar: { flexDirection: 'row', alignItems: 'center', gap: espaco.e1, alignSelf: 'flex-start', paddingVertical: espaco.e1 },
  marca: { alignItems: 'center', marginTop: espaco.e4 },
  intro: {
    fontFamily: fontes.leituraLeve, fontSize: 17, lineHeight: 26,
    textAlign: 'center', maxWidth: 320, marginTop: espaco.e3,
  },
  cartao: {
    marginTop: espaco.e6,
    borderWidth: 1,
    ...forma.folha,
    padding: espaco.e5,
    gap: espaco.e5,
  },
  divisor: { height: 1, marginVertical: espaco.e1 },
  consent: { flexDirection: 'row', gap: espaco.e3, alignItems: 'flex-start' },
  linksDocs: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginLeft: 36, marginTop: -espaco.e1 },
  destaque: { borderWidth: 1, borderRadius: forma.card, padding: espaco.e4, marginTop: espaco.e2 },
  docTexto: { fontFamily: fontes.leituraLeve, fontSize: 15, lineHeight: 24 },
  caixa: {
    width: 24, height: 24, borderRadius: forma.campo, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  rodape: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: espaco.e6 },
});
