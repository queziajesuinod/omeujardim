# Versionamento e manutenção do design system

O manual da marca e o código vivem no mesmo repositório, na mesma pasta, e sobem
na mesma pull request. Manual que mora em outro lugar vira ficção em três meses.

```
design-system/
  tokens.css          fonte única de cor, tipo, espaço, forma e tempo
  componentes.css     os componentes, escritos só com tokens
  galeria.html        todos os componentes numa página, é o corpo de prova
  manual.html         o manual da marca publicado
  tokens.json         os mesmos tokens em JSON, para Figma e para o app
  CHANGELOG.md        o que mudou, em que versão e por quê
  VERSIONAMENTO.md    este arquivo
  testes/             contraste, deriva de token, visual e acessibilidade
    referencias/      as fotos de referência do teste visual
```

## Como versionar

Semver adaptado a design system. A pergunta que define o número é
**o que quebra na tela de quem já usa**.

| Mudança | Versão | Exemplo |
|---|---|---|
| Remover ou renomear token, mudar o significado de um token, remover variante de componente | **maior** (2.0.0) | `--accent` deixar de existir; o raio-folha virar raio comum |
| Token novo, componente novo, variante nova, ajuste de valor que não quebra layout | **menor** (1.3.0) | tamanhos de botão; lista de oração; escurecer o latão para passar em AA |
| Correção de bug visual, texto do manual, comentário | **correção** (1.2.1) | corrigir `box-sizing` faltando no campo |

Toda mudança de token entra no CHANGELOG com três linhas: o que mudou, por que
mudou, e o que quem consome precisa fazer. Mudança maior sem caminho de migração
escrito não é aprovada.

## Como propor uma mudança

1. Abra a issue com o problema, não com a solução. "O texto secundário some no sol"
   é um começo melhor que "trocar o ink-3 por #555".
2. Rode `npm run teste` antes de abrir a PR. Se o teste de contraste reprovar,
   a proposta ainda não está pronta.
3. Se a mudança altera pixel, a PR precisa trazer as fotos de referência
   atualizadas, geradas no CI, e a explicação de cada diferença.
4. Toda alteração em `tokens.css` exige aprovação de quem cuida da marca.
   Alteração em `componentes.css` exige só revisão técnica.

## O que os testes cobrem

| Arquivo | Cobre | Não cobre |
|---|---|---|
| `contraste.spec.js` | Razão WCAG de todos os pares de token, nos dois temas. Não abre navegador, roda em 2 segundos | Contraste de coisas compostas em tela, como texto sobre imagem |
| `tokens.spec.js` | Deriva: hex, espaçamento e duração literais fora de `tokens.css`. Também garante que os dois blocos de tema escuro definem os mesmos tokens | Uso errado de um token certo |
| `visual.spec.js` | Foto de cada componente nos dois temas, estados de foco e hover, e a galeria inteira em 4 larguras. Inclui o teste de 360 px com fonte a 200% | Se o componente está bonito. Só detecta que mudou |
| `acessibilidade.spec.js` | axe-core em WCAG 2.1 AA, alvo de toque de 44 px, nome acessível de botão de ícone, e estado que não depende só de cor | Cerca de 60% dos problemas reais de acessibilidade |

### O que os testes não pegam, e por isso é manual

Uma vez por release, antes de publicar:

1. **Teclado.** Percorra a galeria só com Tab e Shift+Tab. Toda parada precisa
   ser visível e nenhuma pode ficar presa.
2. **Leitor de tela.** TalkBack no Android ou VoiceOver no iPhone, na tela Hoje
   e na de Oração. Ouça se o estado da prática e do pedido é anunciado.
3. **Fonte grande de verdade.** Aumente a fonte do sistema para o máximo, no
   aparelho, não só no navegador.
4. **Sol.** Abra o app na rua, ao meio-dia. É o teste que reprova mais paleta
   bonita do que qualquer ferramenta.

## Gerar as fotos de referência

Renderização de fonte muda entre sistemas operacionais, então uma referência
gerada no seu computador vai reprovar no CI e vice-versa.

**Gere sempre no CI.** No GitHub, rode o workflow `design-system` com a opção
`atualizar_referencias` marcada. Ele commita as imagens novas na sua branch.

Localmente, para desenvolver, use um Chromium já instalado:

```bash
export CHROMIUM_PATH=/caminho/para/chromium   # opcional
npm run teste                                  # tudo
npm run teste:contraste                        # rápido, sem navegador
npm run relatorio                              # abre o relatório HTML
```

## Regra final

Se um teste está atrapalhando, a resposta certa quase nunca é afrouxar o teste.
As três primeiras vezes em que estes testes reprovaram, eles estavam certos:
o latão não passava em AA, o chip ativo tinha 3,76:1, e os estados recuados
usavam opacidade, que derrubava o texto para 2:1. Nenhum desses três teria sido
visto em revisão manual.
