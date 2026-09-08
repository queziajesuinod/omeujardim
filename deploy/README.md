# Deploy — o meu jardim

Há duas formas, escolha uma:

- **Opção A — `stack.yml` (Docker Swarm + Traefik já existente).** Igual ao
  projeto espontâneo: você já tem um Traefik rodando com a rede externa
  `network_public` e o resolver `letsencryptresolver`. Não builda imagem — clona
  o repositório em runtime. **Um domínio só** (`/v1/*` vai para a API, o resto
  para o app) e o painel num subdomínio. Use o Postgres externo que você já tem.
- **Opção B — `docker-compose.yml` (stack autossuficiente).** Sobe um Traefik
  próprio, Postgres (pgvector) e Redis junto. Boa quando o servidor é só deste
  projeto. Builda imagens.

---

## Opção A — Swarm + Traefik existente (estilo espontâneo)

```bash
# 1. Edite deploy/stack.yml e troque os <...>: domínio, URL do repositório,
#    branch, DATABASE_URL (Postgres externo), segredos e credenciais da Efí.
nano deploy/stack.yml

# 2. Suba a stack (o serviço api roda as migrações ao iniciar)
docker stack deploy -c deploy/stack.yml jardim

# 3. Coloque o certificado .p12 da Efí no volume jardim_certs (uma vez)
CID=$(docker ps -q -f name=jardim_api)
docker cp ./certificado.p12 "$CID":/certs/certificado.p12

# 4. Semeie o catálogo e conceda admin (crie a conta no app antes)
docker exec "$CID" sh -lc 'cd /src/api && npm run semear'
docker exec "$CID" sh -lc 'cd /src/api && npm run papel -- voce@exemplo.com admin'
```

Pré-requisitos: Traefik com `letsencryptresolver` e rede `network_public`
externa; DNS de `<SEU_DOMINIO>` e `painel.<SEU_DOMINIO>` apontando para o
servidor. O app fala com a API na **mesma origem** (`/v1`), então não há CORS
entre eles; o painel é subdomínio e já está em `CORS_ORIGENS`. A primeira subida
é lenta (clona e instala tudo dentro do container).

Atualizar: `docker service update --force jardim_api` (idem web/painel) — o
container refaz `git reset --hard` na branch e reinstala.

---

## Opção B — Compose autossuficiente (Traefik + Postgres + Redis próprios)

Três domínios, um servidor:

| Serviço | Domínio (exemplo) | O que é |
|---|---|---|
| Web | `omeujardim.app.br` | O app (Expo, estático) e a landing `/inicio` |
| API | `api.omeujardim.app.br` | Fastify |
| Painel | `painel.omeujardim.app.br` | Gestão de conteúdo/assinaturas |

Postgres (pgvector) e Redis rodam internos, sem porta pública.

## Pré-requisitos

1. Um servidor Linux com Docker e o plugin `docker compose`.
2. **DNS**: crie um registro `A` para cada domínio acima apontando para o IP do
   servidor (inclua `www` se quiser). A emissão do certificado só funciona
   depois que o DNS propaga.
3. Portas **80** e **443** abertas no firewall.

## Passos

```bash
# 1. No servidor, clone o projeto e entre na pasta de deploy
cd starter/deploy

# 2. Crie o .env de produção a partir do modelo e preencha
cp .env.example .env
nano .env            # domínios, ACME_EMAIL, senha do banco, segredos, Efí

# 3. (Efí) coloque o certificado .p12 em api/certs/ e ajuste EFI_CERTIFICADO
mkdir -p ../api/certs
#   ...copie o seu-certificado.p12 para ../api/certs/

# 4. Suba tudo (a API roda as migrações sozinha ao iniciar)
docker compose up -d --build

# 5. Semeie o catálogo de disciplinas (uma vez)
docker compose exec api npm run semear

# 6. Conceda o papel de admin à sua conta (crie a conta no app antes)
docker compose exec api npm run papel -- voce@exemplo.com admin
```

Acompanhe os logs e a emissão do certificado:

```bash
docker compose logs -f traefik
docker compose logs -f api
```

## Segredos (gere novos para produção)

```bash
openssl rand -base64 32     # JWT_SEGREDO e CRIPTO_CHAVE (um para cada)
cd ../api && npm run vapid  # VAPID_PUBLIC / VAPID_PRIVATE
```

Não reaproveite os segredos de desenvolvimento. A `CRIPTO_CHAVE` cifra o diário:
guarde um backup dela separado do backup do banco — perdê-la é perder o diário
de todos, sem recuperação.

## Rotinas agendadas (cron)

A API roda as rotinas diárias por `setInterval` quando `LEMBRETES_INLINE=true`.
Com mais de uma instância, isso duplicaria os envios: nesse caso, desligue o
inline e chame por cron externo:

```bash
docker compose exec api npm run lembretes
docker compose exec api npm run fechar-assinaturas
docker compose exec api npm run expurgar
```

## Atualizar

```bash
git pull
docker compose up -d --build
```

O app web embute `EXPO_PUBLIC_API_URL` no build; se trocar o domínio da API,
rebuilde o serviço `web`.

## Banco externo (opcional)

Para usar um Postgres gerenciado em vez do container `banco`: aponte
`DATABASE_URL` para ele, ponha `DB_SSL=true` e remova (ou ignore) o serviço
`banco` do compose. A extensão `pgvector` precisa existir no banco externo.

## Observações

- **Cookies entre subdomínios**: o app (`omeujardim.app.br`) e a API
  (`api.omeujardim.app.br`) são o mesmo site registrável, então o cookie de
  sessão (`SameSite=Lax`, `Secure`) é enviado normalmente. Mantenha `CORS_ORIGENS`
  com os domínios `https://` corretos.
- **Migração com várias instâncias**: o `docker-entrypoint.sh` migra no start,
  o que é seguro com uma instância. Para escalar, rode a migração como passo
  único do deploy e remova-a do entrypoint.
- **Primeiro certificado**: se falhar, quase sempre é DNS ainda não propagado ou
  porta 80 fechada. O Let's Encrypt tem limite de tentativas por hora.
