// The hub city of Lanternrest: ground, buildings, the sealed gate, the portal
// court, the airship dock, and the collision shapes for all of it.
// x is east, z is south, y is up. One unit is about a yard.
import * as THREE from 'three';
import { canvasTex, mergeParts, at, SHAPES as SH } from './figure.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';
import { addWater, keepOut } from './water.js';

// A storybook fir: three stacked cones in a unit box (radius 1, height 1).
const firGeo = () => mergeGeometries([[1, 0.55, -0.2], [0.76, 0.5, 0.1], [0.5, 0.42, 0.33]].map(([r, h, y]) => new THREE.ConeGeometry(r, h, 8).translate(0, y, 0).toNonIndexed()));
const FIR = firGeo();

export const WALL_R = 62;
export const colliders = [];   // {x,z,r} circles or {x,z,hw,hd,rot} boxes
export const POI = {};         // named standing spots: {x,z}
export const spots = [];       // places that say something when you walk up
export const mapShapes = [];   // for the minimap
export const ZONE = { x0: -120, x1: 120, z0: -280, z1: -64 };   // Greenhollow, north of the gate
export const CAMPS = [];       // where monsters live: {kind,x,z,r,n}
// Emberdeep, the first dungeon, is built far to the east and reached by portal.
export const DX = 1000;
const R = (x0, z0, x1, z1) => [DX + x0, z0, DX + x1, z1];
export const DUN = {
  rects: [R(-8, -8, 8, 8), R(-3, -30, 3, -6), R(-12, -52, 12, -28), R(10, -43, 36, -37), R(34, -52, 58, -28), R(43, -74, 49, -50), R(34, -96, 58, -72), R(8, -87, 36, -81), R(-28, -102, 10, -66)],
  way: [[0, 2], [0, -25], [0, -40], [31, -40], [46, -40], [46, -69], [46, -84], [13, -84], [-10, -84]].map(([x, z]) => ({ x: DX + x, z })),
  rooms: [{ way: 2, mobs: ['cslime', 'cslime', 'hound'] }, { way: 4, mobs: ['hound', 'hound', 'cslime', 'cslime'] }, { way: 6, mobs: ['hound', 'hound', 'hound', 'cslime'] }, { way: 8, mobs: ['boss'] }],
  exits: [{ x: DX, z: 7.4 }, { x: DX - 27.4, z: -84 }],
  start: { x: DX, z: -1 },
};
// The Shattered Spire, the raid, built further east still: an entry hall, a
// walkway, the Shardwarden's terrace, another walkway, the Hollow Regent's crown.
export const RX = 2000;
const Q = (x0, z0, x1, z1) => [RX + x0, z0, RX + x1, z1];
export const RAID = {
  rects: [Q(-10, -14, 10, 10), Q(-4, -42, 4, -12), Q(-24, -86, 24, -40), Q(-4, -118, 4, -84), Q(-28, -166, 28, -116)],
  way: [[0, -2], [0, -46], [0, -64], [0, -112], [0, -124], [0, -142]].map(([x, z]) => ({ x: RX + x, z })),
  bosses: [{ way: 2, edge: 1 }, { way: 5, edge: 4 }],
  exits: [{ x: RX, z: 9.4 }, { x: RX, z: -164.4 }],
  start: { x: RX, z: -7 },
};
// Which instance a point is in (Emberdeep or the Spire), or null outdoors.
export const instanceAt = x => x > 1500 ? RAID : x > 500 ? DUN : null;
function collideDungeon(p, r) {
  let best = null, bd = 1e9;
  for (const [x0, z0, x1, z1] of instanceAt(p.x).rects) {
    const cx = Math.max(x0 + r, Math.min(x1 - r, p.x)), cz = Math.max(z0 + r, Math.min(z1 - r, p.z)), d = (cx - p.x) ** 2 + (cz - p.z) ** 2;
    if (d < bd) { bd = d; best = [cx, cz]; }
  }
  if (bd > 0) { p.x = best[0]; p.z = best[1]; }
}
export const inGreen = p => p.z < -WALL_R - 1 && Math.hypot(p.x, p.z) > WALL_R;

const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };

export function collide(p, r) {
  if (p.x > 500) return collideDungeon(p, r);
  if (!p.swims) keepOut(p, r);        // only the healer goes into the water
  for (const c of colliders) {
    if (c.r) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
      if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
    } else {
      const cs = Math.cos(c.rot), sn = Math.sin(c.rot), dx = p.x - c.x, dz = p.z - c.z;
      let lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      const ox = c.hw + r - Math.abs(lx), oz = c.hd + r - Math.abs(lz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) lx += ox * Math.sign(lx || 1); else lz += oz * Math.sign(lz || 1);
        p.x = c.x + lx * cs + lz * sn; p.z = c.z - lx * sn + lz * cs;
      }
    }
  }
  // City and Greenhollow join only through the gate passage.
  if (Math.abs(p.x) < 3.3 && p.z < -52 && p.z > -70) return;
  const d = Math.hypot(p.x, p.z);
  if (d < WALL_R) { const lim = WALL_R - 2.2 - r; if (d > lim) { p.x *= lim / d; p.z *= lim / d; } return; }
  const out = WALL_R + 2 + r;
  if (d < out) { p.x *= out / d; p.z *= out / d; }
  p.x = Math.max(ZONE.x0, Math.min(ZONE.x1, p.x)); p.z = Math.max(ZONE.z0, Math.min(ZONE.z1 + 8, p.z));
  if (p.z > -WALL_R && Math.hypot(p.x, p.z) < out) p.z = -Math.sqrt(Math.max(0, out * out - p.x * p.x));
}

export function label(text, sub, size = 5) {
  const t = canvasTex(512, 128, (x, w) => {
    x.textAlign = 'center'; x.lineJoin = 'round'; x.strokeStyle = '#000';
    x.font = '700 46px Cinzel, Georgia, serif'; x.lineWidth = 8; x.strokeText(text, w / 2, 52); x.fillStyle = '#f3c969'; x.fillText(text, w / 2, 52);
    if (sub) { x.font = '28px sans-serif'; x.lineWidth = 6; x.strokeText(sub, w / 2, 100); x.fillStyle = '#ddd'; x.fillText(sub, w / 2, 100); }
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(size * 4, size, 1);
  return s;
}

export function buildWorld(scene) {
  const blockers = [], spin = [];

  // Sky, light, far hills
  scene.background = canvasTex(8, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3f6fb8'); g.addColorStop(0.55, '#9cc4e8'); g.addColorStop(0.75, '#f3dcb0'); g.addColorStop(1, '#f3dcb0');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog(0xcfdbe0, 90, 420);
  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x6a5a40, 1.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.9); sun.position.set(-60, 90, 40); scene.add(sun);
  const sky = scene.background, dark = new THREE.Color(0x140a08);
  const dusk = canvasTex(8, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#120a2a'); g.addColorStop(0.5, '#3a2468'); g.addColorStop(0.75, '#a05a8a'); g.addColorStop(1, '#d88a7a');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  const mood = cave => {             // false outdoors, true in Emberdeep, 'spire' on the raid
    if (cave === 'spire') {
      scene.background = dusk; scene.fog.color.set(0x5a3a7a); scene.fog.near = 60; scene.fog.far = 260;
      hemi.intensity = 1.5; hemi.color.set(0xd8c8ff); sun.intensity = 1.1; return;
    }
    scene.background = cave ? dark : sky; scene.fog.color.set(cave ? 0x140a08 : 0xcfdbe0); scene.fog.near = cave ? 30 : 90; scene.fog.far = cave ? 170 : 420;
    hemi.intensity = cave ? 1.6 : 1.5; hemi.color.set(cave ? 0xffc8a0 : 0xdfeaff); sun.intensity = cave ? 0.5 : 1.9;
  };
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 + 0.2, h = 70 + (i * 53 % 80), r = h * 1.1;
    let d = 260 + (i * 37 % 70);
    // Push each mountain out until its foot clears Greenhollow (with a margin).
    const clear = () => { const x = Math.cos(a) * d, z = Math.sin(a) * d, cx = Math.max(ZONE.x0, Math.min(ZONE.x1, x)), cz = Math.max(ZONE.z0, Math.min(ZONE.z1, z)); return Math.hypot(x - cx, z - cz) > r + 30; };
    while (!clear()) d += 10;
    const m = mesh(new THREE.ConeGeometry(r, h, 5), L(i % 3 ? 0x6f8aa6 : 0x8298b0), Math.cos(a) * d, h / 2 - 4, Math.sin(a) * d);
    m.rotation.y = i; scene.add(m);
  }

  // Ground
  const cob = canvasTex(256, 256, (x, w) => {
    x.fillStyle = '#6f6a60'; x.fillRect(0, 0, w, w);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const v = 120 + ((i * 7 + j * 13) % 5) * 9;
      x.fillStyle = `rgb(${v + 14},${v + 8},${v - 4})`;
      x.beginPath(); x.roundRect(j * 32 + (i % 2 ? 16 : 0) - 14, i * 32 + 2, 28, 28, 7); x.fill();
      x.beginPath(); x.roundRect(j * 32 + (i % 2 ? 16 : 0) - 14 + 256, i * 32 + 2, 28, 28, 7); x.fill();
    }
  });
  cob.wrapS = cob.wrapT = THREE.RepeatWrapping; cob.repeat.set(26, 26);
  const flat = (geo, m, y, x = 0, z = 0) => { const o = mesh(geo, m, x, y, z); o.rotation.x = -Math.PI / 2; o.userData.flat = true; scene.add(o); return o; };   // flat: no shadow cast
  flat(new THREE.CircleGeometry(600, 40), new THREE.MeshLambertMaterial({ map: TX.grass() }), -0.05);
  flat(new THREE.CircleGeometry(WALL_R, 48), new THREE.MeshLambertMaterial({ map: cob }), 0);
  flat(new THREE.RingGeometry(9, 10.5, 40), L(0x8a7a5a), 0.02);

  // City wall, with a gap for the north gate
  const stoneTex = TX.stone(), stone = new THREE.MeshLambertMaterial({ color: 0xd8d2c6, map: stoneTex }), stoneD = new THREE.MeshLambertMaterial({ color: 0xb0aa9e, map: stoneTex });
  const N = 44;
  for (let i = 0; i < N; i++) {
    const a = (i + 0.5) / N * Math.PI * 2;
    const gx = Math.sin(a) * WALL_R, gz = Math.cos(a) * WALL_R;
    if (Math.abs(gx) < 6 && gz < 0) continue;
    const w = mesh(new THREE.BoxGeometry(WALL_R * 2 * Math.PI / N + 0.4, 8, 2.2), i % 2 ? stone : stoneD, gx, 4, gz);
    w.rotation.y = a; scene.add(w);
    const cr = mesh(new THREE.BoxGeometry(3, 1.2, 2.6), stoneD, gx, 8.6, gz); cr.rotation.y = a; scene.add(cr);
  }

  // North gate to the newbie zone: sealed for now
  const gz = -WALL_R + 0.5;
  for (const sx of [-7, 7]) {
    scene.add(mesh(new THREE.CylinderGeometry(3.2, 3.6, 14, 10), stone, sx, 7, gz));
    scene.add(mesh(new THREE.ConeGeometry(4, 5, 10), L(0x8a3a2a), sx, 16.5, gz));
    colliders.push({ x: sx, z: gz, r: 3.6 });
  }
  scene.add(mesh(new THREE.BoxGeometry(11, 4, 3), stoneD, 0, 11, gz));
  const bars = canvasTex(128, 128, (x, w) => {
    x.fillStyle = '#2a2018'; x.fillRect(0, 0, w, w); x.strokeStyle = '#6a6a70'; x.lineWidth = 7;
    for (let i = 8; i < w; i += 20) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, w); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
  });
  // The portcullis is raised: only its lower edge shows under the arch.
  scene.add(mesh(new THREE.PlaneGeometry(8, 1.6), new THREE.MeshLambertMaterial({ map: bars, side: THREE.DoubleSide }), 0, 8.6, gz));
  const gl = label('Greenhollow', 'Novice lands'); gl.position.set(0, 15, gz + 2); scene.add(gl);
  const gl2 = label('Lanternrest', 'City gate'); gl2.position.set(0, 15, gz - 3); scene.add(gl2);
  POI.gate = { x: 0, z: gz + 8 }; POI.gateIn = { x: 0, z: -54 }; POI.gateOut = { x: 0, z: -72 };
  mapShapes.push({ t: 'gate', x: 0, z: gz });

  // Fountain
  const fx = new THREE.Group(); scene.add(fx);
  fx.add(mesh(new THREE.CylinderGeometry(5, 5.3, 0.9, 20), stone, 0, 0.45, 0));
  const water = mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.1, 20), new THREE.MeshLambertMaterial({ color: 0x4fb0d8, emissive: 0x114466 }), 0, 0.9, 0); fx.add(water);
  fx.add(mesh(new THREE.CylinderGeometry(0.6, 0.9, 4, 8), stoneD, 0, 2, 0));
  fx.add(mesh(new THREE.CylinderGeometry(2, 0.6, 0.6, 12), stone, 0, 4.2, 0));
  const lamp = mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshBasicMaterial({ color: 0xffe9a0 }), 0, 5.6, 0); fx.add(lamp); spin.push(lamp);
  colliders.push({ x: 0, z: 0, r: 5.3 }); blockers.push(fx);
  POI.fountain = { x: 0, z: 8 };
  mapShapes.push({ t: 'c', x: 0, z: 0, r: 5, c: '#4fb0d8' });

  // The events board beside the fountain: what is on today.
  const board = new THREE.Group(); board.position.set(-8, 0, 10); board.rotation.y = Math.atan2(8, -10); scene.add(board);
  { const wood = L(0x6a4a2a);
    for (const x of [-1.35, 1.35]) board.add(mesh(new THREE.BoxGeometry(0.18, 3, 0.18), wood, x, 1.5, 0));
    const face = canvasTex(256, 160, (x, w, h) => {
      x.fillStyle = '#b8935a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#6a4a2a'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8);
      x.fillStyle = '#3a2412'; x.font = '700 30px Cinzel, Georgia, serif'; x.textAlign = 'center'; x.fillText('EVENTS', w / 2, 40);
      for (let i = 0; i < 4; i++) { x.fillStyle = ['#f4ecd8', '#efe2c0', '#f6f0e0', '#ece0c4'][i]; const px = 22 + i * 56, py = 56 + (i % 2) * 10; x.fillRect(px, py, 48, 62); x.fillStyle = '#7a6a5a'; for (let j = 0; j < 5; j++) x.fillRect(px + 6, py + 10 + j * 9, 36 - (j % 2) * 10, 3); x.fillStyle = '#c03a2a'; x.beginPath(); x.arc(px + 24, py + 3, 3, 0, 7); x.fill(); }
    });
    board.add(mesh(new THREE.BoxGeometry(2.9, 1.8, 0.12), new THREE.MeshLambertMaterial({ map: face }), 0, 2.05, 0.02));
    const roof = mesh(new THREE.BoxGeometry(3.3, 0.12, 0.8), L(0x7a3a2a), 0, 3.08, 0.1); roof.rotation.x = 0.25; board.add(roof);
    const lb = label('Events Board', '', 2.2); lb.position.set(0, 4, 0); board.add(lb); }
  colliders.push({ x: -8, z: 10, r: 1.4 }); mapShapes.push({ t: 'c', x: -8, z: 10, r: 1.2, c: '#ffd24a' });
  POI.board = { x: -8 + Math.sin(board.rotation.y) * 2.2, z: 10 + Math.cos(board.rotation.y) * 2.2 };

  // Buildings on the diagonals, doors facing the plaza
  const door = canvasTex(64, 128, (x) => {
    x.fillStyle = '#4a2f18'; x.fillRect(0, 0, 64, 128); x.strokeStyle = '#2a1a0c'; x.lineWidth = 3;
    for (let i = 0; i < 64; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); }
    x.fillStyle = '#d8b45a'; x.beginPath(); x.arc(50, 70, 4, 0, 7); x.fill();
  });
  const win = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const timberTex = TX.timber(), shingleTex = TX.shingles(); timberTex.repeat.set(2, 1);
  const frame = L(0x4a3220);
  const building = (key, name, sub, x, z, w, d, h, wall, roof, msg) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z); scene.add(g);
    const b = mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: wall, map: timberTex }), 0, h / 2, 0); g.add(b); blockers.push(b);
    g.add(mesh(new THREE.BoxGeometry(w + 0.3, 0.9, d + 0.3), stoneD, 0, 0.45, 0));
    const r = mesh(new THREE.ConeGeometry(0.75, 1, 4), new THREE.MeshLambertMaterial({ color: roof, map: shingleTex }), 0, h + 2.5, 0); r.rotation.y = Math.PI / 4; r.scale.set(w * 1.08, 5, d * 1.08); g.add(r);
    g.add(mesh(new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4), L(0x5a4630), 0, h * 0.5, 0));
    g.add(mesh(new THREE.PlaneGeometry(2.4, 4), new THREE.MeshLambertMaterial({ map: door }), 0, 2, d / 2 + 0.03));
    g.add(mesh(new THREE.BoxGeometry(2.9, 4.4, 0.12), frame, 0, 2.15, d / 2));
    for (const sx of [-w * 0.3, w * 0.3]) for (const [wy, wh] of [[2.6, 1.8], [h * 0.75, 1.6]]) {
      g.add(mesh(new THREE.BoxGeometry(2, wh + 0.4, 0.1), frame, sx, wy, d / 2));
      g.add(mesh(new THREE.PlaneGeometry(1.6, wh), win, sx, wy, d / 2 + 0.06));
      g.add(mesh(new THREE.BoxGeometry(0.1, wh, 0.06), frame, sx, wy, d / 2 + 0.08));
      g.add(mesh(new THREE.BoxGeometry(2.2, 0.16, 0.4), frame, sx, wy - wh / 2 - 0.25, d / 2 + 0.15));
    }
    g.add(mergeParts([[SH.box(2, 0.4, 0.45), 0x7a5434, at(-w * 0.3, 1.25, d / 2 + 0.3)], [SH.box(2, 0.4, 0.45), 0x7a5434, at(w * 0.3, 1.25, d / 2 + 0.3)],
      ...[-0.75, -0.35, 0.05, 0.45, 0.8].flatMap((o, i) => [-w * 0.3, w * 0.3].map(sx => [SH.sph(0.2, 6, 4), [0xe85a7a, 0xffd24a, 0xf2f2ff, 0xb070e0, 0xff8a3a][(i + (sx > 0 ? 2 : 0)) % 5], at(sx + o, 1.55, d / 2 + 0.32)]))]));
    g.add(mesh(new THREE.BoxGeometry(1.2, 3, 1.2), L(0x6a5a50), w * 0.3, h + 3.5, 0));
    const lb = label(name, sub, 3.4); lb.position.set(0, h + 1, d / 2 + 1.5); g.add(lb);
    colliders.push({ x, z, hw: w / 2, hd: d / 2, rot: g.rotation.y });
    const n = Math.hypot(x, z), ux = -x / n, uz = -z / n;
    POI[key] = { x: x + ux * (d / 2 + 2.5), z: z + uz * (d / 2 + 2.5) };
    spots.push({ x: x + ux * (d / 2 + 1), z: z + uz * (d / 2 + 1), r: 2.6, msg });
    mapShapes.push({ t: 'b', x, z, w, d, rot: g.rotation.y, c: '#' + roof.toString(16).padStart(6, '0') });
  };
  building('inn', 'The Gilded Kettle', 'Inn', -30, -30, 18, 12, 9, 0xd8c8a0, 0x9a4a2a, 'The inn door is locked. A sign reads: "Back soon."');
  building('bank', 'Lanternrest Vault', 'Bank', 30, -30, 16, 12, 10, 0xc8c8cc, 0x4a5a7a, 'The vault is closed for counting.');
  building('auction', 'Auction Hall', 'Trade', 32, 30, 18, 13, 9, 0xd0b890, 0x6a7a3a, 'The auctioneers are on a break.');
  building('guild', 'Guild Hall', 'Charters and banners', -32, 30, 18, 13, 10, 0xb8a898, 0x6a2a5a, 'Guild business only. You have no guild. Yet.');

  // Portal court on the west side
  const swirl = col => canvasTex(128, 128, (x, w) => {
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, '#fff'); g.addColorStop(0.3, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3;
    for (let k = 0; k < 4; k++) { x.beginPath(); for (let a = 0; a < 5; a += 0.1) { const r = a * 11, t = a + k * 1.57; x.lineTo(64 + Math.cos(t) * r, 64 + Math.sin(t) * r); } x.stroke(); }
  });
  const portal = (key, name, sub, x, z, col, msg) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z * 0.3); scene.add(g);
    for (const sx of [-2.4, 2.4]) g.add(mesh(new THREE.BoxGeometry(1.2, 7, 1.2), stoneD, sx, 3.5, 0));
    g.add(mesh(new THREE.BoxGeometry(7, 1.2, 1.4), stone, 0, 7.4, 0));
    const p = mesh(new THREE.CircleGeometry(2.9, 20), new THREE.MeshBasicMaterial({ map: swirl(col), transparent: true, side: THREE.DoubleSide, depthWrite: false }), 0, 3.4, 0);
    p.scale.y = 1.15; g.add(p); spin.push(p);
    g.add(mesh(new THREE.CylinderGeometry(4, 4.3, 0.3, 16), stone, 0, 0.15, 0));
    const lb = label(name, sub, 3); lb.position.set(0, 9.4, 0); g.add(lb);
    const n = Math.hypot(x, z * 0.3), ux = -x / n, uz = -z * 0.3 / n;
    POI[key] = { x: x + ux * 3, z: z + uz * 3, px: x, pz: z };
    if (key === 'pvp') spots.push({ x, z, r: 2.5, msg });
    mapShapes.push({ t: 'c', x, z, r: 2.5, c: col });
  };
  portal('dungeon', 'Emberdeep', 'Dungeon', -47, -15, '#ff7a2a', 'The portal hums, but does not take you. You are not attuned to Emberdeep yet.');
  portal('raid', 'The Shattered Spire', 'Raid', -52, 0, '#b05aff', 'Forty heroes went in here an hour ago. You are not attuned yet.');
  portal('pvp', 'Bloodsand Pit', 'Battleground', -47, 15, '#ff3a4a', 'You hear cheering on the other side. You are not attuned yet.');

  // Airship dock on the east side
  const dock = new THREE.Group(); dock.position.set(48, 0, 0); scene.add(dock);
  const tower = mesh(new THREE.CylinderGeometry(2.6, 3.2, 11, 10), L(0x8a6a48), 0, 5.5, 0); dock.add(tower); blockers.push(tower);
  dock.add(mesh(new THREE.CylinderGeometry(6, 6, 0.5, 14), L(0x6b4a2a), 0, 11.2, 0));
  dock.add(mesh(new THREE.PlaneGeometry(1.8, 3.2), new THREE.MeshLambertMaterial({ map: door }), -3.0, 1.6, 0)).rotation.y = -Math.PI / 2;
  const dl = label('Skydock', 'Airships to far places', 3.2); dl.position.set(0, 14.5, 0); dock.add(dl);
  colliders.push({ x: 48, z: 0, r: 3.3 });
  POI.dock = { x: 42.5, z: 0 };
  spots.push({ x: 44, z: 0, r: 2.5, msg: 'The dockmaster waves you off: "No ticket, no boarding." Tickets are not sold yet.' });
  mapShapes.push({ t: 'c', x: 48, z: 0, r: 3.2, c: '#8a6a48' });

  const ship = new THREE.Group(); scene.add(ship);
  const hull = mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), L(0x6b4226), 0, 0, 0); hull.scale.set(7, 2.6, 2.4); ship.add(hull);
  ship.add(mesh(new THREE.BoxGeometry(13, 0.3, 4.4), L(0x8a6a48), 0, 0, 0));
  const bal = mesh(new THREE.SphereGeometry(1, 14, 10), L(0xd8452a), 0, 6.4, 0); bal.scale.set(8, 3.2, 3.2); ship.add(bal);
  const band = mesh(new THREE.SphereGeometry(1.01, 14, 10, 0, Math.PI * 2, 1.2, 0.74), L(0xf2e2b8), 0, 6.4, 0); band.scale.set(8, 3.2, 3.2); ship.add(band);
  for (const sx of [-4.5, 0, 4.5]) for (const sz of [-1.9, 1.9]) ship.add(mesh(new THREE.BoxGeometry(0.1, 4.2, 0.1), L(0x33261a), sx, 2.2, sz));
  const prop = mesh(new THREE.BoxGeometry(0.2, 3.4, 0.5), L(0x2a2a2a), -7.4, -0.6, 0); ship.add(prop);
  const state = { docked: false, t: 0 };
  const A = new THREE.Vector3(190, 60, -90), D = new THREE.Vector3(57, 12.6, 0), B = new THREE.Vector3(170, 70, 130);
  const ease = k => k * k * (3 - 2 * k);
  const SHIP_PERIOD = 85;

  // Duelling ring and training dummies, south
  { const t = TX.dirt(); t.repeat.set(3, 3); flat(new THREE.CircleGeometry(9, 28), new THREE.MeshLambertMaterial({ color: 0xe8d8b0, map: t }), 0.03, 0, 40); }
  flat(new THREE.RingGeometry(9, 9.6, 32), stoneD, 0.035, 0, 40);
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; scene.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.1, 6), L(0x6b4a2a), Math.sin(a) * 9.4, 0.55, 40 + Math.cos(a) * 9.4)); }
  const dul = label('Duelling Ring', '', 3); dul.position.set(0, 5.5, 49); scene.add(dul);
  POI.ring = { x: 0, z: 40 };
  mapShapes.push({ t: 'c', x: 0, z: 40, r: 9, c: '#d8c08a' });
  POI.dummies = [];
  for (const [x, z] of [[20, 44], [24, 40], [17, 48]]) {
    scene.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.8, 6), L(0x6b4a2a), x, 0.9, z));
    scene.add(mesh(new THREE.BoxGeometry(0.9, 0.9, 0.5), L(0xc8a860), x, 1.5, z));
    scene.add(mesh(new THREE.SphereGeometry(0.32, 8, 6), L(0xc8a860), x, 2.25, z));
    colliders.push({ x, z, r: 0.5 });
    POI.dummies.push({ x: x - 1.1, z: z - 1.1, fx: x, fz: z });
  }

  // Market stalls, lamps, trees
  POI.stalls = [];
  [[14, -12, 0xd84a3a], [-15, -11, 0x3a7ad8], [16, 13, 0xd8b03a], [-14, 14, 0x4aa84a]].forEach(([x, z, c]) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z); scene.add(g);
    g.add(mesh(new THREE.BoxGeometry(3.6, 1.1, 1.6), L(0x7a5a38), 0, 0.55, 0));
    for (const sx of [-1.7, 1.7]) g.add(mesh(new THREE.BoxGeometry(0.15, 3, 0.15), L(0x5a4028), sx, 1.5, -0.7));
    const aw = mesh(new THREE.BoxGeometry(4.2, 0.15, 2.6), L(c), 0, 3, 0.1); aw.rotation.x = 0.25; g.add(aw);
    colliders.push({ x, z, r: 2 });
    const n = Math.hypot(x, z); POI.stalls.push({ x: x - x / n * 3, z: z - z / n * 3 });
    mapShapes.push({ t: 'c', x, z, r: 1.8, c: '#' + c.toString(16) });
  });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * 6.283 + 0.39, x = Math.sin(a) * 23, z = Math.cos(a) * 23;
    scene.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 4, 6), L(0x33333a), x, 2, z));
    scene.add(mesh(new THREE.SphereGeometry(0.36, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd98a }), x, 4.2, z));
    colliders.push({ x, z, r: 0.3 });
  }
  const leaf = [L(0x3f7a34), L(0x4f8a3a), L(0x6a9a3a)];
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * 6.283 + 0.14, x = Math.sin(a) * 55, z = Math.cos(a) * 55;
    if ((Math.abs(x) < 10 && z < 0) || (x > 38 && Math.abs(z) < 10) || (x < -38 && Math.abs(z) < 24)) continue;
    const h = 5 + (i * 7 % 4);
    scene.add(mesh(new THREE.CylinderGeometry(0.4, 0.55, 3, 6), L(0x5a4028), x, 1.5, z));
    const f = mesh(FIR, leaf[i % 3], x, 2.6 + h / 2, z); f.scale.set(2.8, h * 1.1, 2.8); f.rotation.y = i; scene.add(f);
    colliders.push({ x, z, r: 0.7 });
  }
  for (let i = 0; i < 40; i++) {
    const a = i * 2.4, d = 80 + (i * 41 % 130), h = 7 + (i % 5);
    if (Math.cos(a) * d < -50 && Math.abs(Math.sin(a) * d) < 135) continue;
    const f = mesh(FIR, leaf[i % 3], Math.sin(a) * d, h / 2 + 1, Math.cos(a) * d); f.scale.set(3.6, h * 1.1, 3.6); scene.add(f);
  }

  // Props: one merged mesh for all the small things that make the town lived in.
  const P = [], wood = 0x7a5434, dk = 0x4a3220;
  const barrel = (x, z) => { P.push([SH.cyl(0.42, 0.42, 1.05, 10), wood, at(x, 0.53, z)], [SH.cyl(0.44, 0.44, 0.08, 10), dk, at(x, 0.2, z)], [SH.cyl(0.44, 0.44, 0.08, 10), dk, at(x, 0.86, z)]); colliders.push({ x, z, r: 0.5 }); };
  const crate = (x, z, s = 0.9, ry = 0) => { P.push([SH.box(s, s, s), 0xa07a4a, at(x, s / 2, z, 0, ry)], [SH.box(s + 0.04, 0.1, s + 0.04), dk, at(x, s - 0.05, z, 0, ry)]); colliders.push({ x, z, r: s * 0.6 }); };
  const bench = (a) => { const x = Math.sin(a) * 12.5, z = Math.cos(a) * 12.5;
    P.push([SH.box(3, 0.14, 0.7), wood, at(x, 0.55, z, 0, a)], [SH.box(3, 0.6, 0.12), wood, at(x - Math.sin(a) * 0.32, 0.95, z - Math.cos(a) * 0.32, 0, a)]);
    for (const o of [-1.2, 1.2]) P.push([SH.box(0.14, 0.55, 0.6), dk, at(x + Math.cos(a) * o, 0.27, z - Math.sin(a) * o, 0, a)]);
    colliders.push({ x, z, r: 1.2 }); };
  const planter = (x, z) => { P.push([SH.cyl(0.9, 0.75, 0.7, 10), 0xb0aa9e, at(x, 0.35, z)], [SH.sph(0.8, 10, 6), 0x4f8a3a, at(x, 0.85, z, 0, 0, 0, 1, 0.6, 1)]);
    for (let k = 0; k < 6; k++) P.push([SH.sph(0.16, 6, 4), [0xe85a7a, 0xffd24a, 0xf2f2ff][k % 3], at(x + Math.sin(k) * 0.5, 1.15, z + Math.cos(k) * 0.5)]);
    colliders.push({ x, z, r: 1 }); };
  [0.6, 2.2, 3.9, 5.5].forEach(bench);
  [[-10, -5], [10, 5], [-6, 10.5], [6, -10.5]].forEach(([x, z]) => planter(x, z));
  [[-22, -20], [-23.2, -19], [-21, -18.6], [23, 21], [24.2, 19.6]].forEach(([x, z]) => barrel(x, z));
  [[24, -21, 1], [25.2, -20.6, 0.7], [-25, 22, 1], [-24, 23.3, 0.8], [18.5, 17, 0.8], [-18, -16, 0.8]].forEach(([x, z, s], i) => crate(x, z, s, i));
  // Guild banners on poles flanking the plaza's south road
  for (const [x, c] of [[-6, 0x6a2a5a], [6, 0x2a4a8a]]) P.push([SH.cyl(0.1, 0.12, 6, 6), dk, at(x, 3, 30)], [SH.box(1.4, 2.6, 0.06), c, at(x, 4.4, 30.1)], [SH.box(1.4, 0.2, 0.08), 0xd8b45a, at(x, 3.15, 30.12)], [SH.sph(0.16, 6, 4), 0xd8b45a, at(x, 6.1, 30)]);
  colliders.push({ x: -6, z: 30, r: 0.3 }, { x: 6, z: 30, r: 0.3 });
  scene.add(mergeParts(P));

  const zone = buildZone(scene, { L, mesh, flat, leaf, stone, stoneD });

  function update(dt, t) {
    zone.update(dt, t);
    for (const s of spin) s.rotation[s.geometry.type === 'CircleGeometry' ? 'z' : 'y'] += dt * 0.8;
    const k = (t + 12) % SHIP_PERIOD;   // 0-22 arrive, 22-52 docked, 52-74 leave, then away
    let was = state.docked; state.docked = k >= 22 && k < 52;
    ship.visible = k < 74;
    if (k < 22) { ship.position.lerpVectors(A, D, ease(k / 22)); ship.rotation.y = 0; }
    else if (k < 52) { ship.position.copy(D); ship.position.y += Math.sin(t * 1.3) * 0.25; }
    else { ship.position.lerpVectors(D, B, ease((k - 52) / 22)); ship.rotation.y = -ease(Math.min(1, (k - 52) / 8)) * 1.9; }
    prop.rotation.x += dt * 14;
    state.arrived = state.docked && !was; state.left = !state.docked && was;
  }
  return { update, ship: state, blockers, mood, board, lights: { hemi, sun } };
}

// Greenhollow: the novice lands outside the north gate. A road, a quest camp,
// a pond, a farm, a wood, a bog and a ruined watchtower.
function buildZone(scene, { L, mesh, flat, leaf, stone, stoneD }) {
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const road = [[0, -62], [0, -96], [-18, -130], [-8, -175], [24, -212], [6, -262]];
  const dirtTex = TX.dirt();
  for (let i = 0; i < road.length - 1; i++) {
    const [ax, az] = road[i], [bx, bz] = road[i + 1], len = Math.hypot(bx - ax, bz - az);
    const t = dirtTex.clone(); t.repeat.set(1, (len + 4) / 6); t.needsUpdate = true;
    const m = mesh(new THREE.BoxGeometry(5.5, 0.04, len + 4), new THREE.MeshLambertMaterial({ map: t }), (ax + bx) / 2, 0.01, (az + bz) / 2);
    m.rotation.y = Math.atan2(bx - ax, bz - az); scene.add(m);
  }
  mapShapes.push({ t: 'zone' }, { t: 'road', pts: road });
  const nearRoad = (x, z, d) => road.some(([rx, rz], i) => {
    if (!i) return false; const [ax, az] = road[i - 1], k = Math.max(0, Math.min(1, ((x - ax) * (rx - ax) + (z - az) * (rz - az)) / ((rx - ax) ** 2 + (rz - az) ** 2)));
    return Math.hypot(x - ax - k * (rx - ax), z - az - k * (rz - az)) < d;
  });

  // Quest camp just outside the gate
  for (const [x, z, c] of [[14, -84, 0xc8b078], [19, -93, 0xa85a3a]]) {
    const t = mesh(new THREE.ConeGeometry(3.4, 4.2, 4), L(c), x, 2.1, z); t.rotation.y = 0.6; scene.add(t); colliders.push({ x, z, r: 2.6 });
  }
  scene.add(mesh(new THREE.CylinderGeometry(0.9, 1, 0.3, 8), stoneD, 9, 0.15, -90));
  const fire = mesh(new THREE.ConeGeometry(0.45, 1.3, 6), new THREE.MeshBasicMaterial({ color: 0xff9a30 }), 9, 0.9, -90); scene.add(fire);
  colliders.push({ x: 9, z: -90, r: 1 });
  scene.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 6, 5), L(0x5a4028), 6, 3, -82)); scene.add(mesh(new THREE.BoxGeometry(0.1, 1.6, 2.2), L(0x3a8a4a), 6, 5, -80.9));
  POI.camp = { x: 6, z: -87 }; POI.warden = { x: 9.5, z: -85.5 };
  mapShapes.push({ t: 'c', x: 9, z: -88, r: 3, c: '#ffd24a' });

  // Pond
  addWater(scene, { name: 'the pond', x: -66, z: -138, r: 16, wade: 4.5, fish: true }, mapShapes);

  // Farm
  { const g = new THREE.Group(); g.position.set(74, 0, -108); g.rotation.y = -0.5; scene.add(g);
    g.add(mesh(new THREE.BoxGeometry(11, 6, 8), L(0xc8a878), 0, 3, 0));
    const r = mesh(new THREE.ConeGeometry(0.75, 1, 4), L(0x7a4a2a), 0, 7.6, 0); r.rotation.y = Math.PI / 4; r.scale.set(12, 3.4, 9); g.add(r);
    colliders.push({ x: 74, z: -108, hw: 5.5, hd: 4, rot: -0.5 }); mapShapes.push({ t: 'b', x: 74, z: -108, w: 11, d: 8, rot: -0.5, c: '#7a4a2a' }); }
  for (const [x, z] of [[52, -128], [70, -146]]) {
    flat(new THREE.PlaneGeometry(22, 16), L(0x7a5a38), 0.025, x, z);
    for (let i = -3; i <= 3; i++) flat(new THREE.PlaneGeometry(20, 0.9), L(0x8ab04a), 0.05, x, z + i * 2.1);
    scene.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 5), L(0x5a4028), x, 1.3, z)); scene.add(mesh(new THREE.BoxGeometry(2, 0.9, 0.3), L(0xb8743a), x, 1.9, z)); scene.add(mesh(new THREE.SphereGeometry(0.4, 6, 5), L(0xd8c08a), x, 2.8, z));
  }
  // Bog
  flat(new THREE.CircleGeometry(24, 24), L(0x4a6a3a), 0.02, 62, -224); flat(new THREE.CircleGeometry(9, 16), L(0x3a5a4a), 0.03, 68, -230); flat(new THREE.CircleGeometry(6, 14), L(0x3a5a4a), 0.03, 52, -216);
  mapShapes.push({ t: 'c', x: 62, z: -224, r: 24, c: '#4a6a3a' });
  // Ruined watchtower
  { const t = mesh(new THREE.CylinderGeometry(4.5, 5.2, 9, 10, 1, true, 0, 4.4), new THREE.MeshLambertMaterial({ color: 0x8a847a, side: THREE.DoubleSide }), -22, 4.5, -258); scene.add(t);
    for (let i = 0; i < 7; i++) { const s = mesh(new THREE.BoxGeometry(1.6, 1.1, 1.3), i % 2 ? stone : stoneD, -22 + (rnd() - 0.5) * 18, 0.5, -258 + (rnd() - 0.5) * 16); s.rotation.set(rnd(), rnd() * 3, rnd()); scene.add(s); }
    colliders.push({ x: -22, z: -258, r: 5.4 }); mapShapes.push({ t: 'c', x: -22, z: -258, r: 5, c: '#8a847a' });
    const lb = label('Old Watchtower', '', 3); lb.position.set(-22, 12, -258); scene.add(lb); }

  CAMPS.push({ kind: 'slime', x: -30, z: -100, r: 18, n: 4 }, { kind: 'boar', x: 58, z: -138, r: 24, n: 6 }, { kind: 'wolf', x: -52, z: -200, r: 28, n: 6 },
    { kind: 'slime', x: 62, z: -224, r: 20, n: 5 }, { kind: 'boar', x: 4, z: -150, r: 14, n: 2 }, { kind: 'tusk', x: 2, z: -246, r: 9, n: 1 });

  // Trees (instanced) and the hills that close the valley in
  const spotsT = [];
  for (let i = 0; i < 400 && spotsT.length < 110; i++) {
    const wood = i % 3 === 0, x = wood ? -52 + (rnd() - 0.5) * 80 : ZONE.x0 + rnd() * 240, z = wood ? -205 + (rnd() - 0.5) * 80 : ZONE.z0 + rnd() * 205;
    if (x < ZONE.x0 + 2 || x > ZONE.x1 - 2 || z < ZONE.z0 + 2 || z > -72 || Math.hypot(x, z) < WALL_R + 8 || nearRoad(x, z, 7)) continue;
    if (Math.hypot(x + 66, z + 138) < 19 || Math.hypot(x - 9, z + 88) < 16 || Math.hypot(x - 62, z + 136) < 26 || Math.hypot(x - 74, z + 108) < 9 || Math.hypot(x - 2, z + 246) < 10) continue;
    if (spotsT.some(t => Math.hypot(t.x - x, t.z - z) < 4)) continue;
    spotsT.push({ x, z, h: 5 + rnd() * 5, bog: Math.hypot(x - 62, z + 224) < 24 });
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.55, 3, 6), L(0x5a4028), spotsT.length);
  const tops = new THREE.InstancedMesh(FIR, new THREE.MeshLambertMaterial({ color: 0xffffff }), spotsT.length);
  const M = new THREE.Matrix4(), col = new THREE.Color();
  spotsT.forEach((t, i) => {
    M.makeTranslation(t.x, 1.5, t.z); trunks.setMatrixAt(i, M);
    M.makeScale(2.2 + t.h * 0.12, t.bog ? 1.5 : t.h, 2.2 + t.h * 0.12); M.setPosition(t.x, 3 + (t.bog ? 0.75 : t.h / 2), t.z); tops.setMatrixAt(i, M);
    tops.setColorAt(i, col.set(t.bog ? 0x5a5a3a : [0x3f7a34, 0x4f8a3a, 0x2f6a34][i % 3]));
    colliders.push({ x: t.x, z: t.z, r: 0.7 });
  });
  scene.add(trunks, tops);
  const hills = [];
  for (let x = ZONE.x0 - 10; x <= ZONE.x1 + 10; x += 26) hills.push([x, ZONE.z0 - 22]);
  for (let z = ZONE.z0; z <= -70; z += 26) { if (z < -95) hills.push([ZONE.x0 - 22, z], [ZONE.x1 + 22, z]); else hills.push([ZONE.x0 - 26, z], [ZONE.x1 + 26, z]); }
  const hm = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), L(0x5f8a48), hills.length);
  hills.forEach(([x, z], i) => { const h = 22 + rnd() * 18; M.makeScale(24, h, 24); M.setPosition(x + (rnd() - 0.5) * 8, h / 2 - 2, z); hm.setMatrixAt(i, M); });
  scene.add(hm);
  for (let i = 0; i < 14; i++) {
    const x = ZONE.x0 + rnd() * 240, z = ZONE.z0 + rnd() * 200; if (Math.hypot(x, z) < WALL_R + 6 || nearRoad(x, z, 5) || Math.hypot(x + 66, z + 138) < 18) continue;
    const s = 0.8 + rnd() * 1.4, k = mesh(new THREE.DodecahedronGeometry(s), i % 2 ? stone : stoneD, x, s * 0.5, z); k.rotation.set(rnd() * 3, rnd() * 3, 0); scene.add(k); colliders.push({ x, z, r: s });
  }
  // Grass tufts: one instanced mesh, kept out of the shadow pass for speed.
  const blade = mergeGeometries([-0.5, 0, 0.5].map((a, i) => new THREE.ConeGeometry(0.07, 0.6 - i * 0.1, 3).rotateZ(a * 0.5).translate(Math.sin(a) * 0.12, 0.28, (i - 1) * 0.05).toNonIndexed()));
  const tufts = [];
  for (let i = 0; i < 6000 && tufts.length < 2600; i++) {
    const x = ZONE.x0 + rnd() * 240, z = ZONE.z0 + rnd() * 212;
    if (Math.hypot(x, z) < WALL_R + 3 || nearRoad(x, z, 3.5) || Math.hypot(x + 66, z + 138) < 17 || (Math.abs(x - 61) < 12 && Math.abs(z + 137) < 9) || (Math.abs(x - 71) < 12 && Math.abs(z + 147) < 9)) continue;
    tufts.push([x, z]);
  }
  const tm = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ color: 0xffffff }), tufts.length);
  tufts.forEach(([x, z], i) => { const s = 0.7 + rnd() * 0.9; M.makeScale(s, s * (0.8 + rnd() * 0.6), s); M.setPosition(x, 0, z); tm.setMatrixAt(i, M); tm.setColorAt(i, col.setHSL(0.22 + rnd() * 0.07, 0.55, 0.2 + rnd() * 0.1)); });
  tm.userData.looked = true; tm.receiveShadow = true; scene.add(tm);
  return { update(dt, t) { fire.scale.y = 1 + Math.sin(t * 13) * 0.18; fire.rotation.y += dt * 4; } };
}
