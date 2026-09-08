// Senha com Argon2id, que é o algoritmo recomendado pela OWASP hoje.
// bcrypt ainda serve, mas trunca em 72 bytes e não resiste tão bem a GPU.
const argon2 = require('argon2');
const { limitadorSenha } = require('./limitador');

// Parâmetros da OWASP Password Storage Cheat Sheet para Argon2id.
// Se o seu servidor for pequeno, meça: o alvo é algo entre 250ms e 500ms
// por hash. Mais lento que isso derruba o login, mais rápido facilita ataque.
const OPCOES = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

// Toda operação de senha passa pelo limitador. Sem isso, um pico de logins
// às 6h da manhã derruba o processo por falta de memória. Ver lib/limitador.js.
async function gerarHash(senhaPura) {
  return limitadorSenha.executar(() => argon2.hash(senhaPura, OPCOES));
}

/**
 * Confere a senha e diz se o hash precisa ser regravado com parâmetros novos.
 * Rehash acontece quando você aumenta o custo depois de trocar de servidor.
 */
async function conferir(hashGuardado, senhaPura) {
  const ok = await limitadorSenha.executar(() =>
    argon2.verify(hashGuardado, senhaPura).catch(() => false)
  );
  const precisaRehash = ok && argon2.needsRehash(hashGuardado, OPCOES);
  return { ok, precisaRehash };
}

/**
 * Regras mínimas de senha. Comprimento vale mais que zoológico de símbolos:
 * é o que o NIST recomenda desde 2017 e o que as pessoas conseguem lembrar.
 */
function validarForca(senha) {
  const erros = [];
  if (typeof senha !== 'string' || senha.length < 10) {
    erros.push('A senha precisa de pelo menos 10 caracteres.');
  }
  if (senha && senha.length > 128) {
    erros.push('A senha pode ter no máximo 128 caracteres.');
  }
  const comuns = ['12345678910', 'senha12345', 'jesuscristo', 'deusefiel1'];
  if (comuns.includes(String(senha).toLowerCase())) {
    erros.push('Essa senha é muito comum. Escolha outra.');
  }
  return erros;
}

module.exports = { gerarHash, conferir, validarForca, metricasSenha: () => limitadorSenha.metricas };
