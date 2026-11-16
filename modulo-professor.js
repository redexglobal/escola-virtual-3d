// Painel do Professor: minhas turmas, postar aula (sai na TV da sala 3D), resultados e avisos.
import { db, money, dataBr, dataHoraBr, uid } from './dados.js';
import { el, vazio, abrePainel, tabela, form, toast, estadoApp } from './telas.js';

const nomeMateria = (id, disc) => (disc || []).find((d) => d.id === id)?.nome || id;

export async function professor() {
  const disc = await db.lista('disciplinas');

  const painel = abrePainel({
    titulo: 'Professor',
    sub: 'Poste a aula e ela aparece na TV da sala 3D',
    largo: 'min(980px, 100%)',
    tabs: [
      { id: 'minhas', nome: 'Minhas turmas', render: tabMinhas },
      { id: 'postar', nome: 'Postar aula', render: tabPostar },
      { id: 'resultados', nome: 'Resultados', render: tabResultados },
      { id: 'aviso', nome: 'Aviso à sala', render: tabAviso },
    ],
    ativo: 'minhas',
  });
  return painel;

  async function meusDados() {
    const [profs, turmas, matriculas, alunos] = await Promise.all([db.lista('professores'), db.lista('turmas'), db.lista('matriculas'), db.lista('alunos')]);
    if (!estadoApp.professorId && profs.length) estadoApp.professorId = profs[0].id;
    const eu = profs.find((p) => p.id === estadoApp.professorId) || profs[0];
    const minhas = eu ? turmas.filter((t) => t.tipo === 'oficial' && eu.materiaIds.includes(t.disciplinaId)) : [];
    const dosAlunos = (turmaId) => matriculas.filter((m) => m.turmaId === turmaId).map((m) => alunos.find((a) => a.id === m.alunoId)).filter(Boolean);
    return { profs, eu, minhas, dosAlunos };
  }

  async function barraProfessor(corpo) {
    const { profs } = await meusDados();
    if (!profs.length) return;
    const barra = el('div', 'barra-prof', `Você está atuando como: `);
    const sel = document.createElement('select');
    for (const p of profs) {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.nome + (p.materiaIds?.length ? ` (${p.materiaIds.map((i) => i.slice(0, 4)).join(', ')})` : '');
      sel.appendChild(o);
    }
    sel.value = estadoApp.professorId || profs[0].id;
    sel.addEventListener('change', async () => {
      estadoApp.professorId = sel.value;
      await db.salva('config', { id: 'sessao', ...(await db.porId('config', 'sessao')), papel: 'professor', professorId: estadoApp.professorId });
      painel.recarregar();
    });
    barra.appendChild(sel);
    corpo.prepend(barra);
  }

  async function tabMinhas(corpo) {
    const { eu, minhas, dosAlunos } = await meusDados();
    await barraProfessor(corpo);
    if (!eu) { corpo.appendChild(vazio('Nenhum professor cadastrado.', 'Cadastre no painel Direção.')); return corpo; }
    if (!minhas.length) { corpo.appendChild(vazio(`Você não tem turma oficial na sua matéria ainda.`, 'A secretaria cria a turma e vincula ao professor.')); return corpo; }
    for (const t of minhas) {
      const alunos = dosAlunos(t.id);
      const card = el('div', 'card-turma');
      card.innerHTML = `
        <div class="ct-topo"><b>${t.nome}</b><span class="chip">Sala 3D: ${nomeMateria(t.disciplinaId, disc)}</span></div>
        <div class="ct-alunos">${alunos.length ? alunos.map((a) => `<span class="aluno-pill">${a.nome}</span>`).join('') : '<i>nenhuma matrícula oficial ainda</i>'}</div>`;
      corpo.appendChild(card);
    }
    const dica = el('p', 'dica-suave', 'A placa na porta da sala 3D mostra o nome da sua turma. O quadro de turmas da recepção leva o aluno até ela com um toque.');
    corpo.appendChild(dica);
    return corpo;
  }

  async function tabPostar(corpo) {
    await barraProfessor(corpo);
    const { eu } = await meusDados();
    const mats = eu ? eu.materiaIds.map((i) => nomeMateria(i, disc)) : [];
    corpo.appendChild(el('p', 'dica-suave', `Sua(s) matéria(s): ${mats.join(', ') || '—'}. A aula mais recente de cada matéria é exibida na TV da sala 3D quando não há vídeo enviado.`));
    corpo.appendChild(form({
      titulo: 'Postar aula para a sala 3D',
      campos: [
        { nome: 'materiaId', label: 'Matéria', tipo: 'selecao', opcoes: (eu ? eu.materiaIds : []).map((i) => ({ v: i, t: nomeMateria(i, disc) })) },
        { nome: 'titulo', label: 'Título da aula', tipo: 'text' },
        { nome: 'texto', label: 'Conteúdo (aparece na TV)', tipo: 'area' },
        { nome: 'link', label: 'Link ou arquivo (opcional)', tipo: 'text', placeholder: 'https://… ou videos/matematica.mp4' },
      ],
      botaoOk: 'Publicar na TV da sala',
      async onOk(v) {
        if (!v.titulo || !v.texto) { toast('Título e conteúdo são obrigatórios.'); return; }
        await db.salva('aulasPosts', { id: uid(), materiaId: v.materiaId, titulo: v.titulo, texto: v.texto, link: v.link || '', recuperacao: false, quando: Date.now() });
        toast('📺 Aula publicada — já está na TV da sala 3D.');
        painel.recarregar();
      },
    }));
    const ultimos = await db.lista('aulasPosts');
    const meus = ultimos.filter((p) => eu && eu.materiaIds.includes(p.materiaId)).sort((a, b) => (b.quando || 0) - (a.quando || 0)).slice(0, 8);
    if (meus.length) {
      corpo.appendChild(el('h4', '', 'Últimas aulas publicadas por você'));
      const ul = el('ul', 'lista-postagens');
      for (const p of meus) ul.innerHTML += `<li><b>${nomeMateria(p.materiaId, disc)}</b> · ${p.titulo}${p.quando ? ` <i>(${dataHoraBr(p.quando)})</i>` : ''}</li>`;
      corpo.appendChild(ul);
    }
    return corpo;
  }

  async function tabResultados(corpo) {
    await barraProfessor(corpo);
    const { eu } = await meusDados();
    const [log, notas, alunos] = await Promise.all([db.lista('exerciciosLog'), db.lista('notas'), db.lista('alunos')]);
    const mats = eu ? eu.materiaIds : [];
    corpo.appendChild(el('h4', '', 'Exercícios feitos na escola 3D'));
    if (!log.length) corpo.appendChild(vazio('Nenhum exercício respondido ainda.', 'O aluno clica em "Fazer exercício" dentro da sala.'));
    for (const m of mats) {
      const meus = log.filter((l) => l.salaId === m);
      if (!meus.length) continue;
      const acertos = meus.filter((l) => l.acertou).length;
      const pct = Math.round((100 * acertos) / meus.length);
      corpo.appendChild(el('p', 'linha-resultado', `${nomeMateria(m, disc)}: ${meus.length} respostas · <b style="color:${pct >= 70 ? 'var(--certo)' : 'var(--errado)'}">${pct}% de acerto</b>`));
    }
    const notasMats = notas.filter((n) => mats.includes(n.materiaId));
    if (notasMats.length) {
      corpo.appendChild(el('h4', '', 'Notas registradas'));
      const tb = await tabela(null, {
        lista: () => Promise.resolve(notasMats),
        colunas: [
          { f: (n) => alunos.find((a) => a.id === n.alunoId)?.nome || n.alunoId },
          { f: (n) => nomeMateria(n.materiaId, disc) },
          { f: (n) => 'Bim. ' + n.bimestre },
          { f: (n) => n.valor },
        ],
      });
      corpo.appendChild(tb);
    }
    return corpo;
  }

  async function tabAviso(corpo) {
    await barraProfessor(corpo);
    const { eu, minhas } = await meusDados();
    corpo.appendChild(form({
      titulo: 'Enviar aviso para o chat da sala (Ao vivo)',
      campos: [
        { nome: 'texto', label: 'Mensagem', tipo: 'area', placeholder: 'Ex.: Amanhã a aula de frações começa às 19h, pessoal!' },
      ],
      botaoOk: '📣 Enviar aviso',
      async onOk(v) {
        if (!v.texto) { toast('Escreva a mensagem do aviso.'); return; }
        await db.salva('chatAovivo', { id: uid(), quando: Date.now(), tipo: 'sistema', autor: (eu ? 'Prof. ' + eu.nome : 'Professor') + (minhas.length ? ` · ${nomeMateria(minhas[0].disciplinaId, disc)}` : ''), texto: v.texto, audio: '' });
        toast('Aviso enviado para o chat da sala.');
        painel.recarregar();
      },
    }));
    const recent = (await db.lista('chatAovivo')).sort((a, b) => b.quando - a.quando).slice(0, 6);
    if (recent.length) {
      corpo.appendChild(el('h4', '', 'Últimas mensagens da sala'));
      for (const r of recent) corpo.appendChild(el('p', 'chat-linha', `<b>${r.autor || r.tipo}:</b> ${r.texto}`));
    }
    return corpo;
  }
}
