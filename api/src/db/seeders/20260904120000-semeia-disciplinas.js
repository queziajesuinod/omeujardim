'use strict';

// As oito disciplinas do catálogo. É conteúdo fixo do produto, não dado de
// ninguém, então mora aqui e não numa tela de administração.
//
// `icone` guarda um nome semântico, não um emoji nem um caractere: a marca
// não usa emoji, e o app decide o glifo a partir deste código. Trocar o
// desenho do ícone é trabalho de front, sem migração.
//
// Idempotente: `ignoreDuplicates` vira ON CONFLICT DO NOTHING sobre o índice
// único de `codigo`. Rodar duas vezes não duplica e não quebra.

const { novoId } = require('../../lib/id');

const DISCIPLINAS = [
  { codigo: 'oracao', nome: 'Oração', icone: 'oracao', ordem: 1 },
  { codigo: 'leitura', nome: 'Leitura da Palavra', icone: 'leitura', ordem: 2 },
  { codigo: 'meditacao', nome: 'Meditação', icone: 'meditacao', ordem: 3 },
  { codigo: 'jejum', nome: 'Jejum', icone: 'jejum', ordem: 4 },
  { codigo: 'memorizacao', nome: 'Memorização', icone: 'memorizacao', ordem: 5 },
  { codigo: 'gratidao', nome: 'Gratidão', icone: 'gratidao', ordem: 6 },
  { codigo: 'servico', nome: 'Serviço', icone: 'servico', ordem: 7 },
  { codigo: 'generosidade', nome: 'Generosidade', icone: 'generosidade', ordem: 8 },
];

module.exports = {
  async up(queryInterface) {
    const agora = new Date();
    await queryInterface.bulkInsert(
      'disciplina',
      DISCIPLINAS.map((d) => ({ id: novoId(), ...d, criado_em: agora, atualizado_em: agora })),
      { ignoreDuplicates: true },
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('disciplina', {
      codigo: DISCIPLINAS.map((d) => d.codigo),
    });
  },
};
