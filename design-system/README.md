# o meu jardim · design system

Tokens, componentes, manual e testes do app de disciplinas espirituais.
Versão **1.2.1**.

O manual da marca mora aqui dentro, junto do CSS que ele descreve, e sobe na
mesma pull request. Se um deles mudar sem o outro, os testes reprovam.

## Começar

```bash
npm ci
npm run teste            # a suíte inteira, 74 casos
npm run teste:contraste  # 2 segundos, sem navegador
npm run tokens           # regera tokens.json a partir do tokens.css
```

Para usar um Chromium já instalado na máquina, em vez de baixar outro:

```bash
export CHROMIUM_PATH=/caminho/para/chromium
```

## Usar no app

```html
<link rel="stylesheet" href="design-system/tokens.css">
<link rel="stylesheet" href="design-system/componentes.css">
<body class="jd-corpo"> … </body>
```

O tema segue a preferência do sistema. Para forçar, use
`document.documentElement.dataset.tema = 'escuro'` ou `'claro'`.

Todo componente usa o prefixo `jd-` e segue BEM: `jd-bloco__elemento--variante`.

| Componente | Classe |
|---|---|
| Botão | `.jd-btn`, com `--sm --lg --bloco --icone --vazado --quieto` |
| Chip de estação | `.jd-chip`, com `--ativo` |
| Cartão de prática | `.jd-pratica`, com `--regada --fora` |
| Campo de anotação | `.jd-campo`, com `--erro` |
| Lista de oração | `.jd-oracoes` e `.jd-ora`, com `--resp --arq` |
| Progresso | `.jd-cresc` e `.jd-barra` |
| Conquista | `.jd-selo`, com `--bloq` |
| Navegação | `.jd-nav` |
| Aviso | `.jd-aviso` |
| Estado vazio | `.jd-vazio` |
| Calendário de constância | `.jd-calend` |
| Folha de registro | `.jd-folha` |

## As regras que os testes protegem

1. **Nenhum valor literal fora de `tokens.css`.** Nem cor, nem espaçamento, nem
   duração.
2. **Todo par de texto passa em AA**, nos dois temas. O broto continua proibido
   como texto, de propósito.
3. **Estado nunca é só cor.** Pedido respondido diz "Respondida em".
4. **Recuo visual não usa `opacity`.** Opacidade derruba o contraste do texto.
   Use fundo transparente e traço tracejado.
5. **Alvo de toque de 44 px**, exceto o botão pequeno, que precisa de área extra.
6. **Nada murcha.** Nenhum componente regride, apaga progresso ou fica vermelho
   por ausência.

## Documentos

- [manual.html](./manual.html) · o manual da marca, para abrir no navegador
- [CHANGELOG.md](./CHANGELOG.md) · o que mudou e por quê
- [VERSIONAMENTO.md](./VERSIONAMENTO.md) · como versionar, propor mudança e
  o que testar na mão antes de cada release
