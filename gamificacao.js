// Gamificação da escola: XP, níveis, medalhas e missões diárias.
// Tudo persiste em 'jogo' (dados.js) com gravação em lote (1 put a cada ~700 ms).
import { db } from './dados.js';
import { toast } from './telas.js';

const NIVEIS = [
  [0, 'Calouro'],
  [50, 'Matriculado'],
  [150, 'Estudante Aplicado'],
  [300, 'Monitor da Sala'],
  [500, 'Aluno Destaque'],
  [800, 'Embaixador da Escola'],
];
const MEDALHAS = [
  ['primeiro-acerto', '🎯 Primeiro acerto', (s) => s.acertosTotais >= 1],
  ['explorador', '🏃 Explorador — 6 salas visitadas', (s) => Object.keys(s.salasVisitadas).length >= 6],
  ['dedicado', '🔥 Dedicado — 10 acertos', (s) => s.acertosTotais >= 10],
  ['assistente', '📺 Assistiu a uma aula em vídeo', (s) => !!s.assistiuVideo],
  ['conectado', '💬 Conectado — interagiu na escola', (s) => s.interacoesTot >= 1],
  ['colecionador', '📷 Colecionador — abriu um QR code', (s) => !!s.abriuQr],
  ['comprador', '🛒 Comprou um curso de reforço', (s) => !!s.comprou],
  ['social', '📞 Fez uma ligação de voz', (s) => !!s.ligou],
];
const MISSOES = [
  ['visitas', 'Visite 2 salas', 2, 40],
  ['questoes', 'Responda 4 questões', 4, 40],
  ['interacoes', 'Interaja 1 vez (chat, educador, QR ou ligação)', 1, 30],
];
const hoje = () => new Date().toISOString().slice(0, 10);

function padrao() {
  return { id: '1', xp: 0, medalhas: [], salasVisitadas: {}, dia: '', acertosTotais: 0, interacoesTot: 0, assistiuVideo: false, abriuQr: false, comprou: false, ligou: false, missoes: { dia: '', visitas: 0, questoes: 0, interacoes: 0, ganhos: [] } };
}
let memoria = null;
export async function estadoJogo() {
  if (memoria) return memoria;
  const r = await db.porId('jogo', '1');
  memoria = { ...padrao(), ...(r || {}), missoes: { ...padrao().missoes, ...(r && r.missoes ? r.missoes : {}) } };
  return memoria;
}
let salvando = null;
function agendaSalvamento() {
  if (salvando || !memoria) return;
  salvando = setTimeout(() => {
    salvando = null;
    const s = memoria;
    db.salva('jogo', s).catch(() => {});
  }, 700);
}

export const nivelAtual = (xp) => {
  let i = 0;
  for (let k = 0; k < NIVEIS.length; k++) if (xp >= NIVEIS[k][0]) i = k;
  const atual = NIVEIS[i], prox = NIVEIS[i + 1];
  const pct = prox ? Math.min(100, Math.round(((xp - atual[0]) / (prox[0] - atual[0])) * 100)) : 100;
  return { indice: i + 1, nome: atual[1], pct, faltam: prox ? prox[0] - xp : 0 };
};

// ---------- efeitos ----------
let ctxAudio = null;
function nota(f, t0, dur = 0.12, vol = 0.05) {
  try {
    ctxAudio = ctxAudio || new (window.AudioContext || window.webkitAudioContext)();
    if (ctxAudio.state === 'suspended') ctxAudio.resume();
    const o = ctxAudio.createOscillator(), g = ctxAudio.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(vol, ctxAudio.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(0.0001, ctxAudio.currentTime + t0 + dur);
    o.connect(g).connect(ctxAudio.destination);
    o.start(ctxAudio.currentTime + t0); o.stop(ctxAudio.currentTime + t0 + dur + 0.03);
  } catch {}
}
const somCerto = () => { nota(660, 0); nota(880, 0.1); };
const somErrado = () => nota(240, 0, 0.14, 0.035);
const somNivel = () => { [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.11, 0.16)); };
const somMedalha = () => { [784, 988, 1175].forEach((f, i) => nota(f, i * 0.09, 0.14)); };

let fxCanvas = null;
function confete() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    if (!fxCanvas) { fxCanvas = document.createElement('canvas'); fxCanvas.className = 'fx-confete'; document.body.appendChild(fxCanvas); }
    const c = fxCanvas, ctx = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    const cores = ['#f2c230', '#0f6e8c', '#2f6fd6', '#15803d', '#c2410c', '#6d28d9'];
    const ps = Array.from({ length: 70 }, () => ({
      x: innerWidth / 2, y: innerHeight * 0.55,
      vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 3,
      cor: cores[(Math.random() * cores.length) | 0], tam: 4 + Math.random() * 5, gir: Math.random() * 6,
    }));
    const t0 = performance.now();
    (function passoFx() {
      const t = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of ps) {
        p.vy += 0.5; p.x += p.vx; p.y += p.vy; p.gir += 0.2;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.gir);
        ctx.globalAlpha = Math.max(0, 1 - t / 1.5);
        ctx.fillStyle = p.cor; ctx.fillRect(-p.tam / 2, -p.tam / 2, p.tam, p.tam);
        ctx.restore();
      }
      if (t < 1.5) requestAnimationFrame(passoFx); else ctx.clearRect(0, 0, c.width, c.height);
    })();
  } catch {}
}

// ---------- núcleo ----------
// Um único ponto de registro: passa o que aconteceu e recebe XP, missões, medalhas.
export async function registra(opts = {}) {
  const { visita = 0, acertou = null, concluiu = 0, assistiu = 0, qr = 0, compra = 0, ligacao = 0, chat = 0, tutor = 0, salaId = '' } = opts;
  try {
    const s = await estadoJogo();
    const nivelAntes = nivelAtual(s.xp || 0).indice;
    if (!s.missoes || s.missoes.dia !== hoje()) s.missoes = { dia: hoje(), visitas: 0, questoes: 0, interacoes: 0, ganhos: [] };
    const avisos = [];

    if (visita && salaId && s.salasVisitadas[salaId] !== hoje()) { s.salasVisitadas[salaId] = hoje(); s.xp = (s.xp || 0) + 15; s.missoes.visitas++; }
    if (acertou !== null) {
      s.acertosTotais = (s.acertosTotais || 0) + (acertou ? 1 : 0);
      s.xp += acertou ? 10 : 2; s.missoes.questoes++;
      avisos.push(acertou ? '+10 · acerto' : '+2 · participação');
      if (acertou) somCerto(); else somErrado();
    }
    if (concluiu) { s.xp += 20; avisos.push('+20 · exercícios concluídos'); }
    if (assistiu && !s.assistiuVideo) { s.assistiuVideo = true; s.xp += 20; avisos.push('+20 · assistiu à aula'); }
    if (qr) {
      const primeira = !s.abriuQr;
      s.abriuQr = true; s.xp += 20; s.interacoesTot = (s.interacoesTot || 0) + 1; s.missoes.interacoes++;
      if (primeira) avisos.push('+20 · material aberto pelo QR');
    }
    if (compra && !s.comprou) { s.comprou = true; s.xp += 30; avisos.push('+30 · reforço adquirido'); }
    if (ligacao) { s.ligou = true; s.xp += 15; s.interacoesTot++; s.missoes.interacoes++; avisos.push('+15 · ligação de voz'); }
    if (chat) { s.interacoesTot++; s.xp += 10; s.missoes.interacoes++; avisos.push('+10 · mensagem enviada'); }
    if (tutor) { s.interacoesTot++; s.xp += 10; s.missoes.interacoes++; avisos.push('+10 · conversa com o educador'); }

    for (const [chave, nome, meta, bonus] of MISSOES) {
      if (s.missoes[chave] >= meta && !s.missoes.ganhos.includes(chave)) {
        s.missoes.ganhos.push(chave); s.xp += bonus;
        toast(`✅ Missão cumprida: ${nome} (+${bonus} xp)`);
      }
    }
    for (const [id, nome, cond] of MEDALHAS) {
      if (!s.medalhas.includes(id) && cond(s)) { s.medalhas.push(id); toast(`🏅 Nova medalha: ${nome}`); somMedalha(); }
    }
    if ((s.xp || 0) > 0) agendaSalvamento();
    if (avisos.length) {
      toast(avisos.join('  ·  '));
      const nv = nivelAtual(s.xp);
      if (nv.indice > nivelAntes) { toast(`🎉 Você subiu de nível: ${nv.nome}`); confete(); somNivel(); }
      atualizaHud();
    }
  } catch (e) { console.warn('gamificacao:', e && e.message); }
}

// atalhos legíveis para os módulos
export const registrarVisita = (salaId) => { void registra({ visita: 1, salaId }); };
export const registrarQuestao = (acertou) => { void registra({ acertou: !!acertou }); };
export const registrarConclusao = () => { void registra({ concluiu: 1 }); };
export const registrarVideo = () => { void registra({ assistiu: 1 }); };
export const registrarQr = () => { void registra({ qr: 1 }); };
export const registrarCompra = () => { void registra({ compra: 1 }); };
export const registrarLigacao = () => { void registra({ ligacao: 1 }); };
export const registrarChat = () => { void registra({ chat: 1 }); };
export const registrarTutor = () => { void registra({ tutor: 1 }); };

// ---------- HUD (fica no topo, ao lado do placar) ----------
export function iniciaHud(topoEl) {
  const hud = document.createElement('div');
  hud.className = 'jogo-hud';
  hud.innerHTML = `<span class="nivel">🎓 Calouro</span><div class="barra"><i></i></div><b class="xp">0</b><span class="selo-medalhas">🏅 0/8</span>`;
  topoEl.appendChild(hud);
  hud.__atualiza = atualizaHud;
  atualizaHud();
}
export async function atualizaHud() {
  const hud = document.querySelector('.jogo-hud');
  if (!hud) return;
  try {
    const s = await estadoJogo();
    const nv = nivelAtual(s.xp || 0);
    hud.querySelector('.nivel').textContent = `🎓 ${nv.nome}`;
    hud.querySelector('.nivel').title = nv.faltam ? `${nv.faltam} xp para o próximo nível` : 'Nível máximo alcançado';
    hud.querySelector('.barra i').style.width = nv.pct + '%';
    hud.querySelector('.xp').textContent = String(s.xp || 0);
    const m = hud.querySelector('.selo-medalhas');
    m.textContent = `🏅 ${(s.medalhas || []).length}/${MEDALHAS.length}`;
    m.title = MEDALHAS.filter(([id]) => (s.medalhas || []).includes(id)).map(([, n]) => n).join('\n') || 'Nenhuma medalha ainda — explore a escola!';
  } catch {}
}

window.__jogo = { estadoJogo, registra, nivelAtual, NIVEIS, MEDALHAS, MISSOES };
