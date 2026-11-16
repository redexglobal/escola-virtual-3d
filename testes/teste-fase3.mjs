// Fase 3: câmera 1ª/3ª pessoa, gamificação (HUD), painéis professor/revendedor,
// rotas por hash, quadro de turmas clicável e links.html com QR reais.
import { createRequire } from 'module';
const require = createRequire('/Users/macbookair/projetos/Toca-Card/x.js');
const { chromium } = require('playwright');
const rm = require('fs').rmSync;

const erros = [];
const falhas = [];
const ok = (nome, cond) => { if (!cond) falhas.push(nome); console.log((cond ? '✓' : '✗') + ' ' + nome); };

rm('/tmp/esp-fase3', { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext('/tmp/esp-fase3', { viewport: { width: 1280, height: 800 }, locale: 'pt-BR' });
const page = (await ctx.pages())[0] || await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
page.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));

// ---------- 1. Portal: HUD ainda fora, chips de persona presentes ----------
await page.goto('http://localhost:8811/', { waitUntil: 'networkidle' });
await page.waitForSelector('#btnEntrar:not([disabled])', { timeout: 20000 });
ok('chips de persona no portal', (await page.locator('.perfis [data-hash]').count()) === 4);
ok('link de apresentação no portal', (await page.locator('.perfis a[href="apresentacao.html"]').count()) === 1);

// ---------- 2. Entrar: HUD de gamificação visível ----------
await page.click('#btnEntrar');
await page.waitForTimeout(800);
ok('HUD aparece no topo', await page.locator('#topo .jogo-hud').isVisible());
ok('HUD mostra nível inicial Calouro', (await page.locator('.jogo-hud .nivel').textContent()).includes('Calouro'));
await page.screenshot({ path: '/tmp/fase3_01_hud.png' });

// ---------- 3. Câmera 1ª ↔ 3ª pessoa pela tecla C ----------
ok('inicia em 1ª pessoa', (await page.locator('#btnCam').textContent()).includes('1ª'));
await page.keyboard.press('KeyC');
await page.waitForTimeout(250);
ok('KeyC muda para 3ª pessoa', (await page.locator('#btnCam').textContent()).includes('3ª'));
await page.screenshot({ path: '/tmp/fase3_02_terceira.png' });
await page.locator('#btnCam').click();
await page.waitForTimeout(250);
ok('botão 🎥 volta para 1ª pessoa', (await page.locator('#btnCam').textContent()).includes('1ª'));

// ---------- 4. Gamificação: visita + questão rendem XP ----------
const lerXp = () => page.evaluate(async () => (await window.__jogo.estadoJogo()).xp);
async function chegaSala(id, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await page.evaluate(() => window.__escola.estado().sala);
    if (s === id) return true;
    await page.waitForTimeout(400);
  }
  return false;
}
const xp0 = await lerXp();
await page.evaluate(() => window.__escola.irPara('matematica'));
ok('irPara leva até a sala de matemática', await chegaSala('matematica'));
await page.waitForTimeout(800); // o aceno assenta antes de conferir o XP
const xp1 = await lerXp();
ok('visitar sala rende XP (' + xp0 + '→' + xp1 + ')', xp1 > xp0);
await page.screenshot({ path: '/tmp/fase3_03_sala_matematica.png' });

await page.click('#btnExercicio');
await page.waitForSelector('#exOpcoes button:not([disabled])', { timeout: 5000 });
await page.locator('#exOpcoes button').first().click();
await page.waitForTimeout(400);
const xp2 = await lerXp();
ok('responder questão rende XP (' + xp1 + '→' + xp2 + ')', xp2 > xp1);
await page.keyboard.press('Escape');

// ---------- 5. Painel do professor ----------
await page.click('#btnMenu');
await page.click('#menuEscola .menu-item:has-text("Professor")');
await page.waitForTimeout(700);
ok('painel professor abre com turmas', await page.locator('#painel h2:has-text("Professor")').isVisible());
await page.waitForSelector('#painel :text("Turma Oficial")', { timeout: 8000 });
ok('painel professor tem turmas oficiais', true);
await page.screenshot({ path: '/tmp/fase3_04_professor.png' });
const abaNotas = page.locator('#painel .painel-aba:has-text("Notas")');
if (await abaNotas.count()) { await abaNotas.first().click(); await page.waitForTimeout(500); await page.screenshot({ path: '/tmp/fase3_05_professor_notas.png' }); }
await page.keyboard.press('Escape');

// ---------- 6. Painel do revendedor + código de convite ----------
await page.click('#btnMenu');
await page.click('#menuEscola .menu-item:has-text("Revendedor")');
await page.waitForTimeout(700);
const cardConvite = page.locator('#painel .card-convite').first();
if (!(await cardConvite.count())) {
  const form = page.locator('#painel form, #painel .form-wrap').last();
  const inp = page.locator('#painel input[type="text"]').first();
  if (await inp.count()) { await inp.fill('Escola Piloto Teste'); await page.locator('#painel button:has-text("Gerar código")').click(); await page.waitForTimeout(600); }
}
await page.waitForSelector('#painel .card-convite', { timeout: 5000 });
const codigo = (await page.locator('#painel .cv-codigo').first().textContent()).trim();
ok('convite gera código de 6 caracteres', /^[A-Z0-9]{6}$/.test(codigo));
await page.screenshot({ path: '/tmp/fase3_06_revendedor_convite.png' });
await page.keyboard.press('Escape');

// ---------- 7. Rota por hash: carrega com #/professor e o painel abre após entrar ----------
await page.goto('http://localhost:8811/#/professor');
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#btnEntrar:not([disabled])', { timeout: 20000 });
await page.click('#btnEntrar');
await page.waitForSelector('#painel h2:has-text("Professor")', { timeout: 8000 });
ok('#/professor abre o painel do professor', true);
await page.keyboard.press('Escape');

// ---------- 8. Quadro de turmas na recepção: clicou na linha, foi para a sala ----------
await page.waitForTimeout(1200); // refazPlacas monta o quadro
// volta para a recepção olhando o quadro da parede leste
await page.evaluate(() => { const e = window.__escola.eu; e.x = 7.4; e.z = 5; e.yaw = Math.PI / 2; e.pitch = 0; });
await page.waitForTimeout(300);
const rCena = await page.evaluate(() => {
  const c = document.getElementById('cena').getBoundingClientRect();
  return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
});
await page.mouse.click(rCena.x, rCena.y);
let quadroSala = null;
for (let i = 0; i < 40 && !quadroSala; i++) {
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => window.__escola.estado().sala);
  if (s === 'matematica' || s === 'portugues') quadroSala = s;
}
ok('clique no quadro de turmas leva à sala (' + quadroSala + ')', !!quadroSala);
await page.screenshot({ path: '/tmp/fase3_07_quadro_sala.png' });

// ---------- 9. links.html com QRs reais ----------
const p2 = await ctx.newPage();
p2.on('console', (m) => { if (m.type() === 'error') erros.push('LINKS ' + m.text()); });
p2.on('pageerror', (e) => erros.push('LINKS PAGEERROR ' + e.message));
await p2.goto('http://localhost:8811/links.html', { waitUntil: 'networkidle' });
await p2.waitForTimeout(900);
ok('links.html tem 8 cartões', (await p2.locator('.card').count()) === 8);
ok('nenhum QR ficou em fallback', (await p2.locator('.qr.vazio').count()) === 0);
ok('QRs desenhados (canvas preenchido)', await p2.evaluate(() => Array.from(document.querySelectorAll('.qr canvas')).every((c) => c.width > 0)));
await p2.screenshot({ path: '/tmp/fase3_08_links_qr.png' });
await p2.close();

// ---------- 10. Mobile: joystick, câmera e HUD sem estourar o layout ----------
rm('/tmp/esp-fase3-mob', { recursive: true, force: true });
const mob = await chromium.launchPersistentContext('/tmp/esp-fase3-mob', {
  viewport: { width: 390, height: 844 }, locale: 'pt-BR',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  hasTouch: true, isMobile: true,
});
const pm = (await mob.pages())[0] || await mob.newPage();
const errosM = [];
pm.on('console', (m) => { if (m.type() === 'error') errosM.push(m.text()); });
pm.on('pageerror', (e) => errosM.push('PAGEERROR ' + e.message));
await pm.goto('http://localhost:8811/', { waitUntil: 'networkidle' });
await pm.waitForSelector('#btnEntrar:not([disabled])', { timeout: 25000 });
await pm.locator('#btnEntrar').tap();
await pm.waitForTimeout(900);
ok('mobile: HUD visível sem quebrar layout', await pm.locator('#topo .jogo-hud').isVisible());
await pm.locator('#btnCam').tap();
await pm.waitForTimeout(300);
ok('mobile: botão de câmera funciona', (await pm.locator('#btnCam').textContent()).includes('3ª'));
await pm.screenshot({ path: '/tmp/fase3_09_mobile_3p.png' });
await pm.close();
await mob.close();

ok('sem erros de console (desktop)', erros.length === 0 || console.log('ERROS DESKTOP:\n' + erros.join('\n---\n')));
ok('sem erros de console (mobile)', errosM.length === 0 || console.log('ERROS MOBILE:\n' + errosM.join('\n---\n')));

console.log(falhas.length ? '\nFALHAS: ' + falhas.join(' | ') : '\nTUDO OK');
await ctx.close();
process.exit(falhas.length ? 1 : 0);
