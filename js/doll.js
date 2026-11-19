// The paper doll: the healer in 3D in the character window, slowly turning
// (drag to spin). Its own small renderer, drawn only while the window is open.
import * as THREE from 'three';
import { makeFigure, animate, dress } from './figure.js';

export function makeDoll(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0, 1.25, 5.6); cam.lookAt(0, 1.0, 0);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x404858, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.8); sun.position.set(2, 4, 3); scene.add(sun);
  const fig = makeFigure('Healer', 7); scene.add(fig.group);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let yaw = 0.5, drag = null, t = 0, w = 0, h = 0, equip = null, preview = null;
  canvas.addEventListener('pointerdown', e => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (drag === null) return; yaw += (e.clientX - drag) * 0.015; drag = e.clientX; });
  const up = () => { drag = null; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  const redress = () => dress(fig, preview ? { ...equip, [preview.slot]: preview } : equip);
  return {
    show(eq) { equip = eq; redress(); },
    preview(it) { preview = it || null; redress(); },
    render(dt) {
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return;
      if (cw !== w || ch !== h) { w = cw; h = ch; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      t += dt; if (drag === null && !calm) yaw += dt * 0.5;
      fig.group.rotation.y = yaw; animate(fig, 'idle', t);
      r.render(scene, cam);
    },
  };
}
