// Renders the art direction samples side by side: each ?look from the plaza,
// the fountain and Greenhollow.   THREE_DIR=<node_modules/three> node tools/looks.mjs <out-dir> [look ...]
import { createServer } from 'node:http'; import { readFile, mkdir } from 'node:fs/promises'; import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), [OUT = '.', ...want] = process.argv.slice(2); await mkdir(OUT, { recursive: true });
const looks = want.length ? want : ['original', 'storybook', 'toon', 'dusk'];
const srv = createServer(async (q, r) => { try { const p = q.url.split('?')[0]; const b = await readFile(join(ROOT, p === '/' ? 'index.html' : p)); r.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript' }[extname(p)] || 'text/html' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const VIEWS = { plaza: [6, 30, Math.PI + 0.25, 0.22, 13], gate: [-4, -36, Math.PI - 0.15, 0.12, 9], green: [-10, -92, Math.PI + 0.6, 0.18, 10] };
for (const lk of looks) {
  const pg = await br.newPage({ viewport: { width: 1366, height: 620 } }); const errs = [];
  pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errs.push(m.text()); });
  await pg.route('**/cdn.jsdelivr.net/**', async rt => rt.fulfill({ body: await readFile(join(process.env.THREE_DIR, rt.request().url().split('three@0.186.1/')[1])), contentType: 'text/javascript' }));
  await pg.route('**/fonts.g*/**', rt => rt.abort());
  await pg.goto(`http://localhost:${srv.address().port}/?look=${lk}`); await pg.click('#enter'); await pg.waitForTimeout(2500);
  await pg.evaluate(() => { document.getElementById('hud').style.display = 'none'; });
  for (const [v, [x, z, yaw, pitch, dist]] of Object.entries(VIEWS)) {
    await pg.evaluate(([x, z, yaw, pitch, dist]) => Object.assign(game.player, { x, z, yaw, pitch, dist, camOff: 0 }), [x, z, yaw, pitch, dist]);
    await pg.waitForTimeout(1800); await pg.screenshot({ path: `${OUT}/${lk}-${v}.png` });
  }
  console.log(lk, JSON.stringify(errs)); await pg.close();
}
await br.close(); srv.close();
