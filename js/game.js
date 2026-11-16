// Rules: the healer's state, spells, experience and loot. No DOM, no three.js,
// so it runs headless in Node.

export const SPELLS = [
  { id: 'mend', name: 'Mend', icon: '✚', key: '1', cast: 2.0, mana: 22, range: 40, color: '#2f7a3a',
    desc: 'A slow, strong heal.' },
  { id: 'renew', name: 'Renew', icon: '❋', key: '2', cast: 0, mana: 15, range: 40, color: '#2a6a7a',
    desc: 'Heals over 9 seconds. Instant.' },
];
export const GCD = 1.2;
export const SLOTS = ['Staff', 'Hood', 'Robe', 'Gloves', 'Boots', 'Ring', 'Trinket'];
export const SLOT_ICON = { Staff: '🪄', Hood: '🎓', Robe: '🥋', Gloves: '🧤', Boots: '🥾', Ring: '💍', Trinket: '🔮' };
export const RARITY = ['Common', 'Uncommon', 'Rare', 'Epic'];
export const RARITY_COLOR = ['#dddddd', '#1eff00', '#6aa5ff', '#c77dff'];
const R_WEIGHT = [60, 28, 10, 2], R_MULT = [1, 1.35, 1.8, 2.4];
const PRE = [['Frayed', 'Worn', 'Plain', 'Patched', 'Dusty'], ['Sturdy', 'Mossy', 'Bright', 'Tidy', 'Lucky'],
  ['Gleaming', 'Hallowed', 'Moonlit', 'Singing'], ['Radiant', 'Everbloom', 'Starwoven']];
const BASE = { Staff: ['Staff', 'Crook', 'Rod'], Hood: ['Hood', 'Cowl', 'Circlet'], Robe: ['Robe', 'Vestment', 'Tunic'],
  Gloves: ['Gloves', 'Wraps', 'Mitts'], Boots: ['Boots', 'Sandals', 'Slippers'], Ring: ['Ring', 'Band', 'Loop'],
  Trinket: ['Charm', 'Bell', 'Locket', 'Censer'] };
const SUF = ['of the Dawn', 'of Mercy', 'of the Well', 'of Quick Hands', 'of the Kind Word', 'of Second Chances'];

const SAVE = 'mmoHealer1';
const pick = a => a[Math.floor(Math.random() * a.length)];

export function newState(name) {
  return { name: name || 'Healer', level: 1, xp: 0, coins: 0, equip: {}, bag: [], healed: 0, mana: 0, lootMeter: 0, lootAt: 1, firstLoot: true };
}
export function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE)); if (s && s.level) return s; } catch (e) {}
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
    regen: 4 + 0.3 * S.level + g.spirit * 0.12,   // mana per second
    haste: Math.min(0.5, g.haste / 100),            // fraction off cast time and GCD
    spirit: g.spirit, hasteRaw: g.haste,
    maxHp: 80 + 20 * S.level,
  };
}

export function castTime(S, sp) { return sp.cast * (1 - stats(S).haste); }
export function gcdTime(S) { return GCD * (1 - stats(S).haste); }

// How much a spell heals. Mend returns one amount; Renew a tick amount.
export function healAmount(S, sp) {
  const p = stats(S).power;
  if (sp.id === 'mend') {
    const crit = Math.random() < 0.12;
    return { amount: Math.round((30 + p * 2.2) * (0.92 + Math.random() * 0.16) * (crit ? 1.6 : 1)), crit };
  }
  return { tick: Math.round((20 + p * 2.0) / 6), ticks: 6, every: 1.5 };
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
  S.lootMeter += frac;
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
  const it = S.bag[i]; if (!it) return;
  const old = S.equip[it.slot];
  S.equip[it.slot] = it;
  if (old) S.bag[i] = old; else S.bag.splice(i, 1);
}
export function sellItem(S, i) { const it = S.bag[i]; if (!it) return 0; S.bag.splice(i, 1); S.coins += it.value; return it.value; }
export function itemScore(it) { return it ? it.power * 2 + it.spirit + it.mana / 4 + it.haste * 3 : 0; }

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
