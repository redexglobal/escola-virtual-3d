import { createRequire } from 'module';
const require = createRequire('/Users/macbookair/projetos/Toca-Card/x.js');
const { chromium } = require('playwright');

async function cenario(nome, seedAntigo) {
  const dir = '/tmp/esp-' + nome;
  require('fs').rmSync(dir, { recursive: true, force: true });
  const b = await chromium.launchPersistentContext(dir, { viewport: { width: 1280, height: 800 }, locale: 'pt-BR' });
  const p = b.pages()[0] || await b.newPage();
  const erros = [];
  p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  if (seedAntigo) {
    await p.goto('http://localhost:8811/testes/seed-antigo.html', { waitUntil: 'load' });
    await p.waitForFunction(() => document.title === 'SEED-V1-OK', null, { timeout: 6000 });
    console.log(`[ ${nome} ] banco v1 criado`);
  }
  const t0 = Date.now();
  try {
    await p.goto('http://localhost:8811/', { waitUntil: 'load' });
    await p.waitForSelector('#btnEntrar:not([disabled])', { timeout: 20000 });
    const abriuEm = ((Date.now() - t0) / 1000).toFixed(1);
    await p.click('#btnEntrar');
    await p.waitForTimeout(900);
    await p.screenshot({ path: '/tmp/final_' + nome + '_recepcao.png' });
    const sessao = await p.evaluate(async () => { const m = await import('/dados.js'); return m.db.porId('config', 'sessao').then(JSON.stringify); });
    console.log(`[ ${nome} ] entrou em ${abriuEm}s · sessao=${sessao} · erros=${erros.length ? erros.join(' | ') : 'nenhum'}`);
  } finally {
    await b.close();
  }
}

await cenario('novo', false);
await cenario('antigo', true);
