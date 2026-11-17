// Camada única de dados da escola.
// Agora: IndexedDB no navegador (protótipo). Depois: trocar o corpo das funções
// por fetch ao PHP espelhando o MonitON — o resto do app não muda de lugar nenhum.
// Toda leitura e escrita do ambiente 3D passa por cá.

const NOME_DB = 'kairos-escola';
const VERSAO = 4; // v4: adiciona gradeItens (grade curricular editável) e estudoLog (trilha de estudo)

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
  'turmas',        // {id, nome, tipo:'oficial'|'reforco', disciplinaId, professorId, preco, salaId?}
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
  'gradeItens',    // {id, serieId, bimestre, disciplinaId, tema, resumo, videoUrl} — grade curricular editável
  'estudoLog',     // {id, alunoId, serieId, disciplinaId, tema, modo, quando}
  'ia',            // {id:1, metodologia, prompts:[{id,texto}], promptAdotado}
  'config',        // {id:'live', aoVivo:boolean} · {id:'sessao', alunoId, papel}
  'jogo',          // {id:'1', xp, medalhas:[], salasVisitadas:{}, dia, missoes:{...}, assistiuVideo,...}
  'convites',      // {codigo, escola, quando, usadoQuando}
  'exerciciosLog', // {id, quando, alunoId, salaId, pergunta, acertou}
];

// Série brasileira completa (Fund. I, Fund. II e Médio), com idade típica de entrada.
// Idade é só um atalho da rota de estudo: a direção edita tudo depois no painel Grade.
export const SERIES_BRASILEIRAS = [
  { id: 'ser-1f', nome: '1º ano — Ensino Fundamental', etapa: 'fund1', idadeMin: 6 },
  { id: 'ser-2f', nome: '2º ano — Ensino Fundamental', etapa: 'fund1', idadeMin: 7 },
  { id: 'ser-3f', nome: '3º ano — Ensino Fundamental', etapa: 'fund1', idadeMin: 8 },
  { id: 'ser-4f', nome: '4º ano — Ensino Fundamental', etapa: 'fund1', idadeMin: 9 },
  { id: 'ser-5f', nome: '5º ano — Ensino Fundamental', etapa: 'fund1', idadeMin: 10 },
  { id: 'ser-6f', nome: '6º ano — Ensino Fundamental', etapa: 'fund2', idadeMin: 11 },
  { id: 'ser-7f', nome: '7º ano — Ensino Fundamental', etapa: 'fund2', idadeMin: 12 },
  { id: 'ser-8f', nome: '8º ano — Ensino Fundamental', etapa: 'fund2', idadeMin: 13 },
  { id: 'ser-9f', nome: '9º ano — Ensino Fundamental', etapa: 'fund2', idadeMin: 14 },
  { id: 'ser-1m', nome: '1º ano — Ensino Médio', etapa: 'medio', idadeMin: 15 },
  { id: 'ser-2m', nome: '2º ano — Ensino Médio', etapa: 'medio', idadeMin: 16 },
  { id: 'ser-3m', nome: '3º ano — Ensino Médio', etapa: 'medio', idadeMin: 17 },
].map((s) => ({ oficial: true, ...s }));

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
  const series = SERIES_BRASILEIRAS;
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
    { id: 'al-alissom', nome: 'Alissom', email: 'alissom@exemplo.com.br', telefone: '', serieId: 'ser-1m', qvp: false, criadoEm: t0 },
    { id: 'al-maria', nome: 'Maria Souza', email: 'maria@exemplo.com.br', telefone: '', serieId: 'ser-1m', qvp: false, criadoEm: t0 },
    { id: 'al-joao', nome: 'João Pedro', email: 'joao@exemplo.com.br', telefone: '', serieId: 'ser-1m', qvp: true, criadoEm: t0 },
  ];
  const resp = [
    { id: uid(), nome: 'Marta Souza', tipo: 'mae', alunoId: 'al-alissom', telefone: '' },
    { id: uid(), nome: 'Paulo Souza', tipo: 'pai', alunoId: 'al-maria', telefone: '' },
  ];
  const turmasOficiais = [
    { id: uid(), nome: 'Turma Oficial — Matemática 1º EM', tipo: 'oficial', disciplinaId: 'matematica', professorId: prof[0].id, preco: 0, salaId: 'matematica', serieId: 'ser-1m' },
    { id: uid(), nome: 'Turma Oficial — Português 1º EM', tipo: 'oficial', disciplinaId: 'portugues', professorId: prof[0].id, preco: 0, salaId: 'portugues', serieId: 'ser-1m' },
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
    { id: uid(), titulo: 'Caderno de Matemática — Cap. 3', material: 'caderno', disciplinaId: 'matematica', serieId: 'ser-1m', capitulo: 'Cap. 3 — Porcentagem', frente: '1ª frente', conteudo: 'Abrir a aula de frações e porcentagem.' },
    { id: uid(), titulo: 'Ficha de Português — Vocabulário', material: 'ficha', disciplinaId: 'portugues', serieId: 'ser-1m', capitulo: '', frente: '', conteudo: 'Abrir a aula de classes de palavras.' },
  ];
  const ia = [{ id: '1', metodologia: 'Acompanhar o aluno com metas claras, corrigir com paciência e celebrar cada avanço.', prompts: [{ id: 'p1', texto: 'Explique como se fossem 10 anos.' }], promptAdotado: 'Explique como se fossem 10 anos.' }];
  const gradeItens = sementeGrade();
  const estudoLog = [];
  const jogo = [{ id: '1', xp: 0, medalhas: [], salasVisitadas: {}, dia: '', assistiuVideo: false, abriuQr: false, comprou: false, ligou: false, missoes: { dia: '', visitas: 0, questoes: 0, interacoes: 0, ganhos: [] } }];
  const convites = [];
  const exerciciosLog = [];
  const diretores = [{ id: uid(), nome: 'Direção Kairós', cargo: 'Direção geral', email: 'direcao@exemplo.com.br' }];
  const escolas = [{ id: uid(), nome: 'Escola Kairós', unidade: 'Unidade central' }];

  const tudo = {
    alunos, professores: prof, responsaveis: resp, diretores, escolas, areas, disciplinas, series, subcats: subcats,
    turmas: [...turmasOficiais, ...reforcos], matriculas, contratos, compras, extrato, notas, metas, certificados,
    aulasPosts, anotacoes, chatAovivo, mensagens, ligacoes, qrcodes, ia, jogo, convites, exerciciosLog,
    gradeItens, estudoLog,
    config: [
      { id: 'live', aoVivo: false },
      { id: 'sessao', alunoId: 'al-alissom', papel: 'aluno' },
      { id: 'trial', inicio: 0 }, // recebe Date.now() na primeira entrada (teste grátis de 24 h)
    ],
  };
  const dados = {};
  for (const c of COLS) dados[c] = tudo[c] || [];
  return dados;
}

let semeando = null;
// Grade padrão por disciplina (tema + resumo), distribuída nos 4 bimestres de cada série.
const TOPICOS_GRADE = {
  matematica: [
    ['Números e operações', 'Operações com números naturais, inteiros e decimais; ordem de grandeza e estimativa.'],
    ['Frações e porcentagem', 'Frações equivalentes, porcentagem no dia a dia, razão e proporção.'],
    ['Geometria', 'Planos, retas e ângulos; área e perímetro de figuras; sólidos geométricos e volumes.'],
    ['Estatística e probabilidade', 'Leitura de gráficos, médias, mediana e a ideia básica de probabilidade.'],
  ],
  portugues: [
    ['Classes de palavras', 'Substantivos, verbos, adjetivos e pronomes com exemplos de frases reais.'],
    ['Compreensão de textos', 'Ideia central, inferências e tipos de texto (notícia, crônica, artigo).'],
    ['Redação', 'Estrutura do parágrafo, coesão e o caminho até o texto dissertativo.'],
    ['Textos literários', 'Poemas, cordel e conto: leitura em voz alta, rima e figuras de linguagem.'],
  ],
  ciencias: [
    ['Seres vivos', 'Células, fotossíntese, cadeias alimentares e ecossistemas brasileiros.'],
    ['Corpo humano e saúde', 'Sistemas do corpo, nutrição, hábitos saudáveis e prevenção de doenças.'],
    ['Terra e Sistema Solar', 'Planetas, luas, clima, ciclo da água e recursos naturais.'],
    ['Matéria e energia', 'Estados da matéria, calor, eletricidade básica e fontes de energia.'],
  ],
  historia: [
    ['Brasil: origem e colônia', 'Da chegada dos povos originários ao ciclo do açúcar e do ouro.'],
    ['Império e República', 'Independência, Lei Áurea, Proclamação da República e o Estado Novo.'],
    ['Cidadania e direitos', 'Constituição, deveres do cidadão, voto e participação social.'],
    ['História local e memória', 'Pesquisa de campo na comunidade, entrevistas e linha do tempo local.'],
  ],
  geografia: [
    ['Mapas e orientação', 'Escala, coordenadas, fusos horários e uso de mapas e globos.'],
    ['Regiões e biomas do Brasil', 'As cinco regiões, biomas e atividades econômicas de cada território.'],
    ['Cidades e campo', 'Urbano e rural, migrações, funções das cidades e transporte.'],
    ['Clima e meio ambiente', 'Climas do Brasil, desastres naturais e sustentabilidade.'],
  ],
  ingles: [
    ['Greetings e rotinas', 'Apresentações, despedidas e rotina diária com vocabulário essencial.'],
    ['Vocabulário do dia a dia', 'Escola, família, comida e lugares: frases práticas de sobrevivência.'],
    ['Verbo to be e frases básicas', 'Afirmativa, negativa e interrogativa com am/is/are em contexto.'],
    ['Leitura de textos curtos', 'Entender anúncios, cardápios e mensagens curtas em inglês.'],
  ],
};
function sementeGrade() {
  const itens = [];
  for (const serie of SERIES_BRASILEIRAS)
    for (const [disc, topicos] of Object.entries(TOPICOS_GRADE))
      topicos.forEach(([tema, resumo], i) =>
        itens.push({ id: uid() + '-' + i, serieId: serie.id, bimestre: i + 1, disciplinaId: disc, tema, resumo, videoUrl: '' })
      );
  return itens;
}

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
    // v2 → v3: garanta o registro de jogo (banco antigo não tem)
    if (!(await db.porId('jogo', '1')))
      await db.salva('jogo', { id: '1', xp: 0, medalhas: [], salasVisitadas: {}, dia: '', assistiuVideo: false, abriuQr: false, comprou: false, ligou: false, missoes: { dia: '', visitas: 0, questoes: 0, interacoes: 0, ganhos: [] } });
    // v3 → v4: banco antigo ganha as séries brasileiras, a grade e o trial
    if (!(await db.porId('series', 'ser-1m'))) await db.salvaLote(SERIES_BRASILEIRAS.map((o) => ({ col: 'series', obj: o })));
    if ((await db.lista('gradeItens')).length === 0) await db.salvaLote(sementeGrade().map((o) => ({ col: 'gradeItens', obj: o })));
    if (!(await db.porId('config', 'trial'))) await db.salva('config', { id: 'trial', inicio: 0 });
  })();
  try { await semeando; } finally { semeando = null; }
}
