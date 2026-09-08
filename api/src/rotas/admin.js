'use strict';

const { z } = require('zod');
const { novoId } = require('../lib/id');
const { aoCancelar } = require('../lib/assinatura');
const { precoVigente, contarEmPrecoAntigo } = require('../lib/preco');
const efi = require('../lib/efi');

// Painel de gestão. Tudo aqui é AGREGADO: contagens, nunca conteúdo de ninguém.
// Diário e oração seguem cifrados e privados; o painel só conta, não lê. Ver o
// alerta de LGPD no CLAUDE.md.

module.exports = async function rotasAdmin(app) {
  const { sequelize } = app.db;
  const SELECT = sequelize.QueryTypes.SELECT;

  app.addHook('preHandler', app.exigirLoginQualquer);
  // Métricas gerais são só do admin. Trilheiro e intercessor têm os seus.
  app.addHook('preHandler', app.exigirPapel());

  /**
   * Métricas do período: regas, orações, respondidas, usuários ativos, novas
   * contas. Filtro por mês, últimos 3 meses ou ano. Devolve também a série
   * diária de regas, para o gráfico.
   */
  app.get('/admin/metricas', async (req) => {
    const { periodo } = z.object({
      periodo: z.enum(['mes', '3meses', 'ano']).default('mes'),
    }).parse(req.query);
    const dias = periodo === 'ano' ? 365 : periodo === '3meses' ? 90 : 30;

    const um = (sql) => sequelize.query(sql, { replacements: { dias }, type: SELECT }).then((r) => r[0]?.n ?? 0);

    const [regas, usuariosAtivos, pedidos, respondidas, novasContas, anotacoes, totalContas, serieRegas] = await Promise.all([
      um("SELECT COUNT(*)::int AS n FROM registro WHERE removido_em IS NULL AND data_ref > CURRENT_DATE - :dias::int"),
      um("SELECT COUNT(DISTINCT usuario_id)::int AS n FROM registro WHERE removido_em IS NULL AND data_ref > CURRENT_DATE - :dias::int"),
      um("SELECT COUNT(*)::int AS n FROM pedido_oracao WHERE removido_em IS NULL AND criado_em > now() - (:dias || ' days')::interval"),
      um("SELECT COUNT(*)::int AS n FROM pedido_oracao WHERE removido_em IS NULL AND status = 'respondido' AND respondido_em > CURRENT_DATE - :dias::int"),
      um("SELECT COUNT(*)::int AS n FROM usuario WHERE removido_em IS NULL AND criado_em > now() - (:dias || ' days')::interval"),
      um("SELECT COUNT(*)::int AS n FROM anotacao WHERE removido_em IS NULL AND criado_em > now() - (:dias || ' days')::interval"),
      um("SELECT COUNT(*)::int AS n FROM usuario WHERE removido_em IS NULL"),
      sequelize.query(
        "SELECT to_char(data_ref, 'YYYY-MM-DD') AS dia, COUNT(*)::int AS n FROM registro WHERE removido_em IS NULL AND data_ref > CURRENT_DATE - :dias::int GROUP BY data_ref ORDER BY data_ref",
        { replacements: { dias }, type: SELECT }
      ),
    ]);

    return { periodo, dias, regas, usuariosAtivos, pedidos, respondidas, novasContas, anotacoes, totalContas, serieRegas };
  });

  /**
   * Contas: a série de usuários ativos por dia e a retenção simples. Ativo = quem
   * regou. Retenção = das contas com mais de N dias, quantas voltaram nos últimos
   * N dias. Só contagem — nunca diário nem oração de ninguém.
   */
  app.get('/admin/contas', async (req) => {
    const { periodo } = z.object({
      periodo: z.enum(['mes', '3meses', 'ano']).default('mes'),
    }).parse(req.query);
    const dias = periodo === 'ano' ? 365 : periodo === '3meses' ? 90 : 30;

    const [serieAtivos, retencao] = await Promise.all([
      sequelize.query(
        "SELECT to_char(data_ref, 'YYYY-MM-DD') AS dia, COUNT(DISTINCT usuario_id)::int AS n FROM registro WHERE removido_em IS NULL AND data_ref > CURRENT_DATE - :dias::int GROUP BY data_ref ORDER BY data_ref",
        { replacements: { dias }, type: SELECT }
      ),
      sequelize.query(
        `WITH a7 AS (SELECT DISTINCT usuario_id FROM registro WHERE removido_em IS NULL AND data_ref > CURRENT_DATE - 7),
              a30 AS (SELECT DISTINCT usuario_id FROM registro WHERE removido_em IS NULL AND data_ref > CURRENT_DATE - 30)
         SELECT
           COUNT(*) FILTER (WHERE criado_em < now() - interval '7 days')::int AS antigas7,
           COUNT(*) FILTER (WHERE criado_em < now() - interval '7 days' AND id IN (SELECT usuario_id FROM a7))::int AS retornaram7,
           COUNT(*) FILTER (WHERE criado_em < now() - interval '30 days')::int AS antigas30,
           COUNT(*) FILTER (WHERE criado_em < now() - interval '30 days' AND id IN (SELECT usuario_id FROM a30))::int AS retornaram30
         FROM usuario WHERE removido_em IS NULL`,
        { type: SELECT }
      ).then((r) => r[0]),
    ]);

    const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
    return {
      periodo,
      serieAtivos,
      retencao: {
        ...retencao,
        pct7: pct(retencao.retornaram7, retencao.antigas7),
        pct30: pct(retencao.retornaram30, retencao.antigas30),
      },
    };
  });

  /**
   * Lista paginada de contas, com busca por e-mail ou nome. Traz identidade da
   * conta (que o admin precisa para operar) e atividade — nunca conteúdo.
   */
  app.get('/admin/usuarios', async (req) => {
    const { pagina, limite, busca } = z.object({
      pagina: z.coerce.number().int().min(1).default(1),
      limite: z.coerce.number().int().min(1).max(100).default(20),
      busca: z.string().trim().max(120).default(''),
    }).parse(req.query);
    const offset = (pagina - 1) * limite;
    const like = `%${busca}%`;

    const [itens, contagem] = await Promise.all([
      sequelize.query(
        `SELECT u.id, u.nome, u.email, u.papeis, to_char(u.criado_em, 'YYYY-MM-DD') AS criado_em,
                (u.desativado_em IS NOT NULL) AS desativado,
                (SELECT a.status FROM assinatura a WHERE a.usuario_id = u.id AND a.removido_em IS NULL ORDER BY a.criado_em DESC LIMIT 1) AS assinatura_status,
                (SELECT to_char(max(data_ref), 'YYYY-MM-DD') FROM registro r WHERE r.usuario_id = u.id AND r.removido_em IS NULL) AS ultima_rega,
                (SELECT COUNT(*)::int FROM registro r WHERE r.usuario_id = u.id AND r.removido_em IS NULL) AS total_regas
           FROM usuario u
          WHERE u.removido_em IS NULL AND (:busca = '' OR u.email ILIKE :like OR u.nome ILIKE :like)
          ORDER BY u.criado_em DESC
          LIMIT :limite OFFSET :offset`,
        { replacements: { busca, like, limite, offset }, type: SELECT }
      ),
      sequelize.query(
        "SELECT COUNT(*)::int AS n FROM usuario u WHERE u.removido_em IS NULL AND (:busca = '' OR u.email ILIKE :like OR u.nome ILIKE :like)",
        { replacements: { busca, like }, type: SELECT }
      ).then((r) => r[0].n),
    ]);

    return { pagina, limite, total: contagem, itens };
  });

  // --- Ações sobre contas: desativar, reativar, excluir -----------------------
  //
  // Desativar guarda a data e derruba as sessões: a conta e os dados ficam, mas
  // não entra. Reativar limpa a data. Excluir é soft delete (removido_em) — a
  // conta some do app e o expurgo real acontece em 30 dias (ver lib/expurgo.js).
  // Ninguém opera na própria conta por aqui, para o admin não se trancar fora.

  const { Usuario } = app.db;

  async function aplicarAcao(id, acao, atorId) {
    if (id === atorId) return { id, estado: 'ignorado_proprio' };
    const usuario = await Usuario.findByPk(id);
    if (!usuario) return { id, estado: 'nao_encontrado' };

    if (acao === 'excluir') {
      await usuario.destroy();               // soft delete: removido_em = agora
      await app.encerrarSessoes(id);
      return { id, estado: 'excluido' };
    }
    if (acao === 'desativar') {
      if (!usuario.desativadoEm) await usuario.update({ desativadoEm: new Date() });
      await app.encerrarSessoes(id);
      return { id, estado: 'desativado' };
    }
    // reativar
    if (usuario.desativadoEm) await usuario.update({ desativadoEm: null });
    return { id, estado: 'reativado' };
  }

  /** Uma conta: desativar, reativar ou excluir. 404 se não existe. */
  app.post('/admin/usuarios/:id/acao', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { acao } = z.object({ acao: z.enum(['desativar', 'reativar', 'excluir']) }).parse(req.body);
    if (id === req.user.sub) {
      return reply.code(422).send({ erro: 'conta_propria', mensagem: 'Você não pode fazer isso com a própria conta.' });
    }
    const r = await aplicarAcao(id, acao, req.user.sub);
    if (r.estado === 'nao_encontrado') return reply.code(404).send({ erro: 'conta_nao_encontrada' });
    return r;
  });

  /** Em massa: a mesma ação para uma lista de contas. A própria é ignorada. */
  app.post('/admin/usuarios/acoes', async (req) => {
    const { ids, acao } = z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      acao: z.enum(['desativar', 'reativar', 'excluir']),
    }).parse(req.body);

    const unicos = [...new Set(ids)];
    const resultados = [];
    for (const id of unicos) resultados.push(await aplicarAcao(id, acao, req.user.sub));

    const conta = (e) => resultados.filter((r) => r.estado === e).length;
    return {
      acao,
      afetadas: conta('excluido') + conta('desativado') + conta('reativado'),
      ignoradas: conta('ignorado_proprio'),
      naoEncontradas: conta('nao_encontrado'),
      resultados,
    };
  });

  /**
   * Cancelar a assinatura de uma conta. Para as cobranças agora (na Efí também)
   * e mantém o acesso até o fim do período já pago; a rotina diária encerra
   * quando o período vence. Não seta desativado_em: ao logar depois, a pessoa é
   * levada a assinar de novo, não barrada. Ver PLANO-ASSINATURAS.md.
   */
  app.post('/admin/usuarios/:id/assinatura/cancelar', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const a = await app.db.Assinatura.findOne({
      where: { usuarioId: id },
      order: [['criado_em', 'DESC']],
    });
    if (!a || ['cancelada', 'encerrada'].includes(a.status)) {
      return reply.code(404).send({ erro: 'sem_assinatura_ativa' });
    }
    // Para as cobranças futuras na Efí. Sem gateway ainda (Fatia A), o
    // cancelamento local acontece assim mesmo; a Efí entra na Fatia B.
    if (a.efiAssinaturaId && efi.configurada()) {
      try { await efi.cancelar(a.efiAssinaturaId); }
      catch (e) { req.log.error({ erro: e.message }, 'falha ao cancelar assinatura na Efí'); }
    }
    await a.update(aoCancelar(new Date()));
    return { ok: true, status: a.status, periodoFim: a.periodoFim };
  });

  // --- Assinaturas: segmentos e histórico de cobrança ------------------------
  //
  // Tudo agregado ou de operação (identidade da conta + cobrança), nunca diário
  // nem oração. `no-store`: dado de gestão não pode ficar velho num cache.
  //
  // "Última assinatura por pessoa" (uma pessoa pode ter histórico de várias):
  // DISTINCT ON pega a mais recente. Os segmentos:
  //  - a renovar: ativa com próxima cobrança nos próximos 7 dias, ou inadimplente.
  //  - cancelaram: cancelada (ainda com acesso) ou encerrada (já sem acesso).
  //  - ativos e engajados: assinatura usável E regou nos últimos 7 dias.

  app.get('/admin/assinaturas/resumo', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const LIM = 100;
    const base = `
      WITH ultima AS (
        SELECT DISTINCT ON (a.usuario_id)
               a.usuario_id, a.status, a.metodo, a.valor_centavos,
               a.periodo_fim, a.proxima_cobranca, a.trial_ate, a.cancelada_em, a.atualizado_em
          FROM assinatura a
         WHERE a.removido_em IS NULL
         ORDER BY a.usuario_id, a.criado_em DESC
      ),
      engaj AS (
        SELECT DISTINCT usuario_id FROM registro
         WHERE removido_em IS NULL AND data_ref > CURRENT_DATE - 7
      )`;
    const q = (sel) => sequelize.query(base + sel, { type: SELECT });

    const [contadores, aRenovar, cancelaram, ativosEngajados] = await Promise.all([
      q(`SELECT
           COUNT(*) FILTER (WHERE status = 'ativa' OR (status = 'trial' AND trial_ate >= CURRENT_DATE))::int AS usaveis,
           COUNT(*) FILTER (WHERE status = 'ativa')::int AS ativas,
           COUNT(*) FILTER (WHERE status = 'trial')::int AS trials,
           COUNT(*) FILTER (WHERE status = 'inadimplente')::int AS inadimplentes,
           COUNT(*) FILTER (WHERE status = 'cancelada')::int AS canceladas,
           COUNT(*) FILTER (WHERE status = 'encerrada')::int AS encerradas,
           COUNT(*) FILTER (WHERE (status = 'ativa' OR (status = 'trial' AND trial_ate >= CURRENT_DATE))
                             AND usuario_id IN (SELECT usuario_id FROM engaj))::int AS engajados
         FROM ultima`).then((r) => r[0]),
      q(`SELECT u.usuario_id AS id, us.nome, us.email, u.status,
                u.valor_centavos AS "valorCentavos",
                to_char(u.periodo_fim, 'YYYY-MM-DD') AS "periodoFim",
                to_char(u.proxima_cobranca, 'YYYY-MM-DD') AS "proximaCobranca"
           FROM ultima u JOIN usuario us ON us.id = u.usuario_id
          WHERE (u.status = 'ativa' AND u.periodo_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)
             OR u.status = 'inadimplente'
          ORDER BY u.status = 'inadimplente' DESC, u.periodo_fim NULLS FIRST
          LIMIT ${LIM}`),
      q(`SELECT u.usuario_id AS id, us.nome, us.email, u.status,
                to_char(u.periodo_fim, 'YYYY-MM-DD') AS "periodoFim",
                to_char(u.cancelada_em, 'YYYY-MM-DD') AS "canceladaEm"
           FROM ultima u JOIN usuario us ON us.id = u.usuario_id
          WHERE u.status IN ('cancelada', 'encerrada')
          ORDER BY u.atualizado_em DESC
          LIMIT ${LIM}`),
      q(`SELECT u.usuario_id AS id, us.nome, us.email, u.status,
                u.valor_centavos AS "valorCentavos",
                (SELECT to_char(max(r.data_ref), 'YYYY-MM-DD') FROM registro r
                  WHERE r.usuario_id = u.usuario_id AND r.removido_em IS NULL) AS "ultimaRega"
           FROM ultima u JOIN usuario us ON us.id = u.usuario_id
          WHERE (u.status = 'ativa' OR (u.status = 'trial' AND u.trial_ate >= CURRENT_DATE))
            AND u.usuario_id IN (SELECT usuario_id FROM engaj)
          ORDER BY us.nome
          LIMIT ${LIM}`),
    ]);

    return { contadores, aRenovar, cancelaram, ativosEngajados };
  });

  /** Histórico de cobrança de uma conta, para o admin acompanhar pagamentos. */
  app.get('/admin/usuarios/:id/cobrancas', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const usuario = await Usuario.findByPk(id, { attributes: ['id', 'nome', 'email'] });
    if (!usuario) return reply.code(404).send({ erro: 'conta_nao_encontrada' });

    const [assinatura] = await sequelize.query(
      `SELECT status, metodo, valor_centavos AS "valorCentavos",
              to_char(periodo_fim, 'YYYY-MM-DD') AS "periodoFim",
              to_char(proxima_cobranca, 'YYYY-MM-DD') AS "proximaCobranca",
              to_char(trial_ate, 'YYYY-MM-DD') AS "trialAte"
         FROM assinatura WHERE usuario_id = :id AND removido_em IS NULL
        ORDER BY criado_em DESC LIMIT 1`,
      { replacements: { id }, type: SELECT }
    );
    const cobrancas = await sequelize.query(
      `SELECT id, metodo, status, valor_centavos AS "valorCentavos",
              to_char(vencimento, 'YYYY-MM-DD') AS vencimento,
              pago_em AS "pagoEm", criado_em AS "criadoEm"
         FROM cobranca WHERE usuario_id = :id AND removido_em IS NULL
        ORDER BY criado_em DESC`,
      { replacements: { id }, type: SELECT }
    );

    return { usuario: usuario.toJSON(), assinatura: assinatura || null, cobrancas };
  });

  // --- Preço do plano: versionado, com grandfathering ------------------------
  //
  // O preço vigente vale só para quem assinar dali para frente. Quem já assinou
  // segue no valor congelado na assinatura. Migrar um cliente antigo é MARCAR a
  // troca; a cobrança nova só vale após o novo aceite dele no app (aviso + novo
  // consentimento, como manda o CDC para aumento em contrato contínuo).

  /** Preço vigente + quantos assinantes estão num valor diferente dele. */
  app.get('/admin/plano/preco', async () => {
    const vigente = await precoVigente(app.db);
    return { ...vigente, emPrecoAntigo: await contarEmPrecoAntigo(app.db, vigente.valorCentavos) };
  });

  /** Define um novo preço vigente. Afeta só novos assinantes. */
  app.put('/admin/plano/preco', async (req) => {
    const { valorCentavos, rotulo } = z.object({
      valorCentavos: z.number().int().min(100).max(1000000),
      rotulo: z.string().trim().max(80).optional(),
    }).parse(req.body);
    const hoje = new Date().toISOString().slice(0, 10);
    const novo = await app.db.PlanoPreco.create({ id: novoId(), valorCentavos, rotulo: rotulo || null, vigenteDesde: hoje });
    return { id: novo.id, valorCentavos: novo.valorCentavos, rotulo: novo.rotulo, vigenteDesde: novo.vigenteDesde };
  });

  /**
   * Migra clientes do preço antigo para o vigente: MARCA a troca (preço novo +
   * data do aviso). O app mostra e pede o novo aceite; sem aceite, o cliente
   * segue no valor antigo. Aceita ids específicos ou todos os que estão no
   * preço antigo.
   */
  app.post('/admin/assinaturas/migrar-preco', async (req) => {
    const { ids, todosAntigos } = z.object({
      ids: z.array(z.string().uuid()).max(5000).optional(),
      todosAntigos: z.boolean().optional(),
    }).parse(req.body || {});
    const vigente = await precoVigente(app.db);
    const hoje = new Date().toISOString().slice(0, 10);
    const Op = app.db.Sequelize.Op;

    const onde = {
      status: ['trial', 'ativa', 'inadimplente'],
      valorCentavos: { [Op.ne]: vigente.valorCentavos },
    };
    if (ids && ids.length) onde.id = { [Op.in]: ids };
    else if (!todosAntigos) return { marcadas: 0, motivo: 'informe ids ou todosAntigos' };

    const [marcadas] = await app.db.Assinatura.update(
      { precoNovoCentavos: vigente.valorCentavos, trocaPrecoEm: hoje },
      { where: onde }
    );
    return { marcadas, precoNovoCentavos: vigente.valorCentavos };
  });

  // --- Textos legais: termos de uso e política de privacidade ----------------
  // Editáveis pela autora, guardados no banco. O app lê o vigente (publicado).

  /** Os dois documentos, para o editor do painel (mesmo os não publicados). */
  app.get('/admin/documentos', async () => {
    const docs = await app.db.DocumentoLegal.findAll({ order: [['chave', 'ASC']] });
    const por = (chave) => docs.find((d) => d.chave === chave) || null;
    const seco = (d) => d && { titulo: d.titulo, corpo: d.corpo, versao: d.versao, publicadoEm: d.publicadoEm };
    return { termos: seco(por('termos')), privacidade: seco(por('privacidade')) };
  });

  /** Cria ou atualiza um documento e o publica. */
  app.put('/admin/documentos/:chave', async (req) => {
    const { chave } = z.object({ chave: z.enum(['termos', 'privacidade']) }).parse(req.params);
    const { titulo, corpo, versao } = z.object({
      titulo: z.string().trim().min(2).max(160),
      corpo: z.string().trim().min(1).max(60000),
      versao: z.string().trim().max(20).optional(),
    }).parse(req.body);

    const existente = await app.db.DocumentoLegal.findOne({ where: { chave } });
    const dados = { titulo, corpo, versao: versao || null, publicadoEm: new Date() };
    if (existente) { await existente.update(dados); return { ok: true, chave }; }
    await app.db.DocumentoLegal.create({ id: novoId(), chave, ...dados });
    return { ok: true, chave };
  });

  // --- Práticas: o catálogo de disciplinas (o que o app chama de "práticas") --
  // A autora cria, ajusta e inativa. Inativar tira do catálogo de novas práticas
  // sem remover de quem já usa nem apagar o histórico (invariante "nada murcha").

  // Código/ícone são nomes semânticos, não emoji: minúsculas, sem espaço.
  const slug = z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{1,39}$/, 'Use minúsculas, sem espaço (ex.: adoracao).');

  /** O catálogo inteiro, com quantas pessoas usam cada uma (para pesar o impacto). */
  app.get('/admin/disciplinas', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return sequelize.query(
      `SELECT d.id, d.codigo, d.nome, d.icone, d.ordem, d.ativo,
              (SELECT count(*)::int FROM pratica p
                 WHERE p.disciplina_id = d.id AND p.ativa = true AND p.removido_em IS NULL) AS "emUso"
         FROM disciplina d
        WHERE d.removido_em IS NULL
        ORDER BY d.ordem ASC, d.nome ASC`,
      { type: SELECT }
    );
  });

  /** Cria uma prática nova. Ordem em branco vai para o fim da lista. */
  app.post('/admin/disciplinas', async (req, reply) => {
    const { codigo, nome, icone, ordem } = z.object({
      codigo: slug,
      nome: z.string().trim().min(2).max(80),
      icone: slug,
      ordem: z.number().int().min(0).max(9999).optional(),
    }).parse(req.body);

    const ordemFinal = ordem ?? (((await app.db.Disciplina.max('ordem')) || 0) + 1);
    try {
      const nova = await app.db.Disciplina.create({ id: novoId(), codigo, nome, icone, ordem: ordemFinal });
      return reply.code(201).send({ id: nova.id, codigo: nova.codigo, nome: nova.nome, icone: nova.icone, ordem: nova.ordem, ativo: nova.ativo });
    } catch (e) {
      if (e?.name === 'SequelizeUniqueConstraintError') {
        return reply.code(409).send({ erro: 'codigo_em_uso', mensagem: 'Já existe uma prática com esse código.' });
      }
      throw e;
    }
  });

  /** Ajusta nome, ícone, ordem ou o estado ativo. O código não muda (é a chave estável). */
  app.put('/admin/disciplinas/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const dados = z.object({
      nome: z.string().trim().min(2).max(80).optional(),
      icone: slug.optional(),
      ordem: z.number().int().min(0).max(9999).optional(),
      ativo: z.boolean().optional(),
    }).parse(req.body);

    const disc = await app.db.Disciplina.findByPk(id);
    if (!disc) return reply.code(404).send({ erro: 'disciplina_nao_encontrada' });

    await disc.update(dados);
    return { id: disc.id, codigo: disc.codigo, nome: disc.nome, icone: disc.icone, ordem: disc.ordem, ativo: disc.ativo };
  });
};
