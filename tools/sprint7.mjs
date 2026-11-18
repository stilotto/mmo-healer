// Headless check of sprint 7: the roster, records, fame, gossip, the chat
// box, slash commands, emotes, whispers and the guild invite.
//   THREE_DIR=<node_modules/three> node tools/sprint7.mjs <out-dir>
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
  const g = game, w = ms => new Promise(r => setTimeout(r, ms)), o = {}, S = g.S, soc = g.social;
  const lines = () => [...document.querySelectorAll('#chat div')].map(d => d.textContent);
  o.roster = S.roster.length; o.v = S.v;
  o.fromRoster = g.people.list.filter(p => p.who).length + '/' + g.people.list.length;
  // records: heal someone near death
  const p = g.people.list.find(p => p.who && p.zone === 'hub' && !p.dead);
  g.player.x = p.x + 5; g.player.z = p.z; p.hp = Math.round(p.maxHp * 0.1); p.hurtAt = g.people.t;
  g.target = p; S.mana = 9999; g.cast(3); g.cast(0);
  for (let i = 0; i < 40 && g.casting; i++) await w(200);
  const r = S.rec[p.name]; o.rec = r && { h: r.h, s: r.s }; o.fame = S.fame;
  // friend: wave when close
  r.h = 30; p.waveAt = 0; p.state = 'idle'; p.wait = 99; g.player.x = p.x + 3; g.player.z = p.z; await w(1500);
  o.waved = p.anim === 'wave' || lines().some(l => l.includes(p.name));
  o.label = soc.label(p);
  // chat box: Enter opens, Enter sends
  document.getElementById('view').focus();
  return o;
});
await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
out.boxOpen = await ev(() => document.activeElement.id === 'chatin');
await pg.keyboard.type('hello everyone'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(3000);
out.said = await ev(() => [...document.querySelectorAll('#chat div')].map(d => d.textContent).filter(t => t.includes('says:')).slice(-3));
await pg.keyboard.press('Slash'); await pg.keyboard.type('wave'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(2500);
out.more = await ev(async () => {
  const g = game, w = ms => new Promise(r => setTimeout(r, ms)), o = {}, S = g.S, soc = g.social, C = g.Chat;
  const lines = () => [...document.querySelectorAll('#chat div')].map(d => d.textContent);
  o.emote = lines().filter(l => /wave/.test(l)).slice(-2);
  const p = g.target; C.send('/who ' + p.name); o.who = lines().slice(-1)[0];
  C.send('/who'); o.whoAll = lines().slice(-1)[0].slice(0, 80);
  C.send('/w ' + p.name.slice(0, 4) + ' hi there'); await w(5000); o.whisper = lines().filter(l => /whispers|To \[/.test(l)).slice(-2);
  C.send('/roll'); o.roll = lines().slice(-1)[0];
  C.send('/target ' + p.name.toLowerCase()); o.targeted = g.target === p;
  C.send('/dance'); o.dance = lines().slice(-1)[0];
  C.send('/leave general'); o.left = S.chan.general === false; C.send('/join general');
  C.send('/help'); o.help = lines().slice(-5).length;
  C.send('/bogus'); o.bogus = lines().slice(-1)[0];
  // tabs
  document.querySelectorAll('#ctabs b')[4].click(); o.combatTab = lines().length; document.querySelectorAll('#ctabs b')[0].click();
  // gossip: a deed gets told in General
  for (let i = 0; i < 60 && !lines().some(l => l.includes('[General]') && /saved|heal|pull/.test(l)); i++) { S.deeds.forEach(d => d.told = false); await w(500); }
  o.deeds = JSON.stringify(S.deeds); o.gen = soc.general({ name: 'x' }); o.gossip = lines().filter(l => l.includes('[General]')).slice(-3);
  // fame and a guild invite
  S.fame = 45; soc.inviteT = 0; for (const r of S.roster) if (r.guild) { S.rec[r.name] = S.rec[r.name] || { h: 0, s: 0, r: 0, d: 0, w: 0 }; S.rec[r.name].h = 12; }
  await w(1000); o.invite = !!document.querySelector('#chat button[data-act=accept]');
  document.querySelector('#chat button[data-act=accept]')?.click(); await w(3000); o.guild = S.guild; o.gchat = lines().filter(l => l.includes('[Guild]')).length;
  o.fameText = document.getElementById('famen').textContent;
  // letting someone die nearby is remembered
  const q = g.people.list.find(x => x.who && x.zone === 'hub' && !x.dead && x !== p);
  g.player.x = q.x + 4; g.player.z = q.z; g.people.kill(q, { name: 'Test' }); o.letDie = S.rec[q.name].d;
  return o;
});
await pg.screenshot({ path: OUT + '/end.png' });
console.log(JSON.stringify(out, null, 1), JSON.stringify(errs)); await br.close(); srv.close();
