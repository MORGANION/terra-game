// Интерьеры ориентиров: залы из модулей внутри объёма Tripo-модели, вход, мостки, лестницы, предметы.
// Данные — game.json world.landmarks[].interior. Координаты интерьера — в метрах в системе ориентира (x вправо, z к входу, y от пола площадки).
// Пол/стены/потолок дают player.groundAt / collide / ceilAt. Когда игрок внутри — оболочка Tripo скрывается (cutaway), включается свет.
import * as THREE from 'three';
import { mergeStatic } from './models.js';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, metalness: 0.2, ...o });

// Решётчатый пол: canvas-текстура (тёмные прорези), под ней — свечение (лава/кристаллы), видно сквозь щели
function gridTex(col = '#7d838c', dark = '#2a2d33') {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = col; x.fillRect(0, 0, 64, 64); x.fillStyle = dark;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) x.fillRect(i * 16 + 3, j * 8 + 2, 10, 4);
  x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, 0, 64, 1); x.fillRect(0, 0, 1, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}
function panelTex(col = '#c9cdd2') {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = col; x.fillRect(0, 0, 64, 64); x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 2; x.strokeRect(1, 1, 62, 30); x.strokeRect(1, 33, 62, 30);
  x.fillStyle = 'rgba(0,0,0,.25)'; for (const [a, b] of [[5, 5], [58, 5], [5, 27], [58, 27], [5, 37], [58, 37], [5, 59], [58, 59]]) x.fillRect(a - 1, b - 1, 2, 2);
  x.fillStyle = '#e8892b'; x.fillRect(0, 30, 64, 3);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Interiors {
  constructor(g) { this.g = g; this.list = []; this.cur = null; this.levers = []; }

  build(L, shell) {
    const I = L.interior; if (!I) return;
    const g = this.g, w = g.world, root = new THREE.Group(), y0 = w.heightAt(L.x, L.z) + (I.y0 || 0);
    root.position.set(L.x, y0, L.z); root.rotation.y = L.rot || 0; g.scene.add(root); root.updateMatrixWorld(true);
    const inner = new THREE.Group(); root.add(inner);
    const R = { L, I, root, inner, shell, y0, inv: root.matrixWorld.clone().invert(), floors: [], walls: [], ceils: [], lights: [], items: [], inside: false, cut: false };
    const gt = gridTex(), pt = panelTex(I.wall || '#c9cdd2');
    const M = { floor: mat('#ffffff', { map: gt }), wall: mat('#ffffff', { map: pt, side: THREE.DoubleSide }), trim: mat('#3a3d44'), rail: mat('#e8892b'), glow: new THREE.MeshBasicMaterial({ color: I.under || '#ff7a1a', toneMapped: false, side: THREE.DoubleSide }), lamp: new THREE.MeshBasicMaterial({ color: '#fff1c8', toneMapped: false }) };
    let par = inner; const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; par.add(o); return o; };
    // Залы: [x, z, w, d, h, floorY] — коробка с полом-решёткой, стенами, потолком, лампами; проёмы — по doors
    for (const room of I.rooms) {
      const [x, z, rw, rd, rh, fy = 0] = room.box, T = 0.25;
      if (room.outdoor) { R.floors.push({ x0: x - rw / 2, x1: x + rw / 2, z0: z - rd / 2, z1: z + rd / 2, y: fy, top: fy + 40, room, solid: !!room.solid });
        if (room.slab) { par = root; add(new THREE.BoxGeometry(rw, 0.3, rd), M.trim, x, fy - 0.15, z); for (const r of room.rails || []) { const [ax, az, bx, bz] = r, len = Math.hypot(bx - ax, bz - az); add(new THREE.BoxGeometry(0.08, 0.08, len), M.rail, (ax + bx) / 2, fy + 1, (az + bz) / 2, Math.atan2(bx - ax, bz - az)); R.walls.push([ax, az, bx, bz, fy, fy + 1.1]); } par = inner; }
        continue; }
      if (room.deck) { const d = add(new THREE.BoxGeometry(rw, 0.3, rd), M.floor, x, fy - 0.15, z); d.material = M.floor.clone(); d.material.map = gt.clone(); d.material.map.repeat.set(rw / 2, rd / 2); d.material.map.needsUpdate = true;
        R.floors.push({ x0: x - rw / 2, x1: x + rw / 2, z0: z - rd / 2, z1: z + rd / 2, y: fy, top: fy + 30, room });
        for (const r of room.rails || []) { const [ax, az, bx, bz] = r, len = Math.hypot(bx - ax, bz - az); add(new THREE.BoxGeometry(0.08, 0.08, len), M.rail, (ax + bx) / 2, fy + 1, (az + bz) / 2, Math.atan2(bx - ax, bz - az)); for (let k = 0; k <= Math.ceil(len / 2); k++) { const t = k / Math.ceil(len / 2); add(new THREE.BoxGeometry(0.07, 1, 0.07), M.rail, ax + (bx - ax) * t, fy + 0.5, az + (bz - az) * t); } R.walls.push([ax, az, bx, bz, fy, fy + 1.1]); }
        for (const [ux, uz] of room.posts || []) add(new THREE.BoxGeometry(0.3, fy, 0.3), M.trim, ux, fy / 2, uz);
        continue; }
      const f = add(new THREE.BoxGeometry(rw, T, rd), M.floor, x, fy - T / 2, z); f.material = M.floor.clone(); f.material.map = gt.clone(); f.material.map.repeat.set(rw / 2, rd / 2); f.material.map.needsUpdate = true;
      if (room.under) { f.material.emissive = new THREE.Color(I.under || '#ff7a1a'); f.material.emissiveMap = this.slotTex ||= gridTex('#000000', '#ffffff'); f.material.emissiveMap = f.material.emissiveMap.clone(); f.material.emissiveMap.repeat.set(rw / 2, rd / 2); f.material.emissiveMap.needsUpdate = true; f.material.emissiveIntensity = 1.4; }
      if (room.under) { const u = add(new THREE.PlaneGeometry(rw * 0.9, rd * 0.9), M.glow, x, fy - (room.underY || 0.4), z); u.rotation.x = -Math.PI / 2; const pl = new THREE.PointLight(I.under || '#ff7a1a', 30, 12, 1.6); pl.position.set(x, fy - 0.6, z); root.add(pl); R.lights.push(pl); }
      add(new THREE.BoxGeometry(rw, T, rd), M.trim, x, fy + rh + T / 2, z);
      R.floors.push({ x0: x - rw / 2, x1: x + rw / 2, z0: z - rd / 2, z1: z + rd / 2, y: fy, top: fy + rh, room });
      // стены: 4 стороны, проёмы {side:'n'|'s'|'e'|'w', at, w}
      const sides = { n: [x, z - rd / 2, rw, 0], s: [x, z + rd / 2, rw, 0], w: [x - rw / 2, z, rd, 1], e: [x + rw / 2, z, rd, 1] };
      for (const [s, [cx, cz, len, vert]] of Object.entries(sides)) { if ((room.open || []).includes(s)) continue;
        const holes = (room.doors || []).filter(d => d.side === s).map(d => [d.at - d.w / 2, d.at + d.w / 2, d.h || 3]).sort((a, b) => a[0] - b[0]);
        let t0 = -len / 2; const segs = [];
        for (const [a, b, hh] of holes) { if (a > t0) segs.push([t0, a, 0, rh]); if (rh > hh) segs.push([a, b, hh, rh]); t0 = b; }
        if (t0 < len / 2) segs.push([t0, len / 2, 0, rh]);
        for (const [a, b, ya, yb] of segs) { const L2 = b - a, m = (a + b) / 2; if (L2 < 0.05) continue;
          const geo = new THREE.BoxGeometry(vert ? T : L2, yb - ya, vert ? L2 : T); const wm = M.wall.clone(); wm.map = pt.clone(); wm.map.repeat.set(L2 / 3, (yb - ya) / 3); wm.map.needsUpdate = true;
          add(geo, wm, vert ? cx : cx + m, fy + (ya + yb) / 2, vert ? cz + m : cz);
          if (ya === 0) R.walls.push(vert ? [cx, cz + a, cx, cz + b, fy, fy + yb] : [cx + a, cz, cx + b, cz, fy, fy + yb]); }
      }
      // лампы под потолком
      const nl = Math.max(1, Math.round(rw * rd / 50));
      for (let i = 0; i < nl; i++) { const lx = x + (i + 0.5 - nl / 2) * (rw / nl); add(new THREE.BoxGeometry(1.4, 0.12, 0.35), M.lamp, lx, fy + rh - 0.1, z); }
      const pl = new THREE.PointLight(room.light || '#ffe2b0', 0, Math.max(rw, rd) * 1.3, 1.2); pl.position.set(x, fy + rh - 0.6, z); root.add(pl); R.lights.push(pl); pl.userData.base = room.lightI || 45;
      // поручни по краю «мостков» (room.rails)
      for (const r of room.rails || []) { const [ax, az, bx, bz] = r, len = Math.hypot(bx - ax, bz - az); const rr = add(new THREE.BoxGeometry(0.08, 0.08, len), M.rail, (ax + bx) / 2, fy + 1, (az + bz) / 2, Math.atan2(bx - ax, bz - az));
        for (let k = 0; k <= Math.ceil(len / 2); k++) { const t = k / Math.ceil(len / 2); add(new THREE.BoxGeometry(0.07, 1, 0.07), M.rail, ax + (bx - ax) * t, fy + 0.5, az + (bz - az) * t); }
        R.walls.push([ax, az, bx, bz, fy, fy + 1.1]); }
      if (room.under) { R.lights.push(...[]); }
    }
    // Пандусы/лестницы: [x0,z0,y0, x1,z1,y1, width] — пол по линии
    for (const s0 of I.ramps || []) { par = s0.out ? root : inner; const s = s0.p;
      const [ax, az, ay, bx, bz, by, wd] = s, len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az), n = Math.max(2, Math.round(len / 0.45));
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; const st = add(new THREE.BoxGeometry(wd, 0.18, len / n + 0.02), M.floor, ax + (bx - ax) * t, ay + (by - ay) * t - 0.09, az + (bz - az) * t, ang); st.material = M.trim; }
      R.floors.push({ ramp: s, len, ang });
      const ox = Math.cos(ang) * wd / 2, oz = -Math.sin(ang) * wd / 2;
      if (!s0.out) for (const sg of [-1, 1]) R.walls.push([ax + ox * sg, az + oz * sg, bx + ox * sg, bz + oz * sg, Math.min(ay, by), Math.max(ay, by) + 1.2, true]);
    }
    par = root;
    for (const [x1, z1, x2, z2] of I.hull || []) R.walls.push([x1, z1, x2, z2, -2, I.hullTop || 7]);
    // Вход: светящаяся рамка + маячки дорожки
    if (I.entry) { const [ex, ez, ew, eh] = I.entry; par = root;
      const vd = 2.6, vw = ew + 1.6, vh = eh + 1.2, vm = M.wall.clone(); vm.map = pt.clone(); vm.map.repeat.set(1, 1); vm.map.needsUpdate = true;
      add(new THREE.BoxGeometry(0.8, vh, vd), vm, ex - vw / 2 + 0.4, vh / 2, ez + vd / 2); add(new THREE.BoxGeometry(0.8, vh, vd), vm, ex + vw / 2 - 0.4, vh / 2, ez + vd / 2); add(new THREE.BoxGeometry(vw, 0.8, vd), vm, ex, vh - 0.4, ez + vd / 2);
      const dark = add(new THREE.PlaneGeometry(ew, eh), new THREE.MeshBasicMaterial({ color: '#2a1a10' }), ex, eh / 2, ez + 0.3); R.portal = dark;
      R.walls.push([ex - vw / 2 + 0.8, ez, ex - vw / 2 + 0.8, ez + vd, 0, vh], [ex + vw / 2 - 0.8, ez, ex + vw / 2 - 0.8, ez + vd, 0, vh]);
      R.floors.push({ x0: ex - vw / 2, x1: ex + vw / 2, z0: ez, z1: ez + vd, y: 0, top: vh - 0.8, room: { outdoor: true } });
      const fr = new THREE.MeshBasicMaterial({ color: '#ffcf6a', toneMapped: false });
      const fz = ez + vd + 0.05; add(new THREE.BoxGeometry(ew + 0.6, 0.3, 0.3), fr, ex, eh + 0.15, fz); add(new THREE.BoxGeometry(0.3, eh, 0.3), fr, ex - ew / 2 - 0.15, eh / 2, fz); add(new THREE.BoxGeometry(0.3, eh, 0.3), fr, ex + ew / 2 + 0.15, eh / 2, fz);
      const el = new THREE.PointLight('#ffb14a', 60, 22, 1.4); el.position.set(ex, eh * 0.7, ez + 2); root.add(el); R.entryLight = el;
      R.beacons = [];
      for (let k = 1; k <= (I.path || 6); k++) { const bz = ez + vd + (I.path0 || 8) + k * 5, bx = ex + Math.sin(k * 0.8) * 1.5; const wp = root.localToWorld(new THREE.Vector3(bx, 0, bz)); const by = w.heightAt(wp.x, wp.z) - y0;
        const b = add(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6), M.trim, bx, by + 0.6, bz); const cap = add(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb14a', toneMapped: false }), bx, by + 1.3, bz); R.beacons.push(cap); } }
    // Предметы: ящики (лут), предохранители (квест), рубильник
    for (const it of I.items || []) { const p = root.localToWorld(new THREE.Vector3(it.at[0], it.at[1] || 0, it.at[2]));
      if (it.kind === 'crate') { const o = g.models.instance(it.model || 'loot_crate'); o.position.copy(p); o.rotation.y = (L.rot || 0) + (it.rot || 0); g.scene.add(o);
        const c = { key: `in:${L.id}:${it.id}`, x: p.x, z: p.z, y: p.y, r: 2.4, table: it.table, name: it.name, obj: o, seed: [...(L.id + it.id)].reduce((a, ch) => a * 31 + ch.charCodeAt(0) >>> 0, 7) };
        g.explore.containers.push(c); g.explore.markOpened(c); R.items.push(c); }
      if (it.kind === 'fuse' || it.kind === 'switch') { const o = new THREE.Group(); o.position.copy(p); o.rotation.y = (L.rot || 0) + (it.rot || 0); g.scene.add(o);
        if (it.kind === 'fuse') { o.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 8), mat('#3a3d44'))); const core = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 8), new THREE.MeshBasicMaterial({ color: '#4ff0ff', toneMapped: false })); core.position.y = 0.05; o.add(core); o.children.forEach(m => m.position.y += 0.9); o.userData.core = core;
          const pd = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.6), mat('#5a5f68')); pd.position.y = 0.45; o.add(pd); }
        else { const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.5), mat('#5a5f68')); box.position.y = 1.1; o.add(box); for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.2), new THREE.MeshBasicMaterial({ color: '#552222', toneMapped: false })); s.position.set(-0.45 + k * 0.45, 1.5, 0.3); o.add(s); o.userData['slot' + k] = s; }
          const lev = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), mat('#e8892b')); lev.position.set(0, 0.8, 0.35); lev.rotation.x = 0.6; o.add(lev); o.userData.lev = lev; }
        this.levers.push({ ...it, L, R, obj: o, x: p.x, z: p.z, y: p.y }); }
    }
    // Перф: ступени/поручни/стойки/лампы с общим материалом → один меш на материал (было ~150 draw call на интерьер)
    mergeStatic(inner); mergeStatic(root);
    inner.visible = false;
    this.list.push(R);
    this.syncQuest(L);
    return R;
  }
  // ---------- Коллизии: игрок ----------
  local(x, z, y = 0) { const R = this._R; return new THREE.Vector3(x, y, z).applyMatrix4(R.inv); }
  floorAt(R, lx, lz, ly) {   // высота пола в локальной системе, только если игрок на уровне этого пола (±1.6 м)
    let best = null;
    for (const f of R.floors) {
      if (f.ramp) { const [ax, az, ay, bx, bz, by, wd] = f.ramp, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = ((lx - ax) * dx + (lz - az) * dz) / l2;
        if (t < -0.02 || t > 1.02) continue; const cx = ax + dx * t, cz = az + dz * t; if (Math.hypot(lx - cx, lz - cz) > wd / 2) continue; const y = ay + (by - ay) * Math.max(0, Math.min(1, t)); if (ly > y - 1.6 && ly < y + 1.6 && (best == null || y > best)) best = y; continue; }
      if (lx < f.x0 || lx > f.x1 || lz < f.z0 || lz > f.z1) continue; if ((f.solid ? ly < f.y + 1.6 : ly > f.y - 1.6 && ly < f.y + 1.6) && (best == null || f.y > best)) best = f.y;
    }
    return best;
  }
  groundAt(x, z, fallback) {
    let g = fallback; const py = this.g.player.pos.y;
    for (const R of this.list) { if (Math.hypot(x - R.L.x, z - R.L.z) > (R.L.r || 20) * 2.2) continue; this._R = R; const l = this.local(x, z, py); const f = this.floorAt(R, l.x, l.z, l.y);
      if (f != null) g = Math.max(g, f + R.y0); }
    return g;
  }
  ceilAt(x, z, y) {
    for (const R of this.list) { if (Math.hypot(x - R.L.x, z - R.L.z) > (R.L.r || 20) * 2.2) continue; this._R = R; const l = this.local(x, z, y);
      for (const f of R.floors) if (!f.ramp && !f.room.outdoor && !f.room.deck && l.x > f.x0 && l.x < f.x1 && l.z > f.z0 && l.z < f.z1 && l.y > f.y - 0.5 && l.y < f.top) return f.top + R.y0; }
    return null;
  }
  collide(q) {
    const py = this.g.player.pos.y;
    for (const R of this.list) { if (Math.hypot(q.x - R.L.x, q.z - R.L.z) > (R.L.r || 20) * 2.2) continue; this._R = R; const l = this.local(q.x, q.z, py); let moved = false;
      for (const [x1, z1, x2, z2, bot, top] of R.walls) { if (l.y > top - 0.2 || l.y + 1.7 < bot) continue;
        const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((l.x - x1) * dx + (l.z - z1) * dz) / l2));
        const cx = x1 + t * dx, cz = z1 + t * dz, ex = l.x - cx, ez = l.z - cz, d = Math.hypot(ex, ez), r = 0.45;
        if (d < r && d > 1e-4) { l.x = cx + ex / d * r; l.z = cz + ez / d * r; moved = true; } }
      if (moved) { const wpt = R.root.localToWorld(new THREE.Vector3(l.x, 0, l.z)); q.x = wpt.x; q.z = wpt.z; } }
  }
  // Камера внутри зала: луч герой→камера обрезается стенами и потолком текущей коробки (с запасом 0.4 м)
  camClamp(target, cp) {
    const R = this.inside; if (!R) return null;
    // Луч герой → камера по мешам интерьера (стены, потолки, перекрытия). Ближе 1.6 м — поднимаем камеру над головой (вид сверху-сзади)
    const meshes = R._cm ||= (() => { const a = []; R.root.traverse(o => { if (o.isMesh && o !== R.portal) a.push(o); }); return a; })();
    const dir = cp.clone().sub(target), len = dir.length(); if (len < 1e-3) return null; dir.divideScalar(len);
    const rc = this._rc ||= new THREE.Raycaster(); rc.set(target, dir); rc.far = len + 0.4;
    const hit = rc.intersectObjects(meshes, false).find(h => h.object.visible !== false && h.object.parent?.visible !== false);
    if (!hit) return null;
    const d = Math.max(0.3, hit.distance - 0.45);
    if (d > 1.6) return target.clone().addScaledVector(dir, d);
    // тесно: камера над героем, чуть сзади, под потолком
    const up = this.ceilAt(target.x, target.z, target.y), top = up != null ? up - 0.45 : target.y + 2.2;
    const out = target.clone().addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), 0.9); out.y = Math.min(top, target.y + 2.2); return out;
  }
  // Внутри ли игрок (над полом зала)
  insideOf(p) {
    for (const R of this.list) { if (Math.hypot(p.x - R.L.x, p.z - R.L.z) > (R.L.r || 20) * 2) continue; this._R = R; const l = this.local(p.x, p.z, p.y);
      for (const f of R.floors) if (!f.ramp && !f.room.outdoor && !f.room.deck && l.x > f.x0 - 0.2 && l.x < f.x1 + 0.2 && l.z > f.z0 - 0.2 && l.z < f.z1 + 0.2 && l.y > f.y - 0.8 && l.y < f.top) return R; }
    return null;
  }
  // ---------- Квест «предохранители → рубильник» ----------
  qs(L) { return ((this.g.state.lm ||= {})[L.id] ||= { fuses: 0, placed: 0, on: false, taken: {} }); }
  syncQuest(L) { const S = this.qs(L);
    for (const v of this.levers.filter(v => v.L === L)) {
      if (v.kind === 'fuse') { const got = !!S.taken[v.id]; v.obj.visible = !got; }
      if (v.kind === 'switch') { for (let k = 0; k < 3; k++) v.obj.userData['slot' + k].material.color.set(k < S.placed ? '#4ff0ff' : '#552222'); v.obj.userData.lev.rotation.x = S.on ? -0.6 : 0.6; }
    }
    const R = this.list.find(r => r.L === L); if (R) R.powered = S.on;
  }
  nearLever() { const p = this.g.player.pos; let best = null, bd = 2.6; for (const v of this.levers) { if (!v.obj.visible) continue; const d = Math.hypot(v.x - p.x, v.z - p.z); if (d < bd && Math.abs(p.y - v.y) < 2) { bd = d; best = v; } } return best; }
  use(v) {
    const g = this.g, L = v.L, S = this.qs(L), need = (L.interior.items || []).filter(i => i.kind === 'fuse').length;
    if (v.kind === 'fuse') { S.taken[v.id] = 1; S.fuses++; g.ui.toast(`🔌 Предохранитель ${S.fuses}/${need}`, 'rar-rare'); g.qa.event('fuse', { lm: L.id, n: S.fuses }); }
    else if (v.kind === 'switch') {
      if (S.on) { g.ui.toast(`${L.name}: уже работает`); return; }
      if (S.fuses > S.placed) { S.placed = S.fuses; g.ui.toast(`Вставлено предохранителей: ${S.placed}/${need}`); }
      if (S.placed >= need) { S.on = true; g.ui.banner?.(`${L.name} запущен!`, L.interior.reward_text || ''); g.qa.event('lm_power', { lm: L.id }); }
      else g.ui.toast(`Нужно ещё ${need - S.placed} — ищи в залах станции`, 'warn');
    }
    this.syncQuest(L); g.save();
  }
  // Бонус к терраформированию от запущенных станций
  gives() { const r = {}; for (const R of this.list) if (this.qs(R.L).on) for (const [k, v] of Object.entries(R.I.gives || {})) r[k] = (r[k] || 0) + v; return r; }
  // ---------- Кадр ----------
  update(dt) {
    const g = this.g, p = g.player.pos, t = performance.now() / 1000; const IN = this.insideOf(p);
    for (const R of this.list) {
      const near = Math.hypot(p.x - R.L.x, p.z - R.L.z) < (R.L.r || 20) * 3; if (!near && !R.cut) continue;
      const inside = IN === R; R.cutK = (R.cutK || 0) + ((inside ? 1 : 0) - (R.cutK || 0)) * Math.min(1, dt * 5);
      const cut = R.cutK > 0.5; if (cut !== R.cut) { R.cut = cut; if (R.shell) R.shell.visible = !cut; R.inner.visible = cut; if (R.portal) R.portal.visible = !cut; }
      for (const pl of R.lights) pl.intensity = (pl.userData.base ? pl.userData.base * (R.powered ? 1 : 0.35) * (0.94 + 0.06 * Math.sin(t * 13 + pl.id)) : 26 + 8 * Math.sin(t * 2)) * (near ? 1 : 0);
      if (R.entryLight) R.entryLight.intensity = 55 + 15 * Math.sin(t * 2.4);
      (R.beacons || []).forEach((b, i) => { const k = (Math.sin(t * 4 - i * 0.7) + 1) / 2; b.material.color.setRGB(1, 0.55 + 0.35 * k, 0.2 + 0.3 * k); b.scale.setScalar(0.8 + 0.4 * k); });
    }
    for (const v of this.levers) if (v.kind === 'fuse' && v.obj.visible) { v.obj.rotation.y += dt * 1.2; v.obj.userData.core.material.color.setHSL(0.52, 1, 0.55 + 0.15 * Math.sin(t * 5)); }
    this.inside = IN; g.player.indoor = g.player.indoor || !!IN;
    this.nearV = this.nearLever();
  }
}
