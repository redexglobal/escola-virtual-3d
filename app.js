import * as THREE from 'three';
import { ESCOLA, SALAS, AUTORIA } from './conteudo.js';
import { garantirDados, db } from './dados.js';
import { estadoApp } from './telas.js';
import { minhaArea } from './modulo-aluno.js';
import { secretaria } from './modulo-secretaria.js';
import { aoVivo, mensageiro, feira, bibliotecaQr, chatIA } from './modulo-escola.js';

// ---------- Planta da escola (metros) ----------
const ALT = 3.6;            // pé-direito
const CW = 3;               // meia largura do corredor
const Z_FIM = -50;          // fim do corredor
const HALL = { x0: -9, x1: 9, z0: 0, z1: 10 };
const SALA_P = 12;          // profundidade (x) e largura (z) da sala
const PORTA = 1.2;          // meia largura da porta
const R = 0.35;             // raio do visitante
const OLHO = 1.6;
const reduzMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (id) => document.getElementById(id);
const salaRect = (s) => {
  const xa = s.lado * CW, xb = s.lado * (CW + SALA_P);
  return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: s.z - SALA_P / 2, z1: s.z + SALA_P / 2 };
};

// ---------- Interface básica ----------
$('nomeEscola').textContent = ESCOLA.nome;
$('subEscola').textContent = ESCOLA.subtitulo;
document.title = ESCOLA.nome + ' 3D';
$('credito').innerHTML = `Desenvolvido por ${AUTORIA.nome} · <a href="${AUTORIA.instagram}" target="_blank" rel="noopener">${AUTORIA.empresa}</a> · <a href="${AUTORIA.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>`;

// ---------- Renderizador ----------
const canvas = $('cena');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('semWebgl').hidden = false;
  $('btnEntrar').textContent = 'Indisponível';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfdbe4');
scene.fog = new THREE.Fog('#cfdbe4', 30, 75);
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);

scene.add(new THREE.HemisphereLight('#ffffff', '#b9c2c9', 2.0));
scene.add(new THREE.AmbientLight('#ffffff', 0.7));
const sol = new THREE.DirectionalLight('#fff6e8', 1.1);
sol.position.set(6, 12, 4);
scene.add(sol);

function redimensiona() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 80 : 70;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensiona);
redimensiona();

// ---------- Utilidades de geometria ----------
const matCache = new Map();
const mat = (cor, extra = {}) => {
  const k = cor + JSON.stringify(extra);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color: cor, ...extra }));
  return matCache.get(k);
};
const bloqueios = []; // caixas que o visitante não atravessa (x0,x1,z0,z1)

function caixa(x0, x1, y0, y1, z0, z1, material, bloqueia = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), material);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  scene.add(m);
  if (bloqueia) bloqueios.push({ x0, x1, z0, z1 });
  return m;
}
const parede = (x0, x1, z0, z1, cor = '#ece8e1') => caixa(x0, x1, 0, ALT, z0, z1, mat(cor));
const piso = (x0, x1, z0, z1, cor) => caixa(x0, x1, -0.1, 0, z0, z1, mat(cor));
const matTeto = new THREE.MeshBasicMaterial({ color: '#e9ecea' });
const teto = (x0, x1, z0, z1) => caixa(x0, x1, ALT, ALT + 0.1, z0, z1, matTeto);

function texturaCanvas(w, h, desenha) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  desenha(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { tex: t, canvas: c };
}
function placa(largura, altura, tex, x, y, z, rotY) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  scene.add(m);
  return m;
}
const olhaPara = (lado) => (lado === -1 ? Math.PI / 2 : -Math.PI / 2); // plano voltado para dentro da sala

function quebraTexto(ctx, texto, x, y, larg, linha) {
  const palavras = texto.split(' ');
  let l = '';
  for (const p of palavras) {
    const t = l ? l + ' ' + p : p;
    if (ctx.measureText(t).width > larg && l) { ctx.fillText(l, x, y); l = p; y += linha; } else l = t;
  }
  ctx.fillText(l, x, y);
}

// ---------- Recepção e corredor ----------
const E = 0.15; // espessura de parede
piso(HALL.x0, HALL.x1, HALL.z0, HALL.z1, '#c9c2b6');
teto(HALL.x0, HALL.x1, HALL.z0, HALL.z1);
parede(HALL.x0, HALL.x1, HALL.z1, HALL.z1 + E);
parede(HALL.x0 - E, HALL.x0, HALL.z0, HALL.z1);
parede(HALL.x1, HALL.x1 + E, HALL.z0, HALL.z1);
parede(HALL.x0, -CW, -E, 0);
parede(CW, HALL.x1, -E, 0);
caixa(-CW, CW, 3.0, ALT, -E, 0, mat('#ece8e1'));

piso(-CW, CW, Z_FIM, 0, '#d9d6cf');
caixa(-0.9, 0.9, 0, 0.005, Z_FIM, 0, mat('#b9c7d1')); // faixa central do corredor
teto(-CW, CW, Z_FIM, 0);
parede(-CW, CW, Z_FIM - E, Z_FIM);

// Luminárias do teto
for (let z = -3; z > Z_FIM; z -= 6) caixa(-0.6, 0.6, ALT - 0.04, ALT, z - 1, z + 1, mat('#ffffff', { emissive: '#fffbe8' }));

// Paredes laterais do corredor, com vão de porta em cada sala
for (const lado of [-1, 1]) {
  const portas = SALAS.filter((s) => s.lado === lado).map((s) => s.z).sort((a, b) => b - a);
  let zTopo = 0;
  const x0 = lado === -1 ? -CW - E : CW, x1 = x0 + E;
  for (const zp of portas) {
    parede(x0, x1, zp + PORTA, zTopo, '#ece8e1');
    caixa(x0, x1, 2.4, ALT, zp - PORTA, zp + PORTA, mat('#ece8e1')); // verga
    zTopo = zp - PORTA;
  }
  parede(x0, x1, Z_FIM, zTopo, '#ece8e1');
  // rodapé colorido do corredor
  const xr = lado === -1 ? -CW : CW - 0.02;
  caixa(xr, xr + 0.02, 0, 1.0, Z_FIM, 0, mat('#0f6e8c'));
}

// Armários entre as salas
for (const lado of [-1, 1]) {
  for (const [za, zb] of [[-18, -14], [-34, -30]]) {
    const xa = lado === -1 ? -CW : CW - 0.45, xb = xa + 0.45;
    for (let z = zb; z > za; z -= 0.8) {
      const m = caixa(xa, xb, 0, 1.9, z - 0.78, z - 0.02, mat(lado === -1 ? '#3f7fa0' : '#c96f3b'), true);
      m.userData.armario = true;
    }
  }
}

// Letreiro na entrada e painel no fim do corredor
{
  const { tex } = texturaCanvas(1024, 160, (c, w, h) => {
    c.fillStyle = '#10202e'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = '700 76px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(ESCOLA.nome, w / 2, h / 2);
  });
  placa(5.6, 0.56, tex, 0, 3.3, 0.01, 0);
}
{
  const { tex } = texturaCanvas(1024, 576, (c, w, h) => {
    c.fillStyle = '#10202e'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#7dd3e8'; c.font = '700 34px system-ui, sans-serif'; c.fillText('MAPA DAS SALAS', 56, 80);
    c.fillStyle = '#fff'; c.font = '700 60px system-ui, sans-serif'; c.fillText(ESCOLA.nome, 56, 150);
    c.font = '500 34px system-ui, sans-serif';
    SALAS.forEach((s, i) => {
      const y = 230 + Math.floor(i / 2) * 100, x = i % 2 ? 540 : 56;
      c.fillStyle = s.cor; c.beginPath(); c.arc(x + 14, y - 12, 14, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.fillText((s.lado === -1 ? '← ' : '→ ') + s.nome, x + 42, y);
    });
  });
  placa(5.2, 2.92, tex, 0, 1.9, Z_FIM + 0.01, 0);
}

// ---------- Salas ----------
const estadoSalas = new Map();

function criaEducador(s) {
  const g = new THREE.Group();
  const pele = mat('#c58c64'), roupa = mat(s.cor), calca = mat('#2b3440');
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.13, 0.13, 0.85, 12), calca, -0.13, 0.43, 0);
  add(new THREE.CylinderGeometry(0.13, 0.13, 0.85, 12), calca, 0.13, 0.43, 0);
  add(new THREE.CylinderGeometry(0.27, 0.3, 0.75, 16), roupa, 0, 1.22, 0);
  add(new THREE.SphereGeometry(0.2, 20, 16), pele, 0, 1.78, 0);
  add(new THREE.SphereGeometry(0.205, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2.2), mat('#2a1d16'), 0, 1.8, -0.01); // cabelo
  for (const ox of [-0.075, 0.075]) add(new THREE.SphereGeometry(0.028, 8, 8), mat('#10202e'), ox, 1.8, 0.18); // olhos
  // braços com pivô no ombro
  const braco = (lado) => {
    const pivo = new THREE.Group();
    pivo.position.set(lado * 0.36, 1.52, 0);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.7, 10), roupa);
    b.position.y = -0.33;
    const mao = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), pele);
    mao.position.y = -0.7;
    pivo.add(b, mao);
    pivo.rotation.z = lado * 0.08;
    g.add(pivo);
    return pivo;
  };
  braco(-1);
  const direito = braco(1);
  // crachá
  const { tex } = texturaCanvas(256, 96, (c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#10202e';
    c.font = '700 34px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Educador', w / 2, h / 2);
  });
  const cracha = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.1), new THREE.MeshBasicMaterial({ map: tex }));
  cracha.position.set(0.1, 1.38, 0.3);
  g.add(cracha);
  return { grupo: g, braco: direito };
}

function desenhaTv(ctx, w, h, s, msg) {
  ctx.fillStyle = '#0b1620'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = s.cor; ctx.fillRect(0, 0, w, 14);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = '700 54px system-ui'; ctx.fillText('Aula de ' + s.nome, w / 2, h / 2 - 30);
  ctx.fillStyle = '#c4d3de'; ctx.font = '400 30px system-ui';
  quebraTexto(ctx, msg, w / 2, h / 2 + 34, w - 120, 40);
}

for (const s of SALAS) {
  const r = salaRect(s);
  const L = s.lado;
  const tom = new THREE.Color(s.cor).lerp(new THREE.Color('#ffffff'), 0.78);
  piso(r.x0, r.x1, r.z0, r.z1, '#' + tom.getHexString());
  teto(r.x0, r.x1, r.z0, r.z1);
  // paredes: fundo (lado externo) e as duas laterais
  const xe = L * (CW + SALA_P);
  parede(Math.min(xe, xe + L * E), Math.max(xe, xe + L * E), r.z0, r.z1);
  parede(r.x0, r.x1, r.z1, r.z1 + E);
  parede(r.x0, r.x1, r.z0 - E, r.z0);
  // faixa de cor da matéria nas paredes laterais
  caixa(r.x0, r.x1, 1.0, 1.15, r.z1 - 0.01, r.z1, mat(s.cor));
  caixa(r.x0, r.x1, 1.0, 1.15, r.z0, r.z0 + 0.01, mat(s.cor));
  for (const dz of [-3, 3]) for (const dx of [6, 10]) caixa(L * dx - 0.9, L * dx + 0.9, ALT - 0.04, ALT, s.z + dz - 0.5, s.z + dz + 0.5, mat('#ffffff', { emissive: '#fffbe8' }));

  // placa da porta no corredor
  const { tex: texPorta } = texturaCanvas(512, 128, (c, w, h) => {
    c.fillStyle = s.cor; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = '700 58px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.nome, w / 2, h / 2 + 2);
  });
  placa(2.0, 0.5, texPorta, L * (CW - 0.01), 2.85, s.z, olhaPara(L));
  // batente da porta
  for (const dz of [-PORTA, PORTA]) caixa(L * CW - 0.08, L * CW + 0.08, 0, 2.4, s.z + dz - 0.06, s.z + dz + 0.06, mat(s.cor));

  // quadro
  const xQ = xe - L * 0.03;
  const { tex: texQuadro } = texturaCanvas(1024, 410, (c, w, h) => {
    c.fillStyle = '#1f3b2f'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#8a6a45'; c.lineWidth = 18; c.strokeRect(9, 9, w - 18, h - 18);
    c.fillStyle = '#f2f5ef'; c.font = '700 70px system-ui'; c.fillText(s.nome, 60, 120);
    c.font = '400 42px system-ui'; c.fillStyle = '#d9e6d5'; c.fillText('Tema: ' + s.tema, 60, 200);
    c.font = '400 34px system-ui'; c.fillStyle = '#ffe9a8';
    c.fillText(s.exercicios.length + ' exercícios: toque em "Fazer exercício"', 60, 300);
  });
  placa(6, 2.4, texQuadro, xQ, 1.9, s.z, olhaPara(L));
  // mesa do professor
  caixa(L * 13.2 - 0.6, L * 13.2 + 0.6, 0, 0.78, s.z - 3.6, s.z - 2.0, mat('#7a5a3c'), true);

  // TV com a aula em vídeo, na parede lateral
  const zTv = r.z0 + 0.03;
  const tv = texturaCanvas(1024, 576, (c, w, h) => desenhaTv(c, w, h, s, 'Toque em "Assistir aula"'));
  caixa(L * 9 - 2.15, L * 9 + 2.15, 0.85, 3.15, r.z0, r.z0 + 0.06, mat('#111'));
  const telaTv = placa(4, 2.25, tv.tex, L * 9, 2.0, zTv + 0.04, 0);

  // carteiras (3 x 3) voltadas para o quadro
  for (const dx of [6.5, 8.5, 10.5]) {
    for (const dz of [-1.5, 0.9, 3.3]) {
      const x = L * dx, z = s.z + dz;
      caixa(x - 0.35, x + 0.35, 0.7, 0.75, z - 0.5, z + 0.5, mat('#b8895b'), true);
      caixa(x - 0.3, x + 0.3, 0, 0.7, z - 0.04, z + 0.04, mat('#5b6670'));
      caixa(x - L * 0.75 - 0.25, x - L * 0.75 + 0.25, 0.42, 0.47, z - 0.25, z + 0.25, mat(s.cor)); // assento
    }
  }

  // educador virtual
  const edu = criaEducador(s);
  edu.grupo.position.set(L * 12.6, 0, s.z + 3.6);
  edu.grupo.rotation.y = olhaPara(L);
  scene.add(edu.grupo);
  bloqueios.push({ x0: L * 12.6 - 0.4, x1: L * 12.6 + 0.4, z0: s.z + 3.2, z1: s.z + 4.0 });

  estadoSalas.set(s.id, { s, r, edu, tv, telaTv, video: null, acenou: false, aceno: -1 });
}

// ---------- Movimento e colisão ----------
const andaveis = [
  { x0: HALL.x0 + R, x1: HALL.x1 - R, z0: HALL.z0 + R, z1: HALL.z1 - R },
  { x0: -CW + R, x1: CW - R, z0: Z_FIM + R, z1: 0.6 },
  ...SALAS.flatMap((s) => {
    const r = salaRect(s);
    return [
      { x0: r.x0 + R, x1: r.x1 - R, z0: r.z0 + R, z1: r.z1 - R },
      { x0: s.lado * CW - R - 0.2, x1: s.lado * CW + R + 0.2, z0: s.z - PORTA + R, z1: s.z + PORTA - R },
    ].map((q) => ({ ...q, x0: Math.min(q.x0, q.x1), x1: Math.max(q.x0, q.x1) }));
  }),
];
function livre(x, z) {
  if (!andaveis.some((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1)) return false;
  return !bloqueios.some((b) => x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R);
}

const eu = { x: 0, z: 7, yaw: 0, pitch: -0.05 };
const teclas = new Set();
const joy = { x: 0, y: 0 };
let rota = null; // caminho automático
let pausado3d = false; // true enquanto um painel 2D está aberto

function salaEm(x, z) {
  for (const st of estadoSalas.values()) {
    const r = st.r;
    if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return st;
  }
  return null;
}

function irPara(id) {
  const st = estadoSalas.get(id);
  const pontos = [];
  const atual = salaEm(eu.x, eu.z);
  if (atual) pontos.push({ x: atual.s.lado * (CW + 0.8), z: atual.s.z }, { x: 0, z: atual.s.z });
  else if (eu.z > 0.3) pontos.push({ x: 0, z: 0.3 });
  else pontos.push({ x: 0, z: eu.z });
  if (!st) {
    pontos.push({ x: 0, z: 0.3 }, { x: 0, z: 6 });
    rota = { pontos, yawFinal: 0 };
    return;
  }
  const L = st.s.lado;
  pontos.push({ x: 0, z: st.s.z }, { x: L * (CW + 1.2), z: st.s.z }, { x: L * 5, z: st.s.z });
  rota = { pontos, yawFinal: L * Math.PI / 2 }; // de frente para o quadro
}

// teclado
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('.modal')) return;
  teclas.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => teclas.delete(e.code));
addEventListener('blur', () => teclas.clear());

// olhar arrastando
let arrasto = null;
canvas.addEventListener('pointerdown', (e) => { arrasto = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!arrasto || arrasto.id !== e.pointerId) return;
  const k = e.pointerType === 'touch' ? 0.006 : 0.004;
  eu.yaw += (e.clientX - arrasto.x) * k;
  eu.pitch = THREE.MathUtils.clamp(eu.pitch + (e.clientY - arrasto.y) * k, -0.9, 0.9);
  arrasto.x = e.clientX; arrasto.y = e.clientY;
  rota = null;
});
const soltaArrasto = (e) => { if (arrasto && arrasto.id === e.pointerId) arrasto = null; };
canvas.addEventListener('pointerup', soltaArrasto);
canvas.addEventListener('pointercancel', soltaArrasto);

// joystick
const jEl = $('joystick'), manete = $('manete');
let jId = null;
function moveJoy(e) {
  const b = jEl.getBoundingClientRect();
  let dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
  const max = b.width / 2 - 10, d = Math.hypot(dx, dy);
  if (d > max) { dx *= max / d; dy *= max / d; }
  joy.x = dx / max; joy.y = -dy / max;
  manete.style.transform = `translate(${dx}px,${dy}px)`;
}
jEl.addEventListener('pointerdown', (e) => { jId = e.pointerId; jEl.setPointerCapture(jId); moveJoy(e); rota = null; });
jEl.addEventListener('pointermove', (e) => { if (e.pointerId === jId) moveJoy(e); });
const soltaJoy = (e) => { if (e.pointerId !== jId) return; jId = null; joy.x = joy.y = 0; manete.style.transform = ''; };
jEl.addEventListener('pointerup', soltaJoy);
jEl.addEventListener('pointercancel', soltaJoy);

// ---------- Voz do educador ----------
let vozPt = null;
function escolheVoz() {
  const vs = speechSynthesis.getVoices();
  vozPt = vs.find((v) => /pt[-_]BR/i.test(v.lang)) || vs.find((v) => /^pt/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { escolheVoz(); speechSynthesis.onvoiceschanged = escolheVoz; }
function fala(texto) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'pt-BR'; if (vozPt) u.voice = vozPt; u.rate = 1.02;
  speechSynthesis.speak(u);
}

// ---------- Sala atual / ações ----------
let salaAtual = null;
function entrouEm(st) {
  salaAtual = st;
  $('nomeLocal').textContent = st ? st.s.nome : (eu.z > 0 ? 'Recepção' : 'Corredor');
  $('corLocal').style.background = st ? st.s.cor : '#94a3b8';
  menu.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.sala === (st ? st.s.id : '')));
  $('acoes').hidden = !st;
  for (const o of estadoSalas.values()) if (o !== st && o.video && !o.video.paused) o.video.pause();
  if (st && !st.acenou) {
    st.acenou = true;
    st.aceno = reduzMovimento ? -1 : performance.now(); // braço acena uma vez e depois fica parado
    fala(st.s.saudacao);
  }
}

function assistir() {
  const st = salaAtual; if (!st) return;
  if (!st.video) {
    const v = document.createElement('video');
    v.src = st.s.video; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.loop = false;
    v.addEventListener('error', () => {
      const c = st.tv.canvas.getContext('2d');
      desenhaTv(c, 1024, 576, st.s, `Vídeo da aula ainda não enviado. Coloque o arquivo em ${st.s.video}`);
      st.tv.tex.needsUpdate = true;
      st.semVideo = true;
    }, { once: true });
    v.addEventListener('playing', () => {
      const vt = new THREE.VideoTexture(v); vt.colorSpace = THREE.SRGBColorSpace;
      st.telaTv.material.map = vt; st.telaTv.material.needsUpdate = true;
    }, { once: true });
    st.video = v;
  }
  if (st.semVideo) return;
  window.speechSynthesis?.cancel();
  if (st.video.paused) st.video.play().catch(() => {}); else st.video.pause();
}

// exercícios
let acertos = 0;
const exModal = $('modalExercicio');
let exSala = null, exIdx = 0;
function abreModal(m) { m.hidden = false; teclas.clear(); m.querySelector('[data-fechar]').focus(); }
function fechaModais() { document.querySelectorAll('.modal').forEach((m) => (m.hidden = true)); }
document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fechaModais));
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) fechaModais(); }));
addEventListener('keydown', (e) => { if (e.key === 'Escape') fechaModais(); });

function mostraQuestao() {
  const q = exSala.exercicios[exIdx];
  $('exMateria').textContent = exSala.nome;
  $('exTitulo').textContent = q.p;
  $('exProgresso').textContent = `Questão ${exIdx + 1} de ${exSala.exercicios.length}`;
  $('exExplica').hidden = true;
  $('exProxima').hidden = true;
  const box = $('exOpcoes'); box.innerHTML = '';
  q.o.forEach((txt, i) => {
    const b = document.createElement('button');
    b.textContent = txt;
    b.addEventListener('click', () => {
      box.querySelectorAll('button').forEach((x) => (x.disabled = true));
      box.children[q.c].classList.add('certo');
      if (i === q.c) { acertos++; $('placar').textContent = acertos; fala('Muito bem!'); }
      else { b.classList.add('errado'); fala('Quase. Veja a explicação.'); }
      $('exExplica').textContent = q.e; $('exExplica').hidden = false;
      const fim = exIdx === exSala.exercicios.length - 1;
      $('exProxima').textContent = fim ? 'Concluir' : 'Próxima';
      $('exProxima').hidden = false; $('exProxima').focus();
    });
    box.appendChild(b);
  });
}
$('exProxima').addEventListener('click', () => {
  if (exIdx < exSala.exercicios.length - 1) { exIdx++; mostraQuestao(); }
  else { fechaModais(); fala(`Você terminou os exercícios de ${exSala.nome}.`); }
});

$('btnVideo').addEventListener('click', assistir);
$('btnExercicio').addEventListener('click', () => { if (!salaAtual) return; exSala = salaAtual.s; exIdx = 0; mostraQuestao(); abreModal(exModal); });
$('btnEducador').addEventListener('click', () => {
  const corpo = $('educadorCorpo');
  if (ESCOLA.tutorUrl) {
    const u = new URL(ESCOLA.tutorUrl, location.href);
    if (salaAtual) u.searchParams.set('materia', salaAtual.s.id);
    corpo.innerHTML = '';
    const f = document.createElement('iframe');
    f.src = u.toString(); f.title = 'Educador virtual'; f.allow = 'microphone; autoplay';
    corpo.appendChild(f);
    abreModal($('modalEducador'));
  } else {
    // Tutor PHP ainda não ligado: o educador da própria escola responde e fala
    chatIA({
      contexto: {
        disciplina: salaAtual ? salaAtual.s.nome : '',
        explicacao: salaAtual ? salaAtual.s.tema : '',
      },
      falarNo3D: true,
    });
  }
});

// menu de salas
const menu = $('menuSalas');
const bRec = document.createElement('button');
bRec.innerHTML = '<span class="ponto"></span>Recepção';
bRec.dataset.sala = '';
bRec.addEventListener('click', () => irPara(null));
menu.appendChild(bRec);
for (const s of SALAS) {
  const b = document.createElement('button');
  b.dataset.sala = s.id;
  b.innerHTML = `<span class="ponto" style="background:${s.cor}"></span>${s.nome}`;
  b.addEventListener('click', () => irPara(s.id));
  menu.appendChild(b);
}

// ---------- Mapa ----------
const mapa = $('mapa'), mctx = mapa.getContext('2d');
const MX0 = -16, MX1 = 16, MZ0 = 11, MZ1 = -51;
function m2c(x, z) { return [((x - MX0) / (MX1 - MX0)) * mapa.width, ((MZ0 - z) / (MZ0 - MZ1)) * mapa.height]; }
function retMapa(r, cor) {
  const [a, b] = m2c(r.x0, r.z1), [c, d] = m2c(r.x1, r.z0);
  mctx.fillStyle = cor; mctx.fillRect(a, b, c - a, d - b);
}
function desenhaMapa() {
  mctx.clearRect(0, 0, mapa.width, mapa.height);
  retMapa({ x0: HALL.x0, x1: HALL.x1, z0: HALL.z0, z1: HALL.z1 }, '#cbd5dc');
  retMapa({ x0: -CW, x1: CW, z0: Z_FIM, z1: 0 }, '#dfe5ea');
  for (const st of estadoSalas.values()) retMapa(st.r, st === salaAtual ? st.s.cor : st.s.cor + '88');
  const [px, pz] = m2c(eu.x, eu.z);
  mctx.save(); mctx.translate(px, pz); mctx.rotate(Math.PI - eu.yaw);
  mctx.fillStyle = '#10202e'; mctx.beginPath(); mctx.moveTo(0, -8); mctx.lineTo(5, 5); mctx.lineTo(-5, 5); mctx.closePath(); mctx.fill();
  mctx.restore();
}
mapa.addEventListener('click', (e) => {
  const b = mapa.getBoundingClientRect();
  const x = MX0 + ((e.clientX - b.left) / b.width) * (MX1 - MX0);
  const z = MZ0 - ((e.clientY - b.top) / b.height) * (MZ0 - MZ1);
  const st = salaEm(x, z);
  if (st) irPara(st.s.id); else if (z > 0) irPara(null);
});

// ---------- Laço ----------
const relogio = new THREE.Clock();
const dir = new THREE.Vector3();
function passo() {
  const dt = Math.min(relogio.getDelta(), 0.05);
  const agora = performance.now();

  // caminho automático (pausa quando um painel 2D está aberto)
  if (!pausado3d && rota) {
    const alvo = rota.pontos[0];
    const dx = alvo.x - eu.x, dz = alvo.z - eu.z, d = Math.hypot(dx, dz);
    const v = 6 * dt;
    if (d <= v) { eu.x = alvo.x; eu.z = alvo.z; rota.pontos.shift(); }
    else {
      eu.x += (dx / d) * v; eu.z += (dz / d) * v;
      const yawAlvo = Math.atan2(dx, -dz);
      let dy = yawAlvo - eu.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      eu.yaw += dy * Math.min(1, dt * 6);
    }
    if (!rota.pontos.length) {
      let dy = rota.yawFinal - eu.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      eu.yaw += dy; rota = null;
    }
  } else if (!pausado3d) {
    let f = joy.y, l = joy.x;
    if (teclas.has('KeyW') || teclas.has('ArrowUp')) f += 1;
    if (teclas.has('KeyS') || teclas.has('ArrowDown')) f -= 1;
    if (teclas.has('KeyD')) l += 1;
    if (teclas.has('KeyA')) l -= 1;
    if (teclas.has('ArrowLeft')) eu.yaw -= 1.8 * dt;
    if (teclas.has('ArrowRight')) eu.yaw += 1.8 * dt;
    const n = Math.hypot(f, l);
    if (n > 0.05) {
      const k = Math.min(n, 1) / n, vel = (teclas.has('ShiftLeft') ? 5.5 : 3.4) * dt;
      const sx = Math.sin(eu.yaw), cz = Math.cos(eu.yaw);
      const mx = (sx * f + cz * l) * k * vel, mz = (-cz * f + sx * l) * k * vel;
      if (livre(eu.x + mx, eu.z)) eu.x += mx;
      if (livre(eu.x, eu.z + mz)) eu.z += mz;
    }
  }

  // aceno: uma vez ao entrar na sala, depois o braço fica parado
  for (const st of estadoSalas.values()) {
    if (st.aceno < 0) continue;
    const t = (agora - st.aceno) / 1000, D = 2.4;
    const braco = st.edu.braco;
    if (t >= D) { braco.rotation.set(0, 0, 0.08); st.aceno = -1; continue; }
    const sobe = Math.min(1, t / 0.4, (D - t) / 0.4);
    braco.rotation.z = 0.08 + sobe * 2.5 + (sobe >= 1 ? Math.sin((t - 0.4) * 9) * 0.35 : 0);
  }

  const st = salaEm(eu.x, eu.z);
  const nomeLugar = st ? st.s.nome : (eu.z > 0 ? 'Recepção' : 'Corredor');
  if (st !== salaAtual || $('nomeLocal').textContent !== nomeLugar) entrouEm(st);

  camera.position.set(eu.x, OLHO, eu.z);
  dir.set(Math.sin(eu.yaw) * Math.cos(eu.pitch), -Math.sin(eu.pitch), -Math.cos(eu.yaw) * Math.cos(eu.pitch));
  camera.lookAt(camera.position.x + dir.x, camera.position.y + dir.y, camera.position.z + dir.z);
  renderer.render(scene, camera);
  desenhaMapa();
  requestAnimationFrame(passo);
}

// ---------- Entrar ----------
const btn = $('btnEntrar');
(async () => {
  try {
    await Promise.race([garantirDados(), new Promise((r) => setTimeout(r, 6000))]); // nunca trava a entrada
    try {
      const s = await db.porId('config', 'sessao');
      if (s) { estadoApp.alunoId = s.alunoId || null; estadoApp.papel = s.papel || 'aluno'; }
    } catch {}
  } catch (e) { console.warn('Dados da escola não carregaram:', e); }
  btn.disabled = false;
  btn.textContent = 'Entrar na escola';
})();
btn.addEventListener('click', () => {
  $('entrada').hidden = true;
  ['topo', 'menuSalas', 'mapa', 'joystick', 'btnMenu'].forEach((id) => ($(id).hidden = false));
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) $('joystick').hidden = false;
  fala(`Bem-vindo à ${ESCOLA.nome}. Escolha uma sala para começar.`);
});
entrouEm(null);
requestAnimationFrame(passo);

// ---------- Menu dos módulos (painéis 2D sobre a cena) ----------
const btnMenu = $('btnMenu'), menuEscola = $('menuEscola');
const MODULOS = [
  ['👤 Minha área (aluno)', () => minhaArea({ falar: fala })],
  ['🏫 Secretaria (direção)', () => secretaria()],
  ['🔴 Ao vivo (aula + chat)', () => aoVivo()],
  ['💬 Mensageiro e ligação', () => mensageiro()],
  ['🛒 Feira de reforço', () => feira(estadoApp.alunoId)],
  ['📚 Biblioteca de QR codes', () => bibliotecaQr()],
];
function fechaMenuEscola() { menuEscola.hidden = true; btnMenu.setAttribute('aria-expanded', 'false'); }
for (const [nome, fn] of MODULOS) {
  const b = document.createElement('button');
  b.className = 'menu-item';
  b.textContent = nome;
  b.addEventListener('click', () => { fechaMenuEscola(); fn(); });
  menuEscola.appendChild(b);
}
btnMenu.addEventListener('click', (e) => {
  e.stopPropagation();
  const abrio = menuEscola.hidden;
  menuEscola.hidden = !abrio;
  btnMenu.setAttribute('aria-expanded', String(abrio));
});
document.addEventListener('click', (e) => {
  if (!menuEscola.hidden && !menuEscola.contains(e.target) && e.target !== btnMenu) fechaMenuEscola();
});

// para testes automáticos
window.__escola = {
  eu, irPara, pausar: (v) => { pausado3d = !!v; },
  estado: () => ({ sala: salaAtual?.s.id || null, x: eu.x, z: eu.z, acertos }),
};
