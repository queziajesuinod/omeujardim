'use strict';

// Acesso curto em JWT, refresh longo e rotativo guardado no banco como hash.
//
// Por que refresh rotativo com família: se alguém rouba um refresh token e usa,
// o token legítimo do dono também tenta usar depois. Quando o servidor vê um
// refresh já consumido, ele derruba a FAMÍLIA inteira e obriga os dois a
// entrar de novo. É a forma mais simples de detectar roubo de token sem
// hardware especial.

const fp = require('fastify-plugin');
const crypto = require('node:crypto');
const { novoId } = require('../lib/id');

const hashRefresh = (token) => crypto.createHash('sha256').update(token).digest('base64');

module.exports = fp(async function autenticacao(app, opcoes) {
  const { Sessao } = opcoes.db;

  await app.register(require('@fastify/jwt'), {
    secret: process.env.JWT_SEGREDO,
    sign: { expiresIn: process.env.JWT_EXPIRA || '15m', algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] }, // trava o algoritmo, evita ataque de "alg: none"
  });

  /** Use como preHandler nas rotas privadas. */
  app.decorate('exigirLogin', async function (req, reply) {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ erro: 'nao_autenticado', mensagem: 'Faça login novamente.' });
    }
  });

  /** Emite o par de tokens e registra a sessão. */
  app.decorate('emitirTokens', async function (usuario, dispositivo, familia = novoId()) {
    const acesso = app.jwt.sign({ sub: usuario.id, nome: usuario.nome });
    const refresh = crypto.randomBytes(48).toString('base64url');
    const dias = Number(process.env.REFRESH_EXPIRA_DIAS || 30);

    await Sessao.create({
      id: novoId(),
      usuarioId: usuario.id,
      refreshHash: hashRefresh(refresh),
      familia,
      dispositivo: String(dispositivo || '').slice(0, 200),
      expiraEm: new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
    });

    return { acesso, refresh };
  });

  /** Troca o refresh por um par novo, detectando reuso. */
  app.decorate('rotacionarTokens', async function (refreshRecebido, dispositivo) {
    const sessao = await Sessao.findOne({ where: { refreshHash: hashRefresh(refreshRecebido) } });

    if (!sessao) {
      const e = new Error('Sessão inválida. Entre de novo.');
      e.statusCode = 401; e.code = 'refresh_invalido';
      throw e;
    }

    // Token já usado ou revogado: alguém está reusando. Derruba a família toda.
    if (sessao.revogadaEm || sessao.expiraEm < new Date()) {
      await Sessao.update({ revogadaEm: new Date() }, { where: { familia: sessao.familia } });
      const e = new Error('Sua sessão foi encerrada por segurança. Entre de novo.');
      e.statusCode = 401; e.code = 'refresh_reutilizado';
      throw e;
    }

    await sessao.update({ revogadaEm: new Date() });
    const usuario = await opcoes.db.Usuario.findByPk(sessao.usuarioId);
    return app.emitirTokens(usuario, dispositivo, sessao.familia);
  });

  /** Sai de todos os aparelhos. */
  app.decorate('encerrarSessoes', async function (usuarioId) {
    await Sessao.update({ revogadaEm: new Date() }, { where: { usuarioId, revogadaEm: null } });
  });
});
