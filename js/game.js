// Rules: the healer's state, spells, experience and loot. No DOM, no three.js,
// so it runs headless in Node.
import { perk, upgrade } from './memory.js';

export const SPELLS = [
  { id: 'mend', name: 'Mend', icon: '✚', key: '1', cast: 2.0, mana: 22, range: 40, color: '#2f7a3a',
    desc: 'A slow, strong heal.' },
  { id: 'renew', name: 'Renew', icon: '❋', key: '2', cast: 0, mana: 15, range: 40, color: '#2a6a7a',
    desc: 'Heals over 9 seconds. Instant.' },
  { id: 'revive', name: 'Revive', icon: '☥', key: '3', cast: 5.0, mana: 45, range: 30, color: '#8a6a1a',
    desc: 'Brings a dead player back to life.' },
  { id: 'flash', name: 'Flash', icon: '✦', key: '4', cast: 1.0, mana: 32, range: 40, color: '#7a6a1a', lvl: 3,
    desc: 'A quick, costly heal for emergencies.' },
  { id: 'ward', name: 'Ward', icon: '◈', key: '5', cast: 0, mana: 28, range: 40, color: '#3a4a8a', lvl: 5,
    desc: 'A shield that soaks up damage for 15 seconds. The same person cannot be warded again for 12 seconds.' },
];
SPELLS.push({ id: 'fade', name: 'Fade', icon: '☁', key: '6', cast: 0, mana: 10, range: 0, self: true, cd: 30, color: '#4a4a6a', lvl: 2,
  desc: 'Slip from every monster\'s mind: they forget you for a moment and go back to whoever they were fighting. 30 second cooldown.' });
SPELLS.push({ id: 'circle', name: 'Circle', icon: '◎', key: '7', cast: 2.0, mana: 48, range: 40, color: '#5a7a2a', talent: 'circle',
  desc: 'Heals your target and everyone within 8 yards of them. Learned from the Mending talents.' });
SPELLS.push({ id: 'cleanse', name: 'Cleanse', icon: '✧', key: '8', cast: 0, mana: 18, range: 40, color: '#2a7a6a', talent: 'cleanse',
  desc: 'Washes away bleeds and burns. Learned from the Grace talents.' });
export const WARD_TIME = 15, WARD_LOCK = 12;
// Threat: healing someone a monster is fighting makes it notice you. It turns
// on you once its threat passes this share of its own health (a tank holds
// it better). Outside the dungeon nobody is tanking.
export const THREAT_SOLO = 0.6, THREAT_TANKED = 1.0, THREAT_PER_HEAL = 0.5, TAUNT_BACK = 4;
export const GCD = 1.2;
export const SLOTS = ['Staff', 'Hood', 'Robe', 'Gloves', 'Boots', 'Ring', 'Trinket'];
export const SLOT_ICON = { Staff: '🪄', Hood: '🎓', Robe: '🥋', Gloves: '🧤', Boots: '🥾', Ring: '💍', Trinket: '🔮', Fish: '🐟', Junk: '👢' };
export const RARITY = ['Common', 'Uncommon', 'Rare', 'Epic'];
export const RARITY_COLOR = ['#dddddd', '#1eff00', '#6aa5ff', '#c77dff'];
const R_WEIGHT = [60, 28, 10, 2], R_MULT = [1, 1.35, 1.8, 2.4];
const PRE = [['Frayed', 'Worn', 'Plain', 'Patched', 'Dusty'], ['Sturdy', 'Mossy', 'Bright', 'Tidy', 'Lucky'],
  ['Gleaming', 'Hallowed', 'Moonlit', 'Singing'], ['Radiant', 'Everbloom', 'Starwoven']];
const BASE = { Staff: ['Staff', 'Crook', 'Rod'], Hood: ['Hood', 'Cowl', 'Circlet'], Robe: ['Robe', 'Vestment', 'Tunic'],
  Gloves: ['Gloves', 'Wraps', 'Mitts'], Boots: ['Boots', 'Sandals', 'Slippers'], Ring: ['Ring', 'Band', 'Loop'],
  Trinket: ['Charm', 'Bell', 'Locket', 'Censer'] };
// Effects carried by Rare and Epic gear. Only one of each counts.
export const EFFECTS = {
  echo: 'Mend also heals the most hurt person near your target for 35% as much.',
  bloom: 'When Renew ends it blooms, healing three ticks at once.',
  clarity: 'Critical heals give back 40% of their mana.',
  aegis: 'Mend on someone below 35% health also wards them a little.',
  swiftrez: 'Revive takes 3 seconds instead of 5.',
  veil: 'Fade comes back after 18 seconds instead of 30.',
  glide: 'You can move while casting Flash.',
  spring: 'Drinking restores mana twice as fast.',
  thrift: 'Flash costs 30% less mana.',
  // boss uniques only
  surge: 'Each heal you land has a 15% chance to make your next Mend instant.',
  ashguard: 'Monsters need 30% more threat before they turn on you.',
  mercy: 'Heals on someone below 25% health are 25% stronger.',
  beacon: 'Renew lasts half as long again.',
  tusk: 'Fade also heals you for 20% of your health.',
  stride: 'You run 15% faster.',
};
const COMMON_FX = ['echo', 'bloom', 'clarity', 'aegis', 'swiftrez', 'veil', 'glide', 'spring', 'thrift'];
// Boss uniques: fixed names and effects, one of each to collect.
export const UNIQUES = {
  emberfang: { name: 'Emberfang Charm', slot: 'Trinket', fx: 'surge', boss: 'Cinderjaw', stats: ['power', 'haste'] },
  ashmantle: { name: 'Ashmantle Vestment', slot: 'Robe', fx: 'ashguard', boss: 'Cinderjaw', stats: ['power', 'spirit'] },
  houndtooth: { name: 'Houndtooth Band', slot: 'Ring', fx: 'mercy', boss: 'Cinderjaw', stats: ['power', 'mana'] },
  kindled: { name: 'Kindled Crook', slot: 'Staff', fx: 'beacon', boss: 'Cinderjaw', stats: ['power', 'spirit'] },
  tuskbone: { name: 'Tuskbone Locket', slot: 'Trinket', fx: 'tusk', boss: 'Old Tusk', stats: ['power', 'mana'] },
  bristle: { name: 'Bristlehide Boots', slot: 'Boots', fx: 'stride', boss: 'Old Tusk', stats: ['power', 'haste'] },
};
export function makeUnique(id, ilvl) {
  const u = UNIQUES[id], it = { slot: u.slot, q: 3, ilvl, power: 0, spirit: 0, mana: 0, haste: 0, unique: id, fx: u.fx, name: u.name };
  let budget = Math.round((3 + ilvl * 2.2) * 2.5 * (u.slot === 'Staff' || u.slot === 'Robe' ? 1.3 : 1));
  it.power = Math.round(budget * 0.6); budget -= it.power;
  const e = u.stats[1]; it[e] = e === 'mana' ? budget * 4 : e === 'haste' ? Math.max(1, Math.round(budget / 3)) : budget;
  it.value = Math.round((2 + ilvl) * 5);
  return it;
}
export const hasFx = (S, id) => SLOTS.some(k => S.equip[k] && S.equip[k].fx === id);
export const avgIlvl = S => Math.round(SLOTS.reduce((a, k) => a + (S.equip[k] ? S.equip[k].ilvl : 0), 0) / SLOTS.length * 10) / 10;
const SUF = ['of the Dawn', 'of Mercy', 'of the Well', 'of Quick Hands', 'of the Kind Word', 'of Second Chances'];

const SAVE = 'mmoHealer1';
const pick = a => a[Math.floor(Math.random() * a.length)];

export function newState(name) {
  return upgrade({ name: name || 'Healer', level: 1, xp: 0, coins: 0, equip: {}, bag: [], healed: 0, mana: 0, lootMeter: 0, lootAt: 1, firstLoot: true });
}
export function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE)); if (s && s.level) return upgrade(s); } catch (e) {}
  return null;
}
export function save(S) { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) {} }

export const xpNeed = l => Math.round(90 + 45 * Math.pow(l, 1.6));

export function stats(S) {
  const g = { power: 0, spirit: 0, mana: 0, haste: 0 };
  for (const k of SLOTS) { const it = S.equip[k]; if (it) for (const s in g) g[s] += it[s] || 0; }
  return {
    power: 10 + 4 * S.level + g.power,
    maxMana: 100 + 15 * S.level + g.mana,
    regen: (4 + 0.3 * S.level + g.spirit * 0.12) * (perk(S, 'regen') ? 1.1 : 1) * (1 + 0.06 * rank(S, 'deep')),   // mana per second
    haste: Math.min(0.5, (g.haste + (perk(S, 'haste') ? 3 : 0)) / 100),            // fraction off cast time and GCD
    spirit: g.spirit, hasteRaw: g.haste + (perk(S, 'haste') ? 3 : 0),
    maxHp: 80 + 20 * S.level,
  };
}

export function castTime(S, sp) { return Math.max(0.5, (sp.id === 'revive' && hasFx(S, 'swiftrez') ? 3 : sp.cast) - (sp.id === 'mend' ? 0.15 * rank(S, 'quick') : 0)) * (1 - stats(S).haste); }
export function gcdTime(S) { return GCD * (1 - stats(S).haste); }

// How much a spell heals. Mend returns one amount; Renew a tick amount.
export function healAmount(S, sp) {
  const p = stats(S).power * (perk(S, 'heal') ? 1.05 : 1);
  if (sp.id === 'mend' || sp.id === 'flash' || sp.id === 'circle') {
    const crit = Math.random() < 0.12 + (sp.id === 'circle' ? 0 : 0.05 * rank(S, 'steady')), k = sp.id === 'flash' ? [22, 1.6] : sp.id === 'circle' ? [16, 1.1] : [30, 2.2];
    return { amount: Math.round((k[0] + p * k[1]) * (0.92 + Math.random() * 0.16) * (crit ? 1.6 : 1)), crit };
  }
  if (sp.id === 'ward') return { absorb: Math.round((25 + p * 2.4) * (1 + 0.1 * rank(S, 'thick'))) };
  return { tick: Math.round((20 + p * 2.0) / 6), ticks: (hasFx(S, 'beacon') ? 9 : 6) + rank(S, 'lasting'), every: 1.5 };
}

export function npcMaxHp(level) { return 60 + 25 * level; }

// Effective healing done to a target. Returns what the player earned.
export function reward(S, eff, target) {
  const out = { xp: 0, levels: 0, item: null, coins: 0 };
  if (eff <= 0) return out;
  const frac = eff / target.maxHp;
  S.healed += eff;
  out.xp = Math.max(1, Math.round(frac * (20 + 5 * target.level)));
  S.xp += out.xp;
  while (S.xp >= xpNeed(S.level)) { S.xp -= xpNeed(S.level); S.level++; out.levels++; }
  S.lootMeter += frac * (perk(S, 'loot') ? 1.15 : 1);
  if (S.lootMeter >= S.lootAt) {
    S.lootMeter = 0; S.lootAt = 1.2 + Math.random() * 1.6;
    if (S.firstLoot) { S.firstLoot = false; S.lootAt = 1; }
    if (Math.random() < 0.75) out.item = rollItem(S.level + (target.level > S.level ? 1 : 0));
    else out.coins = 3 + Math.floor(Math.random() * 6 * S.level);
  }
  return out;
}

export function rollItem(ilvl, slot, minQ = 0) {
  let r = Math.random() * 100, q = 0;
  while (q < 3 && r >= R_WEIGHT[q]) { r -= R_WEIGHT[q]; q++; }
  q = Math.max(q, minQ);
  slot = slot || pick(SLOTS);
  let budget = Math.round((3 + ilvl * 2.2) * R_MULT[q] * (slot === 'Staff' || slot === 'Robe' ? 1.3 : 1));
  const it = { slot, q, ilvl, power: 0, spirit: 0, mana: 0, haste: 0 };
  it.power = Math.max(1, Math.round(budget * (0.45 + Math.random() * 0.25)));
  budget -= it.power;
  const extras = ['spirit', 'mana', 'haste'].sort(() => Math.random() - 0.5).slice(0, q >= 2 ? 2 : 1);
  extras.forEach((e, i) => {
    const part = i === extras.length - 1 ? budget : Math.round(budget / 2);
    budget -= part;
    it[e] = e === 'mana' ? part * 4 : e === 'haste' ? Math.max(1, Math.round(part / 3)) : part;
  });
  if (q >= 2) it.fx = pick(COMMON_FX);
  it.name = pick(PRE[q]) + ' ' + pick(BASE[slot]) + (q >= 1 ? ' ' + pick(SUF) : '');
  it.value = Math.round((2 + ilvl) * R_MULT[q] * 2);
  return it;
}

export const bagSize = S => S.bagSize || 14;
export function addItem(S, it) {
  if (S.bag.length >= bagSize(S)) { S.coins += it.value; return false; }
  S.bag.push(it); return true;
}
export function equipItem(S, i) {
  const it = S.bag[i]; if (!it || it.kind) return;
  const old = S.equip[it.slot];
  S.equip[it.slot] = it;
  if (old) S.bag[i] = old; else S.bag.splice(i, 1);
}
export function sellItem(S, i) { const it = S.bag[i]; if (!it) return 0; S.bag.splice(i, 1); S.coins += it.value; return it.value; }
export function itemScore(it) { return it && !it.kind ? it.power * 2 + it.spirit + it.mana / 4 + it.haste * 3 + (it.fx ? 8 : 0) : 0; }

// The quartermaster: four pieces of gear (restocked when you level), a
// restock for a fee, and bigger bags.
export const price = it => it.value * 5;
export const restockCost = S => 10 + 5 * S.level;
export const bagCost = S => bagSize(S) >= 28 ? 0 : bagSize(S) >= 21 ? 400 : 120;
export function stock(S, force) {
  if (force || !S.shop || S.shop.level !== S.level) {
    S.shop = { level: S.level, items: [0, 1, 2, 3].map(i => rollItem(S.level + 1, null, i === 3 ? 2 : 1)) };
  }
  return S.shop.items;
}
export function buy(S, i) {
  const it = stock(S)[i];
  if (!it) return 'Sold out';
  if (S.coins < price(it)) return 'Not enough copper';
  if (S.bag.length >= bagSize(S)) return 'Your bag is full';
  S.coins -= price(it); S.bag.push(it); S.shop.items[i] = null;
  return '';
}
export function restock(S) { const c = restockCost(S); if (S.coins < c) return 'Not enough copper'; S.coins -= c; stock(S, true); return ''; }
export function buyBag(S) {
  const c = bagCost(S); if (!c) return 'No bigger bags';
  if (S.coins < c) return 'Not enough copper';
  S.coins -= c; S.bagSize = bagSize(S) + 7; return '';
}

// The average a spell will heal, for the "incoming heal" segment on bars.
export function healEstimate(S, sp) {
  const p = stats(S).power;
  return sp.id === 'mend' ? 30 + p * 2.2 : sp.id === 'flash' ? 22 + p * 1.6 : 0;
}
export const knows = (S, sp) => (!sp.lvl || S.level >= sp.lvl) && (!sp.talent || rank(S, sp.talent) > 0);
export const manaCost = (S, sp) => sp.id === 'revive' && perk(S, 'rez') ? Math.round(sp.mana / 2) : sp.id === 'flash' && hasFx(S, 'thrift') ? Math.round(sp.mana * 0.7) : sp.mana;

// Fishing. A side activity: fish restore mana when you sit and eat them (or
// sell to Pim), now and then the line brings up junk or a piece of gear, and
// once in a long while Old Glimmerfin, a named fish people talk about.
export const FISH = [
  { name: 'Reed Perch', q: 0, restore: 0.3, value: 2, w: 40 },
  { name: 'Mudfin', q: 0, restore: 0.3, value: 2, w: 30 },
  { name: 'Speckled Dace', q: 1, restore: 0.5, value: 6, w: 14 },
  { name: 'Lanternfin', q: 2, restore: 0.75, value: 14, w: 5 },
];
export const GLIMMERFIN = { name: 'Old Glimmerfin', q: 3, restore: 1, value: 90, named: true };
const JUNK = ['Waterlogged Boot', 'Rusty Hook', 'Tangle of Pondweed', 'Somebody\'s Lost Spoon'];
export const EAT_TIME = 6;
// What comes up on the hook: { kind: 'fish' | 'named' | 'junk' | 'gear', item }.
export function fishCatch(S, r = Math.random()) {
  if (r < 0.02) return { kind: 'named', item: { ...GLIMMERFIN, kind: 'fish', slot: 'Fish', ilvl: S.level } };
  if (r < 0.08) { const it = rollItem(S.level, null, 1); return { kind: 'gear', item: it }; }
  if (r < 0.18) return { kind: 'junk', item: { kind: 'junk', slot: 'Junk', name: pick(JUNK), q: 0, ilvl: 1, value: 1 } };
  let w = Math.random() * FISH.reduce((a, f) => a + f.w, 0), f = FISH[0];
  for (const x of FISH) { if ((w -= x.w) < 0) { f = x; break; } }
  return { kind: 'fish', item: { kind: 'fish', slot: 'Fish', name: f.name, q: f.q, restore: f.restore, ilvl: S.level, value: f.value + Math.floor(S.level / 3) } };
}

// Talents: a point a level from level 3, spent in three sections. Each tier
// opens once you have spent 3 points per tier in that section (tier 2, the
// capstone, needs 6). Respec is free for now.
export const TREES = [
  { id: 'mending', name: 'Mending', note: 'Direct heals', talents: [
    { id: 'quick', name: 'Quick Hands', icon: '⏱', tier: 0, max: 3, desc: r => `Mend casts ${(0.15 * r).toFixed(2)} seconds faster.` },
    { id: 'steady', name: 'Steady Light', icon: '☀', tier: 0, max: 2, desc: r => `+${5 * r}% chance to crit with Mend and Flash.` },
    { id: 'overflow', name: 'Overflow', icon: '≋', tier: 1, max: 1, desc: () => 'Overhealing from Mend becomes a small heal over time on the same target.' },
    { id: 'circle', name: 'Circle', icon: '◎', tier: 2, max: 1, desc: () => 'Learn Circle (key 7): heals your target and everyone within 8 yards of them.' },
  ] },
  { id: 'grace', name: 'Grace', note: 'Heals over time, shields, mana', talents: [
    { id: 'lasting', name: 'Lasting Renew', icon: '❋', tier: 0, max: 2, desc: r => `Renew heals ${r} more time${r > 1 ? 's' : ''}.` },
    { id: 'thick', name: 'Thick Ward', icon: '◈', tier: 0, max: 3, desc: r => `Ward absorbs ${10 * r}% more.` },
    { id: 'deep', name: 'Deep Well', icon: '💧', tier: 0, max: 3, desc: r => `+${6 * r}% mana regeneration.` },
    { id: 'quicken', name: 'Quickening', icon: '✶', tier: 1, max: 1, desc: () => 'Renew on someone below 30% health heals its first tick at once.' },
    { id: 'cleanse', name: 'Cleanse', icon: '✧', tier: 2, max: 1, desc: () => 'Learn Cleanse (key 8): washes away bleeds and burns.' },
  ] },
  { id: 'shadow', name: 'Shadow', note: 'Staying alive', talents: [
    { id: 'quiet', name: 'Quiet Hands', icon: '🤫', tier: 0, max: 3, desc: r => `Your healing causes ${10 * r}% less threat.` },
    { id: 'swift', name: 'Swift Spirit', icon: '👻', tier: 0, max: 1, desc: () => 'Run 30% faster as a ghost.' },
    { id: 'water', name: 'Waterborne', icon: '🌊', tier: 0, max: 1, desc: () => 'Wade and swim at full speed.' },
    { id: 'calm', name: 'Calm Mind', icon: '☯', tier: 1, max: 1, desc: () => 'When you have not cast for 4 seconds, mana regenerates 50% faster.' },
    { id: 'breath', name: 'Last Breath', icon: '💨', tier: 1, max: 1, desc: () => 'Once every 2 minutes, a killing blow leaves you at 1 health and Fades you.' },
    { id: 'wind', name: 'Second Wind', icon: '🌬', tier: 2, max: 1, desc: () => 'Once every 10 minutes, rise where you fell instead of running back as a ghost.' },
  ] },
];
export const TIER_COST = 3;
const tal = id => { for (const t of TREES) for (const x of t.talents) if (x.id === id) return [t, x]; return [null, null]; };
export const rank = (S, id) => (S.talents && S.talents[id]) || 0;
export const pointsTotal = S => Math.max(0, S.level - 2);
export const pointsSpent = (S, tree) => (tree ? tree.talents : TREES.flatMap(t => t.talents)).reduce((a, x) => a + rank(S, x.id), 0);
export const pointsFree = S => pointsTotal(S) - pointsSpent(S);
// Why a talent cannot take another point, or '' if it can.
export function cantLearn(S, id) {
  const [t, x] = tal(id); if (!x) return 'No such talent';
  if (rank(S, id) >= x.max) return 'Already at full rank';
  if (pointsFree(S) <= 0) return S.level < 3 ? 'Talent points start at level 3' : 'No talent points left';
  if (pointsSpent(S, t) < x.tier * TIER_COST) return `Needs ${x.tier * TIER_COST} points in ${t.name}`;
  return '';
}
export function learn(S, id) { const why = cantLearn(S, id); if (why) return why; S.talents = S.talents || {}; S.talents[id] = rank(S, id) + 1; return ''; }
export function resetTalents(S) { S.talents = {}; }

// Zones have fixed level bands (the city has everyone, so it still follows
// the healer). Elites and bosses sit a level or two above the band.
export const BANDS = { green: [1, 6], dungeon: [5, 10] };
export function bandLevel(zone, S, extra = 0) {
  const b = BANDS[zone];
  if (!b) return Math.max(1, S.level + Math.floor(Math.random() * 3) - 1 + extra);
  return b[0] + Math.floor(Math.random() * (b[1] - b[0] + 1)) + extra;
}
