# Checklist LGPD do o meu jardim

> Isto é orientação de engenharia, não parecer jurídico. Antes de publicar na
> loja, leve a política de privacidade e o texto de consentimento para um
> advogado ler. O que está aqui é o que o código precisa fazer.

## O fato que muda tudo

A LGPD, no artigo 5º, inciso II, define **convicção religiosa** como **dado
pessoal sensível**. O app inteiro é feito de dado sensível: o que a pessoa
escreve no devocional, por quem ela ora, quantos dias ela jejua.

Isso não é um detalhe de rodapé, é o requisito que molda a arquitetura:

- **Base legal.** Dado sensível não aceita "legítimo interesse". O artigo 11
  exige **consentimento específico e destacado**, para finalidades específicas.
  Por isso o cadastro tem duas caixas separadas, nenhuma marcada por padrão:
  uma para os termos, outra para o tratamento de dado sensível.
- **Prova.** Guardamos a data e a versão do texto aceito. Se o texto mudar,
  a versão sobe e o consentimento é pedido de novo.
- **Revogação.** Precisa ser tão fácil quanto consentir (art. 8º, §5º).
  Um botão em Ajustes, não um e-mail para o suporte.

## Direitos do titular, artigo 18

Cada um vira uma rota e um prazo. A tabela `solicitacao_titular` existe para
provar que foram atendidos.

| Direito | Onde vive no código | Prazo |
|---|---|---|
| Confirmação e acesso | `GET /v1/meus-dados` | 15 dias |
| Portabilidade | mesma rota, JSON legível | 15 dias |
| Correção | edição normal no app | imediato |
| Eliminação | `DELETE /v1/minha-conta`, com apagamento real em 30 dias | 30 dias |
| Revogação do consentimento | Ajustes, desliga a conta | imediato |
| Informação sobre compartilhamento | política de privacidade | 15 dias |

**Eliminação de verdade.** `paranoid: true` do Sequelize dá exclusão lógica,
que serve para desfazer engano, não para atender o artigo 18. A rotina de
expurgo roda depois de 30 dias e apaga a linha. Guarde só o mínimo para
obrigação legal, e registre o que foi guardado e por quê.

## Segurança técnica, artigo 46

| Medida | Estado |
|---|---|
| Diário e lista de oração cifrados no banco, AES-256-GCM | `src/lib/cripto.js` |
| Senha com Argon2id nos parâmetros da OWASP | `src/lib/senha.js` |
| Token de acesso curto, refresh rotativo com detecção de reuso | `src/plugins/autenticacao.js` |
| Token no aparelho em Keychain e Keystore, nunca AsyncStorage | `app/lib/seguro.ts` |
| TLS obrigatório, HSTS de um ano | `src/plugins/seguranca.js` |
| Limite de tentativa de login e bloqueio temporário | `src/rotas/auth.js` |
| Log com redação: nunca grava diário, senha nem token | `src/servidor.js` |
| Autorização por objeto em toda rota, contra IDOR | `src/rotas/registros.js` |
| Backup cifrado, com a chave guardada separada do banco | operação |
| Chave de cifra em gerenciador de segredos, nunca no repositório | operação |

## Incidente, artigo 48

Vazamento com risco relevante precisa ser comunicado à ANPD **e** aos titulares.
A Resolução CD/ANPD nº 15/2024 fixou o prazo em **3 dias úteis** a partir do
conhecimento. Tenha pronto antes de precisar:

1. Quem decide que é incidente e quem comunica, com nome e telefone.
2. Modelo de comunicação ao titular, em português claro, sem eufemismo.
3. Como você descobriria: alerta de erro, alerta de acesso anômalo, monitor.
4. Como você conteria: revogar todas as sessões, girar chave, girar segredo.

Sem isso escrito antes, o prazo de 3 dias úteis passa enquanto você entende o
que aconteceu.

## Minoria de idade, artigo 14

Adolescente vai usar este app. Duas decisões práticas:

- Peça a data de nascimento no cadastro, não a idade.
- Para menor de 12 anos, o tratamento exige consentimento **específico e em
  destaque de pelo menos um dos pais ou responsável**. Se você não vai construir
  esse fluxo agora, defina 13 anos como idade mínima nos termos e na ficha da
  loja, e bloqueie o cadastro abaixo disso.

## Encarregado, artigo 41

Mesmo operando sozinha, você precisa de um canal de contato publicado. A
Resolução CD/ANPD nº 2/2022 dispensa o agente de pequeno porte de **nomear**
encarregado, mas exige o canal de comunicação. Um e-mail publicado na política
e dentro do app resolve, desde que alguém realmente leia.

## Relatório de impacto

Com dado sensível de milhares de pessoas, a ANPD pode pedir um RIPD. Escrever
um de duas páginas agora custa uma tarde e economiza semanas depois. Deve
conter: que dados você trata, para quê, com que base legal, quais os riscos e
o que você fez para reduzi-los.

## O que NÃO fazer, e é fácil fazer sem pensar

- Mandar conteúdo de diário para ferramenta de analytics, mesmo que "só o
  tamanho do texto". Nome de pessoa e trecho de oração nunca saem do banco.
- Usar o conteúdo do diário para treinar modelo, seu ou de terceiro, sem
  consentimento específico e separado para essa finalidade.
- Fazer backup do banco sem cifra, ou guardar a chave de cifra junto do backup.
- Colocar o e-mail da pessoa em URL, que vai parar em log de servidor e de proxy.
- Mandar notificação push com o conteúdo da anotação na prévia da tela de bloqueio.
