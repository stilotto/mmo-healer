// The hub city of Lanternrest: ground, buildings, the sealed gate, the portal
// court, the airship dock, and the collision shapes for all of it.
// x is east, z is south, y is up. One unit is about a yard.
import * as THREE from 'three';
import { canvasTex } from './figure.js';

export const WALL_R = 62;
export const colliders = [];   // {x,z,r} circles or {x,z,hw,hd,rot} boxes
export const POI = {};         // named standing spots: {x,z}
export const spots = [];       // places that say something when you walk up
export const mapShapes = [];   // for the minimap

const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };

export function collide(p, r) {
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
  const d = Math.hypot(p.x, p.z), lim = WALL_R - 2.2 - r;
  if (d > lim) { p.x *= lim / d; p.z *= lim / d; }
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
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x6a5a40, 1.5));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.9); sun.position.set(-60, 90, 40); scene.add(sun);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 + 0.2, d = 260 + (i * 37 % 70), h = 70 + (i * 53 % 80);
    const m = mesh(new THREE.ConeGeometry(h * 1.1, h, 5), L(i % 3 ? 0x6f8aa6 : 0x8298b0), Math.cos(a) * d, h / 2 - 4, Math.sin(a) * d);
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
  const flat = (geo, m, y, x = 0, z = 0) => { const o = mesh(geo, m, x, y, z); o.rotation.x = -Math.PI / 2; scene.add(o); return o; };
  flat(new THREE.CircleGeometry(600, 40), L(0x6f9a4a), -0.05);
  flat(new THREE.CircleGeometry(WALL_R, 48), new THREE.MeshLambertMaterial({ map: cob }), 0);
  flat(new THREE.RingGeometry(9, 10.5, 40), L(0x8a7a5a), 0.02);

  // City wall, with a gap for the north gate
  const stone = L(0x9a948a), stoneD = L(0x7d776e);
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
  scene.add(mesh(new THREE.PlaneGeometry(8, 9), new THREE.MeshLambertMaterial({ map: bars }), 0, 4.5, gz + 1));
  colliders.push({ x: 0, z: gz, hw: 5, hd: 1.6, rot: 0 });
  const gl = label('Greenhollow', 'Novice lands · gate sealed'); gl.position.set(0, 15, gz + 2); scene.add(gl);
  POI.gate = { x: 0, z: gz + 6 };
  spots.push({ x: 0, z: gz + 3, r: 5, msg: 'The gate to Greenhollow is barred. The novice lands are not open yet.' });
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

  // Buildings on the diagonals, doors facing the plaza
  const door = canvasTex(64, 128, (x) => {
    x.fillStyle = '#4a2f18'; x.fillRect(0, 0, 64, 128); x.strokeStyle = '#2a1a0c'; x.lineWidth = 3;
    for (let i = 0; i < 64; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); }
    x.fillStyle = '#d8b45a'; x.beginPath(); x.arc(50, 70, 4, 0, 7); x.fill();
  });
  const win = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const building = (key, name, sub, x, z, w, d, h, wall, roof, msg) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z); scene.add(g);
    const b = mesh(new THREE.BoxGeometry(w, h, d), L(wall), 0, h / 2, 0); g.add(b); blockers.push(b);
    const r = mesh(new THREE.ConeGeometry(0.75, 1, 4), L(roof), 0, h + 2.5, 0); r.rotation.y = Math.PI / 4; r.scale.set(w * 1.08, 5, d * 1.08); g.add(r);
    g.add(mesh(new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4), L(0x5a4630), 0, h * 0.5, 0));
    g.add(mesh(new THREE.PlaneGeometry(2.4, 4), new THREE.MeshLambertMaterial({ map: door }), 0, 2, d / 2 + 0.03));
    for (const sx of [-w * 0.3, w * 0.3]) { g.add(mesh(new THREE.PlaneGeometry(1.6, 1.8), win, sx, 2.6, d / 2 + 0.03)); g.add(mesh(new THREE.PlaneGeometry(1.6, 1.6), win, sx, h * 0.75, d / 2 + 0.03)); }
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
    spots.push({ x, z, r: 2.5, msg });
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
  flat(new THREE.CircleGeometry(9, 28), L(0xd8c08a), 0.03, 0, 40);
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
    scene.add(mesh(new THREE.ConeGeometry(2.6, h, 7), leaf[i % 3], x, 3 + h / 2, z));
    colliders.push({ x, z, r: 0.7 });
  }
  for (let i = 0; i < 40; i++) {
    const a = i * 2.4, d = 80 + (i * 41 % 130), h = 7 + (i % 5);
    scene.add(mesh(new THREE.ConeGeometry(3.4, h, 6), leaf[i % 3], Math.sin(a) * d, h / 2 + 1, Math.cos(a) * d));
  }

  function update(dt, t) {
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
  return { update, ship: state, blockers };
}
