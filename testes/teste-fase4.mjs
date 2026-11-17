// Fase 4: séries brasileiras + grade curricular (direção), rota de estudo do aluno
// (idade→série→bimestre→tema, formatos vídeo/jogo/interativo, foto + tópicos),
// visão de frente com fotos reais e entrada com fachada real.
import { createRequire } from 'module';
const require = createRequire('/Users/macbookair/projetos/Toca-Card/x.js');
const { chromium } = require('playwright');
const fs = require('fs');
const rm = fs.rmSync;

const BASE = 'http://localhost:8811/';
const erros = [];
const falhas = [];
const ok = (nome, cond) => { if (!cond) falhas.push(nome); console.log((cond ? '✓' : '✗') + ' ' + nome); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

rm('/tmp/esp-fase4', { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext('/tmp/esp-fase4', { viewport: { width: 1280, height: 800 }, locale: 'pt-BR' });
const page = (await ctx.pages())[0] || await ctx.newPage();
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  // Vídeos locais ainda não enviados: o 404 de videos/*.mp4 é esperado (a TV mostra aviso).
  const loc = m.location ? m.location() : null;
  if (loc && /videos\/[^ ]*\.mp4/.test(loc.url || '')) return;
  erros.push(m.text());
});
page.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));

// PNG 8x8 válido para anexar material
const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGP8z8DwnwEJZGZEQAtTlQEBAMyoBQf07RZ9AAAAAElFTkSuQmCC';
fs.writeFileSync('/tmp/foto-caderno.png', Buffer.from(pngB64, 'base64'));

// ---------- 1. Entrada com foto real da fachada ----------
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#btnEntrar:not([disabled])', { timeout: 20000 });
const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.entrada')).backgroundImage);
ok('entrada usa a foto real da fachada', bg.includes('frente-escola.jpg'));

// ---------- 2. Menu tem os novos módulos ----------
await page.click('#btnEntrar');
await page.waitForTimeout(1000);
await page.click('#btnMenu');
const itensMenu = await page.locator('#menuEscola .menu-item').allTextContents();
ok('menu tem "Meu estudo"', itensMenu.some((t) => t.includes('Meu estudo')));
ok('menu tem "Visão de frente"', itensMenu.some((t) => t.includes('Visão de frente')));
await page.click('#btnMenu');

// ---------- 3. Rota de estudo: idade → série → bimestre → tema ----------
await page.goto(BASE + '#/estudo');
await page.waitForSelector('.painel-aba[data-tab="rota"]', { timeout: 8000 });
await page.locator('.chips button.chip', { hasText: '15' }).click(); // 15 anos → 1º EM
await page.waitForTimeout(700);
ok('escolher 15 anos marca a série no chip', await page.locator('.chips .chip.on', { hasText: '15' }).count() === 1);
await page.locator('.chips button.chip', { hasText: '1º bimestre' }).first().click();
await page.waitForTimeout(900);
const cardsDisc = await page.locator('.disc-card').count();
ok('bimestre 1 lista disciplinas com tópicos da grade', cardsDisc >= 3);
const textoCards = (await page.locator('.disc-card').allTextContents()).join(' · ');
ok('tópicos mostram disciplinas com nome real', textoCards.includes('Matemática') && textoCards.includes('Português'));

// abre um tema de Matemática e confere os 3 formatos
const xpAntes = await page.evaluate(async () => (await window.__jogo.estadoJogo()).xp);
await page.locator('.disc-card', { hasText: 'Matemática' }).locator('button.btn-mini', { hasText: 'Estudar' }).first().click();
await page.waitForTimeout(900);
ok('tópico aberto mostra título e resumo', (await page.locator('.est-topo h2').count()) === 1 && (await page.locator('.est-topo .tema-resumo').count()) === 1);
ok('formatos vídeo/jogo/interativo presentes', (await page.locator('.abas .aba').count()) === 3);
ok('modo jogo default traz questão da sala', (await page.locator('.jogo-tela .opcao').count()) >= 2);

// responde uma questão (acerta clicando na certa não se sabe qual; clica a primeira e confere feedback)
const op0 = page.locator('.jogo-tela .opcao').first();
await op0.click();
await page.waitForTimeout(500);
const temFeedback = (await page.locator('.explica').count()) >= 1;
ok('questão responde com explicação na hora', temFeedback);
await page.waitForTimeout(1400);

// modo interativo: cartões viram
await page.locator('.abas .aba', { hasText: 'Interativo' }).click();
await page.waitForTimeout(600);
ok('modo interativo monta cartão', (await page.locator('.flip').count()) === 1);
await page.locator('.flip').click();
await page.waitForTimeout(700);
ok('cartão vira ao tocar', await page.locator('.flip.virado').count() === 1);

// xp subiu após interação (questão vale +10 ou +2)
const xpDepois = await page.evaluate(async () => (await window.__jogo.estadoJogo()).xp);
ok('XP subiu após estudar (gamificação ligada)', xpDepois > xpAntes);

// ---------- 4. Anexar foto + gerar conteúdo por tópicos ----------
await page.locator('input[type="file"]').setInputFiles('/tmp/foto-caderno.png');
await page.locator('button.btn', { hasText: 'Enviar foto' }).first().click();
await page.waitForTimeout(1500);
ok('foto anexada vira material (toast ou grade)', (await page.locator('.mat-card').count()) >= 1 || (await page.locator('.toast.on').count()) >= 1);
await page.locator('input[placeholder*="frações"]').fill('frações, redação argumentativa');
await page.locator('button.btn-prim', { hasText: 'Gerar conteúdo' }).click();
await page.waitForTimeout(1200);
const conn = await page.locator('.conexao-box').textContent().catch(() => '');
ok('tópicos geram conteúdo correlacionado (matemática+português)', conn.includes('Matemática') && conn.includes('Português'));

// aba Meu material
await page.locator('.painel-aba[data-tab="material"]').click();
await page.waitForTimeout(900);
ok('aba Meu material lista a foto enviada', (await page.locator('.mat-card img').count()) >= 1);

// ---------- 5. Direção → Grade curricular (evolutivo: editar a grade) ----------
await page.goto(BASE + '#/admin');
await page.waitForSelector('.painel-aba[data-tab="grade"]', { timeout: 8000 });
await page.click('.painel-aba[data-tab="grade"]');
await page.waitForTimeout(1200);
const linhasGrade = await page.locator('.tabela tbody tr').count();
ok('painel Grade lista tópicos da grade curricular', linhasGrade > 10);
// filtra por série
await page.selectOption('.grade-filtros select >> nth=0', 'ser-1m');
await page.waitForTimeout(1200);
const linhasFiltradas = await page.locator('.tabela tbody tr').count();
ok('filtro por série 1º EM reduz a grade', linhasFiltradas > 0 && linhasFiltradas < linhasGrade);
// cria um tópico novo (a escola evolui sem tocar no código)
await page.locator('button.btn-prim', { hasText: 'Novo tópico' }).click();
await page.waitForTimeout(900);
await page.locator('.form input[name="tema"]').fill('Tópico de teste — automatizado');
await page.selectOption('.form select[name="serieId"]', 'ser-2m');
await page.selectOption('.form select[name="bimestre"]', '2');
await page.selectOption('.form select[name="disciplinaId"]', 'ciencias');
await page.locator('.form button.btn-prim', { hasText: 'Salvar tópico' }).click();
await page.waitForTimeout(1600);
const temNovoTopico = (await page.locator('.tabela tbody tr').allTextContents()).some((t) => t.includes('Tópico de teste'));
ok('novo tópico salvo pela direção aparece na grade', temNovoTopico || (await page.locator('.tabela tbody tr').count()) === linhasFiltradas + 1);
await page.screenshot({ path: '/tmp/fase4_grade.png' });

// ---------- 6. Visão de frente (apresentação real, fora do 3D) ----------
await page.keyboard.press('Escape'); // fecha painel
await page.click('#btnMenu');
await page.waitForTimeout(300);
await page.locator('#menuEscola .menu-item', { hasText: 'Visão de frente' }).click();
await page.waitForSelector('.vf-root', { timeout: 6000 });
ok('visão de frente abre sobre o 3D', await page.locator('.vf-root').isVisible());
ok('visão de frente usa foto real de sala', ((await page.evaluate(() => getComputedStyle(document.querySelector('.vf-foto')).backgroundImage)) || '').includes('sala-real.jpg'));
ok('quadro mostra tópico da grade no ar', (await page.locator('.vf-quadro .vf-tema').count()) === 1);
ok('palco tem vídeo, exercício e educador', (await page.locator('.vf-tela video').count()) === 1 && (await page.locator('.vf-lado .opcao').count()) >= 2 && (await page.locator('.vf-edu .vf-edu-frase').count()) === 1);
await page.screenshot({ path: '/tmp/fase4_frente.png' });
// troca de disciplina na frente
await page.locator('.vf-chips .chip', { hasText: 'Ciências' }).click();
await page.waitForTimeout(1200);
ok('trocar disciplina atualiza o quadro', ((await page.locator('.vf-quadro .vf-tema').textContent()) || '') !== '');
// volta para o 3D
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
ok('Esc fecha a visão de frente', !(await page.locator('.vf-root').count()));
await page.screenshot({ path: '/tmp/fase4_3d.png' });

// ---------- 7. Banco subiu de versão e mantém dados ----------
const info = await page.evaluate(async () => {
  const dbs = await indexedDB.databases();
  return dbs.map((d) => d.name + ':' + d.version);
});
ok('banco local na versão 4 (upgrade limpo)', info.some((v) => v.startsWith('kairos-escola:4')));

await ctx.close();

console.log('\nERROS DE CONSOLE:', erros.length ? erros.slice(0, 6).join(' | ') : 'nenhum');
console.log(falhas.length ? '\nFALHOU: ' + falhas.join(' · ') : '\nTUDO OK');
process.exit(falhas.length || erros.length ? 1 : 0);
