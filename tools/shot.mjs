// Headless check: loads the game in Chromium, plays a few seconds, prints
// errors and state, and saves screenshots. The cloud sandbox cannot reach the
// CDN, so three.js is served from a local npm copy (set THREE_DIR, or run
// `npm i three@0.186.1` in a temp folder and point THREE_DIR at node_modules/three).
//   THREE_DIR=/path/to/node_modules/three node tools/shot.mjs <out-dir> [phone]
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || '.', phone = process.argv[3] === 'phone';
await mkdir(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer(async (q, r) => {
  try { const p = q.url.split('?')[0]; const b = await readFile(join(ROOT, p === '/' ? 'index.html' : p)); r.writeHead(200, { 'content-type': MIME[extname(p)] || MIME['.html'] }); r.end(b); }
  catch { r.writeHead(404); r.end(); }
}).listen(0);
const port = srv.address().port;
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await br.newPage({ viewport: phone ? { width: 390, height: 760 } : { width: 1366, height: 620 }, hasTouch: phone, isMobile: phone });
const errs = [];
pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await pg.route('**/cdn.jsdelivr.net/**', async rt => rt.fulfill({ body: await readFile(join(process.env.THREE_DIR, 'build', rt.request().url().split('/').pop())), contentType: 'text/javascript' }));
await pg.route('**/fonts.g*/**', rt => rt.abort());
await pg.goto(`http://localhost:${port}/`); await pg.waitForTimeout(1500);
await pg.screenshot({ path: join(out, 'title.png') });
await pg.click('#enter'); await pg.waitForTimeout(6000);
await pg.screenshot({ path: join(out, 'hub.png') });
if (errs.length) console.log('early errors:', JSON.stringify(errs));
// Heal the most hurt person in range a few times
const res = await pg.evaluate(async () => {
  const g = window.game, wait = ms => new Promise(r => setTimeout(r, ms)), log = [];
  for (let i = 0; i < 6; i++) {
    const hurt = g.people.list.filter(p => p.hp < p.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!hurt) break;
    g.player.x = hurt.x + 4; g.player.z = hurt.z + 4; g.player.yaw = Math.atan2(-4, -4);
    g.target = hurt; const before = hurt.hp; g.S.mana = 999;
    g.cast(i % 2); await wait(2600);
    log.push([hurt.name, Math.round(before), Math.round(hurt.hp)]);
  }
  return { log, level: g.S.level, xp: g.S.xp, bag: g.S.bag.map(i => i.name), coins: g.S.coins, n: g.people.list.length };
});
await pg.screenshot({ path: join(out, 'heal.png') });
await pg.keyboard.press('Tab'); await pg.keyboard.press('b'); await pg.keyboard.press('v'); await pg.waitForTimeout(600);
await pg.screenshot({ path: join(out, 'pov.png') });
console.log(JSON.stringify(res), '\nerrors:', JSON.stringify(errs));
await br.close(); srv.close();
