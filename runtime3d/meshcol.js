// Коллизии по реальной геометрии: «что видно — то и твёрдое».
// Треугольники мешей запекаются в мировые координаты и раскладываются по сетке XZ (ячейка C м).
//  • пол    — треугольники с |n.y| > WALK (стоять можно на любой пологой грани, сторона не важна);
//  • стены  — круче: сечение треугольника на высоте колен/груди даёт отрезок, игрок (круг r) выталкивается от него;
//  • потолок — пологие грани над головой.
// Замена ручным addSolid-кругам/коробкам, которые не совпадали с картинкой.
import * as THREE from 'three';

const WALK = 0.55, C = 4, R = 0.42, STEP = 0.55;

export class MeshCollider {
  constructor() { this.tris = []; this.grid = new Map(); this.stamp = 0; }

  // Добавить группу/меш (после updateMatrixWorld). skip(mesh) → true — не коллидит (лампы, стекло, эффекты)
  add(root, skip = null) {
    root.updateMatrixWorld(true); const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    root.traverse(m => {
      if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || m.userData.noCol || skip?.(m)) return;
      const pos = m.geometry.attributes.position, idx = m.geometry.index, n = idx ? idx.count : pos.count;
      for (let i = 0; i < n; i += 3) {
        for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, idx ? idx.getX(i + k) : i + k).applyMatrix4(m.matrixWorld);
        this.addTri(v[0], v[1], v[2], m.userData.floorOnly);
      }
    });
  }
  addTri(a, b, c, floorOnly = false) {
    const e1 = b.clone().sub(a), e2 = c.clone().sub(a), nrm = e1.cross(e2); const L = nrm.length(); if (L < 1e-6) return; nrm.divideScalar(L);
    if (floorOnly && Math.abs(nrm.y) <= WALK) return;   // тонкие плиты пола: торцы не стена (иначе машина упирается в край)
    const t = { a: a.clone(), b: b.clone(), c: c.clone(), n: nrm, id: this.tris.length, s: 0,
      y0: Math.min(a.y, b.y, c.y), y1: Math.max(a.y, b.y, c.y), kind: Math.abs(nrm.y) > WALK ? 'floor' : 'wall' };
    this.tris.push(t);
    const x0 = Math.floor(Math.min(a.x, b.x, c.x) / C), x1 = Math.floor(Math.max(a.x, b.x, c.x) / C), z0 = Math.floor(Math.min(a.z, b.z, c.z) / C), z1 = Math.floor(Math.max(a.z, b.z, c.z) / C);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 100003 + j; let L2 = this.grid.get(k); if (!L2) this.grid.set(k, L2 = []); L2.push(t); }
  }
  // Треугольники вокруг точки (радиус rr), без повторов
  near(x, z, rr = 0) {
    const out = [], s = ++this.stamp, x0 = Math.floor((x - rr) / C), x1 = Math.floor((x + rr) / C), z0 = Math.floor((z - rr) / C), z1 = Math.floor((z + rr) / C);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const L = this.grid.get(i * 100003 + j); if (L) for (const t of L) if (t.s !== s) { t.s = s; out.push(t); } }
    return out;
  }
  // Высота плоскости треугольника в (x,z), если точка внутри его XZ-проекции
  yAt(t, x, z) {
    const { a, b, c } = t, d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z); if (Math.abs(d) < 1e-9) return null;
    const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d, l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d, l3 = 1 - l1 - l2;
    if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) return null; return l1 * a.y + l2 * b.y + l3 * c.y;
  }
  // Пол под ногами: самая высокая пологая грань не выше ног + STEP
  groundAt(x, z, py, g) {
    for (const t of this.near(x, z)) { if (t.kind !== 'floor' || t.y0 > py + STEP) continue; const y = this.yAt(t, x, z); if (y != null && y <= py + STEP && y > g) g = y; }
    return g;
  }
  // Потолок: самая низкая пологая грань выше головы (отсчёт от ног)
  ceilAt(x, z, py) {
    let best = null; for (const t of this.near(x, z)) { if (t.kind !== 'floor' || t.y1 < py + 1.2) continue; const y = this.yAt(t, x, z); if (y != null && y > py + 1.2 && (best == null || y < best)) best = y; }
    return best;
  }
  // Сечение треугольника горизонтальной плоскостью y=h → отрезок [x1,z1,x2,z2] или null
  cut(t, h) {
    if (h < t.y0 || h > t.y1) return null; const P = [t.a, t.b, t.c], out = [];
    for (let i = 0; i < 3; i++) { const p = P[i], q = P[(i + 1) % 3]; if ((p.y - h) * (q.y - h) > 0 || p.y === q.y) continue; const k = (h - p.y) / (q.y - p.y); out.push(p.x + (q.x - p.x) * k, p.z + (q.z - p.z) * k); }
    return out.length >= 4 ? out : null;
  }
  // Выталкивание игрока из стен. old — откуда шёл (для «не проскочить сквозь» тонкую стенку за кадр)
  // step — высота, которую перешагиваем/переезжаем (пешком 0.55, колесо ~0.8)
  collide(q, old, py, R = 0.42, H = 1.6, step = STEP) {
    for (let pass = 0; pass < 2; pass++) for (const t of this.near(q.x, q.z, R + 0.6)) {
      if (t.kind !== 'wall' || t.y1 < py + step + 0.05 || t.y0 > py + H) continue;   // ниже колена — перешагиваем (торцы плит, бортики пандусов)
      for (const h of [py + step + 0.1, py + H * 0.62, py + H - 0.05]) { const s = this.cut(t, h); if (!s) continue;
        const [ax, az, bx, bz] = s, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
        // 1) пересекли отрезок за кадр — откат на старую сторону
        const nx = -dz, nz = dx, so = (old.x - ax) * nx + (old.z - az) * nz, sn = (q.x - ax) * nx + (q.z - az) * nz;
        if (so * sn < 0) { const k = so / (so - sn), ix = old.x + (q.x - old.x) * k, iz = old.z + (q.z - old.z) * k, u = ((ix - ax) * dx + (iz - az) * dz) / l2;
          if (u > -0.05 && u < 1.05) { const L = Math.sqrt(l2), sg = Math.sign(so); q.x = ix + sg * nx / L * R; q.z = iz + sg * nz / L * R; } }
        // 2) ближе радиуса — выталкиваем
        const u = Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.z - az) * dz) / l2)), cx = ax + dx * u, cz = az + dz * u, ex = q.x - cx, ez = q.z - cz, d = Math.hypot(ex, ez);
        if (d < R) { if (d > 1e-5) { q.x = cx + ex / d * R; q.z = cz + ez / d * R; } else { const L = Math.sqrt(l2), sg = Math.sign((old.x - ax) * nx + (old.z - az) * nz) || 1; q.x = cx + sg * nx / L * R; q.z = cz + sg * nz / L * R; } }
      }
    }
  }
  // Луч (камера): ближайшее пересечение отрезка p→q с любым треугольником; возвращает долю 0..1 или null
  ray(p, q) {
    const d = q.clone().sub(p), len = d.length(); if (len < 1e-4) return null; const dir = d.clone().divideScalar(len);
    const steps = Math.ceil(len / C) + 1, seen = new Set(); let best = null;
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), pv = new THREE.Vector3(), tv = new THREE.Vector3(), qv = new THREE.Vector3();
    for (let s = 0; s <= steps; s++) { const x = p.x + d.x * s / steps, z = p.z + d.z * s / steps;
      for (const t of this.near(x, z, 0.5)) { if (seen.has(t.id)) continue; seen.add(t.id);
        e1.subVectors(t.b, t.a); e2.subVectors(t.c, t.a); pv.crossVectors(dir, e2); const det = e1.dot(pv); if (Math.abs(det) < 1e-8) continue;
        tv.subVectors(p, t.a); const u = tv.dot(pv) / det; if (u < 0 || u > 1) continue; qv.crossVectors(tv, e1); const v = dir.dot(qv) / det; if (v < 0 || u + v > 1) continue;
        const k = e2.dot(qv) / det; if (k > 0 && k < len && (best == null || k < best)) best = k; } }
    return best == null ? null : best / len;
  }
}
