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
    tone: THREE.ACESFilmicToneMapping, exposure: 1.15, bloom: [0.35, 0.5, 0.82], glow: 1.8, shadows: true, sat: 1.12,
  },
};

export function makeLook(name, { scene, renderer, camera, world }) {
  const L = LOOKS[name || 'storybook'];
  // ?look=original: the first build's flat style
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
    if (L.shadows && !o.material.isMeshBasicMaterial && o.material.visible !== false) { o.castShadow = true; o.receiveShadow = true; }
  });
  sweep();

  let composer = null;
  if (L.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), ...L.bloom));
    composer.addPass(new OutputPass());
  }
  let t = 0;
  return {
    render() { if (composer) composer.render(); else renderer.render(scene, camera); },
    resize(w, h) { if (composer) composer.setSize(w, h); },
    update(dt, p) {
      if ((t += dt) > 1) { t = 0; sweep(); }   // newcomers (people, loot beams) pick up the look
      if (L.shadows) { sun.target.position.set(p.x, 0, p.z); sun.position.set(p.x + L.sun[2][0], L.sun[2][1], p.z + L.sun[2][2]); }
    },
    mood(cave) { if (!cave) outdoors(); },
  };
}
