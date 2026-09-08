// A barra de navegação do mockup: quatro abas fixas no rodapé, sempre na mesma
// ordem — Hoje, Trilhas, Oração, Jardim. É o esqueleto de orientação do app;
// por isso é igual em toda tela principal, alinhada e previsível.
//
// Aba ativa: musgo (brand), com a borda superior acesa e o fundo verde-claro
// (brandSoft). Inativa: cinza-verde (ink3). Os ícones são os mesmos traços do
// mockup, redesenhados como SVG. Ajustes não é aba — mora no cabeçalho.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router, usePathname } from 'expo-router';
import { useCores } from '../lib/tema-contexto';
import { useLarguraConteudo } from '../lib/layout';
import { espaco } from '../tema/tema';

type Rota = '/hoje' | '/diario' | '/trilhas' | '/oracao' | '/jardim';

function Icone({ rota, cor }: { rota: Rota; cor: string }) {
  if (rota === '/hoje') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M4 10.6 12 4l8 6.6V20H4v-9.4z" stroke={cor} strokeWidth={1.75} strokeLinejoin="round" />
      </Svg>
    );
  }
  if (rota === '/diario') {
    // Uma pena: o diário é onde se escreve o que se ouviu.
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" stroke={cor} strokeWidth={1.75} strokeLinejoin="round" />
        <Path d="M16 8 2 22" stroke={cor} strokeWidth={1.75} strokeLinecap="round" />
        <Path d="M17.5 15H9" stroke={cor} strokeWidth={1.75} strokeLinecap="round" />
      </Svg>
    );
  }
  if (rota === '/trilhas') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M4 5.2c2.6-.9 5.3-.9 8 0v14c-2.7-.9-5.4-.9-8 0V5.2z" stroke={cor} strokeWidth={1.75} strokeLinejoin="round" />
        <Path d="M12 5.2c2.7-.9 5.4-.9 8 0v14c-2.6-.9-5.3-.9-8 0" stroke={cor} strokeWidth={1.75} strokeLinejoin="round" />
      </Svg>
    );
  }
  if (rota === '/oracao') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M12 3.5c3.6 4.2 5.5 7 5.5 9.4A5.5 5.5 0 0 1 6.5 12.9C6.5 10.5 8.4 7.7 12 3.5z" stroke={cor} strokeWidth={1.75} strokeLinejoin="round" />
      </Svg>
    );
  }
  // Jardim: o broto — caule e duas folhas, como o símbolo da marca.
  return (
    <Svg width={22} height={22} viewBox="0 0 64 64" fill="none">
      <Path d="M32 55 V38" stroke={cor} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M30.6 41 C 20 40.5, 14.6 33, 15.6 23 C 26 24, 31.6 31, 30.6 41 Z" fill={cor} />
      <Path d="M33.4 41 C 44 40.5, 49.4 33, 48.4 23 C 38 24, 32.4 31, 33.4 41 Z" fill={cor} />
    </Svg>
  );
}

const ABAS: { rota: Rota; nome: string }[] = [
  { rota: '/hoje', nome: 'Hoje' },
  { rota: '/diario', nome: 'Diário' },
  { rota: '/trilhas', nome: 'Trilhas' },
  { rota: '/oracao', nome: 'Oração' },
  { rota: '/jardim', nome: 'Jardim' },
];

export function BarraNavegacao() {
  const c = useCores();
  const caminho = usePathname();
  const maxLargura = useLarguraConteudo();

  return (
    <View style={[estilos.barra, { backgroundColor: c.surface, borderTopColor: c.line }]}>
      <View style={[estilos.abas, { maxWidth: maxLargura }]}>
        {ABAS.map((aba) => {
          const ativa = caminho === aba.rota;
          const cor = ativa ? c.brand : c.ink3;
          return (
            <Pressable
              key={aba.rota}
              onPress={() => { if (!ativa) router.replace(aba.rota); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativa }}
              accessibilityLabel={aba.nome}
              style={[
                estilos.aba,
                {
                  borderTopColor: ativa ? c.brand : 'transparent',
                  backgroundColor: ativa ? c.brandSoft : 'transparent',
                },
              ]}
            >
              <Icone rota={aba.rota} cor={cor} />
              <Text style={[estilos.rotulo, { color: cor, fontWeight: ativa ? '600' : '400' }]}>
                {aba.nome}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    borderTopWidth: 1,
    // A folga inferior do mockup, que também acomoda a área segura do aparelho.
    paddingBottom: espaco.e5,
    alignItems: 'center',
  },
  // As abas centralizadas na largura da coluna; no PC não esticam de ponta a ponta.
  abas: {
    flexDirection: 'row',
    width: '100%',
  },
  aba: {
    flexGrow: 1,
    flexBasis: 0,
    alignItems: 'center',
    gap: 4,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 4,
    borderTopWidth: 2,
  },
  rotulo: {
    fontSize: 11,
    fontFamily: 'Figtree_500Medium',
  },
});
