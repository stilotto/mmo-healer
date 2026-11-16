// The heads-up display: unit frames, action bar, cast bar, chat, minimap,
// floating numbers, the bag, and the few sounds (all made in code).
import { SPELLS, SLOTS, SLOT_ICON, RARITY, RARITY_COLOR, bagSize, stats, xpNeed, itemScore, equipItem, sellItem, stock, price, buy, restock, restockCost, buyBag, bagCost } from './game.js';
import { CLASSES } from './figure.js';
import { mapShapes, WALL_R, ZONE, DUN } from './world.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let S, H, slots = [], floats = [], errT = 0, toastT = 0;

export function init(state, handlers) {
  S = state; H = handlers;
  $('hud').style.display = 'block'; $('title').style.display = 'none';
  $('pname').textContent = S.name;
  const bar = $('actions');
  SPELLS.forEach((sp, i) => {
    const s = el('div', 'slot', `${sp.icon}<kbd>${sp.key}</kbd><div class="cd"></div>`);
    s.style.background = `radial-gradient(circle at 40% 35%, ${sp.color}, #101418)`;
    s.onclick = () => H.cast(i);
    s.onpointerenter = e => tip(`<div class="n">${sp.name}</div><div class="m">${sp.mana} mana · ${sp.cast ? sp.cast + ' sec cast' : 'Instant'} · ${sp.range} yd</div>${sp.desc}`, e);
    s.onpointerleave = () => tip();
    bar.append(s); slots.push(s);
  });
  for (const lv of [5, 10]) bar.append(el('div', 'slot locked', `Level<br>${lv}`));
  const mk = (txt, fn, title) => { const b = el('div', 'slot small', txt); b.title = title; b.onclick = fn; bar.append(b); };
  mk('Tab', () => H.tab(), 'Next target (Tab, Shift+Tab goes back)');
  mk('Hurt', () => H.hurt(), 'Target the most hurt person nearby (F)');
  mk('Bag', toggleBag, 'Character and bag (B)');
  mk('View', () => H.view(), 'First or third person (V)');
  mk('Mouse', () => H.look(), 'Mouse-look on or off (X). Esc frees the cursor.');
  bar.lastChild.id = 'lookbtn';
  $('bagx').onclick = toggleBag;
  chat('c-sys', `Welcome to Lanternrest, ${esc(S.name)}.`);
  chat('c-sys', 'Tab picks a target. 1 casts Mend, 2 casts Renew.');
}

export function chat(cls, text) {
  const c = $('chat'); c.append(el('div', cls, esc(text)));
  while (c.children.length > 40) c.firstChild.remove();
}
export function chatHtml(cls, html) { $('chat').append(el('div', cls, html)); }
export function err(text) { const e = $('err'); e.textContent = text; e.style.opacity = 1; errT = 1.6; sfx('err'); }
export function toast(text, color) { const e = $('toast'); e.textContent = text; e.style.color = color || ''; e.style.opacity = 1; toastT = 2.6; }
export function zone(name) { $('zone').textContent = name; toast(name); }
export function hint(text) { const h = $('hint'); if (h.textContent !== text) h.textContent = text; }
export function itemLink(it) { return `<b style="color:${RARITY_COLOR[it.q]}">[${esc(it.name)}]</b>`; }

export function float(pos, text, cls) {
  const e = el('div', 'fl ' + (cls || ''), text); $('floats').append(e);
  floats.push({ e, pos, t: 0, dx: (Math.random() - 0.5) * 40 });
}

function tip(html, ev) {
  const t = $('tip'); if (!html) { t.style.display = 'none'; return; }
  t.innerHTML = html; t.style.display = 'block';
  const w = innerWidth, h = innerHeight, r = ev.currentTarget.getBoundingClientRect();
  t.style.left = Math.max(4, Math.min(w - 196, r.left - 60)) + 'px'; t.style.top = ''; t.style.bottom = (h - r.top + 6) + 'px';
}
function itemTip(it, cmp) {
  const line = (k, label, mult = 1) => {
    if (!it[k] && !(cmp && cmp[k])) return '';
    const d = cmp ? (it[k] || 0) - (cmp[k] || 0) : 0;
    return `<div>+${it[k] || 0} ${label}${d ? ` <span class="${d > 0 ? 'g' : 'r'}">(${d > 0 ? '+' : ''}${d})</span>` : ''}</div>`;
  };
  return `<div class="n" style="color:${RARITY_COLOR[it.q]}">${esc(it.name)}</div><div class="m">${RARITY[it.q]} ${it.slot} · item level ${it.ilvl}</div>` +
    line('power', 'Healing Power') + line('spirit', 'Spirit') + line('mana', 'Mana') + line('haste', 'Haste') + `<div class="m">Sells for ${it.value}c</div>`;
}

let bagOpen = false, shopOpen = false;
export function toggleBag() { bagOpen = !bagOpen; if (!bagOpen) shopOpen = false; $('bag').style.display = bagOpen ? 'block' : 'none'; tip(); if (bagOpen) drawBag(); H.panel(bagOpen); }
export function openShop() { shopOpen = true; if (!bagOpen) toggleBag(); else drawBag(); }
export function closeShop() { if (shopOpen) { shopOpen = false; if (bagOpen) toggleBag(); } }
export const isShopOpen = () => shopOpen;
export function setLook(on, locked) { const b = $('lookbtn'); b.style.color = on ? '#6dff7a' : ''; $('cross').style.display = locked ? 'block' : 'none'; }
function drawShop() {
  const box = $('shop'); box.style.display = shopOpen ? 'block' : 'none'; if (!shopOpen) return;
  const g = $('wares'); g.innerHTML = '';
  const done = msg => { if (msg) err(msg); else sfx('equip'); tip(); drawBag(); H.changed(); };
  stock(S).forEach((it, i) => {
    const d = el('div', 'it ' + (it ? 'q' + it.q : ''), it ? SLOT_ICON[it.slot] + `<small style="color:${S.coins >= price(it) ? '#ffd24a' : '#ff5a4a'}">${price(it)}c</small>` : '');
    if (it) { d.onpointerenter = e => tip(itemTip(it, S.equip[it.slot]) + `<div style="color:#ffd24a">Costs ${price(it)} copper</div>`, e); d.onpointerleave = () => tip(); d.onclick = () => done(buy(S, i)); }
    g.append(d);
  });
  const extra = (icon, cost, text, fn) => { const d = el('div', 'it', icon + `<small style="color:#ffd24a">${cost}c</small>`); d.onpointerenter = e => tip(`<div class="n">${text}</div><div style="color:#ffd24a">Costs ${cost} copper</div>`, e); d.onpointerleave = () => tip(); d.onclick = () => done(fn(S)); g.append(d); };
  extra('🔄', restockCost(S), 'New stock', restock);
  if (bagCost(S)) extra('🎒', bagCost(S), 'Bigger bag (+7 slots)', buyBag);
}
export function drawBag() {
  if (!bagOpen) return;
  drawShop();
  const eq = $('equip'), bg = $('items'); eq.innerHTML = ''; bg.innerHTML = '';
  for (const k of SLOTS) {
    const it = S.equip[k], d = el('div', 'it ' + (it ? 'q' + it.q : ''), (it ? SLOT_ICON[k] : `<span style="opacity:.25">${SLOT_ICON[k]}</span>`));
    d.onpointerenter = e => tip(it ? itemTip(it) : `<div class="m">${k}: empty</div>`, e); d.onpointerleave = () => tip();
    eq.append(d);
  }
  let lastTap = 0;
  for (let i = 0; i < bagSize(S); i++) {
    const it = S.bag[i], d = el('div', 'it ' + (it ? 'q' + it.q : ''), it ? SLOT_ICON[it.slot] + (itemScore(it) > itemScore(S.equip[it.slot]) ? '<small style="color:#1eff00">▲</small>' : '') : '');
    if (it) {
      d.onpointerenter = e => tip(itemTip(it, S.equip[it.slot]), e); d.onpointerleave = () => tip();
      d.onclick = e => {
        const dbl = Date.now() - lastTap < 350 && e.pointerType === 'touch'; lastTap = Date.now();
        if (e.shiftKey || dbl) { const v = sellItem(S, i); chat('c-loot', `You sell ${it.name} for ${v}c.`); }
        else { equipItem(S, i); sfx('equip'); }
        tip(); drawBag(); H.changed();
      };
    }
    bg.append(d);
  }
  const st = stats(S);
  $('stats').innerHTML = `Level ${S.level} Healer · Power <b>${st.power}</b> · Mana <b>${st.maxMana}</b><br>Spirit <b>${st.spirit}</b> (${st.regen.toFixed(1)}/s) · Haste <b>${st.hasteRaw}%</b> · Healed <b>${Math.round(S.healed)}</b>`;
  $('coins').textContent = S.coins + ' copper';
}

const setBar = (id, frac, text) => { $(id).style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`; if (text !== undefined) { const t = $(id + 't'); if (t && t.textContent !== text) t.textContent = text; } };

// Called every frame with what the HUD needs to show.
export function update(dt, v) {
  const st = v.stats;
  setBar('php', 1, `${st.maxHp} / ${st.maxHp}`);
  setBar('pmp', S.mana / st.maxMana, `${Math.floor(S.mana)} / ${st.maxMana}`);
  $('pname').textContent = `${S.name}  ·  ${S.level}`;
  const t = v.target, tf = $('tframe');
  tf.style.display = t ? 'block' : 'none';
  if (t) {
    $('tname').textContent = t.name; $('tname').style.color = CLASSES[t.cls].color; $('tport').textContent = t.level;
    setBar('thp', t.hp / t.maxHp, t.dead ? 'Dead' : `${Math.ceil(t.hp)} / ${t.maxHp}`);
    $('thp').style.background = t.hp < t.maxHp * 0.35 ? '#d83a2a' : '';
    $('tsub').textContent = `${t.cls}${t.dead ? ' · Dead' : t.duel ? ' · Duelling' : t.state === 'hunt' ? ' · In combat' : t.resting ? ' · Resting' : ''}${t.hots.length ? ' · ❋ Renew' : ''} · ${Math.round(v.dist)} yd`;
  }
  const cb = $('castbar');
  if (v.casting) { cb.style.visibility = 'visible'; cb.firstElementChild.style.width = (v.casting.t / v.casting.dur * 100) + '%'; cb.lastElementChild.textContent = v.casting.spell.name; }
  else cb.style.visibility = 'hidden';
  SPELLS.forEach((sp, i) => {
    slots[i].classList.toggle('dim', !t || S.mana < sp.mana || v.dist > sp.range);
    slots[i].lastElementChild.style.height = (v.gcd > 0 ? v.gcd / v.gcdMax * 100 : 0) + '%';
  });
  const need = xpNeed(S.level); $('xp').firstElementChild.style.width = (S.xp / need * 100) + '%'; $('xp').lastElementChild.textContent = `${S.xp} / ${need} XP`;
  if (errT > 0 && (errT -= dt) <= 0) $('err').style.opacity = 0;
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').style.opacity = 0;
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt;
    if (f.t > 1.4) { f.e.remove(); floats.splice(i, 1); continue; }
    const p = v.project(f.pos, 2.6 + f.t * 1.4);
    if (!p) { f.e.style.display = 'none'; continue; }
    f.e.style.display = ''; f.e.style.left = (p.x + f.dx * f.t) + 'px'; f.e.style.top = p.y + 'px'; f.e.style.opacity = Math.min(1, (1.4 - f.t) * 2.5);
  }
}

export function drawMap(me, yaw, people, target, mobs) {
  const c = $('map'), x = c.getContext('2d'), W = c.width, k = W / 2 / 48;
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#3f5c30'; x.fillRect(0, 0, W, W);
  x.translate(W / 2 - me.x * k, W / 2 - me.z * k); x.scale(k, k);
  if (me.x > 500) { x.fillStyle = '#120a08'; x.fillRect(me.x - 100, me.z - 100, 200, 200); x.fillStyle = '#6a5a52'; for (const [x0, z0, x1, z1] of DUN.rects) x.fillRect(x0, z0, x1 - x0, z1 - z0);
    x.fillStyle = '#6ab8ff'; for (const e of DUN.exits) { x.beginPath(); x.arc(e.x, e.z, 2, 0, 7); x.fill(); } }
  x.fillStyle = '#5f8a48'; x.fillRect(ZONE.x0, ZONE.z0, ZONE.x1 - ZONE.x0, -ZONE.z0 - 40);
  x.fillStyle = '#8a8478'; x.beginPath(); x.arc(0, 0, WALL_R, 0, 7); x.fill();
  x.strokeStyle = '#555049'; x.lineWidth = 2.5; x.stroke();
  for (const s of mapShapes) {
    x.fillStyle = s.c || '#333';
    if (s.t === 'c') { x.beginPath(); x.arc(s.x, s.z, s.r, 0, 7); x.fill(); }
    else if (s.t === 'zone') continue;
    else if (s.t === 'road') { x.strokeStyle = '#b39a68'; x.lineWidth = 4; x.beginPath(); s.pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); }
    else if (s.t === 'b') { x.save(); x.translate(s.x, s.z); x.rotate(-s.rot); x.fillRect(-s.w / 2, -s.d / 2, s.w, s.d); x.restore(); }
    else { x.fillStyle = '#2a2018'; x.fillRect(s.x - 5, s.z - 1.5, 10, 3); }
  }
  for (const m of mobs) if (m.state !== 'dead') { x.fillStyle = m.def.elite ? '#ffb040' : '#b02a20'; x.beginPath(); x.arc(m.x, m.z, m.def.elite ? 2 : 1.1, 0, 7); x.fill(); }
  for (const p of people) {
    x.fillStyle = p.dead ? '#888' : p.hp < p.maxHp * 0.5 ? '#ff5a4a' : p.hp < p.maxHp ? '#ffd24a' : '#7fe38a';
    x.beginPath(); x.arc(p.x, p.z, p === target ? 2 : 1.3, 0, 7); x.fill();
    if (p === target) { x.strokeStyle = '#fff'; x.lineWidth = 0.6; x.stroke(); }
  }
  x.save(); x.translate(me.x, me.z); x.rotate(-yaw);
  x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(0, 3.4); x.lineTo(2, -2); x.lineTo(0, -1); x.lineTo(-2, -2); x.closePath(); x.fill(); x.stroke();
  x.restore();
}

let ac;
export function sfx(kind) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const N = { heal: [[660, 0, .12], [990, .08, .2]], tick: [[880, 0, .06]], cast: [[330, 0, .25]], err: [[140, 0, .12]], equip: [[300, 0, .05], [450, .05, .08]],
      loot: [[784, 0, .1], [988, .09, .1], [1319, .18, .25]], level: [[523, 0, .15], [659, .14, .15], [784, .28, .15], [1047, .42, .5]] }[kind] || [];
    const vol = { tick: .03, err: .05, cast: .03 }[kind] || .07;
    for (const [f, at, len] of N) {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + at;
      o.type = kind === 'err' ? 'sawtooth' : 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + len + 0.02);
    }
  } catch (e) {}
}
