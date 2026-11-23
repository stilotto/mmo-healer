// They remember (sprint 7): how people react to the healer as their record
// grows, fame, gossip, whispers, guild invites and guild chat, and the
// answers to what the healer says and does in chat.
import * as M from './memory.js';
import { CAMPS, POI } from './world.js';

const pick = a => a[Math.floor(Math.random() * a.length)], rnd = (a, b) => a + Math.random() * (b - a);
const PLACE = { 0: 'the pond', 1: 'the farm', 2: 'the wood', 3: 'the bog', 4: 'the road', 5: 'the watchtower' };
const MOOD_LABEL = { friend: '♥ Friend', knows: 'Knows you', met: 'Met you', grudge: '✗ Holds a grudge', stranger: '' };

export class Social {
  constructor(ctx) { Object.assign(this, { ctx, S: ctx.S, q: [], t: 0, scanT: 0, guildT: rnd(30, 60), inviteT: 60, invite: null, lastWhisper: null }); }

  later(sec, fn) { this.q.push({ at: this.t + sec, fn }); }
  get me() { return this.S.name; }
  // How others refer to you in gossip: by name once you are known.
  meRef() { return M.fameTier(this.S) >= 1 ? this.S.name : pick(['some healer', 'a random healer', 'a healer nobody invited']); }
  rec(p) { return p.who ? M.rec(this.S, p.who.name) : null; }
  mood(p) {
    if (!p.who) return 'stranger';
    let m = M.mood(M.known(this.S, p.who.name));
    if (this.S.guild && p.guild === this.S.guild && (m === 'stranger' || m === 'met')) m = 'knows';    // guildmates know you
    return m;
  }
  label(p) { return MOOD_LABEL[this.mood(p)] || ''; }
  where(p) {
    if (p.zone === 'dungeon') return 'Emberdeep';
    if (p.zone === 'raid') return 'the Shattered Spire';
    if (p.zone === 'hub') return p.duel ? 'the duelling ring' : 'Lanternrest';
    if (Math.hypot(p.x - POI.camp.x, p.z - POI.camp.z) < 20) return 'the camp';
    let best = 0, bd = 1e9; CAMPS.forEach((c, i) => { const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < bd) { bd = d; best = i; } });
    return PLACE[best] || 'Greenhollow';
  }
  vars(p, extra) { const r = this.rec(p); return { me: this.me, who: p.name, h: r ? r.h : 0, where: this.where(p), ...extra }; }
  say(p, text) { this.ctx.people.say(p, text); }
  whisperFrom(name, text) { this.lastWhisper = name; this.ctx.chat('c-whisp', `[${name}] whispers: ${text}`); this.ctx.sfx('tick'); }
  fame(n) {
    const up = M.addFame(this.S, n);
    if (up) { this.ctx.toast('Fame: ' + up.name, '#ffd24a'); this.ctx.sfx('level'); this.ctx.chat('c-sys', `People now call you "${up.name}". ${up.unlock || ''}`); this.ctx.changed(); }
  }
  dist(p) { const e = this.ctx.eye(); return Math.hypot(p.x - e.x, p.z - e.z); }
  near(p, r) { return this.dist(p) < r && !this.ctx.me.dead; }

  // The healer healed p. eff is the health restored (0 for Renew); low means
  // they were close to death and in a fight. Returns true if p answered.
  healed(p, eff, low) {
    const r = this.rec(p); if (!r) return false;
    const before = this.mood(p), first = !r.h && !r.s && !r.r;
    r.h++; r.seen = 1;
    if (first) this.fame(1);
    if (low) {
      r.s++; this.fame(2); M.deed(this.S, 'save', p.name, this.where(p), this.t);
      if (Math.random() < 0.7) this.say(p, M.line('saved', p.who.temper, this.vars(p)));
      if (Math.random() < (p.who.temper === 'grateful' || p.who.temper === 'shy' ? 0.55 : 0.25)) this.later(rnd(3, 6), () => this.whisperFrom(p.name, M.line('whisperSave', '', this.vars(p))));
      p.thankAt = this.t + 15; return true;
    }
    if (before === 'grudge' && this.mood(p) !== 'grudge') { this.say(p, M.line('forgive', '', this.vars(p))); p.thankAt = this.t + 15; return true; }
    if (!first && (this.t < p.thankAt || (eff && p.hp < p.maxHp && eff < p.maxHp * 0.3))) return true;
    p.thankAt = this.t + 15;
    if (p.state !== 'hunt' && eff) { p.anim = 'cheer'; p.animT = 1.3; }
    if (Math.random() < 0.75) this.say(p, M.line(first ? 'first' : 'thanks', p.who.temper, this.vars(p)));
    this.jealous(p);
    return true;
  }
  // Entitled people who know you want the heals for themselves.
  jealous(p) {
    if (Math.random() > 0.2) return;
    const o = this.ctx.people.list.find(q => q !== p && q.who && q.who.temper === 'entitled' && !q.dead && q.hp < q.maxHp * 0.7 && this.mood(q) !== 'stranger' && Math.hypot(q.x - p.x, q.z - p.z) < 20);
    if (o) this.later(1.5, () => this.say(o, pick([`${this.me}, heal ME, not ${p.name}`, `hey, over here, ${this.me}`, `why does ${p.name} get the heals`])));
  }
  revived(p) {
    const r = this.rec(p); if (!r) return false;
    r.r++; r.seen = 1; this.fame(4); M.deed(this.S, 'rez', p.name, this.where(p), this.t);
    this.say(p, M.line('rez', p.who.temper, this.vars(p)));
    if (Math.random() < 0.5) this.later(rnd(4, 8), () => this.whisperFrom(p.name, M.line('whisperRez', '', this.vars(p))));
    return true;
  }
  // p died. If the healer stood close by and did nothing, it is remembered.
  died(p) {
    const me = this.ctx.me;
    if (!p.who || me.dead || this.ctx.zone() !== p.zone || this.dist(p) > 40) return;
    const r = this.rec(p); r.d++; r.seen = 1; M.deed(this.S, 'letdie', p.name, this.where(p), this.t);
    const m = this.mood(p), sour = m === 'grudge' || p.who.temper === 'entitled' || p.who.temper === 'suspicious';
    if (sour && Math.random() < 0.7) this.later(rnd(1.5, 3), () => { if (!p.gone) this.say(p, M.line('sulk', '', this.vars(p))); });
    if (m === 'grudge' && Math.random() < 0.5) this.later(rnd(20, 40), () => this.ctx.chat('c-gen', `[General] ${p.name}: ${M.line('rant', '', this.vars(p))}`));
  }
  // A hurt person who knows you calls for you by name.
  cry(p) { const m = this.mood(p); return (m === 'friend' || m === 'knows') && Math.random() < 0.7 ? M.line('call', '', this.vars(p)) : null; }

  // General chat: gossip about something you did, or people asking for you.
  general(speaker) {
    const S = this.S, fresh = (S.deeds || []).filter(d => !d.told && this.t - d.t < 600 && this.t >= d.t);
    if (fresh.length && Math.random() < 0.45) {
      const d = fresh[fresh.length - 1]; d.told = true;
      if (d.who === speaker.name) return null;
      return M.line('gossip', d.kind, { me: this.meRef(), who: d.who, where: d.where });
    }
    if (M.fameTier(S) >= 1 && Math.random() < 0.12) return M.line('ask', '', { me: this.me });
    return null;
  }
  // Emberdeep: a party that knows you says so, and counts you in at once.
  party(d) {
    const friend = d.party.find(p => ['friend', 'knows'].includes(this.mood(p)));
    if (M.fameTier(this.S) < 3 && !friend) return;
    d.seen = true;
    const p = friend || pick(d.party);
    this.later(rnd(2, 4), () => d.active && this.ctx.chat('c-party', `[Party] ${p.name}: ${pick([`oh nice, ${this.me} is here`, `it is ${this.me}! we might live`, `${this.me}, you healing us again?`, `do NOT kick ${this.me}`])}`));
  }
  // The healer lands Old Glimmerfin: fame, gossip, and envy from the bank.
  fished(where) {
    this.fame(3); M.deed(this.S, 'fish', '', where, this.t);
    for (const p of this.ctx.people.list.filter(p => p.fishing && !p.dead).slice(0, 2))
      this.later(rnd(1.5, 3.5), () => !p.gone && this.say(p, pick(['WHAT. that is Old Glimmerfin', 'ten years I have sat at this pond', 'no way. NO WAY.', 'can I at least touch it?'])));
  }
  raid(name) { this.fame(8); M.deed(this.S, 'raid', name, 'the Shattered Spire', this.t); }
  boss(seen) { if (seen) { this.fame(6); M.deed(this.S, 'boss', '', 'Emberdeep', this.t); } }
  wipe() { M.deed(this.S, 'wipe', '', 'Emberdeep', this.t); }

  update(dt, t) {
    this.t = t;
    for (let i = this.q.length - 1; i >= 0; i--) if (this.q[i].at <= t) { const f = this.q[i].fn; this.q.splice(i, 1); f(); }
    const S = this.S, folk = this.ctx.people, me = this.ctx.me;
    // People who know you wave as you pass.
    if ((this.scanT -= dt) <= 0 && !me.dead) {
      this.scanT = 0.5;
      for (const p of folk.list) {
        if (p.dead || p.fading || p.grow < 1 || p.duel || p.state === 'hunt' || (p.waveAt || 0) > t || this.dist(p) > 9) continue;
        const m = this.mood(p); if (m !== 'friend' && m !== 'knows') continue;
        p.waveAt = t + 150; p.anim = 'wave'; p.animT = 2.2; p.pause = 2.2; p.yaw = Math.atan2(me.x - p.x, me.z - p.z);
        if (p.who.temper === 'shy' || Math.random() < 0.5) this.ctx.chat('c-emote', `${p.name} waves at you.`);
        else this.say(p, M.line('hello', m, this.vars(p)));
        break;
      }
    }
    // Guild chat, and invites once you are known.
    if (S.guild && (this.guildT -= dt) <= 0) {
      this.guildT = rnd(35, 80);
      const g = S.roster.filter(r => r.guild === S.guild);
      if (g.length) this.ctx.chat('c-guild', `[Guild] ${pick(g).name}: ${M.line('guild', '', { me: this.me })}`);
    }
    if (!S.guild && !this.invite && M.fameTier(S) >= 2 && (this.inviteT -= dt) <= 0) {
      this.inviteT = rnd(120, 200);
      const score = {};
      for (const r of S.roster) if (r.guild && !(S.declined || []).includes(r.guild)) score[r.guild] = (score[r.guild] || 0) + Math.max(0, M.bond(M.known(S, r.name)));
      const best = Object.keys(score).sort((a, b) => score[b] - score[a])[0];
      if (best && score[best] >= 5) {
        const from = S.roster.filter(r => r.guild === best).sort((a, b) => M.bond(M.known(S, b.name)) - M.bond(M.known(S, a.name)))[0];
        this.invite = best; this.lastWhisper = from.name;
        this.ctx.chatHtml('c-whisp', `[${from.name}] whispers: hey ${this.me}, want to join &lt;${best}&gt;? We could use you. <span style="color:#ccc">(Perk: ${M.GUILDS[best].text})</span>` +
          `<button data-act="accept">Join</button><button data-act="decline">No thanks</button>`);
        this.ctx.sfx('loot');
      }
    }
  }

  act(a) {
    const S = this.S;
    if (a === 'accept' || a === 'decline') {
      if (!this.invite) return this.ctx.chat('c-sys', 'You have no guild invite.');
      const g = this.invite; this.invite = null;
      if (a === 'decline') { S.declined = [...(S.declined || []), g]; this.ctx.chat('c-sys', `You decline the invite to <${g}>.`); return this.ctx.changed(); }
      S.guild = g; this.ctx.chat('c-guild', `You have joined <${g}>. Perk: ${M.GUILDS[g].text}. Talk to them with /g.`); this.ctx.sfx('level'); this.ctx.changed();
      const mem = S.roster.filter(r => r.guild === g);
      for (let i = 0; i < 3 && mem.length; i++) { const r = mem.splice(Math.floor(Math.random() * mem.length), 1)[0]; this.later(1 + i * 1.4 + Math.random(), () => this.ctx.chat('c-guild', `[Guild] ${r.name}: ${M.line('welcome', '', { me: this.me })}`)); }
    }
  }
  gquit() {
    const S = this.S; if (!S.guild) return this.ctx.chat('c-sys', 'You are not in a guild.');
    this.ctx.chat('c-sys', `You leave <${S.guild}>.`); S.declined = [...(S.declined || []), S.guild]; S.guild = ''; this.ctx.changed();
  }

  // --- Chat commands from the healer ---
  find(name, online) {
    const n = name.toLowerCase(), list = online ? this.ctx.people.list.filter(p => !p.fading) : this.S.roster;
    return list.find(p => p.name.toLowerCase() === n) || list.find(p => p.name.toLowerCase().startsWith(n));
  }
  listeners(r) { return this.ctx.people.list.filter(p => !p.dead && !p.fading && p.grow >= 1 && this.dist(p) < r); }
  // Plain talk. People nearby may answer, more warmly if they know you.
  talk(text, yell) {
    const cls = yell ? 'c-yell' : 'c-say';
    this.ctx.chat(cls, yell ? `${this.me} yells: ${text.toUpperCase()}` : `${this.me} says: ${text}`);
    const near = this.listeners(yell ? 70 : 25); if (!near.length) return;
    const low = text.toLowerCase(), named = near.find(p => new RegExp('\\b' + p.name.toLowerCase() + '\\b').test(low));
    const answer = p => this.later(rnd(1, 2.4), () => { if (!p.gone && !p.dead) this.say(p, M.line(kind, this.mood(p), this.vars(p))); });
    const greet = /\b(hi|hello|hey|yo|hiya|greetings|o\/)\b/.test(low), kind = greet ? 'greet' : 'chatter';
    if (named) return answer(named);
    if (yell && Math.random() < 0.5) { const p = pick(near); return this.later(rnd(1, 2), () => !p.gone && this.say(p, pick(M.LINES.yell))); }
    const n = greet ? 1 + (Math.random() < 0.4 ? 1 : 0) : Math.random() < 0.3 ? 1 : 0;
    for (const p of near.sort(() => Math.random() - 0.5).slice(0, n)) answer(p);
  }
  // An emote at your target (or nobody). Returns the person it was aimed at.
  emote(kind, arg, target) {
    let p = arg ? this.find(arg, true) : target && !target.isMe ? target : null;
    if (arg && !p) { this.ctx.chat('c-emote', `You ${kind} at ${arg}, who is not here.`); return null; }
    const T = { wave: 'wave', cheer: 'cheer', bow: 'bow before', dance: 'dance with', sit: 'sit down', laugh: 'laugh at', thank: 'thank' };
    const alone = { wave: 'You wave.', cheer: 'You cheer!', bow: 'You bow.', dance: 'You burst into dance.', sit: 'You sit down.', laugh: 'You laugh.', thank: 'You thank everyone around you.' };
    if (!p || kind === 'sit') { this.ctx.chat('c-emote', alone[kind]); if (kind === 'dance' || kind === 'cheer') this.joinIn(kind); return null; }
    this.ctx.chat('c-emote', `You ${T[kind]}${kind === 'wave' || kind === 'cheer' ? ' at' : ''} ${p.name}.`);
    if (this.dist(p) > 30 || p.dead) return p;
    const r = this.rec(p);
    if (r && kind !== 'laugh' && (r.wT || 0) < this.t) { r.wT = this.t + 60; if (r.w < 6) r.w++; }     // a little goodwill, not a farm
    const m = this.mood(p);
    this.later(rnd(0.8, 1.6), () => {
      if (p.gone || p.dead) return;
      const back = { wave: ['wave', 'waves back at you.'], cheer: ['cheer', 'cheers with you!'], bow: ['bow', 'bows back.'], dance: ['dance', 'dances with you!'], laugh: [null, 'looks hurt.'], thank: ['bow', 'bows. "anytime"'] }[kind];
      if (m === 'grudge') return this.ctx.chat('c-emote', `${p.name} ignores you.`);
      if (kind === 'laugh' && m !== 'stranger') return this.ctx.chat('c-emote', `${p.name} laughs with you.`);
      if (m === 'stranger' && Math.random() < 0.5) return this.ctx.chat('c-emote', `${p.name} ${pick(['looks at you strangely.', 'backs away slowly.', 'shrugs.'])}`);
      if (back[0] && p.state !== 'hunt' && !p.duel) { p.anim = back[0]; p.animT = back[0] === 'dance' ? 5 : 2.2; p.pause = p.animT; p.yaw = Math.atan2(this.ctx.me.x - p.x, this.ctx.me.z - p.z); }
      this.ctx.chat('c-emote', `${p.name} ${back[1]}`);
    });
    return p;
  }
  joinIn(kind) {
    const near = this.listeners(15).filter(p => p.state !== 'hunt' && !p.duel && Math.random() < 0.35 + (this.mood(p) === 'friend' ? 0.4 : 0));
    for (const p of near.slice(0, 3)) this.later(rnd(0.6, 2), () => { if (p.gone || p.dead) return; p.anim = kind; p.animT = kind === 'dance' ? 5 : 2; p.pause = p.animT; this.ctx.chat('c-emote', `${p.name} ${kind === 'dance' ? 'dances with you!' : 'cheers with you!'}`); });
  }
  whisper(name, text) {
    const r = this.find(name, false);
    if (!r) return this.ctx.chat('c-sys', `No player named "${name}" is currently playing.`);
    const p = this.find(r.name, true);
    if (!p) return this.ctx.chat('c-sys', `${r.name} is not online right now.`);
    this.ctx.chat('c-whisp', `To [${p.name}]: ${text}`); this.lastWhisper = p.name;
    const m = this.mood(p), busy = p.state === 'hunt' || p.duel;
    this.later(rnd(2, 4.5), () => { if (!p.gone) this.whisperFrom(p.name, busy && Math.random() < 0.5 ? pick(['busy, one sec', 'in combat!!', 'brb fighting']) : M.line('whisper', m, this.vars(p))); });
  }
  reply(text) { if (!this.lastWhisper) return this.ctx.chat('c-sys', 'Nobody has whispered you yet.'); this.whisper(this.lastWhisper, text); }
  guildSay(text) {
    const S = this.S; if (!S.guild) return this.ctx.chat('c-sys', 'You are not in a guild.');
    this.ctx.chat('c-guild', `[Guild] ${this.me}: ${text}`);
    if (Math.random() < 0.5) { const r = pick(S.roster.filter(r => r.guild === S.guild)); this.later(rnd(2, 5), () => this.ctx.chat('c-guild', `[Guild] ${r.name}: ${pick(['lol', 'true', 'haha', 'o/', `hi ${this.me}`, 'same'])}`)); }
  }
  who(arg) {
    const S = this.S, chat = t => this.ctx.chat('c-sys', t);
    if (!arg) {
      const z = this.ctx.zone(), here = this.ctx.people.list.filter(p => !p.fading && p.zone === z);
      chat(`${here.length} players in ${{ hub: 'Lanternrest', green: 'Greenhollow', dungeon: 'Emberdeep' }[z]}: ` +
        here.slice(0, 14).map(p => `${p.name} (${p.level} ${p.cls})`).join(', ') + (here.length > 14 ? ', ...' : '') + '. /who <name> for one person.');
      return;
    }
    const r = this.find(arg, false);
    if (!r) return chat(`Nobody called "${arg}" plays here.`);
    const p = this.find(r.name, true), k = M.known(S, r.name), m = M.mood(k);
    const zone = p ? { hub: 'in Lanternrest', green: 'in Greenhollow', dungeon: 'in Emberdeep' }[p.zone] : 'not online';
    chat(`${r.name}: ${p ? 'level ' + p.level + ' ' : ''}${r.cls}${r.guild ? ' <' + r.guild + '>' : ''}, ${zone}.` +
      (k ? ` Seems ${r.temper}. Remembers you: healed ${k.h} times, saved ${k.s}, revived ${k.r}, watched die ${k.d}.${MOOD_LABEL[m] ? ' ' + MOOD_LABEL[m] + '.' : ''}` : ' Has never met you.'));
  }
  fameInfo() {
    const S = this.S, i = M.fameTier(S), nx = M.FAME[i + 1];
    const friends = Object.values(S.rec || {}).filter(r => M.mood(r) === 'friend').length, grudges = Object.values(S.rec || {}).filter(r => M.mood(r) === 'grudge').length;
    this.ctx.chat('c-sys', `Fame ${Math.floor(S.fame)}: "${M.FAME[i].name}".${nx ? ` Next: "${nx.name}" at ${nx.at}.` : ''} Friends: ${friends}. Grudges: ${grudges}.${S.guild ? ` Guild: <${S.guild}>.` : ''}`);
  }
}
