// Headless check of sprint 9, the clock: the schedule, the board and the
// tracker, each kind of event (Emberdeep run alone and with the healer, Old
// Tusk hunt, duelling tournament, Spire raid) and the zone level bands.
//   THREE_DIR=<node_modules/three> node tools/clock.mjs <out-dir>
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
await pg.goto(`http://localhost:${srv.address().port}/?quality=low&speed=2`); await pg.click('#enter'); await pg.waitForTimeout(2500);
const ev = f => pg.evaluate(f); if (!(await ev(() => !!window.game))) { console.log('boot failed', errs); process.exit(1); }
const out = await ev(async () => {
  const g = game, P = g.player, S = g.S, C = g.clock, w = ms => new Promise(r => setTimeout(r, ms)), o = {};
  const until = async (f, ms = 15000) => { for (let t = 0; t < ms && !f(); t += 100) await w(100); return f(); };
  const ev = k => C.events.find(e => e.kind === k);
  const now = (k, gap = 2) => { const e = ev(k); e.gatherAt = C.T; e.start = C.T + gap; return e; };
  const last = () => C.results[0] && C.results[0].name + ': ' + C.results[0].text;
  o.scheduled = C.events.map(e => e.kind).sort().join();
  await w(800); o.tracker = document.querySelectorAll('#tracker div').length;
  // 1. Emberdeep run without the healer
  let e = now('dungeon', 3); await until(() => e.state === 'gather'); o.dGather = e.people.length; o.dTank = e.party[0].cls;
  await until(() => e.state === 'on'); o.dGoing = e.people.every(p => p.leaving === 'dungeon');
  e.endAt = C.T; await until(() => e.state === 'done'); o.dResult = last(); o.dNext = !!ev('dungeon');
  // 2. Emberdeep run with the healer: the party inside is the one from the board
  e = now('dungeon', 1); await until(() => e.state === 'on');
  P.x = -47; P.z = -15; await until(() => g.dungeon.active && g.dungeon.party.length);
  o.dJoined = g.dungeon.party.map(p => p.name).join() === e.party.map(p => p.name).join();
  o.dBand = g.dungeon.party.slice(1).every(p => p.level >= 5 && p.level <= 10);
  g.dungeon.ctx.runOver(true, g.dungeon); o.dWith = last();
  P.x = g.DUN.exits[0].x; P.z = g.DUN.exits[0].z; await until(() => P.x < 500);
  // 3. Old Tusk hunt
  const tusk = g.mobs.list.find(m => m.kind === 'tusk');
  e = now('tusk', 2); await until(() => e.state === 'gather'); o.tGather = e.people.length;
  await until(() => e.state === 'on'); o.tHunting = e.people.filter(p => p.mob === tusk).length;
  tusk.state = 'fight'; tusk.hp = 1; g.mobs.hurt(tusk, 99, e.people[0]); await until(() => e.state === 'done'); o.tResult = last();
  // 4. Duelling tournament (the fights are ended by hand to save time)
  e = now('duel', 2); await until(() => e.state === 'on');
  for (let i = 0; i < 3 && e.state === 'on'; i++) { await until(() => e.cur && e.cur[0].duel && e.cur[1].duel); const [a, b] = e.cur; g.people.endDuel(a, b, false); await until(() => e.cur !== null && e.cur[0] !== a || e.state === 'done', 4000); }
  await until(() => e.state === 'done'); o.duel = last();
  // 5. Spire raid
  e = now('raid', 2); await until(() => e.state === 'on'); o.rPeople = e.people.length; e.endAt = C.T; await until(() => e.state === 'done'); o.raid = last();
  // 6. bands
  o.greenBand = g.people.list.filter(p => p.zone === 'green').every(p => p.level >= 1 && p.level <= 6);
  o.mobBand = g.mobs.list.every(m => m.level >= 1 && m.level <= 8);
  // 7. the board window
  g.UI.toggleEvents(); await w(300); o.board = document.querySelectorAll('#evdone .ev').length;
  return o;
});
await pg.screenshot({ path: OUT + '/board.png' });
console.log(JSON.stringify(out, null, 1), JSON.stringify(errs)); await br.close(); srv.close();
