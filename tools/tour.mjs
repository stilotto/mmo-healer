// Speed test check: runs /speedtest (the tour) and /fpslog and prints the reports.
//   THREE_DIR=<node_modules/three> node tools/tour.mjs <out-dir>
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const q = process.argv[2] || 'high', cpu = process.argv.includes('cpu');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer(async (rq, r) => {
  try { const p = rq.url.split('?')[0]; const b = await readFile(join(ROOT, p === '/' ? 'index.html' : p)); r.writeHead(200, { 'content-type': MIME[extname(p)] || MIME['.html'] }); r.end(b); }
  catch { r.writeHead(404); r.end(); }
}).listen(0);
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await br.newPage({ viewport: { width: 1366, height: 620 } });
const errs = [];
pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await pg.route('**/cdn.jsdelivr.net/**', async rt => rt.fulfill({ body: await readFile(join(process.env.THREE_DIR, rt.request().url().split('three@0.186.1/')[1])), contentType: 'text/javascript' }));
await pg.route('**/fonts.g*/**', rt => rt.abort());
await pg.goto(`http://localhost:${srv.address().port}/?go`);
await pg.waitForFunction(() => window.game && window.game.Chat, null, { timeout: 30000 }).catch(e => { console.log(errs); throw e; });
await pg.waitForTimeout(2000);
const before = await pg.evaluate(() => [Math.round(game.player.x), Math.round(game.player.z)]);
await pg.keyboard.press('Enter'); await pg.keyboard.type('/speedtest'); await pg.keyboard.press('Enter');
await pg.waitForTimeout(3500);
const mid = await pg.evaluate(() => [Math.round(game.player.x), Math.round(game.player.z), game.player.enabled]);
await pg.waitForFunction(() => document.getElementById('speedr').style.display === 'block', null, { timeout: 150000 });
await pg.screenshot({ path: (process.argv[2] || '.') + '/tour.png' });
const out = await pg.evaluate(() => ({ text: document.getElementById('speedt').value, at: [Math.round(game.player.x), Math.round(game.player.z), game.player.enabled] }));
console.log(out.text, '\nbefore', before, 'mid', mid, 'after', out.at);
// free-play log: start, walk a bit, stop
await pg.click('#speedx');
await pg.keyboard.press('Enter'); await pg.keyboard.type('/fpslog'); await pg.keyboard.press('Enter');
await pg.keyboard.down('w'); await pg.waitForTimeout(5000); await pg.keyboard.up('w');
await pg.keyboard.press('Enter'); await pg.keyboard.type('/fpslog'); await pg.keyboard.press('Enter');
await pg.waitForTimeout(500);
console.log((await pg.evaluate(() => document.getElementById('speedt').value)).split('\n').slice(-3).join('\n'));
console.log('errors:', JSON.stringify(errs));
await br.close(); srv.close();
