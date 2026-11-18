// Headless check of sprint 6: healing threat, the healer taking damage,
// Fade, death, the ghost run, the safe town and the tank taking aggro back.
//   THREE_DIR=<node_modules/three> node tools/sprint6.mjs <out-dir>
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
const ev = f => pg.evaluate(f);
const out = await ev(async () => {
  const g = game, w = ms => new Promise(r => setTimeout(r, ms)), o = {}, me = g.me;
  const until = async (f, n = 60) => { for (let i = 0; i < n && !f(); i++) await w(250); return f(); };
  const castWhenReady = async i => { const E = document.getElementById('err'); for (let k = 0; k < 40; k++) { E.textContent = ''; g.cast(i); if (E.textContent !== 'Not ready yet') return E.textContent; await w(250); } };
  g.S.level = 6; g.S.mana = 9999;
  // 1. a fight in Greenhollow: heal the fighter until the monster turns
  const m = g.mobs.list.find(m => m.kind === 'boar' && m.state !== 'dead');
  const p = g.people.list.find(p => p.zone === 'green' && !p.dead);
  m.state = 'fight'; m.foe = p; m.attackers.add(p); p.mob = m; p.state = 'hunt'; p.x = m.x + 1.5; p.z = m.z; m.dmg = 3; m.hp = 1e6;   // so the fighter cannot kill it mid-test
  g.player.x = m.x + 6; g.player.z = m.z + 4; g.target = p;
  o.casts = []; for (let k = 0; k < 8 && m.foe !== me; k++) { p.hp = Math.round(p.maxHp * 0.3); o.casts.push(await castWhenReady(0)); await until(() => !g.casting, 40); }
  o.turned = m.foe === me; o.dbg = [m.ht, m.maxHp, m.state, g.target === p, p.hp, document.getElementById('zone').textContent];
  await until(() => me.hp < me.maxHp, 40); o.hurt = me.hp < me.maxHp; o.combatGlow = document.getElementById('pframe').classList.contains('combat');
  // 2. Fade
  o.fade = await castWhenReady(5); o.afterFade = m.foe !== me;
  // 3. death and the ghost run
  m.foe = me; m.attackers.add(me); m.dmg = 20; me.hp = 1; me.ward = null;
  o.diedByMob = await until(() => me.dead, 60); if (!me.dead) g.people.hurt(me, 9999, m); o.died = me.dead; o.panel = document.getElementById('dtext').textContent;
  document.getElementById('dbtn').click(); await w(500);
  o.ghostAt = [Math.round(g.player.x), Math.round(g.player.z)]; o.ghostTint = document.body.classList.contains('ghost');
  o.ignored = !g.mobs.list.some(x => x.foe === me);
  const c = g.corpse; if (!c) return o; g.player.x = c.x + 2; g.player.z = c.z; await w(800);
  o.bodyBtn = document.getElementById('dbtn').textContent + (document.getElementById('dbtn').disabled ? ' (disabled)' : '');
  document.getElementById('dbtn').click(); await w(300);
  o.alive = !me.dead && Math.round(me.hp / me.maxHp * 100);
  // 4. the town is safe: a monster chasing you stops at the gate
  const m2 = g.mobs.list.find(x => x.kind === 'slime' && x.state !== 'dead');
  me.faded = 0; m2.state = 'fight'; m2.foe = me; m2.attackers.add(me); g.player.x = 0; g.player.z = -40;
  await w(1500); o.safe = m2.foe !== me;
  return o;
});
// 5. Emberdeep: overheal the tank in a fight until a monster turns, then watch the tank take it back
await ev(() => { game.player.x = -47; game.player.z = -15; }); await pg.waitForTimeout(1500);
out.dun = await ev(async () => {
  const g = game, d = g.dungeon, me = g.me, w = ms => new Promise(r => setTimeout(r, ms));
  g.S.mana = 9999; let turned = false, back = false;
  for (let i = 0; i < 300 && !back && d.phase !== 'wipe' && d.phase !== 'done'; i++) {
    const t = d.tank(); if (!t) break;
    g.player.x = t.x + 4; g.player.z = t.z + 6; me.hp = me.maxHp; g.S.mana = 9999;
    for (const p of d.party) { if (p.dead && !p.gone) g.people.revive(p); }
    if (d.phase === 'fight' && !g.casting) { g.target = t; t.hp = Math.max(1, t.hp - 150); g.cast(0); }
    if (d.mobs.some(m => m.foe === me)) turned = true;
    if (turned && !d.mobs.some(m => m.foe === me && m.state === 'fight')) back = true;
    await w(250);
  }
  return { turned, back };
});
await pg.screenshot({ path: OUT + '/end.png' });
console.log(JSON.stringify(out), JSON.stringify(errs)); await br.close(); srv.close();
