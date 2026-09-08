require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const comum = {
  dialect: 'postgres',
  // snake_case no banco, camelCase no código. Decidido uma vez, aqui.
  define: {
    underscored: true,
    timestamps: true,
    createdAt: 'criado_em',
    updatedAt: 'atualizado_em',
    paranoid: true,
    deletedAt: 'removido_em',
  },
  pool: { max: 10, min: 0, idle: 10000, acquire: 30000 },
  // Em produção o log de SQL não pode vazar conteúdo. Desligado.
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  timezone: '-04:00',
};

const sslProd = {
  dialectOptions: { ssl: { require: true, rejectUnauthorized: true } },
};

module.exports = {
  development: { ...comum, url: process.env.DATABASE_URL },
  test: { ...comum, url: process.env.DATABASE_URL_TESTE || process.env.DATABASE_URL, logging: false },
  production: {
    ...comum,
    url: process.env.DATABASE_URL,
    ...(process.env.DB_SSL === 'true' ? sslProd : {}),
    logging: false,
  },
};
