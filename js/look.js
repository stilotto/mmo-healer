// Art direction samples. ?look=storybook, ?look=toon or ?look=dusk restyles
// the whole scene (light, sky, shadows, materials, glow) without touching the
// models, so the owner can compare looks on the live site. No ?look keeps the
// original style. Sprint 4 picks one and builds on it.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { canvasTex } from './figure.js';

const sky = stops => canvasTex(8, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, w, h);
});

export const LOOKS = {
  storybook: {   // golden hour, warm and soft
    sky: [[0, '#2f4f9a'], [0.45, '#8fa8d8'], [0.66, '#f6c08a'], [0.75, '#ffd9a8'], [1, '#ffd9a8']],
    fog: [0xf2c9a0, 70, 380], hemi: [0xa8c0ff, 0x7a5a38, 0.9], sun: [0xffc27a, 3.2, [-80, 38, 25]],
    tone: THREE.ACESFilmicToneMapping, exposure: 1.15, bloom: [0.35, 0.5, 0.82], glow: 1.8, shadows: true, sat: 1.12,
  },
  toon: {        // bright noon, cel-shaded with ink outlines
    sky: [[0, '#2f7fe0'], [0.6, '#8fd0ff'], [0.75, '#d8f0ff'], [1, '#d8f0ff']],
    fog: [0xd8f0ff, 120, 480], hemi: [0xffffff, 0x8a7a60, 1.2], sun: [0xffffff, 2.4, [-40, 90, 50]],
    tone: THREE.NoToneMapping, exposure: 1, toon: true, outline: true, shadows: true, sat: 1.4,
  },
  dusk: {        // blue hour, the city lit by its own lamps
    sky: [[0, '#070b24'], [0.45, '#1f2a5c'], [0.66, '#6a4a7a'], [0.74, '#e0805a'], [1, '#e0805a']],
    fog: [0x2a3058, 40, 240], hemi: [0x6a7ac0, 0x3a3040, 1.0], sun: [0x8a90ff, 0.7, [60, 50, -40]],
    tone: THREE.ACESFilmicToneMapping, exposure: 1.25, bloom: [0.9, 0.6, 0.6], glow: 3, shadows: true, lamps: true, sat: 1,
  },
};

export function makeLook(name, { scene, renderer, camera, world }) {
  const L = LOOKS[name];
  if (!L) return { render: () => renderer.render(scene, camera), update() {}, mood() {}, resize() {} };
  const { hemi, sun } = world.lights;
  const skyTex = sky(L.sky);
  renderer.toneMapping = L.tone; renderer.toneMappingExposure = L.exposure;
  if (L.shadows) {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 300 }); sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun.target);
  }
  if (L.lamps) {
    const at = [[0, 5.6, 0], [-7, 9, -62], [7, 9, -62]];
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + 0.39; at.push([Math.sin(a) * 23, 4.2, Math.cos(a) * 23]); }
    for (const [x, y, z] of at) { const l = new THREE.PointLight(0xffb060, 60, 26, 2); l.position.set(x, y, z); scene.add(l); }
  }
  const outdoors = () => {
    scene.background = skyTex; scene.fog.color.set(L.fog[0]); scene.fog.near = L.fog[1]; scene.fog.far = L.fog[2];
    hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
    sun.color.set(L.sun[0]); sun.intensity = L.sun[1];
  };
  outdoors();

  // Materials: saturate, make glowing things glow, optionally swap to toon.
  const grad = new THREE.DataTexture(new Uint8Array([70, 70, 180, 255]), 4, 1, THREE.RedFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
  const done = new WeakMap();
  const fix = m => {
    if (done.has(m)) return done.get(m);
    let out = m;
    if (m.isMeshLambertMaterial) {
      if (L.sat !== 1) { const h = {}; m.color.getHSL(h); m.color.setHSL(h.h, Math.min(1, h.s * L.sat), h.l); }
      if (L.toon) {
        out = new THREE.MeshToonMaterial({ color: m.color, map: m.map, emissive: m.emissive, gradientMap: grad, transparent: m.transparent, opacity: m.opacity, side: m.side, vertexColors: m.vertexColors });
      }
    } else if (m.isMeshBasicMaterial && !m.transparent && L.glow && m.color.getHex() !== 0) m.color.multiplyScalar(L.glow);
    done.set(m, out); return out;
  };
  const sweep = () => scene.traverse(o => {
    if (!o.isMesh || o.userData.looked) return;
    o.userData.looked = true;
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
    if (L.shadows && !o.material.isMeshBasicMaterial && o.material.visible !== false) { o.castShadow = true; o.receiveShadow = true; }
  });
  sweep();

  let composer = null, outline = null;
  if (L.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), ...L.bloom));
    composer.addPass(new OutputPass());
  }
  if (L.outline) outline = new OutlineEffect(renderer, { defaultThickness: 0.007, defaultColor: [0.08, 0.06, 0.05] });
  let t = 0;
  return {
    render() { if (composer) composer.render(); else if (outline) outline.render(scene, camera); else renderer.render(scene, camera); },
    resize(w, h) { if (composer) composer.setSize(w, h); },
    update(dt, p) {
      if ((t += dt) > 1) { t = 0; sweep(); }   // newcomers (people, loot beams) pick up the look
      if (L.shadows) { sun.target.position.set(p.x, 0, p.z); sun.position.set(p.x + L.sun[2][0], L.sun[2][1], p.z + L.sun[2][2]); }
    },
    mood(cave) { if (!cave) outdoors(); },
  };
}
