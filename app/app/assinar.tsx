// Assinatura. A porta paga do jardim: para usar o app, é preciso uma assinatura.
//
// O cartão é tokenizado no próprio aparelho (lib/efi-token); o número nunca
// chega ao nosso servidor. O consentimento da cobrança recorrente é explícito e
// mostra o valor, o ciclo e a data da 1ª cobrança antes de confirmar (CDC).
// Ver PLANO-ASSINATURAS.md.

import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { Campo } from '../componentes/Campo';
import { Botao } from '../componentes/Botao';
import { useCores } from '../lib/tema-contexto';
import { useLarguraConteudo } from '../lib/layout';
import { useSessao } from '../lib/sessao';
import { useAssinatura, useInvalidarAssinatura, assinarCartao, iniciarTrial, pagarPix, reais } from '../lib/assinatura';
import { tokenizarCartao } from '../lib/efi-token';
import { soDigitos, mascaraCpfCnpj, mascaraTelefone, mascaraValidade, mascaraData, mascaraCartao, dataParaISO } from '../lib/mascaras';
import { ErroApi } from '../lib/api';
import { espaco, forma, tipo, fontes } from '../tema/tema';

function mensagemDoErro(e: unknown): string {
  if (e instanceof ErroApi) {
    if (e.status === 429) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    // 502 traz o motivo real da Efí (cartão recusado, dados inválidos, etc.).
    return e.message || 'Não consegui processar o cartão. Confira os dados e tente de novo.';
  }
  if (e instanceof Error) return e.message;
  return 'Algo falhou aqui. Tente de novo.';
}

function IconeCartao({ cor }: { cor: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={5} width={20} height={14} rx={2.5} stroke={cor} strokeWidth={1.8} />
      <Path d="M2 10h20" stroke={cor} strokeWidth={1.8} />
      <Path d="M6 15h4" stroke={cor} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function IconePix({ cor }: { cor: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l3.2 3.2a3 3 0 0 0 2.1.9H18L21 10a3 3 0 0 1 0 4l-2.7 2.9h-.7a3 3 0 0 0-2.1.9L12 21l-3.2-3.2a3 3 0 0 0-2.1-.9H6L3 14a3 3 0 0 1 0-4l2.7-2.9h.7a3 3 0 0 0 2.1-.9z"
        stroke={cor} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

function MetodoBotao({ ativo, cor, icone, titulo, nota, aoTocar }: {
  ativo: boolean; cor: any; icone: React.ReactNode; titulo: string; nota: string; aoTocar: () => void;
}) {
  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="radio"
      accessibilityState={{ selected: ativo }}
      style={[estilos.metodo, { borderColor: ativo ? cor.brand : cor.line, backgroundColor: ativo ? cor.brandSoft : cor.surface, borderWidth: ativo ? 2 : 1 }]}
    >
      {icone}
      <Text style={[tipo.u2, { color: ativo ? cor.brand : cor.ink, marginTop: espaco.e2 }]}>{titulo}</Text>
      <Text style={[tipo.u4, { color: cor.ink3, marginTop: 2, textAlign: 'center' }]}>{nota}</Text>
    </Pressable>
  );
}

export default function Assinar() {
  const c = useCores();
  const maxLargura = useLarguraConteudo();
  const { sair } = useSessao();
  const assinatura = useAssinatura();
  const invalidar = useInvalidarAssinatura();

  const [numero, setNumero] = useState('');
  const [validade, setValidade] = useState(''); // MM/AA
  const [cvv, setCvv] = useState('');
  const [nomeCartao, setNomeCartao] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [nascimento, setNascimento] = useState(''); // AAAA-MM-DD
  const [aceita, setAceita] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<null | 'cartao' | 'trial' | 'pix'>(null);
  const [pix, setPix] = useState<{ imagemQrcode: string; qrcode: string } | null>(null);
  const [metodo, setMetodo] = useState<'cartao' | 'pix' | null>(null);

  const dados = assinatura.data;
  const trocaPreco = !!dados?.precoNovoCentavos;

  // Depois de mostrar o QR do PIX, revalida a assinatura de tempos em tempos. O
  // polling do servidor confirma o pagamento em ~1 min; quando a assinatura vira
  // usável, o guard do _layout leva para /hoje sozinho. Para em 15 min.
  useEffect(() => {
    if (!pix) return;
    const tique = setInterval(() => invalidar(), 5000);
    const limite = setTimeout(() => clearInterval(tique), 15 * 60 * 1000);
    return () => { clearInterval(tique); clearTimeout(limite); };
  }, [pix]);
  // O preço a cobrar: numa troca marcada, o valor novo; senão, o vigente do plano.
  const valorMostrar = trocaPreco ? dados!.precoNovoCentavos! : (dados?.plano.valorCentavos ?? null);
  const podeTrial = dados?.status === 'nenhuma' && !trocaPreco;

  async function assinar() {
    setErro(null);
    setOcupado('cartao');
    try {
      const [mm, aa] = validade.split('/').map((s) => s.trim());
      const anoValidade = aa && aa.length === 2 ? `20${aa}` : aa;
      const { payment_token } = await tokenizarCartao({
        numero: soDigitos(numero), cvv, mesValidade: mm, anoValidade,
        nome: nomeCartao.trim(), documento: soDigitos(cpf),
      });
      const r = await assinarCartao({
        payment_token, nome: nomeCartao.trim(), cpf: soDigitos(cpf), telefone: soDigitos(telefone),
        nascimento: dataParaISO(nascimento),
      });
      invalidar(); // a guarda de rota leva para /hoje quando a assinatura vira usável
      // Cartão em análise: não fica preso sem aviso. O acesso abre pelo webhook.
      if (r && r.pago === false) {
        setErro('Pagamento em análise. Assim que for aprovado, seu acesso é liberado. Você pode fechar esta tela.');
      }
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setOcupado(null);
    }
  }

  async function comecarTrial() {
    setErro(null);
    setOcupado('trial');
    try {
      await iniciarTrial();
      invalidar();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setOcupado(null);
    }
  }

  async function gerarPix() {
    setErro(null);
    setOcupado('pix');
    try {
      const r = await pagarPix(cpf ? cpf.replace(/\D/g, '') : undefined);
      setPix({ imagemQrcode: r.imagemQrcode, qrcode: r.qrcode });
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setOcupado(null);
    }
  }

  const docDigitos = soDigitos(cpf);
  const cartaoCompleto =
    soDigitos(numero).length >= 13 && /^\d{2}\/\d{2}$/.test(validade) &&
    cvv.length >= 3 && nomeCartao.trim().split(/\s+/).filter(Boolean).length >= 2 &&
    (docDigitos.length === 11 || docDigitos.length === 14) &&
    soDigitos(telefone).length >= 10 && soDigitos(nascimento).length === 8 &&
    aceita && !ocupado;

  if (assinatura.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={c.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]} keyboardShouldPersistTaps="handled">
        <Text style={[tipo.d3, { color: c.ink }]}>{trocaPreco ? 'Seu plano mudou' : 'Assine para começar'}</Text>

        {/* Cartão do plano: valor e ciclo à vista, como manda o consentimento. */}
        <View style={[estilos.plano, { backgroundColor: c.brandSoft }]}>
          <Text style={[tipo.u4, { color: c.brand, letterSpacing: 1 }]}>{(dados?.plano.nome || 'Plano').toUpperCase()}</Text>
          <Text style={[estilos.preco, { color: c.ink }]}>{reais(valorMostrar)}<Text style={[tipo.u2, { color: c.ink2 }]}> /mês</Text></Text>
          {podeTrial ? (
            <Text style={[tipo.u3, { color: c.ink2 }]}>7 dias grátis. A 1ª cobrança só no 8º dia, e você pode cancelar antes.</Text>
          ) : trocaPreco ? (
            <Text style={[tipo.u3, { color: c.ink2 }]}>
              Você paga {reais(dados?.valorCentavos)} hoje. Para continuar, confirme o novo valor de {reais(dados?.precoNovoCentavos)} por mês.
            </Text>
          ) : (
            <Text style={[tipo.u3, { color: c.ink2 }]}>Cobrança mensal recorrente. Cancele quando quiser, num toque.</Text>
          )}
        </View>

        {podeTrial ? (
          <Botao bloco onPress={comecarTrial} carregando={ocupado === 'trial'} desabilitado={!!ocupado}>
            Começar 7 dias grátis
          </Botao>
        ) : null}

        <Text style={[estilos.secao, { color: c.ink3 }]}>{podeTrial ? 'OU PAGAR AGORA' : 'COMO VOCÊ QUER PAGAR'}</Text>

        {/* Escolha do método: primeiro o quê, depois os dados. */}
        <View style={estilos.metodos}>
          <MetodoBotao
            ativo={metodo === 'cartao'} cor={c} icone={<IconeCartao cor={metodo === 'cartao' ? c.brand : c.ink2} />}
            titulo="Cartão de crédito" nota="Recorrente, automático" aoTocar={() => { setErro(null); setMetodo('cartao'); }}
          />
          <MetodoBotao
            ativo={metodo === 'pix'} cor={c} icone={<IconePix cor={metodo === 'pix' ? c.brand : c.ink2} />}
            titulo="PIX" nota="Uma mensalidade" aoTocar={() => { setErro(null); setMetodo('pix'); }}
          />
        </View>

        {metodo === 'cartao' ? (
          <View style={{ gap: espaco.e4, marginTop: espaco.e5 }}>
            <Campo rotulo="Número do cartão" value={numero} onChangeText={(v) => setNumero(mascaraCartao(v))} keyboardType="number-pad" inputMode="numeric" placeholder="0000 0000 0000 0000" autoComplete="cc-number" />
            <View style={{ flexDirection: 'row', gap: espaco.e3 }}>
              <View style={{ flex: 1 }}><Campo rotulo="Validade" value={validade} onChangeText={(v) => setValidade(mascaraValidade(v))} keyboardType="number-pad" inputMode="numeric" placeholder="MM/AA" autoComplete="cc-exp" /></View>
              <View style={{ flex: 1 }}><Campo rotulo="CVV" value={cvv} onChangeText={(v) => setCvv(soDigitos(v).slice(0, 4))} keyboardType="number-pad" inputMode="numeric" placeholder="000" autoComplete="cc-csc" /></View>
            </View>
            <Campo rotulo="Nome no cartão" value={nomeCartao} onChangeText={setNomeCartao} autoCapitalize="characters" placeholder="nome e sobrenome, como no cartão" />
            <Campo rotulo="CPF ou CNPJ" value={cpf} onChangeText={(v) => setCpf(mascaraCpfCnpj(v))} keyboardType="number-pad" inputMode="numeric" placeholder="000.000.000-00" />
            <Campo rotulo="Celular" value={telefone} onChangeText={(v) => setTelefone(mascaraTelefone(v))} keyboardType="phone-pad" placeholder="(00) 00000-0000" />
            <Campo rotulo="Nascimento" value={nascimento} onChangeText={(v) => setNascimento(mascaraData(v))} keyboardType="number-pad" inputMode="numeric" placeholder="DD/MM/AAAA" />

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: aceita }}
              onPress={() => setAceita((v) => !v)}
              style={estilos.consent}
            >
              <View style={[estilos.caixa, { borderColor: aceita ? c.brand : c.line, backgroundColor: aceita ? c.brand : 'transparent' }]}>
                {aceita ? <Text style={{ color: c.onBrand, ...tipo.u2 }}>✓</Text> : null}
              </View>
              <Text style={[tipo.u3, { color: c.ink2, flex: 1 }]}>
                Autorizo a cobrança recorrente de {reais(valorMostrar)} por mês neste cartão, até que eu cancele.
              </Text>
            </Pressable>

            {erro ? <Text style={[tipo.u3, { color: c.alert }]}>{erro}</Text> : null}

            <Botao bloco onPress={assinar} carregando={ocupado === 'cartao'} desabilitado={!cartaoCompleto}>
              {trocaPreco ? 'Confirmar novo valor' : 'Assinar'}
            </Botao>
          </View>
        ) : null}

        {metodo === 'pix' ? (
          <View style={{ marginTop: espaco.e5 }}>
            {pix ? (
              <View style={[estilos.pixCaixa, { borderColor: c.line, backgroundColor: c.surface }]}>
                <Image source={{ uri: pix.imagemQrcode }} style={estilos.qr} resizeMode="contain" />
                <Text style={[tipo.u3, { color: c.ink3, marginTop: espaco.e2, textAlign: 'center' }]}>Escaneie no seu banco. A liberação é automática após o pagamento.</Text>
                <Text selectable style={[estilos.copia, { color: c.ink2, borderColor: c.line }]}>{pix.qrcode}</Text>
              </View>
            ) : (
              <>
                <Text style={[tipo.u3, { color: c.ink2, marginBottom: espaco.e4 }]}>
                  O PIX paga uma mensalidade agora, sem cobrança automática. No mês seguinte, você gera outro.
                </Text>
                {erro ? <Text style={[tipo.u3, { color: c.alert, marginBottom: espaco.e3 }]}>{erro}</Text> : null}
                <Botao bloco onPress={gerarPix} carregando={ocupado === 'pix'} desabilitado={!!ocupado}>
                  {`Gerar PIX de ${reais(valorMostrar)}`}
                </Botao>
              </>
            )}
          </View>
        ) : null}

        <Pressable onPress={sair} style={{ marginTop: espaco.e6, alignSelf: 'center' }}>
          <Text style={[tipo.u3, { color: c.ink3 }]}>Sair da conta</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  corpo: { paddingHorizontal: espaco.e5, paddingTop: espaco.e5, paddingBottom: espaco.e8, maxWidth: 440, width: '100%', alignSelf: 'center' },
  plano: { borderRadius: forma.card, padding: espaco.e5, gap: espaco.e2, marginTop: espaco.e4, marginBottom: espaco.e5 },
  preco: { fontFamily: fontes.display, fontSize: 40, lineHeight: 44 },
  secao: { ...tipo.u4, letterSpacing: 1, marginTop: espaco.e6, marginBottom: espaco.e4 },
  metodos: { flexDirection: 'row', gap: espaco.e3 },
  metodo: { flex: 1, alignItems: 'center', paddingVertical: espaco.e5, paddingHorizontal: espaco.e3, borderRadius: forma.card },
  consent: { flexDirection: 'row', gap: espaco.e3, alignItems: 'flex-start' },
  caixa: { width: 24, height: 24, borderRadius: forma.campo, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  pixBtn: { minHeight: forma.toqueMinimo, borderRadius: forma.pilula, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pixCaixa: { borderRadius: forma.card, borderWidth: 1, padding: espaco.e5, alignItems: 'center' },
  qr: { width: 200, height: 200 },
  copia: { ...tipo.u4, marginTop: espaco.e3, padding: espaco.e3, borderWidth: 1, borderRadius: forma.campo, width: '100%' },
});
