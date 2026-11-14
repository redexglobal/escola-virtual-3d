# Escola Virtual 3D (demonstração)

Escola navegável em Three.js para a demo do ecossistema educacional: recepção, corredor e 6 salas
(Matemática, Português, Ciências, História, Geografia, Inglês). Cada sala tem quadro, carteiras,
TV com a aula em vídeo, exercícios com correção e o educador virtual.

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

## iPhone
- Botões redondos com `appearance:none` + raio explícito (evita o quadrado do Safari).
- Vídeo com `playsinline`; voz e som liberados pelo toque em "Entrar na escola".
- Não depende de login/sessão: abre direto.
- Falta validar num iPhone real.
