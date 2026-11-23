// Headless check of sprint 11: the help window (H, the ? button, /help),
// the graphics setting (buttons and /graphics, saved, applied at once) and
// Shift+1 to 6 for the frames.
//   THREE_DIR=<node_modules/three> node tools/help.mjs <out-dir>
//   THREE_DIR=<node_modules/three> node tools/pond.mjs <out-dir>
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
await pg.goto(`http://localhost:${srv.address().port}/`); await pg.click('#enter'); await pg.waitForTimeout(2500);
const ev = f => pg.evaluate(f); if (!(await ev(() => !!window.game))) { console.log('boot failed', errs); process.exit(1); }
const out = await ev(async () => {
  const g = game, w = ms => new Promise(r => setTimeout(r, ms)), o = {}, R = g.renderer;
  const shown = () => getComputedStyle(document.getElementById('help')).display === 'block';
  g.player.keys.clear();
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', key: 'h' })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', key: 'h' })); await w(200);
  o.keyH = shown();
  o.rows = document.querySelectorAll('#help td').length; o.hasCircle = /Circle/.test(document.getElementById('help').textContent);
  document.querySelector('#help [data-g=low]').click(); await w(300);
  o.low = { shadows: R.shadowMap.enabled, ratio: R.getPixelRatio(), saved: localStorage.getItem('mmoHealerGfx') };
  document.querySelector('#help [data-g=high]').click(); await w(300);
  o.high = { shadows: R.shadowMap.enabled, ratio: R.getPixelRatio(), saved: localStorage.getItem('mmoHealerGfx') };
  document.getElementById('helpx').click(); await w(100); o.closed = !shown();
  g.Chat.send('/graphics low'); await w(200); o.slashLow = localStorage.getItem('mmoHealerGfx') === 'low' && !R.shadowMap.enabled;
  g.Chat.send('/graphics auto'); await w(200);
  g.Chat.send('/help'); await w(200); o.slashHelp = shown();
  document.getElementById('helpx').click();
  // Shift+1 targets you, Shift+2 the first frame
  const p = g.people.list.find(p => p.zone === 'hub' && !p.dead); p.hp = p.maxHp * 0.3; g.player.x = p.x + 4; g.player.z = p.z; await w(1600);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '!', shiftKey: true })); await w(100); o.shift1 = g.target === g.me;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', key: '@', shiftKey: true })); await w(100); o.shift2 = !!g.target && g.target !== g.me;
  o.noCast = !g.casting;
  return o;
});
await ev(() => game.UI.toggleHelp()); await pg.waitForTimeout(400);
await pg.screenshot({ path: OUT + '/help.png' });
await pg.setViewportSize({ width: 390, height: 760 }); await pg.waitForTimeout(500);
await pg.screenshot({ path: OUT + '/help-phone.png' });
console.log(JSON.stringify(out, null, 1), JSON.stringify(errs)); await br.close(); srv.close();
