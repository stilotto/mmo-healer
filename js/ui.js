// The heads-up display: unit frames, action bar, cast bar, chat, minimap,
// floating numbers, the bag, and the few sounds (all made in code).
import { SPELLS, healEstimate, knows, SLOTS, TREES, TIER_COST, rank, cantLearn, learn, resetTalents, pointsFree, pointsSpent, SLOT_ICON, RARITY, RARITY_COLOR, bagSize, stats, xpNeed, itemScore, equipItem, sellItem, stock, price, buy, restock, restockCost, buyBag, bagCost, EFFECTS, UNIQUES, avgIlvl } from './game.js';
import { makeDoll } from './doll.js';
import { CLASSES } from './figure.js';
import { mapShapes, WALL_R, ZONE, DUN, instanceAt } from './world.js';
import { chat, chatHtml } from './chat.js';
import { FAME, fameTier } from './memory.js';
export { chat, chatHtml };

const ids = {};
const $ = id => ids[id] && ids[id].isConnected ? ids[id] : (ids[id] = document.getElementById(id));
// Speed: the HUD runs every frame, so only touch the page when a value changes.
const txt = (e, v) => { v = String(v); if (e._t !== v) { e._t = v; e.textContent = v; } };
const sty = (e, k, v) => { v = String(v); const c = e._s || (e._s = {}); if (c[k] !== v) { c[k] = v; e.style[k] = v; } };
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
    if (sp.lvl) s.append(el('div', 'lk', 'Lv ' + sp.lvl));
    if (sp.talent) s.style.display = 'none';      // talent spells appear once learned
    s.onpointerenter = e => tip(`<div class="n">${sp.name}</div><div class="m">${sp.mana} mana · ${sp.cast ? sp.cast + ' sec cast' : 'Instant'} · ${sp.range} yd</div>${sp.desc}`, e);
    s.onpointerleave = () => tip();
    bar.append(s); slots.push(s);
  });
  const mk = (txt, fn, title) => { const b = el('div', 'slot small', txt); b.title = title; b.onclick = fn; bar.append(b); };
  mk('Tab', () => H.tab(), 'Next target (Tab, Shift+Tab goes back)');
  mk('Hurt', () => H.hurt(), 'Target the most hurt person in range, you included (F)');
  mk('Drink', () => H.drink(), 'Sit and drink to restore mana (Z). Moving or casting stands you up.');
  mk('Fish', () => H.fish(), 'Fish from the water\'s edge (G). Click when the float dips.');
  bar.lastChild.id = 'fishbtn'; bar.lastChild.style.display = 'none';
  mk('Bag', toggleBag, 'Character and bag (B)');
  mk('View', () => H.view(), 'First or third person (V)');
  mk('?', toggleHelp, 'Help: every control, and settings (H)');
  mk('Mouse', () => H.look(), 'Mouse-look on or off (X). Esc frees the cursor.');
  bar.lastChild.id = 'lookbtn';
  $('helpx').onclick = toggleHelp; $('evx').onclick = toggleEvents; $('tracker').onclick = toggleEvents;
  $('bagx').onclick = toggleBag; $('talbtn').onclick = toggleTalents; $('talx').onclick = toggleTalents;
  $('treset').onclick = () => { resetTalents(S); sfx('equip'); drawTalents(); H.changed(); chat('c-sys', 'Your talents are reset. Every point is free to spend again.'); };
  chat('c-sys', `Welcome to Lanternrest, ${esc(S.name)}.`);
  chat('c-sys', 'Tab picks a target. 1 casts Mend, 2 casts Renew. Enter opens the chat box. H (or the ? button) shows every control.');
  $('pframe').onclick = () => H.self();
}

let canFish = false;
export function fishable(on) { if (on === undefined) return canFish; canFish = on; $('fishbtn').style.display = on ? '' : 'none'; }
// Help: every control in one place, and a few settings.
let helpOpen = false;
export function toggleHelp() { helpOpen = !helpOpen; $('help').style.display = helpOpen ? 'block' : 'none'; tip(); if (helpOpen) drawHelp(); H.panel(helpOpen || evOpen || bagOpen || talOpen); }
export const helpShown = () => helpOpen;
const rowsOf = list => '<table>' + list.map(([k, d]) => `<tr><td>${k}</td><td>${d}</td></tr>`).join('') + '</table>';
export function drawHelp() {
  if (!helpOpen) return;
  const gfx = H.quality(), look = !!S.look;
  const spells = SPELLS.map(sp => [sp.key, `${sp.name}${sp.lvl ? ` (level ${sp.lvl})` : ''}${sp.talent ? ' (talent)' : ''}: ${sp.desc}`]);
  $('helpbody').innerHTML = `
  <h4>Settings</h4>
  <div class="opt">Graphics: ${['auto', 'high', 'low'].map(m => `<button data-g="${m}" class="${gfx === m ? 'on' : ''}">${{ auto: 'Auto (turns down if slow)', high: 'High', low: 'Low (for Chromebooks)' }[m]}</button>`).join('')}</div>
  <div class="opt">Render size: <button data-r="auto" class="${H.renderMode() === 'auto' ? 'on' : ''}">Auto</button><button data-r="full" class="${H.renderMode() === 'full' ? 'on' : ''}">Full</button> <span style="color:#999">Auto draws a smaller picture, stretched, if the game is still slow with glow and shadows off (big monitors). A smaller window stays sharp.</span></div>
  <div class="opt">Speed: <button data-st="1">Run the speed test</button> <span style="color:#999">About a minute: the game visits ten spots and measures the frame rate, then shows a report to copy.</span></div>
  <div class="opt">Mouse-look: <button data-l="1" class="${look ? 'on' : ''}">On</button><button data-l="0" class="${look ? '' : 'on'}">Off</button> <span style="color:#999">The mouse steers without holding a button; Esc frees the cursor.</span></div>
  <div class="cols"><div>
  <h4>Moving and the camera</h4>${rowsOf([['W A S D', 'Move. A and D turn (strafe with the right button held, or in mouse-look)'], ['Q E', 'Strafe'], ['Arrow keys', 'Turn and tilt the view'], ['Space', 'Jump'], ['R', 'Run on its own (W or S stops)'],
    ['Left drag', 'Look around'], ['Right drag', 'Steer'], ['Both buttons', 'Run forward'], ['Wheel', 'Zoom, all the way into first person'], ['V', 'First or third person'], ['X', 'Mouse-look on or off']])}
  <h4>Targeting</h4>${rowsOf([['Click', 'Target a person'], ['Tab, Shift+Tab', 'Next or last target in front of you'], ['F', 'The most hurt person in range (you too)'],
    ['F1 or Shift+1', 'Yourself'], ['F2 to F6 or Shift+2 to 6', 'The people in the frames on the left'], ['Esc', 'Clear the target, or stop a cast']])}
  <h4>Other actions</h4>${rowsOf([['Z', 'Sit and drink to get mana back'], ['Click a fish in the bag', 'Eat it for mana'], ['G', 'Fish (at the water); again to reel in'], ['B or C', 'Character and bag'], ['N', 'Talents'], ['H', 'This help'], ['Enter or /', 'Chat']])}
  </div><div>
  <h4>Spells</h4>${rowsOf(spells)}
  <h4>Slash commands</h4>${rowsOf([['/s /y /w /r /g', 'Say, yell, whisper, reply, guild'], ['/wave /cheer /bow /dance /sit /laugh /thank', 'Emotes'], ['/who [name]', 'Who is here, or what someone remembers'],
    ['/target name', 'Target by name'], ['/need /greed /pass', 'Loot rolls'], ['/roll [max]', 'Roll a number'], ['/fame', 'Your fame'], ['/events', 'The events board'],
    ['/graphics auto|high|low', 'Graphics quality'], ['/render auto|full', 'Render size'], ['/speedtest', 'Measure the frame rate on a tour of ten spots'], ['/fpslog', 'Log the frame rate as you play (again to stop)'], ['/speedreport', 'The last speed report'], ['/leave, /join general or zone', 'Chat channels'], ['/accept, /gquit', 'Guild invite, leave guild'], ['/help', 'This window']])}
  <h4>Touch</h4>${rowsOf([['Stick', 'Move (bottom left)'], ['Drag', 'Look and steer'], ['Tap', 'Target'], ['Buttons', 'Spells and actions on the bar; double-tap a bag item to sell']])}
  </div></div>`;
  for (const b of $('helpbody').querySelectorAll('[data-g]')) b.onclick = () => { H.setQuality(b.dataset.g); drawHelp(); };
  for (const b of $('helpbody').querySelectorAll('[data-r]')) b.onclick = () => { H.setRender(b.dataset.r); drawHelp(); };
  for (const b of $('helpbody').querySelectorAll('[data-st]')) b.onclick = () => { toggleHelp(); H.speedtest(); };
  for (const b of $('helpbody').querySelectorAll('[data-l]')) b.onclick = () => { if (!!S.look !== (b.dataset.l === '1')) H.look(); drawHelp(); };
}
// Events: the tracker under the minimap and the board's window.
let evOpen = false, evT = 0;
export function toggleEvents() { evOpen = !evOpen; $('events').style.display = evOpen ? 'block' : 'none'; if (evOpen) { evT = 0; drawEvents(); } H.panel(evOpen || bagOpen || talOpen); }
export const eventsOpen = () => evOpen;
export function drawEvents(force) {
  const c = H.clock(); if (!c) return;
  const ago = t => { const m = Math.floor((c.T - t) / 60); return m < 1 ? 'just now' : m + ' min ago'; };
  $('tracker').innerHTML = c.list().slice(0, 3).map(e => `<div class="${e.state === 'on' ? 'on' : ''}"><b>${e.name}</b> ${c.short(e)}</div>`).join('');
  if (!evOpen) return;
  $('evlist').innerHTML = c.list().map(e => `<div class="ev ${e.state === 'on' ? 'on' : ''}"><span class="s">${c.status(e)}</span><b>${e.name}</b><div class="w">At ${e.where}${e.people.length ? ' · ' + e.people.filter(p => !p.gone).map(p => esc(p.name)).join(', ') : ''}</div></div>`).join('');
  $('evdone').innerHTML = c.results.length ? c.results.map(r => `<div class="ev"><span class="s" style="color:#999">${ago(r.t)}</span><b>${r.name}</b><div class="${r.good ? 'good' : 'bad'}">${esc(r.text)}</div></div>`).join('') : '<div class="w" style="color:#999">Nothing yet today.</div>';
}
// The talent window: three sections, each in rows (tiers).
let talOpen = false;
export function toggleTalents() { talOpen = !talOpen; $('talents').style.display = talOpen ? 'block' : 'none'; tip(); if (talOpen) drawTalents(); H.panel(talOpen || bagOpen); }
export function drawTalents() {
  if (!talOpen) return;
  const free = pointsFree(S); $('tpts').textContent = S.level < 3 ? '(points start at level 3)' : `${free} point${free === 1 ? '' : 's'} to spend`;
  const box = $('trees'); box.innerHTML = '';
  for (const t of TREES) {
    const spent = pointsSpent(S, t), d = el('div', 'tree', `<div class="tn">${t.name} <small style="color:#aaa;font:11px sans-serif">${spent}</small></div><div class="tt">${t.note}</div>`);
    for (let tier = 0; tier < 3; tier++) {
      const row = el('div', 'trow', '');
      for (const x of t.talents.filter(x => x.tier === tier)) {
        const r = rank(S, x.id), open = spent >= tier * TIER_COST, why = cantLearn(S, x.id);
        const b = el('div', 'tal' + (r >= x.max ? ' full' : r ? ' has' : '') + (open ? '' : ' shut'), `${x.icon}<small>${r}/${x.max}</small>`);
        b.onpointerenter = e => tip(`<div class="n">${x.name}</div><div class="m">Rank ${r} of ${x.max}${tier ? ` · needs ${tier * TIER_COST} in ${t.name}` : ''}</div>` +
          `<div>${x.desc(Math.max(1, r))}</div>${r && r < x.max ? `<div class="g">Next rank: ${x.desc(r + 1)}</div>` : ''}${why && r < x.max ? `<div class="r">${why}</div>` : ''}`, e);
        b.onpointerleave = () => tip();
        b.onclick = e => { const m = learn(S, x.id); if (m) err(m); else { sfx('level'); if (x.tier === 2) chat('c-heal', `${x.name}: ${x.desc(1)}`); H.changed(); } drawTalents(); tip(); };
        row.append(b);
      }
      d.append(row);
    }
    box.append(d);
  }
}
export function err(text) { const e = $('err'); txt(e, text); sty(e, 'opacity', 1); errT = 1.6; sfx('err'); }
export function toast(text, color) { const e = $('toast'); txt(e, text); sty(e, 'color', color || ''); sty(e, 'opacity', 1); toastT = 2.6; }
export function zone(name, band) { $('zone').textContent = name; toast(name + (band ? ` (levels ${band[0]} to ${band[1]})` : '')); }
export function hint(text) { const h = $('hint'); if (h.textContent !== text) h.textContent = text; }
const qcol = it => it.unique ? '#ffa030' : RARITY_COLOR[it.q], qcls = it => it ? (it.unique ? 'qu' : 'q' + it.q) : '';
export function itemLink(it) { return `<b style="color:${qcol(it)}">[${esc(it.name)}]</b>`; }

// Combat text: numbers pop out over the unit, drift up and sideways, and fade.
// Damage to monsters is yellow, damage to people red, heals green with a +.
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
export function float(pos, text, cls) {
  if (floats.length > 60) return;
  const e = el('div', 'fl ' + (cls || ''), text); $('floats').append(e);
  const side = Math.random() < 0.5 ? -1 : 1;
  floats.push({ e, pos, t: 0, dx: side * (14 + Math.random() * 36), life: cls === 'xp' ? 1.6 : cls === 'crit' ? 1.5 : 1.2, big: cls === 'crit' || cls === 'dmg big' });
}

function tip(html, ev) {
  const t = $('tip'); if (!html) { t.style.display = 'none'; return; }
  t.innerHTML = html; t.style.display = 'block';
  const w = innerWidth, h = innerHeight, r = ev.currentTarget.getBoundingClientRect();
  t.style.left = Math.max(4, Math.min(w - 196, r.left - 60)) + 'px'; t.style.top = ''; t.style.bottom = (h - r.top + 6) + 'px';
}
function itemTip(it, cmp) {
  if (it.kind === 'fish') return `<div class="n" style="color:${qcol(it)}">${esc(it.name)}</div><div class="m">${it.named ? 'Named fish' : 'Fish'}</div>` +
    `<div style="color:#8ad8ff">Click to sit and eat: restores ${Math.round(it.restore * 100)}% of your mana over ${6} seconds.</div>` +
    (it.named ? '<div style="color:#ffc070">The pond\'s oldest resident. People will talk.</div>' : '') + `<div class="m">Sells for ${it.value}c (Shift+click)</div>`;
  if (it.kind === 'junk') return `<div class="n">${esc(it.name)}</div><div class="m">Junk. Click to sell for ${it.value}c.</div>`;
  const line = (k, label, mult = 1) => {
    if (!it[k] && !(cmp && cmp[k])) return '';
    const d = cmp ? (it[k] || 0) - (cmp[k] || 0) : 0;
    return `<div>+${it[k] || 0} ${label}${d ? ` <span class="${d > 0 ? 'g' : 'r'}">(${d > 0 ? '+' : ''}${d})</span>` : ''}</div>`;
  };
  return `<div class="n" style="color:${qcol(it)}">${esc(it.name)}</div><div class="m">${it.unique ? 'Unique' : RARITY[it.q]} ${it.slot} · item level ${it.ilvl}</div>` +
    line('power', 'Healing Power') + line('spirit', 'Spirit') + line('mana', 'Mana') + line('haste', 'Haste') +
    (it.fx ? `<div style="color:#ffc070">Equip: ${EFFECTS[it.fx]}</div>` : '') + (cmp && cmp.fx && cmp.fx !== it.fx ? `<div class="r">Replaces: ${EFFECTS[cmp.fx]}</div>` : '') +
    (it.unique ? `<div class="m">From ${UNIQUES[it.unique].boss}</div>` : '') + `<div class="m">Sells for ${it.value}c</div>`;
}

export function tipItem(it, e) { tip(it ? itemTip(it, it.kind ? null : S.equip[it.slot]) : '', e); }
let bagOpen = false, shopOpen = false, doll = null;
export function toggleBag() { bagOpen = !bagOpen; if (bagOpen && !doll) { doll = makeDoll($('dollc')); doll.show(S.equip); } if (doll) doll.preview(null); if (!bagOpen) shopOpen = false; $('bag').style.display = bagOpen ? 'block' : 'none'; tip(); if (bagOpen) drawBag(); H.panel(bagOpen); }
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
  const bg = $('items'); bg.innerHTML = '';
  // Paper doll slots: head, robe, trinket on the left; gloves, boots, ring on the right; staff below.
  const lay = { dl: ['Hood', 'Robe', 'Trinket'], dr: ['Gloves', 'Boots', 'Ring'], ds: ['Staff'] };
  for (const col in lay) {
    const box = $(col); box.innerHTML = '';
    for (const k of lay[col]) {
      const it = S.equip[k], d = el('div', 'it ' + qcls(it), (it ? SLOT_ICON[k] : `<span style="opacity:.25">${SLOT_ICON[k]}</span>`));
      d.onpointerenter = e => tip(it ? itemTip(it) : `<div class="m">${k}: empty</div>`, e); d.onpointerleave = () => tip();
      box.append(d);
    }
  }
  let lastTap = 0;
  for (let i = 0; i < bagSize(S); i++) {
    const it = S.bag[i], d = el('div', 'it ' + qcls(it), it ? SLOT_ICON[it.slot] + (itemScore(it) > itemScore(S.equip[it.slot]) ? '<small style="color:#1eff00">▲</small>' : '') : '');
    if (it) {
      d.onpointerenter = e => { tip(itemTip(it, it.kind ? null : S.equip[it.slot]), e); if (doll && !it.kind) doll.preview(it); };
      d.onpointerleave = () => { tip(); if (doll) doll.preview(null); };
      d.onclick = e => {
        const dbl = Date.now() - lastTap < 350 && e.pointerType === 'touch'; lastTap = Date.now();
        if (e.shiftKey || dbl || it.kind === 'junk') { const v = sellItem(S, i); chat('c-loot', `You sell ${it.name} for ${v}c.`); }
        else if (it.kind === 'fish') { tip(); H.eat(i); return; }
        else { equipItem(S, i); sfx('equip'); H.dressed(); }
        tip(); if (doll) { doll.preview(null); doll.show(S.equip); } drawBag(); H.changed();
      };
    }
    bg.append(d);
  }
  const st = stats(S);
  $('stats').innerHTML = `<b style="color:var(--gold)">${esc(S.name)}</b>, level ${S.level} healer<br>Healing power <b>${st.power}</b><br>Spirit <b>${st.spirit}</b> · Mana regen <b>${st.regen.toFixed(1)}/s</b><br>` +
    `Haste <b>${st.hasteRaw}%</b> · Mana <b>${st.maxMana}</b><br>Average item level <b>${avgIlvl(S)}</b><br>Fame <b>${Math.floor(S.fame)}</b> (${FAME[fameTier(S)].name})${S.guild ? `<br>&lt;${esc(S.guild)}&gt;` : ''}`;
  $('coins').textContent = S.coins + ' copper';
  const u = $('uniq'); u.innerHTML = ''; S.uniques = S.uniques || {};
  for (const id in UNIQUES) {
    const q = UNIQUES[id], got = S.uniques[id], d = el('div', 'it ' + (got ? 'qu' : ''), got ? SLOT_ICON[q.slot] : '<span style="opacity:.35">?</span>');
    d.onpointerenter = e => tip(`<div class="n" style="color:${got ? '#ffa030' : '#888'}">${got ? q.name : '???'}</div><div class="m">${q.slot} · from ${q.boss}</div><div style="color:#ffc070">${EFFECTS[q.fx]}</div>${got ? '' : '<div class="m">Not found yet</div>'}`, e);
    d.onpointerleave = () => tip(); u.append(d);
  }
  $('ucount').textContent = Object.keys(S.uniques).filter(k => UNIQUES[k]).length + ' / ' + Object.keys(UNIQUES).length;
}

const setBar = (id, frac, text) => { sty($(id), 'transform', `scaleX(${Math.max(0, Math.min(1, frac))})`); if (text !== undefined) { const t = $(id + 't'); if (t) txt(t, text); } };

// Called every frame with what the HUD needs to show.
export function update(dt, v) {
  const st = v.stats;
  setBar('php', v.me.hp / v.me.maxHp, `${Math.ceil(v.me.hp)} / ${v.me.maxHp}`);
  $('pframe').classList.toggle('sel', v.target === v.me); $('pframe').classList.toggle('combat', !!v.combat);
  const ps = v.drinking ? (v.eating ? 'Eating' : 'Drinking') + (v.me.hots.length ? ' · ❋' : '') : (v.me.hots.length ? '❋ Renew' : '') + (v.me.ward ? ' ◈' : '') + (v.me.surge ? ' ⚡ Surge' : '');
  txt($('psub'), ps);
  pitBoard(v.pit);
  if (v.raid) raidFrames(v); else { if (rcells.length) sty($('raidf'), 'display', 'none'); frames(v); }
  boss(v);
  setBar('pmp', S.mana / st.maxMana, `${Math.floor(S.mana)} / ${st.maxMana}`);
  txt($('pname'), `${S.name}  ·  ${S.level}`);
  const t = v.target, tf = $('tframe');
  sty(tf, 'display', t ? 'block' : 'none');
  if (t) {
    txt($('tname'), t.name); sty($('tname'), 'color', CLASSES[t.cls].color); txt($('tport'), t.level);
    setBar('thp', t.hp / t.maxHp, t.dead ? 'Dead' : `${Math.ceil(t.hp)} / ${t.maxHp}`);
    sty($('thp'), 'background', t.hp < t.maxHp * 0.35 ? '#d83a2a' : '');
    txt($('tsub'), `${t.cls}${t.dead ? ' · Dead' : t.duel ? ' · Duelling' : t.state === 'hunt' ? ' · In combat' : t.resting ? ' · Resting' : ''}${t.hots.length ? ' · ❋ Renew' : ''}${v.moodOf && v.moodOf(t) ? ' · ' + v.moodOf(t) : ''} · ${Math.round(v.dist)} yd`);
  }
  const cb = $('castbar');
  if (v.casting) { sty(cb, 'visibility', 'visible'); sty(cb.firstElementChild, 'width', (v.casting.t / v.casting.dur * 100) + '%'); txt(cb.lastElementChild, v.casting.spell.name); }
  else sty(cb, 'visibility', 'hidden');
  SPELLS.forEach((sp, i) => {
    const lk = slots[i]._lk === undefined ? (slots[i]._lk = slots[i].querySelector('.lk')) : slots[i]._lk; if (lk) sty(lk, 'display', knows(S, sp) ? 'none' : '');
    if (sp.talent) { const d = knows(S, sp) ? '' : 'none'; if (slots[i].style.display !== d) slots[i].style.display = d; }
    slots[i].classList.toggle('dim', v.me.dead || (!sp.self && (!t || v.dist > sp.range)) || S.mana < sp.mana);
    const own = sp.cd && v.cds[sp.id] > v.T ? (v.cds[sp.id] - v.T) / sp.cd : 0;
    sty(slots[i]._cd || (slots[i]._cd = slots[i].querySelector('.cd')), 'height', Math.max(own, v.gcd > 0 ? v.gcd / v.gcdMax : 0) * 100 + '%');
  });
  fame();
  if ((evT -= v.dt) <= 0) { evT = 0.5; drawEvents(); }
  if (bagOpen && doll) doll.render(dt);
  const need = xpNeed(S.level); sty($('xp').firstElementChild, 'width', (S.xp / need * 100) + '%'); txt($('xp').lastElementChild, `${S.xp} / ${need} XP`);
  if (errT > 0 && (errT -= dt) <= 0) sty($('err'), 'opacity', 0);
  if (toastT > 0 && (toastT -= dt) <= 0) sty($('toast'), 'opacity', 0);
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt;
    if (f.t > f.life) { f.e.remove(); floats.splice(i, 1); continue; }
    const k = f.t / f.life, p = v.project(f.pos, 2.3);
    if (!p || p.d > 55) { sty(f.e, 'display', 'none'); continue; }
    const near = Math.max(0.5, Math.min(1.25, 16 / p.d));           // smaller further away
    const pop = calm ? 1 : f.t < 0.08 ? 0.6 + f.t / 0.08 * (f.big ? 1.1 : 0.7) : f.t < 0.22 ? (f.big ? 1.7 : 1.3) - (f.t - 0.08) / 0.14 * (f.big ? 0.5 : 0.3) : f.big ? 1.2 : 1;
    const rise = (1 - (1 - k) * (1 - k)) * 70 * near, drift = calm ? 0 : f.dx * k * near;
    sty(f.e, 'display', ''); sty(f.e, 'opacity', k < 0.6 ? 1 : (1 - k) / 0.4);
    sty(f.e, 'transform', `translate(${p.x + drift}px,${p.y - rise}px) translate(-50%,-50%) scale(${pop * near})`);
  }
}

// Fame under the minimap: the name people call you and progress to the next.
let fameLast = '';
function fame() {
  const i = fameTier(S), a = FAME[i].at, b = FAME[i + 1] ? FAME[i + 1].at : a, k = b > a ? (S.fame - a) / (b - a) : 1, key = i + ':' + Math.round(k * 50);
  if (key === fameLast) return; fameLast = key;
  $('famen').textContent = FAME[i].name; $('fameb').style.width = Math.min(100, k * 100) + '%';
  $('fame').title = `Fame ${Math.floor(S.fame)}` + (FAME[i + 1] ? `. Next: ${FAME[i + 1].name} at ${b}` : '');
}

export function drawMap(me, yaw, people, target, corpse, mobs, drops = []) {
  const c = $('map'), x = c.getContext('2d'), W = c.width, k = W / 2 / 48;
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#3f5c30'; x.fillRect(0, 0, W, W);
  x.translate(W / 2 - me.x * k, W / 2 - me.z * k); x.scale(k, k);
  if (me.x > 500) { const I = instanceAt(me.x); x.fillStyle = I === DUN ? '#120a08' : '#2a1a3a'; x.fillRect(me.x - 100, me.z - 100, 200, 200); x.fillStyle = I === DUN ? '#6a5a52' : '#8a809a'; for (const [x0, z0, x1, z1] of I.rects) x.fillRect(x0, z0, x1 - x0, z1 - z0);
    x.fillStyle = '#6ab8ff'; for (const e of I.exits) { x.beginPath(); x.arc(e.x, e.z, 2, 0, 7); x.fill(); } }
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
  for (const d of drops) { x.fillStyle = d.it.unique ? '#ffa030' : RARITY_COLOR[d.it.q]; x.strokeStyle = '#000'; x.lineWidth = 0.4; x.beginPath(); x.moveTo(d.x, d.z - 2); x.lineTo(d.x + 1.5, d.z); x.lineTo(d.x, d.z + 2); x.lineTo(d.x - 1.5, d.z); x.closePath(); x.fill(); x.stroke(); }
  if (corpse) { x.fillStyle = '#fff2a8'; x.strokeStyle = '#000'; x.lineWidth = 0.6; x.beginPath(); x.arc(corpse.x, corpse.z, 2.6, 0, 7); x.fill(); x.stroke(); }
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

// Unit frames: the dungeon party when inside, otherwise the people nearby who
// most need you. Click a frame (or F2 to F6) to target. Slots are kept stable
// so frames do not jump around while you aim.
const rows = [];
let shown = [], pickT = 0;
export const frameUnits = () => shown;
// Raid frames: four groups of five, small cells, class-coloured, red when low.
const rcells = [];
// The Pit's recap: the result, both teams' numbers, your part and your reward.
export function pitRecap(r) {
  const box = $('recap'); box.style.display = r ? 'block' : 'none'; H.panel(!!r); if (!r) return;
  const T = { sun: ['Sunward', '#ffc040'], dusk: ['Duskward', '#ff4a5a'] };
  const n = x => Math.round(x).toLocaleString(), mm = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const team = k => `<div><h4 style="color:${T[k][1]}">${T[k][0]} ${r.score[k]}</h4><table><tr><th></th><th>Kills</th><th>Deaths</th><th>Flags</th></tr>` +
    r.teams[k].sort((a, b) => b.caps - a.caps || b.kills - a.kills).map(p => `<tr><td style="color:${CLASSES[p.cls].color}">${esc(p.name)}${p.name === r.top.kills ? ' ⚔' : ''}${p.name === r.top.caps ? ' ⚑' : ''}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.caps}${p.returns ? ` <small>+${p.returns} back</small>` : ''}</td></tr>`).join('') + '</table></div>';
  const m = r.mine;
  box.innerHTML = `<div class="rt" style="color:${r.win ? T[r.win][1] : '#ddd'}">${r.win ? T[r.win][0] + ' wins!' : 'A draw'}</div>
    <div class="rs">${r.score.sun} to ${r.score.dusk} · ${mm(r.time)}</div>
    <div class="you"><b>Your part.</b> You healed <span style="color:${T.sun[1]}">Sunward ${n(r.raw.sun)}</span> and <span style="color:${T.dusk[1]}">Duskward ${n(r.raw.dusk)}</span>.
      Revives ${m.revives} · deaths ${m.deaths}${m.hunted ? ` · hunted by up to ${m.hunted}` : ''}.<div class="rw">${esc(r.reward)}</div></div>
    <div class="cols">${team('sun')}${team('dusk')}</div>
    <div class="m" style="color:#999;font-size:11px">⚔ most kills · ⚑ most flags carried home</div>
    <div class="bt"><button id="rleave">Back to town <span id="rcount"></span></button><button id="rstay">Stay for the next match</button></div>`;
  $('rleave').onclick = () => H.leavePit(); $('rstay').onclick = () => H.stayInPit();
}
export function recapCount(t) { const c = $('rcount'); if (c) { const v = '(' + Math.ceil(Math.max(0, t)) + ')'; if (c.textContent !== v) c.textContent = v; } }
// The Pit's scoreboard: score, clock, flags, and how each side sees you.
function pitBoard(b) {
  const el2 = $('pitb'); sty(el2, 'display', b ? 'block' : 'none'); if (!b) return;
  const t = Math.ceil(b.t), clock = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  const st = k => b.stand[k] ? ` <small class="${b.stand[k] === 'on your side' ? 'g' : 'r'}">${b.stand[k]}</small>` : '';
  const html = `<div><b style="color:#ffc040">Sunward ${b.score.sun}</b> <span>${b.end || (b.prep ? 'starts in ' + Math.ceil(b.prep) : clock)}</span> <b style="color:#ff4a5a">${b.score.dusk} Duskward</b></div>` +
    `<div class="f"><span>⚑ ${b.flags.sun}${st('sun')}</span><span>⚑ ${b.flags.dusk}${st('dusk')}</span></div>`;
  if (el2.innerHTML !== html) el2.innerHTML = html;
}
function raidFrames(v) {
  const box = $('raidf'), cols = v.cols || 4, rows = cols === 4 ? 5 : 6;      // the raid in groups of five; the Pit as two teams of six
  sty(box, 'display', 'grid'); sty($('party'), 'display', 'none'); sty(box, 'gridTemplateColumns', `repeat(${cols}, var(--rcw))`);
  while (rcells.length < 24) {
    const c = el('div', 'rc', '<i></i><span></span><b></b>'), i = rcells.length;
    c.onclick = () => { const u = rcells[i].u; if (u) H.targetUnit(u); }; box.append(c);
    rcells.push({ c, fill: c.children[0], t: c.children[1], d: c.children[2], u: null });
  }
  rcells.forEach((w, i) => {
    const u = i < cols * rows ? v.list[(i % cols) * rows + Math.floor(i / cols)] : null;        // column = group or team
    sty(w.c, 'display', i < cols * rows ? '' : 'none');
    w.u = u; sty(w.c, 'visibility', u ? '' : 'hidden'); if (!u) return;
    sty(w.c, 'borderLeft', u.team ? `3px solid ${u.team === 'sun' ? '#ffc040' : '#ff4a5a'}` : '');
    const f = u.dead ? 0 : u.hp / u.maxHp;
    sty(w.fill, 'transform', `scaleX(${f})`); sty(w.fill, 'background', f < 0.35 ? '#c0302a' : CLASSES[u.cls].color);
    if (w.t.textContent !== u.name) txt(w.t, u.name);
    const mark = (u.dots && u.dots.length ? '●' : '') + (u.hots.length ? '❋' : '') + (u.tank ? '⛨' : u.healer ? '✚' : '');
    if (w.d.textContent !== mark) txt(w.d, mark);
    w.c.classList.toggle('sel', v.target === u); w.c.classList.toggle('dead', !!u.dead); w.c.classList.toggle('far', v.distOf(u) > 40);
  });
}
function frames(v) {
  sty($('party'), 'display', '');
  const box = $('party');
  if ((pickT -= v.dt) <= 0 || v.list !== frames.list) {
    pickT = 1; frames.list = v.list;
    const want = v.list.slice(0, 5), keep = shown.filter(u => want.includes(u));
    shown = [...keep, ...want.filter(u => !keep.includes(u))].slice(0, 5);
    if (v.party) shown = v.list.slice(0, 5);
  }
  txt($('phead'), shown.length ? v.party ? 'Their party (not yours)' : 'Nearby' : '');
  while (rows.length < 5) {
    const r = el('div', 'pf', '<div class="fill"></div><div class="inc"></div><div class="wd"></div><div class="t"></div><div class="s"><span></span><span></span></div><kbd></kbd>');
    const i = rows.length; r.onclick = () => H.pick(i); r.querySelector('kbd').textContent = 'F' + (i + 2); box.append(r);
    rows.push({ r, fill: r.children[0], inc: r.children[1], wd: r.children[2], t: r.children[3], a: r.children[4].children[0], b: r.children[4].children[1] });
  }
  rows.forEach((w, i) => {
    const u = shown[i];
    sty(w.r, 'display', u ? '' : 'none'); if (!u) return;
    const f = u.dead ? 0 : u.hp / u.maxHp;
    sty(w.fill, 'transform', `scaleX(${f})`);
    sty(w.fill, 'background', f < 0.35 ? '#c0302a' : CLASSES[u.cls].color); sty(w.fill, 'opacity', f < 0.35 ? 1 : 0.62);   // class-coloured, red when low
    let inc = 0;
    if (v.casting && v.casting.target === u) inc = Math.min(1 - f, healEstimate(S, v.casting.spell) / u.maxHp);
    sty(w.inc, 'left', (f * 100) + '%'); sty(w.inc, 'width', (inc * 100) + '%');
    sty(w.wd, 'width', u.ward ? Math.min(100, u.ward.amt / u.maxHp * 100) + '%' : '0');
    if (w.t.textContent !== u.name) txt(w.t, u.name);
    const icons = (u.hots.length ? '❋' : '') + (u.ward ? '◈' : '') + (u.dots && u.dots.length ? '<b style="color:#ff5a4a">●</b>' : '');
    if (w.a.innerHTML !== icons) w.a.innerHTML = icons;
    const pct = u.dead ? 'Dead' : Math.round(f * 100) + '%'; txt(w.b, pct);
    w.r.classList.toggle('sel', v.target === u); w.r.classList.toggle('dead', !!u.dead); w.r.classList.toggle('far', v.distOf(u) > 40);
  });
}
function boss(v) {
  const b = v.boss, box = $('boss');
  sty(box, 'display', b ? 'block' : 'none'); if (!b) return;
  if ($('bname').textContent !== b.name) txt($('bname'), b.name);
  setBar('bhp', b.hp / b.maxHp, Math.round(b.hp / b.maxHp * 100) + '%');
  const c = $('bcast');
  sty(c, 'visibility', b.casting ? 'visible' : 'hidden');
  if (b.casting) { sty(c.firstElementChild, 'width', (b.casting.k * 100) + '%'); txt(c.lastElementChild, b.casting.name); }
}

// Death: "dead" offers Release Spirit; "ghost" says where to run; "body"
// offers Return to Life once you reach your corpse; null hides the panel.
let deathState;
export function death(st) {
  if (st === deathState) return; deathState = st;
  const box = $('death'), b = $('dbtn'); box.style.display = st ? 'block' : 'none';
  document.body.classList.toggle('ghost', st === 'ghost' || st === 'body');
  if (!st) return;
  $('dtext').textContent = st === 'dead' ? 'You have died.' : st === 'ghost' ? 'Run back to your body (the pillar of light).' : 'You have reached your body.';
  b.textContent = st === 'dead' ? 'Release Spirit' : 'Return to Life'; b.disabled = st === 'ghost';
  b.onclick = () => st === 'dead' ? H.release() : H.returnToLife();
  const w = $('wbtn'); w.style.display = st === 'dead' && H.windReady() ? '' : 'none'; w.onclick = () => H.secondWind();
}

// The speed report (js/tour.js): plain text to copy and paste back.
export function speedReport(text) {
  const box = $('speedr');
  if (!text) { box.style.display = 'none'; H.panel(false); return; }
  $('speedt').value = text; box.style.display = 'block'; H.panel(true);
  $('speedc').onclick = () => {
    const t = $('speedt'); t.select();
    const ok = () => { $('speedc').textContent = 'Copied'; setTimeout(() => { $('speedc').textContent = 'Copy'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, () => { document.execCommand('copy'); ok(); }); else { document.execCommand('copy'); ok(); }
  };
  $('speedx').onclick = () => speedReport(null);
}
