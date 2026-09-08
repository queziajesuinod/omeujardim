# App web (Expo, saída estática). As variáveis EXPO_PUBLIC_* são lidas no BUILD
# e ficam embutidas no bundle — por isso vêm como ARG, não em runtime.

# ---- build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ARG EXPO_PUBLIC_API_URL
ARG EXPO_PUBLIC_EFI_PAYEE_CODE
ARG EXPO_PUBLIC_EFI_SANDBOX=false
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL \
    EXPO_PUBLIC_EFI_PAYEE_CODE=$EXPO_PUBLIC_EFI_PAYEE_CODE \
    EXPO_PUBLIC_EFI_SANDBOX=$EXPO_PUBLIC_EFI_SANDBOX

COPY package*.json ./
RUN npm ci
COPY . .
# Gera o HTML por rota (web.output: static) em ./dist.
RUN npx expo export --platform web

# ---- run ----
FROM nginx:1.27-alpine AS run
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
