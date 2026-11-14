# Escola Virtual 3D (demonstração)

Escola navegável em Three.js para a demo do ecossistema educacional: recepção, corredor e 6 salas
(Matemática, Português, Ciências, História, Geografia, Inglês). Cada sala tem quadro, carteiras,
TV com a aula em vídeo, exercícios com correção e o educador virtual.

**No ar:** <https://redexglobal.github.io/escola-virtual-3d/> — repositório: <https://github.com/redexglobal/escola-virtual-3d>

## Como abrir
Precisa de servidor (módulos JS não abrem por `file://`):

    cd ~/projetos/escola-3d && python3 -m http.server 8811
    # abrir http://localhost:8811

Funciona offline: o Three.js está em `vendor/`.

## Controles
- Computador: W A S D / setas para andar, arrastar o mouse para olhar, Shift corre.
- Celular: controle redondo à esquerda para andar, arrastar a tela para olhar.
- Menu lateral e mapa (clique numa sala) levam até a sala sozinhos.

## O que trocar (tudo em `conteudo.js`)
- **Matérias, temas, saudações e exercícios**: lista `SALAS`.
- **Vídeos**: colocar `videos/<id>.mp4` (matematica, portugues, ciencias, historia, geografia, ingles).
  Sem o arquivo, a TV avisa "vídeo ainda não enviado".
- **Tutor de verdade**: `ESCOLA.tutorUrl` com o endereço do roboAlotv.php no servidor. O botão
  "Falar com o educador" abre ele dentro da escola, com `?materia=<id>` no endereço.

## Educador virtual
- Acena **uma vez** quando você entra na sala e depois o braço **fica parado** (pedido da reunião).
- Fala a saudação com a voz do aparelho (pt-BR). Com "reduzir movimento" ligado, não acena.
- Sem `tutorUrl`, o botão "Falar com o educador" abre o chat local (respostas por regras em pt-BR,
  com voz e sabendo em qual sala você está). Com `tutorUrl` configurado, abre o tutor PHP num modal.

## Plataforma (menu "Escola ▾")
Estrutura espelhada do MonitON (`docs/mapa-moniton.md`), todos os dados no navegador:

| Módulo | O que faz |
|---|---|
| Minha área | Boletim, metas, certificado (com impressão), histórico, financeiro e anotações do aluno |
| Secretaria | CRUD de alunos, professores, responsáveis, currículo (área > disciplina > série), turmas e cursos, financeiro geral, QR codes e assistente IA (metodologia + prompts) |
| Ao vivo | Botão liga/desliga transmissão, chat em tempo real (entre abas), áudio de 15 s, "toque" no professor |
| Mensageiro | Conversas com secretaria/educador/família, voz e **ligação de voz** com avaliação de qualidade |
| Feira de reforço | Catálogo de cursos, compra = matrícula + extrato + mensagem ao chat; "Zerar dados" reseta a demo |
| Biblioteca QR | QR codes dos materiais; escanear leva até a sala 3D correspondente |

## Dados (só neste navegador)
- IndexedDB `kairos-escola` (versão 2), camada única em `dados.js` — **toda leitura e escrita passa
  por ela**, então trocar para o banco PHP depois não muda as telas nem o 3D.
- Semente de demonstração cria 3 alunos, 2 educadores, turmas oficiais e de reforço, contrato com
  parcelas, notas, metas e certificado. Banco antigo (v1, sem a semente) é atualizado sozinho.
- No servidor (PHP) a mesma camada `dados.js` será trocada por chamadas à API — o plano é previsto
  no mapa do MonitON.

## Testes (neste computador)
    node testes/teste-pagina.mjs   # tour completo: minha área, secretaria, ao vivo, feira, educador
    node testes/teste-perfis.mjs   # entrada com banco novo e com banco antigo (upgrade v1 → v2)
    node testes/teste-mobile.mjs   # iPhone simulado: entrada, secretaria, QR

Capturas das telas em `docs/capturas/`. Aprender do que já deu problema antes: `docs/notas-tecnicas.md`.

## iPhone
- Botões redondos com `appearance:none` + raio explícito (evita o quadrado do Safari).
- Vídeo com `playsinline`; voz e som liberados pelo toque em "Entrar na escola".
- Não depende de login/sessão: abre direto.
- Falta validar num iPhone real.
