// Ícones das disciplinas e o check, no estilo do design system (24x24, dentro
// do anel jd-pratica__ic). Livro e lua vêm do design system (galeria.html);
// as demais seguem o mesmo traço simples. Tudo tingido pelo tema, sem hex.
//
// O check é o mesmo path do sistema: aparece quando a prática está regada, ou
// escolhida na tela de práticas. Selecionar e regar compartilham o gesto visual.

import Svg, { Path } from 'react-native-svg';

const PATHS: Record<string, string[]> = {
  // do design system: livro aberto
  leitura: [
    'M4 5.2c2.6-.9 5.3-.9 8 0v14c-2.7-.9-5.4-.9-8 0V5.2z',
    'M12 5.2c2.7-.9 5.4-.9 8 0v14c-2.6-.9-5.3-.9-8 0',
  ],
  // do design system: lua (jejum é lua)
  jejum: ['M20 4c0 9-5 13-11 12.6C8.4 10.4 12.6 5.6 20 4z'],
  // chama
  oracao: ['M12 2c2.4 3.6 3.7 6 3.7 8.4a3.7 3.7 0 1 1-7.4 0C8.3 8 9.6 5.6 12 2z'],
  // folha
  meditacao: ['M19 5C9 5 5 11 5 20c9 0 14-5 14-15z'],
  // marcador de página
  memorizacao: ['M7 3h10a1 1 0 0 1 1 1v17l-6-4.5L6 21V4a1 1 0 0 1 1-1z'],
  // coração
  gratidao: ['M12 20.3S4.5 15.6 4.5 10.2A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7.5 3.2c0 5.4-7.5 10.1-7.5 10.1z'],
  // cesto (servir)
  servico: ['M3.5 9h17l-1.6 8.4A3 3 0 0 1 16 20H8a3 3 0 0 1-2.9-2.6L3.5 9z'],
  // presente (dar)
  generosidade: ['M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9z', 'M3 6h18v3H3z'],

  // --- Acrescentados: mais opções para o catálogo -------------------------
  // cruz
  cruz: ['M10.5 3h3v18h-3z', 'M6 8.5h12v3H6z'],
  // estrela (adoração, louvor)
  estrela: ['M12 2l2.47 5.9 6.38.53-4.86 4.19 1.48 6.23L12 15.4l-5.47 3.45 1.48-6.23L3.15 8.43l6.38-.53L12 2z'],
  // nota musical (louvor, canto)
  louvor: [
    'M8 18a3 3 0 1 0 6 0 3 3 0 0 0-6 0z',
    'M13 5h1.4v13H13z',
    'M14.4 5c2.2.9 3.6 2.3 3.6 4.6 0 .9-.2 1.6-.6 2.3.2-.5.3-1 .3-1.6 0-1.8-1.3-2.9-3.3-3.6V5z',
  ],
  // cálice (comunhão, ceia)
  calice: ['M7 4h10l-.7 5A4.3 4.3 0 0 1 13 12.8V18h3v2H8v-2h3v-5.2A4.3 4.3 0 0 1 7.7 9L7 4z'],
  // vela (vigília)
  vela: ['M12 2.5c1.4 1.6 2 2.7 2 3.7a2 2 0 0 1-4 0c0-1 .6-2.1 2-3.7z', 'M9.5 8h5v13h-5z'],
  // montanha (retiro, criação)
  montanha: ['M2 20h20L15 8l-3.2 5.2L9 9.5 2 20z'],
  // balão de fala (testemunho, evangelismo)
  testemunho: ['M20 2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2v4l4-4h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z'],
  // gota (quebrantamento, lágrima)
  gota: ['M12 3c3.2 4.6 5 7.4 5 10a5 5 0 0 1-10 0c0-2.6 1.8-5.4 5-10z'],
  // broto (semear)
  broto: ['M11.25 11h1.5v10h-1.5z', 'M11 12C7 12 4 9 4 5c4 0 7 3 7 7z', 'M13 12c4 0 7-3 7-7-4 0-7 3-7 7z'],
  // casa (lar, hospitalidade)
  casa: ['M12 3 21 11h-3v9h-4v-6h-4v6H6v-9H3z'],
};

const FALLBACK = ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z'];

export function IconeDisciplina({ codigo, cor, tamanho = 20 }: { codigo: string; cor: string; tamanho?: number }) {
  const paths = PATHS[codigo] ?? FALLBACK;
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      {paths.map((d, i) => (
        <Path key={i} d={d} fill={cor} />
      ))}
    </Svg>
  );
}

export function IconeCheck({ cor, tamanho = 20 }: { cor: string; tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      <Path d="M5 12.6 10 17.5 19.5 7" fill="none" stroke={cor} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
