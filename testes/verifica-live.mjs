import { createRequire } from 'node:module';
import { rmSync } from 'node:fs';
const require = createRequire('/Users/macbookair/projetos/Toca-Card/x.js');
const { chromium } = require('playwright');
const URL = 'https://redexglobal.github.io/escola-virtual-3d/';

for (const [nome, vis] of [['web', { width: 1440, height: 900 }], ['cel', { width: 390, height: 844 }]]) {
  const dir = `/tmp/live-${nome}`; rmSync(dir, { recursive: true, force: true });
  const b = await chromium.launchPersistentContext(dir, { ...vis, deviceScaleFactor: 2 });
  try {
    const p = b.pages()[0] || await b.newPage();
    const erros = []; p.on('pageerror', e => erros.push(String(e))); p.on('console', m => m.type() === 'error' && erros.push(m.text()));
    const r = await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log(`[${nome}] HTTP ${r.status()}`);
    await p.waitForSelector('#btnEntrar', { timeout: 60000 });
    await p.screenshot({ path: `docs/capturas/live_${nome}_entrada.png` });
    if (nome === 'web') {
      await p.click('#btnEntrar');
      await p.waitForFunction(() => window.__escola && !document.querySelector('#entrada')?.classList.contains('aberta'), { timeout: 20000 });
      await p.waitForTimeout(6500);
      await p.click('#btnMenu');
      await p.waitForTimeout(800);
      await p.screenshot({ path: 'docs/capturas/live_web_menu.png' });
      await p.keyboard.press('Escape');
    } else {
      await p.click('#btnEntrar');
      await p.waitForTimeout(5500);
      await p.screenshot({ path: 'docs/capturas/live_cel_recepcao.png' });
    }
    console.log(`[${nome}] erros de página: ${erros.length ? erros.join(' | ') : 'nenhum'}`);
  } finally { await b.close(); }
}
console.log('OK live');
process.exit(0);
