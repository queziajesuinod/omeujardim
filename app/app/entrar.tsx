// Entrar. A porta de quem já tem conta.
//
// Erros ditos com honestidade: credencial errada não revela se o e-mail
// existe, conta bloqueada explica a espera, e servidor ocupado (o limitador
// de senha segurando força bruta) pede um instante em vez de um erro seco.

import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Campo } from '../componentes/Campo';
import { Botao } from '../componentes/Botao';
import { useCores } from '../lib/tema-contexto';
import { useSessao } from '../lib/sessao';
import { useLarguraConteudo } from '../lib/layout';
import { lerPreferencia, gravarPreferencia } from '../lib/preferencia';
import { ErroApi } from '../lib/api';
import { podeInstalar, instalar } from '../lib/lembrete';
import { espaco, forma, tipo, fontes } from '../tema/tema';

/** A marca: o jardim fechado (o arco) com o broto dentro. */
function Marca({ cor }: { cor: string }) {
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64">
      <Path d="M12 57 V28 a20 20 0 0 1 40 0 V57" fill="none" stroke={cor} strokeWidth={5} strokeLinecap="round" />
      <Path d="M32 53 V41" fill="none" stroke={cor} strokeWidth={4} strokeLinecap="round" />
      <Path d="M31 43 C 22 42.5, 17.6 36, 18.4 28 C 27 29, 31.8 35, 31 43 Z" fill={cor} />
      <Path d="M33 43 C 42 42.5, 46.4 36, 45.6 28 C 37 29, 32.2 35, 33 43 Z" fill={cor} />
    </Svg>
  );
}

function mensagemDoErro(e: unknown): string {
  if (e instanceof ErroApi) {
    if (e.status === 429) return 'Muitas tentativas. Tente de novo em alguns minutos.';
    if (e.status === 503) return 'O servidor está ocupado agora. Aguarde um instante e tente de novo.';
    return e.message; // o servidor já manda um texto honesto para o 401
  }
  return 'Não consegui falar com o servidor. Verifique a conexão e tente de novo.';
}

export default function Entrar() {
  const c = useCores();
  const maxLargura = useLarguraConteudo();
  const { entrar } = useSessao();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [instalavel, setInstalavel] = useState(false);

  // Preenche o e-mail que ficou guardado, se a pessoa pediu para lembrar.
  // A SENHA nunca é guardada: senha em preferência (localStorage na web) é o
  // mesmo problema de guardar token fora do cookie httpOnly — o gerenciador do
  // sistema é quem cuida disso (autoComplete abaixo). Ver invariante de tokens.
  useEffect(() => {
    (async () => {
      // Higiene: apaga a senha que versões anteriores possam ter deixado gravada.
      await gravarPreferencia('login_senha', '');
      if ((await lerPreferencia('login_lembrar')) === 'sim') {
        setLembrar(true);
        setEmail((await lerPreferencia('login_email')) ?? '');
      }
    })();
  }, []);

  // Adicionar à tela inicial (PWA). O beforeinstallprompt é capturado no
  // _layout; aqui só revelamos o botão quando ele existir. O evento pode já ter
  // chegado antes desta tela montar (checamos agora) ou chegar depois (ouvimos).
  // No app nativo e no iOS/Safari, podeInstalar() é sempre falso e nada aparece.
  useEffect(() => {
    setInstalavel(podeInstalar());
    if (typeof window === 'undefined') return;
    const revelar = () => setInstalavel(true);
    const esconder = () => setInstalavel(false);
    window.addEventListener('beforeinstallprompt', revelar);
    window.addEventListener('appinstalled', esconder);
    // Reforço, caso o evento tenha chegado entre o mount e o registro acima.
    const t = setTimeout(() => setInstalavel(podeInstalar()), 1500);
    return () => {
      window.removeEventListener('beforeinstallprompt', revelar);
      window.removeEventListener('appinstalled', esconder);
      clearTimeout(t);
    };
  }, []);

  async function adicionarNaTela() {
    if (await instalar()) setInstalavel(false);
  }

  async function enviar() {
    setErro(null);
    setCarregando(true);
    // Guardar o e-mail antes de entrar: vale mesmo que a senha esteja errada e a
    // pessoa volte a tentar. Se desmarcou, apaga o rastro. A senha nunca entra.
    if (lembrar) {
      await gravarPreferencia('login_lembrar', 'sim');
      await gravarPreferencia('login_email', email.trim());
    } else {
      await gravarPreferencia('login_lembrar', 'nao');
      await gravarPreferencia('login_email', '');
    }
    try {
      await entrar(email.trim(), senha);
      // A guarda de rota no _layout leva para /hoje quando a sessão abre.
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setCarregando(false);
    }
  }

  const podeEnviar = email.trim().length > 3 && senha.length > 0 && !carregando;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]} keyboardShouldPersistTaps="handled">
        <View style={{ flexGrow: 1 }} />
        <View style={estilos.marca}>
          <Marca cor={c.brand} />
          <Text style={[tipo.d3, { color: c.ink }]}>o meu jardim</Text>
          <Text style={[estilos.tagline, { color: c.ink2 }]}>Jardim fechado és tu, fonte selada.</Text>
        </View>

        <View style={{ gap: espaco.e4, marginTop: espaco.e6 }}>
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
            autoComplete="current-password"
            placeholder="sua senha"
            onSubmitEditing={() => podeEnviar && enviar()}
            returnKeyType="go"
          />

          <Pressable
            onPress={() => setLembrar((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: lembrar }}
            style={estilos.lembrar}
            hitSlop={8}
          >
            <View style={[estilos.caixa, { borderColor: lembrar ? c.brand : c.line, backgroundColor: lembrar ? c.brand : 'transparent' }]}>
              {lembrar ? (
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 12l5 5L20 6" stroke={c.onBrand} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              ) : null}
            </View>
            <Text style={[tipo.u2, { color: c.ink2 }]}>Gravar meu e-mail neste aparelho</Text>
          </Pressable>

          {erro ? <Text style={[tipo.u3, { color: c.alert }]}>{erro}</Text> : null}

          <Botao bloco onPress={enviar} carregando={carregando} desabilitado={!podeEnviar}>
            Entrar
          </Botao>

          {instalavel ? (
            <Botao variante="vazado" bloco onPress={adicionarNaTela}>
              Adicionar à tela inicial
            </Botao>
          ) : null}
        </View>

        <View style={{ flexGrow: 1 }} />

        <View style={estilos.rodape}>
          <Text style={[tipo.u3, { color: c.ink3 }]}>Ainda não tem conta? </Text>
          <Link href="/cadastro" replace>
            <Text style={[tipo.u2, { color: c.brand }]}>Criar uma conta</Text>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  corpo: {
    paddingHorizontal: espaco.e5,
    paddingTop: 56,
    paddingBottom: 40,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  marca: { alignItems: 'center', gap: espaco.e3 },
  lembrar: { flexDirection: 'row', alignItems: 'center', gap: espaco.e3, paddingVertical: espaco.e1 },
  caixa: {
    width: 22, height: 22, borderRadius: forma.campo, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  tagline: {
    fontFamily: fontes.leituraLeve, fontSize: 17, lineHeight: 26,
    textAlign: 'center', maxWidth: 260,
  },
  rodape: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: espaco.e6 },
});
