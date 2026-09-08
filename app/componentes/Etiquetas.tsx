// As pílulas do mockup, em três papéis:
//
// - Chip: tag selecionável (filtros do diário, tags do registro). Ativa em
//   verde-claro com traço e texto musgo; inativa com traço neutro.
// - SeloEstacao: o selo cor de terra clara que anuncia a estação ("dia 12 de 40").
// - Marca: a etiqueta pequena e discreta que rotula uma entrada já salva.

import { Pressable, Text, StyleSheet } from 'react-native';
import { useCores } from '../lib/tema-contexto';
import { forma, fontes } from '../tema/tema';

export function Chip({ rotulo, ativo, onPress }: { rotulo: string; ativo?: boolean; onPress?: () => void }) {
  const c = useCores();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: !!ativo }}
      style={[
        estilos.chip,
        {
          backgroundColor: ativo ? c.brandSoft : 'transparent',
          borderColor: ativo ? c.brand : c.line,
        },
      ]}
    >
      <Text style={{ fontSize: 12, fontFamily: fontes.uiMedio, color: ativo ? c.brand : c.ink2 }}>{rotulo}</Text>
    </Pressable>
  );
}

export function SeloEstacao({ texto }: { texto: string }) {
  const c = useCores();
  return (
    <Text style={[estilos.selo, { backgroundColor: c.accentSoft, color: c.onAccentSoft }]}>{texto}</Text>
  );
}

export function Marca({ rotulo }: { rotulo: string }) {
  const c = useCores();
  return (
    <Text style={[estilos.marca, { backgroundColor: c.surface2, color: c.ink3 }]}>{rotulo}</Text>
  );
}

const estilos = StyleSheet.create({
  chip: {
    borderRadius: forma.pilula,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 13,
  },
  selo: {
    borderRadius: forma.pilula,
    paddingVertical: 6,
    paddingHorizontal: 14,
    fontSize: 13,
    fontFamily: fontes.uiMedio,
    overflow: 'hidden',
  },
  marca: {
    borderRadius: forma.pilula,
    paddingVertical: 3,
    paddingHorizontal: 10,
    fontSize: 11,
    fontFamily: fontes.ui,
    overflow: 'hidden',
  },
});
