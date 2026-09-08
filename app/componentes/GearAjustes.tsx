// O acesso a ajustes: um ícone só, no canto do cabeçalho, que abre um seletor
// do que ajustar — as práticas ou o app. Antes eram dois links soltos e miúdos
// no rodapé; virou um gesto único e claro.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { router } from 'expo-router';
import { useCores } from '../lib/tema-contexto';
import { useSessao } from '../lib/sessao';
import { espaco, forma, tipo } from '../tema/tema';

function IconeSliders({ cor }: { cor: string }) {
  // "Sliders": lê como ajuste, não como engrenagem de sistema.
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Line x1={4} y1={21} x2={4} y2={14} stroke={cor} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1={4} y1={10} x2={4} y2={3} stroke={cor} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1={12} y1={21} x2={12} y2={12} stroke={cor} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1={12} y1={8} x2={12} y2={3} stroke={cor} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1={20} y1={21} x2={20} y2={16} stroke={cor} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1={20} y1={12} x2={20} y2={3} stroke={cor} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1={1} y1={14} x2={7} y2={14} stroke={cor} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1={9} y1={8} x2={15} y2={8} stroke={cor} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1={17} y1={16} x2={23} y2={16} stroke={cor} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

function Opcao({ icone, titulo, descricao, aoTocar }: {
  icone: React.ReactNode; titulo: string; descricao: string; aoTocar: () => void;
}) {
  const c = useCores();
  return (
    <Pressable onPress={aoTocar} style={[estilos.opcao, { borderColor: c.line }]}>
      <View style={[estilos.anel, { backgroundColor: c.brandSoft }]}>{icone}</View>
      <View style={{ flex: 1 }}>
        <Text style={[tipo.u2, { color: c.ink }]}>{titulo}</Text>
        <Text style={[tipo.u3, { color: c.ink3, marginTop: 2 }]}>{descricao}</Text>
      </View>
    </Pressable>
  );
}

export function GearAjustes() {
  const c = useCores();
  const { sair } = useSessao();
  const [aberto, setAberto] = useState(false);

  function ir(rota: '/praticas' | '/ajustes') {
    setAberto(false);
    router.push(rota);
  }

  return (
    <>
      <Pressable
        onPress={() => setAberto(true)}
        accessibilityRole="button"
        accessibilityLabel="Ajustes"
        style={estilos.gatilho}
        hitSlop={8}
      >
        <IconeSliders cor={c.ink2} />
      </Pressable>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <Pressable style={[estilos.fundo, { backgroundColor: c.overlay }]} onPress={() => setAberto(false)}>
          <Pressable style={[estilos.folha, { backgroundColor: c.surface }]} onPress={() => {}}>
            <View style={[estilos.puxador, { backgroundColor: c.line }]} />
            <Text style={[tipo.d4, { color: c.ink, marginBottom: espaco.e4 }]}>O que você quer ajustar?</Text>
            <View style={{ gap: espaco.e3 }}>
              <Opcao
                titulo="Minhas práticas"
                descricao="O que você cultiva, os dias e os horários."
                aoTocar={() => ir('/praticas')}
                icone={(
                  <Svg width={20} height={20} viewBox="0 0 64 64">
                    <Path d="M32 55 V38" stroke={c.brand} strokeWidth={5} strokeLinecap="round" fill="none" />
                    <Path d="M30.6 41 C 20 40.5, 14.6 33, 15.6 23 C 26 24, 31.6 31, 30.6 41 Z" fill={c.brand} />
                    <Path d="M33.4 41 C 44 40.5, 49.4 33, 48.4 23 C 38 24, 32.4 31, 33.4 41 Z" fill={c.brand} />
                  </Svg>
                )}
              />
              <Opcao
                titulo="Ajustes do app"
                descricao="Conta, aparência, lembretes e seus dados."
                aoTocar={() => ir('/ajustes')}
                icone={<IconeSliders cor={c.brand} />}
              />
              <Opcao
                titulo="Sair"
                descricao="Encerrar a sessão neste aparelho."
                aoTocar={() => { setAberto(false); sair(); }}
                icone={(
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                      stroke={c.brand} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              />
            </View>
            <Pressable onPress={() => setAberto(false)} style={{ marginTop: espaco.e4 }}>
              <Text style={[tipo.u3, { color: c.ink3, textAlign: 'center' }]}>Fechar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const estilos = StyleSheet.create({
  gatilho: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  fundo: { flex: 1, justifyContent: 'flex-end' },
  folha: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxWidth: 440, width: '100%', alignSelf: 'center',
    paddingHorizontal: espaco.e5, paddingTop: espaco.e2, paddingBottom: espaco.e7,
  },
  puxador: { width: 40, height: 4, borderRadius: forma.pilula, alignSelf: 'center', marginVertical: espaco.e3 },
  opcao: {
    flexDirection: 'row', alignItems: 'center', gap: espaco.e3,
    padding: espaco.e4, borderRadius: forma.card, borderWidth: 1,
  },
  anel: { width: 40, height: 40, borderRadius: forma.pilula, alignItems: 'center', justifyContent: 'center' },
});
