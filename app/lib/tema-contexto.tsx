// Tema e preferência de movimento, num lugar só.
//
// Duas coisas que quase todo app erra e este não pode errar:
// 1. O tema tem TRÊS estados, não dois: claro, escuro e "o que o sistema quiser".
// 2. Movimento reduzido é preferência de acessibilidade do sistema, e precisa
//    ser lida de verdade, não só no CSS da web.

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { lerPreferencia, gravarPreferencia } from './preferencia';
import { temaClaro, temaEscuro, type Cores } from '../tema/tema';

type Escolha = 'claro' | 'escuro' | 'sistema';

const Ctx = createContext<{
  cores: Cores;
  escolha: Escolha;
  definirEscolha: (e: Escolha) => void;
  movimentoReduzido: boolean;
}>({ cores: temaClaro, escolha: 'sistema', definirEscolha: () => {}, movimentoReduzido: false });

const CHAVE = 'jardim.tema';

export function ProvedorTema({ children }: { children: React.ReactNode }) {
  const doSistema = useColorScheme();
  const [escolha, setEscolha] = useState<Escolha>('sistema');
  const [movimentoReduzido, setMovimentoReduzido] = useState(false);

  useEffect(() => {
    lerPreferencia(CHAVE).then((v) => {
      if (v === 'claro' || v === 'escuro' || v === 'sistema') setEscolha(v);
    });

    AccessibilityInfo.isReduceMotionEnabled().then(setMovimentoReduzido);
    const inscricao = AccessibilityInfo.addEventListener('reduceMotionChanged', setMovimentoReduzido);
    return () => inscricao.remove();
  }, []);

  const valor = useMemo(() => {
    const escuro = escolha === 'escuro' || (escolha === 'sistema' && doSistema === 'dark');
    return {
      // Os dois temas têm o mesmo formato, mas literais de cor diferentes: o
      // union não é atribuível a Cores sem afirmar que ambos o satisfazem.
      cores: (escuro ? temaEscuro : temaClaro) as Cores,
      escolha,
      movimentoReduzido,
      definirEscolha: (e: Escolha) => {
        setEscolha(e);
        gravarPreferencia(CHAVE, e);
      },
    };
  }, [escolha, doSistema, movimentoReduzido]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useCores = () => useContext(Ctx).cores;
export const useMovimentoReduzido = () => useContext(Ctx).movimentoReduzido;
export const useTema = () => useContext(Ctx);
