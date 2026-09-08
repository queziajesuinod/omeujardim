# O meu jardim, memória do projeto

Este arquivo é lido automaticamente pelo Claude Code a cada sessão neste
repositório. Ele existe para que nenhuma decisão precise ser retomada do zero,
e para que a próxima sessão não desfaça, por desconhecimento, algo que foi
decidido com motivo.

Quando uma decisão mudar, **mude aqui primeiro** e depois no código.

---

## O que é

App de constância para disciplinas espirituais (oração, leitura da Palavra,
meditação, jejum, gratidão). Público inicial: pessoa individual.

Três pilares do produto, e eles explicam quase toda decisão técnica:

1. **Conteúdo autoral.** Trilhas escritas pela autora, não agregadas de fora.
2. **Registro qualitativo.** Não é só marcar que fez, é escrever o que ouviu.
3. **Constância sem culpa.** Nada murcha, nada zera, nada fica vermelho por ausência.

---

## Invariantes, o que NUNCA pode ser quebrado

Se um pedido levar a violar um destes itens, **pare e diga isso** em vez de
implementar.

### Produto e marca
- **Nenhum componente compara duas pessoas.** Sem ranking, sem placar, sem feed.
- **Nada regride visualmente.** Barra de progresso não anda para trás,
  conquista não é perdida, jardim não murcha por ausência.
- **Ausência nunca é vermelha.** Dia sem registro é cinza neutro. Vermelho
  (`--alert`) só para erro e para poda.
- **A métrica de destaque é constância dos últimos 30 dias**, não sequência.
  A chama existe, mas pausa e nunca zera, e tem 2 escudos por mês automáticos.
- **Vocabulário obrigatório:** regar, estação, poda, colheita, terra, semear.
  Nunca: meta batida, ranking, streak perdido, desafio.
- **Sem emoji e sem exclamação** em texto de sistema e notificação.

### Segurança e LGPD
- **Convicção religiosa é dado sensível** (LGPD art. 5º, II). Base legal é
  consentimento específico e destacado (art. 11), nunca legítimo interesse.
- **O texto do diário e a lista de oração vão cifrados** no banco, sempre pelo
  campo virtual do model. Nunca escreva na coluna `*_cifrado` diretamente.
- **O servidor não busca dentro do diário.** A busca roda no aparelho. Se
  alguém pedir busca textual no servidor, a resposta é que isso exigiria
  decifrar, e a decisão foi que ele não lê.
- **Token nunca em AsyncStorage nem em localStorage.** Nativo usa SecureStore,
  web usa cookie httpOnly. **Senha também nunca vai para `preferencia`** (é
  localStorage na web): o "lembrar" do login grava só o e-mail; a senha fica com
  o gerenciador do sistema (`autoComplete`).
- **Log nunca carrega** diário, senha, token, nome de terceiro. A lista de
  redação em `api/src/servidor.js` é obrigação, não conforto.
- **Toda rota valida posse do objeto**, não só a autenticação. Sem isso existe
  IDOR. E devolve 404, não 403: dizer "existe mas não é sua" já entrega informação.
- **Nome de terceiro** (lista de oração) nunca sai do banco para telemetria,
  compartilhamento ou analytics.

### Banco
- **Schema muda por migração, sempre.** `sequelize.sync()` é proibido em
  qualquer ambiente.
- **Migração já aplicada em produção não se edita.** Crie outra.
- **Todo índice tem nome.** Sem nome, não dá para remover depois.
- **`ON CONFLICT DO NOTHING` em `Registro.regar`**, não `findOrCreate`. Medido:
  com ids diferentes na mesma prática e mesmo dia, 12 requisições simultâneas
  davam 1 sucesso e 11 erros 500. Não volte para o `findOrCreate`.
- **`data_ref` é `DATEONLY` calculado no cliente**, com o dia devocional
  começando às 4h no fuso da pessoa. Quem ora 23h50 e quem ora 00h10 precisa
  cair no mesmo dia.

### Design system
- **Nenhum valor literal fora de `tokens.css`.** Nem cor, nem espaçamento, nem
  duração. O teste `tokens.spec.js` reprova o build.
- **A cadeia dos tokens tem uma direção só:** `tokens.css` → `tokens.json` →
  `tema.ts`. Nunca edite `tema.ts` à mão.
- **Se a cor virou palavra, use a versão de texto.** `--broto` e
  `--accent-fill` nunca carregam texto.
- **Recuo visual não usa `opacity`.** Opacidade derruba o contraste do texto
  abaixo de AA. Use fundo transparente e traço tracejado.
- **Estado nunca é só cor.** Pedido respondido diz "Respondida em 28 de agosto".
- **Toda animação passa por `useMovimentoReduzido()`.**

---

## Stack e versões

| Camada | Escolha | Observação |
|---|---|---|
| App | Expo SDK 57, RN 0.86, React 19.2 | Nova Arquitetura ligada |
| Navegação | expo-router, saída `static` | URL de verdade, indexável |
| Movimento | Reanimated 4.5 | Plugin do babel é `react-native-worklets/plugin`, mudou na v4 |
| API | Fastify 5 | Validação com zod |
| Banco | Postgres 16, imagem `pgvector/pgvector:pg16` | pgvector só no conteúdo, nunca no diário |
| ORM | Sequelize 6.37 + sequelize-cli | A v7 segue em alfa, não use |
| Id | UUIDv7 gerado no cliente | Ordenável no tempo, torna a sincronização idempotente |
| Alvo inicial | PWA no navegador | Loja depois, quando a base crescer |

## Convenções

- Código, comentários, nomes de tabela e mensagens de erro **em português**.
- Tabela no singular e `snake_case`. No código, `camelCase`.
- Datas: `criado_em`, `atualizado_em`, `removido_em`.
- Componente RN com prefixo do domínio, CSS com prefixo `jd-`.
- Diferença entre web e nativo vive em arquivo `.web.ts`, nunca em `if (Platform...)`
  espalhado pelo código.
- Comentário explica **por quê**, não o quê. Comentário que descreve a linha
  seguinte é ruído.

## Comandos

```bash
docker compose up -d                    # Postgres com pgvector e Redis
cd api && npm run migrar && npm run dev  # API em :3333
cd app && npm run tema && npm run web    # app em :8081
cd design-system && npm run teste        # 74 testes
```

## Onde as decisões estão explicadas

- `manual-dev.html` — manual de desenvolvimento, com o porquê de cada escolha
- `lgpd/checklist.md` — o que a lei exige, traduzido em tarefa de código
- `ROADMAP.md` — o que construir em seguida, em fatias
- `PLANO-GESTAO.md` — o painel de gestão e os papéis (RBAC)
- `PLANO-ASSINATURAS.md` — assinaturas e cobrança (Efí), máquina de estados e leis
- `design-system/VERSIONAMENTO.md` — como versionar e o que testar na mão

## Estado atual

Feito: migrações, models, cifra, senha, sessão (Bearer e cookie), rate limit,
sync em lote, fila offline (SQLite e IndexedDB), design system com 74 testes,
tela Hoje com dados de exemplo.

Assinaturas (Fatias A e B, feitas): migração `assinatura` e `cobranca`, models,
máquina de estados em `api/src/lib/assinatura.js` (com testes), gate de acesso
no login e em `/v1/eu` (equipe é isenta), cancelar assinatura no painel, rotina
diária `fechar-assinaturas`. Efí ao vivo: `lib/efi.js` (plano, assinatura no
cartão, PIX avulso, cancelar), rotas `/v1/assinatura/*`, webhooks
`/v1/webhooks/efi[/pix]` com conciliação idempotente em `lib/conciliacao.js`.
Plano de sandbox criado (`EFI_PLANO_ID=71878`).

Endurecimento de segurança dos pagamentos (feito): o webhook de PIX NUNCA
confia no corpo (é forjável) — para cada txid ele reconsulta a Efí em
`efi.consultarPix` e só credita com `status === 'CONCLUIDA'` e valor pago maior
ou igual ao esperado (`conciliacao.aplicarPixPago(db, txid, verificado)`).
`origemOk` do webhook falha FECHADO em produção quando `EFI_WEBHOOK_SEGREDO`
não está setado (antes falhava aberto), e compara o segredo em tempo constante;
o segredo vai na querystring porque a Efí só chama a URL registrada, e o log do
servidor descarta a querystring (`req.url.split('?')[0]`) para não vazar
`?segredo=` nem `?tag=`. Trial é uma vez por pessoa: `iniciar-trial` recusa
(409 `trial_indisponivel`) se já existir QUALQUER assinatura do usuário, mesmo
encerrada ou removida (`paranoid:false`) — senão bastava deixar vencer e
recomeçar de graça. Assinar no cartão só marca `ativa`/cobrança `pago` quando
`r.charge.status` está em `PAGO`; senão a assinatura fica `iniciada` e o webhook
confirma (nada de acesso sem pagamento certo; o app avisa "em análise"). A
rotina `fechar-assinaturas` encerra por `UPDATE ... WHERE id E status` atual,
para não sobrescrever quem pagou durante o laço. Redação de log cobre o diário
no caminho real (`req.body.anotacao.texto/tags` e `registros[*]...`). Anti
enumeração: cadastro faz hash de enganação quando a conta já existe (iguala o
tempo) e login bloqueado responde igual a credencial errada (401), porque conta
inexistente nunca bloqueia.

Gestão de assinaturas (feito): app tem tela `pagamentos.tsx` (histórico do
próprio usuário, lê de `GET /v1/assinatura`, link em Ajustes); cancelar já
existia em Ajustes › Assinatura. Painel ganhou seção Assinaturas
(`GET /v1/admin/assinaturas/resumo`): contadores e três listas — a renovar
(ativa com cobrança em 7 dias + inadimplentes), cancelaram (cancelada/encerrada)
e ativos engajados (usável + regou nos últimos 7 dias). Clicar numa pessoa abre
o histórico de cobrança dela (`GET /v1/admin/usuarios/:id/cobrancas`). Os dois
endpoints de gestão são `Cache-Control: no-store`. Sobre "demora pra ver dados
novos": não é índice (assinatura/cobranca/registro já indexados) nem o painel (o
`irPara` re-busca a cada troca de seção); é cache de cliente (`staleTime`) somado
a `Cache-Control: max-age` nos catálogos públicos (trilhas/estações 10min) —
conteúdo recém-publicado só aparece após esse prazo. Decisão: manter o cache das
trilhas/estações e deixar gestão sempre fresca (`no-store`). Exceção: o catálogo
de práticas (`GET /v1/disciplinas`) usa cache curto de 1min (server `max-age=60`
com `staleTime` de 60s em `useDisciplinas`), porque uma prática criada no painel
precisa aparecer no app quase na hora, não daqui a uma hora.

Assinaturas (Fatia C, feita): app com `lib/assinatura.ts`, guard de rota
(sem assinatura → /assinar; encerrada → /reativar; equipe isenta), telas
`assinar.tsx` (7 dias grátis, cartão tokenizado no aparelho por
`payment-token-efi`, PIX, aviso de troca de preço) e `reativar.tsx`, seção
Assinatura em Ajustes. Preço versionado com grandfathering (`plano_preco`,
migração com aviso + novo aceite), com editor no painel. Textos legais (termos
e privacidade) editáveis no painel (`documento_legal`), lidos por
`GET /v1/documentos/:chave` e mostrados numa modal no cadastro.

Diário (feito): tela `diario.tsx` lê de `GET /v1/diario`. Apagar uma anotação
(`DELETE /v1/diario/:id`, valida posse, 204 idempotente) some SÓ com o texto — a
rega do dia FICA, porque nada regride: constância não cai por reflexão apagada.
No nativo, `apagarAnotacaoLocal` limpa a cópia FTS; na web não há cópia local.
Vínculo com trilha: `anotacao.trilha_id` + `trilha_dia_ordem` (migração
`20260917120000`), preenchidos quando a folha `anotar` vem de um dia de trilha
(params `trilha` e `dia`, passados por `trilha.tsx`). O diário mostra o vínculo e
um botão "Ver o dia" que abre `relembrar.tsx` (`GET /v1/diario/:id`): o
devocional daquele dia por inteiro mais a resposta escrita — o texto do diário
NUNCA viaja na URL, só o id. Aviso passageiro (toast) global em `lib/aviso.tsx`
(montado na raiz para sobreviver à troca de tela); ao regar com reflexão, a folha
confirma "Regado" e fecha.

Catálogo de práticas no painel (feito): a autora cria, ajusta e inativa as
disciplinas espirituais (o que o app chama de "práticas") na seção Práticas do
painel (só admin). Migração `20260918120000` adiciona `disciplina.ativo`
(BOOLEAN default true): inativar tira do catálogo de novas práticas sem apagar
nem tirar de quem já usa — `GET /v1/disciplinas` passou a filtrar `ativo:true`;
quem já tem a prática segue por `GET /v1/praticas` (nada murcha). Não usamos o
soft delete para isso: inativar é reversível e frequente, remover é definitivo.
Rotas admin `GET/POST/PUT /v1/admin/disciplinas` (lista traz `emUso`, a contagem
de práticas ativas que a referenciam, para pesar o impacto; `no-store`); o
`codigo` é a chave estável e não muda em edição. `icone` e `codigo` são nomes
semânticos (slug minúsculo), não emoji; o app agora desenha pelo `icone` (com
fallback ao `codigo`) em `praticas.tsx` e `hoje.tsx`, então uma prática nova pode
reaproveitar um glifo de `IconeDisciplina` (nome sem glifo cai no círculo neutro).
O mapa `PATHS` de `IconeDisciplina.tsx` traz os 8 originais mais cruz, estrela,
louvor, calice, vela, montanha, testemunho, gota, broto e casa; para um glifo
novo, some um path preenchido ali e a opção no datalist do painel. Mudança no
catálogo aparece no app após o cache dos catálogos (até 1h).

Falta: pregar `exigirAssinatura` nas rotas de produto; testar o cartão em
navegador com o Efí.js real (`EXPO_PUBLIC_EFI_PAYEE_CODE`); ligar o webhook ao
vivo (`EFI_WEBHOOK_URL`) e a `EFI_PIX_CHAVE`; ligar a tela de práticas do app na
API, oração, rotas de LGPD. Ver `ROADMAP.md` e `PLANO-ASSINATURAS.md`.
