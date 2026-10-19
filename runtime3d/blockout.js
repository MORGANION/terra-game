// Блокинг гигантских точек интереса (без Tripo): примитивы с ходьбой по верхам, пандусами и коллизиями.
// Цель — оценить масштаб и маршрут до моделей. Данные — в коде (временно), зона — полярная шапка.
import * as THREE from 'three';
import { mergeStatic } from './models.js';
import { MeshCollider } from './meshcol.js';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.75, metalness: 0.1, ...o });

export class Blockout {
  constructor(g) { this.g = g; this.boxes = []; this.ramps = []; this.discs = []; this.rings = []; this.inTube = null; }

  build() {
    const g = this.g, w = g.world, F = (g.cfg.world.features || []).find(f => f.id === 'polar_cap'); if (!F) return;
    this.M = { ice: mat('#9fd6ef'), snow: mat('#eef4f8'), hull: mat('#e4e9ee', { side: THREE.DoubleSide }), orange: mat('#e8892b'), grey: mat('#9aa3ad'), snowD: mat('#f4f8fb', { side: THREE.DoubleSide }), orangeD: mat('#e8892b', { side: THREE.DoubleSide }), dark: mat('#3b4048'), green: mat('#6fcf5a'),
      iceT: mat('#c4ecff', { transparent: true, opacity: 0.55 }), lamp: new THREE.MeshBasicMaterial({ color: '#ffd59a', toneMapped: false }), cyan: new THREE.MeshBasicMaterial({ color: '#5ff3ff', toneMapped: false }), deck: mat('#59616c', { side: THREE.DoubleSide }), railGlass: new THREE.MeshBasicMaterial({ visible: false }) };
    this.grp = new THREE.Group(); g.scene.add(this.grp); this.podXZ = [];
    const toBase = Math.atan2(-F.z, -F.x);
    this.ringStation(F.x, F.z, toBase);
    const sh = (g.cfg.world.features || []).find(f => f.id === 'ice_shaft'); if (sh) this.shaft(sh);
    // Вмёрзшие грузовые капсулы по краю шапки — мини-точки без отделки
    let s = 77; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0, tries = 0; i < 7 && tries < 200; tries++) { const a = toBase + 0.9 + i * 0.75 + (R() - 0.5) * 0.5, r = 0.5 + R() * 0.35, x = F.x + Math.cos(a) * F.rx * r, z = F.z + Math.sin(a) * F.rz * r;
      if (w.slopeAt(x, z) > 0.18 || Math.hypot(x - F.x, z - F.z) < 60) continue; this.pod(x, z, R() * 6.28, i); this.podXZ.push([x, z, 9]); i++; }
    // Убрать региональный декор (ледяные стены, сухой лёд) из мест капсул и станции — чтобы не врастал
    for (const { ctl, list } of g.regionDecor || []) { let ch = false; list.forEach((t, i) => { if (this.podXZ.some(([x, z, r]) => Math.hypot(t.x - x, t.z - z) < r + t.scale)) { ctl.set(i, { visible: false }); if (t.solid) t.solid.r = 0; ch = true; } }); if (ch) ctl.flush(); }
    // коллайдер — ДО слияния (у слитых мешей теряются флаги noCol)
    this.col = new MeshCollider(); const M2 = this.M; this.col.add(this.grp, m => m.material === M2.lamp || m.material === M2.cyan || m.material?.side === THREE.BackSide || /outline/i.test(m.name || ''));
    mergeStatic(this.grp);
  }
  panelTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#eef2f6'; x.fillRect(0, 64, 128, 64);
    x.strokeStyle = 'rgba(90,100,115,.22)'; x.lineWidth = 2; x.strokeRect(2, 2, 124, 60); x.strokeRect(2, 66, 124, 60); x.beginPath(); x.moveTo(64, 2); x.lineTo(64, 62); x.stroke();
    x.fillStyle = 'rgba(60,70,85,.4)'; for (const [a, b] of [[9, 9], [119, 9], [9, 55], [119, 55], [9, 73], [119, 73], [9, 119], [119, 119]]) { x.beginPath(); x.arc(a, b, 2.5, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  add(geo, m, x, y, z, ry = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; this.grp.add(o); return o; }
  // Ящик: верх — пол, бока — стена
  box(x, y, z, sx, sy, sz, yaw, m, solid = true) { this.add(new THREE.BoxGeometry(sx, sy, sz), m, x, y, z, yaw); this.boxes.push({ x, y, z, sx, sy, sz, yaw, solid, r: Math.hypot(sx, sz) / 2 + 1 }); }
  ramp(ax, az, ay, bx, bz, by, wd, m) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), L3 = Math.hypot(len, by - ay);
    const o = new THREE.Mesh(new THREE.BoxGeometry(wd, 0.8, L3), m); o.position.set((ax + bx) / 2, (ay + by) / 2 - 0.4, (az + bz) / 2); o.rotation.set(-Math.asin((by - ay) / L3), Math.atan2(dx, dz), 0, 'YXZ'); o.castShadow = o.receiveShadow = true; this.grp.add(o);
    this.ramps.push([ax, az, ay, bx, bz, by, wd]);
  }
  disc(x, y, z, r, h, m) { this.add(new THREE.CylinderGeometry(r, r, h, 10), m, x, y - h / 2, z); this.discs.push({ x, y, z, r }); }
  chest(key, x, y, z, table, name, model = 'loot_crate', rot = 0) { const g = this.g, o = g.models.instance(model); o.position.set(x, y, z); o.rotation.y = rot; g.scene.add(o);
    const c = { key, x, y, z, r: 2.4, table, name, obj: o, seed: [...key].reduce((a, ch) => a * 31 + ch.charCodeAt(0) >>> 0, 7) }; g.explore.containers.push(c); g.explore.markOpened(c); }

  // ---------- 1. Кольцевая станция: лежащее кольцо-тоннель на ледяных опорах, вход — ледяной язык в открытый торец ----------
  ringStation(cx, cz, toBase) {
    const w = this.g.world, M = this.M, base = w.heightAt(cx, cz), R = 40, T = 8.5, cy = base + 15, N = 30, gap = 0.9;
    const gA = toBase - gap / 2, gB = toBase + gap / 2;   // разрыв кольца смотрит на базу
    const ring = { cx, cz, cy, R, T, floor: cy - T * 0.55, gA, gB, gap }; this.rings.push(ring);
    const seg = 2 * Math.PI * R / N * 1.03, up = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < N; k++) { const a = toBase + gap / 2 + (k + 0.5) * (2 * Math.PI - gap) / N, tan = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), px = cx + Math.cos(a) * R, pz = cz + Math.sin(a) * R;
      const q = new THREE.Quaternion().setFromUnitVectors(up, tan);
      const sh = { position: new THREE.Vector3(px, cy, pz) };
      if (k % 3 === 0) { const b = new THREE.Mesh(new THREE.TorusGeometry(T + 0.15, 0.55, 6, 20), M.orange); b.position.copy(sh.position); b.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)); b.userData.noCol = true; b.castShadow = false; this.grp.add(b);
        for (let m = 0; m < 6; m++) { const ang = m / 6 * Math.PI * 2 + 0.5, bx = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.7), M.grey); bx.position.set(Math.cos(ang) * (T + 0.6), Math.sin(ang) * (T + 0.6), 0); bx.rotation.z = ang; bx.userData.noCol = true; b.add(bx); } }
      // пол-решётка внутри, лампы, окна снаружи

      if (k % 2 === 0) { const lp = this.add(new THREE.BoxGeometry(1.2, 0.15, 0.4), M.lamp, px, cy + T * 0.78, pz, Math.atan2(tan.x, tan.z)); }
      if (k % 3 === 1) { const pl = new THREE.PointLight('#ffc98a', 70, 26, 1.3); pl.position.set(px, cy + 3, pz); this.grp.add(pl); }
      if (k % 3 !== 0) for (const side of [1, -1]) { const rr = R + side * (T * 0.97), wx = cx + Math.cos(a) * rr, wz = cz + Math.sin(a) * rr, yaw = Math.atan2(Math.cos(a), Math.sin(a)) + (side > 0 ? 0 : Math.PI);
        const rim = this.add(new THREE.CylinderGeometry(1.15, 1.15, 0.5, 12), M.dark, wx, cy + 1.2, wz); rim.lookAt(cx, cy + 1.2, cz); rim.rotateX(Math.PI / 2); rim.userData.noCol = true;
        const gl = this.add(new THREE.CylinderGeometry(0.85, 0.85, 0.56, 12), M.cyan, wx, cy + 1.2, wz); gl.lookAt(cx, cy + 1.2, cz); gl.rotateX(Math.PI / 2); gl.userData.noCol = true; }
      // опоры-ледяные колонны до земли
      if (k % 4 === 2) { const gy = w.heightAt(px, pz); { const top = cy - T * 0.92, h = top - gy + 2; this.add(new THREE.CylinderGeometry(3.4, 5, h, 6), M.ice, px, gy - 2 + h / 2, pz); } }
      // отсеки: грядки подо льдом, ящики, тела
      const ia = (R - T * 0.45), ix = cx + Math.cos(a) * ia, iz = cz + Math.sin(a) * ia;
      if (k % 9 === 4) { const ic = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 0), M.ice); ic.position.set(cx + Math.cos(a) * (R + T + 5.5), cy - T * 1.1, cz + Math.sin(a) * (R + T + 5.5)); ic.scale.set(1, 1.5, 1.2); this.grp.add(ic); }
    }
    { const NU = 90, NV = 14, B0 = -Math.asin(0.62), v = [], ix = [];
      for (let i = 0; i <= NU; i++) { const a = gB + i / NU * (2 * Math.PI - gap), ca = Math.cos(a), sa = Math.sin(a);
        for (let j = 0; j <= NV; j++) { const b = B0 + j / NV * (Math.PI - 2 * B0), rr = R + T * Math.cos(b); v.push(cx + ca * rr, cy + T * Math.sin(b), cz + sa * rr); } }   // дуга от пола и выше: под полом трубы нет (не мешает въезду)
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const A = i * (NV + 1) + j, B = A + NV + 1; ix.push(A, B, A + 1, A + 1, B, B + 1); }
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); tg.setIndex(ix); tg.computeVertexNormals();
      // UV: u — вдоль кольца (панели ~6 м), v — по окружности
      const uv = []; for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) uv.push(i / NU * (2 * Math.PI - gap) * R / 6, j / NV * 4); tg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const hm = M.hull.clone(); hm.map = this.panelTex(); hm.side = THREE.DoubleSide; hm.emissive = new THREE.Color('#2a3440'); hm.emissiveIntensity = 0.6; const tube = new THREE.Mesh(tg, hm); tube.castShadow = false; tube.receiveShadow = true; this.grp.add(tube);
      // снежная шапка: полоса сверху трубы, чуть шире, неровный край
      { const v2 = [], ix2 = [], NS = 6; for (let i = 0; i <= NU; i++) { const a = gB + i / NU * (2 * Math.PI - gap), ca = Math.cos(a), sa = Math.sin(a), wob = 0.08 * Math.sin(i * 1.7) + 0.05 * Math.sin(i * 4.3);
          for (let j = 0; j <= NS; j++) { const b = Math.PI / 2 + (j / NS - 0.5) * (1.5 + wob * 4), rr = R + (T + 0.25) * Math.cos(b); v2.push(cx + ca * rr, cy + (T + 0.25 + (j % NS ? 0.35 : 0)) * Math.sin(b), cz + sa * rr); } }
        for (let i = 0; i < NU; i++) for (let j = 0; j < NS; j++) { const A = i * (NS + 1) + j, B = A + NS + 1; ix2.push(A, B, A + 1, A + 1, B, B + 1); }
        const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(v2, 3)); sg.setIndex(ix2); sg.computeVertexNormals();
        const sn = new THREE.Mesh(sg, M.snowD); sn.receiveShadow = true; this.grp.add(sn); }
    }
    // Пол тоннеля: одна лента по дуге (без нахлёстов → без мерцания), верх с UV-плиткой; плинтусы — тоже лентами
    { const NU = 180, hw = T * 0.85, th = 0.3, v = [], uv = [], ix = [], y1 = ring.floor, y0 = ring.floor - th, L = (2 * Math.PI - gap) * R;
      for (let i = 0; i <= NU; i++) { const a = gB + i / NU * (2 * Math.PI - gap), ca = Math.cos(a), sa = Math.sin(a), u = i / NU * L / 4;
        for (const [rr, yy, vv] of [[R - hw, y1, 0], [R + hw, y1, hw * 2 / 4], [R - hw, y0, 0], [R + hw, y0, hw * 2 / 4]]) { v.push(cx + ca * rr, yy, cz + sa * rr); uv.push(u, vv); } }
      for (let i = 0; i < NU; i++) { const A = i * 4, B = A + 4; ix.push(A, A + 1, B, A + 1, B + 1, B, A + 2, B + 2, A + 3, A + 3, B + 2, B + 3); }
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); fg.setIndex(ix); fg.computeVertexNormals();
      const fm = this.floorMat().clone(); fm.map = fm.map.clone(); fm.map.repeat.set(1, 1); fm.map.needsUpdate = true; fm.side = THREE.DoubleSide;
      const fl = new THREE.Mesh(fg, fm); fl.receiveShadow = true; fl.castShadow = false; fl.userData.floorOnly = true; this.grp.add(fl);
      for (const sg of [-1, 1]) { const v2 = [], ix2 = [], r0 = R + sg * (hw - 0.05), r1 = R + sg * (hw + 0.4);
        for (let i = 0; i <= NU; i++) { const a = gB + i / NU * (2 * Math.PI - gap), ca = Math.cos(a), sa = Math.sin(a); for (const [rr, yy] of [[r0, y1 + 0.6], [r1, y1 + 0.6], [r0, y1 - 0.05], [r1, y1 - 0.05]]) v2.push(cx + ca * rr, yy, cz + sa * rr); }
        for (let i = 0; i < NU; i++) { const A = i * 4, B = A + 4; ix2.push(A, A + 1, B, A + 1, B + 1, B, A, B, A + 2, A + 2, B, B + 2); }
        const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(v2, 3)); pg.setIndex(ix2); pg.computeVertexNormals();
        const pm = new THREE.Mesh(pg, M.orangeD); pm.userData.noCol = true; pm.receiveShadow = true; this.grp.add(pm); } }
    this.tunnelRooms(ring);
    // Ледяная пробка в дальнем торце разрыва
    // Ледяная пробка: плоская ледяная стена-торец (заподлицо с концом трубы), снаружи — наплыв льда
    { const a = gA + 0.005, x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R, yaw = Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI / 2;
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(T * 0.99, T * 0.99, 1.2, 16), M.ice); wall.position.set(x, cy, z); wall.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))); this.grp.add(wall);   // торец заподлицо: ось — по касательной к кольцу
      }
    // Вход: ледяной язык от земли до торца (снаружи, со стороны базы)
    { const a = gB + 0.01, ex = cx + Math.cos(a) * R, ez = cz + Math.sin(a) * R, tan = [-Math.sin(a), Math.cos(a)];
      const len = (ring.floor - w.heightAt(ex - tan[0] * 30, ez - tan[1] * 30)) / Math.tan(22 * Math.PI / 180), sx = ex - tan[0] * len, sz = ez - tan[1] * len;
      this.ramp(sx, sz, w.heightAt(sx, sz), ex - tan[0] * 0.15, ez - tan[1] * 0.15, ring.floor, T * 1.5, M.snow);   // конец рампы = начало ленты пола (без ступеньки)
      for (let i = 1; i < 5; i++) { const t = i / 6, bx = sx + (ex - sx) * t, bz = sz + (ez - sz) * t, by = w.heightAt(sx, sz) + (ring.floor - w.heightAt(sx, sz)) * t;
        for (const sg of [-1, 1]) { const ic = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + (i % 3), 0), M.ice); ic.position.set(bx + tan[1] * sg * (T * 0.75 + 4.5), by - 1.5, bz - tan[0] * sg * (T * 0.75 + 4.5)); ic.scale.y = 1.2; ic.userData.noCol = true; this.grp.add(ic); } } }
    // Хаб — большой купол (как купол базы, ×4): заходишь через шлюз со стороны входа кольца; внутри — следы последней экспедиции
    const top = cy + T; this.hub(cx, cz, base, toBase, ring);
    // Спицы: мостки с крыши кольца на купол (верхний ярус)
    for (let i = 0; i < 3; i++) { const a = toBase + Math.PI / 3 + i * 2 * Math.PI / 3, r0 = this.hubR - 1, r1 = R - T * 0.3, mx = cx + Math.cos(a) * (r0 + r1) / 2, mz = cz + Math.sin(a) * (r0 + r1) / 2;
      this.box(mx, top - 0.6, mz, 4, 1.2, r1 - r0, Math.atan2(Math.cos(a), Math.sin(a)), M.dark); }
    // Подъём на крышу: ледниковый склон с тыла
    { const a = toBase + Math.PI, ox = cx + Math.cos(a) * (R + T * 0.2), oz = cz + Math.sin(a) * (R + T * 0.2), len = (top - base) / Math.tan(24 * Math.PI / 180), sx = cx + Math.cos(a) * (R + len), sz = cz + Math.sin(a) * (R + len);
      this.ramp(sx, sz, w.heightAt(sx, sz), ox, oz, top, 10, M.ice); }
  }
  // ---------- 2. Буровая над ледяной шахтой: спиральный спуск, внизу кристалл и сундук ----------
  shaft(f) {
    // Спуск: сплошная винтовая лента вдоль стены шахты (без щелей между плитами), бортик снаружи, перила изнутри, консоли в лёд
    const w = this.g.world, M = this.M, rim = w.heightAt(f.x + f.r * 1.6, f.z), bot = w.heightAt(f.x, f.z) + 0.3;
    const turns = 1.75, N = 120, W = 3.4, TH = 0.45, r0 = f.r * 0.62, a0 = 0;
    const P = [], ys = [];
    for (let i = 0; i <= N; i++) { const t = i / N, a = a0 + t * turns * 2 * Math.PI; P.push(a); ys.push(rim - (rim - bot - 0.06) * t); }   // низ ленты чуть выше пола дна — без мерцания
    const ribbon = (ri, ro, dy0, dy1, m, i0 = 0) => { const v = [], ix = [], N0 = N - i0;
      for (let i = i0; i <= N; i++) { const a = P[i], c = Math.cos(a), s2 = Math.sin(a), y = ys[i];
        v.push(f.x + c * ri, y + dy1, f.z + s2 * ri, f.x + c * ro, y + dy1, f.z + s2 * ro, f.x + c * ri, y + dy0, f.z + s2 * ri, f.x + c * ro, y + dy0, f.z + s2 * ro); }
      for (let i = 0; i < N0; i++) { const A = i * 4, B = A + 4;
        ix.push(A, B, A + 1, A + 1, B, B + 1);            // верх
        ix.push(A + 2, A + 3, B + 2, A + 3, B + 3, B + 2); // низ
        ix.push(A, A + 2, B, A + 2, B + 2, B);             // внутренний торец
        ix.push(A + 1, B + 1, A + 3, A + 3, B + 1, B + 3); } // внешний торец
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(ix); g.computeVertexNormals();
      const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; this.grp.add(o); return o; };
    ribbon(r0 - W / 2, r0 + W / 2, -TH, 0, M.deck);                 // полотно
    ribbon(r0 + W / 2 - 0.05, r0 + W / 2 + 0.35, -TH, 0.9, M.orange, 4); // бортик к стене
    ribbon(r0 - W / 2 + 0.02, r0 - W / 2 + 0.14, 1.0, 1.12, M.orange).userData.noCol = true; // поручень (не мешает камере)
    ribbon(r0 - W / 2 + 0.02, r0 - W / 2 + 0.14, -TH, 1.1, M.railGlass);   // невидимый барьер у перил — не упасть случайно
    for (let i = 0; i <= N; i += 6) { const a = P[i], y = ys[i], c = Math.cos(a), s2 = Math.sin(a);
      const st = this.add(new THREE.BoxGeometry(0.12, 1.1, 0.12), M.orange, f.x + c * (r0 - W / 2 + 0.08), y + 0.55, f.z + s2 * (r0 - W / 2 + 0.08)); st.userData.noCol = true;
      if (i % 12 === 0) { const br = this.add(new THREE.BoxGeometry(0.5, 1.6, 2.4), M.dark, f.x + c * (r0 + W / 2 + 1.2), y - 1.2, f.z + s2 * (r0 + W / 2 + 1.2), -a); br.userData.noCol = true;
        if (i % 24 === 0) { const l = this.add(new THREE.BoxGeometry(0.3, 0.3, 0.3), M.lamp, f.x + c * (r0 + W / 2 + 0.2), y + 1.2, f.z + s2 * (r0 + W / 2 + 0.2)); l.userData.noCol = true; const pl = new THREE.PointLight('#ffc98a', 35, 14, 1.4); pl.position.set(l.position.x, y + 1.6, l.position.z); this.grp.add(pl); } } }
    // мостик с края к началу спирали (по рельефу ровно, с перилами)
    { const ex = f.x + Math.cos(P[0]) * r0, ez = f.z + Math.sin(P[0]) * r0, sx = f.x + f.r * 1.9, len = sx - ex;
      this.add(new THREE.BoxGeometry(len + 1, TH, W), M.deck, (sx + ex) / 2, rim - TH / 2, ez);
      for (const sg of [-1, 1]) { const rl = this.add(new THREE.BoxGeometry(len + 1, 0.1, 0.1), M.orange, (sx + ex) / 2, rim + 1.05, ez + sg * (W / 2 - 0.05)); rl.userData.noCol = true; } }
    // лёгкая буровая мачта сбоку на краю (вместо «табурета»): видна издалека, не мешает
    { const mx = f.x - f.r * 1.7, mz = f.z + f.r * 0.6, my = w.heightAt(mx, mz);
      this.add(new THREE.BoxGeometry(3, 2, 3), M.dark, mx, my + 1, mz);
      const H = 26; for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const lg = this.add(new THREE.CylinderGeometry(0.25, 0.35, H, 6), M.orange, mx + dx * 1.1, my + H / 2, mz + dz * 1.1); }
      for (let k = 1; k < 6; k++) { const ring = this.add(new THREE.BoxGeometry(2.6, 0.2, 2.6), M.orange, mx, my + k * H / 6, mz); ring.userData.noCol = true; }
      const tip = this.add(new THREE.SphereGeometry(0.7, 8, 6), M.cyan, mx, my + H + 0.6, mz); tip.userData.noCol = true;
      const arm = this.add(new THREE.BoxGeometry(f.r * 1.7, 0.6, 0.6), M.dark, (mx + f.x) / 2, my + H - 2, (mz + f.z) / 2, Math.atan2(f.x - mx, f.z - mz) + Math.PI / 2); arm.userData.noCol = true;
      const cable = this.add(new THREE.CylinderGeometry(0.12, 0.12, my + H - 2 - bot, 6), M.dark, f.x, (my + H - 2 + bot) / 2, f.z); cable.userData.noCol = true;
      const drill = this.add(new THREE.ConeGeometry(1.2, 3, 8), M.hull, f.x, bot + 3, f.z); drill.rotation.x = Math.PI; }
    // Дно шахты: ровный ледяной пол по всей ширине (рельеф под спиралью проседает канавой — в неё проваливались)
    { const fr = r0 + W / 2 + 1.2, d = new THREE.Mesh(new THREE.CylinderGeometry(fr, fr, 8, 24), M.ice); d.position.set(f.x, bot - 4, f.z); d.receiveShadow = true; this.grp.add(d); }
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(3.5, 0), M.cyan); cr.position.set(f.x + 3.5, bot + 3, f.z + 2); cr.scale.y = 1.8; this.grp.add(cr);
    { const pl = new THREE.PointLight('#5ff3ff', 70, 30, 1.4); pl.position.set(f.x, bot + 5, f.z); this.grp.add(pl); }
    this.chest('bo:shaft:bottom', f.x - 3, bot, f.z - 2, 'lm_ice', 'Шахта: керн-контейнер', 'chest');
    const ib = Math.round(N * 0.3); this.chest('bo:shaft:body', f.x + Math.cos(P[ib]) * (r0 + 0.6), ys[ib], f.z + Math.sin(P[ib]) * (r0 + 0.6), 'body', 'Пропавший космонавт', 'suit_body', -P[ib]);
  }
  // ---------- Тоннель кольца: 5 отсеков по дуге, между ними переборки с проёмами ----------
  tunnelRooms(G) {
    const g = this.g, M = this.M, { cx, cz, R, T, floor } = G, span = 2 * Math.PI - G.gap, a0 = G.gB;
    const at = (t, off = 0, up = 0) => { const a = a0 + t * span, rr = R + off; return [cx + Math.cos(a) * rr, floor + up, cz + Math.sin(a) * rr, a]; };
    const yawT = a => Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI / 2;   // вдоль тоннеля
    const W = T * 1.6;   // ширина пола
    const bx = (sx, sy, sz, t, off, up, m, col = true, ry = 0) => { const [x, y, z, a] = at(t, off, up); const o = this.add(new THREE.BoxGeometry(sx, sy, sz), m, x, y, z, yawT(a) + ry); if (!col) o.userData.noCol = true; return o; };
    // переборки (кольцевые рамы с проёмом 5×4 — машина проезжает)
    for (const t of [0.04, 0.22, 0.42, 0.62, 0.82]) { for (const sg of [-1, 1]) bx(0.6, T * 1.4, (W - 5) / 2, t, sg * (2.5 + (W - 5) / 4), T * 0.7 - 0.6, this.hullMat(), true, Math.PI / 2);
      bx(0.6, T * 1.4 - 4.2, 5.2, t, 0, 4.2 + (T * 1.4 - 4.2) / 2 - 0.6, this.hullMat(), true, Math.PI / 2); bx(0.7, 0.3, 5.4, t, 0, 4.15, this.hazMat(), false, Math.PI / 2);
      for (const sg of [-1, 1]) bx(0.7, 4.2, 0.3, t, sg * 2.65, 2.1, this.hazMat(), false, Math.PI / 2);
      const [x, y, z] = at(t, 0, 3.6); const pl = new THREE.PointLight('#ffc98a', 30, 14, 1.4); pl.position.set(x, y, z); this.grp.add(pl); }
    const zl = (t, col, I = 45) => { const [x, y, z] = at(t, 0, T * 0.9); const pl = new THREE.PointLight(col, I, 26, 1.3); pl.position.set(x, y, z); this.grp.add(pl); };
    zl(0.12, '#ffffff', 40); zl(0.31, '#ff9ad8', 55); zl(0.52, '#7fd8ff', 55); zl(0.72, '#ffd59a', 40); zl(0.9, '#ffe08a', 35);
    // плинтус по обе стороны пола (закрывает стык с оболочкой)

    // 1) Шлюзовой отсек у входа: стойка скафандров, ящики
    for (let k = 0; k < 3; k++) { const [x, y, z, a] = at(0.075 + k * 0.012, W / 2 - 1.3); try { const su = g.models.instance('suit_body'); su.position.set(x, y + 1.1, z); su.rotation.set(-Math.PI / 2 + 0.1, yawT(a), 0, 'YXZ'); this.grp.add(su); } catch {} }
    for (let k = 0; k < 3; k++) bx(0.6, 2.2, 1, 0.13 + k * 0.012, -W / 2 + 0.7, 1.1, M.grey);
    { const [x, y, z, a] = at(0.1, 0, 0.05); const st = this.add(new THREE.BoxGeometry(W * 0.9, 0.04, 1), new THREE.MeshBasicMaterial({ color: '#f2c230' }), x, y, z, yawT(a) + Math.PI / 2); st.userData.noCol = true; }

    for (let k = 0; k < 4; k++) { const o = bx(0.8, 2.2, 0.6, 0.07 + k * 0.012, W / 2 - 0.8, 1.1, this.hullMat()); }
    this.chestAt('bo:t:airlock', ...at(0.12, -W / 2 + 1.2), 'crate', 'Шлюз: ящик', 'loot_crate');
    // 2) Оранжерея: грядки под ледяными колпаками в два ряда, зелёные ростки
    for (let k = 0; k < 6; k++) for (const sg of [-1, 1]) { const t = 0.25 + k * 0.025; bx(1.6, 0.6, 3.2, t, sg * (W / 2 - 1.4), 0.3, M.green); bx(1.8, 1.3, 3.4, t, sg * (W / 2 - 1.4), 0.75, M.iceT, false); }
    for (let k = 0; k < 6; k++) for (const sg of [-1, 1]) for (let m = 0; m < 3; m++) { let o; try { o = g.models.instance(m % 2 ? 'bush' : 'grass'); } catch { continue; } const [x, y, z] = at(0.25 + k * 0.025 + (m - 1) * 0.006, sg * (W / 2 - 1.4), 0.6); o.position.set(x, y, z); o.scale.multiplyScalar(0.7); this.grp.add(o); }
    for (let k = 0; k < 4; k++) { const l = bx(3, 0.1, 0.3, 0.26 + k * 0.035, 0, T * 1.05, new THREE.MeshBasicMaterial({ color: '#ff7ad0', toneMapped: false }), false, Math.PI / 2); }
    this.chestAt('bo:t:greenhouse', ...at(0.33, 0), 'body', 'Пропавший космонавт', 'suit_body');
    // 3) Лаборатория: столы-пульты, образцы в колбах (голубые цилиндры), кресло
    for (let k = 0; k < 4; k++) { bx(1.2, 1, 3, 0.45 + k * 0.035, W / 2 - 1.2, 0.5, M.dark); for (let m = 0; m < 3; m++) bx(0.35, 0.7, 0.35, 0.45 + k * 0.035, W / 2 - 1.2, 1.35, M.cyan, false, 0); }
    for (let k = 0; k < 3; k++) bx(1.2, 1.6, 0.4, 0.46 + k * 0.045, -W / 2 + 0.9, 1.2, this.hullMat());
    for (let k = 0; k < 4; k++) bx(1.4, 0.9, 0.08, 0.455 + k * 0.035, W / 2 - 1.75, 1.9, M.cyan, false, Math.PI / 2);
    this.chestAt('bo:t:lab', ...at(0.52, -W / 2 + 2), 'station', 'Лаборатория: контейнер с образцами', 'chest');
    // 4) Жилой отсек: койки-капсулы, столик, второй скафандр
    for (let k = 0; k < 4; k++) { bx(1.4, 0.8, 3, 0.65 + k * 0.035, W / 2 - 1.2, 0.4, this.hullMat()); bx(1.5, 0.15, 3.1, 0.65 + k * 0.035, W / 2 - 1.2, 1.4, M.orange, false); }
    bx(1.5, 0.8, 1.5, 0.7, -W / 2 + 1.5, 0.4, M.dark);
    this.chestAt('bo:t:bunks', ...at(0.74, -W / 2 + 1.5), 'body', 'Пропавший космонавт', 'suit_body');
    // 5) Склад у ледяной пробки: штабели, пробившийся лёд, главный ящик
    for (let k = 0; k < 7; k++) bx(1.2, 0.8, 0.8, 0.86 + (k % 4) * 0.02, (k % 2 ? 1 : -1) * (W / 2 - 1.2), 0.4 + (k > 3 ? 0.8 : 0), k % 2 ? M.orange : this.hullMat());
    for (let k = 0; k < 4; k++) for (let lv = 0; lv < 3; lv++) bx(1, 0.15, 2.6, 0.87 + k * 0.022, -W / 2 + 0.8, 0.6 + lv * 1.2, M.grey);
    for (let k = 0; k < 4; k++) for (let lv = 0; lv < 3; lv++) bx(0.8, 0.7, 0.8, 0.87 + k * 0.022, -W / 2 + 0.8, 1.05 + lv * 1.2, (k + lv) % 2 ? M.orange : this.hullMat(), false);
    { const [x, y, z, a] = at(0.9, W / 2 - 3); const fk = new THREE.Group(); fk.position.set(x, y, z); fk.rotation.y = yawT(a); this.grp.add(fk); const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 2.2), M.orange); b1.position.y = 0.9; fk.add(b1); const m1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.6, 0.15), M.grey); m1.position.set(0, 1.6, 1.2); fk.add(m1); for (const sx of [-0.6, 0.6]) for (const sz of [-0.8, 0.8]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 8), M.dark); wh.rotation.z = Math.PI / 2; wh.position.set(sx, 0.3, sz); fk.add(wh); } }
    this.chestAt('bo:t:store', ...at(0.93, 0), 'vault', 'Склад: сейф', 'chest');
  }
  chestAt(key, x, y, z, a, table, name, model) { this.chest(key, x, y, z, table, name, model, a); }
  // ---------- Хаб: купол со шлюзом и интерьером ----------
  hub(cx, cz, base, toBase, ring) {
    const g = this.g, w = g.world, M = this.M, r = 17, DH = 0.62; let mx = base; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; mx = Math.max(mx, w.heightAt(cx + Math.cos(a) * r, cz + Math.sin(a) * r), w.heightAt(cx + Math.cos(a) * r * 0.5, cz + Math.sin(a) * r * 0.5)); } const y0 = mx + 0.4; this.hubR = r;
    const H = r * DH, doorA = toBase;   // шлюз смотрит туда же, откуда вход в кольцо
    // пол-подиум (по нему ходят), борт-основание, полоса
    { const fl = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.6, 3, 40), this.floorMat()); fl.position.set(cx, y0 - 1.5, cz); fl.receiveShadow = true; this.grp.add(fl); }
    { const st = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.2, r + 0.2, 0.25, 40, 1, true), M.orangeD); st.position.set(cx, y0 + 0.5, cz); st.userData.noCol = true; this.grp.add(st); }
    // оболочка: непрозрачная нижняя «юбка» + стекло-рёбра сверху (стекло — не коллайдер, рёбра — тоже; стена — юбка)
    const skirtH = 3.2;
    { const sk = new THREE.Mesh(new THREE.CylinderGeometry(r, r, skirtH, 40, 1, true, Math.PI / 2 - doorA + 0.16, Math.PI * 2 - 0.32), this.hullMat()); sk.position.set(cx, y0 + skirtH / 2, cz); sk.castShadow = sk.receiveShadow = true; this.grp.add(sk); }
    const shell = new THREE.Group(); shell.position.set(cx, y0 + skirtH - 0.4, cz); this.grp.add(shell); this.hubShell = shell;
    const glass = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.22, roughness: 0.1, flatShading: true, side: THREE.DoubleSide, depthWrite: false }));
    glass.scale.y = DH; glass.userData.noCol = true; shell.add(glass);
    for (let k = 0; k < 10; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 4, 32, Math.PI), M.hull); t.rotation.y = k / 10 * Math.PI; t.scale.set(1, DH, 1); t.userData.noCol = true; shell.add(t); }
    for (const e of [0.4, 0.75]) { const rr = r * Math.cos(Math.asin(e)), t = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.18, 4, 40), M.hull); t.rotation.x = Math.PI / 2; t.position.y = r * e * DH; t.userData.noCol = true; shell.add(t); }
    // снег на макушке, маяк
    { const sn = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 16, 6, 0, Math.PI * 2, 0, 0.6), M.snowD); sn.scale.y = DH * 1.05; sn.position.y = r * DH * 0.42; sn.userData.noCol = true; shell.add(sn); }
    { const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 1, 12), M.orange); cap.position.y = H + 0.3; cap.userData.noCol = true; shell.add(cap);
      const bc = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), M.cyan); bc.position.y = H + 1.8; bc.userData.noCol = true; shell.add(bc);
      const pl = new THREE.PointLight('#5ff3ff', 80, 40, 1.4); pl.position.y = H + 2; shell.add(pl); }
    // шлюз-тамбур: проём шире машины (заезд марсоходом), раздвижные створки открыты, тёплый свет
    { const dx = Math.cos(doorA), dz = Math.sin(doorA), ox = cx + dx * (r + 1.0), oz = cz + dz * (r + 1.0), yaw = Math.atan2(dx, dz), Wd = 4.6, Hd = 3.0, D = 3.4;
      const dw = (sx, sy, sz, lx, ly, lz, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(ox + dx * lz + Math.cos(yaw) * lx, y0 + ly, oz + dz * lz - Math.sin(yaw) * lx); o.rotation.y = yaw; o.castShadow = o.receiveShadow = true; this.grp.add(o); return o; };
      dw(1.2, Hd + 0.6, D, -(Wd / 2 + 0.6), (Hd + 0.6) / 2, 0, this.hullMat()); dw(1.2, Hd + 0.6, D, Wd / 2 + 0.6, (Hd + 0.6) / 2, 0, this.hullMat());
      dw(Wd + 2.4, 0.8, D, 0, Hd + 0.4, 0, this.hullMat()); dw(Wd + 2.6, 0.25, D + 0.1, 0, Hd + 0.85, 0, M.orange).userData.noCol = true;
      const fr = new THREE.MeshBasicMaterial({ color: '#ffcf6a', toneMapped: false }); dw(Wd + 0.4, 0.2, 0.2, 0, Hd + 0.05, D / 2 + 0.05, fr).userData.noCol = true;
      // пандус от рельефа к полу шлюза
      const ex = ox + dx * (D / 2 + 6), ez = oz + dz * (D / 2 + 6); this.ramp(ex, ez, w.heightAt(ex, ez), ox + dx * (D / 2), oz + dz * (D / 2), y0, Wd + 1, M.dark);
      this.add(new THREE.BoxGeometry(Wd + 2.4, 0.4, D), M.dark, ox, y0 - 0.2, oz, yaw).userData.floorOnly = true;
      for (const sg of [-1, 1]) { const dr = dw(1.4, Hd - 0.1, 0.18, sg * (Wd / 2 - 0.1), (Hd - 0.1) / 2, D / 2 - 0.2, M.grey); dr.userData.noCol = true; dw(0.1, Hd - 0.4, 0.2, sg * (Wd / 2 - 0.6), Hd / 2, D / 2 - 0.1, M.orange).userData.noCol = true; }
      dw(0.6, 0.5, 0.15, Wd / 2 + 0.6, 1.5, D / 2 + 0.1, M.dark).userData.noCol = true; dw(0.3, 0.15, 0.05, Wd / 2 + 0.6, 1.6, D / 2 + 0.2, new THREE.MeshBasicMaterial({ color: '#5cd6a8', toneMapped: false })).userData.noCol = true;
      const el = new THREE.PointLight('#ffb14a', 60, 20, 1.4); el.position.set(ox + dx * 3, y0 + 3, oz + dz * 3); this.grp.add(el); }
    // освещение внутри
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4, pl = new THREE.PointLight('#ffd9a8', 45, 18, 1.3); pl.position.set(cx + Math.cos(a) * r * 0.5, y0 + 5, cz + Math.sin(a) * r * 0.5); this.grp.add(pl); }
    // ---- интерьер: «последняя экспедиция» ----
    const P = (lr, la, ly = 0) => { const a = doorA + Math.PI + la; return [cx + Math.cos(a) * lr, y0 + ly, cz + Math.sin(a) * lr, a]; };
    const put = (id, lr, la, rot = 0, sc = 1, ly = 0) => { let o; try { o = g.models.instance(id); } catch { return null; } const [x, y, z, a] = P(lr, la, ly); o.position.set(x, y, z); o.rotation.y = a + rot; o.scale.multiplyScalar(sc); this.grp.add(o); return o; };
    // 1) центральный стол-голокарта с замёрзшей Землёй/Марсом
    { const [x, y, z] = P(0, 0); this.add(new THREE.CylinderGeometry(1.8, 2.1, 0.9, 10), M.dark, x, y + 0.45, z); const gl = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshBasicMaterial({ color: '#5ff3ff', wireframe: true, transparent: true, opacity: 0.85, toneMapped: false }));
      gl.position.set(x, y + 2.4, z); gl.userData.noCol = true; this.grp.add(gl); this.holo = gl;
      const core = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12), new THREE.MeshBasicMaterial({ color: '#ff8a50', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false })); core.position.copy(gl.position); core.userData.noCol = true; this.grp.add(core);
      const eq = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.03, 4, 40), new THREE.MeshBasicMaterial({ color: '#5ff3ff', toneMapped: false })); eq.position.copy(gl.position); eq.rotation.x = Math.PI / 2 - 0.3; eq.userData.noCol = true; this.grp.add(eq);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.3, 1.4, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#5ff3ff', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })); beam.position.set(x, y + 1.5, z); beam.userData.noCol = true; this.grp.add(beam);
      const hl = new THREE.PointLight('#5ff3ff', 40, 14, 1.4); hl.position.set(x, y + 2.6, z); this.grp.add(hl); }
    // 2) «погибшая группа»: тела космонавтов кругом у стола (лутаются)
    for (let k = 0; k < 4; k++) { const [x, y, z, a] = P(3.6, -1.3 + k * 0.85); this.chest(`bo:hub:body${k}`, x, y, z, 'body', 'Пропавший космонавт', 'suit_body', a + Math.PI / 2 + k * 0.7); const c = g.explore.containers.at(-1); c.obj.scale.multiplyScalar(1.35); }
    // табуреты у голостола (место последнего совещания)
    for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + 0.3, [x0, y, z0] = P(0, 0); this.add(new THREE.CylinderGeometry(0.35, 0.35, 0.55, 8), M.orange, x0 + Math.cos(a) * 2.6, y + 0.28, z0 + Math.sin(a) * 2.6).userData.noCol = true; }
    // 3) марсоходы у стены (ангарная сторона): один целый, один вмёрзший
    put('rover', 11, 1.4, 0.4, 1); { const o = put('rover', 11.5, 2.2, -0.6, 1); if (o) { o.rotation.z = 0.25; const [x, y, z] = P(11.5, 2.2); const ic = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), M.iceT); ic.position.set(x, y + 1, z); ic.scale.set(1.3, 0.8, 1.6); ic.userData.noCol = true; this.grp.add(ic); } }
    // 4) «Кьюриосити»: исследовательский ровер-робот (собран из примитивов) + дроны
    this.curiosity(...P(11, -1.6), doorA);
    for (let k = 0; k < 3; k++) { const [x, y, z, a] = P(8 + k * 1.5, -2.5 + k * 0.35); this.drone(x, y + (k === 1 ? 0 : 0.25), z, a + k, k === 1); }
    // 5) ящики и сейф (главная награда — у дальней стены)
    for (let k = 0; k < 3; k++) { const [x, y, z, a] = P(13, Math.PI - 0.5 + k * 0.5); this.chest(`bo:hub:crate${k}`, x, y, z, 'station', 'Станция: ящик', 'loot_crate', a); }
    { const [x, y, z, a] = P(14, Math.PI); this.chest('bo:ring:hub', x, y, z, 'lm_ice', 'Станция: капитанский сейф', 'chest', a + Math.PI); }
    // 6) стеллажи и пульты по периметру (стоят у юбки — стенки купола)
    for (let k = 0; k < 8; k++) { const la = -2.6 + k * 0.62; if (Math.abs(la) < 0.5) continue; const [x, y, z, a] = P(r - 1.3, la); this.add(new THREE.BoxGeometry(2.4, 2.2, 0.9), this.hullMat(), x, y + 1.1, z, a + Math.PI / 2);
      const scr = this.add(new THREE.BoxGeometry(1.8, 0.7, 0.1), k % 3 ? M.cyan : M.lamp, x - Math.cos(a) * 0.48, y + 1.5, z - Math.sin(a) * 0.48, a + Math.PI / 2); scr.userData.noCol = true;
      for (let m = 0; m < 3; m++) this.add(new THREE.BoxGeometry(0.5, 0.35, 0.5), M.orange, x - Math.cos(a) * 0.1 + Math.cos(a + Math.PI / 2) * (m - 1) * 0.7, y + 2.4, z - Math.sin(a) * 0.1 + Math.sin(a + Math.PI / 2) * (m - 1) * 0.7, a).userData.noCol = true; }
    // 6b) центр не пустой: штабель грузовых ящиков у ангара и брошенный инструмент
    for (let k = 0; k < 5; k++) { const [x, y, z, a] = P(7.5 + (k % 2) * 1.3, 1.9 + (k > 2 ? 0.25 : 0), k > 3 ? 1.6 : 0); this.add(new THREE.BoxGeometry(1.2, 0.8, 0.8), k % 2 ? M.orange : this.hullMat(), x, y + 0.4, z, a + k).castShadow = true; }
    // 7) лёд пробился внутрь: глыба со стороны, противоположной ангару
    { const [x, y, z] = P(r - 3, -1.9); const ic = new THREE.Mesh(new THREE.IcosahedronGeometry(3.5, 0), M.ice); ic.position.set(x, y + 1.5, z); ic.scale.set(1.2, 1.4, 1); this.grp.add(ic); }
    this.podXZ?.push([cx, cz, r + 8]);
  }
  floorMat() { return this._fm ||= (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#5a6068'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#3c4148'; x.lineWidth = 2; for (let i = 0; i <= 64; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(64, i); x.stroke(); }
    x.fillStyle = '#e8892b'; x.fillRect(0, 30, 64, 4); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, flatShading: true }); })(); }
  hazMat() { return this._hz ||= (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 16; const x = c.getContext('2d'); x.fillStyle = '#f2c230'; x.fillRect(0, 0, 64, 16); x.fillStyle = '#1c1c1c'; for (let i = -16; i < 64; i += 16) { x.beginPath(); x.moveTo(i, 16); x.lineTo(i + 8, 0); x.lineTo(i + 16, 0); x.lineTo(i + 8, 16); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }); })(); }
  floorMat2() { return this._f2 ||= (() => { const m = this.floorMat().clone(); m.map = m.map.clone(); m.map.repeat.set(4, 2); m.map.needsUpdate = true; return m; })(); }
  hullMat() { return this._hm ||= (() => { const m = this.M.hull.clone(); m.map = this.panelTex(); m.map = m.map.clone(); m.map.repeat.set(6, 1); m.map.needsUpdate = true; m.side = THREE.DoubleSide; return m; })(); }
  // «Кьюриосити»: шестиколёсный робот-исследователь с мачтой-камерой и манипулятором
  curiosity(x, y, z, a) {
    const M = this.M, G = new THREE.Group(); G.position.set(x, y, z); G.rotation.y = a + 0.7; this.grp.add(G);
    const box = (sx, sy, sz, px, py, pz, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(px, py, pz); o.castShadow = true; G.add(o); return o; };
    box(2.2, 0.8, 3, 0, 1.3, 0, this.hullMat()); box(2.3, 0.15, 3.1, 0, 1.75, 0, M.orange);
    for (const sx of [-1.25, 1.25]) for (const sz of [-1.2, 0, 1.2]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.4, 10), M.dark); wh.rotation.z = Math.PI / 2; wh.position.set(sx, 0.45, sz); G.add(wh); }
    box(0.18, 2.2, 0.18, 0.6, 2.8, 1.1, M.grey); box(0.7, 0.45, 0.5, 0.6, 4, 1.1, M.grey); box(0.25, 0.2, 0.1, 0.45, 4, 1.38, M.cyan); box(0.25, 0.2, 0.1, 0.78, 4, 1.38, M.cyan);
    const arm = box(0.16, 0.16, 1.6, -0.7, 1.4, 2.1, M.grey); arm.rotation.x = 0.3; box(0.4, 0.4, 0.4, -0.7, 1.15, 2.85, M.dark);
    box(1.4, 0.5, 0.8, 0, 1.95, -1.3, M.dark);   // РИТЭГ сзади
    G.updateMatrixWorld(true);
  }
  drone(x, y, z, a, crashed) {
    const M = this.M, G = new THREE.Group(); G.position.set(x, y, z); G.rotation.set(crashed ? 0.5 : 0, a, crashed ? 0.3 : 0); this.grp.add(G);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.9), this.hullMat()); b.position.y = 0.2; G.add(b);
    for (const [px, pz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 10), M.orange); r.position.set(px, 0.32, pz); r.userData.noCol = true; G.add(r);
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1), M.grey); s.position.set(px / 2, 0.25, pz / 2); s.rotation.y = Math.atan2(px, pz); s.userData.noCol = true; G.add(s); }
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), M.cyan); e.position.set(0, 0.2, 0.46); e.userData.noCol = true; G.add(e);
  }
  pod(x, z, rot, i) {
    // Вмёрзшая капсула — модель Tripo (lm_pod, 1×0.56×0.67 в единицах size); коллизии — по её треугольникам
    const g = this.g, w = g.world, y = w.heightAt(x, z), S = 6.5 + (i % 3) * 1.2;
    let o; try { o = g.models.instance('lm_pod'); } catch { o = null; }
    if (o) { o.scale.multiplyScalar(S / 10); o.position.set(x, y - S * 0.1, z); o.rotation.y = rot; this.grp.add(o); }
    // сугроб у основания: приплюснутые гранёные холмики вокруг — «вмёрзла»
    for (let k = 0; k < 5; k++) { const aa = rot + k * 1.26 + 0.3, rr = S * (0.38 + 0.08 * (k % 2)), sx = x + Math.cos(aa) * rr, sz = z - Math.sin(aa) * rr;
      const dr = new THREE.Mesh(new THREE.IcosahedronGeometry(S * 0.22, 0), this.M.snow); dr.position.set(sx, w.heightAt(sx, sz) - S * 0.08, sz); dr.scale.set(1.4, 0.45, 1); dr.rotation.y = aa; dr.castShadow = dr.receiveShadow = true; this.grp.add(dr); }
    const a = rot + Math.PI / 2, d = S * 0.45, cx = x + Math.cos(a) * d, cz = z - Math.sin(a) * d;
    this.chest(`bo:pod:${i}`, cx, w.heightAt(cx, cz), cz, i % 3 ? 'crate' : 'body', i % 3 ? 'Грузовая капсула' : 'Пропавший космонавт', i % 3 ? 'loot_crate' : 'suit_body', rot);
  }
  update(dt) { if (this.holo) this.holo.rotation.y += dt * 0.5; }
  // ---------- Физика: по реальной геометрии (meshcol.js) ----------
  groundAt(x, z, g) { return this.col ? this.col.groundAt(x, z, this.g.player.pos.y, g) : g; }
  ceilAt(x, z, y) { return this.col ? this.col.ceilAt(x, z, y) : null; }
  collide(q) { if (this.col) this.col.collide(q, this.g.player.pos, this.g.player.pos.y); }
  // Камера: луч герой→камера по той же геометрии; упёрлись — подтягиваем
  camClamp(t, cp) {
    if (!this.col) return null; const p = this.g.player.pos; if (!this.rings.some(G => Math.hypot(p.x - G.cx, p.z - G.cz) < 140) && !this.near) return null;
    const k = this.col.ray(t, cp); if (k == null) return null; return t.clone().lerp(cp, Math.max(0.08, k - 0.06));
  }
}
