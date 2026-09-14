'use strict';

const { z } = require('zod');
const { novoId } = require('../lib/id');
const efi = require('../lib/efi');
const dominio = require('../lib/assinatura');
const { precoVigente } = require('../lib/preco');
const { PAGO } = require('../lib/conciliacao');

// Rotas do titular sobre a própria assinatura: ver, iniciar o trial, assinar no
// cartão (recorrente), pagar uma mensalidade por PIX (avulso) e cancelar.
// Nenhum dado de cartão passa por aqui: só o `payment_token` do Efí.js. Ver
// PLANO-ASSINATURAS.md.

module.exports = async function rotasAssinaturas(app) {
  const { Assinatura, Cobranca, Usuario } = app.db;

  app.addHook('preHandler', app.exigirLoginQualquer);

  const diaNoFuso = (fuso) => new Intl.DateTimeFormat('en-CA', { timeZone: fuso || 'America/Sao_Paulo' }).format(new Date());
  const atual = (usuarioId) => Assinatura.findOne({ where: { usuarioId }, order: [['criado_em', 'DESC']] });
  const soDigitos = (s) => String(s || '').replace(/\D/g, '');

  // Opção (b) da troca de método: só deixa PIX -> cartão quando o PIX está a
  // esta distância (em dias) do vencimento, ou já venceu. Evita pagar duas vezes.
  const JANELA_TROCA_DIAS = Number(process.env.TROCA_PIX_CARTAO_JANELA_DIAS || 3);

  /** Estado da assinatura + o plano vigente + o histórico de cobranças. */
  app.get('/assinatura', async (req) => {
    const usuario = await Usuario.findByPk(req.user.sub, { attributes: ['id', 'fuso', 'papeis'] });
    const a = await atual(req.user.sub);
    const cobrancas = a
      ? await Cobranca.findAll({
          where: { assinaturaId: a.id },
          order: [['criado_em', 'DESC']],
          attributes: ['id', 'metodo', 'status', 'valorCentavos', 'pagoEm', 'vencimento', 'criado_em'],
        })
      : [];
    const p = efi.plano();
    const vigente = await precoVigente(app.db);
    return {
      ...(await app.resumoAssinatura(usuario)),
      // O plano mostra sempre o preço VIGENTE (o que um novo assinante pagaria).
      // O valor que ESTA pessoa paga vem em `valorCentavos` do resumo acima.
      plano: { valorCentavos: vigente.valorCentavos, ciclo: p.ciclo, trialDias: p.trialDias, nome: p.nome },
      cobrancas,
    };
  });

  /** Começa os 7 dias grátis sem cobrar. Habilita a conta no ato do cadastro. */
  app.post('/assinatura/iniciar-trial', async (req, reply) => {
    // Trial é boas-vindas, uma vez por pessoa. Vale se a pessoa NUNCA teve
    // assinatura — inclusive encerrada ou removida (por isso paranoid:false).
    // Sem isto, bastaria deixar o trial vencer (vira 'encerrada') e chamar de
    // novo para ganhar mais 7 dias, para sempre, sem nunca pagar.
    const jaTeve = await Assinatura.findOne({
      where: { usuarioId: req.user.sub }, paranoid: false, attributes: ['id'],
    });
    if (jaTeve) {
      return reply.code(409).send({
        erro: 'trial_indisponivel',
        mensagem: 'Você já usou o período grátis. Para continuar, escolha cartão ou PIX.',
      });
    }
    const usuario = await Usuario.findByPk(req.user.sub, { attributes: ['fuso'] });
    const p = efi.plano();
    const vigente = await precoVigente(app.db);
    const campos = dominio.iniciarTrial(diaNoFuso(usuario.fuso), p.trialDias);
    const a = await Assinatura.create({
      id: novoId(), usuarioId: req.user.sub, metodo: 'cartao', ciclo: p.ciclo, valorCentavos: vigente.valorCentavos, ...campos,
    });
    return reply.code(201).send({ status: a.status, trialAte: a.trialAte, periodoFim: a.periodoFim });
  });

  const corpoAssinar = z.object({
    payment_token: z.string().min(10).max(200),
    // Consentimento explícito e destacado da cobrança recorrente (CDC).
    aceitaRecorrencia: z.literal(true),
    // A Efí exige nome e sobrenome do titular (pelo menos duas palavras).
    nome: z.string().trim().min(3).max(120).optional(),
    cpf: z.string().min(11).max(18),
    telefone: z.string().min(10).max(20),
    nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.'),
  });

  /** Assina no cartão: cria a recorrência na Efí e cobra a 1ª mensalidade. */
  app.post('/assinatura/assinar', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const dados = corpoAssinar.parse(req.body);
    const usuario = await Usuario.findByPk(req.user.sub, { attributes: ['id', 'nome', 'email', 'fuso'] });
    const p = efi.plano();
    // Assinar/reassinar sempre pega o preço VIGENTE — é o novo aceite que aplica
    // uma migração de preço marcada pelo admin.
    const vigente = await precoVigente(app.db);

    // Opção (b) da troca de método: quem já tem PIX pago com dias sobrando não
    // troca para cartão agora (senão pagaria duas vezes). Só perto do vencimento.
    const anterior = await atual(req.user.sub);
    if (anterior && anterior.metodo === 'pix' && anterior.status === 'ativa' && anterior.periodoFim) {
      const lim = new Date(diaNoFuso(usuario.fuso) + 'T00:00:00Z');
      lim.setUTCDate(lim.getUTCDate() + JANELA_TROCA_DIAS);
      if (String(anterior.periodoFim) > lim.toISOString().slice(0, 10)) {
        return reply.code(409).send({
          erro: 'pix_ainda_vigente',
          mensagem: `Você já tem acesso por PIX até ${anterior.periodoFim}. Troque para cartão perto do vencimento.`,
          periodoFim: anterior.periodoFim,
        });
      }
    }

    let r;
    try {
      r = await efi.assinarCartao({
        payment_token: dados.payment_token,
        valorCentavos: vigente.valorCentavos,
        cliente: {
          nome: dados.nome || usuario.nome, email: usuario.email,
          cpf: soDigitos(dados.cpf), telefone: soDigitos(dados.telefone), nascimento: dados.nascimento,
        },
        customId: usuario.id,
        notificationUrl: process.env.EFI_WEBHOOK_URL,
      }, req.log);
    } catch (e) {
      const motivo = efi.motivoErro(e);
      req.log.error({ efi: motivo }, 'falha ao assinar na Efí');
      return reply.code(502).send({ erro: 'falha_no_pagamento', mensagem: motivo });
    }

    const hoje = diaNoFuso(usuario.fuso);
    // Se a assinatura anterior tinha uma assinatura na Efí, cancela para não
    // cobrar dois valores (troca de preço = nova assinatura no valor novo).
    if (anterior?.efiAssinaturaId && anterior.efiAssinaturaId !== r.efiAssinaturaId && efi.configurada()) {
      try { await efi.cancelar(anterior.efiAssinaturaId); }
      catch (e) { req.log.error({ erro: typeof e === 'string' ? e : e.message }, 'falha ao cancelar assinatura antiga na Efí'); }
    }

    // Só libera acesso se a Efí confirmou o pagamento da 1ª cobrança. Um retorno
    // sem falha nem sempre é pago (cartão em análise, status 'waiting'/'new'):
    // nesse caso a assinatura fica 'iniciada' e o webhook confirma depois. Sem
    // isto, dava acesso e registrava cobrança "paga" falsa sem pagamento certo.
    const pago = !!r.charge?.status && PAGO.has(r.charge.status);

    const base = {
      metodo: 'cartao', valorCentavos: vigente.valorCentavos, efiAssinaturaId: r.efiAssinaturaId,
      // O novo aceite quita qualquer troca de preço que estivesse marcada.
      precoNovoCentavos: null, trocaPrecoEm: null,
    };
    // Quem paga com um período ainda em curso (o teste, ou dias já pagos) não
    // perde esses dias: o ciclo pago começa no fim do que já vale, não hoje. É o
    // mesmo que o PIX faz na conciliação. Só uma assinatura nova (sem período
    // vigente) começa a contar de hoje.
    const temPeriodoVigente = anterior && !['encerrada', 'cancelada'].includes(anterior.status) && anterior.periodoFim && String(anterior.periodoFim) > hoje;
    const ativa = temPeriodoVigente
      ? dominio.aoConfirmarPagamento(anterior, hoje, p.ciclo)
      : dominio.iniciarAtiva(hoje, p.ciclo);
    const campos = pago
      ? { ...ativa, ...base }
      : { ...base, status: 'iniciada' };

    // Converte um trial em curso, ou cria uma assinatura nova.
    let a = anterior;
    if (a && !['encerrada', 'cancelada'].includes(a.status)) await a.update(campos);
    else a = await Assinatura.create({ id: novoId(), usuarioId: req.user.sub, ciclo: p.ciclo, ...campos });

    await Cobranca.create({
      id: novoId(), assinaturaId: a.id, usuarioId: req.user.sub, metodo: 'cartao',
      valorCentavos: vigente.valorCentavos,
      status: pago ? 'pago' : 'pendente',
      pagoEm: pago ? new Date() : null,
      efiChargeId: r.charge ? String(r.charge.id) : null,
    });
    return reply.code(201).send({ status: a.status, periodoFim: a.periodoFim, pago });
  });

  /** Paga uma mensalidade por PIX (avulso). Devolve o QR para o app mostrar. */
  app.post('/assinatura/pix', {
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const dados = z.object({ cpf: z.string().min(11).max(14).optional() }).parse(req.body || {});
    const usuario = await Usuario.findByPk(req.user.sub, { attributes: ['id', 'nome', 'email', 'fuso'] });
    const p = efi.plano();
    // PIX de um assinante já existente cobra o valor DELE; novo, o vigente.
    const existente = await atual(req.user.sub);
    const valor = existente && !['encerrada'].includes(existente.status)
      ? existente.valorCentavos : (await precoVigente(app.db)).valorCentavos;

    let cob;
    try {
      cob = await efi.cobrarPix({ valorCentavos: valor, cliente: { nome: usuario.nome, cpf: soDigitos(dados.cpf) } });
    } catch (e) {
      req.log.error({ efi: efi.motivoErro(e) }, 'falha ao gerar PIX na Efí');
      return reply.code(502).send({ erro: 'falha_no_pix', mensagem: efi.motivoErro(e) });
    }

    // Uma assinatura por PIX fica pendente até o webhook confirmar o pagamento.
    let a = existente;
    if (!a || ['encerrada', 'cancelada'].includes(a.status)) {
      a = await Assinatura.create({ id: novoId(), usuarioId: req.user.sub, metodo: 'pix', ciclo: p.ciclo, valorCentavos: valor, status: 'iniciada' });
    }
    await Cobranca.create({
      id: novoId(), assinaturaId: a.id, usuarioId: req.user.sub, metodo: 'pix',
      valorCentavos: valor, status: 'pendente', efiTxid: cob.txid,
    });
    return reply.code(201).send({ txid: cob.txid, qrcode: cob.qrcode, imagemQrcode: cob.imagemQrcode });
  });

  /**
   * Troca a forma de pagamento de cartão para PIX. Cancela a recorrência na Efí
   * (para o auto-débito, senão cobraria duas vezes), MANTÉM o acesso até o fim do
   * período já pago e passa o método para PIX — no próximo ciclo a pessoa gera um
   * PIX. Nada murcha: trocar de método não derruba o acesso atual.
   */
  app.post('/assinatura/trocar-para-pix', async (req, reply) => {
    const a = await atual(req.user.sub);
    if (!a || !['ativa', 'inadimplente'].includes(a.status)) {
      return reply.code(404).send({ erro: 'sem_assinatura_ativa' });
    }
    if (a.efiAssinaturaId && efi.configurada()) {
      try { await efi.cancelar(a.efiAssinaturaId); }
      catch (e) { req.log.error({ erro: typeof e === 'string' ? e : e.message }, 'falha ao cancelar recorrência ao trocar para PIX'); }
    }
    await a.update({ metodo: 'pix', efiAssinaturaId: null });
    return { ok: true, status: a.status, metodo: 'pix', periodoFim: a.periodoFim };
  });

  /** A pessoa cancela a própria assinatura. Acesso até o fim do período pago. */
  app.post('/assinatura/cancelar', async (req, reply) => {
    const a = await atual(req.user.sub);
    if (!a || ['cancelada', 'encerrada'].includes(a.status)) {
      return reply.code(404).send({ erro: 'sem_assinatura_ativa' });
    }
    if (a.efiAssinaturaId && efi.configurada()) {
      try { await efi.cancelar(a.efiAssinaturaId); }
      catch (e) { req.log.error({ erro: typeof e === 'string' ? e : e.message }, 'falha ao cancelar na Efí'); }
    }
    await a.update(dominio.aoCancelar(new Date()));
    return { ok: true, status: a.status, periodoFim: a.periodoFim };
  });
};
