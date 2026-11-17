// Rota de estudo do aluno: idade → série → bimestre → disciplina → tópico → estudar.
// Três formatos de aula: vídeo, jogo (exercícios da sala) e interativo (cartões).
// Também: anexar foto da matéria ou escrever tópicos → conteúdo correlacionado local.
import { db, uid } from './dados.js';
import { el, estadoApp, toast, abrePainel, vazio } from './telas.js';
import { SALAS, ESCOLA } from './conteudo.js';
import { registrarQuestao, registrarVideo, registrarConclusao, registrarTutor } from './gamificacao.js';

const BIMESTRES = ['1º bimestre', '2º bimestre', '3º bimestre', '4º bimestre'];

// Estado da navegação (por aluno, por painel aberto)
let serieId = '', bimestre = 0, discId = '', temaAtual = null;

export function moduloEstudo() {
  const painel = abrePainel({
    titulo: '📖 Meu estudo',
    sub: 'Sua trilha de conteúdo por idade, série e bimestre',
    largo: true,
    tabs: [
      { id: 'rota', nome: 'Rota de estudo', render: renderRota },
      { id: 'material', nome: 'Meu material', render: renderMaterial },
    ],
    ativo: 'rota',
  });
  return painel;
}

function idAluno() { return estadoApp.alunoId || 'al-alissom'; }

// ---------------- ROTA DE ESTUDO ----------------
async function renderRota(corpo) {
  corpoRaiz = corpo;
  corpo.innerHTML = '';
  const serie = await db.porId('series', serieId);
  const topicoAberto = !!temaAtual;

  // Trilha de progresso
  const prog = await db.lista('estudoLog');
  const meus = prog.filter((l) => l.alunoId === idAluno() && (!serieId || l.serieId === serieId));
  const resumo = new Map();
  for (const l of meus) {
    const r = resumo.get(l.disciplinaId) || { n: 0 };
    r.n++; resumo.set(l.disciplinaId, r);
  }

  if (!topicoAberto) {
    // Passo 1: idade / série
    const bloco1 = el('div', 'est-passo');
    bloco1.appendChild(el('p', 'est-tit', serie ? `① Sua série: <b>${serie.nome}</b>` : '① Quantos anos você tem?'));
    const chips = el('div', 'chips');
    const ids = ['6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17+'];
    for (const idade of ids) {
      const b = el('button', 'chip' + (serie && String(serie.idadeMin) === idade ? ' on' : ''), idade === '17+' ? '17 ou mais' : `${idade}`);
      b.onclick = async () => {
        const alvo = await db.porId('series', 'ser-' + (idade === '17+' ? '3m' : idade === '15' ? '1m' : idade === '16' ? '2m' : idade < 11 ? idade + 'f' : (idade - 5) + 'f'));
        if (alvo) { serieId = alvo.id; bimestre = 0; discId = ''; await renderRota(corpo); }
        else toast('Essa série ainda não tem grade configurada.');
      };
      chips.appendChild(b);
    }
    if (serie) {
      const trocar = el('a', 'link-suave', 'Escolher outra série →');
      trocar.onclick = () => { serieId = ''; bimestre = 0; discId = ''; renderRota(corpo); };
      chips.appendChild(trocar);
    }
    bloco1.appendChild(chips);
    corpo.appendChild(bloco1);

    if (!serieId) {
      corpo.appendChild(el('p', 'est-dica', 'Escolha a idade acima para a escola montar sua trilha. A direção pode trocar tudo no painel <b>Direção → Grade</b>.'));
      return;
    }

    // Passo 2: bimestre (semestre)
    const bloco2 = el('div', 'est-passo');
    bloco2.appendChild(el('p', 'est-tit', '② Em que bimestre (semestre) você está?'));
    const chipsB = el('div', 'chips');
    BIMESTRES.forEach((nome, i) => {
      const b = el('button', 'chip' + (bimestre === i + 1 ? ' on' : ''), nome);
      b.onclick = () => { bimestre = i + 1; discId = ''; renderRota(corpo); };
      chipsB.appendChild(b);
    });
    bloco2.appendChild(chipsB);
    corpo.appendChild(bloco2);
    if (!bimestre) return;

    // Passo 3: disciplinas com tópicos
    const itens = (await db.lista('gradeItens')).filter((g) => g.serieId === serieId && g.bimestre === bimestre);
    if (!itens.length) { corpo.appendChild(vazio(`Nenhum tópico para o ${BIMESTRES[bimestre - 1]} dessa série ainda.`, 'A direção cadastra no painel Direção → Grade.')); return; }
    const porDisc = {};
    for (const g of itens) (porDisc[g.disciplinaId] = porDisc[g.disciplinaId] || []).push(g);
    const bloco3 = el('div', 'est-passo');
    bloco3.appendChild(el('p', 'est-tit', '③ O que você quer estudar? (toque num tópico)'));
    corpo.appendChild(bloco3);

    for (const [discId2, lista] of Object.entries(porDisc)) {
      const sala = SALAS.find((s) => s.id === discId2);
      const card = el('div', 'disc-card');
      const cab = el('div', 'disc-cab', `<span class="dot" style="background:${sala ? sala.cor : '#666'}"></span><b>${sala ? sala.nome : discId2}</b>`);
      const badge = resumo.get(discId2) ? el('span', 'badge-prog', `${resumo.get(discId2).n} estudado(s)`) : null;
      if (badge) cab.appendChild(badge);
      const irSala = el('a', 'link-suave', 'Ir à sala 3D →');
      irSala.onclick = () => { if (window.__escola) window.__escola.irPara(discId2); };
      cab.appendChild(irSala);
      card.appendChild(cab);
      for (const g of lista) {
        const li = el('div', 'tema-li');
        li.appendChild(el('div', 'tema-nome', g.tema));
        li.appendChild(el('div', 'tema-resumo', g.resumo));
        const botao = el('button', 'btn btn-prim btn-mini', '📚 Estudar');
        botao.onclick = () => { temaAtual = g; renderRota(corpo); };
        li.appendChild(botao);
        card.appendChild(li);
      }
      corpo.appendChild(card);
    }
    return;
  }

  // Tópico aberto: card de estudo
  const sala = SALAS.find((s) => s.id === temaAtual.disciplinaId);
  const cab = el('div', 'est-topo');
  cab.appendChild(el('p', 'selo', `${sala ? sala.nome : ''} · ${BIMESTRES[temaAtual.bimestre - 1]}`));
  cab.appendChild(el('h2', null, temaAtual.tema));
  cab.appendChild(el('p', 'tema-resumo', temaAtual.resumo));
  const voltar = el('a', 'link-suave', '← Voltar para a rota');
  voltar.onclick = () => { temaAtual = null; renderRota(corpo); };
  cab.appendChild(voltar);
  corpo.appendChild(cab);

  // Abas de formato
  const abas = el('div', 'abas');
  let modoAtivo = 'jogo';
  for (const [id, rotulo] of [['video', '🎬 Vídeo'], ['jogo', '🎮 Jogo'], ['interativo', '🖱️ Interativo']]) {
    const a = el('button', 'aba' + (modoAtivo === id ? ' on' : ''), rotulo);
    a.onclick = () => { modoAtivo = id; [...abas.children].forEach((c) => c.classList.toggle('on', c === a)); areaModo(); };
    abas.appendChild(a);
  }
  corpo.appendChild(abas);
  const area = el('div', 'mododo');
  corpo.appendChild(area);
  const areaModo = () => { area.innerHTML = ''; if (modoAtivo === 'video') areaVideo(area); else if (modoAtivo === 'jogo') areaJogo(area); else areaInterativo(area); };
  areaModo();

  // Anexar material / tópicos
  const anexo = el('div', 'anexo-box');
  anexo.appendChild(el('p', 'anexo-tit', '📎 Refazer um conteúdo seu?'));
  anexo.appendChild(el('p', 'est-dica', 'Anexe uma foto do caderno/atividade ou escreva os tópicos que você quer estudar — a escola monta o conteúdo correlacionado na hora.'));
  const linha = el('div', 'anexo-linha');
  const inputArq = el('input', 'campo', ''); inputArq.type = 'file'; inputArq.accept = 'image/*';
  const inpTopico = el('input', 'campo', ''); inpTopico.type = 'text'; inpTopico.placeholder = 'Ex.: frações, redação argumentativa, Sistema Solar…';
  const btnFoto = el('button', 'btn', '📷 Enviar foto');
  const btnTopico = el('button', 'btn btn-prim', '✨ Gerar conteúdo');
  btnFoto.onclick = async () => { if (!inputArq.files.length) return toast('Toque em “Enviar foto” e escolha uma imagem primeiro.'); const ok = await anexaFoto(inputArq.files[0], temaAtual); if (ok) renderRota(corpo); };
  btnTopico.onclick = async () => { if (!inpTopico.value.trim()) return toast('Escreva pelo menos um tópico (separe com vírgula).'); await gerarConexao(inpTopico.value); };
  linha.append(inputArq, btnFoto, inpTopico, btnTopico);
  anexo.appendChild(linha);
  corpo.appendChild(anexo);
}

// ---------------- FORMATO: VÍDEO ----------------
function areaVideo(corpo) {
  const sala = SALAS.find((s) => s.id === temaAtual.disciplinaId);
  const fonte = temaAtual.videoUrl || (sala && sala.video);
  const video = el('video', 'est-video', '');
  video.controls = true; video.playsInline = true;
  if (fonte && !/^https?:/.test(fonte)) video.src = fonte;
  video.addEventListener('timeupdate', () => { if (video.currentTime > 15) registrarVideo(); }, { once: true });
  video.addEventListener('error', () => {
    const avisoV = el('p', 'est-dica', fonte ? 'O vídeo desta disciplina ainda não foi enviado. Enquanto isso, assista pela TV da sala 3D ou use o modo Jogo abaixo.' : 'Sem vídeo próprio neste tópico: veja o post de aula mais recente pela TV da sala 3D, ou use o modo Jogo.');
    corpo.replaceChildren(avisoV);
  });
  corpo.appendChild(video);
  db.lista('aulasPosts').then((posts) => {
    const p = posts.filter((x) => x.materiaId === temaAtual.disciplinaId).sort((a, b) => b.id - a.id)[0];
    if (p) corpo.appendChild(el('p', 'est-dica', `📌 Post de aula: <b>${p.titulo}</b> — ${p.texto}`));
  });
}

// ---------------- FORMATO: JOGO ----------------
function areaJogo(corpo) {
  const sala = SALAS.find((s) => s.id === temaAtual.disciplinaId);
  const questoes = (sala && sala.exercicios) || [];
  let i = 0, pontos = 0;
  const tela = el('div', 'jogo-tela');
  corpo.appendChild(tela);
  const progresso = el('p', 'est-dica', '');
  corpo.appendChild(progresso);
  function pinta() {
    tela.innerHTML = '';
    progresso.textContent = `Questão ${i + 1} de ${questoes.length} · Pontos ${pontos}`;
    const q = questoes[i];
    if (!q) {
      tela.appendChild(el('p', 'jogo-fim', `🏁 Fim do jogo! Você fez ${pontos} ponto(s). ${pontos >= questoes.length * 2 ? 'Mandou bem!' : 'Tente de novo — cada acerto vale 2 pontos e dá XP.'}`));
      const deNovo = el('button', 'btn btn-prim', 'Jogar de novo');
      deNovo.onclick = () => { i = 0; pontos = 0; pinta(); };
      tela.appendChild(deNovo);
      void db.salva('estudoLog', { id: uid(), alunoId: idAluno(), serieId, disciplinaId: temaAtual.disciplinaId, tema: temaAtual.tema, modo: 'jogo', quando: Date.now() });
      registrarConclusao();
      return;
    }
    tela.appendChild(el('h3', 'jogo-q', q.p));
    const ops = el('div', 'opcoes');
    q.o.forEach((op, oi) => {
      const b = el('button', 'opcao', op);
      b.onclick = () => {
        const certo = oi === q.c;
        if (certo) pontos += 2; else pontos = Math.max(0, pontos - 1);
        registrarQuestao(certo);
        void db.salva('exerciciosLog', { id: uid(), quando: Date.now(), alunoId: idAluno(), salaId: temaAtual.disciplinaId, pergunta: q.p, acertou: certo });
        [ ...ops.children ].forEach((c, ci) => { c.disabled = true; if (ci === q.c) c.classList.add('certa'); if (ci === oi && !certo) c.classList.add('errada'); });
        tela.appendChild(el('p', 'explica', (certo ? '✅ Acertou! ' : '❌ Não foi dessa vez. ') + (q.e || '')));
        i++;
        setTimeout(pinta, 1400);
      };
      ops.appendChild(b);
    });
    tela.appendChild(ops);
  }
  pinta();
}

// ---------------- FORMATO: INTERATIVO (cartões) ----------------
function areaInterativo(corpo) {
  const sala = SALAS.find((s) => s.id === temaAtual.disciplinaId);
  const cards = [];
  cards.push({ f: '🎯 Objetivo do tópico', v: temaAtual.tema + '\n\n' + temaAtual.resumo });
  if (sala) cards.push({ f: '💬 Como a sala 3D explica', v: sala.saudacao });
  (sala ? sala.exercicios.slice(0, 2) : []).forEach((e, i) => cards.push({ f: `✏️ Desafio ${i + 1}`, v: e.p + '\n\nResposta: ' + e.o[e.c] }));
  let idx = 0, virados = 0;
  const zona = el('div', 'flips');
  corpo.appendChild(zona);
  const dica = el('p', 'est-dica', 'Toque no cartão para virar. Quando terminar todos, o estudo é registrado.');
  corpo.appendChild(dica);
  function pinta() {
    zona.innerHTML = '';
    const c = cards[idx];
    if (!c) { dica.textContent = '🏁 Cartões concluídos! Volte para a rota e escolha o próximo tópico.'; registrarConclusao(); void db.salva('estudoLog', { id: uid(), alunoId: idAluno(), serieId, disciplinaId: temaAtual.disciplinaId, tema: temaAtual.tema, modo: 'interativo', quando: Date.now() }); return; }
    dica.textContent = `Cartão ${idx + 1} de ${cards.length} — toque para virar.`;
    const flip = el('div', 'flip');
    const frente = el('div', 'flip-face flip-frente', c.f);
    const verso = el('div', 'flip-face flip-verso', c.v);
    verso.classList.add('virado-txt');
    flip.append(frente, verso);
    zona.appendChild(flip);
    const proximo = el('button', 'btn btn-prim', 'Próximo cartão →');
    corpo.appendChild(proximo);
    flip.onclick = () => {
      flip.classList.add('virado');
      if (!frente.dataset.virado) { frente.dataset.virado = 1; virados++; }
    };
    proximo.onclick = () => { idx++; if (idx >= cards.length) { proximo.remove(); registrarTutor(); } pinta(); };
  }
  pinta();
}

// ---------------- ANEXAR FOTO ----------------
async function anexaFoto(arquivo, tema) {
  try {
    const dataUrl = await reduzImagem(arquivo, 900, 0.8);
    await db.salva('anotacoes', { id: uid(), alunoId: idAluno(), materiaId: tema.disciplinaId, texto: `Material anexado — ${tema.tema}`, midia: dataUrl });
    registrarTutor();
    toast('📎 Foto anexada em Meu material. Agora escreva um tópico para gerar o conteúdo.');
    return true;
  } catch { toast('Não consegui ler essa imagem. Tente outra (JPG/PNG).'); return false; }
}

function reduzImagem(arquivo, maxW, q) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, maxW / img.width);
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * escala); cv.height = Math.round(img.height * escala);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      res(cv.toDataURL('image/jpeg', q));
    };
    img.onerror = rej;
    img.src = url;
  });
}

// ---------------- CONTEÚDO CORRELACIONADO ----------------
const PALAVRAS_DISC = {
  matematica: ['fraç', 'fraoç', 'porcent', 'número', 'numero', 'equaç', 'equac', 'geometr', 'área', 'area', 'probab', 'estatíst', 'grafic', 'cálcul', 'calcul', 'juros'],
  portugues: ['redaç', 'redac', 'texto', 'palavra', 'verso', 'poem', 'corde', 'gramát', 'gramat', 'leitura', 'interpret', 'coer', 'substant', 'verbo', 'concord'],
  ciencias: ['plant', 'anim', 'célula', 'celula', 'corpo', 'saúde', 'saude', 'energia', 'fotossínt', 'fotossint', 'sistema solar', 'planeta', 'seres vivos', 'doença', 'doenca'],
  historia: ['brasil', 'guerra', 'história', 'historia', 'império', 'imperio', 'república', 'republica', 'colônia', 'colonia', 'escrav', 'constitui', 'cidad', 'independênc', 'independenc'],
  geografia: ['mapa', 'região', 'regiao', 'bioma', 'clima', 'cidade', 'urbano', 'rural', 'migraç', 'migrac', 'recursos', 'meio ambiente', 'cerrado', 'rio'],
  ingles: ['inglês', 'ingles', 'english', 'word', 'vocabulário', 'vocabulario', 'verb', 'present', 'reading'],
};
function achaDisciplinas(texto) {
  const t = texto.toLowerCase();
  const pontua = {};
  for (const [disc, palavras] of Object.entries(PALAVRAS_DISC))
    if (palavras.some((p) => t.includes(p))) pontua[disc] = 1;
  return Object.keys(pontua);
}

async function gerarConexao(texto) {
  const discIds = achaDisciplinas(texto);
  toast(discIds.length ? 'Conteúdo correlacionado gerado!' : 'Nada encontrado: escreva outros tópicos (ex.: “frações”, “redação”).');
  const area = el('div', 'conexao-box');
  area.appendChild(el('p', 'anexo-tit', '✨ Conteúdo correlacionado ao que você pediu'));
  if (!discIds.length) area.appendChild(el('p', 'est-dica', 'Tente palavras como “frações”, “redação”, “Sistema Solar”, “República”, “mapas” ou “inglês”.'));
  for (const disc of discIds) {
    const sala = SALAS.find((s) => s.id === disc);
    const itens = (await db.lista('gradeItens')).filter((g) => g.disciplinaId === disc && (!serieId || g.serieId === serieId));
    if (!itens.length) continue;
    const bloco = el('div', 'conn-bloco');
    bloco.appendChild(el('p', 'disc-cab', `<span class="dot" style="background:${sala.cor}"></span><b>${sala.nome}</b>`));
    for (const g of itens.slice(0, 4)) {
      const li = el('div', 'tema-li');
      li.appendChild(el('div', 'tema-nome', g.tema));
      li.appendChild(el('div', 'tema-resumo', g.resumo));
      const b = el('button', 'btn btn-mini', 'Estudar este');
      b.onclick = () => { temaAtual = g; discId = disc; renderRota(corpoRaiz); };
      li.appendChild(b);
      bloco.appendChild(li);
    }
    area.appendChild(bloco);
  }
  area.classList.add('on');
  corpoRaiz.appendChild(area);
  area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
let corpoRaiz = null;

// ---------------- MEU MATERIAL ----------------
async function renderMaterial(corpo) {
  corpo.innerHTML = '';
  const lista = (await db.lista('anotacoes')).filter((a) => a.alunoId === idAluno() && a.midia).sort((a, b) => b.id - a.id);
  if (!lista.length) { corpo.appendChild(vazio('Nenhum material anexado ainda.', 'Na aba Rota de estudo, abra um tópico e envie a foto do caderno ou da atividade.')); return; }
  corpo.appendChild(el('p', 'est-dica', 'Suas fotos ficam só neste aparelho (sem login). Toque numa para ver; “Usar como tópico” gera o conteúdo correlacionado.'));
  const grade = el('div', 'mat-grade');
  for (const a of lista) {
    const card = el('div', 'mat-card');
    const img = el('img', 'mat-img', ''); img.src = a.midia; img.alt = a.texto || 'Material';
    const sala = SALAS.find((s) => s.id === a.materiaId);
    card.append(img, el('p', 'mat-txt', a.texto || ''), sala ? el('p', 'selo', sala.nome) : null);
    const usar = el('button', 'btn btn-mini', 'Usar como tópico');
    usar.onclick = async () => { gerarConexao(a.texto); };
    const remover = el('button', 'btn btn-mini', 'Remover');
    remover.onclick = async () => { await db.remove('anotacoes', a.id); renderMaterial(corpo); };
    card.append(usar, remover);
    grade.appendChild(card);
  }
  corpo.appendChild(grade);
}
