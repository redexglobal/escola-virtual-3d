// Módulos da área do aluno (espelham o painel do MonitON):
// Minha área = boletim, metas, certificado, histórico, financeiro e anotações com mídia.
import { db, uid, money, dataBr, dataHoraBr } from './dados.js';
import { el, abrePainel, fechaPainel, tabela, form, vazio, confirmar, toast, estadoApp } from './telas.js';
import { SALAS } from './conteudo.js';

const salaPorId = Object.fromEntries(SALAS.map((s) => [s.id, s]));

function nomeDisciplina(id) { return salaPorId[id] ? salaPorId[id].nome : id; }

export async function minhaArea({ falar } = {}) {
  const todosAlunos = await db.lista('alunos');
  if (!todosAlunos.length) {
    abrePainel({
      titulo: 'Minha área', sub: 'Espaço do aluno',
      tabs: [{ id: 'vazio', nome: 'Boletim', render: async (c) => c.appendChild(vazio('Nenhum aluno cadastrado.', 'Cadastre o primeiro aluno na Secretaria.')) }],
    });
    return;
  }
  if (!estadoApp.alunoId || !todosAlunos.some((a) => a.id === estadoApp.alunoId)) estadoApp.alunoId = todosAlunos[0].id;

  const seletor = el('div', 'minha-area-topo');
  const sel = el('select', '');
  sel.setAttribute('aria-label', 'Escolher aluno');
  for (const a of todosAlunos) { const o = el('option', '', a.nome); o.value = a.id; sel.appendChild(o); }
  sel.value = estadoApp.alunoId;
  seletor.appendChild(el('span', 'minha-area-rot', 'Estudante'));
  seletor.appendChild(sel);
  sel.addEventListener('change', () => {
    estadoApp.alunoId = sel.value;
    painel.recarregar();
  });

  const painel = abrePainel({
    titulo: 'Minha área', sub: 'Boletim, metas, certificado, histórico e financeiro do estudante', largo: true,
    tabs: [
      { id: 'boletim', nome: 'Boletim', render: tabBoletim },
      { id: 'metas', nome: 'Metas', render: tabMetas },
      { id: 'certificado', nome: 'Certificado', render: tabCertificado },
      { id: 'historico', nome: 'Histórico', render: tabHistorico },
      { id: 'financeiro', nome: 'Financeiro', render: tabFinanceiro },
      { id: 'anotacoes', nome: 'Anotações', render: tabAnotacoes },
    ],
  });
  // seletor fica sobre as abas
  requestAnimationFrame(() => {
    const abas = document.querySelector('#painel .painel-abas');
    if (abas) abas.parentNode.insertBefore(seletor, abas);
  });
  return painel;
}

async function tabBoletim(c) {
  const alunoId = estadoApp.alunoId;
  c.appendChild(await tabela('notas', {
    lista: () => db.lista('notas').then((l) => l.filter((n) => n.alunoId === alunoId)),
    colunas: [
      { k: 'materiaId', f: (n) => nomeDisciplina(n.materiaId) },
      { k: 'bimestre', f: (n) => n.bimestre + 'º bimestre' },
      { k: 'valor', f: (n) => el('strong', 'nota-' + (n.valor >= 7 ? 'ok' : 'baixa'), String(n.valor)) },
    ],
  }, { vazioMsg: 'Sem notas lançadas para este aluno ainda.' }));
  c.appendChild(el('p', 'tabela-nota', 'A média aparece quando o professor lança notas no sistema da escola.'));
}

async function tabMetas(c) {
  const alunoId = estadoApp.alunoId;
  const lista = await db.lista('metas').then((l) => l.filter((m) => m.alunoId === alunoId));
  const box = el('div', 'lista-metas');
  for (const m of lista) {
    const li = el('label', 'meta' + (m.atingida ? ' atingida' : ''));
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!m.atingida;
    cb.addEventListener('change', async () => {
      await db.salva('metas', { ...m, atingida: cb.checked });
      li.classList.toggle('atingida', cb.checked);
      if (cb.checked) toast('Meta concluída! 🎉');
    });
    const sp = el('span', '', m.texto);
    li.append(cb, sp);
    box.appendChild(li);
  }
  if (!lista.length) c.appendChild(vazio('Nenhuma meta ainda.', 'Defina uma meta de estudo abaixo.'));
  c.appendChild(box);
  const nova = form({
    titulo: 'Nova meta', botaoOk: 'Criar meta',
    campos: [{ nome: 'texto', label: 'O que você quer alcançar?', tipo: 'area', obrigatorio: true, placeholder: 'Ex.: chegar a 9 em Matemática' }],
    onOk: async (d) => {
      await db.salva('metas', { id: uid(), alunoId, texto: d.texto, atingida: false });
      painel.recarregar();
      toast('Meta criada.');
    },
    onCancelar: () => painel.recarregar(),
  });
  nova.classList.remove('form-aberto');
  c.appendChild(nova);
}

async function tabCertificado(c) {
  const alunoId = estadoApp.alunoId;
  const certs = await db.lista('certificados').then((l) => l.filter((x) => x.alunoId === alunoId));
  if (!certs.length) {
    c.appendChild(vazio('Nenhum certificado emitido.', 'Ao concluir um curso, o certificado aparece aqui.'));
    return;
  }
  for (const ct of certs) {
    const al = await db.porId('alunos', alunoId);
    const turma = await db.porId('turmas', ct.turmaId);
    const cartao = el('article', 'certificado');
    cartao.innerHTML = `
      <div class="cert-borda"></div>
      <p class="cert-selo">Kairós · Escola Imersiva</p>
      <h3>Certificado</h3>
      <p class="cert-texto">Confere que <b>${al ? al.nome : ''}</b> concluiu<br><b>${ct.titulo}</b></p>
      <p class="cert-data">Emitido em ${dataBr(ct.emitidoEm)} · Turma: ${turma ? turma.nome : '—'}</p>`;
    const imprime = el('button', 'btn', 'Imprimir certificado');
    imprime.addEventListener('click', () => {
      document.body.classList.add('somente-impressao');
      document.querySelector('.certifica-o').hidden = false;
      const cont = el('div', 'certifica-o'); cont.appendChild(cartao.cloneNode(true)); document.body.appendChild(cont);
      setTimeout(() => { window.print(); }, 50);
      addEventListener('afterprint', () => {
        document.body.classList.remove('somente-impressao');
        document.querySelector('.certifica-o')?.remove();
        const oc = cont; oc.remove();
      }, { once: true });
    });
    cartao.appendChild(imprime);
    c.appendChild(cartao);
  }
}

async function tabHistorico(c) {
  const alunoId = estadoApp.alunoId;
  const [notas, certs, extrato, compras, turmas] = await Promise.all([
    db.lista('notas'), db.lista('certificados'), db.lista('extrato'), db.lista('compras'), db.lista('turmas'),
  ]);
  const nomeTurma = Object.fromEntries(turmas.map((t) => [t.id, t.nome]));
  const meusNotas = notas.filter((n) => n.alunoId === alunoId);
  const box = el('div', 'historico-box');
  box.appendChild(el('h3', '', 'Desempenho por disciplina'));
  if (!meusNotas.length) box.appendChild(p('Sem notas lançadas ainda.'));
  const porDisc = {};
  for (const n of meusNotas) {
    const arr = (porDisc[n.materiaId] ||= []);
    arr.push(n.valor);
  }
  for (const [id, vals] of Object.entries(porDisc)) {
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    box.appendChild(p(`${nomeDisciplina(id)}: média ${media.toFixed(1).replace('.', ',')} (${vals.length} nota${vals.length > 1 ? 's' : ''})`));
  }
  box.appendChild(el('h3', '', 'Conclusões'));
  const meusCerts = certs.filter((x) => x.alunoId === alunoId);
  if (!meusCerts.length) box.appendChild(p('Nenhuma conclusão registrada.'));
  for (const ct of meusCerts) box.appendChild(p(`${dataBr(ct.emitidoEm)} — ${ct.titulo}`));
  const eventos = [
    ...extrato.filter((e) => e.alunoId === alunoId).map((e) => [e.quando, e.descricao]),
    ...compras.filter((x) => x.alunoId === alunoId).map((x) => [x.quando, 'Compra: ' + (nomeTurma[x.turmaId] || 'curso')]),
  ].sort((a, b) => b[0] - a[0]).slice(0, 8);
  box.appendChild(el('h3', '', 'Últimos registros'));
  for (const [q, desc] of eventos) box.appendChild(p(`${dataBr(q)} — ${desc}`));
  c.appendChild(box);
  function p(t) { const n = el('p', '', t); return n; }
}

async function tabFinanceiro(c) {
  const alunoId = estadoApp.alunoId;
  const [contratos, compras, extrato] = await Promise.all([
    db.lista('contratos'), db.lista('compras'), db.lista('extrato'),
  ]);
  const meusContratos = contratos.filter((x) => x.alunoId === alunoId);
  c.appendChild(el('h3', 'tabela-titulo', 'Contratos'));
  if (!meusContratos.length) c.appendChild(vazio('Nenhum contrato ativo.'));
  for (const ct of meusContratos) {
    const turma = await db.porId('turmas', ct.turmaId);
    const div = el('div', 'cartao-pagto');
    const faltam = ct.parcelas - ct.parcelasPagas;
    div.innerHTML = `
      <div class="pagto-nome">${turma ? turma.nome : 'Turma'}</div>
      <div class="pagto-linha"><span>Total</span><b>${money(ct.valorTotal)}</b></div>
      <div class="pagto-linha"><span>Parcelas</span><b>${ct.parcelasPagas}/${ct.parcelas}</b></div>`;
    if (faltam > 0) {
      const bPag = el('button', 'btn btn-prim', 'Pagar próxima parcela (' + money(ct.valorTotal / ct.parcelas) + ')');
      bPag.addEventListener('click', async () => {
        await db.salva('contratos', { ...ct, parcelasPagas: ct.parcelasPagas + 1 });
        await db.salva('extrato', { id: uid(), alunoId, descricao: 'Parcela ' + (ct.parcelasPagas + 1) + ' — ' + (turma ? turma.nome : 'curso'), valor: ct.valorTotal / ct.parcelas, tipo: 'pagamento', quando: Date.now() });
        toast(faltam === 1 ? 'Última parcela paga! Contrato quitado.' : 'Pagamento recebido.');
        painel.recarregar();
      });
      div.appendChild(bPag);
    } else {
      div.appendChild(el('p', 'pagto-ok', '✓ Contrato quitado'));
    }
    c.appendChild(div);
  }
  c.appendChild(el('h3', 'tabela-titulo', 'Compras de reforço'));
  const minhasCompras = compras.filter((x) => x.alunoId === alunoId);
  if (!minhasCompras.length) c.appendChild(p2('Nenhuma compra registrada.'));
  for (const cp of minhasCompras) {
    const turma = await db.porId('turmas', cp.turmaId);
    c.appendChild(p2(`${dataBr(cp.quando)} — ${turma ? turma.nome : 'Curso'} · ${money(cp.valor)}`));
  }
  c.appendChild(el('h3', 'tabela-titulo', 'Extrato de pagamentos'));
  c.appendChild(await tabela('extrato', {
    lista: () => db.lista('extrato').then((l) => l.filter((x) => x.alunoId === alunoId).sort((a, b) => b.quando - a.quando)),
    colunas: [
      { k: 'quando', f: (x) => dataHoraBr(x.quando) },
      { k: 'descricao' },
      { k: 'valor', f: (x) => money(x.valor) },
    ],
  }, { vazioMsg: 'Extrato vazio.' }));
  function p2(t) { const n = el('p', 'tabela-nota', t); return n; }
}

async function tabAnotacoes(c) {
  const alunoId = estadoApp.alunoId;
  const todas = await db.lista('anotacoes').then((l) => l.filter((a) => a.alunoId === alunoId));
  for (const a of todas) {
    const div = el('div', 'anotacao');
    div.appendChild(el('p', 'anotacao-mat', nomeDisciplina(a.materiaId)));
    if (a.midia) {
      const img = el('img', 'anotacao-img');
      img.src = a.midia; img.alt = 'Imagem da anotação';
      div.appendChild(img);
    }
    div.appendChild(el('p', '', a.texto));
    const bDel = el('button', 'btn-mini', 'Remover');
    bDel.addEventListener('click', () => {
      const wrap = confirmar({ titulo: 'Remover anotação?', sim: 'Remover', aoSim: async () => { await db.remove('anotacoes', a.id); painel.recarregar(); }, aoNao: () => painel.recarregar() });
      const corpo = document.querySelector('#painel .painel-corpo');
      corpo.innerHTML = ''; corpo.appendChild(wrap);
    });
    div.appendChild(bDel);
    c.appendChild(div);
  }
  if (!todas.length) c.appendChild(vazio('Sem anotações.', 'Adicione sua primeira anotação (texto ou foto) no formulário abaixo.'));
  const nova = form({
    titulo: 'Nova anotação', botaoOk: 'Salvar anotação',
    campos: [
      { nome: 'materiaId', label: 'Matéria', tipo: 'selecao', opcoes: SALAS.map((s) => ({ v: s.id, t: s.nome })) },
      { nome: 'texto', label: 'Anotação', tipo: 'area', obrigatorio: true, placeholder: 'O que você quer guardar?' },
      { nome: 'midia', label: 'Foto ou imagem (opcional)', tipo: 'arquivo' },
    ],
    onOk: async (d) => {
      let midia = '';
      if (d.midia instanceof File && d.midia.size < 1500 * 1024) {
        midia = await new Promise((res) => {
          const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(''); r.readAsDataURL(d.midia);
        });
      }
      await db.salva('anotacoes', { id: uid(), alunoId, materiaId: d.materiaId, texto: d.texto, midia });
      painel.recarregar();
      toast('Anotação salva.');
    },
    onCancelar: () => painel.recarregar(),
  });
  nova.classList.remove('form-aberto');
  c.appendChild(nova);
}
