// Headless check of sprint 8: drops in the world, pick-up, Need or Greed
// rolls, item effects, boss uniques, gear on the figure and the paper doll.
//   THREE_DIR=<node_modules/three> node tools/sprint8.mjs <out-dir>
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
await pg.goto(`http://localhost:${srv.address().port}/?speed=3&quality=low`); await pg.click('#enter'); await pg.waitForTimeout(2500);
const ev = f => pg.evaluate(f); if (!(await ev(() => !!window.game))) { console.log('boot failed', errs); process.exit(1); }
const out = await ev(async () => {
  const g = game, w = ms => new Promise(r => setTimeout(r, ms)), o = {}, S = g.S, L = g.loot, G = g.G;
  const lines = () => [...document.querySelectorAll('#chat div')].map(d => d.textContent);
  // 1. a drop in the world, picked up by walking over it
  S.level = 6; const n0 = S.bag.length;
  const it = G.rollItem(7, 'Robe', 3); g.player.x = 4; g.player.z = 10; L.drop(4, 4, it);
  o.beam = !!L.drops[0].g.userData.beam; o.fx = it.fx;
  await w(300); o.notYet = S.bag.length === n0;
  g.player.x = L.drops[0].x; g.player.z = L.drops[0].z; await w(600);
  o.picked = S.bag.length === n0 + 1 && L.drops.length === 0;
  // 2. a heal that drops loot puts it on the ground
  const p = g.people.list.find(p => p.zone === 'hub' && !p.dead); S.lootMeter = 99; p.hp = 5; g.player.x = p.x + 6; g.player.z = p.z; g.target = p; g.cast(1);
  await w(4000); o.healDrop = L.drops.length > 0 || S.bag.length > n0 + 1;
  // 3. uniques
  const u = G.makeUnique('emberfang', 8); g.player.x = 0; g.player.z = 25; L.drop(0, 25, u); await w(600);
  o.unique = !!(S.uniques && S.uniques.emberfang);
  // 4. effects and gear on the figure
  const k = S.bag.findIndex(x => x.unique); G.equipItem(S, k); const r = S.bag.findIndex(x => x.slot === 'Robe'); if (r >= 0) G.equipItem(S, r);
  g.dressed(); o.gear = g.fig.gear.length; o.hasSurge = G.hasFx(S, 'surge');
  S.equip.Boots = G.makeUnique('bristle', 8); g.dressed(); o.speed = g.player.gearSpeed;
  // 5. Need or Greed: crash a party's roll
  const party = g.people.list.filter(p => p.zone === 'hub' && !p.dead).slice(0, 4);
  L.startRoll(G.rollItem(7, null, 1), party, 'The pack'); await w(200);
  o.rollShown = getComputedStyle(document.getElementById('roll')).display === 'block';
  document.querySelector('#roll button[data-k=need]').click();
  for (let i = 0; i < 40 && L.roll; i++) await w(250);
  o.rolled = lines().filter(l => /won:|passed on/.test(l)).slice(-1)[0];
  return o;
});
// 6. the paper doll
await ev(() => { game.UI.toggleBag(); }); await pg.waitForTimeout(1200);
await pg.hover('#items .it >> nth=0'); await pg.waitForTimeout(800);
const box = await pg.locator('#bag').boundingBox();
await pg.screenshot({ path: OUT + '/doll.png', clip: box });
out.doll = await ev(() => ({ slots: document.querySelectorAll('#dl .it, #dr .it, #ds .it').length, uniq: document.getElementById('ucount').textContent, stats: document.getElementById('stats').textContent.slice(0, 120) }));
await ev(() => game.UI.toggleBag());
// 7. Old Tusk leaves something
out.tusk = await ev(async () => {
  const g = game, m = g.mobs.list.find(m => m.kind === 'tusk'); g.player.x = m.x + 8; g.player.z = m.z; await new Promise(r => setTimeout(r, 800));
  const n = g.loot.drops.length; for (let i = 0; i < 6; i++) { m.state = 'fight'; m.hp = 1; g.mobs.hurt(m, 99, g.me); m.state = 'idle'; m.hp = m.maxHp; }
  return g.loot.drops.length - n;
});
await ev(() => { const g = game, d = g.loot.drops[0]; if (d) { g.player.x = d.x + 5; g.player.z = d.z + 5; g.player.yaw = Math.atan2(d.x - g.player.x, d.z - g.player.z); g.player.pitch = 0.1; } });
await pg.waitForTimeout(1000); await pg.screenshot({ path: OUT + '/beam.png' });
console.log(JSON.stringify(out, null, 1), JSON.stringify(errs)); await br.close(); srv.close();
