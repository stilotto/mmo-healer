// Speed (sprint 13): bakes the still parts of a builder's scenery into a few
// big meshes. Meshes that look alike (same kind of material, colour, texture)
// and stand in the same 48-yard square become one mesh, so a town of several
// hundred pieces costs a few dozen draw calls. Anything that moves, is
// clicked, or is see-through is left alone: mark it `userData.live` (the
// whole group under it stays). Camera blockers stay in the scene, hidden,
// so the camera still bumps into them (raycasts ignore visibility).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CELL = 48;
const hex = c => (c ? c.getHex() : -1);
const sig = m => [m.type, hex(m.color), hex(m.emissive), m.emissiveIntensity, m.map ? m.map.uuid : '', m.side, m.vertexColors, m.flatShading, m.fog].join('|');

// roots: the objects a builder added to the scene. blockers: camera blockers.
export function bake(scene, roots, blockers = []) {
  const block = new Set(), groups = new Map(), mats = new Map(), v = new THREE.Vector3(), box = new THREE.Box3();
  for (const b of blockers) b.traverse(o => block.add(o));
  const visit = o => {
    if (o.userData.live || o.visible === false) return;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && !o.material.transparent && o.material.visible !== false && o.children.length === 0) {
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
      box.copy(g.boundingBox).applyMatrix4(o.matrixWorld); box.getCenter(v);
      const size = box.getSize(new THREE.Vector3()).length();
      const s = sig(o.material), cell = size > CELL ? 'big' : Math.floor(v.x / CELL) + ',' + Math.floor(v.z / CELL);
      const key = s + '#' + cell + '#' + (o.userData.flat ? 'f' : '') + (o.userData.noShade ? 'n' : '');
      if (!mats.has(s)) mats.set(s, o.material);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
      return;
    }
    for (const c of [...o.children]) visit(c);
  };
  for (const r of roots) { r.updateMatrixWorld(true); visit(r); }
  let made = 0, gone = 0;
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const mat = mats.get(key.split('#')[0]);
    const geos = list.map(o => {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(a)) g.deleteAttribute(a);
      if (!mat.vertexColors && g.attributes.color) g.deleteAttribute('color');
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.morphAttributes = {}; g.clearGroups();
      return g.applyMatrix4(o.matrixWorld);
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    m.userData.flat = key.endsWith('f') || key.endsWith('fn'); m.userData.noShade = key.endsWith('n');
    m.matrixAutoUpdate = false; m.updateMatrix(); m.updateMatrixWorld(true);
    scene.add(m); made++;
    for (const o of list) {
      if (block.has(o)) { o.visible = false; continue; }
      o.removeFromParent(); gone++;
    }
  }
  // What is left and not live never moves: stop recomputing its matrices.
  const freeze = o => { if (o.userData.live) return; o.matrixAutoUpdate = false; o.updateMatrix(); for (const c of o.children) freeze(c); };
  for (const r of roots) if (r.parent) freeze(r);
  // Empty groups (everything inside was baked) can go.
  for (const r of roots) if (r.isGroup && r.parent && !r.children.length) r.removeFromParent();
  return { made, gone };
}
