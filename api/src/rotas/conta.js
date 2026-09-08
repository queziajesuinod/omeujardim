'use strict';

const { z } = require('zod');

module.exports = async function rotasConta(app) {
  const { Usuario } = app.db;

  app.addHook('preHandler', app.exigirLoginQualquer);

  /** Quem sou eu: a tela de Ajustes mostra a conta. Senha e afins nunca saem. */
  app.get('/eu', async (req) => {
    const usuario = await Usuario.findByPk(req.user.sub);
    if (!usuario) return usuario;
    return { ...usuario.toJSON(), assinatura: await app.resumoAssinatura(usuario) };
  });

  /**
   * Preferências do dia: por ora, a hora em que o dia devocional começa. Isso
   * decide em qual dia cai uma rega (quem ora 23h50 e quem ora 00h10 precisam
   * cair no mesmo dia). O servidor guarda; o cliente também calcula com essa
   * hora, então os lembretes e as regas concordam.
   */
  app.patch('/eu', async (req, reply) => {
    const dados = z.object({
      inicioDoDia: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM.').optional(),
    }).parse(req.body);

    const patch = {};
    if (dados.inicioDoDia) patch.inicioDoDia = `${dados.inicioDoDia}:00`;
    if (Object.keys(patch).length === 0) return reply.code(400).send({ erro: 'nada_para_atualizar' });

    await Usuario.update(patch, { where: { id: req.user.sub } });
    return Usuario.findByPk(req.user.sub);
  });

  /**
   * Revogar o consentimento do dado sensível (LGPD art. 8, §5). Registramos a
   * revogação com data. O app é construído sobre esse dado (diário, oração),
   * então a tela deixa claro que revogar é parar de usar o essencial, e oferece
   * a exclusão da conta logo ao lado.
   */
  app.post('/consentimento/revogar', async (req) => {
    await Usuario.update({ consentimentoRevogadoEm: new Date() }, { where: { id: req.user.sub } });
    return { ok: true };
  });

  /**
   * Excluir a conta. Soft delete agora — a conta some do app na hora e as
   * sessões caem — e o expurgo REAL dos dados acontece em 30 dias, pela rotina
   * agendada. O prazo existe para arrependimento e para retenção legal; passado
   * ele, o CASCADE do banco leva tudo junto.
   */
  app.delete('/minha-conta', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const usuario = await Usuario.findByPk(req.user.sub);
    if (!usuario) return reply.code(404).send({ erro: 'conta_nao_encontrada' });

    await usuario.destroy();               // soft delete: removido_em = agora
    await app.encerrarSessoes(req.user.sub);
    app.limparSessaoWeb(reply, req);

    const expurgoEm = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return reply.code(202).send({ ok: true, expurgoEm });
  });
};
