// The clock: things happen on a schedule whether the healer goes or not.
// Four kinds of event: an Emberdeep run, an Old Tusk hunt, a duelling
// tournament and a Shattered Spire raid. Each gathers its people for a
// minute or so, runs, and reports how it went. The events board by the
// fountain and the tracker under the minimap show what is coming.
import { POI } from './world.js';

const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
export const EVENTS = {
  dungeon: { name: 'Emberdeep run', where: 'the Emberdeep portal', every: [260, 380], gather: 60, run: 300, first: 90 },
  tusk: { name: 'Old Tusk hunt', where: 'the warden\'s camp in Greenhollow', every: [300, 420], gather: 50, run: 160, first: 160 },
  duel: { name: 'Duelling tournament', where: 'the duelling ring', every: [380, 520], gather: 50, run: 400, first: 230 },
  raid: { name: 'Shattered Spire raid', where: 'the Shattered Spire portal', every: [420, 600], gather: 60, run: 210, first: 320 },
};
export const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export class Clock {
  constructor(ctx) {
    this.ctx = ctx; this.T = 0; this.events = []; this.results = []; this.n = 0;
    for (const k in EVENTS) this.plan(k, EVENTS[k].first);
  }
  plan(kind, inSec) {
    const d = EVENTS[kind], start = this.T + inSec;
    this.events.push({ id: ++this.n, kind, name: d.name, where: d.where, start, gatherAt: start - d.gather, state: 'soon', people: [], deaths: 0 });
  }
  // For the tracker and the board: what is coming and what is under way, soonest first.
  list() { return this.events.filter(e => e.state !== 'done').sort((a, b) => a.start - b.start); }
  status(e) {
    return e.state === 'soon' ? 'in ' + fmt(e.start - this.T) : e.state === 'gather' ? 'gathering · starts in ' + fmt(e.start - this.T) : 'under way';
  }
  // Short form for the tracker.
  short(e) { return e.state === 'soon' ? fmt(e.start - this.T) : e.state === 'gather' ? 'forming ' + fmt(e.start - this.T) : 'now'; }
  say(text) { this.ctx.chat('c-sys', '[Events] ' + text); }
  gen(p, text, zone) { if (p && !p.gone) this.ctx.chat('c-gen', `[${zone ? 'Greenhollow' : 'General'}] ${p.name}: ${text}`); }

  // The Emberdeep party or the raiders: if they went in and the healer
  // follows while it is under way, these are the people inside.
  booked(kind = 'dungeon') {
    const e = this.events.find(e => e.kind === kind && e.state === 'on' && !e.joined);
    if (!e || !e.party) return null;
    for (const p of e.people) if (!p.gone) this.ctx.people.remove(p);      // still at the portal: they are the ones inside now
    e.joined = true; return e.party;
  }
  runOver(won, d, kind = 'dungeon') {
    const e = this.events.find(e => e.kind === kind && e.state === 'on' && e.joined);
    if (!e) return;
    const dead = d.party.filter(p => p.dead).length;
    if (kind === 'raid') return this.finish(e, won ? `The Hollow Regent is down! A stranger healed the raid${dead ? ` (${dead} died)` : ''}.` : 'Wiped, even with a stranger healing.', won);
    this.finish(e, won ? `Cleared, with a stranger healing them${dead ? ` (${dead} died on the way)` : ''}.` : 'Wiped, even with a healer along.', won);
  }

  // Someone to take part: the free people of a zone who are healthy, not fishing and not booked.
  free(zone) {
    const P = this.ctx.people;
    return P.list.filter(p => p.zone === zone && !p.dead && !p.fading && !p.gone && !p.event && !p.duel && !p.leaving && !p.path && !p.fishing && p.grow >= 1 && p.hp > p.maxHp * 0.6);
  }
  // Free town folk, topped up with newcomers who came for the event.
  crowd(n) {
    const P = this.ctx.people, out = this.free('hub').slice(0, n);
    while (out.length < n) { const a = rnd(0, 6.283), p = P.spawn(Math.sin(a) * 30, Math.cos(a) * 30, 1); out.push(p); }
    return out;
  }
  gather(e) {
    const P = this.ctx.people, k = e.kind;
    if (k === 'dungeon') {
      // A tank and four more from the roster walk to the portal.
      const S = this.ctx.S, busy = new Set(P.list.map(p => p.name));
      const tank = pick(S.roster.filter(r => r.cls === 'Knight' && !busy.has(r.name))), rest = S.roster.filter(r => r.cls !== 'Knight' && !busy.has(r.name)).sort(() => Math.random() - 0.5).slice(0, 4);
      if (!tank || rest.length < 4) return this.finish(e, 'Nobody turned up.', false);
      e.party = [tank, ...rest].map(r => ({ name: r.name, cls: r.cls }));
      e.people = e.party.map((r, i) => { const a = rnd(0, 6.283), p = P.spawn(Math.sin(a) * 20, 10 + Math.cos(a) * 20, 1, r.cls, r.name); P.go(p, POI.dungeon, 2.5); return p; });
      this.gen(e.people[0], pick(['LFM Emberdeep, meeting at the portal now', 'Emberdeep run in a minute, at the portal. no healer, we will be fine', 'tank here, Emberdeep, who is in?']));
    } else if (k === 'tusk') {
      e.people = this.free('green').filter(p => p.state !== 'hunt').slice(0, 4);
      while (e.people.length < 4) { const p = P.spawn(POI.gateOut.x + rnd(-1, 1), POI.gateOut.z - 2, 1); p.zone = 'green'; P.relevel(p, 'green'); e.people.push(p); }
      for (const p of e.people) { p.mob = null; P.go(p, POI.camp, 3); }
      this.gen(e.people[0], pick(['Old Tusk hunt at the camp, 4 of us going', 'who wants Old Tusk? meet at the warden', 'LFG Old Tusk, at the camp now']), true);
    } else if (k === 'duel') {
      e.people = this.crowd(4);
      for (const p of e.people) P.go(p, { x: POI.ring.x, z: POI.ring.z + 6 }, 3);
      this.gen(e.people[0], pick(['duelling tournament in the ring, I am in', 'tournament time! ring, now', 'four of us in the ring, come watch']));
    } else if (k === 'raid') {
      e.people = this.crowd(8);
      for (const p of e.people) P.go(p, POI.raid, 3);
      this.gen(e.people[0], pick(['Shattered Spire raid forming at the portal', 'LFM Spire, need heals!! anyone?', 'raid in a minute, Spire portal']));
    }
    for (const p of e.people) { p.event = e; p.resting = false; }
    e.state = 'gather';
    this.say(`${e.name} gathering at ${e.where}. Starts in ${fmt(e.start - this.T)}.`);
  }
  begin(e) {
    const P = this.ctx.people, k = e.kind;
    e.people = e.people.filter(p => !p.gone && !p.dead);
    if (k === 'tusk') {
      const t = this.ctx.mobs.list.find(m => m.kind === 'tusk');
      if (!t || t.state === 'dead') { e.start += 15; return; }          // wait for it to come back
      e.tusk = t; for (const p of e.people) { p.mob = t; p.state = 'hunt'; p.stuck = 0; }
      this.say(`${e.name}: the hunters charge Old Tusk at the watchtower.`);
    } else if (k === 'dungeon' || k === 'raid') {
      if (k === 'raid') e.party = e.people.map(p => ({ name: p.name, cls: p.cls }));
      for (const p of e.people) { p.leaving = k; P.go(p, POI[k], 0.6); }
      this.say(`${e.name}: the party goes in.`);
    } else if (k === 'duel') {
      const [a, b, c, d] = e.people.sort(() => Math.random() - 0.5);
      e.bracket = [[a, b], [c, d]]; e.round = 0; e.final = []; this.match(e);
      this.say(`${e.name} begins: ${a.name} against ${b.name}, then ${c.name} against ${d.name}.`);
    }
    e.state = 'on'; e.endAt = this.T + EVENTS[k].run;
  }
  match(e) {
    const m = e.round < 2 ? e.bracket[e.round] : e.final;
    if (m.some(p => !p || p.gone || p.dead)) { const w = m.find(p => p && !p.gone && !p.dead); this.next(e, w); return; }
    for (const p of m) p.duelResult = null;
    this.ctx.people.duelPair(m[0], m[1]); e.cur = m;
  }
  next(e, w) {
    if (e.round < 2) { e.final.push(w); e.round++; if (e.round === 2 && e.final.filter(Boolean).length < 2) return this.finish(e, e.final[0] ? `${e.final[0].name} wins by default.` : 'Nobody was left standing.', true); this.match(e); if (e.round === 2) this.say(`${e.name}: the final, ${e.final[0].name} against ${e.final[1].name}.`); }
    else { this.finish(e, `${w.name} wins the tournament!`, true); w.anim = 'cheer'; w.animT = 3; this.gen(w, pick(['GG all, champion!', 'undefeated', 'that was close', 'thanks for coming'])); }
  }
  finish(e, text, good) {
    e.state = 'done'; e.result = text;
    this.results.unshift({ name: e.name, text, good, t: this.T }); this.results.length = Math.min(this.results.length, 8);
    this.say(`${e.name}: ${text}`);
    for (const p of e.people) if (p.event === e) { p.event = null; if (!p.dead && !p.gone && p.state === 'idle') p.wait = rnd(1, 4); }
    const d = EVENTS[e.kind]; this.plan(e.kind, rnd(d.every[0], d.every[1]));
    this.events = this.events.filter(x => x.state !== 'done');
    if (this.ctx.done) this.ctx.done(e, good);
  }

  update(dt, T) {
    this.T = T;
    const P = this.ctx.people;
    for (const e of [...this.events]) {
      if (e.state === 'soon' && T >= e.gatherAt) this.gather(e);
      if (e.state === 'gather') {
        for (const p of e.people) if (!p.gone && !p.dead && p.state === 'idle') p.wait = Math.max(p.wait, 3);     // stay put
        if (T >= e.start) this.begin(e);
      }
      if (e.state !== 'on') continue;
      for (const p of e.people) if (p.dead && !p.counted) { p.counted = true; e.deaths++; }
      if (e.kind === 'tusk') {
        const alive = e.people.filter(p => !p.dead && !p.gone);
        if (e.tusk.state === 'dead') this.finish(e, `Old Tusk is down. ${e.deaths ? e.deaths + (e.deaths > 1 ? ' hunters died.' : ' hunter died.') : 'Nobody died.'}`, true);
        else if (!alive.length) this.finish(e, 'Old Tusk wiped out the hunters.', false);
        else if (T > e.endAt) this.finish(e, `The hunters gave up. ${e.deaths ? e.deaths + ' died trying.' : ''}`, false);
        else for (const p of alive) if (p.state !== 'hunt') { p.mob = e.tusk; p.state = 'hunt'; p.resting = false; }
      } else if (e.kind === 'duel') {
        const m = e.cur;
        if (m && !m[0].duel && !m[1].duel) {
          const w = m.find(p => p.duelResult === 'win') || pick(m.filter(p => !p.gone)); e.cur = null;
          if (w) { if (e.round < 2) this.say(`${e.name}: ${w.name} goes through to the final.`); this.next(e, w); }
        }
        if (e.state === 'on') for (const p of e.people) if (!p.gone && !p.duel && p.state === 'idle') p.wait = Math.max(p.wait, 3);
        if (e.state === 'on' && T > e.endAt) this.finish(e, 'Called off: it ran too long.', false);
      } else if (T > e.endAt && !(e.joined && T < e.endAt + 600)) {     // a run you joined ends when it really ends
        if (e.kind === 'dungeon') {
          const won = Math.random() < 0.3;
          this.finish(e, e.joined ? 'The party finished without you.' : won ? 'Cleared! Cinderjaw is down, and nobody had a healer.' : `Wiped on ${pick(['the first pull', 'the hounds', 'Cinderjaw', 'Cinderjaw at 8%'])}. No healer.`, won);
          const back = P.arrive('dungeon', 2 + Math.floor(rnd(0, 3)), !won); if (back[0]) this.ctx.later(3, () => this.gen(back[0], won ? pick(['easy run', 'Cinderjaw down!']) : pick(['we needed a healer', 'wiped. again.', 'who pulled?'])), 3000);
        } else {
          const won = Math.random() < 0.25;
          this.finish(e, won ? 'The Hollow Regent is down! First kill of the week.' : `Wiped at ${pick([3, 8, 12, 31, 47])}%. "Healers went oom."`, won);
          P.arrive('raid', 3 + Math.floor(rnd(0, 3)), true);
        }
      }
    }
  }
}
