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
import { estadoLembrete, ligarLembrete, podeInstalar, instalar, suportaPush } from '../lib/lembrete';
import { espaco, forma, tipo } from '../tema/tema';

export function ConviteLembrete({ aoFechar }: { aoFechar: () => void }) {
  const c = useCores();
  const [pronto, setPronto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  // Só faz sentido convidar quem pode e ainda não ligou. Se já está ligado,
  // negado ou indisponível, fecha sem aparecer.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const estado = await estadoLembrete();
      if (!vivo) return;
      if (estado === 'desligado' && suportaPush) setPronto(true);
      else aoFechar();
    })();
    return () => { vivo = false; };
  }, []);

  if (!pronto) return null;

  async function ligar() {
    setOcupado(true);
    setRecado(null);
    try {
      const estado = await ligarLembrete();
      if (estado === 'ligado') {
        setRecado('Pronto. Vamos te chamar no horário, sem cobrança.');
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
      <Text style={[tipo.l2, { color: c.ink2, marginTop: espaco.e2 }]}>
        Você já regou três vezes. Se quiser, a gente te chama uma vez por dia, no
        horário que você escolher nas práticas. A prévia nunca mostra o que você
        escreve; só um toque para voltar ao jardim.
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
