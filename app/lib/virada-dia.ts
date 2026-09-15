// A virada do dia devocional, para as telas de "dia" (Hoje, trilha, estação)
// acompanharem sem precisar navegar nem remontar.
//
// O corte NÃO é meia-noite: é o início do dia devocional (4h por padrão,
// configurável em Ajustes). Duas fontes cobrem os casos reais:
//  - voltar do segundo plano (AppState 'active'): confere se o dia mudou;
//  - um timer até o próximo início do dia: cobre quem fica com o app aberto na
//    mesma tela cruzando o horário (ex.: acordado esperando as 4h virarem).

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { diaDevocional, inicioDiaAtual } from './id';

/** Milissegundos até o próximo início de dia devocional, no relógio do aparelho. */
function msAteProximaVirada(): number {
  const agora = new Date();
  const alvo = new Date(agora);
  alvo.setHours(inicioDiaAtual(), 0, 0, 0);
  if (alvo <= agora) alvo.setDate(alvo.getDate() + 1);
  return alvo.getTime() - agora.getTime();
}

/**
 * Chama `aoVirar` quando o dia devocional muda de fato. O callback pode trocar a
 * cada render sem reprogramar nada (guardado em ref).
 */
export function useViradaDoDia(aoVirar: () => void): void {
  const diaRef = useRef(diaDevocional());
  const cb = useRef(aoVirar);
  cb.current = aoVirar;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const conferir = () => {
      const hoje = diaDevocional();
      if (hoje !== diaRef.current) {
        diaRef.current = hoje;
        cb.current();
      }
    };

    const agendar = () => {
      clearTimeout(timer);
      // +1s de folga para cair já depois da virada, nunca no fio dela.
      timer = setTimeout(() => { conferir(); agendar(); }, msAteProximaVirada() + 1000);
    };

    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') { conferir(); agendar(); }
    });
    agendar();

    return () => { clearTimeout(timer); sub.remove(); };
  }, []);
}
