// Headless check of sprint 3: the Emberdeep dungeon. Runs the world at 6x.
// First watches a run with no healer, then one where the test heals the party.
//   THREE_DIR=<node_modules/three> node tools/sprint3.mjs <out-dir>
import { createServer } from 'node:http'; import { readFile, mkdir } from 'node:fs/promises'; import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), OUT = process.argv[2] || '.'; await mkdir(OUT, { recursive: true });
const srv = createServer(async (q, r) => { try { const p = q.url.split('?')[0]; const b = await readFile(join(ROOT, p === '/' ? 'index.html' : p)); r.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript' }[extname(p)] || 'text/html' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await br.newPage({ viewport: { width: 1366, height: 620 } }); const errs = [];
pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await pg.route('**/cdn.jsdelivr.net/**', async rt => rt.fulfill({ body: await readFile(join(process.env.THREE_DIR, rt.request().url().split('three@0.186.1/')[1])), contentType: 'text/javascript' }));
await pg.route('**/fonts.g*/**', rt => rt.abort());
await pg.goto(`http://localhost:${srv.address().port}/?speed=6`); await pg.click('#enter'); await pg.waitForTimeout(1000);
const out = {};
const enter = () => pg.evaluate(() => { const P = game.people.list, d = game.dungeon; if (d.active) { game.player.x = game.DUN.exits[0].x; game.player.z = game.DUN.exits[0].z; } });
await pg.evaluate(() => { game.player.x = -47; game.player.z = -15; }); await pg.waitForTimeout(800);
out.entered = await pg.evaluate(() => [document.getElementById('zone').textContent, game.dungeon.party.length, game.dungeon.mobs.length]);
await pg.screenshot({ path: OUT + '/enter.png' });
const run = async (heal, shot) => {
  const log = []; let last = '';
  for (let i = 0; i < 150; i++) {
    const s = await pg.evaluate(heal => {
      const d = game.dungeon, t = d.tank() || d.party[0];
      if (t && !t.gone) { game.player.x = t.x + 3; game.player.z = t.z + 6; game.player.yaw = Math.atan2(-3, -6); collideFix(); }
      function collideFix() {}
      if (heal) for (const p of d.party) { if (p.dead && !p.gone) game.people.revive(p); if (!p.gone && !p.dead && p.hp < p.maxHp * 0.6) game.people.heal(p, heal, false); }
      return { phase: d.phase, room: d.room, alive: d.alive().length, boss: Math.round(d.mobs[d.mobs.length - 1].hp / d.mobs[d.mobs.length - 1].maxHp * 100), bag: game.S.bag.length, won: d.won };
    }, heal);
    const k = s.phase + s.room; if (k !== last) { last = k; log.push(`${s.phase}${s.room}:${s.alive}`); }
    if (shot && s.phase === 'fight' && s.room === 3 && s.boss < 80 && shot !== 'done') { await pg.screenshot({ path: OUT + '/boss.png' }); shot = 'done'; }
    if (s.phase === 'wipe' || s.phase === 'done') { log.push(`boss ${s.boss}% bag ${s.bag}`); break; }
    await pg.waitForTimeout(1000);
  }
  return log.join(' ');
};
out.noHealer = await run(0);
await enter(); await pg.waitForTimeout(600);
out.left = await pg.evaluate(() => [document.getElementById('zone').textContent, game.dungeon.active, game.people.list.filter(p => p.zone === 'dungeon').length]);
await pg.evaluate(() => { game.player.x = -47; game.player.z = -15; }); await pg.waitForTimeout(800);
out.healed = await run(30, true);
await pg.screenshot({ path: OUT + '/end.png' });
console.log(JSON.stringify(out, null, 1), JSON.stringify(errs)); await br.close(); srv.close();
