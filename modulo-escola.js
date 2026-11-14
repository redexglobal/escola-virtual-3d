// Módulo escola: ao vivo (chat + poke), mensageiro com ligação de voz,
// feira de reforço, biblioteca de QR e o chat do assistente IA.
import { db, money, dataBr, uid } from './dados.js';
import { el, toast, abrirModal, qrDesenha } from './telas.js';
import { SALAS, ESCOLA } from './conteudo.js';

// ---------- voz ----------
function falar(texto, voz) {
  try {
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    if (voz === 'alta') u.rate = 0.9;
    if (voz === 'baixa') u.rate = 1.25;
    window.speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const a = new Ctx();
    const o = a.createOscillator(), g = a.createGain();
    o.frequency.value = 880; g.gain.value = 0.06;
    o.connect(g).connect(a.destination);
    o.start(); o.stop(a.currentTime + 0.15);
  } catch { /* sem áudio */ }
}
let mediaRecorder;
function gravarVoz(maxMs, aoTerminar) {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((s) => {
      mediaRecorder = new MediaRecorder(s);
      const partes = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
      mediaRecorder.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        const b64 = new Promise((res) => {
          const r = new FileReader();
          r.onloadend = () => res(r.result);
          r.readAsDataURL(new Blob(partes, { type: 'audio/webm' }));
        });
        b64.then(aoTerminar);
      };
      mediaRecorder.start();
      toast('Gravando áudio… fale agora');
      setTimeout(() => { if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop(); }, maxMs || 15000);
    })
    .catch(() => toast('Microfone não permitido neste dispositivo'));
}
export function pararGravacao() {
  if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); mediaRecorder = null; }
}

// ---------- ao vivo ----------
async function estadoLive() {
  let c = await db.porId('config', 'live');
  if (!c) { c = { id: 'live', aoVivo: false }; await db.salva('config', c); }
  return c;
}
export async function aoVivo() {
  const corpo = el('div', 'abas-cab');
  const top = el('div', 'painel-topo');
  const titulo = el('h3', null, 'Ao vivo');
  const sub = el('p', 'sub', 'Aula em transmissão com chat do corredor');
  const btnEstado = el('button', 'botoes b-verde', 'Iniciar transmissão');
  const dot = el('span', 'live-dot off', '');
  top.append(titulo, sub, dot, btnEstado);
  corpo.appendChild(top);

  const caixaChat = el('div', 'chat-caixa');
  const chat = el('div', 'chat-lista');
  caixaChat.appendChild(chat);
  const linhaMsg = el('div', 'chat-linha');
  const inpMsg = el('input'); inpMsg.type = 'text'; inpMsg.placeholder = 'Escreva uma mensagem…';
  const btnEnv = el('button', 'botoes', 'Enviar');
  const btnMic = el('button', 'botoes b-fantasma', '🎤 Áudio (15s)');
  linhaMsg.append(inpMsg, btnEnv, btnMic);
  corpo.append(caixaChat, linhaMsg);

  let aoVivoAgora = false;
  let meusMensagens = new Set();

  async function recarrega() {
    const msgs = (await db.lista('chatAovivo')).sort((a, b) => b.quando - a.quando).reverse();
    chat.innerHTML = '';
    if (!msgs.length) chat.appendChild(el('p', 'vazio-p', 'Nenhuma mensagem ainda. A aula começa em instantes!'));
    for (const m of msgs) {
      const bloco = el('div', m.minha ? 'chat-bloco minha' : 'chat-bloco');
      bloco.appendChild(el('div', 'chat-rotulo', m.tipo === 'sistema' ? '· sistema ·' : (m.autor || 'aluno')));
      if (m.audio) {
        const a = document.createElement('audio');
        a.controls = true; a.src = m.audio;
        bloco.appendChild(a);
      }
      if (m.texto) bloco.appendChild(el('div', 'chat-texto', m.texto));
      chat.appendChild(bloco);
    }
    caixaChat.scrollTop = caixaChat.scrollHeight;
    const live = await estadoLive();
    aoVivoAgora = !!live.aoVivo;
    dot.classList.toggle('on', aoVivoAgora);
    dot.title = aoVivoAgora ? 'Transmitindo agora' : 'Fora do ar';
    btnEstado.textContent = aoVivoAgora ? 'Encerrar transmissão' : 'Iniciar transmissão';
    btnEstado.className = aoVivoAgora ? 'botoes b-vermelho' : 'botoes b-verde';
    inpMsg.disabled = !aoVivoAgora;
    btnEnv.disabled = !aoVivoAgora;
    btnMic.disabled = !aoVivoAgora;
  }

  async function envia(texto, extra) {
    let noAr = aoVivoAgora;
    if (!noAr) { try { noAr = !!(await estadoLive()).aoVivo; } catch (e) {} } // confere a fonte da verdade antes de descartar
    if (!noAr) { toast('A transmissão está fora do ar'); return; }
    const m = Object.assign({ id: uid(), quando: Date.now(), tipo: 'aluno', autor: 'Aluno', texto: texto || '' }, extra || {});
    await db.salva('chatAovivo', m);
    meusMensagens.add(m.id);
    recarrega();
  }
  btnEnv.addEventListener('click', () => { if (inpMsg.value.trim()) { envia(inpMsg.value.trim()); inpMsg.value = ''; } });
  inpMsg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && inpMsg.value.trim()) { envia(inpMsg.value.trim()); inpMsg.value = ''; } });
  btnMic.addEventListener('click', () => gravarVoz(15000, async (audio) => { await envia('', { audio }); }));
  btnEstado.addEventListener('click', async () => {
    const novo = !aoVivoAgora;
    // sinal local antes de qualquer await: digitar logo após clicar já conta como no ar
    aoVivoAgora = novo;
    inpMsg.disabled = btnEnv.disabled = btnMic.disabled = !novo;
    const live = await estadoLive();
    live.aoVivo = novo;
    try { await db.salva('config', live); } catch (e) { console.error(e); }
    await db.salva('chatAovivo', { id: uid(), quando: Date.now(), tipo: 'sistema', autor: 'Sistema', texto: novo ? '🔴 Transmissão ao vivo começou!' : 'Transmissão encerrada.' });
    recarrega();
    if (novo) beep();
  });

  // Poke (toque) no professor — do MonitON
  const poke = el('div', 'poke-linha');
  poke.appendChild(el('span', null, 'Deu um toque para chamar atenção:'));
  const bPoke = el('button', 'botoes b-destaque', '👉 Dar um toque no professor');
  poke.appendChild(bPoke);
  corpo.appendChild(poke);
  bPoke.addEventListener('click', async () => {
    await db.salva('chatAovivo', { id: uid(), quando: Date.now(), tipo: 'sistema', autor: 'Toque', texto: '👉 O aluno deu um toque na tela! O professor viu seu toque.' });
    beep();
    toast('Toque enviado ao professor!');
    recarrega();
  });

  const painel = abrirModal({ titulo: 'Ao vivo', sub: 'Transmissão com chat em tempo real', largo: 560, corpos: [corpo] });
  recarrega();
  const intervalo = setInterval(recarrega, 3000); // sincroniza com quem estiver do outro lado
  const obs = (e) => { if (e.detail?.colecao === 'chatAovivo' || e.detail?.colecao === 'config') recarrega(); };
  window.addEventListener('dados-atualizado', obs);
  painel.fechar = (() => {
    const f = painel.fechar.bind(painel);
    return () => { clearInterval(intervalo); window.removeEventListener('dados-atualizado', obs); pararGravacao(); f(); };
  })();
  return painel;
}

// ---------- mensageiro + ligação ----------
const CONTATOS = [
  { id: 'secretaria', nome: 'Secretaria da escola', papel: 'Escola' },
  { id: 'professor', nome: 'Seu educador', papel: 'Professor' },
  { id: 'familia', nome: 'Família / Responsável', papel: 'Responsável' },
];
let conversaAtual = 'secretaria';

export function mensageiro() {
  const corpo = el('div', 'msg-cab');
  const top = el('div', 'painel-topo');
  const titulo = el('h3', null, 'Mensageiro');
  const sub = el('p', 'sub', 'Mensagens e ligação de voz com a escola');
  top.append(titulo, sub);
  corpo.appendChild(top);

  const listaContatos = el('div', 'msg-contatos');
  const areaConversa = el('div', 'msg-area');
  corpo.append(listaContatos, areaConversa);

  const thread = el('div', 'chat-lista');
  const linhaMsg = el('div', 'chat-linha');
  const inpMsg = el('input'); inpMsg.type = 'text'; inpMsg.placeholder = 'Mensagem…';
  const btnEnv = el('button', 'botoes', 'Enviar');
  const btnMic = el('button', 'botoes b-fantasma', '🎤');
  linhaMsg.append(inpMsg, btnEnv, btnMic);
  const botoesLigacao = el('div', 'msg-licao');
  const btnLigar = el('button', 'botoes b-verde', '📞 Ligar de voz');
  botoesLigacao.appendChild(btnLigar);
  areaConversa.append(botoesLigacao, thread, linhaMsg);

  function renderizaContatos() {
    listaContatos.innerHTML = '';
    for (const c of CONTATOS) {
      const b = el('button', c.id === conversaAtual ? 'msg-contato ativo' : 'msg-contato', `${c.papel}: ${c.nome}`);
      b.addEventListener('click', () => { conversaAtual = c.id; renderizaContatos(); carregaThread(); });
      listaContatos.appendChild(b);
    }
  }

  async function carregaThread() {
    const cont = CONTATOS.find((c) => c.id === conversaAtual);
    thread.innerHTML = '';
    const msgs = (await db.lista('mensagens'))
      .filter((m) => (m.de === 'eu' && m.contato === conversaAtual) || (m.de === cont.id))
      .sort((a, b) => a.quando - b.quando);
    if (!msgs.length) thread.appendChild(el('p', 'vazio-p', `Sem mensagens ainda com ${cont.nome}.`));
    for (const m of msgs) {
      const bloco = el('div', m.de === 'eu' ? 'chat-bloco minha' : 'chat-bloco');
      if (m.de !== 'eu') bloco.appendChild(el('div', 'chat-rotulo', cont.nome));
      if (m.audio) { const a = document.createElement('audio'); a.controls = true; a.src = m.audio; bloco.appendChild(a); }
      if (m.texto) bloco.appendChild(el('div', 'chat-texto', m.texto));
      thread.appendChild(bloco);
    }
    areaConversa.scrollTop = areaConversa.scrollHeight;
  }

  async function envia(texto, extra) {
    await db.salva('mensagens', { id: uid(), quando: Date.now(), contato: conversaAtual, de: 'eu', texto: texto || '', ...(extra || {}) });
    carregaThread();
  }
  btnEnv.addEventListener('click', () => { if (inpMsg.value.trim()) { envia(inpMsg.value.trim()); inpMsg.value = ''; } });
  inpMsg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && inpMsg.value.trim()) { envia(inpMsg.value.trim()); inpMsg.value = ''; } });
  btnMic.addEventListener('click', () => gravarVoz(15000, async (audio) => envia('', { audio })));

  let ligacao = null; // {inicio, audioCtx, stream, btnFim}
  btnLigar.addEventListener('click', async () => {
    if (ligacao) return;
    const cont = CONTATOS.find((c) => c.id === conversaAtual);
    const m = abrirModal({ titulo: `Ligação com ${cont.nome}`, sub: 'Ligação de voz — fone de ouvido recomendado', largo: 420 });
    const palco = el('div', 'ligacao-palco');
    const avatar = el('div', 'ligacao-avatar', '📞');
    const nome = el('div', 'ligacao-nome', cont.nome);
    const tempo = el('div', 'ligacao-tempo', 'chamando…');
    const bFim = el('button', 'botoes b-vermelho', 'Desligar');
    palco.append(avatar, nome, tempo);
    m.corpo.append(palco, bFim);
    let stream = null, ctx = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      src.connect(ctx.destination);
    } catch { toast('Sem microfone autorizado: ligando sem som.'); }
    const inicio = Date.now();
    const tick = setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000);
      tempo.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 500);
    let encerrada = false;
    function desligar() {
      if (encerrada) return;
      encerrada = true;
      clearInterval(tick);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (ctx) ctx.close().catch(() => {});
      const dur = Math.floor((Date.now() - inicio) / 1000);
      const notaEl = el('div', 'notas', '');
      notaEl.appendChild(el('p', null, 'Como foi esta ligação?'));
      const estrelas = el('div', 'notas-linea', '');
      const bOk = el('button', 'botoes b-verde', 'Salvar avaliação');
      for (let i = 1; i <= 5; i++) {
        const s = el('button', 'nota', '☆');
        s.addEventListener('click', () => {
          for (let j = 1; j <= 5; j++) estrelas.children[j - 1].textContent = j <= i ? '★' : '☆';
        });
        estrelas.appendChild(s);
      }
      notaEl.append(estrelas, bOk);
      m.corpo.appendChild(notaEl);
      bFim.textContent = 'Aguardando avaliação…';
      bFim.disabled = true;
      bOk.addEventListener('click', async () => {
        const n = [...estrelas.children].findIndex((e) => e.textContent === '★') + 1;
        await db.salva('ligacoes', { id: uid(), quando: Date.now(), contato: cont.nome, duracaoSeg: dur, notaQualidade: n || 5 });
        await db.salva('mensagens', { id: uid(), quando: Date.now(), contato: conversaAtual, de: cont.id, texto: `Ligação encerrada (${Math.max(1, Math.round(dur / 60))} min) · Avaliação recebida, obrigado!` });
        m.fechar(); carregaThread();
        toast('Ligação registrada com sua avaliação');
      });
    }
    ligacao = { encerrar: desligar, modal: m };
    bFim.addEventListener('click', desligar);
    setTimeout(desligar, 90000); // máx 90 s na demo
  });

  const painel = abrirModal({ titulo: 'Mensageiro', sub: 'Comunicação com a escola', largo: 640, corpos: [corpo] });
  renderizaContatos();
  carregaThread();
  const obs = (e) => { if (e.detail?.colecao === 'mensagens') carregaThread(); };
  window.addEventListener('dados-atualizado', obs);
  painel.fechar = (() => {
    const f = painel.fechar.bind(painel);
    return () => {
      if (ligacao) { ligacao.encerrar(); ligacao.modal.fechar(); }
      window.removeEventListener('dados-atualizado', obs);
      pararGravacao();
      f();
    };
  })();
  return painel;
}

// ---------- feira de reforço (compras) ----------
export function feira(alunoIdAtual) {
  const corpo = el('div');
  const top = el('div', 'painel-topo');
  const titulo = el('h3', null, 'Feira de reforço');
  const sub = el('p', 'sub', 'Cursos de reforço à venda — como o catálogo do MonitON');
  const sel = el('select');
  const bLimpar = el('button', 'botoes b-vermelho', 'Zerar dados (demo)');
  top.append(titulo, sub);
  const linhaTop = el('div', 'msg-licao');
  linhaTop.append(el('label', 'sub', 'Matricular aluno:'), sel, bLimpar);
  corpo.append(top, linhaTop);

  const lista = el('div', 'feira-grid');
  const meus = el('div');
  const hMeus = el('h4', 'sub', 'Minhas compras');
  corpo.append(lista, hMeus, meus);

  let selId = alunoIdAtual || '';
  const alunosCache = [];
  async function carrega() {
    alunosCache.length = 0;
    for (const a of await db.lista('alunos')) alunosCache.push(a);
    if (!selId && alunosCache[0]) selId = alunosCache[0].id;
    sel.innerHTML = '';
    sel.add(new Option('— escolha —', ''));
    for (const a of alunosCache) sel.add(new Option(`${a.nome} (${a.matricula || a.serieId || '—'})`, a.id));
    sel.value = selId;
    const [turmasRef, compras] = await Promise.all([db.lista('turmas'), db.lista('compras')]);
    lista.innerHTML = '';
    for (const t of turmasRef.filter((t) => t.tipo === 'reforco')) {
      const card = el('div', 'feira-card');
      card.appendChild(el('div', 'feira-titulo', t.nome));
      const meta = el('div', 'feira-meta', 'Disciplina: — · Série: —');
      card.appendChild(meta);
      card.appendChild(el('div', 'feira-preco', money(t.preco)));
      const jaComprei = compras.some((c) => c.turmaId === t.id && c.alunoId === selId);
      const b = el('button', 'botoes ' + (jaComprei ? 'b-fantasma' : 'b-verde'), jaComprei ? '✓ Já matriculado' : 'Comprar e matricular');
      if (jaComprei) b.disabled = true;
      b.addEventListener('click', async () => {
        if (!selId) { toast('Escolha o aluno primeiro'); return; }
        const quando = Date.now();
        // uma única transação multi-store (mais rápido em aparelho fraco que 4 transações separadas)
        await db.salvaLote([
          { col: 'compras', obj: { id: uid(), quando, alunoId: selId, turmaId: t.id, valor: t.preco, forma: 'a combinar' } },
          { col: 'extrato', obj: { id: uid(), quando, alunoId: selId, descricao: 'Compra curso ' + t.nome, valor: t.preco, tipo: 'compra' } },
          { col: 'matriculas', obj: { id: uid(), alunoId: selId, turmaId: t.id, tipo: 'reforco' } },
          { col: 'chatAovivo', obj: { id: uid(), quando, tipo: 'sistema', autor: 'Feira', texto: `🛒 Aluno matriculado no reforço de ${t.nome}.` } },
        ]);
        toast(`Aluno matriculado no reforço de ${t.nome}`);
        carrega();
      });
      card.appendChild(b);
      lista.appendChild(card);
      meta._turma = t;
    }
    // nomes das disciplinas/séries
    const [discs, sers] = await Promise.all([db.lista('disciplinas'), db.lista('series')]);
    lista.querySelectorAll('.feira-meta').forEach((m) => {
      const t = m._turma;
      m.textContent = `Disciplina: ${discs.find((d) => d.id === t.disciplinaId)?.nome || '—'} · Série: ${sers.find((s) => s.id === t.serieId)?.nome || '—'}`;
    });
    meus.innerHTML = '';
    const comprados = compras.filter((c) => c.alunoId === selId).sort((a, b) => b.quando - a.quando);
    if (!comprados.length) meus.appendChild(el('p', 'vazio-p', 'Este aluno ainda não comprou cursos.'));
    else for (const c of comprados) {
      const t = turmasRef.find((x) => x.id === c.turmaId);
      const li = el('div', 'feira-compra');
      li.append(
        el('span', null, dataBr(c.quando) + ' — ' + (t ? t.nome : 'curso removido')),
        el('span', 'tag-aberto', c.forma || 'a combinar'),
        el('span', null, ' ' + money(c.valor)),
      );
      meus.appendChild(li);
    }
  }
  sel.addEventListener('change', () => { selId = sel.value; carrega(); });
  bLimpar.addEventListener('click', async () => {
    if (!confirm('Zerar todos os dados? Na demo, apaga alunos, notas e compras; a página recarrega e a semente volta.')) return;
    await db.apagarTudo();
    toast('Dados zerados — recriando semente…');
    location.reload();
  });
  const painel = abrirModal({ titulo: 'Feira de reforço', sub: 'Catálogo de cursos + matriculação', largo: 700, corpos: [corpo] });
  carrega();
  return painel;
}

// ---------- biblioteca de QR codes ----------
export function bibliotecaQr() {
  const corpo = el('div');
  const top = el('div', 'painel-topo');
  const titulo = el('h3', null, 'Biblioteca de conteúdo');
  const sub = el('p', 'sub', 'Pôsteres QR: cada código aponta para aula, exercício ou capítulo');
  top.append(titulo, sub);
  const grade = el('div', 'feira-grid');
  corpo.append(top, grade);
  (async () => {
    const qr = await db.lista('qrcodes');
    if (!qr.length) grade.appendChild(el('p', 'vazio-p', 'Nenhum pôster criado ainda. Crie na Secretaria → QR codes.'));
    for (const q of qr) {
      const card = el('div', 'feira-card qr-card');
      const cv = el('canvas'); cv.width = 96; cv.height = 96;
      card.appendChild(cv);
      card.appendChild(el('div', 'feira-titulo', q.titulo));
      card.appendChild(el('div', 'feira-meta', `${q.material || 'material'}${q.capitulo ? ' · Cap. ' + q.capitulo : ''}${q.frente ? ' · Frente ' + q.frente : ''}`));
      const bAbrir = el('button', 'botoes', 'Abrir conteúdo');
      card.appendChild(bAbrir);
      grade.appendChild(card);
      qrDesenha(cv, 'kairos://' + (q.conteudo || q.id));
      bAbrir.addEventListener('click', () => {
        janelaQr(q);
      });
    }
  })();
  const painel = abrirModal({ titulo: 'Biblioteca', sub: 'QR codes de material', largo: 700, corpos: [corpo] });
  return painel;
}
function janelaQr(q) {
  const m = abrirModal({ titulo: 'QR · ' + q.titulo, sub: q.conteudo || '', largo: 360 });
  const cv = el('canvas'); cv.width = 200; cv.height = 200; cv.style.display = 'block'; cv.style.margin = '8px auto';
  const nota = el('p', 'sub', 'Aponte a câmera do celular (no dispositivo real) para abrir este conteúdo. No computador, use o botão abaixo.');
  const b = el('button', 'botoes b-verde', 'Abrir conteúdo nesta tela');
  m.corpo.append(cv, nota, b);
  qrDesenha(cv, 'kairos://' + (q.conteudo || q.id));
  b.addEventListener('click', () => {
    m.fechar();
    if (window.__escola && q.disciplinaId) {
      const sala = SALAS.find((s) => s.id === q.disciplinaId);
      if (sala) { window.__escola.irPara(sala.id); toast('Levando você até a sala de ' + sala.nome); }
      else toast('Conteúdo registrado');
    }
  });
}

// ---------- assistente IA (educador virtual) ----------
export function chatIA({ contexto = {}, falarNo3D = true } = {}) {
  const m = abrirModal({ titulo: 'Educador virtual', sub: contexto.disciplina ? `Aula de ${contexto.disciplina}` : 'Assistente da escola', largo: 480 });
  const lista = el('div', 'chat-lista ia-lista');
  const linha = el('div', 'chat-linha');
  const inp = el('input'); inp.type = 'text'; inp.placeholder = 'Pergunte qualquer coisa sobre a matéria…';
  const bEnviar = el('button', 'botoes', 'Perguntar');
  linha.append(inp, bEnviar);
  const dica = el('div', 'ia-dicas', '');
  for (const d of ['O que vamos estudar hoje?', 'Me dê um exemplo simples', 'Como vão minhas metas?']) {
    const b = el('button', 'botoes b-fantasma', d);
    b.addEventListener('click', () => { inp.value = d; enviar(); });
    dica.appendChild(b);
  }
  m.corpo.append(lista, dica, linha);

  let iaConfig = null;
  (async () => {
    iaConfig = await db.porId('ia', '1');
    if (!iaConfig) iaConfig = { metodologia: '', promptAdotado: '' };
    lista.appendChild(msgBloco('ia', ESCOLA.nome, 'Olá! Sou o educador virtual desta escola. ' + (contexto.disciplina ? `Estamos na sala de ${contexto.disciplina}.` : '') + ' Em que posso ajudar?'));
    if (ESCOLA.tutorUrl) {
      const link = el('p', 'sub', 'Tutor online configurado: o modo completo abre o roboAlotv.php com a matéria certa.');
      const bTutor = el('button', 'botoes b-destaque', 'Abrir tutor online completo');
      bTutor.addEventListener('click', () => {
        const alvo = ESCOLA.tutorUrl + (ESCOLA.tutorUrl.includes('?') ? '&' : '?') + 'disciplina=' + encodeURIComponent(contexto.disciplina || '');
        window.open(alvo, '_blank');
      });
      lista.appendChild(link);
      lista.appendChild(bTutor);
    }
  })();

  function msgBloco(quem, autor, texto) {
    const b = el('div', 'chat-bloco ' + (quem === 'eu' ? 'minha' : ''));
    if (quem !== 'eu') b.appendChild(el('div', 'chat-rotulo', autor));
    b.appendChild(el('div', 'chat-texto', texto));
    return b;
  }

  function responder(pergunta) {
    const p = pergunta.toLowerCase();
    if (/^(oi|ol[aá]|bom dia|boa tarde|boa noite)/.test(p))
      return 'Olá! Que bom te ver aqui na ' + (contexto.disciplina ? 'sala de ' + contexto.disciplina : 'escola') + '. Posso explicar a matéria, mostrar exercícios ou contar como estão suas metas. O que prefere?';
    if (p.includes('meta'))
      return 'As suas metas ficam na Minha área → Metas: cada uma mostra concluída ou pendente. Acerte os exercícios desta sala que elas avançam sozinhas. Quer tentar os exercícios?';
    if (p.includes('nota') || p.includes('boletim'))
      return 'Suas notas ficam na Minha área → Boletim, separadas por disciplina, com a média calculada. Se aparecer algo em vermelho, é a matéria para atacar agora. Posso te levar aos exercícios dela?';
    if (p.includes('exemplo') || p.includes('explic'))
      return contexto.explicacao || 'Um exemplo simples: comece pelo conceito menor, aplique em um caso do dia a dia e depois faça um exercício sozinho. Na TV desta sala tem vídeo com mais detalhes, e no botão Exercícios você prova na hora.';
    if (p.includes('hoje') || p.includes('estud'))
      return 'Hoje, aqui na ' + (contexto.disciplina ? 'sala de ' + contexto.disciplina : 'escola') + ', o plano é: 1) assista o trecho do vídeo na TV, 2) faça os 3 exercícios, 3) anote no botão Anotações o que ficou difícil. Aí sua meta avança.';
    if (p.includes('obrigad'))
      return 'Por nada! Estou sempre por perto neste corredor. Qualquer dúvida, me chame de novo.';
    const base = (iaConfig && iaConfig.promptAdotado) ? iaConfig.promptAdotado : 'Explique de forma simples, como se tivesse 10 anos.';
    return `Boa pergunta! Meu jeito de ensinar: ${base} Sobre "${pergunta.slice(0, 60)}": vou por partes — primeiro o conceito, depois um exemplo real e por fim um exercício. Use o botão Exercícios desta sala para praticar.`;
  }

  async function enviar() {
    const texto = inp.value.trim();
    if (!texto) return;
    inp.value = '';
    lista.appendChild(msgBloco('eu', 'Você', texto));
    lista.scrollTop = lista.scrollHeight;
    const pensando = msgBloco('ia', 'Educador', 'pensando…');
    lista.appendChild(pensando);
    setTimeout(() => {
      const resp = responder(texto);
      pensando.replaceWith(msgBloco('ia', 'Educador', resp));
      lista.scrollTop = lista.scrollHeight;
      if (falarNo3D) falar(resp, iaConfig?.voz);
    }, 700);
  }
  bEnviar.addEventListener('click', enviar);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); });
  inp.focus();
  return m;
}
