// Headless check of sprint 10, the Shattered Spire: the level gate, the
// raid of twenty with raid frames, a run with no healer (should wipe), a run
// with steady healing (should get further, ideally kill both bosses), the
// boss spells, Cleanse on Splinters, loot rolls and the uniques.
//   THREE_DIR=<node_modules/three> node tools/raid.mjs <out-dir>
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
await pg.goto(`http://localhost:${srv.address().port}/?quality=low&speed=6`); await pg.click('#enter'); await pg.waitForTimeout(2500);
const ev = f => pg.evaluate(f); if (!(await ev(() => !!window.game))) { console.log('boot failed', errs); process.exit(1); }
const out = await ev(async () => {
  const g = game, P = g.player, S = g.S, R = g.raid, w = ms => new Promise(r => setTimeout(r, ms)), o = {};
  const until = async (f, ms) => { for (let t = 0; t < ms && !f(); t += 200) await w(200); return f(); };
  const story = () => `${R.phase} boss${R.boss + 1} alive ${R.alive().length} ${R.mobs.filter(m => m.def.boss).map(m => m.name.split(' ').pop() + ' ' + Math.round(m.hp / m.maxHp * 100) + '%').join(' ')}`;
  // 1. the level gate
  S.level = 3; P.x = -52; P.z = 0; await w(600); o.gated = P.x < 1500;
  // 2. in at level 8: twenty, frames, tanks and healers
  S.level = 8; S.mana = 999; P.x = -52; P.z = 0; await until(() => R.active, 4000);
  o.party = R.party.length; o.tanks = R.party.filter(p => p.tank).length; o.healers = R.party.filter(p => p.healer).length;
  await w(500); o.frames = [...document.querySelectorAll('#raidf .rc')].filter(c => c.style.visibility !== 'hidden').length;
  o.band = R.party.filter(p => !p.tank).every(p => p.level >= 7 && p.level <= 11);
  // 3. no healer: stay at the entrance and watch
  const t0 = g.T; let spells = new Set();
  await until(() => { for (const m of R.mobs) if (m.cast) spells.add(m.cast.name); return R.phase === 'wipe' || R.phase === 'done' || g.T - t0 > 420; }, 240000);
  o.noHealer = story() + ` after ${Math.round(g.T - t0)}s`; o.spells = [...spells];
  // 4. with healing: a scripted healer keeps the tanks and the lowest up (on real mana) and cleanses
  await until(() => R.phase === 'gather', 60000);
  const t1 = g.T; let cleansed = 0, healed = 0; spells = new Set();
  const heal = setInterval(() => {
    if (g.casting || g.me.dead) return;
    const a = R.alive(); if (!a.length) return;
    const tk = a.filter(p => p.tank).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
    const low = a.sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
    const dotted = a.find(p => p.dots && p.dots.length);
    const near = q => { P.x = q.x; P.z = q.z + 14; };
    if (dotted && S.talents && S.talents.cleanse && S.mana > 30) { near(dotted); g.target = dotted; g.cast(7); cleansed++; return; }
    const t = tk && tk.hp < tk.maxHp * 0.7 ? tk : low;
    if (t && t.hp < t.maxHp * 0.85) { near(t); g.target = t; g.cast(t === tk ? 0 : 1); healed++; }
  }, 250);
  S.talents = { cleanse: 1, lasting: 2, thick: 3, deep: 1, quicken: 1 };
  await until(() => { for (const m of R.mobs) if (m.cast) spells.add(m.cast.name); return R.phase === 'done' || R.phase === 'wipe' || g.T - t1 > 600; }, 400000);
  clearInterval(heal);
  o.withHealer = story() + ` after ${Math.round(g.T - t1)}s, casts ${healed}, cleanses ${cleansed}`; o.spells2 = [...spells];
  o.uniques = Object.keys(S.uniques || {}); o.raidKills = S.raidKills || 0;
  o.rollLines = [...document.querySelectorAll('#chat div')].map(d => d.textContent).filter(l => /won:|rolls|Raid\]/.test(l)).slice(-4);
  return o;
});
await pg.screenshot({ path: OUT + '/raid.png' });
console.log(JSON.stringify(out, null, 1), JSON.stringify(errs)); await br.close(); srv.close();
