# Roteiro, em fatias

Cada fatia entrega algo que funciona de ponta a ponta e que você consegue
mostrar para alguém. Nenhuma delas deixa uma parte pendurada esperando outra.

Regra para não travar: **uma fatia por vez, do banco até a tela**. É tentador
fazer "todas as rotas" e depois "todas as telas", mas aí você passa duas
semanas sem nada para olhar, e é assim que projeto de uma pessoa morre.

O tempo estimado é para uma pessoa trabalhando algumas horas por dia. Se
passar muito disso, a fatia estava grande demais e vale quebrar.

---

## Fatia 1 · Disciplinas e práticas
**~2 dias**

O catálogo de disciplinas existe e a pessoa escolhe as dela.

- Seeder com as 8 disciplinas (oração, leitura, meditação, jejum, memorização,
  gratidão, serviço, generosidade), com código, nome, ícone e ordem
- `GET /v1/disciplinas` (público, cacheável)
- `GET /v1/praticas` e `POST /v1/praticas` (privado, valida posse)
- Tela de escolha de práticas, com meta semanal e dias da semana

**Pronto quando:** você cria a sua conta, escolhe três práticas, mata o app,
abre de novo e elas continuam lá.

---

## Fatia 2 · A tela Hoje de verdade
**~2 dias**

Trocar os dados de exemplo pela API e ligar a fila offline.

- `hoje.tsx` busca de `GET /v1/praticas` com TanStack Query
- O botão de regar chama `regar()` da fila offline, não `setState`
- `GET /v1/constancia` alimenta o número em destaque
- Estado vazio "Terra limpa" quando não há prática configurada

**Pronto quando:** modo avião, você rega, liga a rede, e o registro sobe
sozinho sem você fazer nada.

---
   
## Fatia 3 · Entrar e sair
**~2 dias**

- Telas de cadastro e login, com as duas caixas de consentimento separadas
- Guarda de rota: sem sessão vai para `/entrar`
- Renovação silenciosa do token antes de expirar
- Tratamento honesto do 503 do limitador de senha ("servidor ocupado, um instante")

**Pronto quando:** você entra em dois navegadores, sai em um, e o outro é
derrubado na próxima renovação.

---

## Fatia 4 · O diário
**~3 dias**

É a fatia que dá valor de longo prazo ao produto.

- Folha de registro com campo de anotação, tags e referência
- A anotação sobe cifrada, junto do registro, na mesma transação
- Tela de diário com linha do tempo
- Busca local por palavra (SQLite FTS5 no nativo), filtro por tag na web
- Aviso claro na web de que a busca por palavra não existe ali

**Pronto quando:** você escreve três anotações, dá um dump do banco e não
encontra uma palavra em claro.

---

## Fatia 5 · Oração
**~2 dias**

- Lista com os três estados, criar, marcar como respondido com testemunho
- Título, pessoa e testemunho cifrados
- Estado escrito, não só colorido

**Pronto quando:** você marca um pedido como respondido e o testemunho aparece
aberto na lista, não escondido atrás de um toque.

---

## Fatia 6 · Jardim e camada de jogo
**~3 dias**

- Tabela de eventos de semente e o cálculo dos graus
- Chama com escudo de graça, que pausa e nunca zera
- Calendário de constância dos 30 dias
- 10 conquistas, incluindo "Volta por cima"

**Pronto quando:** você fica 8 dias sem registrar, volta, e o app te recebe
com "que bom te ver" em vez de mostrar prejuízo.

---

## Fatia 7 · Trilhas de conteúdo
**~3 dias, mais o tempo de escrever o conteúdo**

- Importador de markdown para `trilha` e `trilha_dia`
- Trilha "Não temas, 30 dias" e um microplano de 7 dias
- Tela de trilha, com o dia, a pergunta e a resposta indo direto para o diário
- Job que gera os embeddings e a busca semântica por pgvector

**Pronto quando:** você pergunta "algo sobre medo de perder o emprego" e vem o
dia certo, mesmo sem a palavra emprego no texto.

---

## Fatia 8 · Direitos do titular
**~2 dias**

Pequena se feita agora, cara se deixada para depois de a base crescer.

- `GET /v1/meus-dados` (já existe, falta a tela)
- `DELETE /v1/minha-conta` com expurgo real em 30 dias
- Revogar consentimento em Ajustes
- Rotina de expurgo agendada

**Pronto quando:** você exporta e exclui a sua própria conta de teste, e
confirma no banco que as linhas sumiram depois do prazo.

---

## Fatia 9 · Lembrete
**~2 dias**

- Preferência de horário por prática
- Web Push com o espalhamento de `lib/lembrete.js`
- Tela pedindo a instalação do PWA, **depois da terceira rega**, não na primeira visita
- Alternativa por WhatsApp para quem não instalar, só com opt-in e com saída em toda mensagem

**Pronto quando:** você recebe o lembrete no seu celular, no horário certo, sem
conteúdo do diário na prévia.

---

## Fatia 10 · Publicar
**~2 dias**

- Deploy da API, do banco e do Redis
- Build web estático e domínio `omeujardim.app.br`
- Sentry ou equivalente, com as regras de redação de log
- Os alarmes da seção 08 do manual

**Pronto quando:** alguém que não é você usa por três dias e você consegue ver
que usou, sem ter aberto o banco.

---

## Depois disso

Só faça o que os números pedirem. Se a retenção no iPhone ficar muito abaixo
da do Android, isso é o argumento para publicar nas lojas. Se ninguém escrever
anotação, o pilar do registro qualitativo precisa mudar antes de qualquer
funcionalidade nova. Se as pessoas voltarem depois de sumir, a decisão da
constância sem culpa está certa e vale investir mais nela.

---

## Como retomar depois de uma pausa

1. Leia `CLAUDE.md`. É o que carrega as decisões.
2. Rode `npm run teste` no design system e `npm run migrar:status` na API.
   Se os dois estiverem verdes, o projeto está no estado que você deixou.
3. Abra este arquivo e pegue a próxima fatia não riscada.
4. Se for usar o Claude Code, comece a sessão com: "leia o CLAUDE.md e o
   ROADMAP.md, vamos fazer a fatia N". Ele herda todo o contexto e não
   redecide o que já foi decidido.

## Riscar aqui

- [x] Fatia 0 · Base: banco, migrações, models, cifra, sessão, design system, tela Hoje de exemplo
- [x] Fatia 1 · Disciplinas e práticas
- [x] Fatia 2 · A tela Hoje de verdade
- [x] Fatia 3 · Entrar e sair
- [x] Fatia 4 · O diário
- [x] Fatia 5 · Oração
- [x] Fatia 6 · Jardim e camada de jogo
- [x] Fatia 7 · Trilhas de conteúdo
- [x] Fatia 8 · Direitos do titular
- [x] Fatia 9 · Lembrete
- [ ] Fatia 10 · Publicar
