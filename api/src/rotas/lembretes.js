'use strict';

const { z } = require('zod');
const { chavePublica, estaLigado, enviar } = require('../lib/push');

// O que o navegador entrega ao assinar: PushSubscription.toJSON().
const assinatura = z.object({
  endpoint: z.string().url().max(1024),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

// Número de WhatsApp em formato E.164 (+55 e os dígitos). Guardado só com opt-in.
const whatsapp = z.object({
  numero: z.string().regex(/^\+\d{11,15}$/, 'Use o formato +55DDDNÚMERO.'),
});

module.exports = async function rotasLembretes(app) {
  const { AssinaturaPush, Usuario } = app.db;

  app.addHook('preHandler', app.exigirLoginQualquer);
  app.addHook('preHandler', app.exigirAssinatura);

  /**
   * A chave pública VAPID, que o cliente precisa para assinar. Não é segredo.
   * `ligado: false` quando o servidor não tem as chaves configuradas — aí a
   * tela mostra que o lembrete por push está indisponível, em vez de tentar
   * assinar e falhar sem explicação.
   */
  app.get('/lembretes/chave', async () => {
    return { ligado: estaLigado(), chave: chavePublica() };
  });

  /**
   * Assinar este aparelho. Idempotente pelo endpoint: reassinar (troca de
   * chaves, permissão reconcedida) atualiza a linha e a dona dela, não duplica.
   * Se o endpoint pertencia a outra conta neste aparelho, passa a ser desta.
   */
  app.post('/lembretes/assinatura', async (req, reply) => {
    const dados = assinatura.parse(req.body);
    const [linha] = await AssinaturaPush.findOrCreate({
      where: { endpoint: dados.endpoint },
      defaults: {
        usuarioId: req.user.sub,
        endpoint: dados.endpoint,
        p256dh: dados.keys.p256dh,
        auth: dados.keys.auth,
      },
    });
    await linha.update({
      usuarioId: req.user.sub,
      p256dh: dados.keys.p256dh,
      auth: dados.keys.auth,
    });
    return reply.code(201).send({ ok: true });
  });

  /**
   * Cancelar a assinatura deste aparelho. Apaga pelo endpoint, e só a que é
   * sua: mexer no endpoint de outra conta não tira nada e responde igual, sem
   * revelar que ele existe.
   */
  app.delete('/lembretes/assinatura', async (req) => {
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(req.body);
    await AssinaturaPush.destroy({ where: { endpoint, usuarioId: req.user.sub } });
    return { ok: true };
  });

  /**
   * Enviar um push de teste AGORA para os aparelhos desta pessoa, ignorando o
   * horário e as condições da remessa diária. Serve para conferir na hora se a
   * assinatura e o service worker estão de pé. Não toca no diário — texto fixo.
   * Rate limit apertado para não virar um canal de spam para si mesmo.
   */
  app.post('/lembretes/testar', {
    config: { rateLimit: { max: 6, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const assinaturas = await AssinaturaPush.findAll({ where: { usuarioId: req.user.sub } });
    if (assinaturas.length === 0) {
      return reply.code(409).send({ erro: 'sem_assinatura', mensagem: 'Ligue o lembrete neste aparelho antes de testar.' });
    }
    const payload = {
      titulo: 'O meu jardim',
      corpo: 'Teste de lembrete. Se você está lendo isto, está funcionando.',
      url: '/hoje',
      badge: 1,
    };
    let entregues = 0;
    for (const a of assinaturas) {
      const r = await enviar(a, payload);
      if (r === 'ok') { entregues++; await a.update({ ultimoEnvioEm: new Date() }); }
      else if (r === 'expirada') { await a.destroy(); }  // navegador cancelou: some
    }
    if (entregues === 0) {
      return reply.code(502).send({ erro: 'nao_entregue', mensagem: 'Não consegui entregar. A assinatura pode ter expirado; desligue e ligue o lembrete de novo.' });
    }
    return { ok: true, entregues };
  });

  /**
   * Ligar o lembrete por WhatsApp. Só com opt-in explícito: guardamos o número
   * e a data do consentimento. A dispensa (desligar) apaga o número junto — não
   * seguramos o dado depois que a pessoa saiu.
   */
  app.put('/lembretes/whatsapp', async (req) => {
    const { numero } = whatsapp.parse(req.body);
    await Usuario.update(
      { whatsappNumero: numero, whatsappOptInEm: new Date() },
      { where: { id: req.user.sub } },
    );
    return { ok: true };
  });

  app.delete('/lembretes/whatsapp', async (req) => {
    await Usuario.update(
      { whatsappNumero: null, whatsappOptInEm: null },
      { where: { id: req.user.sub } },
    );
    return { ok: true };
  });
};
