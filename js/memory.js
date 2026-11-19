// They remember: the saved roster of people, what each remembers about the
// healer, fame, guilds and the deeds that people gossip about. Rules only:
// no DOM, no three.js.

export const NAMES = ('Brannoc Mirelle Stabbsworth Healzplz Moonwhisk Critney Pwnsalot Sneakums Frostbiscuit Dotsanddots Grumbar Elowen ' +
  'Kazrik Thistle Oatmeal Nightsoup Arrowynn Shieldon Fizzlewick Bonk Smashley Vexa Dorn Quillon Embera Tobblin Muffinblade ' +
  'Sapsworth Zugmar Lilybrook Hexabelle Rustyn Corvash Pemberly Ironwhisk Glimmerfen Oxbane Snackrifice Aggrotha Manabun ' +
  'Lootgoblin Afkevin Rezplox Kitebert Pullmore Wipesalot Nerfbat Gankrid Tavish Ysolde Marrow Juniper Halvard Sable Orrin ' +
  'Fenna Dask Wren Bigdam Tinycrit Oomagain Stunlock Pocketsand Cheddar Vandrel Isska Bramblewick Tuggle Noobert Questlove ' +
  'Faceroll Mossbeard Petal Grindolf Yarrow Skiptext Hobnail Clickmore Dewdrop Runsalot Farmhand').split(' ');
export const KINDS = ['Knight', 'Ranger', 'Mage', 'Rogue', 'Warlock', 'Druid', 'Brawler'];
export const TEMPERS = ['grateful', 'grateful', 'suspicious', 'entitled', 'competitive', 'shy'];

// Guilds: who leads them and what joining gives you.
export const GUILDS = {
  'Lantern Guard': { perk: 'heal', text: '+5% healing' },
  'Casual Fridays': { perk: 'regen', text: '+10% mana regeneration' },
  'Loot Council': { perk: 'loot', text: 'loot comes a little sooner' },
  'Wipe Club': { perk: 'rez', text: 'Revive costs half the mana' },
  'The Unhealed': { perk: 'fame', text: '+20% fame' },
  'Dps Is A Role': { perk: 'haste', text: '+3% haste' },
};
export const perk = (S, k) => S.guild && GUILDS[S.guild] && GUILDS[S.guild].perk === k;

// Fame: a second progress bar. Each step unlocks something.
export const FAME = [
  { at: 0, name: 'Who?' },
  { at: 12, name: 'Some healer', unlock: 'People start to ask about you in General chat.' },
  { at: 40, name: 'That healer', unlock: 'Guilds may invite you now.' },
  { at: 90, name: 'The mystery healer', unlock: 'Parties in Emberdeep know you on sight.' },
  { at: 180, name: 'The Lantern', unlock: 'Everyone knows your name.' },
];
export const fameTier = S => { let i = 0; while (i + 1 < FAME.length && S.fame >= FAME[i + 1].at) i++; return i; };
export function addFame(S, n) {
  const before = fameTier(S);
  S.fame = Math.round(((S.fame || 0) + n * (perk(S, 'fame') ? 1.2 : 1)) * 10) / 10;
  return fameTier(S) > before ? FAME[fameTier(S)] : null;
}

const rnd = (r, a, b) => a + r() * (b - a);
function rng(seed) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

// The cast: about 64 people, made once and kept in the save.
export function makeRoster(seed = Math.floor(Math.random() * 233280)) {
  const r = rng(seed), names = [...NAMES], out = [], guilds = Object.keys(GUILDS);
  for (let i = 0; i < 64; i++) {
    const name = names.splice(Math.floor(r() * names.length), 1)[0];
    out.push({ name, cls: KINDS[i % KINDS.length], guild: r() < 0.6 ? guilds[Math.floor(r() * guilds.length)] : '',
      off: Math.floor(rnd(r, -1, 3)), temper: TEMPERS[Math.floor(r() * TEMPERS.length)], seed: Math.floor(r() * 1000) });
  }
  return out;
}

// What one person remembers: heals, saves (healed from near death), revives,
// deaths you stood and watched, and emotes you shared.
export function rec(S, name) {
  S.rec = S.rec || {};
  return S.rec[name] || (S.rec[name] = { h: 0, s: 0, r: 0, d: 0, w: 0 });
}
export const known = (S, name) => S.rec && S.rec[name];
export function bond(r) { return r ? r.h * 0.5 + r.s * 3 + r.r * 5 + r.w * 0.5 - r.d * 4 - (r.n || 0) * 2 : 0; }
// stranger, met, knows (waves at you), friend (whispers, calls your name), grudge.
export function mood(r) {
  const b = bond(r);
  if (!r || (b < 1 && !r.d && !r.n)) return 'stranger';
  if (b <= -2) return 'grudge';
  return b >= 12 ? 'friend' : b >= 5 ? 'knows' : 'met';
}

// Deeds the world talks about: kept for ten minutes of game time.
export function deed(S, kind, who, where, t) {
  S.deeds = (S.deeds || []).filter(d => t - d.t < 600 && t >= d.t);
  S.deeds.push({ kind, who, where, t, told: false });
  if (S.deeds.length > 12) S.deeds.shift();
}

// Save versions. 1 was the first save; 2 adds the roster, records and fame.
export const SAVE_V = 2;
export function upgrade(S) {
  if (!S.v || S.v < 2) { S.roster = S.roster || makeRoster(); S.rec = S.rec || {}; S.fame = S.fame || 0; S.chan = S.chan || { general: true, zone: true }; S.deeds = []; }
  S.v = SAVE_V;
  return S;
}

// Lines, by what happened and the person's temperament. {me} is the
// healer's name, {who} the speaker's.
export const LINES = {
  first: { grateful: ['oh! thanks, stranger', 'ty! who are you?', 'a heal? for me? thanks!'], suspicious: ['uh... who are you?', 'why are you healing me', 'I did not ask for that'],
    entitled: ['finally, a healer', 'about time', 'took you long enough'], competitive: ['I had that', 'did not need it, but ok', 'I was fine'], shy: ['oh. thanks', ':)', 'ty'] },
  thanks: { grateful: ['ty {me}!', 'thanks again, {me}', 'you are the best', '<3'], suspicious: ['...thanks', 'fine. thanks', 'ok that one helped'],
    entitled: ['more please', 'keep them coming', 'ty, now the rest of me'], competitive: ['I had it, but ty', 'heal count: {h}. not that I count'], shy: ['ty', ':)', 'thx'] },
  saved: { grateful: ['{me} you saved me!!', 'that was SO close. ty {me}', 'I owe you one, {me}'], suspicious: ['ok. that one I needed', 'why do you keep saving me'],
    entitled: ['cutting it close there', 'next time sooner please'], competitive: ['I would have lived. probably', 'fine, that one counts'], shy: ['...thank you', 'whew. ty'] },
  rez: { grateful: ['{me}! ty for the rez!', 'you came back for me? <3', 'best healer. ever.'], suspicious: ['you rezzed me?? who ARE you', 'why would you do that'],
    entitled: ['could have kept me alive instead', 'about time'], competitive: ['I let it hit me on purpose', 'thanks. do not tell anyone'], shy: ['oh... ty', 'thank you, {me}'] },
  whisperSave: ['that was close. thank you, {me}', 'I would be face down right now. thanks', 'remind me to buy you a drink at the inn', 'not sure why you do this but I am glad'],
  whisperRez: ['thanks for the rez. seriously', 'you saved me the run back. ty {me}', 'I owe you, {me}'],
  hello: { friend: ['hey {me}!', 'oh hi {me}', 'look who it is!', 'my favourite healer'], knows: ['hey, it is that healer', 'hi', 'o/'] },
  call: ['{me}! little help?', '{me}, heals!', 'where is {me} when you need them', '{me}?? I am going down'],
  sulk: ['thanks for nothing, healer', 'you just watched me die', 'some healer you are', 'cool. cool cool cool.'],
  rant: ['{me} stood right there and let me die', 'avoid {me}, they just watch you die', 'a healer watched me die at {where}. no heal. nothing.'],
  forgive: ['ok, we are even now', 'fine. you are forgiven', 'ok, maybe you are not so bad'],
  // General chat gossip about what you did in the last ten minutes. {who} is the person.
  gossip: {
    save: ['did anyone else see {me} pull {who} out of that fight at {where}?', '{who} was a goner at {where} and then, out of nowhere, a heal', 'heard {me} saved {who} again'],
    rez: ['{who} got rezzed at {where} by {me}, nobody even asked', 'someone rezzed {who} at {where}. was that {me}?', 'free rez at {where} apparently'],
    boss: ['Emberdeep got cleared and the party says a stranger healed them', 'Cinderjaw is down. party had no healer. or did they?', 'was {me} in Emberdeep just now?'],
    wipe: ['Emberdeep wiped again. even {me} could not save them', 'another wipe in Emberdeep. where was {me}?'],
    letdie: ['{who} died at {where} with {me} standing right there', 'lol {me} watched {who} die at {where}', 'heals are not free I guess. ask {who}'],
  },
  ask: ['is {me} on?', 'anyone seen {me} today?', 'LF {me}, will pay in thanks', 'how do I get {me} to heal me', 'is {me} real or a rumour?'],
  // Answers to what you say and do.
  greet: { friend: ['hey {me}!', 'hiya {me}!', 'o/ {me}'], knows: ['hi', 'hey healer', 'o/'], met: ['hi?', 'hello', 'hey'], stranger: ['...hi?', 'do I know you?', 'hello stranger'], grudge: ['oh. it is you', 'hmph'] },
  chatter: { friend: ['lol {me}', 'haha', 'true', 'agreed'], knows: ['lol', 'ok', 'sure'], met: ['ok?', 'lol'], stranger: ['who said that?', '?', 'ok'], grudge: ['nobody asked', 'whatever'] },
  yell: ['no need to yell', 'ow, my ears', 'WHAT', 'we can hear you', 'LOUDER'],
  whisper: { friend: ['hey {me}! what is up?', 'always happy to hear from you, {me}', 'ha, hi {me}'], knows: ['oh hi', 'hey, healer', 'what is up?'],
    met: ['hi?', 'do I know you? oh, the healer', 'hello'], stranger: ['who is this?', 'do I know you?', 'wrong person?'], grudge: ['leave me alone', 'not talking to you', 'go watch someone else die'] },
  guild: ['anyone up for Emberdeep?', 'gratz on the ding!', 'who has the bank key', 'raid night is cancelled, again', 'lol', 'brb', 'did anyone see that duel',
    'Old Tusk is up', 'can someone make me more potions', 'hi all', '{me}, you on?', 'our healer is the best healer', 'thanks for the heals earlier {me}'],
  welcome: ['welcome {me}!!', 'finally', 'yay, a healer!', 'welcome to the guild', 'o/'],
};
export function line(kind, temper, vars) {
  let pool = LINES[kind]; if (!Array.isArray(pool)) pool = pool[temper] || pool.grateful || pool.met || Object.values(pool)[0];
  let s = pool[Math.floor(Math.random() * pool.length)];
  for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
