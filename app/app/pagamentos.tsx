// Histórico de pagamentos do próprio usuário. Lê de GET /v1/assinatura, que já
// devolve a lista de cobranças (não precisa de rota nova). Só a pessoa vê os
// seus; o servidor valida a sessão. Nenhum dado de cartão passa por aqui — só
// método, valor, data e status de cada cobrança.

import { ScrollView, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Cabecalho } from '../componentes/Cabecalho';
import { BarraNavegacao } from '../componentes/BarraNavegacao';
import { useCores } from '../lib/tema-contexto';
import { useLarguraConteudo } from '../lib/layout';
import { useAssinatura, reais, type Cobranca } from '../lib/assinatura';
import { voltar } from '../lib/voltar';
import { espaco, forma, tipo } from '../tema/tema';

function dataLonga(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const METODO: Record<Cobranca['metodo'], string> = { cartao: 'Cartão', pix: 'PIX' };
const STATUS: Record<Cobranca['status'], string> = {
  pago: 'Pago', pendente: 'Aguardando', recusada: 'Recusada', estornada: 'Estornada', expirada: 'Expirada',
};

export default function Pagamentos() {
  const c = useCores();
  const maxLargura = useLarguraConteudo();
  const assinatura = useAssinatura();
  const d = assinatura.data;

  // A cor do status diz junto com a palavra (estado nunca é só cor). Vermelho
  // (--alert) só para o que de fato falhou; pago é da marca, aguardando é neutro.
  function corStatus(s: Cobranca['status']) {
    if (s === 'pago') return c.brand;
    if (s === 'pendente') return c.accent;
    return c.alert;
  }

  const cobrancas = d?.cobrancas ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      <Cabecalho titulo="Pagamentos" aoVoltar={() => voltar('/ajustes')} />

      {assinatura.isLoading ? (
        <View style={estilos.centro}>
          <ActivityIndicator color={c.brand} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[estilos.corpo, { maxWidth: maxLargura }]} showsVerticalScrollIndicator={false}>
          {d && d.valorCentavos ? (
            <View style={[estilos.resumo, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Text style={[tipo.u3, { color: c.ink3 }]}>PLANO</Text>
              <Text style={[tipo.d4, { color: c.ink, marginTop: espaco.e1 }]}>{reais(d.valorCentavos)} por mês</Text>
              {d.proximaCobranca && d.status === 'ativa' ? (
                <Text style={[tipo.u3, { color: c.ink3, marginTop: espaco.e1 }]}>
                  Próxima cobrança em {d.proximaCobranca}
                </Text>
              ) : null}
            </View>
          ) : null}

          {cobrancas.length === 0 ? (
            <View style={[estilos.vazio, { borderColor: c.line }]}>
              <Text style={[tipo.d4, { color: c.ink }]}>Nenhum pagamento ainda</Text>
              <Text style={[tipo.l2, { color: c.ink2, textAlign: 'center', marginTop: espaco.e2 }]}>
                Quando houver uma cobrança, ela aparece aqui com data, valor e situação.
              </Text>
            </View>
          ) : (
            <View style={{ gap: espaco.e3, marginTop: espaco.e5 }}>
              {cobrancas.map((cob) => (
                <View key={cob.id} style={[estilos.linha, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[tipo.u2, { color: c.ink }]}>{reais(cob.valorCentavos)}</Text>
                    <Text style={[tipo.u3, { color: c.ink3, marginTop: 2 }]}>
                      {METODO[cob.metodo]} · {dataLonga(cob.pagoEm ?? cob.criado_em)}
                    </Text>
                  </View>
                  <Text style={[tipo.u3, { color: corStatus(cob.status) }]}>{STATUS[cob.status]}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
      <BarraNavegacao />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  corpo: { paddingHorizontal: espaco.e5, paddingTop: espaco.e2, paddingBottom: espaco.e8, maxWidth: 440, width: '100%', alignSelf: 'center' },
  resumo: { padding: espaco.e5, borderRadius: forma.card, borderWidth: 1, marginTop: espaco.e2 },
  vazio: {
    marginTop: espaco.e6, padding: espaco.e6, borderRadius: forma.card,
    borderWidth: 1, borderStyle: 'dashed', alignItems: 'center',
  },
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: espaco.e3,
    padding: espaco.e4, borderRadius: forma.card, borderWidth: 1,
  },
});
