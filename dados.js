// Camada única de dados da escola.
// Agora: IndexedDB no navegador (protótipo). Depois: trocar o corpo das funções
// por fetch ao PHP espelhando o MonitON — o resto do app não muda de lugar nenhum.
// Toda leitura e escrita do ambiente 3D passa por cá.

const NOME_DB = 'kairos-escola';
const VERSAO = 2; // v2: adiciona o store "config" para bancos criados na v1

// Coleções (espelham o modelo de dados do MonitON — ver docs/mapa-moniton.md)
export const COLS = [
  'alunos',        // {id, nome, email, telefone, serieId, qvp, criadoEm}
  'professores',   // {id, nome, materiaIds:[], criadoEm}
  'responsaveis',  // {id, nome, tipo:'pai'|'mae'|'parente'|'tutor', alunoId, telefone}
  'diretores',     // {id, nome, cargo, email}
  'escolas',       // {id, nome, unidade}
  'areas',         // {id, nome}                       (áreas de conhecimento)
  'disciplinas',   // {id, nome, areaId, cor}
  'series',        // {id, nome, oficial:true|false}
  'subcategorias', // {id, nome, disciplinaId}
  'turmas',        // {id, nome, tipo:'oficial'|'reforco', disciplinaId, professorId, preco}
  'matriculas',    // {id, alunoId, turmaId, tipo:'oficial'|'reforco'}
  'contratos',     // {id, alunoId, turmaId, valorTotal, parcelas, parcelasPagas}
  'compras',       // {id, alunoId, turmaId(reforço), valor, quando}
  'extrato',       // {id, alunoId, descricao, valor, tipo:'pagamento'|'compra'|'contrato', quando}
  'notas',         // {id, alunoId, materiaId, bimestre, valor}
  'metas',         // {id, alunoId, texto, atingida}
  'certificados',  // {id, alunoId, turmaId, titulo, emitidoEm}
  'aulasPosts',    // {id, materiaId, titulo, texto, recuperacao:false}
  'anotacoes',     // {id, alunoId, materiaId, texto, midia}  (midia = dataURL opcional)
  'chatAovivo',    // {id, autor, papel, texto, quando, audioDataUrl}
  'mensagens',     // {id, de, para, autor, texto, quando}
  'ligacoes',      // {id, de, para, duracaoSeg, notaQualidade}
  'qrcodes',       // {id, titulo, material, disciplinaId, serieId, capitulo, frente, conteudo}
  'ia',            // {id:1, metodologia, prompts:[{id,texto}], promptAdotado}
  'config',        // {id:'live', aoVivo:boolean} · {id:'sessao', alunoId, papel}
];

let dbPromise = null;
function abrir() {
  if (!dbPromise) {
    dbPromise = new Promise((res, rej) => {
      const rq = indexedDB.open(NOME_DB, VERSAO);
      rq.onupgradeneeded = () => {
        const d = rq.result;
        for (const c of COLS) if (!d.objectStoreNames.contains(c)) d.createObjectStore(c, { keyPath: 'id' });
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  }
  return dbPromise;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function tx(col, modo, fn) {
  const d = await abrir();
  return new Promise((res, rej) => {
    const t = d.transaction(col, modo);
    const s = t.objectStore(col);
    const r = fn(s);
    t.oncomplete = () => res(typeof r === 'object' && r && r.result !== undefined ? r.result : undefined);
    t.onerror = () => rej(t.error);
  });
}

// --- API pública (é aqui que entra o PHP depois) ---
function aviso(c) { try { dispatchEvent(new CustomEvent('dados-atualizado', { detail: { colecao: c } })); } catch {} }
export const db = {
  lista: (col) => tx(col, 'readonly', (s) => s.getAll()),
  todos: async () => {
    const out = {};
    await Promise.all(COLS.map(async (c) => { out[c] = await db.lista(c); }));
    return out;
  },
  porId: (col, id) => tx(col, 'readonly', (s) => s.get(id)),
  salva: async (col, obj) => {
    const o = { ...obj };
    if (o.id === undefined || o.id === null) o.id = uid();
    await tx(col, 'readwrite', (s) => s.put(o));
    aviso(col);
    return o;
  },
  remove: async (col, id) => { await tx(col, 'readwrite', (s) => s.delete(id)); aviso(col); },
  // Grava vários registros de uma vez (uma transação por lote): usado na semente
  salvaLote: async (itens) => {
    const d = await abrir();
    const cols = [...new Set(itens.map((i) => i.col))];
    await new Promise((res, rej) => {
      const t = d.transaction(cols, 'readwrite'); // array de stores (string só valeria com espaço, não vírgula)
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
      for (const i of itens) t.objectStore(i.col).put(i.obj);
    });
    for (const c of cols) aviso(c);
    return itens.map((i) => i.obj);
  },
  apagarTudo: () => tx2multi(COLS),
};

async function tx2multi(cols) {
  const d = await abrir();
  return new Promise((res, rej) => {
    const t = d.transaction(cols, 'readwrite'); // array de stores
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
    for (const c of cols) t.objectStore(c).clear();
  });
}

export const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataBr = (ts) => new Date(ts).toLocaleDateString('pt-BR');
export const dataHoraBr = (ts) => new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

// ---------------- Dados de exemplo (só na primeira abertura) ----------------
function semente() {
  const t0 = Date.now();
  const disc = [
    ['matematica', 'Matemática', '#2f6fd6'], ['portugues', 'Português', '#c2410c'],
    ['ciencias', 'Ciências', '#15803d'], ['historia', 'História', '#9a3412'],
    ['geografia', 'Geografia', '#0e7490'], ['ingles', 'Inglês', '#6d28d9'],
  ];
  const areaExatas = { id: uid(), nome: 'Ciências Exatas' };
  const areaLing = { id: uid(), nome: 'Linguagens' };
  const areaNat = { id: uid(), nome: 'Ciências da Natureza' };
  const areaHum = { id: uid(), nome: 'Ciências Humanas' };
  const areas = [areaExatas, areaLing, areaNat, areaHum];
  const disciplinas = [
    { id: 'matematica', nome: 'Matemática', cor: '#2f6fd6', areaId: areaExatas.id },
    { id: 'portugues', nome: 'Português', cor: '#c2410c', areaId: areaLing.id },
    { id: 'ciencias', nome: 'Ciências', cor: '#15803d', areaId: areaNat.id },
    { id: 'historia', nome: 'História', cor: '#9a3412', areaId: areaHum.id },
    { id: 'geografia', nome: 'Geografia', cor: '#0e7490', areaId: areaHum.id },
    { id: 'ingles', nome: 'Inglês', cor: '#6d28d9', areaId: areaLing.id },
  ];
  const serieFund = { id: uid(), nome: '5º ano — Ensino Fundamental', oficial: true };
  const serieMed = { id: uid(), nome: '1º ano — Ensino Médio', oficial: true };
  const series = [serieFund, serieMed];
  const subcats = [
    { id: uid(), nome: 'Frações e porcentagem', disciplinaId: 'matematica' },
    { id: uid(), nome: 'Classes de palavras', disciplinaId: 'portugues' },
    { id: uid(), nome: 'Sistema Solar', disciplinaId: 'ciencias' },
  ];
  const prof = [
    { id: uid(), nome: 'Ana Lima', materiaIds: ['matematica', 'ingles'], criadoEm: t0 },
    { id: uid(), nome: 'Carlos Mota', materiaIds: ['historia', 'geografia'], criadoEm: t0 },
  ];
  const alunos = [
    { id: 'al-alissom', nome: 'Alissom', email: 'alissom@exemplo.com.br', telefone: '', serieId: serieMed.id, qvp: false, criadoEm: t0 },
    { id: 'al-maria', nome: 'Maria Souza', email: 'maria@exemplo.com.br', telefone: '', serieId: serieMed.id, qvp: false, criadoEm: t0 },
    { id: 'al-joao', nome: 'João Pedro', email: 'joao@exemplo.com.br', telefone: '', serieId: serieMed.id, qvp: true, criadoEm: t0 },
  ];
  const resp = [
    { id: uid(), nome: 'Marta Souza', tipo: 'mae', alunoId: 'al-alissom', telefone: '' },
    { id: uid(), nome: 'Paulo Souza', tipo: 'pai', alunoId: 'al-maria', telefone: '' },
  ];
  const turmasOficiais = [
    { id: uid(), nome: 'Turma Oficial — Matemática 1º EM', tipo: 'oficial', disciplinaId: 'matematica', professorId: prof[0].id, preco: 0 },
    { id: uid(), nome: 'Turma Oficial — Português 1º EM', tipo: 'oficial', disciplinaId: 'portugues', professorId: prof[0].id, preco: 0 },
  ];
  const reforcos = [
    { id: uid(), nome: 'Reforço — Redação para provas', tipo: 'reforco', disciplinaId: 'portugues', professorId: prof[0].id, preco: 49.9 },
    { id: uid(), nome: 'Reforço — Cálculo básico', tipo: 'reforco', disciplinaId: 'matematica', professorId: prof[0].id, preco: 59.9 },
  ];
  const matriculas = [
    { id: uid(), alunoId: 'al-alissom', turmaId: turmasOficiais[0].id, tipo: 'oficial' },
    { id: uid(), alunoId: 'al-alissom', turmaId: turmasOficiais[1].id, tipo: 'oficial' },
    { id: uid(), alunoId: 'al-maria', turmaId: turmasOficiais[0].id, tipo: 'oficial' },
  ];
  const contratos = [
    { id: uid(), alunoId: 'al-alissom', turmaId: turmasOficiais[0].id, valorTotal: 240, parcelas: 4, parcelasPagas: 1 },
  ];
  const extrato = [
    { id: uid(), alunoId: 'al-alissom', descricao: 'Contrato — Turma Oficial Matemática', valor: 60, tipo: 'pagamento', quando: t0 },
  ];
  const compras = [];
  const notas = [
    { id: uid(), alunoId: 'al-alissom', materiaId: 'matematica', bimestre: 1, valor: 8.5 },
    { id: uid(), alunoId: 'al-alissom', materiaId: 'portugues', bimestre: 1, valor: 7.2 },
    { id: uid(), alunoId: 'al-maria', materiaId: 'matematica', bimestre: 1, valor: 9.1 },
  ];
  const metas = [
    { id: uid(), alunoId: 'al-alissom', texto: 'Chegar a 9 em Matemática no 2º bimestre', atingida: false },
    { id: uid(), alunoId: 'al-alissom', texto: 'Assistir todas as aulas de Inglês', atingida: false },
  ];
  const certificados = [
    { id: uid(), alunoId: 'al-alissom', turmaId: turmasOficiais[1].id, titulo: 'Conclusão da Turma Oficial de Português — 1º bimestre', emitidoEm: t0 },
  ];
  const aulaTextos = {
    matematica: 'Frações e porcentagem: hoje o vídeo traz a aula completa sobre porcentagem do dia a dia.',
    portugues: 'Classes de palavras: revisão rápida com exemplos práticos para redação.',
    ciencias: 'Sistema Solar e seres vivos: tour pelos planetas e fotossíntese.',
    historia: 'Brasil: do Império à República, linha do tempo comentada.',
    geografia: 'Regiões e biomas do Brasil com foco no Cerrado goiano.',
    ingles: 'Vocabulário do dia a dia: sala, escola e rotina.',
  };
  const aulasPosts = Object.entries(aulaTextos).map(([m, txt]) => ({
    id: uid(), materiaId: m, titulo: 'Aula registrada — ' + txt.split(':')[0], texto: txt, recuperacao: false,
  }));
  const anotacoes = [
    { id: uid(), alunoId: 'al-alissom', materiaId: 'matematica', texto: 'Fórmula de juros simples: M = C(1 + i·n)', midia: '' },
  ];
  const chatAovivo = [];
  const mensagens = [
    { id: uid(), de: 'secretaria', para: 'al-alissom', autor: 'Secretaria', texto: 'Bem-vindo(a) ao semestre! Confirme seus dados no kioskê “Minha área”.', quando: t0 },
  ];
  const ligacoes = [];
  const qrcodes = [
    { id: uid(), titulo: 'Caderno de Matemática — Cap. 3', material: 'caderno', disciplinaId: 'matematica', serieId: serieMed.id, capitulo: 'Cap. 3 — Porcentagem', frente: '1ª frente', conteudo: 'Abrir a aula de frações e porcentagem.' },
    { id: uid(), titulo: 'Ficha de Português — Vocabulário', material: 'ficha', disciplinaId: 'portugues', serieId: serieMed.id, capitulo: '', frente: '', conteudo: 'Abrir a aula de classes de palavras.' },
  ];
  const ia = [{ id: '1', metodologia: 'Acompanhar o aluno com metas claras, corrigir com paciência e celebrar cada avanço.', prompts: [{ id: 'p1', texto: 'Explique como se fossem 10 anos.' }], promptAdotado: 'Explique como se fossem 10 anos.' }];
  const diretores = [{ id: uid(), nome: 'Direção Kairós', cargo: 'Direção geral', email: 'direcao@exemplo.com.br' }];
  const escolas = [{ id: uid(), nome: 'Escola Kairós', unidade: 'Unidade central' }];

  const tudo = {
    alunos, professores: prof, responsaveis: resp, diretores, escolas, areas, disciplinas, series, subcats: subcats,
    turmas: [...turmasOficiais, ...reforcos], matriculas, contratos, compras, extrato, notas, metas, certificados,
    aulasPosts, anotacoes, chatAovivo, mensagens, ligacoes, qrcodes, ia,
    config: [
      { id: 'live', aoVivo: false },
      { id: 'sessao', alunoId: 'al-alissom', papel: 'aluno' },
    ],
  };
  const dados = {};
  for (const c of COLS) dados[c] = tudo[c] || [];
  return dados;
}

let semeando = null;
export async function garantirDados() {
  if (semeando) return semeando;
  semeando = (async () => {
    const vazio = await db.porId('ia', '1');
    if (!vazio) {
      const s = semente();
      const itens = [];
      for (const c of COLS) for (const o of s[c] || []) itens.push({ col: c, obj: o });
      try { await db.salvaLote(itens); } catch (e) { console.warn('Semente:', e && e.message); }
    }
  })();
  try { await semeando; } finally { semeando = null; }
}
