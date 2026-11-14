// Telas 2D que abrem sobre a cena 3D: painel com abas, tabelas, formulários e toasts.
// Todo módulo da plataforma (secretaria, minha área, ao vivo, feira…) é montado com essas peças,
// no mesmo padrão visual da escola.

const rootEl = document.querySelector('#painel');
export const estadoApp = {
  papel: 'aluno',       // aluno | responsavel | diretor
  alunoId: null,        // aluno "logado" na demonstração
  atualizaSalaAtual: null, // injetada pelo app.js
};

export const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined && html !== null) n.innerHTML = html;
  return n;
};

// ---------- Toast ----------
let toastTimer = null;
export function toast(texto) {
  const t = el('div', 'toast', '');
  t.textContent = texto;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 350); }, 2600);
}

// ---------- Painel com abas ----------
let painelAberto = null;

export function abrePainel(opcoes) {
  fechaPainel();
  const raiz = el('div', 'painel-card' + (opcoes.largo ? ' painel-largo' : ''));
  const topo = el('div', 'painel-topo');
  const titulo = el('h2', '', opcoes.titulo || '');
  const sub = opcoes.sub ? el('p', 'painel-sub', opcoes.sub) : null;
  const fechar = el('button', 'fechar', '×');
  fechar.setAttribute('aria-label', 'Fechar');
  fechar.addEventListener('click', fechaPainel);
  topo.append(titulo, sub, fechar);
  raiz.appendChild(topo);

  let barraAbas = null;
  const tabs = opcoes.tabs || [];
  let abaAtiva = opcoes.ativo && tabs.find((t) => t.id === opcoes.ativo) ? opcoes.ativo : (tabs[0] && tabs[0].id);

  const corpo = el('div', 'painel-corpo');

  function montaAbas() {
    if (!tabs.length) return;
    barraAbas = el('div', 'painel-abas');
    barraAbas.setAttribute('role', 'tablist');
    for (const t of tabs) {
      const b = el('button', 'painel-aba', t.nome);
      b.setAttribute('role', 'tab');
      b.dataset.tab = t.id;
      b.addEventListener('click', () => ativa(t.id));
      barraAbas.appendChild(b);
    }
    raiz.appendChild(barraAbas);
  }

  function ativa(id) {
    abaAtiva = id;
    if (barraAbas) for (const b of barraAbas.children) b.classList.toggle('ativa', b.dataset.tab === id);
    corpo.innerHTML = '';
    const t = tabs.find((x) => x.id === id);
    if (t && t.render) t.render(corpo);
    if (estadoApp.atualizaSalaAtual) estadoApp.atualizaSalaAtual();
  }

  montaAbas();
  raiz.appendChild(corpo); // corpo depois das abas: abas ficam logo abaixo do título
  rootEl.hidden = false;
  rootEl.innerHTML = '';
  rootEl.appendChild(raiz);
  document.body.classList.add('painel-aberto');
  window.__escola && window.__escola.pausar && window.__escola.pausar(true);
  requestAnimationFrame(() => {
    const f = raiz.querySelector('input,select,textarea,button.painel-aba');
    if (f && !fechar.contains(f)) try { f.focus({ preventScroll: true }); } catch (e) {}
  });
  ativa(abaAtiva);
  painelAberto = {
    abrir: (id) => ativa(id),
    fechar: fechaPainel,
    recarregar: () => ativa(abaAtiva),
    titulo, sub,
  };
  return painelAberto;
}

export function fechaPainel() {
  if (!rootEl.hidden) {
    rootEl.hidden = true;
    rootEl.innerHTML = '';
    painelAberto = null;
  }
  document.body.classList.remove('painel-aberto');
  window.__escola && window.__escola.pausar && window.__escola.pausar(false);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !rootEl.hidden) {
    const emForm = rootEl.querySelector('.form-aberto');
    if (emForm) { emForm.dispatchEvent(new CustomEvent('esc')); return; }
    fechaPainel();
  }
});
rootEl.addEventListener('click', (e) => { if (e.target === rootEl) fechaPainel(); });

// ---------- Modal genérico (ligação, QR, chat do educador…) ----------
export function abrirModal({ titulo = '', sub = '', largo = 520, corpos = [] } = {}) {
  const raiz = el('div', 'modal modal-din');
  raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-modal', 'true');
  const card = el('div', 'modal-card' + (largo > 560 ? ' modal-largo' : ''));
  card.style.maxWidth = largo + 'px';
  const cab = el('div', 'modal-cab');
  cab.appendChild(el('h2', '', titulo));
  if (sub) cab.appendChild(el('p', 'sub', sub));
  const fechar = el('button', 'fechar', '×');
  fechar.setAttribute('aria-label', 'Fechar');
  card.appendChild(fechar);
  const corpo = el('div', 'modal-corpo');
  for (const c of corpos) corpo.appendChild(c);
  card.appendChild(corpo);
  raiz.appendChild(card);
  document.body.appendChild(raiz);
  function fecharTudo() { raiz.remove(); }
  fechar.addEventListener('click', fecharTudo);
  raiz.addEventListener('click', (e) => { if (e.target === raiz) fecharTudo(); });
  const obs = (e) => { if (e.key === 'Escape') fecharTudo(); };
  addEventListener('keydown', obs);
  fecharTudo.onceObs = obs;
  // guarda para remover o listener de tecla quando fechar pelo próprio botão
  const orig = fecharTudo;
  raiz.addEventListener('remove', () => removeEventListener('keydown', obs), { once: true });
  return { corpo, modal: raiz, card, fechar: () => { removeEventListener('keydown', obs); raiz.remove(); } };
}

// ---------- Peças de tela ----------
export const vazio = (msg, dica) => {
  const n = el('div', 'vazio');
  n.appendChild(el('p', '', msg));
  if (dica) n.appendChild(el('p', 'vazio-dica', dica));
  return n;
};

export async function tabela(col, montar, { vazioMsg = 'Nada por aqui ainda.', botoesTopo = [] } = {}) {
  const linhas = await montar.lista();
  const n = el('div', 'tabela-wrap');
  if (botoesTopo.length) {
    const topo = el('div', 'tabela-topo');
    for (const b of botoesTopo) topo.appendChild(b);
    n.appendChild(topo);
  }
  if (!linhas.length) { n.appendChild(vazio(vazioMsg)); return n; }
  const t = el('table', 'tabela');
  if (montar.cabecalho) t.appendChild(montar.cabecalho());
  const tbody = el('tbody');
  for (const r of linhas) {
    const tr = el('tr');
    for (const c of montar.colunas) {
      const td = el('td', c.cls);
      const v = c.f ? c.f(r) : r[c.k];
      if (v instanceof Node) td.appendChild(v); else td.textContent = v ?? '';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  t.appendChild(tbody);
  n.appendChild(t);
  return n;
}

// Form simplificado: campos serializados. onOk recebe objeto {campo: valor}
export function form({ titulo, campos, valores = {}, botaoOk = 'Salvar', onOk, onCancelar }) {
  const wrap = el('div', 'form-wrap form-aberto');
  if (titulo) wrap.appendChild(el('h3', '', titulo));
  const f = el('form', 'form');
  const mapa = {};
  for (const c of campos) {
    const div = el('label', 'campo');
    div.appendChild(el('span', 'campo-rot', c.label));
    let input;
    if (c.tipo === 'area') { input = el('textarea'); input.rows = c.linhas || 4; }
    else if (c.tipo === 'selecao') {
      input = el('select');
      for (const op of c.opcoes || []) { const o = el('option', '', op.t); o.value = op.v; input.appendChild(o); }
      if (c.vazioOpcao) input.insertBefore(el('option', '', c.vazioOpcao), input.firstChild);
    } else if (c.tipo === 'multi') {
      input = el('select'); input.multiple = true; input.size = Math.min(4, (c.opcoes || []).length || 1);
      for (const op of c.opcoes || []) { const o = el('option', '', op.t); o.value = op.v; input.appendChild(o); }
    } else if (c.tipo === 'arquivo') {
      input = el('input'); input.type = 'file'; input.accept = c.accept || 'image/*';
    } else if (c.tipo === 'check') {
      input = el('input'); input.type = 'checkbox';
    } else {
      input = el('input');
      input.type = c.tipo || 'text';
      if (c.maxlen) input.maxLength = c.maxlen;
      if (c.min !== undefined) input.min = c.min;
      if (c.step) input.step = c.step;
    }
    input.name = c.nome;
    if (c.placeholder) input.placeholder = c.placeholder;
    if (c.obrigatorio && c.tipo !== 'arquivo' && c.tipo !== 'check') input.required = true;
    if (valores[c.nome] !== undefined) {
      if (input.type === 'checkbox') input.checked = !!valores[c.nome];
      else if (input.multiple) for (const o of input.options) o.selected = (valores[c.nome] || []).includes(o.value);
      else if (c.tipo !== 'arquivo') input.value = valores[c.nome];
    }
    mapa[c.nome] = input;
    div.appendChild(input);
    f.appendChild(div);
  }
  const acoes = el('div', 'form-acoes');
  if (onCancelar) {
    const bCan = el('button', 'btn', 'Cancelar');
    bCan.type = 'button';
    bCan.addEventListener('click', () => { f.dispatchEvent(new Event('cancelar')); });
    acoes.appendChild(bCan);
  }
  const bOk = el('button', 'btn btn-prim', botaoOk);
  bOk.type = 'submit';
  acoes.appendChild(bOk);
  f.appendChild(acoes);
  wrap.appendChild(f);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = {};
    for (const [k, i] of Object.entries(mapa)) {
      let v = i.value.trim();
      if (i.type === 'number') v = v === '' ? '' : Number(v);
      if (i.type === 'checkbox') v = i.checked;
      if (i.multiple) v = Array.from(i.selectedOptions).map((o) => o.value);
      if (i.type === 'file') v = i.files && i.files[0] ? i.files[0] : '';
      dados[k] = v;
    }
    bOk.disabled = true;
    try { await onOk(dados); } catch (err) { console.error(err); toast('Não foi possível salvar. Tente de novo.'); }
    bOk.disabled = false;
  });
  f.addEventListener('cancelar', onCancelar || (() => {}));
  f.addEventListener('esc', onCancelar || (() => {}));
  return wrap;
}

// Confirmação simples ("Excluir?" estilo MonitON)
export function confirmar({ titulo = 'Confirma?', texto, sim = 'Sim, confirmar', aoSim, aoNao }) {
  const wrap = el('div', 'form-wrap form-aberto confirmar');
  wrap.appendChild(el('h3', '', titulo));
  if (texto) wrap.appendChild(el('p', '', texto));
  const acoes = el('div', 'form-acoes');
  const bNao = el('button', 'btn', 'Voltar'); bNao.type = 'button';
  bNao.addEventListener('click', () => aoNao && aoNao());
  const bSim = el('button', 'btn btn-perigo', sim); bSim.type = 'button';
  bSim.addEventListener('click', async () => { await aoSim && aoSim(); });
  acoes.append(bNao, bSim);
  wrap.appendChild(acoes);
  return wrap;
}

// ---------- QR falso porém estável (mesmo texto → mesma imagem) ----------
// Protótipo sem internet: a imagem é determinística; no servidor (PHP) entra um gerador de QR de verdade.
export function qrDesenha(canvas, texto) {
  const N = 25, cel = canvas.width / N;
  const c = canvas.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height);
  let h = 2166136261 >>> 0;
  for (const ch of texto) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; // semente estável pelo texto
  const bit = () => { h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0; h ^= h >>> 15; return (h & 1) === 1; };
  for (let i = 0; i < 40; i++) bit(); // aquece
  c.fillStyle = '#10202e';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (bit()) c.fillRect(x * cel, y * cel, cel * 0.92, cel * 0.92);
  const canto = (cx, cy) => {
    c.fillStyle = '#10202e'; c.fillRect(cx, cy, cel * 7, cel * 7);
    c.fillStyle = '#fff'; c.fillRect(cx + cel, cy + cel, cel * 5, cel * 5);
    c.fillStyle = '#10202e'; c.fillRect(cx + cel * 2, cy + cel * 2, cel * 3, cel * 3);
  };
  canto(0, 0); canto((N - 7) * cel, 0); canto(0, (N - 7) * cel);
}
