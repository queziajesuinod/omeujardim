# Painel de gestão (HTML único). Troca o endereço padrão da API (localhost) pelo
# de produção no build; quem entrar ainda pode sobrescrever no campo da tela.
FROM nginx:1.27-alpine
ARG API_URL=https://api.omeujardim.app.br
COPY index.html /usr/share/nginx/html/index.html
RUN sed -i "s#http://localhost:3337#${API_URL}#g" /usr/share/nginx/html/index.html
EXPOSE 80
