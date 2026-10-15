// Физика транспорта: твёрдое тело + рейкаст-подвеска по колёсам (без «прилипания» к рельефу).
// Мир — heightfield: опора колеса = высота земли под ступицей, сила пружины идёт по нормали грунта,
// поэтому на отвесной стене она толкает вбок, а не вверх (по скалам не ездит). Тяга — только на пологом.
import * as THREE from 'three';

const V3 = THREE.Vector3, Q = THREE.Quaternion;
const smoothN = (W, x, z, e = 1.1) => new V3(W.heightAt(x - e, z) - W.heightAt(x + e, z), 2 * e, W.heightAt(x, z - e) - W.heightAt(x, z + e)).normalize();
const UP = new V3(0, 1, 0);

export class VehicleBody {
  constructor(game, V) {
    this.g = game; this.V = V; const C = this.C = Object.assign({
      mass: 900, gravity: 14, wheelR: 0.36, travel: 0.45, sag: 0.09, maxSpeed: 22, engine: 9.5, brake: 14,
      grip: 9, roll: 0.35, turn: 1.9, climb_deg: 33, slide_deg: 45,
      wheels: [[-1.05, -1.17], [-1.05, -0.38], [-1.05, 0.38], [-1.05, 1.17], [1.05, -1.17], [1.05, -0.38], [1.05, 0.38], [1.05, 1.17]],
      box: [2.4, 1.3, 3.0], hull: [[-0.9, 0.5, -1.15], [0.9, 0.5, -1.15], [-0.9, 0.5, 1.15], [0.9, 0.5, 1.15], [-0.9, 1.6, -1.0], [0.9, 1.6, -1.0], [0, 1.6, 1.2]],   // углы днища — внутри колёсной базы, не цепляют склон раньше колёс
    }, V.cfg.phys || {});
    const m = C.mass, [w, h, l] = C.box, nW = C.wheels.length;
    this.I = new V3(m / 12 * (h * h + l * l), m / 12 * (w * w + l * l), m / 12 * (w * w + h * h));
    this.k = m * C.gravity / nW / C.sag;                       // жёсткость: на стоянке просадка = sag
    this.cd = 2 * Math.sqrt(this.k * m / nW) * (C.damp ?? 0.85);  // демпфирование (доля от критического): тяжёлая машина не «пружинит»
    this.pos = new V3(V.b.x, game.groundY(V.b.x, V.b.z), V.b.z);
    this.q = new Q().setFromAxisAngle(UP, V.b.rot || 0);
    this.vel = new V3(); this.w = new V3(); this.sleep = 0; this.contacts = 0;
    this.wheelsY = C.wheels.map(() => 0);                       // для визуала колёс (смещение по подвеске)
  }
  get heading() { const f = new V3(0, 0, 1).applyQuaternion(this.q); return Math.atan2(f.x, f.z); }
  wake() { this.sleep = 0; }

  step(dt, ctl) {
    if (this.sleep > 1.2 && !ctl) return;
    const n = Math.min(12, Math.ceil(dt / 0.008)), h = dt / n;
    for (let i = 0; i < n; i++) this.sub(h, ctl);
    const rest = this.vel.lengthSq() < 0.01 && this.w.lengthSq() < 0.004 && !(ctl && (ctl.y || ctl.x));
    this.sleep = rest ? this.sleep + dt : 0;
  }

  sub(dt, ctl) {
    const C = this.C, g = this.g, W = g.world, m = C.mass, q = this.q;
    const up = UP.clone().applyQuaternion(q), fwd = new V3(0, 0, 1).applyQuaternion(q), right = new V3(1, 0, 0).applyQuaternion(q);
    const sp2 = this.vel.x * this.vel.x + this.vel.z * this.vel.z;
    const F = new V3(0, -C.gravity * m - (C.downforce ?? 0.018) * sp2 * m, 0), T = new V3(); this.lift = 0;   // вес + прижим на скорости: на кочках не подлетает пушинкой
    const addF = (f, at) => { F.add(f); T.add(new V3().subVectors(at, this.pos).cross(f)); };
    const ptVel = p => new V3().subVectors(p, this.pos).cross(this.w).negate().add(this.vel);  // v + w×r
    const throttle = ctl ? ctl.y : 0, steer = ctl ? ctl.x : 0, boost = ctl?.run ? 1.2 : 1;
    this.steerVis = (this.steerVis || 0) + (-steer - (this.steerVis || 0)) * Math.min(1, dt * 8);   // визуальный поворот передних колёс
    const vF = this.vel.dot(fwd), cosClimb = Math.cos(C.climb_deg * Math.PI / 180), cosSlide = Math.cos(C.slide_deg * Math.PI / 180);
    let contacts = 0, traction = 0;
    const nTouch = Math.max(2, C.wheels.reduce((n, [wx, wz]) => { const hb = new V3(wx, C.wheelR, wz).applyQuaternion(q).add(this.pos); return n + (hb.clone().addScaledVector(up, C.travel).y - C.wheelR - g.groundY(hb.x, hb.z) < C.travel + C.sag ? 1 : 0); }, 0));
    const big = smoothN(W, this.pos.x, this.pos.z, 2.2), bigY = Math.min(big.y, up.y + 0.02);   // крутизна места: наклон машины и большой нормали
    const slopeK = THREE.MathUtils.clamp((bigY - cosSlide) / (cosClimb - cosSlide), 0, 1);
    C.wheels.forEach(([wx, wz], i) => {
      const hub = new V3(wx, C.wheelR, wz).applyQuaternion(q).add(this.pos);
      const top = hub.clone().addScaledVector(up, C.travel);
      const gh = g.groundY(hub.x, hub.z);
      const L = top.y - C.wheelR - gh;                          // длина пружины до грунта (вертикальный луч)
      const Lrest = C.travel + C.sag, c = Lrest - L;
      if (c <= 0) { this.wheelsY[i] += (-0.15 - this.wheelsY[i]) * Math.min(1, dt * 12); return; }
      contacts++;
      const nrm = smoothN(W, hub.x, hub.z);
      const contact = new V3(hub.x, gh, hub.z), pv = ptVel(contact);
      let Fn = this.k * c - this.cd * pv.dot(nrm);
      Fn = Math.max(0, Math.min(Fn, m * C.gravity * 2.2));                     // пружина не толкает сильнее ~2g на колесо
      if (c > Lrest) { const vn = pv.dot(nrm); if (vn < 0) Fn += -vn * m / C.wheels.length / dt * 0.35;   // отбойник: неупруго гасит удар
        this.lift = Math.max(this.lift || 0, (c - Lrest) * 0.5); }
      addF(nrm.clone().multiplyScalar(Fn), contact); if (window.__vdbg) (this.dbg ||= [])[i] = [+c.toFixed(2), Math.round(Fn / m * 10) / 10, +nrm.y.toFixed(2)];
      this.wheelsY[i] += (Math.min(C.travel, c - C.sag) - this.wheelsY[i]) * Math.min(1, dt * 20);
      // сцепление: на крутом склоне колесо не тянет и не держит — машина сползает
      const grip = 0.35 + 0.65 * slopeK, drive = slopeK;   // на круче колёса буксуют и сползают
      traction += drive;
      const f = fwd.clone().addScaledVector(nrm, -fwd.dot(nrm)).normalize(), s = right.clone().addScaledVector(nrm, -right.dot(nrm)).normalize();
      const vLong = pv.dot(f), vLat = pv.dot(s), mu = 1.1 * Fn * grip;
      let fl = 0;
      if (throttle) {
        const same = Math.sign(throttle) === Math.sign(vLong) || Math.abs(vLong) < 0.5;
        fl = same ? throttle * C.engine * boost * m / nTouch * Math.max(0, 1 - Math.abs(vLong) / (C.maxSpeed * boost)) * drive
                  : -Math.sign(vLong) * C.brake * m / C.wheels.length;
      } else fl = -vLong * C.roll * m / C.wheels.length * (Math.abs(vLong) < 1.5 ? 4 : 1);   // накат, у нуля — тормоз-ручник
      let flat = -vLat * C.grip * m / C.wheels.length;
      const tot = Math.hypot(fl, flat); if (tot > mu && tot > 0) { fl *= mu / tot; flat *= mu / tot; }
      if (window.__vdbg) this.dbg[i].push(Math.round(fl / m * 10) / 10, +drive.toFixed(2));
      addF(f.multiplyScalar(fl).add(s.multiplyScalar(flat)), contact);
    });
    this.contacts = contacts; traction /= C.wheels.length;
    // руль: целевая скорость рыскания пропорциональна скорости (на месте не крутится, задом — наоборот)
    if (contacts) {
      const want = -steer * C.turn * THREE.MathUtils.clamp(vF / 5, -1, 1) * Math.min(1, 0.4 + 6 / Math.max(6, Math.abs(vF)));
      const cur = this.w.dot(up), k = Math.min(1, dt * 10) * (contacts / C.wheels.length) * Math.max(0.25, traction);
      this.w.addScaledVector(up, (want - cur) * k);
    }
    // корпус о грунт: отталкивание по нормали (стены — вбок)
    for (const [hx, hy, hz] of C.hull) {
      const p = new V3(hx, hy, hz).applyQuaternion(q).add(this.pos), gh = g.groundY(p.x, p.z);
      if (p.y < gh) { const nrm = W.normalAt(p.x, p.z), pen = gh - p.y, pv = ptVel(p), vn = pv.dot(nrm);
        addF(nrm.clone().multiplyScalar((vn < 0 ? -vn * m / 4 / dt * 0.35 : 0)), p); this.lift = Math.max(this.lift || 0, pen * 0.5); }
    }
    // интеграция
    this.vel.addScaledVector(F, dt / m); this.vel.multiplyScalar(1 - 0.05 * dt);
    const iq = q.clone().invert(), tl = T.applyQuaternion(iq);
    const wl = this.w.clone().applyQuaternion(iq); wl.x += tl.x / this.I.x * dt; wl.y += tl.y / this.I.y * dt; wl.z += tl.z / this.I.z * dt;
    this.w.copy(wl.applyQuaternion(q)).multiplyScalar(1 - (contacts ? 1.2 : 0.3) * dt);
    const np = this.pos.clone().addScaledVector(this.vel, dt);
    // препятствия: гейты зон, вода, камни, постройки
    const blocked = W.blocked(np.x, np.z) || W.waterAt(np.x, np.z) > W.heightAt(np.x, np.z) + 0.9;
    if (window.__vdbg) this.why = { blocked, solid: 0, col: 0 };
    if (blocked) { this.vel.x *= -0.2; this.vel.z *= -0.2; np.x = this.pos.x; np.z = this.pos.z; }
    for (const s of g.player.solids || []) { if (s.r < (C.overRock ?? 1.0)) continue;   // мелкие камни переезжает
      const dx = np.x - s.x, dz = np.z - s.z, d = Math.hypot(dx, dz), r = s.r + 1.3;
      if (d < r && d > 1e-4) { if (this.why) this.why.solid = +(s.r).toFixed(2) + '@' + (s.x|0) + ',' + (s.z|0); np.x = s.x + dx / d * r; np.z = s.z + dz / d * r; const nx = dx / d, nz = dz / d, vn = this.vel.x * nx + this.vel.z * nz; if (vn < 0) { this.vel.x -= nx * vn * 1.2; this.vel.z -= nz * vn * 1.2; } } }
    const qq = { x: np.x, z: np.z }; g.builder.collide?.(qq, 1.4); if (qq.x !== np.x || qq.z !== np.z) { if (this.why) this.why.col = 1; this.vel.x *= 0.3; this.vel.z *= 0.3; np.x = qq.x; np.z = qq.z; }
    const lim = W.half * 0.86; np.x = THREE.MathUtils.clamp(np.x, -lim, lim); np.z = THREE.MathUtils.clamp(np.z, -lim, lim);
    if (this.lift) { np.y += this.lift; this.lift = 0; }
    // тяжёлая: с кочки не выстреливает — ограничиваем вертикаль ОТНОСИТЕЛЬНО склона (подъём в гору не трогаем)
    if (contacts) { const n0 = W.normalAt(this.pos.x, this.pos.z), vyG = -(n0.x * this.vel.x + n0.z * this.vel.z) / Math.max(0.3, n0.y), rel = this.vel.y - vyG, cap = C.hop ?? 1.6;
      if (rel > cap) this.vel.y -= (rel - cap) * Math.min(1, dt * 25); }
    this.pos.copy(np);
    const wlen = this.w.length(); if (wlen > 1e-6) { q.premultiply(new Q().setFromAxisAngle(this.w.clone().divideScalar(wlen), wlen * dt)); q.normalize(); }
    // страховка от провала под землю
    const gc = g.groundY(this.pos.x, this.pos.z); if (this.pos.y < gc - 0.8) { this.pos.y = gc + 0.3; this.vel.y = Math.max(0, this.vel.y); }
  }

  apply() {
    const V = this.V, o = V.obj;
    o.position.copy(this.pos); o.quaternion.copy(this.q); o.updateMatrixWorld(true);
    V.b.x = this.pos.x; V.b.z = this.pos.z; V.b.rot = this.heading; V.speed = this.vel.dot(new V3(0, 0, 1).applyQuaternion(this.q));
  }
}

// Колёса из цельного меша Tripo: связные компоненты у дна по бокам → отдельные меши на шарнирах
// (вращение по скорости, поворот передних, ход подвески из wheelsY). Разбор геометрии кэшируется — меш общий у инстансов.
function splitWheels(mesh) {
  const geo = mesh.geometry; if (geo.userData.wheelSplit) return geo.userData.wheelSplit;
  const P = geo.attributes.position, I = geo.index.array, n = P.count, par = new Int32Array(n).map((_, i) => i);
  const f = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }, u = (a, b) => { a = f(a); b = f(b); if (a !== b) par[a] = b; };
  const key = new Map(); for (let v = 0; v < n; v++) { const k = P.getX(v).toFixed(4) + ',' + P.getY(v).toFixed(4) + ',' + P.getZ(v).toFixed(4); key.has(k) ? u(v, key.get(k)) : key.set(k, v); }
  for (let t = 0; t < I.length; t += 3) { u(I[t], I[t + 1]); u(I[t], I[t + 2]); }
  geo.computeBoundingBox(); const bb = geo.boundingBox, H = bb.max.y - bb.min.y, W = bb.max.x - bb.min.x;
  const comp = new Map(); for (let v = 0; v < n; v++) { const r = f(v); let c = comp.get(r); if (!c) comp.set(r, c = new THREE.Box3()); c.expandByPoint(new V3(P.getX(v), P.getY(v), P.getZ(v))); }
  const wheels = [];
  for (const [r, b] of comp) { const s = b.getSize(new V3()), c = b.getCenter(new V3());
    if (b.min.y - bb.min.y < H * 0.05 && s.y > H * 0.25 && Math.abs(c.x) > W * 0.25 && Math.abs(s.y - s.z) < s.y * 0.25) wheels.push({ r, c, R: s.y / 2 }); }
  if (wheels.length < 4) return (geo.userData.wheelSplit = null);
  const of = new Map(wheels.map((w, i) => [w.r, i])), keep = [], tris = wheels.map(() => []);
  for (let t = 0; t < I.length; t += 3) { const w = of.get(f(I[t])); (w === undefined ? keep : tris[w]).push(I[t], I[t + 1], I[t + 2]); }
  // каждой части — свои копии атрибутов, сдвинутые в центр колеса (общий буфер не трогаем)
  const parts = wheels.map((w, i) => { const g = new THREE.BufferGeometry(); for (const a in geo.attributes) g.setAttribute(a, geo.attributes[a].clone()); g.setIndex(tris[i]);
    const pa = g.attributes.position; for (let v = 0; v < pa.count; v++) pa.setXYZ(v, pa.getX(v) - w.c.x, pa.getY(v) - w.c.y, pa.getZ(v) - w.c.z); return { geo: g, c: w.c, R: w.R }; });
  const body = geo.clone(); body.setIndex(keep);   // общий прототип не трогаем: превью и прочие инстансы остаются с колёсами
  parts.body = body;
  return (geo.userData.wheelSplit = parts);
}

export function rigWheels(V) {
  let mesh = null; V.obj.traverse(o => { if (!mesh && o.isMesh && o.name !== 'outline' && o.geometry.index) mesh = o; });
  if (!mesh) return;
  const parts = splitWheels(mesh); if (!parts) return;
  mesh.geometry = parts.body; const olm = mesh.children.find(o => o.name === 'outline'); if (olm) olm.geometry = parts.body;
  V.obj.updateMatrixWorld(true);
  const inv = V.obj.matrixWorld.clone().invert(), k = mesh.getWorldScale(new V3()).x / V.obj.getWorldScale(new V3()).x;
  const ol = mesh.children.find(o => o.name === 'outline'), Cw = V.body.C.wheels;
  const zs = parts.map(p => p.c.z), zMax = Math.max(...zs), zMin = Math.min(...zs);
  V.wheels = parts.map(p => {
    const pivot = new THREE.Group(); pivot.position.copy(p.c); mesh.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    const w = new THREE.Mesh(p.geo, mesh.material); w.castShadow = true; spin.add(w);
    if (ol) w.add(new THREE.Mesh(p.geo, ol.material));
    // ближайшее физическое колесо (в системе машины)
    const lp = p.c.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
    let bi = 0, bd = 1e9; Cw.forEach(([x, z], i) => { const d = (x - lp.x) ** 2 + (z - lp.z) ** 2; if (d < bd) { bd = d; bi = i; } });
    // передние колёса — с наибольшим z; нос машины = +z (ось V.obj); если меш развёрнут — по знаку lp.z
    return { pivot, spin, base: p.c.y, phys: bi, R: p.R * k, k, front: Math.abs(p.c.z - zMax) < 1e-3 || Math.abs(p.c.z - zMin) < 1e-3 ? Math.sign(lp.z) : 0, ang: 0 };
  });
}

export function animWheels(V, dt) {
  if (!V.wheels) return; const B = V.body, st = B.steerVis || 0;
  for (const w of V.wheels) {
    w.ang += (V.speed || 0) * dt / Math.max(0.05, w.R);
    w.spin.rotation.x = w.ang;
    w.pivot.position.y = w.base + (B.wheelsY[w.phys] || 0) / w.k;
    w.pivot.rotation.y = w.front > 0 ? st * 0.45 : w.front < 0 ? -st * 0.2 : 0;
  }
}
