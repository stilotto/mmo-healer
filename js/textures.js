// Textures painted in code at start-up (no image files). Most are pale and
// greyish so one texture can be tinted per building by the material colour.
import * as THREE from 'three';
import { canvasTex } from './figure.js';

let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const tile = (t, rx = 1, ry = 1) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };
const speckle = (x, w, h, n, a, cols) => { for (let i = 0; i < n; i++) { x.globalAlpha = a * rnd(); x.fillStyle = cols[i % cols.length]; x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } x.globalAlpha = 1; };

// Grass with darker patches, lighter blades and a few flowers.
export const grass = () => tile(canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#6f9a48'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { x.globalAlpha = 0.18; x.fillStyle = rnd() < 0.5 ? '#557a34' : '#88b05a'; x.beginPath(); x.ellipse(rnd() * w, rnd() * h, 12 + rnd() * 30, 8 + rnd() * 20, rnd() * 3, 0, 7); x.fill(); }
  x.globalAlpha = 0.5; x.strokeStyle = '#9cc466'; x.lineWidth = 1;
  for (let i = 0; i < 700; i++) { const a = rnd() * w, b = rnd() * h; x.beginPath(); x.moveTo(a, b); x.lineTo(a + (rnd() - 0.5) * 3, b - 3 - rnd() * 4); x.stroke(); }
  x.globalAlpha = 1;
  for (let i = 0; i < 14; i++) { x.fillStyle = ['#fff6d0', '#ffd24a', '#e88ad0', '#ffffff'][i % 4]; x.beginPath(); x.arc(rnd() * w, rnd() * h, 1.6, 0, 7); x.fill(); }
}), 120, 120);

// Packed dirt for roads.
export const dirt = () => tile(canvasTex(128, 128, (x, w, h) => {
  x.fillStyle = '#b39a68'; x.fillRect(0, 0, w, h); speckle(x, w, h, 500, 0.5, ['#8a744a', '#cbb488', '#9a8458']);
}), 1, 6);

// Cut stone blocks in staggered courses.
export const stone = () => tile(canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#6a655c'; x.fillRect(0, 0, w, h);
  const rows = 8, rh = h / rows;
  for (let r = 0; r < rows; r++) {
    let cx = r % 2 ? -24 : 0;
    while (cx < w) {
      const bw = 40 + rnd() * 30, v = 150 + rnd() * 40 | 0;
      x.fillStyle = `rgb(${v},${v - 4},${v - 12})`; x.beginPath(); x.roundRect(cx + 2, r * rh + 2, bw - 4, rh - 4, 4); x.fill();
      x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(cx + 3, r * rh + 3, bw - 6, 3);
      cx += bw;
    }
  }
  speckle(x, w, h, 900, 0.35, ['#3a362f', '#ffffff']);
}), 1, 1);

// Plaster with dark timber framing: tinted per building.
export const timber = () => tile(canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#efe8da'; x.fillRect(0, 0, w, h); speckle(x, w, h, 1200, 0.25, ['#c8bca4', '#ffffff']);
  x.fillStyle = '#5a3f28';
  const b = 14; x.fillRect(0, 0, w, b); x.fillRect(0, h - b, w, b); x.fillRect(0, 0, b, h); x.fillRect(w / 2 - b / 2, 0, b, h);
  x.fillRect(0, h * 0.5 - b / 2, w, b);
  x.lineWidth = b * 0.8; x.strokeStyle = '#5a3f28';
  x.beginPath(); x.moveTo(b, h * 0.5); x.lineTo(w / 2, b); x.moveTo(w - b, h * 0.5); x.lineTo(w / 2, b); x.stroke();
}), 1, 1);

// Overlapping shingle rows for roofs: tinted per roof.
export const shingles = () => tile(canvasTex(128, 128, (x, w, h) => {
  x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, w, h);
  const rows = 8, rh = h / rows;
  for (let r = 0; r < rows; r++) for (let c = -1; c < 9; c++) {
    const v = 200 + rnd() * 55 | 0; x.fillStyle = `rgb(${v},${v},${v})`;
    x.beginPath(); x.roundRect(c * 16 + (r % 2 ? 8 : 0) + 1, r * rh, 14, rh + 2, [0, 0, 6, 6]); x.fill();
    x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(c * 16 + (r % 2 ? 8 : 0) + 1, r * rh + rh - 2, 14, 2);
  }
}), 6, 3);

// Wooden planks for doors, stalls and the dock.
export const planks = () => tile(canvasTex(128, 128, (x, w, h) => {
  x.fillStyle = '#7a5434'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { const v = 100 + rnd() * 40 | 0; x.fillStyle = `rgb(${v + 30},${v},${v - 30})`; x.fillRect(i * 16 + 1, 0, 14, h); }
  x.globalAlpha = 0.3; x.strokeStyle = '#3a2414';
  for (let i = 0; i < 40; i++) { const a = rnd() * w; x.beginPath(); x.moveTo(a, rnd() * h); x.lineTo(a + (rnd() - 0.5) * 2, rnd() * h); x.stroke(); }
  x.globalAlpha = 1;
}), 1, 1);
