# API do o meu jardim (Fastify 5). Duas fases: a de build instala tudo (inclui
# os módulos nativos argon2 e onnxruntime, usados pela cifra e pelos embeddings)
# e a de execução só carrega o resultado, para a imagem final ficar menor.

# ---- build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .

# ---- run ----
FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
# ca-certificates: TLS para o Postgres gerenciado e para a API da Efí.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app
# Normaliza fim de linha (o arquivo pode ter sido salvo no Windows com CRLF) e
# dá permissão de execução.
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
