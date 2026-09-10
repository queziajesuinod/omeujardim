// O convite para ligar o lembrete — e, se der, instalar o app.
//
// Aparece só depois da terceira rega (quem decide é a tela Hoje) e some para
// sempre quando a pessoa liga OU dispensa. Nada de reaparecer toda visita: um
// convite que insiste vira incômodo, e incômodo a marca não faz.
//
// O texto promete o essencial e a garantia: chega no horário, e a prévia nunca
// mostra o que você escreveu.

import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Botao } from './Botao';
import { Broto } from './Broto';
import { useCores } from '../lib/tema-contexto';
import {
  estadoLembrete, ligarLembrete, podeInstalar, instalar, suportaPush,
  ehDispositivoApple, estaInstalado,
} from '../lib/lembrete';
import { espaco, forma, tipo } from '../tema/tema';

// 'ligar': dá para pedir a permissão aqui (Android/desktop, ou iPhone já
// instalado). 'instalar-ios': iPhone na aba do navegador, onde o Web Push só
// existe depois de adicionar à Tela de Início — então guiamos a instalação em
// vez de um botão que não faria nada. 'nada': já ligado, bloqueado ou sem
// suporte; some sem aparecer.
type Modo = 'carregando' | 'ligar' | 'instalar-ios' | 'nada';

export function ConviteLembrete({ aoFechar }: { aoFechar: () => void }) {
  const c = useCores();
  const [modo, setModo] = useState<Modo>('carregando');
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const estado = await estadoLembrete();
      if (!vivo) return;
      if (suportaPush && estado === 'desligado') setModo('ligar');
      else if (!suportaPush && ehDispositivoApple() && !estaInstalado()) setModo('instalar-ios');
      else { setModo('nada'); aoFechar(); }
    })();
    return () => { vivo = false; };
  }, []);

  if (modo === 'carregando' || modo === 'nada') return null;

  async function ligar() {
    setOcupado(true);
    setRecado(null);
    try {
      const estado = await ligarLembrete();
      if (estado === 'ligado') {
        setRecado('Pronto. Vamos te lembrar no horário, sem cobrança.');
        setTimeout(aoFechar, 1600);
      } else if (estado === 'negado') {
        setRecado('O navegador bloqueou os avisos. Dá para reativar nas permissões do site.');
      } else {
        setRecado('Não deu para ligar agora. Sem problema, fica para depois.');
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <View style={[estilos.cartao, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Broto cor={c.brand} tamanho={40} />
      <Text style={[tipo.d4, { color: c.ink, marginTop: espaco.e3 }]}>Um lembrete gentil?</Text>

      {modo === 'ligar' ? (
        <>
          <Text style={[tipo.l2, { color: c.ink2, marginTop: espaco.e2 }]}>
            Se quiser, a gente lembra das suas práticas uma vez por dia, no horário
            que você escolher. É só um lembrete, nunca uma cobrança; a prévia nunca
            mostra o que você escreve.
          </Text>
          {recado ? (
            <Text style={[tipo.u3, { color: c.brand, marginTop: espaco.e3 }]}>{recado}</Text>
          ) : null}
          <View style={{ marginTop: espaco.e4, gap: espaco.e3 }}>
            <Botao bloco onPress={ligar} carregando={ocupado}>Ligar lembrete</Botao>
            {podeInstalar() ? (
              <Botao variante="vazado" onPress={() => instalar()}>Instalar o app na tela inicial</Botao>
            ) : null}
            <Pressable onPress={aoFechar}>
              <Text style={[tipo.u3, { color: c.ink3, textAlign: 'center' }]}>Agora não</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={[tipo.l2, { color: c.ink2, marginTop: espaco.e2 }]}>
            No iPhone, o lembrete só chega com o app na Tela de Início. Abra este
            site no Safari, toque em Compartilhar e depois em Adicionar à Tela de
            Início. Abra o app por ali e ligue o lembrete. É só um lembrete das suas
            práticas, no horário que você escolher, nunca uma cobrança.
          </Text>
          <View style={{ marginTop: espaco.e4 }}>
            <Pressable onPress={aoFechar}>
              <Text style={[tipo.u3, { color: c.ink3, textAlign: 'center' }]}>Entendi</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    marginTop: espaco.e6,
    padding: espaco.e5,
    borderRadius: forma.card,
    borderWidth: 1,
  },
});
