# Painel de gestão — plano

A frente de operação do produto: métricas, autoria de conteúdo, papéis de
acesso, e o cronograma anual por estações. Documento vivo — decisão que mudar,
muda aqui primeiro.

## Arquitetura

**Um backend, duas frentes.**

- A **API** (Fastify) continua única. Mesmo banco, mesmos models, mesma cifra,
  mesma sessão. Ganha **RBAC** (papéis) e rotas sob `/v1/admin/*`.
- O **app** (`app/`) segue sendo o produto devocional para a pessoa.
- O **painel** (`painel/`) é uma frente **separada**, desktop-first, que reusa
  os **tokens de cor** do design-system (mesma identidade, layout diferente).

Por que separado: o painel é denso (tabelas, gráficos, filtros) e o público é a
equipe, não o usuário. Misturar as duas coisas incharia o app e faria o layout
mobile brigar com o dashboard.

## Invariante que molda tudo (LGPD)

O painel só vê **agregados**. Diário e oração seguem cifrados e privados; o
servidor não os lê. Em especial:

- O **intercessor NÃO vê** título, nome de terceiro nem testemunho de oração.
- Para o intercessor ser útil, a oração ganha uma **categoria opcional e não
  sensível** (saúde, trabalho, família, direção, luto, gratidão…), escolhida
  pela pessoa, com **opt-in explícito** "deixar intercessores orarem por esta
  categoria". O painel mostra contagem por categoria e o termômetro de
  respondidas. Nunca nome, nunca texto.

## Papéis (RBAC)

Guardados em `usuario.papeis` (array). Uma pessoa acumula papéis.

| Papel | O que vê |
|---|---|
| `admin` | tudo: métricas gerais, contas, conteúdo |
| `trilheiro` | autoria de trilhas e agendamento |
| `intercessor` | categorias de oração (sem texto) e termômetro de respondidas |
| (nenhum) | usuário comum — o app devocional |

Conceder acesso é ato administrativo, por linha de comando:

```bash
cd api
npm run papel -- pessoa@exemplo.com admin
npm run papel -- pessoa@exemplo.com -intercessor   # o "-" remove
```

## Fatias

- [x] **A — RBAC + métricas** *(em andamento)*
  - `usuario.papeis` (migração `20260907120000-cria-papeis`), guarda por papel
  - `GET /v1/admin/metricas?periodo=mes|3meses|ano`: regas, usuários ativos,
    orações, respondidas, novas contas, total de contas, série diária de regas
  - `painel/index.html`: login (Bearer, restrito a admin) + cartões + gráfico
- [x] **B — Contas e usuários ativos** — lista paginada com busca, série de ativos por dia, retenção 7/30 dias
  - `GET /v1/admin/usuarios?pagina&limite&busca`, `GET /v1/admin/contas?periodo`
  - painel: seção Contas com retenção, gráfico de ativos e tabela paginada
- [x] **C — Trilheiro** — autoria por markdown no painel + agendamento (`trilha.disponivelEm` → "em breve")
  - lib reutilizável `trilhas-importar` (CLI e painel usam a mesma), `GET/POST/PATCH/DELETE /v1/admin/trilhas`
  - app: "em breve" no catálogo e na tela da trilha; participar recusa antes da estreia (409)
  - painel: seção Trilhas (colar markdown, publicar/agendar, tabela com status)
- [ ] **D — Intercessor** — categoria opt-in na oração + painel de categorias e termômetro
- [x] **E — Estações** — temporada com conteúdo diário por prática; a pessoa escolhe qual seguir; a Hoje mostra "Estação X · dia N de M" e o conteúdo do dia
  - migração `estacao` / `estacao_dia` (matriz dia × disciplina) / `estacao_inscricao` (uma ativa por pessoa)
  - lib `estacoes-importar`, rotas públicas (`/v1/estacoes`, seguir, andamento) e de gestão (`/v1/admin/estacoes`)
  - app: selo da estação + "A estação hoje" na Hoje, tela `/estacoes` para escolher; painel: seção Estações

Todas as fatias de gestão concluídas. **Admin é coringa**: passa em todos os guards sem precisar acumular papéis (`app.exigirPapel`).

## Como rodar o painel (dev)

1. Libere a origem do painel no CORS da API. No `.env`:
   ```
   CORS_ORIGENS=http://localhost:8081,http://localhost:4000
   ```
   (adicione a porta onde o painel será servido)
2. Sirva a pasta estática, por exemplo:
   ```bash
   npx serve painel -l 4000
   ```
3. Abra `http://localhost:4000`, informe o endereço da API (padrão
   `http://localhost:3333`) e entre com uma conta que tenha o papel `admin`.

O token do painel vive **só em memória** (recarregar exige entrar de novo), pela
mesma regra do app: token nunca em localStorage. Endurecer depois com cookie
httpOnly + CSRF quando o painel virar deploy fixo.

## Pendências de ambiente

- A migração `20260907120000-cria-papeis` e a verificação das rotas dependem de
  um banco acessível. Rodar `npm run migrar` quando o `DATABASE_URL` estiver
  conectando.
