import { createRequire } from 'module';
const require = createRequire('/Users/macbookair/projetos/Toca-Card/x.js');
const { chromium } = require('playwright');

const erros = [];
require('fs').rmSync('/tmp/esp-pagina', { recursive: true, force: true });
const browser = await chromium.launchPersistentContext('/tmp/esp-pagina', { viewport: { width: 1280, height: 800 }, locale: 'pt-BR' });
const ctx = browser;
const page = (await ctx.pages()) [0] || await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
page.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));

await page.goto('http://localhost:8811/', { waitUntil: 'networkidle' });
await page.waitForSelector('#btnEntrar:not([disabled])', { timeout: 20000 });
await page.click('#btnEntrar');
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/sh_01_recepcao.png' });

// Menu da escola
await page.click('#btnMenu');
await page.waitForTimeout(250);
await page.screenshot({ path: '/tmp/sh_02_menu.png' });

// Minha área (aluno)
await page.click('#menuEscola .menu-item:has-text("Minha área")');
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/sh_03_minhaarea.png' });
for (const aba of ['Metas', 'Financeiro']) {
  const b = page.locator(`#painel .painel-aba:has-text("${aba}")`);
  if (await b.count()) { await b.first().click(); await page.waitForTimeout(350); }
}
await page.screenshot({ path: '/tmp/sh_04_minhaarea_fin.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Secretaria (direção)
await page.click('#btnMenu');
await page.click('#menuEscola .menu-item:has-text("Secretaria")');
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/sh_05_secretaria_alunos.png' });
for (const [aba, nome] of [['Turmas e cursos', 'turmas'], ['Financeiro', 'fin'], ['QR Codes', 'qr'], ['Assistente IA', 'ia'], ['Currículo', 'cur']]) {
  const b = page.locator(`#painel .painel-aba:has-text("${aba}")`);
  if (await b.count()) { await b.first().click(); await page.waitForTimeout(400); await page.screenshot({ path: `/tmp/sh_06_sec_${nome}.png` }); }
}
const bn = page.locator('#painel button:has-text("Novo Aluno")');
if (await bn.count()) { await bn.first().click(); await page.waitForTimeout(300); await page.screenshot({ path: '/tmp/sh_06b_form_aluno.png' }); }
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Ao vivo
await page.click('#btnMenu');
await page.click('#menuEscola .menu-item:has-text("Ao vivo")');
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/sh_07_aovivo.png' });
if (await page.locator('.modal-din .botoes:has-text("Iniciar transmissão")').count()) {
  await page.locator('.modal-din .botoes:has-text("Iniciar transmissão")').first().click();
  await page.fill('.chat-linha input', 'Olá professor!');
  await page.locator('.chat-linha button:has-text("Enviar")').click();
  await page.waitForSelector('.chat-texto:has-text("Olá professor!")', { timeout: 10000 });
}
await page.screenshot({ path: '/tmp/sh_08_aovivo_chat.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Feira
await page.click('#btnMenu');
await page.click('#menuEscola .menu-item:has-text("Feira")');
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/sh_09_feira.png' });
const compra = page.locator('.feira-card .botoes:has-text("Comprar e matricular")').first();
if (await compra.count()) { await compra.click(); await page.waitForSelector('.feira-card button:has-text("Já matriculado")', { timeout: 10000 }); await page.waitForTimeout(300); await page.screenshot({ path: '/tmp/sh_10_feira_comprado.png' }); }
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Educador IA na sala de matemática
await page.evaluate(() => window.__escola.irPara('matematica'));
await page.waitForTimeout(3200);
await page.click('#btnEducador');
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/sh_11_educador.png' });
await page.fill('.chat-linha input', 'O que vamos estudar hoje?');
await page.locator('.chat-linha button:has-text("Perguntar")').click();
await page.waitForTimeout(1300);
await page.screenshot({ path: '/tmp/sh_12_educador_resp.png' });

console.log('ERROS:', erros.length ? erros.join('\n---\n') : 'nenhum');
await browser.close();
