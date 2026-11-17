// Secretaria (papel DIRETOR/ADMIN) — espelha a "Secretaria" do MonitON:
// alunos, professores, responsáveis, currículo, turmas e cursos, financeiro geral, QR codes e assistente IA.
import { db, uid, money, dataBr } from './dados.js';
import { el, abrePainel, tabela, form, vazio, confirmar, toast, qrDesenha } from './telas.js';
import { SALAS } from './conteudo.js';

export function secretaria() {
  const painel = abrePainel({
    titulo: 'Secretaria', sub: 'Cadastros e gestão acadêmica em um só lugar · acesso da direção', largo: true,
    tabs: [
      { id: 'visao', nome: 'Visão geral', render: tabVisao },
      { id: 'alunos', nome: 'Alunos', render: tabAlunos },
      { id: 'professores', nome: 'Professores', render: tabProfessores },
      { id: 'responsaveis', nome: 'Responsáveis', render: tabResponsaveis },
      { id: 'curriculo', nome: 'Currículo', render: tabCurriculo },
      { id: 'grade', nome: 'Grade curricular', render: tabGrade },
      { id: 'turmas', nome: 'Turmas e cursos', render: tabTurmas },
      { id: 'financeiro', nome: 'Financeiro', render: tabFinanceiro },
      { id: 'qrcodes', nome: 'QR Codes', render: tabQrcodes },
      { id: 'ia', nome: 'Assistente IA', render: tabIA },
    ],
  });

  // ---------- Visão geral (dashboard com números reais do banco local) ----------
  async function tabVisao(c) {
    const [alunos, matriculas, professores, turmas, contratos, extrato, qrcodes] = await Promise.all([
      db.lista('alunos'), db.lista('matriculas'), db.lista('professores'), db.lista('turmas'), db.lista('contratos'), db.lista('extrato'), db.lista('qrcodes'),
    ]);
    const contratado = contratos.reduce((s, x) => s + (x.valorTotal || 0), 0);
    const pago = extrato.filter((x) => x.tipo === 'pagamento').reduce((s, x) => s + (x.valor || 0), 0);
    const abertas = matriculas.filter((m) => m.tipo === 'oficial').length;
    const reforcos = matriculas.filter((m) => m.tipo === 'reforco').length;
    c.appendChild(el('h4', '', 'Números da escola hoje'));
    const resumo = el('div', 'fin-resumo');
    resumo.innerHTML = [
      ['Alunos', String(alunos.length)],
      ['Matrículas oficiais', String(abertas)],
      ['Reforços ativos', String(reforcos)],
      ['Professores', String(professores.length)],
      ['Turmas e cursos', String(turmas.length)],
      ['QR codes de material', String(qrcodes.length)],
    ].map(([k, v]) => `<div class="fin-cel"><span>${k}</span><b>${v}</b></div>`).join('');
    c.appendChild(resumo);
    const caixa = el('div', 'fin-resumo');
    caixa.innerHTML = [
      ['Contratado', money(contratado)],
      ['Recebido', money(pago)],
      ['Em aberto', money(Math.max(0, contratado - pago))],
    ].map(([k, v]) => `<div class="fin-cel"><span>${k}</span><b>${v}</b></div>`).join('');
    c.appendChild(caixa);
    c.appendChild(el('p', 'dica-suave', 'Todos os números vêm dos dados desta demonstração (navegador). Os mesmos cards vão ficar ligados ao servidor PHP na versão da escola cliente.'));
    const ocup = el('div', '');
    ocup.appendChild(el('h4', '', 'Ocupação das turmas oficiais'));
    const oficiais = turmas.filter((t) => t.tipo === 'oficial');
    for (const t of oficiais) {
      const n = matriculas.filter((m) => m.turmaId === t.id).length;
      const pct = Math.min(100, Math.round((100 * n) / Math.max(1, t.vagas || 30)));
      const barra = el('div', 'barra-metas');
      barra.appendChild(el('i', '', ''));
      barra.firstChild.style.width = pct + '%';
      ocup.appendChild(barra);
      ocup.appendChild(el('p', 'meta-linha', `${t.nome}: ${n} alunos matriculados`));
    }
    if (!oficiais.length) ocup.appendChild(el('p', 'sub', 'Sem turmas oficiais cadastradas.'));
    c.appendChild(ocup);
  }

  // ---------- Alunos ----------
  async function tabAlunos(c) {
    const series = await db.lista('series');
    c.appendChild(await tabela('alunos', {
      lista: () => db.lista('alunos'),
      cabecalho: () => cab('Nome', 'Série', 'Matrículas', '', ''),
      colunas: [
        { k: 'nome', f: (a) => el('b', '', a.nome + (a.qvp ? ' <span class="selo-mini">QVP</span>' : '')) },
        { k: 'serieId', f: (a) => series.find((s) => s.id === a.serieId)?.nome || '—' },
        { k: '', f: (a) => contagemMatriculas(a.id) },
        { k: '', f: () => '' },
        {
          k: '', f: (a) => {
            const d = el('div', 'linhas-botoes');
            btn(d, 'Editar', () => formAluno(a, c));
            btn(d, 'Excluir', () => confirmarAluno(a, c));
            return d;
          },
        },
      ],
    }, {
      vazioMsg: 'Nenhum aluno cadastrado.',
      botoesTopo: [botaoNovo('Novo Aluno', () => formAluno(null, c))],
    }));
  }
  async function formAluno(aluno, container) {
    const [series, turmas] = await Promise.all([db.lista('series'), db.lista('turmas')]);
    container.innerHTML = '';
    container.appendChild(form({
      titulo: aluno ? 'Editar aluno' : 'Novo Aluno', botaoOk: 'Salvar aluno',
      valores: aluno || {},
      campos: [
        { nome: 'nome', label: 'Nome completo', obrigatorio: true },
        { nome: 'email', label: 'E-mail', tipo: 'email' },
        { nome: 'telefone', label: 'Telefone' },
        {
          nome: 'serieId', label: 'Série', tipo: 'selecao', vazioOpcao: '— sem série —',
          opcoes: series.map((s) => ({ v: s.id, t: s.nome })),
        },
        { nome: 'matricula', label: 'Matricular em turma oficial', tipo: 'selecao', vazioOpcao: '— não matricular agora —', opcoes: turmas.filter((t) => t.tipo === 'oficial').map((t) => ({ v: t.id, t: t.nome })) },
        { nome: 'qvp', label: 'É QVP (plano de apoio)', tipo: 'check' },
      ],
      onOk: async (d) => {
        const rec = { ...(aluno || {}), nome: d.nome, email: d.email, telefone: d.telefone, serieId: d.serieId || null, qvp: !!d.qvp };
        if (!aluno) rec.criadoEm = Date.now();
        await db.salva('alunos', rec);
        if (d.matricula && !aluno) await db.salva('matriculas', { id: uid(), alunoId: rec.id, turmaId: d.matricula, tipo: 'oficial' });
        toast(aluno ? 'Aluno atualizado.' : 'Aluno cadastrado.');
        painel.recarregar();
      },
      onCancelar: () => painel.recarregar(),
    }));
  }
  function confirmarAluno(a, c) {
    c.innerHTML = '';
    c.appendChild(confirmar({
      titulo: 'Excluir aluno?', texto: `${a.nome} e seus cadastros vinculados saem do protótipo.`, sim: 'Sim, excluir',
      aoSim: async () => {
        await db.remove('alunos', a.id);
        for (const m of (await db.lista('matriculas')).filter((x) => x.alunoId === a.id)) await db.remove('matriculas', m.id);
        for (const r of (await db.lista('responsaveis')).filter((x) => x.alunoId === a.id)) await db.remove('responsaveis', r.id);
        toast('Aluno removido.');
        painel.recarregar();
      },
      aoNao: () => painel.recarregar(),
    }));
  }
  function contagemMatriculas(alunoId) {
    const p = db.lista('matriculas').then((ls) => ls.filter((m) => m.alunoId === alunoId).length);
    const n = el('span', 'cont-mat'); p.then((v) => (n.textContent = v + ' matrícula' + (v === 1 ? '' : 's')));
    return n;
  }

  // ---------- Professores ----------
  async function tabProfessores(c) {
    c.appendChild(await tabela('professores', {
      lista: () => db.lista('professores'),
      cabecalho: () => cab('Nome', 'Matérias', '', ''),
      colunas: [
        { k: 'nome', f: (p) => el('b', '', p.nome) },
        { k: 'materiaIds', f: (p) => (p.materiaIds || []).map((id) => nomeDisc(id)).join(', ') || '—' },
        { k: '', f: () => '' },
        {
          k: '', f: (p) => {
            const d = el('div', 'linhas-botoes');
            btn(d, 'Editar', () => formProf(p, c));
            btn(d, 'Excluir', () => confirmar2('Excluir professor?', p.nome, async () => { await db.remove('professores', p.id); toast('Professor removido.'); painel.recarregar(); }, c));
            return d;
          },
        },
      ],
    }, { vazioMsg: 'Nenhum professor.', botoesTopo: [botaoNovo('Novo professor', () => formProf(null, c))] }));
  }
  function formProf(p, c) {
    c.innerHTML = '';
    c.appendChild(form({
      titulo: p ? 'Editar professor' : 'Novo professor', botaoOk: 'Salvar',
      valores: p || { materiaIds: [] },
      campos: [
        { nome: 'nome', label: 'Nome completo', obrigatorio: true },
        { nome: 'materiaIds', label: 'Matérias que leciona', tipo: 'multi', opcoes: SALAS.map((s) => ({ v: s.id, t: s.nome })) },
      ],
      onOk: async (d) => {
        await db.salva('professores', { ...(p || {}), nome: d.nome, materiaIds: d.materiaIds });
        toast('Professor salvo.');
        painel.recarregar();
      },
      onCancelar: () => painel.recarregar(),
    }));
  }

  // ---------- Responsáveis ----------
  async function tabResponsaveis(c) {
    const [resp, alunos] = await Promise.all([db.lista('responsaveis'), db.lista('alunos')]);
    const nomeAluno = Object.fromEntries(alunos.map((a) => [a.id, a.nome]));
    const filtros = ['todos', 'pai', 'mae', 'parente', 'tutor'];
    let filtro = estadoFiltroResp;
    const barra = el('div', 'tabela-topo filtros');
    for (const f of filtros) {
      const b = el('button', 'chip' + (f === filtro ? ' chip-ativa' : ''), rotuloTipo(f));
      b.addEventListener('click', () => { estadoFiltroResp = f; c.innerHTML = ''; tabResponsaveis(c); });
      barra.appendChild(b);
    }
    c.appendChild(barra);
    c.appendChild(el('table', 'tabela'));
    const t = c.lastChild;
    const thead = el('thead'); const trh = el('tr');
    for (const htxt of ['Nome', 'Tipo', 'Aluno vinculado', '']) trh.appendChild(el('th', '', htxt));
    thead.appendChild(trh); t.appendChild(thead);
    const tbody = el('tbody');
    const lista = resp.filter((r) => filtro === 'todos' || r.tipo === filtro);
    if (!lista.length) tbody.appendChild(tr1(td(vazio('Sem responsáveis nesta categoria.'))));
    for (const r of lista) {
      const tr = el('tr');
      tr.appendChild(td(r.nome)); tr.appendChild(td(rotuloTipo(r.tipo))); tr.appendChild(td(nomeAluno[r.alunoId] || '—'));
      const d = el('div', 'linhas-botoes');
      btn(d, 'Excluir', () => confirmar2('Excluir responsável?', r.nome, async () => { await db.remove('responsaveis', r.id); toast('Responsável removido.'); painel.recarregar(); }, c));
      tr.appendChild(td(d));
      tbody.appendChild(tr);
    }
    t.appendChild(tbody);
    const topoBotoes = el('div', 'tabela-topo');
    topoBotoes.appendChild(botaoNovo('Novo responsável', () => formResp(c)));
    c.insertBefore(topoBotoes, barra);
  }
  function formResp(c) {
    db.lista('alunos').then((alunos) => {
      c.innerHTML = '';
      c.appendChild(form({
        titulo: 'Novo responsável', botaoOk: 'Cadastrar',
        campos: [
          { nome: 'nome', label: 'Nome completo', obrigatorio: true },
          { nome: 'tipo', label: 'Tipo', tipo: 'selecao', opcoes: [['pai', 'Pai'], ['mae', 'Mãe'], ['parente', 'Parente'], ['tutor', 'Tutor']].map(([v, t]) => ({ v, t })) },
          { nome: 'alunoId', label: 'Aluno vinculado', tipo: 'selecao', opcoes: alunos.map((a) => ({ v: a.id, t: a.nome })) },
          { nome: 'telefone', label: 'Telefone' },
        ],
        onOk: async (d) => {
          await db.salva('responsaveis', { id: uid(), nome: d.nome, tipo: d.tipo, alunoId: d.alunoId, telefone: d.telefone });
          toast('Responsável cadastrado.');
          painel.recarregar();
        },
        onCancelar: () => painel.recarregar(),
      }));
    });
  }

  // ---------- Currículo ----------
  async function tabCurriculo(c) {
    const [areas, disciplinas, series, subs] = await Promise.all([db.lista('areas'), db.lista('disciplinas'), db.lista('series'), db.lista('subcategorias')]);
    const nomeArea = Object.fromEntries(areas.map((a) => [a.id, a.nome]));
    const sec = (titulo, corpoFn) => {
      const d = el('details', 'sec-curriculo');
      d.open = true;
      d.appendChild(el('summary', '', titulo));
      const corpo = el('div', 'sec-corpo'); corpoFn(corpo);
      d.appendChild(corpo);
      return d;
    };
    c.appendChild(sec('Áreas de Conhecimento', (b) => listaSimples(areas, (a) => a.nome, {
      aoExcluir: (a) => confirmar2('Excluir área?', a.nome, async () => { await db.remove('areas', a.id); painel.recarregar(); }, c),
      novo: campoRapido('Nova área', 'Nome da área', async (v) => { await db.salva('areas', { id: uid(), nome: v }); painel.recarregar(); }),
    }, b)));
    c.appendChild(sec('Disciplinas', (b) => listaSimples(disciplinas, (x) => x.nome + ' <span class="dim">· ' + (nomeArea[x.areaId] || 'sem área') + '</span>', {
      aoExcluir: (x) => confirmar2('Excluir disciplina?', x.nome, async () => { await db.remove('disciplinas', x.id); painel.recarregar(); }, c),
      novo: campoRapido('Nova disciplina', 'Nome da disciplina', async (v) => { await db.salva('disciplinas', { id: uid(), nome: v, cor: '#475569', areaId: '' }); painel.recarregar(); }),
    }, b)));
    c.appendChild(sec('Séries (oficiais e outros módulos)', (b) => listaSimples(series, (x) => x.nome + (x.oficial ? ' <span class="selo-mini">oficial</span>' : ''), {
      aoExcluir: (x) => confirmar2('Excluir série?', x.nome, async () => { await db.remove('series', x.id); painel.recarregar(); }, c),
      novo: campoRapido('Nova série / módulo', 'Ex.: 2º ano — Ensino Médio', async (v) => { await db.salva('series', { id: uid(), nome: v, oficial: true }); painel.recarregar(); }),
    }, b)));
    c.appendChild(sec('Subcategorias (classificação de conteúdo)', (b) => listaSimples(subs, (x) => x.nome + ' <span class="dim">· ' + nomeDisc(x.disciplinaId) + '</span>', {
      aoExcluir: (x) => confirmar2('Excluir subcategoria?', x.nome, async () => { await db.remove('subcategorias', x.id); painel.recarregar(); }, c),
      novo: campoRapido('Nova subcategoria', 'Ex.: Frações e porcentagem', async (v) => {
        const disc = (await db.lista('disciplinas'))[0];
        await db.salva('subcategorias', { id: uid(), nome: v, disciplinaId: disc ? disc.id : '' });
        painel.recarregar();
      }),
    }, b)));
  }

  // ---------- Turmas e cursos ----------
  async function tabTurmas(c) {
    const [turmas, matriculas, alunos, profs] = await Promise.all([
      db.lista('turmas'), db.lista('matriculas'), db.lista('alunos'), db.lista('professores'),
    ]);
    const nomeAluno = Object.fromEntries(alunos.map((a) => [a.id, a.nome]));
    const nomeProf = Object.fromEntries(profs.map((p) => [p.id, p.nome]));
    for (const tipo of ['oficial', 'reforco']) {
      c.appendChild(el('h3', 'tabela-titulo', tipo === 'oficial' ? 'Turmas oficiais' : 'Cursos de reforço (marketplace)'));
      const grupo = turmas.filter((t) => t.tipo === tipo);
      if (!grupo.length) c.appendChild(vazio(tipo === 'oficial' ? 'Nenhuma turma oficial.' : 'Nenhum curso de reforço.'));
      for (const t of grupo) {
        const meus = matriculas.filter((m) => m.turmaId === t.id).map((m) => nomeAluno[m.alunoId]).filter(Boolean);
        const div = el('div', 'cartao-turma');
        div.innerHTML = `<div class="pagto-nome">${t.nome}</div>
          <div class="dim">Disciplina: ${nomeDisc(t.disciplinaId)} · Professor: ${nomeProf[t.professorId] || '—'}${t.tipo === 'reforco' ? ' · ' + money(t.preco) : ''}</div>
          <p class="anotacao-mat">${meus.length ? 'Alunos: ' + meus.join(', ') : 'Sem alunos matriculados.'}</p>`;
        const d = el('div', 'linhas-botoes');
        btn(d, 'Excluir', () => confirmar2('Excluir turma/curso?', t.nome, async () => {
          await db.remove('turmas', t.id);
          for (const m of matriculas.filter((x) => x.turmaId === t.id)) await db.remove('matriculas', m.id);
          toast('Turma removida.'); painel.recarregar();
        }, c));
        div.appendChild(d);
        c.appendChild(div);
      }
    }
    const b = el('div', 'tabela-topo');
    b.appendChild(botaoNovo('Nova turma oficial', () => formTurma('oficial', c)));
    b.appendChild(botaoNovo('Novo curso de reforço', () => formTurma('reforco', c)));
    c.insertBefore(b, c.firstChild);
  }
  function formTurma(tipo, c) {
    Promise.all([db.lista('disciplinas'), db.lista('professores')]).then(([discs, profs]) => {
      c.innerHTML = '';
      c.appendChild(form({
        titulo: tipo === 'oficial' ? 'Nova turma oficial' : 'Novo curso de reforço', botaoOk: 'Criar',
        campos: [
          { nome: 'nome', label: 'Nome', obrigatorio: true, placeholder: tipo === 'oficial' ? 'Turma Oficial — Matemática 1º EM' : 'Reforço — Redação para provas' },
          { nome: 'disciplinaId', label: 'Disciplina', tipo: 'selecao', opcoes: discs.map((d) => ({ v: d.id, t: d.nome })) },
          { nome: 'professorId', label: 'Professor', tipo: 'selecao', vazioOpcao: '— sem professor —', opcoes: profs.map((p) => ({ v: p.id, t: p.nome })) },
          ...(tipo === 'reforco' ? [{ nome: 'preco', label: 'Preço (R$)', tipo: 'number', step: '0.01', min: 0 }] : []),
        ],
        onOk: async (d) => {
          await db.salva('turmas', { id: uid(), nome: d.nome, tipo, disciplinaId: d.disciplinaId, professorId: d.professorId || '', preco: tipo === 'reforco' ? Number(d.preco || 0) : 0 });
          toast('Criado.');
          painel.recarregar();
        },
        onCancelar: () => painel.recarregar(),
      }));
    });
  }

  // ---------- Financeiro geral ----------
  async function tabFinanceiro(c) {
    const [alunos, contratos, extrato, compras, turmas] = await Promise.all([
      db.lista('alunos'), db.lista('contratos'), db.lista('extrato'), db.lista('compras'), db.lista('turmas'),
    ]);
    const nomeTurma = Object.fromEntries(turmas.map((t) => [t.id, t.nome]));
    const linhas = alunos.map((a) => {
      const meusContratos = contratos.filter((x) => x.alunoId === a.id);
      const contratado = meusContratos.reduce((s, x) => s + (x.valorTotal || 0), 0);
      const pagamentos = extrato.filter((x) => x.alunoId === a.id && x.tipo === 'pagamento');
      const pago = pagamentos.reduce((s, x) => s + (x.valor || 0), 0);
      const comprasA = compras.filter((x) => x.alunoId === a.id);
      const totalCompras = comprasA.reduce((s, x) => s + (x.valor || 0), 0);
      return { aluno: a, contratado, pago, aberto: Math.max(0, contratado - pago), totalCompras, nCompras: comprasA.length, situação: contratado > 0 ? (contratado - pago > 0.009 ? 'Em aberto' : 'Quitado') : 'Sem contrato' };
    });
    const soma = (k) => linhas.reduce((s, l) => s + l[k], 0);
    const resumo = el('div', 'fin-resumo');
    resumo.innerHTML = [
      ['Contratado', money(soma('contratado'))], ['Pago', money(soma('pago'))], ['Em aberto', money(soma('aberto'))], ['Compras', money(soma('totalCompras'))],
    ].map(([k, v]) => `<div class="fin-cel"><span>${k}</span><b>${v}</b></div>`).join('');
    c.appendChild(resumo);
    if (!linhas.length) { c.appendChild(vazio('Nenhum aluno para exibir o financeiro.')); return; }
    const t = el('table', 'tabela');
    t.appendChild((() => { const th = el('thead'); const tr = el('tr'); ['Aluno', 'Contratado', 'Pago', 'Em aberto', 'Compras', 'Situação', ''].forEach((x) => tr.appendChild(el('th', '', x))); th.appendChild(tr); return th; })());
    const tb = el('tbody');
    for (const l of linhas) {
      const tr = el('tr');
      tr.appendChild(td(el('b', '', l.aluno.nome)));
      tr.appendChild(td(money(l.contratado)));
      tr.appendChild(td(money(l.pago)));
      tr.appendChild(td(l.aberto > 0 ? el('b', 'num-neg', money(l.aberto)) : '—'));
      tr.appendChild(td(l.nCompras ? l.nCompras + ' (' + money(l.totalCompras) + ')' : '—'));
      tr.appendChild(td(el('span', 'situ-' + (l.situação === 'Quitado' ? 'ok' : l.situação === 'Em aberto' ? 'neg' : 'dim'), l.situação)));
      const d = el('div', 'linhas-botoes');
      btn(d, 'Ver detalhes', () => detalheFinanceiro(l.aluno, c, nomeTurma));
      tr.appendChild(td(d));
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    c.appendChild(t);
  }
  async function detalheFinanceiro(aluno, c, nomeTurma) {
    const [contratos, extrato] = await Promise.all([db.lista('contratos'), db.lista('extrato')]);
    c.innerHTML = '';
    c.appendChild(el('p', 'voltar', '← <button class="link-like">Voltar ao resumo</button>'));
    c.lastChild.querySelector('button').addEventListener('click', () => painel.recarregar());
    c.appendChild(el('h3', 'tabela-titulo', 'Financeiro — ' + aluno.nome));
    for (const ct of contratos.filter((x) => x.alunoId === aluno.id)) {
      const div = el('div', 'cartao-pagto');
      div.innerHTML = `<div class="pagto-nome">${nomeTurma[ct.turmaId] || 'Curso'}</div>
        <div class="pagto-linha"><span>Total</span><b>${money(ct.valorTotal)}</b></div>
        <div class="pagto-linha"><span>Parcelas pagas</span><b>${ct.parcelasPagas}/${ct.parcelas}</b></div>`;
      const bReg = el('button', 'btn', 'Registrar pagamento de parcela');
      bReg.addEventListener('click', async () => {
        await db.salva('contratos', { ...ct, parcelasPagas: ct.parcelasPagas + 1 });
        await db.salva('extrato', { id: uid(), alunoId: aluno.id, descricao: 'Parcela ' + (ct.parcelasPagas + 1) + ' — ' + (nomeTurma[ct.turmaId] || 'curso'), valor: ct.valorTotal / ct.parcelas, tipo: 'pagamento', quando: Date.now() });
        toast('Pagamento registrado.');
        painel.recarregar();
      });
      div.appendChild(bReg);
      c.appendChild(div);
    }
    c.appendChild(el('h3', 'tabela-titulo', 'Movimentações'));
    c.appendChild(await tabela('extrato', {
      lista: () => db.lista('extrato').then((l) => l.filter((x) => x.alunoId === aluno.id).sort((a, b) => b.quando - a.quando)),
      colunas: [
        { k: 'quando', f: (x) => dataBr(x.quando) },
        { k: 'descricao' },
        { k: 'valor', f: (x) => money(x.valor) },
      ],
    }, { vazioMsg: 'Sem movimentações.' }));
  }

  // ---------- QR codes ----------
  async function tabQrcodes(c) {
    const [qrs, discs, series] = await Promise.all([db.lista('qrcodes'), db.lista('disciplinas'), db.lista('series')]);
    const nomeDisc2 = Object.fromEntries([...SALAS.map((s) => [s.id, s.nome]), ...discs.map((d) => [d.id, d.nome])]);
    const nomeSerie2 = Object.fromEntries(series.map((s) => [s.id, s.nome]));
    c.appendChild(el('table', 'tabela'));
    const t = c.lastChild;
    const th = el('thead'); const trh = el('tr');
    ['Material', 'Disciplina / série', 'Capítulo ou frente', ''].forEach((x) => trh.appendChild(el('th', '', x)));
    th.appendChild(trh); t.appendChild(th);
    const tb = el('tbody');
    if (!qrs.length) tb.appendChild(tr1(td(vazio('Sem QR codes de material didático.'))));
    for (const q of qrs) {
      const tr = el('tr');
      tr.appendChild(td(el('b', '', q.titulo) + '<br><span class="dim">' + q.material + '</span>'));
      tr.appendChild(td(nomeDisc2[q.disciplinaId] || '—' + ' · ' + (nomeSerie2[q.serieId] || '—')));
      tr.appendChild(td([q.capitulo, q.frente].filter(Boolean).join(' · ') || '—'));
      const d = el('div', 'linhas-botoes');
      btn(d, 'Ver conteúdo', () => verQr(q, c));
      btn(d, 'Excluir', () => confirmar2('Excluir QR code?', q.titulo, async () => { await db.remove('qrcodes', q.id); toast('Removido.'); painel.recarregar(); }, c));
      tr.appendChild(td(d));
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    const topo = el('div', 'tabela-topo');
    topo.appendChild(botaoNovo('Novo QR Code', () => formQr(c, discs, series)));
    c.insertBefore(topo, t);
  }
  function formQr(c, discs, series) {
    c.innerHTML = '';
    c.appendChild(form({
      titulo: 'Novo QR Code do material didático', botaoOk: 'Salvar QR Code',
      campos: [
        { nome: 'titulo', label: 'Título do material', obrigatorio: true, placeholder: 'Ex.: Caderno de Matemática — Cap. 3' },
        { nome: 'material', label: 'Tipo de material', tipo: 'selecao', opcoes: [['caderno', 'Caderno'], ['livro', 'Livro'], ['ficha', 'Ficha'], ['poster', 'Poster'], ['outro', 'Outro']].map(([v, t]) => ({ v, t })) },
        { nome: 'disciplinaId', label: 'Disciplina', tipo: 'selecao', opcoes: discs.map((d) => ({ v: d.id, t: d.nome })) },
        { nome: 'serieId', label: 'Série', tipo: 'selecao', vazioOpcao: '— qualquer série —', opcoes: series.map((s) => ({ v: s.id, t: s.nome })) },
        { nome: 'capitulo', label: 'Capítulo' },
        { nome: 'frente', label: 'Frente (1ª frente, 2ª frente…)' },
        { nome: 'conteudo', label: 'Conteúdo que abre ao escanear', tipo: 'area' },
      ],
      onOk: async (d) => {
        await db.salva('qrcodes', { id: uid(), titulo: d.titulo, material: d.material, disciplinaId: d.disciplinaId, serieId: d.serieId || '', capitulo: d.capitulo, frente: d.frente, conteudo: d.conteudo });
        toast('QR Code salvo no acervo.');
        painel.recarregar();
      },
      onCancelar: () => painel.recarregar(),
    }));
  }
  function verQr(q, c) {
    c.innerHTML = '';
    const wrap = el('div', 'qr-ver');
    const cv = document.createElement('canvas');
    cv.width = 168; cv.height = 168;
    qrDesenha(cv, q.titulo + '|' + (q.capitulo || '') + '|' + (q.conteudo || ''));
    wrap.appendChild(cv);
    const pTit = el('p'); pTit.appendChild(el('b', '', q.titulo));
  wrap.appendChild(pTit);
    wrap.appendChild(el('p', 'dim', [q.capitulo, q.frente].filter(Boolean).join(' · ') || 'Material didático'));
    wrap.appendChild(el('p', '', 'Ao apontar a câmera, abre: <b>' + (q.conteudo || 'conteúdo em breve') + '</b>'));
    c.appendChild(wrap);
    const bVoltar = el('button', 'btn', 'Voltar à lista');
    bVoltar.addEventListener('click', () => painel.recarregar());
    c.appendChild(bVoltar);
  }

  // ---------- Grade curricular (tópicos por série/bimestre/disciplina) ----------
  async function tabGrade(c) {
    const [itens, series, discs] = await Promise.all([db.lista('gradeItens'), db.lista('series'), db.lista('disciplinas')]);
    const nomeDisc = Object.fromEntries([...SALAS.map((s) => [s.id, s.nome]), ...discs.map((d) => [d.id, d.nome])]);
    const nomeSerie = Object.fromEntries(series.map((s) => [s.id, s.nome]));
    const filtro = { serieId: '', bimestre: 0, disciplinaId: '' };
    const topo = el('div', 'grade-filtros');
    const selSerie = document.createElement('select'); selSerie.className = 'campo';
    const selBim = document.createElement('select'); selBim.className = 'campo';
    const selDisc = document.createElement('select'); selDisc.className = 'campo';
    selSerie.append(new Option('— todas as séries —', ''), ...series.map((s) => new Option(s.nome, s.id)));
    selBim.append(new Option('— todos os bimestres —', 0), ...['1º', '2º', '3º', '4º'].map((r, i) => new Option(r + ' bimestre', i + 1)));
    selDisc.append(new Option('— todas as disciplinas —', ''), ...SALAS.map((s) => new Option(s.nome, s.id)));
    const area = el('div');
    const pinta = () => {
      area.innerHTML = '';
      const lista = itens.filter((g) => (!filtro.serieId || g.serieId === filtro.serieId) && (!filtro.bimestre || g.bimestre === filtro.bimestre) && (!filtro.disciplinaId || g.disciplinaId === filtro.disciplinaId));
      if (!lista.length) { area.appendChild(vazio('Nenhum tópico com esse filtro.', 'Clique em “Novo tópico” para cadastrar.')); return; }
      const t = el('table', 'tabela');
      const th = el('thead'); const trh = el('tr');
      ['Tópico', 'Série · bimestre', 'Disciplina', 'Vídeo', ''].forEach((x) => trh.appendChild(el('th', '', x)));
      th.appendChild(trh); t.appendChild(th);
      const tb = el('tbody');
      for (const g of lista) {
        const tr = el('tr');
        tr.appendChild(td(`<b>${g.tema}</b><br><span class="dim">${g.resumo || ''}</span>`));
        tr.appendChild(td((nomeSerie[g.serieId] || '—') + ' · ' + g.bimestre + 'º bim.'));
        tr.appendChild(td(nomeDisc[g.disciplinaId] || '—'));
        tr.appendChild(td(g.videoUrl ? el('span', 'dim', 'com link') : '—'));
        const d = el('div', 'linhas-botoes');
        btn(d, 'Editar', () => formGrade(g, c));
        btn(d, 'Excluir', () => confirmar2('Excluir tópico da grade?', g.tema, async () => { await db.remove('gradeItens', g.id); toast('Tópico removido.'); painel.recarregar(); }, c));
        tr.appendChild(td(d));
        tb.appendChild(tr);
      }
      t.appendChild(tb);
      area.appendChild(t);
    };
    for (const [sel, chave] of [[selSerie, 'serieId'], [selBim, 'bimestre'], [selDisc, 'disciplinaId']])
      sel.addEventListener('change', () => { filtro[chave] = chave === 'bimestre' ? Number(sel.value) : sel.value; pinta(); });
    topo.append(selSerie, selBim, selDisc, botaoNovo('Novo tópico', () => formGrade(null, c)));
    c.appendChild(el('p', 'dim', 'A grade alimenta a rota de estudo do aluno (painel 📖 Meu estudo). Edite à vontade: o aluno vê na hora.'));
    c.appendChild(topo);
    c.appendChild(area);
    pinta();
  }
  async function formGrade(item, c) {
    const [series, discs] = await Promise.all([db.lista('series'), db.lista('disciplinas')]);
    c.innerHTML = '';
    c.appendChild(form({
      titulo: item ? 'Editar tópico da grade' : 'Novo tópico da grade', botaoOk: 'Salvar tópico',
      valores: item || {},
      campos: [
        { nome: 'tema', label: 'Tema do tópico', obrigatorio: true, placeholder: 'Ex.: Frações e porcentagem' },
        { nome: 'resumo', label: 'Resumo do que o aluno vai aprender', tipo: 'area' },
        { nome: 'serieId', label: 'Série', tipo: 'selecao', vazioOpcao: '— escolher série —', opcoes: series.map((s) => ({ v: s.id, t: s.nome })) },
        { nome: 'bimestre', label: 'Bimestre', tipo: 'selecao', vazioOpcao: '— escolher bimestre —', opcoes: [['1', '1º bimestre'], ['2', '2º bimestre'], ['3', '3º bimestre'], ['4', '4º bimestre']].map(([v, t]) => ({ v, t })) },
        { nome: 'disciplinaId', label: 'Disciplina', tipo: 'selecao', vazioOpcao: '— escolher disciplina —', opcoes: [...SALAS.map((s) => ({ v: s.id, t: s.nome })), ...discs.map((d) => ({ v: d.id, t: d.nome }))] },
        { nome: 'videoUrl', label: 'Link do vídeo do tópico (opcional)', tipo: 'url', placeholder: 'https://… ou caminho local videos/x.mp4' },
      ],
      onOk: async (d) => {
        if (!d.serieId || !d.bimestre || !d.disciplinaId) { toast('Preencha série, bimestre e disciplina.'); return; }
        const rec = item ? { ...item, tema: d.tema, resumo: d.resumo, serieId: d.serieId, bimestre: Number(d.bimestre), disciplinaId: d.disciplinaId, videoUrl: d.videoUrl || '' } : { id: uid(), tema: d.tema, resumo: d.resumo || '', serieId: d.serieId, bimestre: Number(d.bimestre), disciplinaId: d.disciplinaId, videoUrl: d.videoUrl || '' };
        await db.salva('gradeItens', rec);
        toast('Grade atualizada. O aluno já vê na rota de estudo.');
        painel.recarregar();
      },
      onCancelar: () => painel.recarregar(),
    }));
  }

  // ---------- Assistente IA ----------
  async function tabIA(c) {
    let ia = (await db.lista('ia'))[0];
    if (!ia) ia = await db.salva('ia', { id: '1', metodologia: '', prompts: [], promptAdotado: '' });
    c.appendChild(form({
      titulo: '01 · Metodologia de análise', sub: 'O assistente responde com o método da escola', botaoOk: 'Salvar metodologia',
      valores: { metodologia: ia.metodologia || '' },
      campos: [
        { nome: 'metodologia', label: 'Minha metodologia (cole aqui o texto ou o resumo do PDF/TXT)', tipo: 'area', linhas: 6, placeholder: 'Ex.: acompanhar o aluno com metas claras…' },
      ],
      onOk: async (d) => { await db.salva('ia', { ...ia, metodologia: d.metodologia }); ia = (await db.lista('ia'))[0]; toast('Metodologia salva.'); },
      onCancelar: () => painel.recarregar(),
    }));
    c.appendChild(el('h3', 'tabela-titulo', '02 · Biblioteca de prompts (até 10)'));
    const lista = el('div', 'lista-prompts');
    for (const p of ia.prompts || []) {
      const div = el('div', 'prompt-item' + ((ia.promptAdotado || '') === p.texto ? ' adotado' : ''));
      div.appendChild(el('p', '', p.texto));
      const d = el('div', 'linhas-botoes');
      btn(d, ia.promptAdotado === p.texto ? 'Adotado ✓' : 'Adotar', () => {
        ia.promptAdotado = ia.promptAdotado === p.texto ? '' : p.texto;
        db.salva('ia', { ...ia }).then(() => painel.recarregar());
      }, ia.promptAdotado === p.texto ? 'ok' : undefined);
      btn(d, 'Excluir', () => {
        ia.prompts = ia.prompts.filter((x) => x.id !== p.id);
        if (ia.promptAdotado === p.texto) ia.promptAdotado = '';
        db.salva('ia', { ...ia }).then(() => painel.recarregar());
      });
      div.appendChild(d);
      lista.appendChild(div);
    }
    c.appendChild(lista);
    c.appendChild(form({
      titulo: 'Escrever prompt', botaoOk: 'Salvar prompt',
      campos: [{ nome: 'texto', label: 'Prompt', tipo: 'area', linhas: 2, obrigatorio: true }],
      onOk: async (d) => {
        if ((ia.prompts || []).length >= 10) { toast('Máximo de 10 prompts.'); return; }
        ia.prompts = [...(ia.prompts || []), { id: uid(), texto: d.texto }];
        await db.salva('ia', { ...ia });
        toast('Prompt salvo.');
        painel.recarregar();
      },
      onCancelar: () => painel.recarregar(),
    }));
    c.appendChild(el('p', 'tabela-nota', ia.promptAdotado ? 'Prompt adotado: <b>' + ia.promptAdotado + '</b>' : 'Nenhum prompt adotado ainda.'));
  }

  // ---------- Peças auxiliares locais ----------
  function listaSimples(itens, rotulo, { aoExcluir, novo }, alvo) {
    const ul = el('ul', 'lista-simples');
    if (!itens.length) alvo.appendChild(el('p', 'dim sec-corpo-p', 'Vazio.'));
    for (const it of itens) {
      const li = el('li');
      li.appendChild(el('span', '', rotulaNode(rotulo(it))));
      const bDel = el('button', 'btn-mini', 'Excluir');
      bDel.addEventListener('click', () => aoExcluir(it));
      li.appendChild(bDel);
      ul.appendChild(li);
    }
    alvo.appendChild(ul);
    alvo.appendChild(novo);
  }
  function campoRapido(titulo, placeholder, aoSalvar) {
    const box = el('form', 'campo-rapido');
    const inp = el('input'); inp.placeholder = placeholder; inp.required = true;
    const b = el('button', 'btn btn-prim', titulo);
    b.type = 'submit';
    box.append(inp, b);
    box.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!inp.value.trim()) return;
      await aoSalvar(inp.value.trim());
      inp.value = '';
    });
    return box;
  }
}

let estadoFiltroResp = 'todos';
const rotuloTipo = (t) => ({ pai: 'Pai', mae: 'Mãe', parente: 'Parente', tutor: 'Tutor', todos: 'Todos' }[t] || t);
function cab(...rotulos) {
  const th = el('thead'); const tr = el('tr');
  for (const r of rotulos) tr.appendChild(el('th', '', r));
  th.appendChild(tr);
  return th;
}
function td(nodo) { const n = el('td'); if (nodo instanceof Node) n.appendChild(nodo); else n.textContent = nodo ?? ''; return n; }
function tr1(n) { const tr = el('tr'); tr.appendChild(n); return tr; }
function tdv(v) { const n = el('td'); n.innerHTML = v; return n; }
function rotulaNode(html) { const s = el('span'); s.innerHTML = html; return s; }
function botaoNovo(txt, fn) { const b = el('button', 'btn btn-prim', txt); b.addEventListener('click', fn); return b; }
function btn(container, txt, fn, cls) { const b = el('button', 'btn-mini' + (cls ? ' ' + cls : ''), txt); b.addEventListener('click', fn); container.appendChild(b); return b; }
function confirmar2(titulo, texto, aoSim, c) {
  c.innerHTML = '';
  c.appendChild(confirmar({ titulo, texto, aoSim, aoNao: () => painel.recarregar() }));
}
function nomeDisc(id) { const s = SALAS.find((x) => x.id === id); return s ? s.nome : id; }
