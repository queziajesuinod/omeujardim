// Ajustes: o dia, a conta, os lembretes e os direitos do titular (LGPD).
//
// O padrão é o do mockup: seções com rótulo e linhas de "isto → valor". Os
// direitos não ficam escondidos: exportar tudo, revogar o consentimento e
// excluir a conta estão aqui, ditos sem rodeio. A exclusão é em dois toques e
// explica o prazo de 30 dias, que é quando os dados somem do banco de verdade.

import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Botao } from '../componentes/Botao';
import { Campo } from '../componentes/Campo';
import { Cabecalho } from '../componentes/Cabecalho';
import { BarraNavegacao } from '../componentes/BarraNavegacao';
import { Folha } from '../componentes/Folha';
import { useCores, useTema } from '../lib/tema-contexto';
import { useLarguraConteudo } from '../lib/layout';
import { voltar } from '../lib/voltar';
import { useSessao } from '../lib/sessao';
import { useEu, exportarDados, useRevogarConsentimento, useExcluirConta, useAtualizarInicioDia } from '../lib/conta';
import { useAssinatura, useInvalidarAssinatura, cancelarAssinatura, trocarParaPix, reais, dataBR } from '../lib/assinatura';
import { salvarInicioDia, horaDe } from '../lib/inicio-dia';
import {
  suportaPush, estadoLembrete, ligarLembrete, desligarLembrete,
  ligarWhatsapp, desligarWhatsapp, ehDispositivoApple, estaInstalado,
  type EstadoLembrete,
} from '../lib/lembrete';
import { espaco, forma, tipo } from '../tema/tema';

const TEMAS: { valor: 'claro' | 'escuro' | 'sistema'; nome: string }[] = [
  { valor: 'claro', nome: 'Claro' },
  { valor: 'escuro', nome: 'Escuro' },
  { valor: 'sistema', nome: 'Do sistema' },
];

const HORAS_INICIO = [3, 4, 5, 6, 7];

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const c = useCores();
  return (
    <View style={{ marginTop: espaco.e6 }}>
      <Text style={[tipo.u4, { color: c.ink3, letterSpacing: 1.3, marginBottom: espaco.e3 }]}>
        {titulo.toUpperCase()}
      </Text>
      <View style={{ gap: espaco.e3 }}>{children}</View>
    </View>
  );
}

// A linha do mockup: rótulo à esquerda, valor à direita, o cartão todo tocável.
function Linha({ titulo, valor, corValor, aoTocar }: {
  titulo: string; valor?: string; corValor?: string; aoTocar?: () => void;
}) {
  const c = useCores();
  return (
    <Pressable
      onPress={aoTocar}
      disabled={!aoTocar}
      style={[estilos.linha, { backgroundColor: c.surface, borderColor: c.line }]}
    >
      <Text style={[tipo.u1, { color: c.ink, flex: 1 }]}>{titulo}</Text>
      {valor ? <Text style={[tipo.u3, { color: corValor ?? c.ink3 }]}>{valor}</Text> : null}
    </Pressable>
  );
}

function SecaoLembretes() {
  const c = useCores();
  const eu = useEu();
  const [estado, setEstado] = useState<EstadoLembrete>('indisponivel');
  const [ocupado, setOcupado] = useState(false);

  const [numero, setNumero] = useState('');
  const [zapSalvando, setZapSalvando] = useState(false);
  const [zapRecado, setZapRecado] = useState<string | null>(null);
  const temZap = !!eu.data?.whatsappOptInEm;

  useEffect(() => { estadoLembrete().then(setEstado); }, []);
  useEffect(() => { if (eu.data?.whatsappNumero) setNumero(eu.data.whatsappNumero); }, [eu.data?.whatsappNumero]);

  async function alternarPush() {
    setOcupado(true);
    try {
      if (estado === 'ligado') { await desligarLembrete(); setEstado('desligado'); }
      else setEstado(await ligarLembrete());
    } finally {
      setOcupado(false);
    }
  }

  async function salvarZap() {
    setZapSalvando(true);
    setZapRecado(null);
    try {
      await ligarWhatsapp(numero.trim());
      setZapRecado('Pronto. Toda mensagem traz como sair.');
      eu.refetch();
    } catch {
      setZapRecado('Confira o número, no formato +55DDDNÚMERO.');
    } finally {
      setZapSalvando(false);
    }
  }

  async function removerZap() {
    setZapSalvando(true);
    try {
      await desligarWhatsapp();
      setNumero('');
      setZapRecado(null);
      eu.refetch();
    } finally {
      setZapSalvando(false);
    }
  }

  // iPhone na aba do navegador: o Web Push só existe com o app na Tela de Início.
  const precisaInstalarIOS = !suportaPush && ehDispositivoApple() && !estaInstalado();

  const rotuloPush =
    estado === 'ligado' ? 'Desligar avisos neste aparelho'
    : estado === 'negado' ? 'Avisos bloqueados pelo navegador'
    : precisaInstalarIOS ? 'Adicione à Tela de Início para ativar'
    : estado === 'indisponivel' ? 'Disponível na versão web (PWA)'
    : 'Ligar avisos neste aparelho';

  return (
    <Secao titulo="Lembretes">
      <Botao
        variante={estado === 'ligado' ? 'vazado' : 'primario'}
        onPress={alternarPush}
        carregando={ocupado}
        desabilitado={!suportaPush || estado === 'negado' || estado === 'indisponivel'}
      >
        {rotuloPush}
      </Botao>
      {precisaInstalarIOS ? (
        <Text style={[tipo.u4, { color: c.ink3 }]}>
          No iPhone, o lembrete só chega com o app na Tela de Início. No Safari,
          toque em Compartilhar e depois em Adicionar à Tela de Início; abra o app
          por ali e ligue por aqui. É só um lembrete das suas práticas, nunca uma
          cobrança.
        </Text>
      ) : (
        <Text style={[tipo.u4, { color: c.ink3 }]}>
          Um aviso por dia, cerca de 20 minutos depois do horário em que o seu
          dia começa (em "Meu dia começa às"), e só se você ainda não regou. A
          prévia nunca mostra o que você escreve.
        </Text>
      )}

      <View style={[estilos.cartao, { backgroundColor: c.surface, borderColor: c.line, marginTop: espaco.e2 }]}>
        <Text style={[tipo.u2, { color: c.ink }]}>Prefere por WhatsApp?</Text>
        <Text style={[tipo.u4, { color: c.ink3, marginTop: espaco.e1, marginBottom: espaco.e3 }]}>
          Só para quem não instala o app. Você entra e sai quando quiser; toda
          mensagem traz como sair.
        </Text>
        <Campo
          rotulo="Número com DDD"
          value={numero}
          onChangeText={setNumero}
          placeholder="+5511999999999"
          autoCapitalize="none"
          keyboardType="phone-pad"
        />
        <View style={{ flexDirection: 'row', gap: espaco.e5, alignItems: 'center', marginTop: espaco.e3 }}>
          <Pressable onPress={salvarZap} disabled={zapSalvando}>
            <Text style={[tipo.u2, { color: c.brand }]}>{temZap ? 'Atualizar número' : 'Ativar WhatsApp'}</Text>
          </Pressable>
          {temZap ? (
            <Pressable onPress={removerZap} disabled={zapSalvando}>
              <Text style={[tipo.u3, { color: c.ink3 }]}>Sair do WhatsApp</Text>
            </Pressable>
          ) : null}
        </View>
        {zapRecado ? <Text style={[tipo.u4, { color: c.ink2, marginTop: espaco.e2 }]}>{zapRecado}</Text> : null}
      </View>
    </Secao>
  );
}

// Opção (b): PIX -> cartão só perto do vencimento (o backend também valida).
function trocaCartaoLiberada(periodoFim: string | null): boolean {
  if (!periodoFim) return true;
  const lim = new Date();
  lim.setDate(lim.getDate() + 3);
  return periodoFim <= lim.toISOString().slice(0, 10);
}

function SecaoAssinatura() {
  const c = useCores();
  const assinatura = useAssinatura();
  const invalidar = useInvalidarAssinatura();
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const d = assinatura.data;
  if (!d || d.status === 'isento') return null; // equipe não vê cobrança

  const podeCancelar = ['trial', 'ativa', 'inadimplente'].includes(d.status);
  const rotulo =
    d.status === 'trial' ? `Em teste grátis até ${dataBR(d.trialAte)}`
    : d.status === 'ativa' ? `Ativa · próxima cobrança em ${dataBR(d.proximaCobranca)}`
    : d.status === 'cancelada' ? `Cancelada · acesso até ${dataBR(d.periodoFim)}`
    : d.status === 'inadimplente' ? 'Pagamento pendente'
    : d.status === 'iniciada' ? 'Aguardando pagamento'
    : 'Sem assinatura';

  async function cancelar() {
    setOcupado(true);
    try { await cancelarAssinatura(); invalidar(); assinatura.refetch(); setConfirmando(false); }
    finally { setOcupado(false); }
  }

  async function passarParaPix() {
    setOcupado(true);
    try { await trocarParaPix(); invalidar(); assinatura.refetch(); }
    finally { setOcupado(false); }
  }

  return (
    <Secao titulo="Assinatura">
      <View style={[estilos.cartao, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[tipo.u1, { color: c.ink }]}>{rotulo}</Text>
        {d.valorCentavos ? (
          <Text style={[tipo.u3, { color: c.ink3, marginTop: espaco.e1 }]}>{reais(d.valorCentavos)} por mês</Text>
        ) : null}
        {d.precoNovoCentavos ? (
          <Text style={[tipo.u4, { color: c.accent, marginTop: espaco.e2 }]}>
            Seu plano vai para {reais(d.precoNovoCentavos)}. Confirme para continuar.
          </Text>
        ) : null}
      </View>

      {/* Em teste: quem quiser garantir o acesso antes do 8º dia pode assinar já.
          Leva à mesma porta paga (/assinar), que converte o teste em ativa
          quando o pagamento entra. Sem isso, o teste vencido apenas encerra. */}
      {d.status === 'trial' ? (
        <>
          <Pressable onPress={() => router.push('/assinar')}>
            <Text style={[tipo.u2, { color: c.brand, textAlign: 'center', paddingVertical: espaco.e2 }]}>Assinar agora</Text>
          </Pressable>
          <Text style={[tipo.u4, { color: c.ink3, textAlign: 'center' }]}>
            Você não precisa esperar o teste terminar para assinar.
          </Text>
        </>
      ) : null}

      <Pressable onPress={() => router.push('/pagamentos')}>
        <Text style={[tipo.u3, { color: c.ink2, textAlign: 'center', paddingVertical: espaco.e2 }]}>Ver histórico de pagamentos</Text>
      </Pressable>

      {/* Trocar forma de pagamento. Cartão recorrente -> PIX cancela o auto-débito
          e mantém o acesso; PIX -> cartão só perto do vencimento (evita pagar 2x). */}
      {d.metodo === 'cartao' && ['ativa', 'inadimplente'].includes(d.status) ? (
        <Pressable onPress={passarParaPix} disabled={ocupado}>
          <Text style={[tipo.u3, { color: c.ink2, textAlign: 'center', paddingVertical: espaco.e2 }]}>
            {ocupado ? 'Trocando…' : 'Passar para PIX (pagar mês a mês)'}
          </Text>
        </Pressable>
      ) : d.metodo === 'pix' && d.status === 'ativa' ? (
        trocaCartaoLiberada(d.periodoFim) ? (
          <Pressable onPress={() => router.push('/assinar')}>
            <Text style={[tipo.u3, { color: c.brand, textAlign: 'center', paddingVertical: espaco.e2 }]}>Passar para cartão (cobrança automática)</Text>
          </Pressable>
        ) : (
          <Text style={[tipo.u4, { color: c.ink3, textAlign: 'center', paddingVertical: espaco.e2 }]}>
            Para trocar para cartão, volte perto do vencimento ({dataBR(d.periodoFim)}).
          </Text>
        )
      ) : null}

      {d.precoNovoCentavos ? (
        <Pressable onPress={() => router.push('/assinar')}>
          <Text style={[tipo.u2, { color: c.brand, textAlign: 'center', paddingVertical: espaco.e2 }]}>Confirmar novo valor</Text>
        </Pressable>
      ) : null}

      {podeCancelar ? (
        !confirmando ? (
          <Pressable onPress={() => setConfirmando(true)}>
            <Text style={[tipo.u3, { color: c.ink3, textAlign: 'center', paddingVertical: espaco.e2 }]}>Cancelar assinatura</Text>
          </Pressable>
        ) : (
          <View style={[estilos.cartao, { borderColor: c.line }]}>
            <Text style={[tipo.u3, { color: c.ink2 }]}>
              As cobranças param agora e o acesso segue até {dataBR(d.periodoFim) || 'o fim do período'}. Depois disso o jardim entra em repouso.
            </Text>
            <View style={{ flexDirection: 'row', gap: espaco.e5, marginTop: espaco.e3 }}>
              <Pressable onPress={cancelar} disabled={ocupado}>
                <Text style={[tipo.u2, { color: c.alert }]}>{ocupado ? 'Cancelando…' : 'Sim, cancelar'}</Text>
              </Pressable>
              <Pressable onPress={() => setConfirmando(false)}>
                <Text style={[tipo.u3, { color: c.ink3 }]}>Manter</Text>
              </Pressable>
            </View>
          </View>
        )
      ) : d.status === 'cancelada' || d.status === 'encerrada' || d.status === 'nenhuma' ? (
        <Pressable onPress={() => router.push('/assinar')}>
          <Text style={[tipo.u2, { color: c.brand, textAlign: 'center', paddingVertical: espaco.e2 }]}>Reativar assinatura</Text>
        </Pressable>
      ) : null}
    </Secao>
  );
}

export default function Ajustes() {
  const c = useCores();
  const maxLargura = useLarguraConteudo();
  const { escolha, definirEscolha } = useTema();
  const { sair } = useSessao();
  const eu = useEu();
  const revogar = useRevogarConsentimento();
  const excluir = useExcluirConta();
  const atualizarInicio = useAtualizarInicioDia();

  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);
  const [confirmandoRevogar, setConfirmandoRevogar] = useState(false);
  const [escolhendo, setEscolhendo] = useState<'dia' | 'tema' | null>(null);

  const inicioHora = horaDe(eu.data?.inicioDoDia);
  const temaAtual = TEMAS.find((t) => t.valor === escolha)?.nome ?? 'Do sistema';

  // Mantém o cálculo local do dia em dia com o que o servidor guarda.
  useEffect(() => {
    if (eu.data?.inicioDoDia) salvarInicioDia(horaDe(eu.data.inicioDoDia));
  }, [eu.data?.inicioDoDia]);

  function escolherInicio(h: number) {
    setEscolhendo(null);
    salvarInicioDia(h);
    atualizarInicio.mutate(`${String(h).padStart(2, '0')}:00`);
  }

  async function exportar() {
    setAviso(null);
    try {
      const ok = await exportarDados();
      setAviso(ok ? 'Baixado: meu-jardim.json' : 'A exportação por arquivo está disponível na versão web.');
    } catch {
      setAviso('Não consegui exportar agora. Tente de novo.');
    }
  }

  function confirmarRevogacao() {
    revogar.mutate(undefined, {
      onSuccess: () => {
        setConfirmandoRevogar(false);
        setAviso('Consentimento revogado. Considere também excluir a conta abaixo.');
      },
    });
  }

  function confirmarExclusao() {
    excluir.mutate(undefined, {
      onSuccess: async () => { await sair(); },
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      <Cabecalho titulo="Ajustes" aoVoltar={() => voltar()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]}>

        <Secao titulo="O dia">
          <Linha titulo="Meu dia começa às" valor={`${inicioHora}h`} aoTocar={() => setEscolhendo('dia')} />
          <Linha titulo="Tema" valor={temaAtual} aoTocar={() => setEscolhendo('tema')} />
        </Secao>

        <Secao titulo="Conta">
          <Linha titulo="Entrando como" valor={eu.data?.email ?? '…'} />
          <Pressable onPress={() => sair()}>
            <Text style={[tipo.u3, { color: c.ink2, textAlign: 'center', paddingVertical: espaco.e2 }]}>Sair</Text>
          </Pressable>
        </Secao>

        <SecaoAssinatura />

        <SecaoLembretes />

        <Secao titulo="Privacidade">
          <Linha titulo="Baixar tudo que é meu" valor="JSON" aoTocar={exportar} />
          {!confirmandoRevogar ? (
            <Linha
              titulo="Retirar autorização"
              valor="dados sensíveis"
              corValor={c.accent}
              aoTocar={() => setConfirmandoRevogar(true)}
            />
          ) : (
            <View style={[estilos.cartao, { borderColor: c.accent, backgroundColor: c.accentSoft }]}>
              <Text style={[tipo.u2, { color: c.ink }]}>Retirar a autorização?</Text>
              <Text style={[tipo.u4, { color: c.ink2, marginTop: espaco.e1 }]}>
                Sem ela, o app não pode usar sua convicção religiosa e para de
                funcionar no essencial. Isso não apaga seus dados; para apagar,
                use excluir a conta.
              </Text>
              <View style={{ flexDirection: 'row', gap: espaco.e5, alignItems: 'center', marginTop: espaco.e3 }}>
                <Pressable onPress={confirmarRevogacao}>
                  <Text style={[tipo.u2, { color: c.accent }]}>
                    {revogar.isPending ? 'Retirando…' : 'Sim, retirar'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setConfirmandoRevogar(false)}>
                  <Text style={[tipo.u3, { color: c.ink3 }]}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          )}
          <Text style={[tipo.u4, { color: c.ink3 }]}>
            O app se apoia na sua convicção religiosa (dado sensível) para
            funcionar. Revogar significa parar de usar o essencial; o passo
            seguinte costuma ser excluir a conta.
          </Text>
        </Secao>

        <Secao titulo="Zona de saída">
          {!confirmandoExcluir ? (
            <Pressable onPress={() => setConfirmandoExcluir(true)} style={[estilos.cartao, { borderColor: c.alert }]}>
              <Text style={[tipo.u2, { color: c.alert }]}>Excluir minha conta</Text>
              <Text style={[tipo.u4, { color: c.ink3, marginTop: espaco.e1 }]}>
                A conta sai do ar agora. Os dados são apagados do banco em 30 dias.
              </Text>
            </Pressable>
          ) : (
            <View style={[estilos.cartao, { borderColor: c.alert, backgroundColor: c.alertSoft }]}>
              <Text style={[tipo.u2, { color: c.ink }]}>Tem certeza?</Text>
              <Text style={[tipo.u4, { color: c.ink2, marginTop: espaco.e1 }]}>
                Isso não dá para desfazer depois do prazo. Em 30 dias, tudo o que
                você escreveu some do banco de vez.
              </Text>
              <View style={{ flexDirection: 'row', gap: espaco.e5, alignItems: 'center', marginTop: espaco.e3 }}>
                <Pressable onPress={confirmarExclusao}>
                  <Text style={[tipo.u2, { color: c.alert }]}>
                    {excluir.isPending ? 'Excluindo…' : 'Sim, excluir'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setConfirmandoExcluir(false)}>
                  <Text style={[tipo.u3, { color: c.ink3 }]}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Secao>

        {aviso ? (
          <Text style={[tipo.u3, { color: c.ink2, textAlign: 'center', marginTop: espaco.e5 }]}>{aviso}</Text>
        ) : null}
      </ScrollView>
      <BarraNavegacao />

      {/* Escolher a hora de início do dia. */}
      <Folha visivel={escolhendo === 'dia'} aoFechar={() => setEscolhendo(null)} titulo="Meu dia começa às">
        <Text style={[tipo.u4, { color: c.ink3, marginBottom: espaco.e3 }]}>
          É a hora da virada do dia devocional. Quem ora tarde da noite escolhe uma hora mais cedo para não pular de dia.
          O lembrete diário, se ligado, chega cerca de 20 minutos depois desta hora.
        </Text>
        <View style={{ gap: espaco.e2 }}>
          {HORAS_INICIO.map((h) => (
            <Pressable
              key={h}
              onPress={() => escolherInicio(h)}
              style={[estilos.opcao, { backgroundColor: h === inicioHora ? c.brandSoft : c.surface, borderColor: h === inicioHora ? c.brand : c.line }]}
            >
              <Text style={[tipo.u1, { color: h === inicioHora ? c.brand : c.ink }]}>{h}h</Text>
            </Pressable>
          ))}
        </View>
      </Folha>

      {/* Escolher o tema. */}
      <Folha visivel={escolhendo === 'tema'} aoFechar={() => setEscolhendo(null)} titulo="Tema">
        <View style={{ gap: espaco.e2 }}>
          {TEMAS.map((t) => (
            <Pressable
              key={t.valor}
              onPress={() => { definirEscolha(t.valor); setEscolhendo(null); }}
              style={[estilos.opcao, { backgroundColor: t.valor === escolha ? c.brandSoft : c.surface, borderColor: t.valor === escolha ? c.brand : c.line }]}
            >
              <Text style={[tipo.u1, { color: t.valor === escolha ? c.brand : c.ink }]}>{t.nome}</Text>
            </Pressable>
          ))}
        </View>
      </Folha>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  corpo: { paddingHorizontal: espaco.e5, paddingTop: 0, paddingBottom: espaco.e8, maxWidth: 440, width: '100%', alignSelf: 'center' },
  // A linha rótulo → valor do mockup.
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: espaco.e3,
    paddingVertical: 15, paddingHorizontal: 18, minHeight: 56,
    borderRadius: forma.card, borderWidth: 1,
  },
  cartao: { padding: espaco.e4, borderRadius: forma.card, borderWidth: 1 },
  opcao: {
    paddingVertical: espaco.e3, paddingHorizontal: espaco.e4,
    borderRadius: forma.campo, borderWidth: 1,
  },
});
