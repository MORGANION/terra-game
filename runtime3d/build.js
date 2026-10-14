// Модульное строительство: сетка 2 м — пол/крыша в ячейках, стены/окна/двери/стекло по рёбрам, колонны в углах.
// Детали ставятся с привязкой к сетке перед игроком, крутятся (R / кнопка), снимаются с возвратом ресурсов.
// Закрытая комната (пол + все 4 стороны + крыша) — герметична: внутри заправка O₂, как в куполе.
import * as THREE from 'three';

const G = 2;            // шаг сетки, м
const WALL_H = 2.6;     // высота этажа
const T = 0.16;         // толщина стен

const PAL = { metal: '#5b616b', hull: '#e8e2d6', trim: '#f08a3c', dark: '#3a3f47', glass: '#8fd8ff', floor: '#d9d1c2', roof: '#c9563a', soil: '#6b4a2e', leaf: '#5fbf5a', gold: '#ffcf4a' };
const mats = {};
const mat = (k, o = {}) => (mats[k + JSON.stringify(o)] ??= new THREE.MeshStandardMaterial({ color: PAL[k] || k, roughness: 0.8, flatShading: true, ...o }));
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; return b; };

// Геометрия деталей в локальных координатах. Стена — вдоль X, центр ребра в (0,0,0).
function makePiece(id) {
  const g = new THREE.Group();
  const H = WALL_H;
  if (id === 'b_floor') { g.add(box(G, 0.2, G, mat('floor'), 0, 0.1, 0)); g.add(box(G - 0.06, 0.03, G - 0.06, mat('#a89a86'), 0, 0.215, 0)); g.add(box(G - 0.2, 2, G - 0.2, mat('dark'), 0, -1, 0)); }
  if (id === 'b_roof') { g.add(box(G + 0.1, 0.18, G + 0.1, mat('roof'), 0, H + 0.09, 0)); g.add(box(G + 0.14, 0.06, 0.14, mat('trim'), 0, H + 0.2, G / 2)); g.add(box(0.5, 0.05, 0.5, mat('#fff3d0', { emissive: '#ffe2a0', emissiveIntensity: 1.5 }), 0, H - 0.02, 0)); }
  if (id === 'b_wall') { g.add(box(G, H, T, mat('hull'), 0, H / 2 + 0.2, 0)); g.add(box(G, 0.12, T + 0.04, mat('trim'), 0, 1.2, 0)); }
  if (id === 'b_window') {
    g.add(box(G, 0.9, T, mat('hull'), 0, 0.65, 0)); g.add(box(G, 0.6, T, mat('hull'), 0, H - 0.1, 0));
    g.add(box(0.4, 1.3, T, mat('hull'), -0.8, 1.75, 0)); g.add(box(0.4, 1.3, T, mat('hull'), 0.8, 1.75, 0));
    g.add(box(1.2, 1.3, 0.05, mat('glass', { transparent: true, opacity: 0.45, emissive: '#2a6080', emissiveIntensity: 0.3 }), 0, 1.75, 0));
  }
  if (id === 'b_door') {
    g.add(box(0.5, H, T, mat('hull'), -0.75, H / 2 + 0.2, 0)); g.add(box(0.5, H, T, mat('hull'), 0.75, H / 2 + 0.2, 0));
    g.add(box(1.0, 0.5, T, mat('hull'), 0, H - 0.05, 0)); g.add(box(1.1, 0.1, T + 0.06, mat('trim'), 0, H - 0.3, 0));
  }
  if (id === 'b_glass') { g.add(box(G, H, 0.06, mat('glass', { transparent: true, opacity: 0.35, emissive: '#2a6080', emissiveIntensity: 0.25 }), 0, H / 2 + 0.2, 0)); g.add(box(G, 0.14, T, mat('dark'), 0, 0.27, 0)); g.add(box(G, 0.14, T, mat('dark'), 0, H + 0.13, 0)); }
  if (id === 'b_pillar') { g.add(box(0.3, H + 0.2, 0.3, mat('dark'), 0, (H + 0.2) / 2, 0)); g.add(box(0.36, 0.14, 0.36, mat('trim'), 0, H + 0.1, 0)); }
  if (id === 'b_planter') { g.add(box(1.2, 0.45, 0.6, mat('trim'), 0, 0.225, 0)); g.add(box(1.1, 0.06, 0.5, mat('soil'), 0, 0.46, 0)); for (let i = -1; i <= 1; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), mat('leaf')); s.position.set(i * 0.35, 0.62, 0); g.add(s); } }
  if (id === 'b_beacon') { const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 120, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#fff0a0', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); beam.position.y = 63; beam.name = 'beam'; g.add(beam); const L = new THREE.PointLight('#ffcf4a', 30, 18, 1.5); L.position.y = 3; g.add(L); }
  if (id === 'b_beacon') { g.add(box(0.8, 0.4, 0.8, mat('dark'), 0, 0.2, 0)); g.add(box(0.2, 2.2, 0.2, mat('hull'), 0, 1.5, 0)); const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), mat('gold', { emissive: '#ffcf4a', emissiveIntensity: 2 })); s.position.y = 2.9; s.name = 'spin'; g.add(s); }
  return g;
}


// ---------- Модули (Planet Crafter-стиль): комната 4×4 м целиком, стыкуются бок о бок ----------
// Общие стороны соседних модулей открыты (одно помещение), внешняя дверь — шлюз, открывается при подходе.
const M = 4, MH = 3;
const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // 0: −z, 1: +x, 2: +z, 3: −x
const DOOR_W = 1.6;
function sideFrame(s, i, j) { // центр ребра и поворот (стена вдоль локальной X)
  const cx = i * M + M / 2, cz = j * M + M / 2, [a, b] = SIDES[s];
  return { x: cx + a * M / 2, z: cz + b * M / 2, rot: s % 2 ? Math.PI / 2 : 0, out: [a, b] };
}
function makeSide(kind, glass, H) {
  const g = new THREE.Group(), L = M, hull = mat('hull'), gl = mat('glass', { transparent: true, opacity: 0.35, emissive: '#2a6080', emissiveIntensity: 0.3 });
  const panel = (w, x) => {
    if (glass) { g.add(box(w, H - 0.5, 0.06, gl, x, H / 2 + 0.05, 0)); g.add(box(w, 0.22, T, mat('dark'), x, 0.11 + 0.2, 0)); }
    else { g.add(box(w, 0.95, T, hull, x, 0.475 + 0.2, 0)); g.add(box(w, 0.75, 0.05, gl, x, 1.55 + 0.2, 0)); g.add(box(w, H - 1.95, T, hull, x, 1.93 + 0.2 + (H - 1.95) / 2, 0)); g.add(box(w + 0.01, 0.1, T + 0.04, mat('trim'), x, 1.12 + 0.2, 0)); }
  };
  if (kind === 'wall') panel(L, 0);
  if (kind === 'door') {
    const w = (L - DOOR_W) / 2; panel(w, -(DOOR_W / 2 + w / 2)); panel(w, DOOR_W / 2 + w / 2);
    g.add(box(DOOR_W, H - 2.3, T, hull, 0, 2.3 + 0.2 + (H - 2.3) / 2, 0));
    g.add(box(DOOR_W + 0.2, 0.14, T + 0.08, mat('trim'), 0, 2.37, 0));
    for (const sgn of [-1, 1]) { const d = box(DOOR_W / 2, 2.1, 0.1, mat('#d0c8b8'), sgn * DOOR_W / 4, 1.25, 0); d.add(box(0.06, 1.6, 0.12, mat('trim'), -sgn * DOOR_W / 4 + sgn * 0.05, 0, 0)); d.name = 'door' + sgn; d.userData.x0 = d.position.x; g.add(d); }
    const lamp = box(0.5, 0.1, 0.14, mat('#5cd6a8', { emissive: '#5cd6a8', emissiveIntensity: 1.6 }), 0, 2.6, T); lamp.name = 'doorlamp'; g.add(lamp);
  }
  return g;
}
// Стилизованный модуль: корпус из Tripo (hab_module) + врезки: шлюз-дверь, переходы к соседям, сваи до земли
function makeModuleGLB(models, id, sides, footY) {
  const g = new THREE.Group(), HS = 3.3;   // высота корпуса
  const hull = models.instance('hab_module'); hull.name = 'hullroof';
  const bb = new THREE.Box3().setFromObject(hull), hh = bb.max.y - bb.min.y || 1; hull.scale.y = HS / hh; hull.position.y = 0.12;
  if (id === 'm_glass') hull.traverse(c => { if (c.isMesh && c.name !== 'outline') { c.material = c.material.clone(); c.material.color = new THREE.Color('#bfe9ff'); } });
  g.add(hull);
  // Срез для вида изнутри: пол + невысокие стенки (показываются, когда корпус скрыт)
  const cut = new THREE.Group(); cut.name = 'cutaway'; cut.visible = false; g.add(cut);
  g.add(box(M, 0.25, M, mat('floor'), 0, 0.125, 0));
  sides.forEach((k, s) => { if (k === 'open') return; const [a, b] = SIDES[s], q = new THREE.Group();
    for (const [w0, x0] of k === 'door' ? [[(3.7 - DOOR_W) / 2, -(DOOR_W / 2 + (3.7 - DOOR_W) / 4)], [(3.7 - DOOR_W) / 2, DOOR_W / 2 + (3.7 - DOOR_W) / 4]] : [[3.7, 0]]) { q.add(box(w0, 0.9, 0.14, mat('hull'), x0, 0.7, 0)); q.add(box(w0 + 0.02, 0.12, 0.16, mat('#9b3a22'), x0, 1.1, 0)); } q.position.set(a * 1.85, 0, b * 1.85); q.rotation.y = s % 2 ? Math.PI / 2 : 0; cut.add(q); });
  const fd = Math.max(0.3, footY);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.add(box(0.3, fd + 0.4, 0.3, mat('metal'), a * 1.3, -fd / 2 - 0.2, b * 1.3)); g.add(box(0.7, 0.12, 0.7, mat('#9b3a22'), a * 1.3, -fd - 0.3, b * 1.3)); }
  const roof = new THREE.Group(); roof.name = 'roof'; g.add(roof);
  sides.forEach((k, s) => {
    const [a, b] = SIDES[s], f = new THREE.Group(); f.position.set(a * 1.85, 0, b * 1.85); f.rotation.y = s % 2 ? Math.PI / 2 : 0; f.name = 'side' + s; g.add(f);
    if (k === 'open') { // короткий переход-рукав к соседу (по половине с каждой стороны)
      const tube = box(2.0, 2.5, 0.36, mat('hull'), 0, 1.4, 0.06); f.add(tube); f.add(box(2.1, 0.16, 0.38, mat('#9b3a22'), 0, 2.55, 0.06)); f.add(box(2.1, 0.16, 0.38, mat('#9b3a22'), 0, 0.25, 0.06));
    }
    if (k === 'door') { // шлюз: выступающий тамбур с раздвижными створками
      f.add(box(DOOR_W + 0.5, 2.45, 0.7, mat('hull'), 0, 1.35, 0.2)); f.add(box(DOOR_W + 0.56, 0.16, 0.74, mat('#9b3a22'), 0, 2.55, 0.2));
      f.add(box(DOOR_W + 0.04, 2.1, 0.06, mat('#2a2622'), 0, 1.3, 0.56));
      for (const sgn of [-1, 1]) { const d = box(DOOR_W / 2, 2.05, 0.08, mat('#d9cfbd'), sgn * DOOR_W / 4, 1.28, 0.6); d.add(box(0.07, 1.5, 0.1, mat('#9b3a22'), -sgn * DOOR_W / 4 + sgn * 0.06, 0, 0)); d.name = 'door' + sgn; d.userData.x0 = d.position.x; f.add(d); }
      const lamp = box(0.6, 0.1, 0.1, mat('#5cd6a8', { emissive: '#5cd6a8', emissiveIntensity: 1.6 }), 0, 2.42, 0.6); lamp.name = 'doorlamp'; f.add(lamp);
    }
  });
  return g;
}
function makeModule(id, sides, footY) {
  const g = new THREE.Group(), glass = id === 'm_glass', H = MH;
  g.add(box(M, 0.25, M, mat('floor'), 0, 0.125, 0));
  g.add(box(M - 0.1, 0.03, M - 0.1, mat('#a89a86'), 0, 0.26, 0));
  const fd = Math.max(0.3, footY);   // глубина до самой низкой точки земли
  g.add(box(M - 0.1, 0.35, M - 0.1, mat('metal'), 0, -0.175, 0));
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.add(box(0.28, H + 0.25, 0.28, mat('dark'), a * M / 2, (H + 0.25) / 2, b * M / 2));
    const leg = box(0.32, fd + 0.4, 0.32, mat('metal'), a * (M / 2 - 0.35), -fd / 2 - 0.2, b * (M / 2 - 0.35)); g.add(leg); g.add(box(0.7, 0.12, 0.7, mat('dark'), a * (M / 2 - 0.35), -fd - 0.3, b * (M / 2 - 0.35))); }
  const roof = new THREE.Group(); roof.name = 'roof';
  roof.add(box(M + 0.12, 0.22, M + 0.12, glass ? mat('glass', { transparent: true, opacity: 0.35, emissive: '#2a6080', emissiveIntensity: 0.3 }) : mat('hull'), 0, H + 0.11 + 0.2, 0));
  if (!glass) { roof.add(box(M + 0.2, 0.1, 0.2, mat('trim'), 0, H + 0.3, M / 2)); roof.add(box(M + 0.2, 0.1, 0.2, mat('trim'), 0, H + 0.3, -M / 2)); roof.add(box(1.2, 0.4, 1.2, mat('dark'), 0.6, H + 0.5, -0.6)); }
  roof.add(box(1.2, 0.05, 1.2, mat('#fff3d0', { emissive: '#ffe2a0', emissiveIntensity: 1.6 }), 0, H + 0.17, 0));
  g.add(roof);
  sides.forEach((k, s) => { if (k === 'open') return; const f = makeSide(k, glass, H); const [a, b] = SIDES[s]; f.position.set(a * M / 2, 0, b * M / 2); f.rotation.y = s % 2 ? Math.PI / 2 : 0; f.name = 'side' + s; g.add(f); });
  return g;
}

// ---------- Купол: большой круглый модуль со шлюзом (стартовый на базе + крафтовый) ----------
const DOME_H = 0.62;   // сплюснутость полусферы (большие купола)
const domeH = r => Math.max(DOME_H, 2.9 / r);   // малые — ближе к полусфере, чтобы герой не упирался головой
function makeDome(r, doorA) {
  const g = new THREE.Group(), DOME_H = domeH(r);
  { const fl = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.05, r - 0.05, 0.2, 40), mat('floor')); fl.position.y = 0.1; fl.receiveShadow = true; g.add(fl); }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.12, r + 0.45, 3.6, 40, 1, true), mat('hull', { side: THREE.DoubleSide })); base.position.y = -1.33; g.add(base);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.16, r + 0.2, 0.12, 40, 1, true), mat('#9b3a22', { side: THREE.DoubleSide })); stripe.position.y = 0.42; g.add(stripe);
  const shell = new THREE.Group(); shell.name = 'shell'; g.add(shell);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 7, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.26, roughness: 0.1, flatShading: true, side: THREE.DoubleSide, depthWrite: false }));
  glass.scale.y = DOME_H; glass.position.y = 0.45; glass.name = 'glass'; shell.add(glass);
  const rib = mat('hull');
  for (let k = 0; k < 8; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 4, 28, Math.PI), rib); t.rotation.y = k / 8 * Math.PI; t.scale.set(1, DOME_H, 1); t.position.y = 0.45; shell.add(t); }
  for (const e of [0.35, 0.7]) { const rr = r * Math.cos(Math.asin(e)), t = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.07, 4, 40), rib); t.rotation.x = Math.PI / 2; t.position.y = 0.45 + r * e * DOME_H; shell.add(t); }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 0.3, 12), mat('#9b3a22')); cap.position.y = 0.45 + r * DOME_H; shell.add(cap);
  const lamp = new THREE.PointLight('#fff0d0', 6, r * 2.2, 1.5); lamp.position.y = r * DOME_H; g.add(lamp);
  // Шлюз: выступающий тамбур с раздвижными створками
  const door = new THREE.Group(); door.name = 'dome_door'; door.position.set(Math.cos(doorA) * (r + 0.1), 0, Math.sin(doorA) * (r + 0.1)); door.rotation.y = -doorA + Math.PI / 2; door.scale.setScalar(0.82); g.add(door);
  door.add(box(2.5, 2.8, 1.2, mat('hull'), 0, 1.4, 0.2)); door.add(box(2.56, 0.18, 1.24, mat('#9b3a22'), 0, 2.85, 0.2));
  door.add(box(1.9, 2.3, 1.26, mat('#2a2622'), 0, 1.25, 0.2));
  for (const sgn of [-1, 1]) { const d = box(0.95, 2.25, 0.08, mat('#d9cfbd'), sgn * 0.475, 1.22, 0.84); d.add(box(0.07, 1.6, 0.1, mat('#9b3a22'), -sgn * 0.42, 0, 0)); d.name = 'door' + sgn; d.userData.x0 = d.position.x; door.add(d); }
  const dl = box(0.7, 0.12, 0.1, mat('#5cd6a8', { emissive: '#5cd6a8', emissiveIntensity: 1.6 }), 0, 2.6, 0.84); dl.name = 'doorlamp'; door.add(dl);
  return g;
}
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

export class Builder {
  constructor(game) {
    this.g = game; this.cfg = game.cfg;
    this.P = Object.fromEntries((game.cfg.build_pieces || []).map(p => [p.id, p]));
    this.P.__dome = { id: '__dome', name: 'Купол базы', kind: 'dome', r: 3.75, cost: {}, base: true };
    game.state.house ??= [];      // [{id, i, j, e?, lvl, rot}]
    game.state.modules ??= [];    // [{id, i, j, y, doors:[side]}]
    game.state.domes ??= [];      // [{x, z, y, r, door}] — крафтовые купола
    this.domes = [];              // все купола (стартовый + из сейва): {x,z,y,r,door,obj,starter}
    this.mobjs = new Map();
    this.objs = new Map();        // key → Object3D
    this.mode = null;             // { id, rot, ghost }
    this.beacons = [];
  }
  kind(id) { return this.P[id]?.kind || 'deco'; }
  key(p) { return `${p.id === 'b_roof' ? 'r' : this.kind(p.id)}:${p.i},${p.j},${p.e ?? ''}`; }
  populate() { for (const p of this.g.state.house) this.spawn(p, false); for (const m of this.g.state.modules) this.spawnModule(m, false); for (const d of this.g.state.domes) this.addDome(d, false); }
  // ---------- Купола ----------
  addDome(d, fresh) {
    if (d.y == null) { let hi = -Infinity; for (let a = 0; a < 16; a++) for (const k of [0, 0.5, 0.95]) { const an = a / 16 * Math.PI * 2; hi = Math.max(hi, this.g.world.heightAt(d.x + Math.cos(an) * d.r * k, d.z + Math.sin(an) * d.r * k)); } d.y = +hi.toFixed(2); }
    const o = makeDome(d.r, d.door); o.position.set(d.x, d.y, d.z); this.g.scene.add(o);
    const D = { ...d, obj: o, src: d }; this.domes.push(D);
    if (fresh) { o.scale.setScalar(0.01); (this.g.pop ||= []).push({ o, t: 0 }); }
    return D;
  }
  domeAt(x, z, pad = 0) { return this.domes.find(D => Math.hypot(x - D.x, z - D.z) < D.r - 0.35 + pad); }
  domeTarget() {
    const pl = this.g.player, f = pl.forward(), r = this.P[this.mode.id].r || 6, x = pl.pos.x + f.x * (r + 2.5), z = pl.pos.z + f.z * (r + 2.5);
    let lo = Infinity, hi = -Infinity; for (let a = 0; a < 16; a++) for (const k of [0, 0.5, 0.95]) { const an = a / 16 * Math.PI * 2, h = this.g.world.heightAt(x + Math.cos(an) * r * k, z + Math.sin(an) * r * k); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    return { x: +x.toFixed(2), z: +z.toFixed(2), r, y: +hi.toFixed(2), lo, door: Math.atan2(pl.pos.z - z, pl.pos.x - x) + this.mode.rot * Math.PI / 2 };
  }
  domeOk(d) {
    if (d.y - d.lo > 3) return 'слишком крутой склон';
    if (this.g.world.waterAt(d.x, d.z) > d.lo) return 'вода';
    if (this.domes.some(D => Math.hypot(D.x - d.x, D.z - d.z) < D.r + d.r + 1)) return 'мешает другой купол';
    if ((this.g.cfg.world.props || []).some(p => Math.hypot(p.x - d.x, p.z - d.z) < d.r + 3)) return 'мешает шаттл';
    if ((this.g.explore?.wrecks || []).some(w => !w.gone && Math.hypot(w.x - d.x, w.z - d.z) < d.r + 1.5)) return 'мешают обломки';
    if (this.g.state.modules.some(m => Math.hypot(m.i * M + M / 2 - d.x, m.j * M + M / 2 - d.z) < d.r + 3)) return 'мешает модуль';
    if (this.g.state.buildings.some(b => b.y == null && Math.hypot(b.x - d.x, b.z - d.z) < d.r + 1)) return 'мешает постройка';
    return null;
  }
  // ---------- Модули ----------
  modAt(i, j) { return this.g.state.modules.find(m => m.i === i && m.j === j); }
  modOfPos(x, z) { return this.modAt(Math.floor(x / M), Math.floor(z / M)); }
  sidesOf(m) { return SIDES.map(([a, b], s) => this.modAt(m.i + a, m.j + b) ? 'open' : (m.doors || []).includes(s) ? 'door' : 'wall'); }
  groundRange(i, j) { let lo = Infinity, hi = -Infinity; for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++) { const h = this.g.world.heightAt(i * M + a, j * M + b); lo = Math.min(lo, h); hi = Math.max(hi, h); } return [lo, hi]; }
  spawnModule(m, fresh) {
    const k = 'M:' + m.i + ',' + m.j, old = this.mobjs.get(k); if (old) this.g.scene.remove(old);
    const [lo] = this.groundRange(m.i, m.j);
    const o = this.g.models.protos.hab_module ? makeModuleGLB(this.g.models, m.id, this.sidesOf(m), m.y - lo + 0.3) : makeModule(m.id, this.sidesOf(m), m.y - lo + 0.3);
    o.position.set(m.i * M + M / 2, m.y, m.j * M + M / 2); o.userData.m = m;
    // Пандус к двери, если пол выше земли
    for (const s of m.doors || []) { if (this.modAt(m.i + SIDES[s][0], m.j + SIDES[s][1])) continue; const f = sideFrame(s, m.i, m.j), gx = f.x + f.out[0] * 1.6, gz = f.z + f.out[1] * 1.6, dh = m.y + 0.25 - this.g.world.heightAt(gx, gz); if (dh < 0.25) continue;
      const len = Math.hypot(2, dh), r = box(DOOR_W, 0.12, len, mat('metal'), 0, 0, 0); const rg = new THREE.Group(); rg.add(r); rg.position.set(f.out[0] * (M / 2 + 1), 0.25 - dh / 2, f.out[1] * (M / 2 + 1)); rg.rotation.y = Math.atan2(f.out[0], f.out[1]); r.rotation.x = Math.atan2(dh, 2); for (const sg of [-1, 1]) { const rail = box(0.06, 0.06, len, mat('trim'), sg * (DOOR_W / 2 - 0.03), 0.9, 0); r.add(rail); } o.add(rg); }
    this.g.scene.add(o); this.mobjs.set(k, o);
    if (fresh) { o.scale.setScalar(0.01); (this.g.pop ||= []).push({ o, t: 0 }); }
    this.solidsDirty = true; this.hiddenFor = null;
  }
  refreshAround(m) { this.spawnModule(m, false); for (const [a, b] of SIDES) { const n = this.modAt(m.i + a, m.j + b); if (n) this.spawnModule(n, false); } }
  modTarget() {
    const pl = this.g.player, f = pl.forward(), ax = pl.pos.x + f.x * 3.6, az = pl.pos.z + f.z * 3.6;
    const m = { id: this.mode.id, i: Math.floor(ax / M), j: Math.floor(az / M) };
    // Дверь — по умолчанию на стороне к игроку, R перебирает стороны
    const cx = m.i * M + M / 2, cz = m.j * M + M / 2, dx = pl.pos.x - cx, dz = pl.pos.z - cz;
    const toward = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 2 : 0);
    const nb = SIDES.map(([a, b]) => this.modAt(m.i + a, m.j + b)).find(Boolean);
    // Одна дверь на связную постройку: пристройка — без двери; R у пристройки добавляет дверь на выбранную сторону
    m.doors = !nb ? [(toward + this.mode.rot) % 4] : this.mode.rot ? [(toward + this.mode.rot - 1) % 4] : [];
    const [lo, hi] = this.groundRange(m.i, m.j);
    m.y = +(nb ? nb.y : hi + 0.05).toFixed(2); m.lo = lo; m.hi = hi;
    return m;
  }
  modOk(m) {
    if (this.modAt(m.i, m.j)) return 'занято';
    const cx = m.i * M + M / 2, cz = m.j * M + M / 2;
    if (this.g.world.waterAt(cx, cz) > this.g.world.heightAt(cx, cz)) return 'вода';
    if (m.hi > m.y + 0.35) return 'земля выше пола — ставь ниже или на ровном';
    if (m.y - m.lo > 4) return 'слишком высоко над землёй';
    if (this.g.state.buildings.some(b => b.y == null && b.x > m.i * M - 0.8 && b.x < m.i * M + M + 0.8 && b.z > m.j * M - 0.8 && b.z < m.j * M + M + 0.8)) return 'мешает постройка';
    return null;
  }

  // Мировая позиция детали
  place(p) {
    const k = this.kind(p.id), x0 = p.i * G, z0 = p.j * G;
    let x = x0 + G / 2, z = z0 + G / 2, rot = p.rot || 0;
    if (k === 'wall') { if (p.e === 0) { z = z0; rot = 0; } else { x = x0; rot = Math.PI / 2; } if (p.e === 0) x = x0 + G / 2; else z = z0 + G / 2; }
    if (k === 'post') { x = x0; z = z0; }
    return { x, z, rot };
  }
  baseY(p) { return this.g.state.houseBase?.[`${p.i},${p.j}`] ?? this.g.world.heightAt(p.i * G + G / 2, p.j * G + G / 2); }

  spawn(p, fresh) {
    const o = makePiece(p.id), { x, z, rot } = this.place(p);
    // Все детали дома в ячейке стоят на одном уровне — на высоте первого пола (или земли)
    const y = this.levelY(p);
    o.position.set(x, y, z); o.rotation.y = rot;
    this.g.scene.add(o); this.objs.set(this.key(p), o);
    if (p.id === 'b_beacon') this.beacons.push(o);
    if (fresh) { o.scale.setScalar(0.01); (this.g.pop ||= []).push({ o, t: 0 }); }
    this.solidsDirty = true;
  }
  // Уровень детали: сохраняется в p.y. Новая деталь рядом с домом берёт уровень соседей (дом ровный),
  // иначе — максимум земли по углам (пол не тонет на склоне, под ним видна «подушка»-фундамент).
  levelY(p) {
    if (p.y != null) return p.y;
    const k = this.kind(p.id);
    if (k === 'deco') return this.floorAt(p.x, p.z) ?? this.g.world.heightAt(p.x, p.z);
    const { x, z } = this.place(p);
    const near = this.g.state.house.find(q => q.y != null && this.kind(q.id) !== 'deco' && Math.hypot((q.i - p.i) * G, (q.j - p.j) * G) <= G * 1.6);
    if (near) return near.y;
    let h = -Infinity; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) h = Math.max(h, this.g.world.heightAt(x + a * G / 2, z + b * G / 2));
    return h;
  }
  floorAt(x, z) { const i = Math.floor(x / G), j = Math.floor(z / G); const f = this.g.state.house.find(p => p.id === 'b_floor' && p.i === i && p.j === j); return f ? f.y + 0.22 : null; }

  // ---------- Режим строительства ----------
  start(id) {
    const P = this.P[id]; if (!P) return false;
    if (P.recipe) { const r = this.g.cfg.recipes.find(x => x.id === P.recipe); if (!r || !this.g.take(this.g.costOf(r))) { this.g.ui.toast('Не хватает ресурсов', 'warn'); return false; } this.cancel(); this.g.startPlacing(r, this.g.costOf(r)); return true; }
    this.cancel();
    const ghost = P.kind === 'module' || P.kind === 'dome' ? new THREE.Group() : makePiece(id);
    ghost.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.5; c.castShadow = false; } });
    this.g.scene.add(ghost);
    this.mode = { id, rot: 0, ghost };
    this.g.placing = { builder: true }; // UI показывает «Поставить/Отмена»
    return true;
  }
  cancel() { if (this.mode) { this.g.scene.remove(this.mode.ghost); this.mode = null; } if (this.g.placing?.builder) this.g.placing = null; }
  // Готовый купол (скрафчен, не поставлен) — можно поставить позже через «Стройку»
  rotate() { if (this.mode) { this.mode.rot = (this.mode.rot + 1) % (this.kind(this.mode.id) === 'module' ? 5 : 4); this.mode.gk = null; } }
  // Куда ставим: ячейка перед игроком; для стен — ребро ячейки, обращённое к игроку (с учётом поворота R)
  target() {
    const pl = this.g.player, f = pl.forward(), k = this.kind(this.mode.id);
    const ax = pl.pos.x + f.x * 2.6, az = pl.pos.z + f.z * 2.6;
    const i = Math.floor(ax / G), j = Math.floor(az / G);
    const p = { id: this.mode.id, i, j, lvl: 0 };
    if (k === 'wall') {
      // ребро ближе к игроку + поворот R перебирает 4 стороны
      const fx = ax - i * G, fz = az - j * G;
      const sides = [[0, 0, fz], [1, 0, fx], [0, 1, G - fz], [1, 1, G - fx]].sort((a, b) => a[2] - b[2]);
      const [e, shift] = sides[this.mode.rot % 4];
      p.e = e; if (shift) { if (e === 0) p.j += 1; else p.i += 1; }
    } else if (k === 'post') { p.i = Math.round(ax / G); p.j = Math.round(az / G); }
    else if (k === 'deco') { p.x = ax; p.z = az; p.rot = this.mode.rot * Math.PI / 2 + pl.obj.rotation.y; }
    else p.rot = this.mode.rot * Math.PI / 2;
    return p;
  }
  canPlace(p) {
    const k = this.kind(p.id);
    if (k === 'deco') return !this.g.state.house.some(q => this.kind(q.id) === 'deco' && Math.hypot(q.x - p.x, q.z - p.z) < 1.1) && this.g.world.slopeAt(p.x, p.z) < 0.35;
    if (this.objs.has(this.key(p))) return false;
    const { x, z } = this.place(p);
    if (this.g.world.waterAt(x, z) > this.g.world.heightAt(x, z)) return false;
    if (p.id === 'b_roof') return this.g.state.house.some(q => this.kind(q.id) === 'wall' && this.cellHasEdge(p.i, p.j, q)) || this.g.state.house.some(q => q.id === 'b_pillar');
    // не ставить пол на крутой склон
    if (k === 'floor') { const hs = [[0, 0], [G, 0], [0, G], [G, G]].map(([a, b]) => this.g.world.heightAt(p.i * G + a, p.j * G + b)); if (Math.max(...hs) - Math.min(...hs) > 1.6) return false; }
    return true;
  }
  cellHasEdge(i, j, q) { return (q.e === 0 && q.i === i && (q.j === j || q.j === j + 1)) || (q.e === 1 && q.j === j && (q.i === i || q.i === i + 1)); }
  confirm() {
    if (!this.mode) return false;
    if (this.kind(this.mode.id) === 'dome') {
      const d = this.domeTarget(), P = this.P[this.mode.id], why = this.domeOk(d);
      if (why) { this.g.ui.toast('Сюда нельзя: ' + why, 'warn'); return false; }
      if (P.base) { delete d.lo; this.g.state.baseDome = d; delete this.g.state.domeKit; this.g.spawnBaseDome(d, true); this.solidsDirty = true; this.cancel();
        this.g.qa.event('dome_place'); this.g.ui.toast('Купол установлен — заходи через шлюз'); this.g.save(); return true; }
      if (!this.g.take(P.cost)) { this.g.ui.toast('Не хватает ресурсов', 'warn'); return false; }
      delete d.lo; this.g.state.domes.push(d); this.addDome(d, true); this.solidsDirty = true; this.cancel();
      this.g.qa.event('house', { id: P.id }); this.g.save(); return true;
    }
    if (this.kind(this.mode.id) === 'module') {
      const m = this.modTarget(), P = this.P[m.id], why = this.modOk(m);
      if (why) { this.g.ui.toast('Сюда нельзя: ' + why, 'warn'); return false; }
      if (!this.g.take(P.cost)) { this.g.ui.toast('Не хватает ресурсов', 'warn'); return false; }
      delete m.lo; delete m.hi; this.g.state.modules.push(m); this.spawnModule(m, true); this.refreshAround(m);
      this.g.qa.event('house', { id: m.id }); this.g.life?.quest('build', 1); this.g.save();
      if (!this.g.has(P.cost)) { this.cancel(); this.g.ui.toast('Ресурсы на модуль кончились'); }
      return true;
    }
    const p = this.target(), P = this.P[p.id];
    if (!this.canPlace(p)) { this.g.ui.toast('Сюда нельзя: занято, склон или вода', 'warn'); return false; }
    if (!this.g.take(P.cost)) { this.g.ui.toast('Не хватает ресурсов', 'warn'); return false; }
    p.y = +this.levelY(p).toFixed(2);
    this.g.state.house.push(p); this.spawn(p, true);
    if (P.store) this.g.storages.push(this.storageOf(p));
    this.g.qa.event('house', { id: p.id }); this.g.life?.quest('build', 1); this.g.save();
    // режим остаётся — можно ставить подряд, пока хватает ресурсов
    if (!this.g.has(P.cost)) { this.cancel(); this.g.ui.toast('Ресурсы на эту деталь кончились'); }
    return true;
  }
  storageOf(p) { return { key: 'h:' + this.key(p), x: p.x ?? p.i * G + G / 2, z: p.z ?? p.j * G + G / 2, slots: this.P[p.id].store, name: this.P[p.id].name.replace(/\s*\(.*\)/, '') }; }
  // Снять ближайшую деталь перед игроком — ресурсы возвращаются
  removeNear() {
    const pl = this.g.player, f = pl.forward(), ax = pl.pos.x + f.x * 0.8, az = pl.pos.z + f.z * 0.8;
    let best = null, bd = 2.6;
    const pd = this.domes.find(D => !D.starter && Math.hypot(pl.pos.x - (D.x + Math.cos(D.door) * (D.r + 1.5)), pl.pos.z - (D.z + Math.sin(D.door) * (D.r + 1.5))) < 2.2);
    if (pd) { const P = this.P.m_dome; this.g.scene.remove(pd.obj); this.domes.splice(this.domes.indexOf(pd), 1); this.g.state.domes.splice(this.g.state.domes.indexOf(pd.src), 1);
      for (const [k2, v] of Object.entries(P.cost)) this.g.state.inv[k2] = (this.g.state.inv[k2] || 0) + v; this.solidsDirty = true; this.g.save(); this.g.ui.toast(`Разобрано: ${P.name}`); return true; }
    const pm = this.modOfPos(pl.pos.x + f.x * 2.5, pl.pos.z + f.z * 2.5) || this.modOfPos(pl.pos.x, pl.pos.z);
    if (pm && !this.g.state.house.some(p => { const { x, z } = p.x != null ? p : this.place(p); return Math.hypot(x - ax, z - az) < 1.2; })) {
      const P = this.P[pm.id]; this.g.state.modules.splice(this.g.state.modules.indexOf(pm), 1);
      const k = 'M:' + pm.i + ',' + pm.j; this.g.scene.remove(this.mobjs.get(k)); this.mobjs.delete(k);
      for (const [a, b] of SIDES) { const n = this.modAt(pm.i + a, pm.j + b); if (n) this.spawnModule(n, false); }
      for (const [k2, v] of Object.entries(P.cost)) this.g.state.inv[k2] = (this.g.state.inv[k2] || 0) + v;
      this.solidsDirty = true; this.hiddenFor = null; this.g.save(); this.g.ui.toast(`Разобрано: ${P.name}`); return true;
    }
    for (const p of this.g.state.house) { const { x, z } = p.x != null ? p : this.place(p); const d = Math.hypot(x - ax, z - az); if (d < bd) { bd = d; best = p; } }
    if (!best) return false;
    const P = this.P[best.id];
    if (P.store) { const st = this.storageOf(best); const S = this.g.state.stash[st.key]; if (S && Object.keys(S).length) { this.g.ui.toast('Сначала освободи сундук', 'warn'); return false; } this.g.storages = this.g.storages.filter(s => s.key !== st.key); }
    this.g.state.house.splice(this.g.state.house.indexOf(best), 1);
    const o = this.objs.get(this.key(best)); if (o) { this.g.scene.remove(o); this.objs.delete(this.key(best)); this.beacons = this.beacons.filter(b => b !== o); }
    for (const [k, v] of Object.entries(P.cost)) this.g.state.inv[k] = (this.g.state.inv[k] || 0) + v;
    this.solidsDirty = true; this.g.save(); this.g.ui.toast(`Разобрано: ${P.name}`);
    return true;
  }

  // ---------- Физика стен и герметичность ----------
  // Стены — отрезки; дверь проходима. Игрока выталкиваем из стен (вызывается после движения).
  collide(pos) {
    if (this.solidsDirty) { this.segs = this.g.state.house.filter(p => this.kind(p.id) === 'wall' && !this.P[p.id].pass).map(p => { const x0 = p.i * G, z0 = p.j * G; return p.e === 0 ? [x0, z0, x0 + G, z0] : [x0, z0, x0, z0 + G]; }); this.solidsDirty = false; }
    if (this.solidsDirty || !this.msegs) {
      this.msegs = [];
      for (const m of this.g.state.modules) this.sidesOf(m).forEach((k, s) => { if (k === 'open') return; const f = sideFrame(s, m.i, m.j), ax = s % 2 ? 0 : 1, az = s % 2 ? 1 : 0, h = M / 2, top = m.y + MH + 0.4, bot = m.y - 0.6;
        if (k === 'wall') this.msegs.push([f.x - ax * h, f.z - az * h, f.x + ax * h, f.z + az * h, bot, top]);
        else { const e = DOOR_W / 2; this.msegs.push([f.x - ax * h, f.z - az * h, f.x - ax * e, f.z - az * e, bot, top], [f.x + ax * e, f.z + az * e, f.x + ax * h, f.z + az * h, bot, top]); } });
    }
    const py = this.g.player.pos.y, P0 = this.g.player.pos;
    for (const D of this.domes) { if (py > D.y + D.r * domeH(D.r) + 0.5) continue;
      const dx = pos.x - D.x, dz = pos.z - D.z, d = Math.hypot(dx, dz), was = Math.hypot(P0.x - D.x, P0.z - D.z);
      if (Math.abs(d - D.r) > 0.5 || d < 1e-3) continue;
      if (angDiff(Math.atan2(dz, dx), D.door) < 0.75 / D.r) continue;                    // проём шлюза
      const R = was < D.r ? D.r - 0.5 : D.r + 0.5; pos.x = D.x + dx / d * R; pos.z = D.z + dz / d * R; }
    for (const [x1, z1, x2, z2, bot, top] of this.msegs) { if (py > top || py < bot - 1.5) continue;
      const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((pos.x - x1) * dx + (pos.z - z1) * dz) / l2));
      const cx = x1 + t * dx, cz = z1 + t * dz, ex = pos.x - cx, ez = pos.z - cz, d = Math.hypot(ex, ez), r = 0.42;
      if (d < r && d > 1e-4) { pos.x = cx + ex / d * r; pos.z = cz + ez / d * r; } }
    for (const [x1, z1, x2, z2] of this.segs || []) {
      const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((pos.x - x1) * dx + (pos.z - z1) * dz) / l2));
      const cx = x1 + t * dx, cz = z1 + t * dz, ex = pos.x - cx, ez = pos.z - cz, d = Math.hypot(ex, ez), r = 0.42;
      if (d < r && d > 1e-4) { pos.x = cx + ex / d * r; pos.z = cz + ez / d * r; }
    }
  }
  // Ячейка герметична: пол, крыша и 4 ребра закрыты (двери тоже считаются — шлюз)
  sealed(i, j) {
    const H = this.g.state.house, has = (id, ii, jj) => H.some(p => p.id === id && p.i === ii && p.j === jj);
    if (!has('b_floor', i, j) || !has('b_roof', i, j)) return false;
    const wall = (e, ii, jj) => H.some(p => this.kind(p.id) === 'wall' && p.e === e && p.i === ii && p.j === jj);
    // ребро между соседними закрытыми ячейками тоже ок (большая комната)
    const open = (e, ii, jj, ni, nj) => !wall(e, ii, jj) && !(has('b_floor', ni, nj) && has('b_roof', ni, nj));
    if (open(0, i, j, i, j - 1) || open(0, i, j + 1, i, j + 1) || open(1, i, j, i - 1, j) || open(1, i + 1, j, i + 1, j)) return false;
    return true;
  }
  inside(pos) { if (this.domeAt(pos.x, pos.z) && pos.y < (this.domeAt(pos.x, pos.z).y + 3)) return true; const m = this.modOfPos(pos.x, pos.z); if (m && pos.y > m.y - 0.3 && pos.y < m.y + MH) return true; return this.sealed(Math.floor(pos.x / G), Math.floor(pos.z / G)); }
  // Пол дома/модуля — по нему ходим (выше земли); у дверей модулей — пандус
  groundAt(x, z, fallback) {
    const D = this.domeAt(x, z, 0.5); if (D) return Math.max(fallback, D.y + 0.2);
    for (const D of this.domes) { const ox = x - (D.x + Math.cos(D.door) * D.r), oz = z - (D.z + Math.sin(D.door) * D.r), c = Math.cos(D.door), sn = Math.sin(D.door), along = ox * c + oz * sn, lat = Math.abs(-ox * sn + oz * c);
      if (along > -0.6 && along < 3 && lat < 1.1) { const top = D.y + 0.2; if (top > fallback) return Math.max(fallback, top - (top - this.g.world.heightAt(D.x + c * (D.r + 3), D.z + sn * (D.r + 3))) * Math.max(0, Math.min(1, along / 3))); } }
    const m = this.modOfPos(x, z); if (m) return Math.max(fallback, m.y + 0.25);
    for (const q of this.g.state.modules) for (const s of q.doors || []) {
      const f = sideFrame(s, q.i, q.j), ox = x - f.x, oz = z - f.z, d = ox * f.out[0] + oz * f.out[1], lat = Math.abs(ox * f.out[1] - oz * f.out[0]);
      if (d > 0 && d < 2.2 && lat < DOOR_W / 2 + 0.1) { const top = q.y + 0.25; if (top > fallback) return Math.max(fallback, top - (top - this.g.world.heightAt(f.x + f.out[0] * 2, f.z + f.out[1] * 2)) * Math.min(1, d / 2)); }
    }
    const f = this.floorAt(x, z); return f != null && f > fallback ? f : fallback;
  }
  ceilAt(x, z, y) { const D = this.domeAt(x, z); if (D && y < D.y + 4) { const d = Math.hypot(x - D.x, z - D.z); return D.y + 0.45 + Math.sqrt(Math.max(0, D.r * D.r - d * d)) * domeH(D.r) - 0.15; } const m = this.modOfPos(x, z); return m && y < m.y + MH && y > m.y - 0.5 ? m.y + 0.2 + MH : null; }

  update(dt) {
    if (this.mode && this.kind(this.mode.id) === 'dome') {
      const d = this.domeTarget(), key = [Math.round(d.x), Math.round(d.z), d.y, this.mode.rot].join();
      if (key !== this.mode.gk) { this.mode.gk = key; this.g.scene.remove(this.mode.ghost); const gh = makeDome(d.r, d.door); gh.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.45; c.castShadow = false; } if (c.isLight) c.intensity = 0; });
        gh.position.set(d.x, d.y, d.z); this.g.scene.add(gh); this.mode.ghost = gh; this.mode.why = this.domeOk(d); }
      const ok = !this.mode.why && this.g.has(this.P[this.mode.id].cost); this.mode.ghost.traverse(c => { if (c.isMesh) c.material.emissive?.set(ok ? '#1a6a2a' : '#7a1010'); }); this.mode.ok = ok;
    } else if (this.mode && this.kind(this.mode.id) === 'module') {
      const m = this.modTarget(), key = [m.i, m.j, m.y, m.doors[0], this.mode.id].join();
      if (key !== this.mode.gk) { this.mode.gk = key; this.g.scene.remove(this.mode.ghost); const tmp = { ...m }; this.g.state.modules.push(tmp); const sides = this.sidesOf(tmp); this.g.state.modules.pop();
        const gh = this.g.models.protos.hab_module ? makeModuleGLB(this.g.models, m.id, sides, m.y - m.lo + 0.3) : makeModule(m.id, sides, m.y - m.lo + 0.3); gh.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.5; c.castShadow = false; } });
        gh.position.set(m.i * M + M / 2, m.y, m.j * M + M / 2); this.g.scene.add(gh); this.mode.ghost = gh; this.mode.why = this.modOk(m); }
      const ok = !this.mode.why && this.g.has(this.P[m.id].cost); this.mode.ghost.traverse(c => { if (c.isMesh) c.material.emissive?.set(ok ? '#1a6a2a' : '#7a1010'); }); this.mode.ok = ok;
    } else if (this.mode) {
      const p = this.target(), { x, z, rot } = p.x != null ? { x: p.x, z: p.z, rot: p.rot } : this.place(p);
      const gh = this.mode.ghost; gh.position.set(x, this.levelY(p), z); gh.rotation.y = rot;
      const ok = this.canPlace(p) && this.g.has(this.P[p.id].cost);
      gh.traverse(c => { if (c.isMesh) c.material.emissive?.set(ok ? '#1a6a2a' : '#7a1010'); });
      this.mode.ok = ok;
    }
    for (const b of this.beacons) { const s = b.getObjectByName('spin'); if (s) s.rotation.y += dt * 1.5; const bm = b.getObjectByName('beam'); if (bm) { const st = this.g.explore?.storm || 0; bm.visible = st > 0.05; bm.material.opacity = (0.4 + Math.sin(performance.now() / 400) * 0.1) * Math.min(1, st * 2); } }
    // Двери модулей: створки разъезжаются, когда игрок рядом
    const P0 = this.g.player.pos;
    for (const [, o] of this.mobjs) { const m = o.userData.m; for (const s of m.doors || []) { const side = o.getObjectByName('side' + s); if (!side) continue; const f = sideFrame(s, m.i, m.j), near = Math.hypot(P0.x - f.x, P0.z - f.z) < 2.8 && Math.abs(P0.y - m.y) < 2.5;
      if (near !== !!side.userData.near) { side.userData.near = near; this.g.sfx?.play('door'); }
      side.userData.open = (side.userData.open || 0) + ((near ? 1 : 0) - (side.userData.open || 0)) * Math.min(1, dt * 7);
      for (const sg of [-1, 1]) { const d = side.getObjectByName('door' + sg); if (d) d.position.x = d.userData.x0 + sg * side.userData.open * (DOOR_W / 2 - 0.05); }
      const l = side.getObjectByName('doorlamp'); if (l) l.material.emissive?.set(near ? '#5cd6a8' : '#2a6a55'); } }
    for (const D of this.domes) { const dr = D.obj.getObjectByName('dome_door'); if (!dr) continue; const dx = D.x + Math.cos(D.door) * D.r, dz = D.z + Math.sin(D.door) * D.r, near = Math.hypot(P0.x - dx, P0.z - dz) < 3.2;
      if (near !== !!dr.userData.near) { dr.userData.near = near; this.g.sfx?.play('door'); }
      dr.userData.open = (dr.userData.open || 0) + ((near ? 1 : 0) - (dr.userData.open || 0)) * Math.min(1, dt * 7);
      for (const sg of [-1, 1]) { const d = dr.getObjectByName('door' + sg); if (d) d.position.x = d.userData.x0 + sg * dr.userData.open * 0.9; } }
    // В куполе — прячем оболочку (стекло, рёбра) этого купола, видно героя и обстановку
    for (const D of this.domes) { const sh = D.obj.getObjectByName('shell'); if (!sh) continue; const inD = Math.hypot(P0.x - D.x, P0.z - D.z) < D.r - 0.2 && P0.y < D.y + 4; if (sh.visible === inD) sh.visible = !inD; }
    // В модуле — прячем крыши всей связной постройки
    const pm = this.modOfPos(P0.x, P0.z), mk = pm && P0.y < pm.y + MH ? 'M' + pm.i + ',' + pm.j : '';
    if (mk !== this.mHidden) { this.mHidden = mk; const hide = new Set(); if (pm && mk) { const q = [pm]; hide.add(pm); while (q.length) { const c = q.pop(); for (const [a, b] of SIDES) { const n = this.modAt(c.i + a, c.j + b); if (n && !hide.has(n)) { hide.add(n); q.push(n); } } } }
      for (const [, o] of this.mobjs) { const h = hide.has(o.userData.m); const r = o.getObjectByName('roof'); if (r) r.visible = !h; const hr = o.getObjectByName('hullroof'); if (hr) hr.visible = !h; const cu = o.getObjectByName('cutaway'); if (cu) cu.visible = h; for (let s = 0; s < 4; s++) { const sd = o.getObjectByName('side' + s); if (sd && hr) sd.children.forEach(c => { if (!/^door/.test(c.name) && c.name !== 'doorlamp') c.visible = !h; }); } } }
    // Под крышей — крыши этого дома (связные ячейки) прячем, чтобы видеть героя внутри
    const pp = this.g.player.pos, ci = Math.floor(pp.x / G), cj = Math.floor(pp.z / G);
    const under = this.g.state.house.some(p => p.id === 'b_roof' && p.i === ci && p.j === cj && pp.y < p.y + 2);
    const key = under ? ci + ',' + cj : '';
    if (key !== this.hiddenFor) {
      this.hiddenFor = key;
      const roofs = this.g.state.house.filter(p => p.id === 'b_roof'), hide = new Set();
      if (under) { const q = [[ci, cj]]; hide.add(key); while (q.length) { const [i, j] = q.pop(); for (const [a, b] of [[1,0],[-1,0],[0,1],[0,-1]]) { const k2 = (i + a) + ',' + (j + b); if (!hide.has(k2) && roofs.some(r => r.i === i + a && r.j === j + b)) { hide.add(k2); q.push([i + a, j + b]); } } } }
      for (const r of roofs) { const o = this.objs.get(this.key(r)); if (o) o.visible = !hide.has(r.i + ',' + r.j); }
    }
  }
}
