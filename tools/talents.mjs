// Headless check of the talents: points, tiers, learning and reset, the
// window, Circle and Cleanse, and each talent's effect; also F targeting
// the most hurt person in range, the healer included.
//   THREE_DIR=<node_modules/three> node tools/talents.mjs <out-dir>
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
  const g = game, P = g.player, S = g.S, G = g.G, w = ms => new Promise(r => setTimeout(r, ms)), o = {};
  const until = async (f, ms = 8000) => { for (let t = 0; t < ms && !f(); t += 100) await w(100); return f(); };
  // 1. points and tiers
  S.level = 2; o.noPoints = G.learn(S, 'quick');
  S.level = 12; G.resetTalents(S); o.free = G.pointsFree(S);
  o.tierLocked = G.learn(S, 'overflow');
  for (const id of ['quick', 'quick', 'quick', 'steady', 'steady']) G.learn(S, id);
  o.capLocked = G.learn(S, 'circle'); G.learn(S, 'overflow'); o.circle = G.learn(S, 'circle') || 'ok';
  for (const id of ['deep', 'deep', 'deep', 'quicken']) G.learn(S, id);
  o.left = G.pointsFree(S);
  o.mendTime = +G.castTime(S, G.SPELLS[0]).toFixed(2); o.regenUp = G.stats(S).regen;
  // 2. the window and the new slot
  g.UI.toggleTalents(); await w(300);
  o.window = getComputedStyle(document.getElementById('talents')).display === 'block' && document.querySelectorAll('.tal').length;
  g.UI.toggleTalents();
  o.circleSlot = [...document.querySelectorAll('#actions .slot')].filter(s => s.style.display !== 'none').length;
  // 3. Circle heals a group
  const hub = g.people.list.filter(p => p.zone === 'hub' && !p.dead && p.grow >= 1);
  const a = hub[0], near = hub.slice(1, 3); for (const p of [a, ...near]) { p.hp = p.maxHp * 0.3; p.x = 10 + Math.random() * 2; p.z = 30; p.state = 'idle'; p.wait = 99; }
  P.x = 10; P.z = 36; await w(200); g.target = a; S.mana = 999; const before = near.map(p => p.hp);
  g.cast(6); await until(() => !g.casting, 12000); await w(300);
  o.circleGroup = near.every((p, i) => p.hp > before[i]);
  // 4. Cleanse
  G.resetTalents(S); for (const id of ['lasting', 'lasting', 'thick', 'deep', 'deep', 'deep', 'quicken', 'deep']) G.learn(S, id);
  o.cleanseLocked = G.learn(S, 'cleanse'); G.learn(S, 'thick'); o.cleanse = G.learn(S, 'cleanse') || 'ok';
  a.dots = [{ tick: 3, left: 5, every: 2, t: 2, by: { name: 'test' } }]; await w(1400);
  g.target = a; g.cast(7); o.cleansed = !a.dots.length;
  // 5. F includes you
  for (const p of g.people.list) if (!p.dead) p.hp = p.maxHp; g.me.hp = g.me.maxHp * 0.2; g.hurtTarget(); o.fSelf = g.target === g.me;
  g.me.hp = g.me.maxHp; a.hp = a.maxHp * 0.1; g.hurtTarget(); o.fOther = g.target === a;
  // 6. Shadow: quiet hands, waterborne, last breath, second wind
  G.resetTalents(S); for (const id of ['quiet', 'quiet', 'quiet', 'water', 'swift', 'breath', 'calm', 'wind']) o['s_' + id] = G.learn(S, id) || 'ok';
  const t0 = g.T; P.x = -66; P.z = -123.5; P.yaw = -Math.PI / 2; await w(300); const x0 = P.x, t1 = g.T; P.keys.add('KeyW'); await until(() => g.T - t1 > 1); o.wadeSpeed = +((x0 - P.x) / (g.T - t1)).toFixed(1); P.keys.clear();
  P.x = 0; P.z = 20; await w(300);
  g.me.hp = 5; g.people.hurt(g.me, 50, { name: 'Test Wolf' }); o.lastBreath = !g.me.dead && g.me.hp === 1;
  g.me.hp = 5; g.people.hurt(g.me, 50, { name: 'Test Wolf' }); o.diedSecond = g.me.dead;
  await w(300); o.windBtn = getComputedStyle(document.getElementById('wbtn')).display !== 'none';
  g.secondWind(); o.rose = !g.me.dead && g.me.hp > 1;
  return o;
});
await ev(() => { game.G.resetTalents(game.S); ['quick','quick','steady','overflow','deep'].forEach(id => game.G.learn(game.S, id)); game.UI.toggleTalents(); }); await pg.waitForTimeout(600);
await pg.screenshot({ path: OUT + '/talents.png' });
await pg.setViewportSize({ width: 390, height: 760 }); await pg.waitForTimeout(600);
await pg.screenshot({ path: OUT + '/talents-phone.png' });
console.log(JSON.stringify(out, null, 1), JSON.stringify(errs)); await br.close(); srv.close();
