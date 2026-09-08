// ---------------------------------------------------------------------------
// Limitador de concorrência para trabalho caro de CPU.
//
// Por que isso existe, com números:
//
// O Argon2id está configurado com 19 MiB de memória e leva perto de 250 ms
// por hash. Isso é proposital, é o que segura ataque de GPU. O efeito colateral
// é que login é a rota mais cara do sistema inteiro.
//
// Numa máquina de 2 vCPU você faz cerca de 8 hashes por segundo. Se 200 pessoas
// abrirem o app às 6h e precisarem entrar, sem limite o Node aceita as 200 de
// uma vez: 200 x 19 MiB = 3,8 GB de memória e a CPU em 100%. O processo é morto
// por falta de memória, e aí NINGUÉM entra, nem quem já estava logado.
//
// Com o limitador, quatro hashes rodam por vez e o resto espera na fila. Quem
// espera demais recebe 503 com Retry-After, que é uma resposta honesta e que o
// app sabe tratar, em vez de o servidor cair.
// ---------------------------------------------------------------------------

class Limitador {
  constructor({ simultaneos = 4, esperaMaximaMs = 3000, filaMaxima = 100 } = {}) {
    this.simultaneos = simultaneos;
    this.esperaMaximaMs = esperaMaximaMs;
    this.filaMaxima = filaMaxima;
    this.rodando = 0;
    this.fila = [];
  }

  async executar(tarefa) {
    await this._vaga();
    try {
      return await tarefa();
    } finally {
      this.rodando--;
      const proximo = this.fila.shift();
      if (proximo) proximo.liberar();
    }
  }

  /**
   * ARMADILHA que custou uma medição para aparecer: a versão ingênua fazia
   * `await this._vaga()` e só DEPOIS incrementava o contador. Como await cede
   * o controle mesmo com promessa já resolvida, as 20 chamadas passavam pela
   * verificação antes de qualquer incremento acontecer, e o limitador deixava
   * as 20 rodarem juntas. Medido: pico de 20 com limite configurado em 4.
   *
   * O contador precisa subir no MESMO passo síncrono da verificação.
   */
  _vaga() {
    if (this.rodando < this.simultaneos) {
      this.rodando++;
      return Promise.resolve();
    }

    if (this.fila.length >= this.filaMaxima) {
      const e = new Error('Servidor ocupado. Tente de novo em alguns segundos.');
      e.statusCode = 503;
      e.code = 'ocupado';
      e.retryAfter = 5;
      throw e;
    }

    return new Promise((resolve, reject) => {
      const item = {
        liberar: () => {
          clearTimeout(item.temporizador);
          this.rodando++; // mesma regra: sobe antes de liberar quem esperava
          resolve();
        },
      };
      item.temporizador = setTimeout(() => {
        const i = this.fila.indexOf(item);
        if (i >= 0) this.fila.splice(i, 1);
        const e = new Error('Servidor ocupado. Tente de novo em alguns segundos.');
        e.statusCode = 503;
        e.code = 'ocupado';
        e.retryAfter = 5;
        reject(e);
      }, this.esperaMaximaMs);
      this.fila.push(item);
    });
  }

  get metricas() {
    return { rodando: this.rodando, naFila: this.fila.length };
  }
}

// Um limitador só para toda operação de senha do processo.
const limitadorSenha = new Limitador({ simultaneos: 4, esperaMaximaMs: 3000, filaMaxima: 100 });

module.exports = { Limitador, limitadorSenha };
