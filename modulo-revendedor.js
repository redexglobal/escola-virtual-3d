// Painel Revendedor: convites com código (padrão do Guia Entregas: /convite/CODIGO), créditos e planos.
import { db, uid, dataBr } from './dados.js';
import { el, vazio, abrePainel, form, toast } from './telas.js';
import { AUTORIA } from './conteudo.js';

const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const novoCodigo = () => Array.from({ length: 6 }, () => letras[(Math.random() * letras.length) | 0]).join('');
const linkConvite = (codigo) => `${location.origin}${location.pathname}?convite=${codigo}`;
const linkSite = () => location.href.split('#')[0].split('?')[0];

export async function revendedor() {
  const painel = abrePainel({
    titulo: 'Revendedor',
    sub: 'Leve a escola para outras escolas: código de convite, créditos e planos',
    largo: 'min(980px, 100%)',
    tabs: [
      { id: 'convites', nome: 'Convites', render: tabConvites },
      { id: 'creditos', nome: 'Créditos', render: tabCreditos },
      { id: 'planos', nome: 'Planos', render: tabPlanos },
    ],
    ativo: 'convites',
  });
  return painel;

  async function tabConvites(corpo) {
    corpo.appendChild(el('p', 'dica-suave', 'Cada convite gera um código de 6 caracteres e um link. Quem abre o link entra na demonstração já com o registro da origem — igual ao /convite/CODIGO do Guia Entregas.'));
    corpo.appendChild(form({
      titulo: 'Novo convite',
      campos: [
        { nome: 'escola', label: 'Escola ou interessado (opcional)', tipo: 'text', placeholder: 'Ex.: Escola Municipal Centro' },
      ],
      botaoOk: 'Gerar código',
      async onOk(v) {
        const codigo = novoCodigo();
        await db.salva('convites', { id: uid(), codigo, escola: v.escola || '', quando: Date.now(), usadoQuando: 0 });
        toast(`Código ${codigo} criado.`);
        painel.recarregar();
      },
    }));
    const convites = (await db.lista('convites')).sort((a, b) => b.quando - a.quando);
    if (!convites.length) corpo.appendChild(vazio('Nenhum convite gerado ainda.', 'Gere o primeiro acima.'));
    for (const c of convites) {
      const card = el('div', 'card-convite');
      const usado = c.usadoQuando ? ` · <b style="color:var(--certo)">usado em ${dataBr(c.usadoQuando)}</b>` : '';
      const link = linkConvite(c.codigo);
      card.innerHTML = `
        <div class="cv-topo"><span class="cv-codigo">${c.codigo}</span><b>${c.escola || 'Sem nome'}</b><i>${dataBr(c.quando)}${usado}</i></div>
        <div class="cv-links">
          <button class="btn btn-conv" type="button">📋 Copiar link</button>
          <a class="btn btn-conv" target="_blank" rel="noopener" href="${AUTORIA.whatsapp}?text=${encodeURIComponent('Conheça a Escola Virtual 3D: ' + link)}">WhatsApp</a>
          <a class="btn btn-conv" target="_blank" rel="noopener" href="${link}">Abrir</a>
        </div>`;
      card.querySelector('.btn-conv').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(link); toast('Link copiado.'); }
        catch { prompt('Copie o link:', link); }
      });
      corpo.appendChild(card);
    }
    return corpo;
  }

  async function tabCreditos(corpo) {
    const convites = await db.lista('convites');
    const usados = convites.filter((c) => c.usadoQuando).length;
    corpo.appendChild(el('h4', '', 'Seu saldo'));
    corpo.appendChild(el('p', 'saldo-grande', `🪙 <b>${usados}</b> créditos`));
    corpo.appendChild(el('p', 'dica-suave', 'Cada escola que entrar pela primeira vez pelo seu link vale 1 crédito. Níveis de parceiro: <b>5</b> → Prata, <b>15</b> → Ouro, <b>40</b> → Diamante (regras do programa em definição com a Kairós Digital).'));
    const metas = [[5, 'Prata'], [15, 'Ouro'], [40, 'Diamante']];
    for (const [limite, nome] of metas) {
      const pct = Math.min(100, Math.round((100 * usados) / limite));
      corpo.appendChild(el('div', 'barra-metas', `<i style="width:${pct}%"></i>`));
      corpo.appendChild(el('p', 'meta-linha', `${nome}: ${Math.min(usados, limite)}/${limite}`));
    }
    const historico = convites.filter((c) => c.usadoQuando).sort((a, b) => b.usadoQuando - a.usadoQuando);
    if (historico.length) {
      corpo.appendChild(el('h4', '', 'Ativações'));
      for (const c of historico) corpo.appendChild(el('p', 'chat-linha', `<b>${c.codigo}</b> · ${c.escola || 'sem nome'} · ${dataBr(c.usadoQuando)}`));
    }
    return corpo;
  }

  function tabPlanos(corpo) {
    corpo.appendChild(el('p', 'dica-suave', 'Valores sugeridos para a proposta comercial — o valor final é fechado com a escola em proposta individual.'));
    const planos = [
      ['Essencial', 'R$ 249/mês', ['Campus 3D com as 6 salas', 'Área do aluno (boletim, metas, financeiro)', 'Painéis da direção e do professor', 'Funciona em qualquer navegador']],
      ['Completa', 'R$ 449/mês', ['Tudo do Essencial', 'Ao vivo, mensageiro e ligação de voz', 'Feira de reforço e biblioteca de QR codes', 'Gamificação (níveis, medalhas, missões)']],
      ['Premium', 'R$ 849/mês', ['Tudo do Completa', 'Educador IA com metodologia própria', 'Branding e conteúdo da sua escola', 'Evolução para servidor PHP + banco próprio']],
    ];
    const grade = el('div', 'grade-planos');
    planos.forEach(([nome, preco, itens], i) => {
      const card = el('div', 'card-plano' + (i === 1 ? ' destaque' : ''));
      card.innerHTML = `<b>${nome}</b><span class="preco">${preco}</span>` + itens.map((t) => `<li>✓ ${t}</li>`).join('');
      grade.appendChild(card);
    });
    corpo.appendChild(grade);
    corpo.appendChild(el('p', '', `Falar com a equipe: <a href="${AUTORIA.whatsapp}" target="_blank" rel="noopener">WhatsApp da Kairós Digital</a>`));
    return corpo;
  }
}
