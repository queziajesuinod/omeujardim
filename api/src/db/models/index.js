'use strict';

const { Sequelize } = require('sequelize');
const config = require('../../config/banco')[process.env.NODE_ENV || 'development'];

const sequelize = new Sequelize(config.url, config);

const db = { sequelize, Sequelize };

for (const definir of [
  require('./usuario'),
  require('./sessao'),
  require('./disciplina'),
  require('./pratica'),
  require('./registro'),
  require('./anotacao'),
  require('./pedido-oracao'),
  require('./trilha'),
  require('./trilha-dia'),
  require('./trilha-inscricao'),
  require('./trilha-rega'),
  require('./estacao'),
  require('./estacao-dia'),
  require('./estacao-inscricao'),
  require('./assinatura-push'),
  require('./assinatura'),
  require('./cobranca'),
  require('./plano-preco'),
  require('./documento-legal'),
]) {
  const model = definir(sequelize, Sequelize.DataTypes);
  db[model.name] = model;
}

for (const nome of Object.keys(db)) {
  if (db[nome]?.associate) db[nome].associate(db);
}

module.exports = db;
