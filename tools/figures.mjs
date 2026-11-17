// Line-up of every calling, close up, for checking the people models.
//   THREE_DIR=<node_modules/three> node tools/figures.mjs <out-dir>
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
await pg.goto(`http://localhost:${srv.address().port}/`); await pg.click('#enter'); await pg.waitForTimeout(2000);
const calls = await pg.evaluate(() => {
  document.getElementById('hud').style.display = 'none';
  const P = game.people, K = ['Knight', 'Ranger', 'Mage', 'Rogue', 'Warlock', 'Druid', 'Brawler', 'Healer'];
  for (const p of [...P.list]) if (p.zone === 'hub') P.remove(p);
  P.duelT = P.portalT = P.popT = 1e9;
  K.forEach((k, i) => { const p = P.spawn(-7 + i * 2, 20, 1, k); p.wait = 1e9; p.yaw = 0; p.state = 'idle'; });
  Object.assign(game.player, { x: -1, z: 25, yaw: Math.PI, pitch: 0.02, dist: 2.2, camOff: 0 });
  return game.renderer.info.render.calls;
});
await pg.waitForTimeout(2500); await pg.screenshot({ path: OUT + '/lineup.png' });
const calls2 = await pg.evaluate(() => { const P = game.people; for (const p of P.list) if (p.zone === 'hub') { p.animT = 9; p.anim = 'walk'; } return game.renderer.info.render.calls; });
await pg.waitForTimeout(400); await pg.screenshot({ path: OUT + '/walk.png' });
console.log(JSON.stringify(errs)); await br.close(); srv.close();
