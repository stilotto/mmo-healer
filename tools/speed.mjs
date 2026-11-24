// Speed check: plays the game with ?prof in a few places and prints the
// time each part of the frame takes, draw calls and triangles; with `cpu`
// it also prints the hottest functions from a CPU profile.
//   THREE_DIR=<node_modules/three> node tools/speed.mjs [quality] [cpu]
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
await pg.goto(`http://localhost:${srv.address().port}/?go&prof&quality=${q}`);
await pg.waitForFunction(() => window.game && window.game.prof.last.fps, null, { timeout: 30000 }).catch(e => { console.log(errs); throw e; });
const places = { plaza: [0, 8, Math.PI], gate: [0, -50, Math.PI], green: [10, -120, Math.PI], pit: null };
const cdp = cpu ? await pg.context().newCDPSession(pg) : null;
if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); }
for (const [name, at] of Object.entries(places)) {
  await pg.evaluate(([name, at]) => { const g = window.game, p = g.player;
    if (at) { p.x = at[0]; p.z = at[1]; p.yaw = at[2]; } else { p.x = window.game.world ? p.x : p.x; }
  }, [name, at]);
  if (!at) continue;
  await pg.waitForTimeout(2500);
  if (cdp) await cdp.send('Profiler.start');
  await pg.waitForTimeout(3000);
  const r = await pg.evaluate(() => window.game.prof.last);
  console.log(name.padEnd(6), JSON.stringify(r));
  if (cdp) {
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
    const dts = profile.timeDeltas; let total = 0;
    profile.samples.forEach((id, i) => { const n = byId.get(id), f = n.callFrame, k = `${f.functionName || '(anon)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + dts[i]); total += dts[i]; });
    console.log('   top self time:', [...self].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => `${(100 * v / total).toFixed(1)}% ${k}`).join('\n   '));
  }
}
console.log('errors:', JSON.stringify(errs));
await br.close(); srv.close();
