// Um símbolo para cada conquista, no vocabulário do jardim: a semente, o sol da
// estação, a árvore, a chama da constância, a pena do diário, a cesta da
// colheita. O código vem do backend (lib/jardim.js); aqui ele vira desenho.

import Svg, { Path, Circle } from 'react-native-svg';

export function IconeConquista({ codigo, cor, tamanho = 18 }: { codigo: string; cor: string; tamanho?: number }) {
  const t = { stroke: cor, strokeWidth: 1.8, fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const P = (props: any) => <Path {...t} {...props} />;

  switch (codigo) {
    case 'primeira_semente': // um broto que rompe a terra
      return (
        <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
          <P d="M12 21v-8" />
          <P d="M12 13c-3.5 0-6-2.5-6-6 3.5 0 6 2.5 6 6z" />
        </Svg>
      );
    case 'semeador': // broto de duas folhas sobre a linha da terra
      return (
        <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
          <P d="M4 20h16" />
          <P d="M12 20v-7" />
          <P d="M12 14c-3 0-5-2-5-5 3 0 5 2 5 5z" />
          <P d="M12 15c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4z" />
        </Svg>
      );
    case 'estacao': // o sol de uma estação inteira
      return (
        <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={4} {...t} />
          <P d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </Svg>
      );
    case 'jardineiro': // a árvore, cem dias depois
      return (
        <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
          <P d="M12 21v-7" />
          <Circle cx={12} cy={9} r={6} {...t} />
        </Svg>
      );
    case 'terra_fertil': // planta firme no vaso
      return (
        <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
          <P d="M6 14h12l-1.5 6h-9z" />
          <P d="M12 14c0-3 1.8-5 4.5-5" />
          <P d="M12 14c0-2-1.3-3.5-3.5-3.5" />
        </Svg>
      );
    case 'volta_por_cima': // o ciclo que recomeça
      return (
        <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
          <P d="M20 12a8 8 0 1 1-2.3-5.6" />
          <P d="M20 3.5v4h-4" />
        </Svg>
      );
    case 'escriba': // a pena do diário
      return (
        <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
          <P d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
          <P d="M16 8 2 22" />
          <P d="M17.5 15H9" />
        </Svg>
      );
    case 'colheita': // a cesta da oração respondida
      return (
        <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
          <P d="M4 9h16l-1.5 10h-13z" />
          <P d="M8.5 9c0-3 1.6-5 3.5-5s3.5 2 3.5 5" />
        </Svg>
      );
    case 'variedade': // três brotos, o jardim variado
      return (
        <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
          <P d="M12 21v-6M7.5 21v-4M16.5 21v-4" />
          <P d="M12 15c-2.4 0-3.8-1.4-3.8-3.8 2.4 0 3.8 1.4 3.8 3.8z" />
          <P d="M12 15c2.4 0 3.8-1.4 3.8-3.8-2.4 0-3.8 1.4-3.8 3.8z" />
        </Svg>
      );
    case 'constante': // a chama que não zera
      return (
        <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
          <P d="M12 3c2.4 3.4 3.7 5.8 3.7 8.1a3.7 3.7 0 1 1-7.4 0C8.3 8.8 9.6 6.4 12 3z" />
        </Svg>
      );
    default:
      return (
        <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
          <P d="M5 12.6 10 17.5 19.5 7" strokeWidth={2.4} />
        </Svg>
      );
  }
}
