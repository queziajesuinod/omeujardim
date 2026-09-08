// Largura da coluna de conteúdo, responsiva.
//
// O app é mobile-first: no telefone é uma coluna estreita, do jeito que foi
// desenhado. Mas numa tela de PC uma coluna de 440px no meio de um vazio enorme
// parece pequena e perdida. Então a coluna cresce por faixa de largura, sem
// nunca esticar tanto a ponto de descaracterizar os cartões.

import { useWindowDimensions } from 'react-native';

export function useLarguraConteudo(): number {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 680;
  if (width >= 768) return 580;
  if (width >= 600) return 500;
  return 460;
}
