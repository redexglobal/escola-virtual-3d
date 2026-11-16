# Escola Virtual 3D (demonstração)

Escola navegável em Three.js para a demo do ecossistema educacional: recepção, corredor e 6 salas
(Matemática, Português, Ciências, História, Geografia, Inglês). Cada sala tem quadro, carteiras,
TV com a aula em vídeo ou post do professor, exercícios com correção e o educador virtual.
Câmera 1ª/3ª pessoa, gamificação (XP, níveis, medalhas, missões), quadro de turmas na recepção
ligado às portas das salas e painéis por persona (aluno, professor, direção, revendedor).

**No ar:** <https://redexglobal.github.io/escola-virtual-3d/> — repositório: <https://github.com/redexglobal/escola-virtual-3d>
- **Apresentação comercial** (deck 16:9): https://redexglobal.github.io/escola-virtual-3d/apresentacao.html
- **Hub de links + QR codes por persona**: https://redexglobal.github.io/escola-virtual-3d/links.html

## Como abrir
Precisa de servidor (módulos JS não abrem por `file://`):

    cd ~/projetos/escola-3d && python3 -m http.server 8811
    # abrir http://localhost:8811

Funciona offline: o Three.js está em `vendor/`.

## Controles
- Computador: W A S D / setas para andar, arrastar o mouse para olhar, Shift corre.
- **C** (ou o botão 🎥) alterna **1ª e 3ª pessoa**: na 3ª você vê o personagem andando.
- Celular: controle redondo à esquerda para andar, arrastar a tela para olhar.
- Menu lateral, mapa e **quadro de turmas** (tocar numa linha da recepção) levam até a sala sozinhos.
- Porta, TV e educador são clicáveis dentro da cena.

## O que trocar (tudo em `conteudo.js`)
- **Matérias, temas, saudações e exercícios**: lista `SALAS`.
- **Vídeos**: colocar `videos/<id>.mp4` (matematica, portugues, ciencias, historia, geografia, ingles).
  Sem vídeo, a TV mostra o **último post de aula** do professor; sem as duas coisas, avisa.
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
| Professor | Minhas turmas com alunos matriculados, **postar aula para a TV da sala 3D**, resultados dos exercícios na escola, avisos para o chat |
| Direção/Secretaria | Visão geral com números reais, CRUD de alunos, professores, responsáveis, currículo (área > disciplina > série), turmas e cursos, financeiro geral, QR codes e assistente IA |
| Revendedor | **Convites com código de 6 letras** (quem abre `?convite=CODIGO` é registrado), créditos e planos |
| Ao vivo | Botão liga/desliga transmissão, chat em tempo real (entre abas), áudio de 15 s, "toque" no professor |
| Mensageiro | Conversas com secretaria/educador/família, voz e **ligação de voz** com avaliação de qualidade |
| Feira de reforço | Catálogo de cursos, compra = matrícula + extrato + mensagem ao chat; "Zerar dados" reseta a demo |
| Biblioteca QR | QR codes dos materiais; escanear leva até a sala 3D correspondente |

As rotas `#/aluno`, `#/professor`, `#/admin`, `#/revendedor`, `#/aovivo` abrem a escola já com o
painel certo no ar (os chips na tela inicial usam isso).

## Gamificação
`gamificacao.js`: XP no topo (visitar sala, responder exercício, assistir vídeo, QR, compra,
ligação, chat), **6 níveis**, **8 medalhas** e **missões diárias**, com som sutil e confete ao subir
de nível (respeita "reduzir movimento"). Persiste na IndexedDB, por aluno.

## Apresentação comercial
`apresentacao.html`: deck 16:9 de 13 slides com as capturas reais (arquivos em `docs/capturas/`),
navega por **setas/espaço/Home/Fim** e por **toque nas bordas**; imprime em PDF paisagem.

## Dados (só neste navegador)
- IndexedDB `kairos-escola` (**versão 3**, com jogos/convites/exercícios logados), camada única em
  `dados.js` — **toda leitura e escrita passa por ela**, então trocar para o banco PHP depois não
  muda as telas nem o 3D.
- Semente de demonstração cria 3 alunos, 2 educadores, turmas oficiais e de reforço, contrato com
  parcelas, notas, metas e certificado. Banco antigo (v1, sem a semente) é atualizado sozinho.
- No servidor (PHP) a mesma camada `dados.js` será trocada por chamadas à API — o plano é previsto
  no mapa do MonitON.

## Testes (neste computador)
    node testes/teste-pagina.mjs   # tour completo: minha área, secretaria, ao vivo, feira, educador
    node testes/teste-perfis.mjs   # sessão salva + upgrade do banco v1 antigo
    node testes/teste-fase3.mjs    # câmera 1ª/3ª, gamificação, painéis professor/revendedor, rotas #/, links e QRs
    node testes/teste-mobile.mjs   # iPhone simulado: entrada, secretaria, QR

PWA instalável: `manifest.webmanifest` + `sw.js` (cache do shell; imagens ficam em cache adaptativo).
Ícone em `icon.png` (192×192).

Capturas das telas em `docs/capturas/`. Aprender do que já deu problema antes: `docs/notas-tecnicas.md`.

## iPhone
- Botões redondos com `appearance:none` + raio explícito (evita o quadrado do Safari).
- Vídeo com `playsinline`; voz e som liberados pelo toque em "Entrar na escola".
- Não depende de login/sessão: abre direto.
- Falta validar num iPhone real.
