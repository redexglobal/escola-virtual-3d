// Conteúdo da escola: troque aqui sem mexer no motor 3D.
// video: caminho de um .mp4 dentro de videos/. Se o arquivo não existir,
// a TV da sala mostra o aviso "vídeo ainda não enviado" (nada é inventado).

export const ESCOLA = {
  nome: 'Escola Virtual',
  subtitulo: 'Ambiente imersivo com educador virtual',
  // Endereço do educador virtual (tutor em PHP). Vazio = botão mostra aviso.
  // Ex.: 'https://seu-dominio/roboAlotv.php'
  tutorUrl: '',
};

export const AUTORIA = {
  nome: 'Vilson Mota',
  empresa: 'Kairós Digital',
  instagram: 'https://www.instagram.com/_kairosdigital_/',
  whatsapp: 'https://wa.me/5562984924326',
};

export const SALAS = [
  {
    id: 'matematica', nome: 'Matemática', cor: '#2f6fd6', lado: -1, z: -8,
    tema: 'Frações e porcentagem',
    video: 'videos/matematica.mp4',
    saudacao: 'Olá! Bem-vindo à aula de Matemática. Hoje vamos praticar frações e porcentagem.',
    exercicios: [
      { p: 'Quanto é 25% de 80?', o: ['15', '20', '25', '32'], c: 1, e: '25% é um quarto. 80 dividido por 4 é 20.' },
      { p: 'Qual fração é equivalente a 2/4?', o: ['1/2', '1/3', '3/4', '2/3'], c: 0, e: 'Dividindo numerador e denominador por 2, 2/4 vira 1/2.' },
      { p: 'Quanto é 3/5 de 50?', o: ['15', '25', '30', '35'], c: 2, e: '50 ÷ 5 = 10, e 10 × 3 = 30.' },
    ],
  },
  {
    id: 'portugues', nome: 'Português', cor: '#c2410c', lado: 1, z: -8,
    tema: 'Classes de palavras',
    video: 'videos/portugues.mp4',
    saudacao: 'Olá! Bem-vindo à aula de Português. Vamos revisar as classes de palavras.',
    exercicios: [
      { p: 'Na frase "O menino correu rápido", qual palavra é verbo?', o: ['menino', 'correu', 'rápido', 'O'], c: 1, e: '"Correu" indica uma ação: é verbo.' },
      { p: 'Qual palavra é um substantivo?', o: ['bonito', 'cadeira', 'andar', 'muito'], c: 1, e: '"Cadeira" dá nome a um objeto: é substantivo.' },
      { p: 'Qual é o plural de "pão"?', o: ['pãos', 'pões', 'pães', 'pãoes'], c: 2, e: 'O plural correto de "pão" é "pães".' },
    ],
  },
  {
    id: 'ciencias', nome: 'Ciências', cor: '#15803d', lado: -1, z: -24,
    tema: 'Sistema Solar e seres vivos',
    video: 'videos/ciencias.mp4',
    saudacao: 'Olá! Bem-vindo à aula de Ciências. Vamos explorar o Sistema Solar e os seres vivos.',
    exercicios: [
      { p: 'Qual planeta fica mais perto do Sol?', o: ['Vênus', 'Terra', 'Mercúrio', 'Marte'], c: 2, e: 'Mercúrio é o planeta mais próximo do Sol.' },
      { p: 'O que as plantas produzem na fotossíntese, além de glicose?', o: ['Gás carbônico', 'Oxigênio', 'Nitrogênio', 'Hélio'], c: 1, e: 'Na fotossíntese a planta libera oxigênio.' },
      { p: 'Qual é o maior órgão do corpo humano?', o: ['Coração', 'Fígado', 'Pele', 'Pulmão'], c: 2, e: 'A pele é o maior órgão do corpo humano.' },
    ],
  },
  {
    id: 'historia', nome: 'História', cor: '#9a3412', lado: 1, z: -24,
    tema: 'Brasil: do Império à República',
    video: 'videos/historia.mp4',
    saudacao: 'Olá! Bem-vindo à aula de História. Vamos falar do Brasil, do Império à República.',
    exercicios: [
      { p: 'Em que ano foi proclamada a Independência do Brasil?', o: ['1500', '1822', '1889', '1888'], c: 1, e: 'A Independência foi proclamada em 7 de setembro de 1822.' },
      { p: 'Qual lei aboliu a escravidão no Brasil, em 1888?', o: ['Lei do Ventre Livre', 'Lei Áurea', 'Lei dos Sexagenários', 'Lei Eusébio de Queirós'], c: 1, e: 'A Lei Áurea foi assinada em 13 de maio de 1888.' },
      { p: 'Em que ano foi proclamada a República no Brasil?', o: ['1822', '1889', '1930', '1964'], c: 1, e: 'A República foi proclamada em 15 de novembro de 1889.' },
    ],
  },
  {
    id: 'geografia', nome: 'Geografia', cor: '#0e7490', lado: -1, z: -40,
    tema: 'Regiões e biomas do Brasil',
    video: 'videos/geografia.mp4',
    saudacao: 'Olá! Bem-vindo à aula de Geografia. Vamos conhecer as regiões e os biomas do Brasil.',
    exercicios: [
      { p: 'Goiás fica em qual região do Brasil?', o: ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste'], c: 2, e: 'Goiás faz parte da Região Centro-Oeste.' },
      { p: 'Qual é o bioma predominante em Goiás?', o: ['Amazônia', 'Cerrado', 'Pampa', 'Caatinga'], c: 1, e: 'O Cerrado é o bioma predominante em Goiás.' },
      { p: 'Qual é a capital do Brasil?', o: ['Rio de Janeiro', 'São Paulo', 'Brasília', 'Goiânia'], c: 2, e: 'Brasília é a capital federal desde 1960.' },
    ],
  },
  {
    id: 'ingles', nome: 'Inglês', cor: '#6d28d9', lado: 1, z: -40,
    tema: 'Vocabulário do dia a dia',
    video: 'videos/ingles.mp4',
    saudacao: 'Hello! Bem-vindo à aula de Inglês. Vamos praticar o vocabulário do dia a dia.',
    exercicios: [
      { p: 'Como se diz "livro" em inglês?', o: ['Book', 'Look', 'Desk', 'Pen'], c: 0, e: '"Book" significa livro.' },
      { p: 'Qual é a tradução de "teacher"?', o: ['Aluno', 'Escola', 'Professor(a)', 'Sala'], c: 2, e: '"Teacher" significa professor ou professora.' },
      { p: 'Complete: "I ___ a student."', o: ['is', 'are', 'am', 'be'], c: 2, e: 'Com "I" usa-se "am": I am a student.' },
    ],
  },
];
