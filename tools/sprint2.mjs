// Headless check of sprint 2: Greenhollow, monsters, death and Revive.
//   THREE_DIR=<node_modules/three> node tools/sprint2.mjs <out-dir>
import { createServer } from 'node:http'; import { readFile, mkdir } from 'node:fs/promises'; import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), OUT = process.argv[2] || '.'; await mkdir(OUT, { recursive: true });
const srv = createServer(async (q, r) => { try { const p = q.url.split('?')[0]; const b = await readFile(join(ROOT, p === '/' ? 'index.html' : p)); r.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript' }[extname(p)] || 'text/html' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await br.newPage({ viewport: { width: 1366, height: 620 } }); const errs = [];
pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await pg.route('**/cdn.jsdelivr.net/**', async rt => rt.fulfill({ body: await readFile(join(process.env.THREE_DIR, rt.request().url().split('three@0.186.1/')[1])), contentType: 'text/javascript' }));
await pg.route('**/fonts.g*/**', rt => rt.abort());
await pg.goto(`http://localhost:${srv.address().port}/`); await pg.click('#enter'); await pg.waitForTimeout(1500);
const out = {};
// walk out through the gate
await pg.evaluate(() => { game.player.x = 0; game.player.z = -50; game.player.yaw = Math.PI; });
await pg.keyboard.down('w'); await pg.waitForTimeout(9000); await pg.keyboard.up('w');
out.walked = await pg.evaluate(() => [Math.round(game.player.x), Math.round(game.player.z), document.getElementById('zone').textContent]);
await pg.screenshot({ path: OUT + '/gate.png' });
// let the zone run a while, then look at a fight
await pg.waitForTimeout(25000);
out.sim = await pg.evaluate(() => { const g = game.people.list.filter(p => p.zone === 'green'); return { green: g.length, hunting: g.filter(p => p.state === 'hunt').length, dead: g.filter(p => p.dead).length, hurt: g.filter(p => p.hp < p.maxHp).length, mobsDead: game.mobs.list.filter(m => m.state === 'dead').length, hub: game.people.list.length - g.length }; });
await pg.evaluate(() => { const p = game.people.list.find(p => p.state === 'hunt') || game.people.list.find(p => p.zone === 'green'); game.player.x = p.x + 5; game.player.z = p.z + 7; game.player.yaw = Math.atan2(-5, -7); game.target = p; });
await pg.waitForTimeout(1200); await pg.screenshot({ path: OUT + '/fight.png' });
// kill someone, then revive them
out.rez = await pg.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)), g = game, p = g.people.list.find(p => p.zone === 'green' && !p.dead);
  g.people.kill(p, { name: 'a test' }); g.player.x = p.x + 3; g.player.z = p.z + 3; g.target = p; g.S.mana = 999;
  g.cast(0); const blocked = p.dead; g.cast(2); for (let i = 0; i < 40 && p.dead; i++) await wait(1000);
  return { blocked, alive: !p.dead, hp: p.hp, xp: g.S.xp, lvl: g.S.level };
});
await pg.screenshot({ path: OUT + '/rez.png' });
console.log(JSON.stringify(out), JSON.stringify(errs)); await br.close(); srv.close();
