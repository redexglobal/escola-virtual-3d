import { createRequire } from 'module';
const require = createRequire('/Users/macbookair/projetos/Toca-Card/x.js');
const { chromium } = require('playwright');

const erros = [];
require('fs').rmSync('/tmp/esp-mob', { recursive: true, force: true });
const b = await chromium.launchPersistentContext('/tmp/esp-mob', { viewport: { width: 390, height: 844 }, locale: 'pt-BR', hasTouch: true, isMobile: true });
const p = b.pages()[0] || await b.newPage();
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));

await p.goto('http://localhost:8811/', { waitUntil: 'load' });
await p.waitForSelector('#btnEntrar:not([disabled])', { timeout: 25000 });
await p.screenshot({ path: '/tmp/mob_01_entrada.png' });
await p.click('#btnEntrar');
await p.waitForTimeout(700);
await p.screenshot({ path: '/tmp/mob_02_recepcao.png' });
await p.click('#btnMenu');
await p.tap('#menuEscola .menu-item:has-text("Secretaria")');
await p.waitForTimeout(800);
await p.screenshot({ path: '/tmp/mob_03_secretaria.png' });
await p.tap('#painel .painel-aba:has-text("QR Codes")');
await p.waitForTimeout(600);
await p.screenshot({ path: '/tmp/mob_04_qr.png' });
await p.keyboard.press('Escape');
console.log('MOBILE ERROS:', erros.length ? erros.join('\n') : 'nenhum');
await b.close();
