// Бюджет точечного света. В forward-рендере Three.js каждый PointLight в сцене стоит во ВСЕХ освещённых
// фрагментах, даже при intensity 0, а смена числа источников перекомпилирует все шейдеры (фриз ~1 с).
// Поэтому: все PointLight игры — «виртуальные» (visible=false, только данные), в сцене — фиксированный пул
// из K настоящих источников; каждый кадр пул получает K ближайших к камере включённых виртуальных.
import * as THREE from 'three';

const virt = new Set();
// Любой PointLight, добавленный в граф (add/clone), становится виртуальным — код игры менять не нужно
const add0 = THREE.Object3D.prototype.add;
THREE.Object3D.prototype.add = function (...objs) {
  for (const o of objs) if (o && o.isPointLight && !o.userData.poolLight) { o.visible = false; virt.add(o); }
  return add0.apply(this, objs);
};

export class LightPool {
  constructor(scene, k = 4) {
    this.scene = scene; this.pool = []; this.cand = []; this.wp = new THREE.Vector3(); this.dir = new THREE.Vector3();
    for (let i = 0; i < k; i++) { const l = new THREE.PointLight('#ffffff', 0, 1, 2); l.userData.poolLight = true; scene.add(l); this.pool.push(l); }
  }
  // Включён ли источник: в сцене, все предки видимы, intensity > 0
  live(l) {
    if (!(l.intensity > 0)) return false;
    let o = l.parent; while (o) { if (!o.visible) return false; if (o === this.scene) return true; o = o.parent; }
    return false;   // вне сцены
  }
  update(cam, cullDist = 1e9) {
    const C = this.cand; C.length = 0;
    for (const l of virt) {
      if (!l.parent) { virt.delete(l); continue; }
      if (!this.live(l)) continue;
      l.updateWorldMatrix(true, false); this.wp.setFromMatrixPosition(l.matrixWorld);
      const reach = l.distance > 0 ? l.distance : 60, d = this.wp.distanceTo(cam.position);
      if (d - reach > cullDist) continue;
      C.push({ l, s: Math.max(0, d - reach) + d * 0.01, x: this.wp.x, y: this.wp.y, z: this.wp.z });
    }
    C.sort((a, b) => a.s - b.s);
    for (let i = 0; i < this.pool.length; i++) {
      const P = this.pool[i], c = C[i];
      if (!c) { P.intensity = 0; continue; }
      P.position.set(c.x, c.y, c.z); P.updateMatrixWorld(); P.color.copy(c.l.color);   // матрица сцены уже обновлена до onBeforeRender — обновляем сами
      P.intensity = c.l.intensity; P.distance = c.l.distance; P.decay = c.l.decay;
    }
    return C.length;
  }
}
