// Headless check of the pond sprint: wading, swimming (no casting, monsters
// give up), people kept out of the water, people fishing on the bank, the
// healer fishing (cast, bite, reel, too soon, moving), Old Glimmerfin and
// its gossip, and eating a fish for mana.
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
await pg.goto(`http://localhost:${srv.address().port}/?quality=low`); await pg.click('#enter'); await pg.waitForTimeout(2500);
const ev = f => pg.evaluate(f); if (!(await ev(() => !!window.game))) { console.log('boot failed', errs); process.exit(1); }
const out = await ev(async () => {
  const g = game, P = g.player, S = g.S, w = ms => new Promise(r => setTimeout(r, ms)), o = {};
  const until = async (f, ms = 8000) => { for (let t = 0; t < ms && !f(); t += 100) await w(100); return f(); };
  const W = await import('./js/water.js'), pond = W.WATERS[0];
  const lines = () => [...document.querySelectorAll('#chat div')].map(d => d.textContent);
  o.pond = pond && pond.name;
  // 1. wading: slower and sunk a little
  // run west for a second of game time along z: dry ground, then the shallow band
  const run = async (x, z) => { P.x = x; P.z = z; P.yaw = -Math.PI / 2; await w(300); const t0 = g.T; P.keys.add('KeyW'); await until(() => g.T - t0 > 1); const d = (x - P.x) / (g.T - t0); P.keys.clear(); return d; };
  const dry = await run(-66, -108), wade = await run(-66, -123.5); o.speeds = [+dry.toFixed(1), +wade.toFixed(1)];
  o.wade = P.water; o.sink = +P.sink.toFixed(2); o.slower = wade < dry * 0.85;
  // 2. swimming: deeper, no casting, no drinking
  P.x = -66; P.z = -138; await w(800);
  o.swim = P.water; o.sinkDeep = +P.sink.toFixed(2);
  g.target = g.me; S.mana = 999; g.cast(0); o.noCast = !g.casting && /swimming/.test(document.getElementById('err').textContent);
  // 3. a monster on you gives up when you swim out
  const m = g.mobs.list.find(m => m.kind === 'slime' && m.state !== 'dead');
  m.state = 'fight'; m.foe = g.me; m.attackers.add(g.me); m.x = -66 + 17; m.z = -138; await w(800);
  o.mobGaveUp = m.foe !== g.me; o.mobDry = !W.waterAt(m.x, m.z);
  // 4. people are kept out of the water
  const p = g.people.list.find(p => p.zone === 'green' && !p.dead && !p.fishing);
  const q = { x: -66, z: -130 }; (await import('./js/world.js')).collide(q, 0.5); o.personOut = Math.hypot(q.x + 66, q.z + 138) >= 16;
  // 5. people fishing on the bank, with rods
  o.fishers = g.people.list.filter(p => p.fishing).length; o.npcRods = g.fishing.npc.size;
  // 6. the healer fishes: cast, bite, reel
  P.x = -66; P.z = -120.5; P.yaw = Math.PI; await w(500);
  o.fishBtn = getComputedStyle(document.getElementById('fishbtn')).display !== 'none';
  const n0 = S.bag.length; g.fish(); o.cast = g.fishing.state; await until(() => g.fishing.state === 'wait'); o.waiting = g.fishing.state;
  o.floatInWater = W.inside(pond, g.fishing.at.x, g.fishing.at.z) > 1;
  g.fishing.wait = 0; await until(() => g.fishing.state === 'bite'); o.bite = g.fishing.state;
  g.fish(); o.caught = S.bag.length === n0 + 1; o.what = S.bag[S.bag.length - 1] && S.bag[S.bag.length - 1].name;
  // 7. too soon, and moving stops it
  g.fish(); await w(900); g.fish(); o.tooSoon = lines().some(l => /too soon/.test(l));
  g.fish(); await until(() => g.fishing.state === 'wait'); P.keys.add('KeyS'); await w(300); P.keys.clear(); o.movedStops = !g.fishing.active;
  // 8. Old Glimmerfin: fame and gossip
  const f0 = S.fame; g.fishing.ctx.caught(g.G.fishCatch(S, 0.01), pond);
  o.glimmer = S.glimmer; o.fameUp = S.fame > f0; o.deed = (S.deeds || []).some(d => d.kind === 'fish');
  for (let i = 0; i < 30 && !o.gossip; i++) o.gossip = g.social.general({ name: 'x' });
  // 9. eat a fish on dry land
  P.x = -66; P.z = -112; await w(400); S.mana = 0;
  const i = S.bag.findIndex(x => x.kind === 'fish'); g.eat(i); o.eating = !!g.meal; await w(1500); o.manaBack = Math.round(S.mana);
  return o;
});
await ev(() => { const P = game.player; P.x = -66; P.z = -121; P.yaw = Math.PI; P.dist = 8; P.pitch = 0.3; game.fish(); }); await pg.waitForTimeout(1500);
await pg.screenshot({ path: OUT + '/fishing.png' });
await ev(() => { const P = game.player; P.x = -66; P.z = -140; P.yaw = Math.PI; P.dist = 8; P.pitch = 0.3; }); await pg.waitForTimeout(1200);
await pg.screenshot({ path: OUT + '/swim.png' });
console.log(JSON.stringify(out, null, 1), JSON.stringify(errs)); await br.close(); srv.close();
