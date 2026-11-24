// Headless check of sprint 12, the Bloodsand Pit: two teams of six, a
// match that plays out (flags taken, captures, deaths and respawns), the
// scoreboard and team frames, hunters sent after a healer who picks a side
// (and a guard from the side picked), Fade, and the reward at the end.
//   THREE_DIR=<node_modules/three> node tools/pit.mjs <out-dir>
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
await pg.goto(`http://localhost:${srv.address().port}/?quality=low&speed=6`); await pg.click('#enter'); await pg.waitForTimeout(2500);
const ev = f => pg.evaluate(f); if (!(await ev(() => !!window.game))) { console.log('boot failed', errs); process.exit(1); }
const out = await ev(async () => {
  const g = game, P = g.player, S = g.S, X = g.pit, w = ms => new Promise(r => setTimeout(r, ms)), o = {};
  const until = async (f, ms) => { for (let t = 0; t < ms && !f(); t += 200) await w(200); return f(); };
  const lines = () => [...document.querySelectorAll('#chat div')].map(d => d.textContent);
  S.level = 6; P.x = -47; P.z = 15; await until(() => X.active, 4000);
  o.teams = [X.team('sun').length, X.team('dusk').length]; await w(400);
  o.board = getComputedStyle(document.getElementById('pitb')).display === 'block';
  o.frames = [...document.querySelectorAll('#raidf .rc')].filter(c => c.style.display !== 'none' && c.style.visibility !== 'hidden').length;
  // 1. a match plays on its own
  await until(() => X.phase === 'play', 30000);
  const t0 = g.T; let took = 0, deaths = 0, rose = 0, seen = new Set();
  await until(() => {
    for (const k in X.flag) if (X.flag[k].by) took++;
    for (const p of X.party) { if (p.dead && !seen.has(p)) { seen.add(p); deaths++; } if (!p.dead && seen.has(p)) { seen.delete(p); rose++; } }
    return X.score.sun + X.score.dusk >= 1 || g.T - t0 > 200;
  }, 150000);
  o.play = { flagTaken: took > 0, captures: X.score.sun + X.score.dusk, deaths, respawns: rose, after: Math.round(g.T - t0) };
  o.capLine = lines().filter(l => /captures|has taken|drops/.test(l)).slice(-2);
  // 2. heal Sunward only: Duskward sends hunters, Sunward warms to you
  P.x = 3000 + 20; P.z = 0; S.mana = 9999;
  const sun = () => X.team('sun').filter(p => !p.dead && p.hp < p.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  const t1 = g.T;
  await until(() => {
    const p = sun(); if (p && !g.casting) { P.x = p.x + 5; P.z = p.z; g.target = p; S.mana = 9999; g.cast(1); X.healed(p, p.maxHp * 0.25); }
    return X.hunters.dusk >= 1 || g.T - t1 > 120;
  }, 90000);
  o.hate = { sun: +X.hate.sun.toFixed(2), dusk: +X.hate.dusk.toFixed(2) }; o.hunters = { ...X.hunters };
  o.stand = X.board().stand;
  await w(1500);
  o.huntingMe = X.party.filter(p => p.team === 'dusk' && p.mob === g.me).length;
  o.guard = X.party.some(p => p.team === 'sun' && p.role === 'fighter' && Math.hypot(p.dest ? p.dest.x - g.me.x : 99, p.dest ? p.dest.z - g.me.z : 99) < 6 || (p.team === 'sun' && p.mob && p.mob.team === 'dusk' && p.mob.mob === g.me));
  // 3. Fade shakes them off for a moment
  g.cds.fade = 0; S.level = 6; const gcd = await w(1300); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit6' })); await w(400);
  o.afterFade = X.party.filter(p => p.team === 'dusk' && p.mob === g.me && !p.dead).length;
  // 4. the end: force a Sunward win and check the reward
  const xp0 = S.xp, lvl0 = S.level; X.score.sun = 2; const p = X.team('sun').find(p => !p.dead) || X.team('sun')[0];
  X.end('sun'); await w(300);
  o.reward = S.xp > xp0 || S.level > lvl0; o.endLine = lines().filter(l => /side you healed|wins the Bloodsand/.test(l)).slice(-2);
  o.deed = (S.deeds || []).some(d => d.kind === 'pit');
  return o;
});
await pg.screenshot({ path: OUT + '/pit.png' });
console.log(JSON.stringify(out, null, 1), JSON.stringify(errs)); await br.close(); srv.close();
