# o meu jardim · starter

Código inicial que acompanha o manual de desenvolvimento. Não é um app pronto:
é a base já decidida, para você não gastar a primeira semana escolhendo coisa.

```
starter/
  docker-compose.yml     Postgres 17 local, com as extensões já criadas
  .env.example           todas as variáveis, com o que cada uma faz
  api/                   Fastify 5 + Sequelize 6 + Postgres
  app/                   React Native com Expo, tema gerado dos tokens
  lgpd/checklist.md      o que a lei exige, traduzido em tarefa de código
```

## Subir em cinco minutos

```bash
cp .env.example .env
# gere as duas chaves de verdade, não use as do exemplo
openssl rand -base64 32   # cole em JWT_SEGREDO
openssl rand -base64 32   # cole em CRIPTO_CHAVE

docker compose up -d
cd api && npm install && npm run migrar && npm run dev
```

Confira em `http://localhost:3333/saude`.

No app:

```bash
cd app
npm install
npm run tema        # gera tema/tema.ts a partir de design-system/tokens.json
npx expo start --web
```

O alvo inicial é o navegador, sem publicar nas lojas. A seção 09 do manual
explica o que muda, o que se perde e como voltar para a loja depois sem refazer.

## O que já está resolvido aqui

| Assunto | Onde | Decisão |
|---|---|---|
| Identificador | `api/src/lib/id.js`, `app/lib/id.ts` | UUIDv7, gerado no celular, ordenável no tempo |
| Cifra do diário | `api/src/lib/cripto.js` | AES-256-GCM, campo virtual no model, ninguém escreve em claro por acidente |
| Senha | `api/src/lib/senha.js` | Argon2id nos parâmetros da OWASP, com rehash automático |
| Sessão | `api/src/plugins/autenticacao.js` | Acesso de 15 min, refresh rotativo com detecção de reuso por família |
| Borda | `api/src/plugins/seguranca.js` | helmet, CORS por lista, rate limit, erro sem stack |
| Migrations | `api/src/db/migrations` | sequelize-cli, nunca `sync()` |
| Offline | `app/lib/fila-offline.ts` | grava local primeiro, fila de saída, sincronização idempotente pelo id |
| Tema | `app/tema/gerar-tema.js` | gerado dos tokens do design system, nenhum hex digitado no app |
| Web e nativo | `*.web.ts` ao lado do arquivo nativo | o Metro escolhe sozinho, o resto do código não sabe da diferença |
| Sessão web | `api/src/plugins/sessao-web.js` | cookie httpOnly mais CSRF de dupla submissão, convivendo com o Bearer do app |
| PWA | `app/app.json` | saída estática, ícone maskable, abre direto em /hoje |
| Movimento | `app/tema/tema.ts` | três molas do Reanimated, traduzidas dos tokens de tempo |

## O que ainda falta, e é de propósito

Cadastro de disciplinas (seed), trilhas de conteúdo, notificações, telas.
O starter para onde as decisões acabam e o produto começa.

## Verificado

As bibliotecas `id.js` e `cripto.js` foram executadas: UUIDv7 sai ordenável,
a cifra volta idêntica, duas cifras do mesmo texto são diferentes, adulteração
é detectada, e o índice cego é estável sem revelar o conteúdo.
