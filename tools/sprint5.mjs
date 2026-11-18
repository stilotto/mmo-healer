// Headless check of sprint 5: frames, self-target, Flash, Ward, drinking,
// and Emberdeep's bleeds and boss frame.   THREE_DIR=<node_modules/three> node tools/sprint5.mjs <out-dir>
import { createServer } from 'node:http'; import { readFile, mkdir } from 'node:fs/promises'; import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), OUT = process.argv[2] || '.'; await mkdir(OUT, { recursive: true });
const srv = createServer(async (q, r) => { try { const p = q.url.split('?')[0]; const b = await readFile(join(ROOT, p === '/' ? 'index.html' : p)); r.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript' }[extname(p)] || 'text/html' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await br.newPage({ viewport: { width: 1366, height: 620 } }); const errs = [];
pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errs.push(m.text()); });
await pg.route('**/cdn.jsdelivr.net/**', async rt => rt.fulfill({ body: await readFile(join(process.env.THREE_DIR, rt.request().url().split('three@0.186.1/')[1])), contentType: 'text/javascript' }));
await pg.route('**/fonts.g*/**', rt => rt.abort());
await pg.goto(`http://localhost:${srv.address().port}/?speed=3`); await pg.click('#enter'); await pg.waitForTimeout(2500);
const out = {}, ev = f => pg.evaluate(f), wait = ms => pg.waitForTimeout(ms);
out.frames = await ev(() => [...document.querySelectorAll('.pf')].filter(r => r.style.display !== 'none').length);
await pg.keyboard.press('F2'); out.f2 = await ev(() => !!game.target && game.target === game.UI.frameUnits()[0]);
await pg.keyboard.press('F1'); out.self = await ev(() => !!(game.target && game.target.isMe));
await pg.keyboard.press('4'); out.flashLocked = await ev(() => document.getElementById('err').textContent);
// level 5, then Flash and Ward on someone hurt
out.spells = await ev(async () => {
  const g = game, w = ms => new Promise(r => setTimeout(r, ms));
  g.S.level = 5; g.S.mana = 999;
  const p = g.people.list.find(p => p.zone === 'hub' && !p.dead); p.hp = 10; p.wait = 1e9; p.state = 'idle';
  g.player.x = p.x + 3; g.player.z = p.z + 3; g.target = p;
  await w(1500); const before = p.hp; g.cast(3);
  for (let i = 0; i < 100 && (g.casting || p.hp === before); i++) await w(200);
  const flashed = p.hp > before, E = document.getElementById('err');
  for (let i = 0; i < 30; i++) { E.textContent = ''; g.cast(4); if (E.textContent !== 'Not ready yet') break; await w(300); }
  const warded = !!p.ward; await w(300);
  for (let i = 0; i < 30; i++) { E.textContent = ''; g.cast(4); if (E.textContent !== 'Not ready yet') break; await w(300); }
  const relock = E.textContent;
  return { flashed, warded, relock };
});
// drinking
out.drink = await ev(async () => { const g = game, w = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 100 && g.casting; i++) await w(200); g.S.mana = 5; g.target = null; await w(400); document.querySelector('.slot.small[title^="Sit"]').click(); await w(3000); return Math.round(g.S.mana); });
await pg.screenshot({ path: OUT + '/frames.png' });
// Emberdeep: watch for bleeds and the boss frame while the test keeps the party alive
await ev(() => { game.player.x = -47; game.player.z = -15; }); await wait(1500);
out.dun = await ev(async () => {
  const g = game, d = g.dungeon, w = ms => new Promise(r => setTimeout(r, ms)); let bleeds = 0, boss = false, breathBar = false;
  for (let i = 0; i < 400 && d.phase !== 'done' && d.phase !== 'wipe'; i++) {
    const t = d.tank() || d.party[0]; if (t) { g.player.x = t.x + 3; g.player.z = t.z + 6; }
    for (const p of d.party) { if (p.dots && p.dots.length) bleeds++; if (p.dead && !p.gone) g.people.revive(p); else if (!p.gone && p.hp < p.maxHp * 0.6) g.people.heal(p, 30, false); }
    if (document.getElementById('boss').style.display === 'block') { boss = true; if (document.getElementById('bcast').style.visibility === 'visible') breathBar = true; }
    if (breathBar && !globalThis.shot) { globalThis.shot = 1; }
    await w(500);
  }
  return { phase: d.phase, bleeds, boss, breathBar, frames: [...document.querySelectorAll('.pf')].filter(r => r.style.display !== 'none').length };
});
await pg.screenshot({ path: OUT + '/dungeon.png' });
console.log(JSON.stringify(out), JSON.stringify(errs)); await br.close(); srv.close();
