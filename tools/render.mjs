// Render size check: the drawing size on Low in a big and a small window,
// with render auto and full.   THREE_DIR=<node_modules/three> node tools/render.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer(async (rq, r) => {
  try { const p = rq.url.split('?')[0]; const b = await readFile(join(ROOT, p === '/' ? 'index.html' : p)); r.writeHead(200, { 'content-type': MIME[extname(p)] || MIME['.html'] }); r.end(b); }
  catch { r.writeHead(404); r.end(); }
}).listen(0);
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
for (const [w, h, q] of [[2560, 1271, 'quality=low'], [1100, 540, 'quality=low'], [2560, 1271, 'quality=low&render=full'], [2560, 1271, 'quality=high']]) {
  const pg = await br.newPage({ viewport: { width: w, height: h } });
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.route('**/cdn.jsdelivr.net/**', async rt => rt.fulfill({ body: await readFile(join(process.env.THREE_DIR, rt.request().url().split('three@0.186.1/')[1])), contentType: 'text/javascript' }));
  await pg.route('**/fonts.g*/**', rt => rt.abort());
  await pg.goto(`http://localhost:${srv.address().port}/?go&${q}`);
  await pg.waitForFunction(() => window.game && window.game.Chat, null, { timeout: 60000 });
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(() => { const c = document.getElementById('view'); return [c.width, c.height, (c.width * c.height / 1e6).toFixed(2) + ' MP', c.clientWidth]; });
  let after = '';
  if (q === 'quality=low') {     // switch to full by command, then back
    await pg.keyboard.press('Enter'); await pg.keyboard.type('/render full'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
    after = await pg.evaluate(() => document.getElementById('view').width);
    await pg.keyboard.press('Enter'); await pg.keyboard.type('/render auto'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
    after += ' -> ' + await pg.evaluate(() => document.getElementById('view').width);
  }
  console.log(w + 'x' + h, q, JSON.stringify(r), after);
  await pg.close();
}
console.log('errors:', JSON.stringify(errs));
await br.close(); srv.close();
