// Uma folha que sobe de baixo, sobre a tela anterior — o mesmo gesto do Anotar.
// Serve a qualquer formulário rápido que não merece uma tela inteira: o novo
// pedido de oração, por exemplo. Toque fora fecha; o puxador dá a dica.

import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import { useCores } from '../lib/tema-contexto';
import { espaco, forma, tipo } from '../tema/tema';

export function Folha({
  visivel, aoFechar, titulo, children,
}: {
  visivel: boolean;
  aoFechar: () => void;
  titulo?: string;
  children: React.ReactNode;
}) {
  const c = useCores();
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoFechar}>
      <Pressable style={[estilos.fundo, { backgroundColor: c.overlay }]} onPress={aoFechar}>
        {/* Toque dentro da folha não fecha. */}
        <Pressable style={[estilos.folha, { backgroundColor: c.surface }]} onPress={() => {}}>
          <View style={[estilos.puxador, { backgroundColor: c.line }]} />
          <ScrollView contentContainerStyle={estilos.corpo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {titulo ? <Text style={[tipo.d4, { color: c.ink, marginBottom: espaco.e4 }]}>{titulo}</Text> : null}
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const estilos = StyleSheet.create({
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
});
