# Changelog do design system

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento explicado em [VERSIONAMENTO.md](./VERSIONAMENTO.md).

## [1.2.1] - 2026-09-03

Primeira versão com testes automatizados. Os testes reprovaram na primeira
execução e as três reprovações eram problemas reais.

### Corrigido
- **`box-sizing` faltando.** O campo de anotação estourava a lateral em 360 px
  com a fonte do sistema em 200%, porque o CSS dependia de um reset global do
  projeto que o consome. Agora o reset é escopado em `.jd-corpo`.
  Detectado por `visual.spec.js`.
- **Chip de estação ativo com 3,76:1.** Texto papel sobre latão preenchimento
  reprovava em AA, e no tema escuro caía para 1,93:1 porque o texto continuava
  claro sobre um latão mais claro. Detectado por `acessibilidade.spec.js`.
- **Estados recuados usando opacidade.** `--fora`, `--arq` e `--bloq` aplicavam
  `opacity` no bloco inteiro, o que derrubava o texto para até 2,02:1. O recuo
  agora vem de fundo transparente e traço tracejado, com a cor do texto legível.
  O nome de um pedido arquivado e o título de uma conquista bloqueada continuam
  sendo informação, não decoração. Detectado por `acessibilidade.spec.js`.
- **`padding-top: 2px` fora da escala** na data da lista de oração, agora `--e1`.
  Detectado por `tokens.spec.js`.

### Adicionado
- `--on-accent-soft`, para texto sobre o acento claro. O `--accent` dava 4,22:1
  sobre `--accent-soft`, abaixo de AA.
- `--on-accent-fill`, tinta escura para texto sobre o latão preenchido.
- Suíte de testes: 74 casos, cobrindo contraste, deriva de token, regressão
  visual e acessibilidade.
- `CHROMIUM_PATH` na configuração do Playwright, para usar um navegador já
  instalado em vez de baixar outro.

### Migração
Nenhuma ação necessária se você usa as classes do sistema. Se copiou o CSS do
chip ativo ou dos estados recuados para algum lugar, atualize de lá.

---

## [1.2.0] - 2026-09-03

### Adicionado
- Três tamanhos de botão (`--sm` 36 px, padrão 44 px, `--lg` 52 px) e as
  variantes bloco e ícone, com o alvo de toque documentado. O tamanho pequeno
  não cumpre 44 px sozinho e precisa de área clicável extra.
- Componente de lista de oração, com os estados pedindo, respondida e arquivada,
  mais o bloco de testemunho.
- Breakpoints documentados: 360 base, 480, 768 e 1024, sempre `min-width`.
  A navegação vira trilho lateral a partir de 768 px.
- Tokens `--btn-sm`, `--btn-md`, `--btn-lg`, `--toque-min`, `--bp-*`,
  `--largura-leitura`, `--largura-app`, `--largura-max`.

---

## [1.1.0] - 2026-09-03

### Corrigido
- **Contraste do latão e do cinza secundário.** `--accent` passou de `#A8761F`
  para `#8E641A` (3,45:1 para 4,59:1) e `--ink-3` de `#6C7A6D` para `#626F63`
  (3,92:1 para 4,59:1). Os dois reprovavam em AA no tema claro, e o `--ink-3`
  carrega o texto secundário de quase toda tela.
- **Cor do texto do botão resolvida por media query duplicada.** Virou o token
  `--on-brand`, definido uma vez por tema.

### Adicionado
- `--on-brand`, `--brand-forte`, `--foco`, `--overlay`, `--off-bg`, `--off-ink`.
- Escala de elevação com três níveis, no lugar de uma sombra única.
- Escala tipográfica como token, com peso e entrelinha.
- `prefers-reduced-motion` desligando toda transição.
- Matriz completa de estados dos cinco componentes originais, incluindo o
  estado "já regada" do cartão de prática.
- Seis componentes: campo de anotação, folha de registro, navegação, estado
  vazio, aviso e calendário de constância.

### Mudado
- `--accent-fill` guarda o latão original `#A8761F` para preenchimento e ícone.
  A regra passa a ser: se a cor virou palavra, use a versão de texto.

---

## [1.0.0] - 2026-09-03

Primeira versão. Símbolo, assinaturas, paleta de sete cores, três famílias
tipográficas, texturas, iconografia, tom de voz e cinco componentes.
