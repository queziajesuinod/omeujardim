'use strict';

const { novoId } = require('../../lib/id');

module.exports = (sequelize, DataTypes) => {
  const Usuario = sequelize.define('Usuario', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: novoId },
    email: {
      type: DataTypes.STRING(320),
      allowNull: false,
      validate: { isEmail: { msg: 'E-mail inválido.' } },
    },
    emailNormalizado: { type: DataTypes.STRING(320), allowNull: false },
    emailConfirmadoEm: DataTypes.DATE,
    nome: { type: DataTypes.STRING(120), allowNull: false },
    senhaHash: { type: DataTypes.STRING(255), allowNull: false },
    fuso: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'America/Sao_Paulo' },
    inicioDoDia: { type: DataTypes.TIME, allowNull: false, defaultValue: '04:00:00' },
    consentimentoVersao: DataTypes.STRING(16),
    consentimentoEm: DataTypes.DATE,
    consentimentoSensivelEm: DataTypes.DATE,
    consentimentoRevogadoEm: DataTypes.DATE,
    tentativasFalhas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    bloqueadoAte: DataTypes.DATE,
    // Alternativa de lembrete para quem não instala o PWA. A data marca o
    // opt-in; nula, o WhatsApp está desligado. Ver rotas/lembretes.js.
    whatsappNumero: DataTypes.STRING(20),
    whatsappOptInEm: DataTypes.DATE,
    // Desativada pelo admin: a conta e os dados ficam, mas não entra. Reversível.
    // Diferente de removido_em (exclusão, com expurgo em 30 dias). Ver rotas/admin.
    desativadoEm: DataTypes.DATE,
    // Papéis de acesso ao painel de gestão. Vazio = usuário comum. Ver RBAC.
    papeis: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
  }, {
    tableName: 'usuario',
    // A senha e os campos de bloqueio nunca saem por acidente numa consulta.
    // Quem precisa deles pede explicitamente o escopo comSenha.
    defaultScope: { attributes: { exclude: ['senhaHash', 'tentativasFalhas', 'bloqueadoAte'] } },
    scopes: { comSenha: { attributes: { include: ['senhaHash', 'tentativasFalhas', 'bloqueadoAte'] } } },
    hooks: {
      beforeValidate(usuario) {
        if (usuario.email) {
          usuario.email = usuario.email.trim();
          usuario.emailNormalizado = usuario.email.toLowerCase();
        }
      },
    },
  });

  Usuario.associate = (db) => {
    Usuario.hasMany(db.Pratica, { foreignKey: 'usuarioId', as: 'praticas' });
    Usuario.hasMany(db.Registro, { foreignKey: 'usuarioId', as: 'registros' });
    Usuario.hasMany(db.Anotacao, { foreignKey: 'usuarioId', as: 'anotacoes' });
    Usuario.hasMany(db.PedidoOracao, { foreignKey: 'usuarioId', as: 'pedidos' });
    Usuario.hasMany(db.AssinaturaPush, { foreignKey: 'usuarioId', as: 'assinaturas' });
  };

  /** Nunca serialize o usuário sem passar por aqui. */
  Usuario.prototype.toJSON = function () {
    const { senhaHash, tentativasFalhas, bloqueadoAte, emailNormalizado, ...resto } = this.get();
    return resto;
  };

  return Usuario;
};
