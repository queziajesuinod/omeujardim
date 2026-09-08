#!/bin/sh
# Roda as migrações e sobe a API. Migração é obrigatória: sequelize.sync é
# proibido no projeto. Com UMA instância, migrar aqui é seguro; se um dia
# houver mais de uma, rode a migração como passo único do deploy, não no start.
set -e

echo "→ Aplicando migrações do banco..."
node_modules/.bin/sequelize-cli db:migrate

echo "→ Subindo a API na porta ${PORT:-3000}..."
exec node src/servidor.js
