'use strict';

const { z } = require('zod');

// Leitura pública dos textos legais. Sem login: o cadastro mostra os termos e a
// política ANTES de existir sessão. Só devolve o que já foi publicado.

const CHAVES = ['termos', 'privacidade'];

module.exports = async function rotasDocumentos(app) {
  const { DocumentoLegal } = app.db;

  app.get('/documentos/:chave', async (req, reply) => {
    const { chave } = z.object({ chave: z.enum(['termos', 'privacidade']) }).parse(req.params);
    const doc = await DocumentoLegal.findOne({ where: { chave } });
    if (!doc || !doc.publicadoEm) return reply.code(404).send({ erro: 'documento_indisponivel' });
    return {
      chave: doc.chave, titulo: doc.titulo, corpo: doc.corpo,
      versao: doc.versao, atualizadoEm: doc.publicadoEm,
    };
  });
};

module.exports.CHAVES = CHAVES;
