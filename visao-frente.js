// Visão de FRENTE (apresentação): a escola fora do 3D, como um palco real.
// Foto de sala de verdade como fundo, quadro com o tópico atual, vídeo da aula,
// exercício ao vivo e o educador virtual. Feita para apresentar e para estudar.
import { db } from './dados.js';
import { el, estadoApp, toast } from './telas.js';
import { SALAS, ESCOLA } from './conteudo.js';
import { registrarQuestao, registrarVideo } from './gamificacao.js';

let raizAtual = null;

export function visaoFrente(salaInicial) {
  fechaFrente();
  const raiz = el('div', 'vf-root');
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-modal', 'true');
  raiz.setAttribute('aria-label', 'Visão de frente da escola');

  const foto = el('div', 'vf-foto');
  foto.style.backgroundImage = `url('${ESCOLA.salaReal}')`;
  raiz.appendChild(foto);
  raiz.appendChild(el('div', 'vf-sombra'));

  const corpo = el('div', 'vf-corpo');
  raiz.appendChild(corpo);

  // Barra superior
  const topo = el('header', 'vf-topo');
  const marca = el('div', 'vf-marca');
  marca.appendChild(el('p', 'selo', 'Visão de frente'));
  marca.appendChild(el('h1', null, ESCOLA.nome));
  const voltar = el('button', 'btn vf-voltar', '← Voltar para o 3D');
  voltar.onclick = () => fechaFrente();
  topo.append(marca, voltar);
  corpo.appendChild(topo);

  // Troca de disciplina (chips)
  const chips = el('div', 'chips vf-chips');
  corpo.appendChild(chips);

  let discId = (salaInicial && SALAS.some((s) => s.id === salaInicial) ? salaInicial : null) || atualDeEstado();
  let iQuestao = 0;

  async function atualiza() {
    const sala = SALAS.find((s) => s.id === discId);
    [...chips.children].forEach((c) => c.classList.toggle('on', c.dataset.disc === discId));
    const palco = el('main', 'vf-palco');
    // limpa palco antigo
    const velho = raiz.querySelector('.vf-palco');
    if (velho) velho.remove();

    // Quadro (tópico do bimestre atual — dado real da grade)
    const quad = el('section', 'vf-card vf-quadro');
    quad.appendChild(el('h2', null, '📋 No ar agora — ' + (sala ? sala.nome : '')));
    const itens = (await db.lista('gradeItens')).filter((g) => g.disciplinaId === discId);
    if (itens.length) {
      const g = itens[0];
      quad.appendChild(el('p', 'vf-tema', g.tema));
      quad.appendChild(el('p', 'vf-resumo', g.resumo));
      const prox = el('p', 'vf-prox', `A seguir: ${itens.slice(1, 4).map((x) => x.tema).join(' · ') || '—'}`);
      quad.appendChild(prox);
    } else {
      quad.appendChild(el('p', 'vf-resumo', (sala && sala.saudacao) || 'A direção ainda não publicou a grade desta disciplina.'));
    }
    const ir3d = el('button', 'btn btn-mini', 'Ir à sala 3D →');
    ir3d.onclick = () => { fechaFrente(); if (window.__escola) window.__escola.irPara(discId); };
    quad.appendChild(ir3d);
    palco.appendChild(quad);

    // Vídeo da aula
    const tel = el('section', 'vf-card vf-tela');
    tel.appendChild(el('h2', null, '🎬 Aula em vídeo'));
    const video = el('video', 'vf-video', '');
    video.controls = true; video.playsInline = true;
    const fonte = (sala && sala.video) || '';
    if (fonte && !/^https?:/.test(fonte)) video.src = fonte;
    video.addEventListener('timeupdate', () => { if (video.currentTime > 15) registrarVideo(); }, { once: true });
    const avisoV = el('p', 'vf-vazio', fonte ? 'O vídeo ainda não foi enviado (coloque em videos/). Enquanto isso, use o exercício ao lado.' : 'Sem vídeo próprio nesta sala — coloque um .mp4 em videos/ que ele aparece aqui.');
    video.addEventListener('error', () => avisoV.hidden = false);
    tel.append(video, avisoV);
    palco.appendChild(tel);

    // Exercício + educador
    const lado = el('aside', 'vf-lado');
    const exCard = el('section', 'vf-card');
    exCard.appendChild(el('h2', null, '✏️ Exercício ao vivo'));
    renderQuestao(exCard, sala);
    lado.appendChild(exCard);
    const edu = el('section', 'vf-card vf-edu');
    edu.appendChild(el('h2', null, '🧑‍🏫 Educador virtual'));
    const posts = await db.lista('aulasPosts').then((l) => l.filter((p) => p.materiaId === discId).sort((a, b) => b.id - a.id));
    if (posts.length) edu.appendChild(el('p', 'vf-edu-frase', '“' + posts[0].texto + '”'));
    else edu.appendChild(el('p', 'vf-edu-frase', (sala && sala.saudacao) || 'Olá! Me conta o que você quer estudar.'));
    const falar = el('button', 'btn', 'Falar com o educador');
    falar.onclick = () => toast(ESCOLA.tutorUrl ? 'Abrindo o tutor…' : 'O endereço do tutor (tutorUrl) ainda está vazio em conteudo.js.');
    edu.appendChild(falar);
    lado.appendChild(edu);

    palco.appendChild(lado);
    corpo.appendChild(palco);
  }

  function renderQuestao(card, sala) {
    const lista = (sala && sala.exercicios) || [];
    const q = lista[iQuestao % Math.max(1, lista.length)];
    card.querySelectorAll('.vf-q,.opcoes,.explica,.vf-fim').forEach((n) => n.remove());
    if (!q) { card.appendChild(el('p', 'vf-fim', 'Sem exercícios configurados nesta sala.')); return; }
    const h = el('p', 'vf-q', q.p);
    const ops = el('div', 'opcoes');
    q.o.forEach((op, oi) => {
      const b = el('button', 'opcao', op);
      b.onclick = () => {
        const certo = oi === q.c;
        registrarQuestao(certo);
        [...ops.children].forEach((c, ci) => { c.disabled = true; if (ci === q.c) c.classList.add('certa'); if (ci === oi && !certo) c.classList.add('errada'); });
        const ex = el('p', 'explica', (certo ? '✅ Acertou! ' : '❌ Não foi dessa vez. ') + (q.e || ''));
        ops.after(ex);
        iQuestao++;
        setTimeout(() => { if (raiz.isConnected) renderQuestao(card, sala); }, 1600);
      };
      ops.appendChild(b);
    });
    card.append(h, ops);
  }

  function atualDeEstado() {
    // se o aluno já estava numa sala 3D, começa lá
    try { const st = window.__escola && window.__escola.estado(); if (st && SALAS.some((s) => s.id === st)) return st; } catch {}
    return 'matematica';
  }

  function montaChips() {
    chips.innerHTML = '';
    for (const s of SALAS) {
      const c = el('button', 'chip', s.nome);
      c.dataset.disc = s.id;
      c.onclick = () => { discId = s.id; iQuestao = 0; atualiza(); };
      chips.appendChild(c);
    }
  }

  // fecha com Esc (fora dos campos)
  const tecla = (e) => { if (e.key === 'Escape' && raiz.isConnected && !(e.target.closest('input,textarea,select'))) fechaFrente(); };
  document.addEventListener('keydown', tecla);
  raiz.addEventListener('click', (e) => { if (e.target === raiz || e.target === foto || e.target.classList.contains('vf-sombra')) fechaFrente(); });

  document.body.appendChild(raiz);
  document.body.classList.add('vf-aberto');
  montaChips();
  atualiza();
  raizAtual = raiz;
  return raiz;
}

function fechaFrente() {
  if (!raizAtual) return;
  const r = raizAtual; raizAtual = null;
  document.body.classList.remove('vf-aberto');
  setTimeout(() => r.remove(), 250);
}
export { fechaFrente };
