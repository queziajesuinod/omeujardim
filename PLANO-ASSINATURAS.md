# Assinaturas e cobrança — plano

O produto vira pago: para usar o app é preciso uma assinatura. Documento vivo —
decisão que mudar, muda aqui primeiro e depois no código.

## Decisões (respostas da autora, 2026-09-04)

- **Gateway:** Efí (Gerencianet). Construir contra o **sandbox** primeiro; a
  produção entra virando `EFI_SANDBOX=false` e trocando as credenciais.
- **Recorrência:** cartão de crédito recorrente automático, pela **API de
  Assinaturas** da Efí (plano + subscription). PIX fica como pagamento
  **avulso** de uma mensalidade (o PIX comum não se cobra sozinho todo mês).
- **Plano:** mensal, com **7 dias grátis**. A conta habilita no cadastro assim
  que a assinatura começa (em trial); a 1ª cobrança cai no 8º dia se não
  cancelar. O **valor** é configurável (`EFI_PLANO_VALOR_CENTAVOS`).
- **Cancelamento:** mantém acesso até o **fim do período já pago**, para as
  cobranças futuras, e depois **inativa**. Sem estorno automático de
  arrependimento (o direito do art. 49 do CDC segue existindo e é tratado por
  atendimento, não automaticamente).

## Leis que moldam o módulo

- **Cartão nunca toca nosso servidor.** A tokenização é da Efí (Efí.js no
  cliente devolve um `payment_token`); o backend recebe só o token. Nada de PAN,
  CVV ou validade no nosso banco ou log. Isso nos mantém fora do escopo pesado
  de PCI-DSS.
- **Consentimento de recorrência é explícito** (CDC + boas práticas de
  cobrança): a pessoa marca "autorizo a cobrança mensal recorrente no cartão",
  vê o valor, o ciclo e a data da 1ª cobrança antes de confirmar.
- **Cancelar é tão fácil quanto assinar** (CDC art. 51): um toque em Ajustes,
  sem ligação nem ginástica.
- **Recibo e histórico** de cada cobrança ficam disponíveis para a pessoa.
- **LGPD:** dado financeiro é pessoal (não sensível como convicção religiosa,
  mas protegido). Não vai para telemetria. `efi_*` ids ficam no banco para
  conciliação; nada de número de cartão. O log redige o corpo dos webhooks.

## Máquina de estados da assinatura

Uma linha em `assinatura` por ciclo de vida. `status`:

| status | significa | acesso ao app |
|---|---|---|
| `iniciada` | criada, aguardando 1º pagamento/def. de cartão | não (salvo trial) |
| `trial` | 7 dias grátis, cartão na mão, vai cobrar no fim | sim, até `trial_ate` |
| `ativa` | pagando em dia | sim |
| `inadimplente` | uma cobrança falhou | não (dunning é fatia futura) |
| `cancelada` | a pessoa cancelou; sem cobranças futuras | sim, até `periodo_fim` |
| `encerrada` | trial/período acabou sem pagamento, ou cancelada venceu | não |

Regra de acesso (`assinaturaUsavel`): `trial` até `trial_ate`, `ativa` sempre,
`cancelada` até `periodo_fim`. Qualquer outro = bloqueado.

**Staff é isento.** Quem tem `papeis` (admin, trilheiro, intercessor) não passa
pelo gate — a equipe usa o app sem assinar. `desativado_em` (ação do admin)
continua bloqueando por cima de tudo.

## Fluxos

**Cadastro (gate de assinatura).** Cadastrar cria a conta como hoje. No login,
a resposta e `/v1/eu` trazem `assinatura: {status, usavel, motivo}`. Se não é
usável, o app leva à tela de assinatura (a pessoa está autenticada e chama as
rotas de assinar). Assim que o trial começa, o acesso libera.

**Voltar depois de cancelar.** Quem tenta logar com assinatura `encerrada`
recebe `motivo: 'encerrada'`; o app mostra "sua assinatura foi encerrada" e leva
a assinar de novo (nova `assinatura`, novo trial? não — reativação cobra já; a
fatia 3 define o texto).

**Cancelar pelo painel.** Na lista de contas, "Cancelar assinatura" marca
`cancelada` e fixa `periodo_fim` no fim do ciclo pago; a Efí é avisada para não
cobrar mais. A rotina diária `fechar-assinaturas` vira `cancelada` vencida em
`encerrada` e bloqueia. Nenhuma cobrança nova acontece.

## Arquitetura

- `api/src/lib/efi.js` — **adaptador** único sobre o SDK `sdk-node-apis-efi`.
  Todo contato com a Efí passa por aqui (criar plano, criar assinatura, definir
  cartão, cobrança PIX avulsa, cancelar). Isola o SDK para testar com mock e
  trocar sandbox/produção por config.
- `api/src/lib/assinatura.js` — **domínio puro**, sem I/O: a máquina de estados,
  `assinaturaUsavel`, cálculo de `periodo_fim`/`trial_ate`. Testável direto.
- `api/src/rotas/assinaturas.js` — rotas do titular: `GET /v1/assinatura`,
  `POST /v1/assinatura/assinar` (cartão), `POST /v1/assinatura/pix` (avulso),
  `POST /v1/assinatura/cancelar`.
- `api/src/rotas/webhooks.js` — `POST /v1/webhooks/efi`: confirma pagamento e
  move a máquina de estados. Verifica origem (mTLS/HMAC da Efí).
- `api/src/rotas/admin.js` — ação de cancelar assinatura na lista de contas.
- `api/src/tarefas/fechar-assinaturas.js` — rotina diária: encerra canceladas
  vencidas e trials/períodos sem pagamento.

## Fatias

**Fatia A · Fundação (sem cobrar de verdade).** Migrações `assinatura` e
`cobranca`; models; `lib/assinatura.js` (domínio + testes); config `.env`;
esqueleto do `lib/efi.js`; `assinatura` na resposta de login e `/v1/eu`;
`exigirAssinatura` (decorator, ainda não pregado nas rotas); ação de cancelar no
painel; rotina `fechar-assinaturas`. Verificável por inject + testes de domínio.

**Fatia B · Efí ao vivo (sandbox). FEITA.** `lib/efi.js` real (plano, assinatura
one-step no cartão, PIX avulso, cancelar, resolver notificação); rotas do titular
`/v1/assinatura/*`; webhooks `/v1/webhooks/efi` e `/v1/webhooks/efi/pix` com
conciliação idempotente em `lib/conciliacao.js`. Plano criado no sandbox
(`EFI_PLANO_ID=71878`). Verificado: criação de plano ao vivo no sandbox, e o
fluxo trial → assinar → webhook recorrente (idempotente) → PIX → cancelar com o
gateway mockado (o `payment_token` real depende do navegador, Fatia C).

Falta ligar ao vivo: cadastrar `EFI_WEBHOOK_URL` no painel da Efí (com um túnel
em dev), definir `EFI_PIX_CHAVE`, e testar o cartão de ponta a ponta com o
Efí.js (Fatia C).

**Fatia C · App. FEITA (a menos do teste em navegador).** `lib/assinatura.ts`
(estado + ações), guard de rota em `_layout.tsx` (sem assinatura usável → /assinar;
encerrada → /reativar; equipe isenta), telas `assinar.tsx` (7 dias grátis,
cartão tokenizado no aparelho por `lib/efi-token(.web).ts`, PIX, aviso de troca
de preço) e `reativar.tsx`, e a seção Assinatura em Ajustes (status, valor,
cancelar). O cadastro herda o gate pelo guard, sem código extra. Verificado por
`tsc`; falta o teste em navegador com o Efí.js real (precisa de
`EXPO_PUBLIC_EFI_PAYEE_CODE`) e pregar `exigirAssinatura` nas rotas de produto.

## Preço versionado com grandfathering (FEITO no backend)

`plano_preco` guarda o histórico; o vigente é o mais recente (semente no .env).
Cada `assinatura` congela o seu `valor_centavos`, então mudar o preço afeta só
novos assinantes. Migrar um antigo é MARCAR a troca (`preco_novo_centavos` +
`troca_preco_em`); o app avisa e a pessoa dá novo aceite, que cria uma
assinatura no valor novo (aumento em contrato contínuo exige aviso + novo
consentimento — CDC e regras de cartão). Admin: `GET/PUT /admin/plano/preco` e
`POST /admin/assinaturas/migrar-preco`. Verificado por inject (10 asserções).

## Invariantes deste módulo

- Dado de cartão **nunca** no nosso banco nem log; só `payment_token` e ids da
  Efí.
- Cobrança recorrente só com consentimento explícito e valor/ciclo à vista.
- Cancelar é um toque, e para as cobranças de imediato (o acesso é que respeita
  o fim do período).
- Toda transição de estado passa por `lib/assinatura.js`; rota não decide estado
  na mão.
- Webhook valida a origem antes de mover qualquer estado.
