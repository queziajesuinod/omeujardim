// Estado de sessão, num lugar só. Quem está logado, e como entrar e sair.
//
// Web e nativo guardam a credencial de formas diferentes (cookie httpOnly vs
// SecureStore), mas isso mora em lib/seguro.*; aqui em cima o resto do app só
// pergunta "está autenticado?" e chama entrar/sair, sem saber da diferença.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { chamar, definirAoExpirar, renovar, ErroApi } from './api';
import { guardarSessao, lerAcesso, limparSessao } from './seguro';
// @ts-ignore lerCsrf/guardarCsrf só existem no seguro.web.ts.
import * as seguroWeb from './seguro';

type Usuario = { id: string; nome?: string; email: string };

export type DadosCadastro = { nome: string; email: string; senha: string };

type Sessao = {
  autenticado: boolean | null; // null enquanto ainda estamos descobrindo
  usuario: Usuario | null;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (dados: DadosCadastro) => Promise<'entrou' | 'ja_existe'>;
  sair: () => Promise<void>;
};

const Ctx = createContext<Sessao>({
  autenticado: null,
  usuario: null,
  entrar: async () => {},
  cadastrar: async () => 'entrou',
  sair: async () => {},
});

function dispositivo() {
  return Platform.OS === 'web' ? 'navegador' : Platform.OS;
}

function fusoLocal() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

/** Guarda o que o login/refresh devolveu, no formato de cada plataforma. */
async function guardarResposta(r: any) {
  if (Platform.OS === 'web') {
    if (r?.csrf) (seguroWeb as any).guardarCsrf?.(r.csrf);
  } else if (r?.acesso) {
    await guardarSessao(r.acesso, r.refresh);
  }
}

export function ProvedorSessao({ children }: { children: React.ReactNode }) {
  const [autenticado, setAutenticado] = useState<boolean | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    let vivo = true;

    // Sessão inicial. Na web, um refresh silencioso confirma o cookie httpOnly
    // (que o JS não lê por ser de outra origem em dev) e ainda traz um CSRF
    // novo. No nativo, basta o token estar no SecureStore; se estiver velho, a
    // primeira chamada real cai no 401, o refresh tenta, e se falhar a sessão
    // avisa aqui embaixo.
    (async () => {
      const tem = Platform.OS === 'web'
        ? await renovar()
        : !!(await lerAcesso());
      if (vivo) setAutenticado(tem);
    })();

    definirAoExpirar(() => {
      setAutenticado(false);
      setUsuario(null);
    });

    return () => { vivo = false; };
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const r = await chamar('/v1/auth/login', 'POST', { email, senha, dispositivo: dispositivo() });
    await guardarResposta(r);
    setUsuario(r.usuario ?? null);
    setAutenticado(true);
  }, []);

  const cadastrar = useCallback(async (dados: DadosCadastro): Promise<'entrou' | 'ja_existe'> => {
    await chamar('/v1/auth/cadastro', 'POST', {
      ...dados,
      fuso: fusoLocal(),
      aceitaTermos: true,
      aceitaDadosSensiveis: true,
    });
    // O cadastro não abre sessão (a resposta é a mesma exista ou não a conta,
    // para não virar consulta de quem usa o app). Tentamos entrar em seguida.
    try {
      await entrar(dados.email, dados.senha);
      return 'entrou';
    } catch (e) {
      // 401 = a conta já existia com outra senha. Só isso é "já existe".
      // 429 (limite), rede e afins sobem para a tela avisar com honestidade —
      // a conta pode ter sido criada agora, então dizer "já existe" enganaria.
      if (e instanceof ErroApi && e.status === 401) return 'ja_existe';
      throw e;
    }
  }, [entrar]);

  const sair = useCallback(async () => {
    try {
      await chamar('/v1/auth/sair', 'POST');
    } catch {
      // Mesmo se a rede falhar, some com a credencial local.
    }
    await limparSessao();
    setUsuario(null);
    setAutenticado(false);
  }, []);

  return (
    <Ctx.Provider value={{ autenticado, usuario, entrar, cadastrar, sair }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSessao = () => useContext(Ctx);
