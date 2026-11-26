// The art direction: Storybook (golden hour, warm low sun, soft shadows, a
// gentle glow on lights). Chosen by the owner in sprint 4. ?look=original
// shows the first build's flat style for comparison.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { canvasTex } from './figure.js';

const sky = stops => canvasTex(8, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, w, h);
});

export const LOOKS = {
  storybook: {   // golden hour, warm and soft
    sky: [[0, '#2f4f9a'], [0.45, '#8fa8d8'], [0.66, '#f6c08a'], [0.75, '#ffd9a8'], [1, '#ffd9a8']],
    fog: [0xf2c9a0, 70, 380], hemi: [0xa8c0ff, 0x7a5a38, 0.9], sun: [0xffc27a, 3.2, [-80, 38, 25]],
    tone: THREE.ACESFilmicToneMapping, exposure: 1.15, bloom: [0.35, 0.5, 0.82], glow: 1.4, shadows: true, sat: 1.12,
  },
};

export function makeLook(name, { scene, renderer, camera, world }) {
  const L = LOOKS[name || 'storybook'];
  // ?look=original: the first build's flat style
  if (!L) return { render: () => renderer.render(scene, camera), update() {}, mood() {}, resize() {}, quality: 'auto', low: false, level: 'original look', size: 'full', setQuality() {}, setSize() {} };
  const { hemi, sun } = world.lights;
  const skyTex = sky(L.sky);
  renderer.toneMapping = L.tone; renderer.toneMappingExposure = L.exposure;
  if (L.shadows) {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 300 }); sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun.target);
  }
  const outdoors = () => {
    scene.background = skyTex; scene.fog.color.set(L.fog[0]); scene.fog.near = L.fog[1]; scene.fog.far = L.fog[2];
    hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
    sun.color.set(L.sun[0]); sun.intensity = L.sun[1];
  };
  outdoors();

  // Materials: a little more saturation, and glowing things glow.
  const done = new WeakMap();
  const fix = m => {
    if (done.has(m)) return done.get(m);
    let out = m;
    if (m.isMeshLambertMaterial) { if (L.sat !== 1) { const h = {}; m.color.getHSL(h); m.color.setHSL(h.h, Math.min(1, h.s * L.sat), h.l); } } else if (m.isMeshBasicMaterial && !m.transparent && L.glow && m.color.getHex() !== 0) m.color.multiplyScalar(L.glow);
    done.set(m, out); return out;
  };
  const sweep = () => scene.traverse(o => {
    if (!o.isMesh || o.userData.looked) return;
    o.userData.looked = true;
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
    if (L.shadows && !o.material.isMeshBasicMaterial && o.material.visible !== false) { o.castShadow = !o.userData.flat; o.receiveShadow = !o.userData.noShade; }
  });
  sweep();

  let composer = null;
  if (L.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), ...L.bloom));
    composer.addPass(new OutputPass());
  }
  // Frame-rate safety net: if the game runs slow, step down one notch at a
  // time (glow, then shadows, then the render size cap). ?quality=low starts at the
  // bottom; ?quality=high never steps down.
  // The saved setting (Help window or /graphics) applies unless the address says otherwise.
  let q = new URLSearchParams(location.search).get('quality');
  if (!q) { try { q = localStorage.getItem('mmoHealerGfx') || 'auto'; } catch (e) { q = 'auto'; } }
  // Render size (owner's ask): 'auto' lets the last notch cap the picture at
  // about 0.6 megapixels, stretched to fill the window (big monitors on small
  // graphics chips); a window already under the cap stays sharp. 'full'
  // never caps. Saved in localStorage mmoHealerRender; ?render= wins.
  let rs = new URLSearchParams(location.search).get('render');
  if (!rs) { try { rs = localStorage.getItem('mmoHealerRender') || 'auto'; } catch (e) { rs = 'auto'; } }
  const BUDGET = 0.6e6;
  let t = 0, level = 0, frames = 0, spent = 0, settle = 4, capped = false;
  const fullComposer = composer, ratio = renderer.getPixelRatio();
  const fit = () => {
    const r = capped && rs === 'auto' ? Math.min(ratio, Math.sqrt(BUDGET / (innerWidth * innerHeight))) : ratio;
    if (Math.abs(renderer.getPixelRatio() - r) > 0.001) { renderer.setPixelRatio(r); if (composer) composer.setSize(innerWidth, innerHeight); }
  };
  const steps = [
    () => { composer = null; },
    () => { renderer.shadowMap.enabled = false; sun.castShadow = false; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); },
    () => { capped = true; fit(); },
  ];
  const lower = (quiet) => { if (level < steps.length) { steps[level++](); if (!quiet && look.onLower) look.onLower(level); } };
  // Back to full quality: glow, shadows and resolution as the look wants them.
  const raise = () => {
    if (!level) return; level = 0; composer = fullComposer; capped = false; fit();
    if (L.shadows) { renderer.shadowMap.enabled = true; sun.castShadow = true; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); }
  };
  const look = {
    render() { if (composer) composer.render(); else renderer.render(scene, camera); },
    resize(w, h) { fit(); if (composer) composer.setSize(w, h); },
    update(dt, p) {
      if (q !== 'high' && level < steps.length && (settle -= dt) < 0) {
        frames++; spent += dt;
        if (spent > 3) { if (frames / spent < 40) { lower(); settle = 3; } frames = 0; spent = 0; }
      }
      if ((t += dt) > 1) { t = 0; sweep(); }   // newcomers (people, loot beams) pick up the look
      if (L.shadows) { sun.target.position.set(p.x, 0, p.z); sun.position.set(p.x + L.sun[2][0], L.sun[2][1], p.z + L.sun[2][2]); }
    },
    mood(cave) { if (!cave) outdoors(); },
    // 'auto' (steps down if slow), 'high' (never steps down) or 'low' (everything off).
    get quality() { return q; },
    get low() { return level >= steps.length; },
    get notch() { return level; },
    get level() { return ['full quality', 'glow off', 'glow and shadows off', 'glow and shadows off, render size capped'][level]; },
    get size() { return rs; },
    setSize(mode) { rs = mode; try { localStorage.setItem('mmoHealerRender', mode); } catch (e) {} fit(); },
    setQuality(mode) {
      q = mode; try { localStorage.setItem('mmoHealerGfx', mode); } catch (e) {}
      raise(); settle = 4; frames = 0; spent = 0;
      if (mode === 'low') while (level < steps.length) lower(true);
      if (composer) composer.setSize(innerWidth, innerHeight);
    },
  };
  if (q === 'low') while (level < steps.length) lower(true);
  return look;
}
