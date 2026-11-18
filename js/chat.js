// The chat panel: a log with tabs (All, General, Zone, Party, Combat), a
// chat box (Enter opens it, Enter sends, Esc closes; tap the panel on
// phones) and slash commands. What the commands do lives in main.js.

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const TABS = ['All', 'General', 'Zone', 'Party', 'Combat'];
let log = [], tab = 'All', H = null, S = null, hist = [], histI = -1;

// Which channel a line belongs to, from its colour class and text.
function channel(cls, text) {
  if (cls === 'c-gen') return /^\[General\]/.test(text) ? 'general' : 'zone';
  if (cls === 'c-say' || cls === 'c-emote') return 'zone';
  if (cls === 'c-yell') return / yells: /.test(text) ? 'zone' : 'combat';
  if (cls === 'c-party' || cls === 'c-guild') return 'party';
  if (cls === 'c-heal' || cls === 'c-loot') return 'combat';
  return 'sys';            // system lines and whispers show on every tab
}
const showIn = (ch, t) => ch === 'sys' || t === 'All' || t.toLowerCase() === ch;
const joined = ch => !S || !S.chan || S.chan[ch] !== false;

function add(cls, html, text) {
  const ch = channel(cls, text);
  if ((ch === 'general' || ch === 'zone') && cls === 'c-gen' && !joined(ch)) return;
  log.push({ cls, html, ch });
  if (log.length > 160) log.shift();
  if (showIn(ch, tab)) { const c = $('chat'); const d = document.createElement('div'); d.className = cls; d.innerHTML = html; c.append(d); while (c.children.length > 40) c.firstChild.remove(); }
}
export const chat = (cls, text) => add(cls, esc(text), text);
export const chatHtml = (cls, html) => add(cls, html, html.replace(/<[^>]*>/g, ''));
function redraw() {
  const c = $('chat'); c.innerHTML = '';
  for (const l of log.filter(l => showIn(l.ch, tab)).slice(-40)) { const d = document.createElement('div'); d.className = l.cls; d.innerHTML = l.html; c.append(d); }
  for (const b of $('ctabs').children) b.classList.toggle('on', b.textContent === tab);
}

export function init(state, handlers) {
  S = state; H = handlers;
  const tabs = $('ctabs');
  for (const t of TABS) { const b = document.createElement('b'); b.textContent = t; b.onclick = e => { e.stopPropagation(); tab = t; redraw(); }; tabs.append(b); }
  redraw();
  const box = $('chatin');
  box.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { const v = box.value.trim(); close(); if (v) { hist.push(v); if (hist.length > 30) hist.shift(); send(v); } }
    else if (e.key === 'Escape') { close(); }
    else if (e.key === 'ArrowUp' && hist.length) { histI = histI < 0 ? hist.length - 1 : Math.max(0, histI - 1); box.value = hist[histI]; e.preventDefault(); }
    else if (e.key === 'ArrowDown' && histI >= 0) { histI = Math.min(hist.length, histI + 1); box.value = hist[histI] || ''; e.preventDefault(); }
  });
  box.addEventListener('blur', () => setTimeout(close, 0));
  $('chatwrap').addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && e.target.tagName !== 'B' && e.target.tagName !== 'BUTTON') open(''); });
  $('chat').addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (b) H.act(b.dataset.act); });
}
export const isOpen = () => $('chatwrap').classList.contains('typing');
export function open(start) {
  const box = $('chatin'); $('chatwrap').classList.add('typing'); box.value = start || ''; histI = -1;
  H.opened(); box.focus(); box.setSelectionRange(box.value.length, box.value.length);
}
function close() { const box = $('chatin'); $('chatwrap').classList.remove('typing'); box.value = ''; if (document.activeElement === box) box.blur(); }

const HELP = [
  '/say or /s, /yell or /y: talk to people nearby. Plain text is /say.',
  '/w <name> <text> whispers someone, /r answers the last whisper.',
  '/wave, /cheer, /bow, /dance, /sit (aim them at your target).',
  '/who, or /who <name> to see what they remember. /target <name>.',
  '/roll [max], /fame, /leave general, /join general (also zone), /gquit.',
];
const EMOTES = ['wave', 'cheer', 'bow', 'dance', 'sit', 'laugh', 'thank'];
const ALIAS = { s: 'say', y: 'yell', sh: 'yell', w: 'whisper', tell: 'whisper', t: 'whisper', r: 'reply', g: 'guild', tar: 'target', ty: 'thank', lol: 'laugh', '?': 'help' };

export function send(v) {
  if (v[0] !== '/') return H.say(v, false);
  const m = /^\/(\S+)\s*(.*)$/.exec(v); if (!m) return;
  let cmd = m[1].toLowerCase(); const arg = m[2].trim();
  cmd = ALIAS[cmd] || cmd;
  if (cmd === 'say') return arg && H.say(arg, false);
  if (cmd === 'yell') return arg && H.say(arg, true);
  if (EMOTES.includes(cmd)) return H.emote(cmd, arg);
  if (cmd === 'whisper') { const k = /^(\S+)\s+(.+)$/.exec(arg); return k ? H.whisper(k[1], k[2]) : chat('c-sys', 'Usage: /w <name> <message>'); }
  if (cmd === 'reply') return arg && H.reply(arg);
  if (cmd === 'guild') return arg && H.guild(arg);
  if (cmd === 'who') return H.who(arg);
  if (cmd === 'target') return H.target(arg);
  if (cmd === 'roll') { const n = Math.max(2, Math.min(1e6, parseInt(arg) || 100)); return chat('c-sys', `${S.name} rolls ${1 + Math.floor(Math.random() * n)} (1-${n}).`); }
  if (cmd === 'fame') return H.fame();
  if (cmd === 'gquit') return H.gquit();
  if (cmd === 'accept') return H.act('accept');
  if (cmd === 'leave' || cmd === 'join') {
    const ch = arg.toLowerCase();
    if (ch !== 'general' && ch !== 'zone') return chat('c-sys', `Usage: /${cmd} general (or zone)`);
    S.chan[ch] = cmd === 'join'; H.changed();
    return chat('c-sys', cmd === 'join' ? `Joined channel: ${ch === 'general' ? 'General' : 'Zone'}.` : `Left channel: ${ch === 'general' ? 'General' : 'Zone'}.`);
  }
  if (cmd === 'help') { for (const l of HELP) chat('c-sys', l); return; }
  chat('c-sys', `Unknown command /${cmd}. Type /help for a list.`);
}
