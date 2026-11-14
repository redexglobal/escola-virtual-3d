# Notas técnicas — escola-3d

Aprendizados de problemas que já apareceram e foram resolvidos. Consultar antes de mexer em IDB,
chat ao vivo ou nos testes.

## IndexedDB

- **Transação multi-store usa ARRAY de nomes** (`db.transaction(['a','b'])`), nunca string com
  vírgula — `DataError: One of the specified object stores was not found`. `dados.js` resolve isso
  com `tx2multi()`; usar `salvaLote` para várias coleções de uma vez.
- **`salvaLote` em vez de vários `salva`**: cada transação leva ~120–330 ms no Chromium headless
  desta máquina. A semente gravava ~70 registros um a um (>15 s); com `salvaLote` a entrada caiu
  para ~3–4 s. Em aparelho real é mais rápido ainda.
- **Nunca cacheie listas do banco em variável de módulo**: `serieCache` era carregado no import,
  antes da semente terminar → ficava vazio para sempre. Buscar na hora do render
  (`await db.lista(...)` dentro do `render` da aba).
- **Banco antigo**: versão sobe com upgrade que cria os stores novos; banco v1 existente migra
  sozinho (testado em `testes/teste-perfis.mjs`, cenário "antigo" com `testes/seed-antigo.html`).
- `IDBObjectStoreNameSet.getAll is not a function` neste Chromium — usar `[...names]`.

## Chat ao vivo (erros já pegos)

- A `div.chat-lista` foi criada mas **nunca anexada** ao `caixaChat` → mensagens renderizavam num
  nó solto e a caixa parecia morta. Sempre conferir se o nó existe no DOM
  (`document.querySelector('.modal-din .chat-lista')`), não só se o banco recebeu.
- Sinal "no ar": flag local é atualizada **antes de qualquer await** no clique do botão, e
  `envia()` confere o banco (`estadoLive()`) antes de descartar uma mensagem — elimina a corrida
  entre "clicar Iniciar" e digitar rápido.

## Telas 2D (telas.js)

- Abas do painel ficam **logo abaixo do título**, acima do corpo (ordem: topo → abas → corpo).
  Quem abre painel novo usa `abrePainel({tabs})` e não recria essa ordem.
- `abrirModal` (módulos) e o `.painel-topo` dentro de modal precisam do h3 com `white-space:nowrap`
  e do botão empurrado com `margin-left:auto` (regras no `style.css`).

## Navegação 3D

- Indicador de posição (canto superior esquerdo, texto simples) NÃO é botão; os botões de ir para
  a sala ficam no menu lateral, e o botão da sala atual ganha a classe `on`. Não duplicar os dois
  com visual idêntico.
- Painel 2D aberto pausa o andar 3D (`window.__escola.pausar(true)` em `abrePainel`/`fechaPainel`).

## Testes Playwright

- Usar sempre `launchPersistentContext('/tmp/esp-<nome>')` com `rmSync` antes — o perfil temporário
  padrão persiste entre execuções na mesma boot e contamina cenários.
- **Chromium órfão causa timeout aleatório**: teste que passou isolado falha em sequência quando
  há processo órfano de execução anterior travando I/O. Limpar antes:
  `pkill -f 'user-data-dir=/tmp/esp-'`.
- `b.close()` dentro de `finally` (timeout no meio deixa o navegador vivo).
- Esperar por **estado**, não por sleep fixo (ex.: `waitForSelector('.feira-card button:has-text("Já matriculado")')`).
- O Chrome real do Vilson está aberto — nunca tocar no profile `Default`. O `IndexedDB/http_localhost_8811*`
  dele é de teste anterior; a versão 2 do banco já trata o upgrade.
- Python 3.9 com playwright antigo pede `chromium_headless_shell-1223`, que não existe no cache;
  existe link simbólico para `chromium_headless_shell-1254` (se sumir, refazer):
  `ln -sfn ~/Library/Caches/ms-playwright/chromium_headless_shell-1254 ~/Library/Caches/ms-playwright/chromium_headless_shell-1223`

## Ferramentas

- A ferramenta de busca do Drael (`search`) às vezes não acha nada num arquivo que existe e tem o
  texto: se der "no matches" sem sentido, confirmar com `grep -n` via shell antes de concluir que
  o código mudou.
