// Ледяной набор: конструктор базы кодом по промо (белый корпус, синие рамы, бирюзовая подсветка, окна со стеклом в инее).
// Детали: стена (глухая / окно / иллюминаторы / шлюз / стыковка), пол, потолок-крыша, угловая стойка, купол.
// Стена строится в канонической раме: наружу +z, центр ребра в (0,0,0), низ на y=0.2 (уровень пола модуля).
import * as THREE from 'three';

export const KIT = { M: 4, MH: 3, DOOR_W: 1.6, T: 0.2 };
const ARCH_Y = 0.2 + 1.6, ARCH_O = 0.36;   // свод ниже карниза стены: арка рукава не вылезает над модулем   // начало свода и ширина рамы арки — одна на стену, рукав и портал купола
const { M, MH, DOOR_W } = KIT;
const Y0 = 0.2, Y1 = MH + 0.2;   // низ и верх стены

const C = { hull: '#eef3f8', hull2: '#d5e1ec', blue: '#2a78cf', navy: '#1f3e66', roof: '#8cc8ee', glow: '#40f0ff', dark: '#22262e', pad: '#e6dccb', metal: '#8a96a6', leaf: '#3fae5a', leaf2: '#2e8b47', soil: '#5a4030', warm: '#fff1d6' };
const cache = {};
const mat = (k, o = {}) => (cache[k + JSON.stringify(o)] ??= new THREE.MeshStandardMaterial({ color: C[k] || k, roughness: 0.75, flatShading: true, ...o }));
const glowMat = (c = C.glow, i = 1.8) => mat(c, { emissive: c, emissiveIntensity: i });
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };
const box = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);

// ---------- Текстуры (canvas): обшивка снаружи, стёганая обивка внутри, решётка пола, иней на стекле ----------
const texCache = {};
function canvasTex(key, size, draw, rep = 1) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return (texCache[key] = t);
}
// Обшивка: плиты 1×1 м со швами и болтами (UV экструзии = метры)
const hullTex = () => canvasTex('hull', 128, (x, s) => {
  x.fillStyle = C.hull; x.fillRect(0, 0, s, s);
  x.fillStyle = '#e3eaf2'; x.fillRect(6, 6, s / 2 - 10, s - 12);
  x.strokeStyle = 'rgba(60,90,130,.35)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, s - 3, s - 3); x.beginPath(); x.moveTo(s / 2, 0); x.lineTo(s / 2, s); x.stroke();
  x.fillStyle = 'rgba(60,90,130,.45)'; for (const [a, b] of [[8, 8], [s - 8, 8], [8, s - 8], [s - 8, s - 8]]) { x.beginPath(); x.arc(a, b, 2.5, 0, 7); x.fill(); }
});
// Стёганые маты (как в модулях МКС): ромбы-подушки, тёплый беж
const padTex = () => canvasTex('pad', 128, (x, s) => {
  x.fillStyle = C.pad; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const g = x.createRadialGradient(i * 64 + 32, j * 64 + 28, 4, i * 64 + 32, j * 64 + 32, 40); g.addColorStop(0, '#f4ecdf'); g.addColorStop(1, '#cdbfa8'); x.fillStyle = g; x.fillRect(i * 64 + 3, j * 64 + 3, 58, 58); }
  x.fillStyle = '#9d8e78'; for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) { x.beginPath(); x.arc(i * 64, j * 64, 3, 0, 7); x.fill(); }
}, 2);
const gridTex = () => canvasTex('grid', 128, (x, s) => {
  x.fillStyle = '#a9b6c4'; x.fillRect(0, 0, s, s); x.fillStyle = '#6a7a8e';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 10; j++) x.fillRect(i * 32 + 4, j * 12.8 + 3, 24, 6);
  x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(0, 0, s, 2); x.fillRect(0, 0, 2, s);
}, 1);
// Иней: прозрачная середина (видно, что внутри), к краям белая изморозь с кристаллами-ветками
function frostTex(round) {
  return canvasTex('frost' + (round ? 'R' : 'Q'), 256, (x, s) => {
    const img = x.createImageData(s, s), d = img.data;
    let seed = round ? 7 : 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const noise = new Float32Array(17 * 17).map(() => rnd());
    const nz = (u, v) => { const x = u * 16, y = v * 16, i = Math.min(15, x | 0), j = Math.min(15, y | 0), fx = x - i, fy = y - j, a = noise[j * 17 + i], b = noise[j * 17 + i + 1], c = noise[(j + 1) * 17 + i], d = noise[(j + 1) * 17 + i + 1]; return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy; };
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const u = i / s, v = j / s;
      const e = round ? 1 - Math.hypot(u - 0.5, v - 0.5) * 2 : Math.min(u, v, 1 - u, 1 - v) * 2;   // 0 у края → 1 в центре
      const n = nz(u, v) * 0.3;
      const f = Math.pow(Math.max(0, Math.min(1, 1 - (e + n) * 1.9)), 1.4);   // сила инея
      const k = (j * s + i) * 4; d[k] = 225 + 30 * f; d[k + 1] = 240 + 15 * f; d[k + 2] = 255; d[k + 3] = 40 + 200 * f;
    }
    x.putImageData(img, 0, 0);
    // мелкие кристаллики-искорки, только в зоне инея у краёв
    for (let n = 0; n < 900; n++) { const u = rnd(), v = rnd(), e = round ? 1 - Math.hypot(u - 0.5, v - 0.5) * 2 : Math.min(u, v, 1 - u, 1 - v) * 2; if (e > 0.32 || e < 0) continue;
      x.fillStyle = `rgba(255,255,255,${(0.35 - e) * 1.6})`; const r0 = 0.6 + rnd() * 1.6; x.beginPath(); x.arc(u * s, v * s, r0, 0, 7); x.fill(); }
  });
}
const frostMat = round => (cache['frost' + round] ??= new THREE.MeshStandardMaterial({ color: '#ffffff', map: frostTex(round), transparent: true, roughness: 0.12, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false, emissive: '#3a7fb0', emissiveIntensity: 0.12 }));
const hullMat = () => (cache.hullT ??= new THREE.MeshStandardMaterial({ color: '#ffffff', map: hullTex(), roughness: 0.7, flatShading: true }));
const padMat = () => (cache.padT ??= new THREE.MeshStandardMaterial({ color: '#ffffff', map: padTex(), roughness: 0.95 }));
const gridMat = () => (cache.gridT ??= new THREE.MeshStandardMaterial({ color: '#ffffff', map: gridTex(), roughness: 0.6, metalness: 0.3 }));

// ---------- Формы ----------
function rrect(p, cx, cy, w, h, r) {
  const x = cx - w / 2, y = cy - h / 2; p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r); p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h); p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r); p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); return p;
}
const circ = (p, cx, cy, r) => { p.absarc(cx, cy, r, 0, Math.PI * 2, false); return p; };
// Контур стены с аркой снизу (шлюз/стыковка): проём касается пола
function archWall(L, w, yt) {
  const s = new THREE.Shape(); s.moveTo(-L / 2, Y0); s.lineTo(-w / 2, Y0); s.lineTo(-w / 2, yt); s.absarc(0, yt, w / 2, Math.PI, 0, true); s.lineTo(w / 2, Y0); s.lineTo(L / 2, Y0); s.lineTo(L / 2, Y1); s.lineTo(-L / 2, Y1); s.closePath(); return s;
}
// U-рамка арки (снаружи wo, внутри wi)
function archFrame(wi, wo, yti, yto) {
  const s = new THREE.Shape(); s.moveTo(-wo / 2, Y0); s.lineTo(-wo / 2, yto); s.absarc(0, yto, wo / 2, Math.PI, 0, true); s.lineTo(wo / 2, Y0); s.lineTo(wi / 2, Y0); s.lineTo(wi / 2, yti); s.absarc(0, yti, wi / 2, 0, Math.PI, false); s.lineTo(-wi / 2, Y0); s.closePath(); return s;
}
const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 });

// Проёмы стены по типу: [{kind:'rect'|'round', cx, cy, w, h}] — для окон/рам/стекла
function openings(kind) {
  if (kind === 'window') return [{ k: 'rect', cx: 0, cy: 1.75, w: 2.5, h: 1.35 }];
  if (kind === 'big') return [{ k: 'rect', cx: 0, cy: 1.75, w: 3.1, h: 2.1 }];
  if (kind === 'port') return [{ k: 'round', cx: -0.85, cy: 1.75, w: 1.0 }, { k: 'round', cx: 0.85, cy: 1.75, w: 1.0 }];
  return [];
}

// ---------- Стена (каноническая: наружу +z) ----------
// kind: 'plain' | 'window' | 'port' | 'big' | 'door' | 'dock'; interior: 'pad' (жилой) | 'green' (оранжерея)
export function makeWall(kind, interior = 'pad', L = M) {
  const g = new THREE.Group(), DE = 0.12, DI = 0.08;
  const yt = ARCH_Y, ops = openings(kind);
  let shape;
  if (kind === 'door' || kind === 'dock') shape = archWall(L, DOOR_W, yt);
  else { shape = new THREE.Shape(); shape.moveTo(-L / 2, Y0); shape.lineTo(L / 2, Y0); shape.lineTo(L / 2, Y1); shape.lineTo(-L / 2, Y1); shape.closePath();
    for (const o of ops) shape.holes.push(o.k === 'round' ? circ(new THREE.Path(), o.cx, o.cy, o.w / 2) : rrect(new THREE.Path(), o.cx, o.cy, o.w, o.h, 0.3)); }
  // слой снаружи (обшивка) и внутри (маты / светлая панель оранжереи)
  g.add(mesh(extrude(shape, DE), hullMat(), 0, 0, 0));
  const inner = mesh(extrude(shape, DI), interior === 'green' ? mat('#dfe9f2') : padMat(), 0, 0, -DI); g.add(inner);
  // снаружи: синий цоколь, бирюзовая полоса под карнизом
  if (kind === 'door' || kind === 'dock') { for (const x of [-1, 1]) g.add(box((L - DOOR_W - ARCH_O) / 2, 0.3, 0.05, mat('navy'), x * (L + DOOR_W + ARCH_O) / 4, Y0 + 0.15, DE + 0.025)); }
  else g.add(box(L, 0.3, 0.05, mat('navy'), 0, Y0 + 0.15, DE + 0.025));
  for (const x of [-1, 1]) g.add(box(L / 2 - (kind === 'door' || kind === 'dock' ? DOOR_W / 2 + 0.35 : 0.2), 0.06, 0.03, glowMat(), x * (L / 4 + (kind === 'door' || kind === 'dock' ? DOOR_W / 4 + 0.17 : 0.1)), Y0 + 0.36, DE + 0.04));
  g.add(box(L, 0.07, 0.04, glowMat(), 0, Y1 - 0.18, DE + 0.02));
  // рамы и стекло окон
  for (const o of ops) {
    if (o.k === 'round') { const fr = new THREE.Shape(); circ(fr, o.cx, o.cy, o.w / 2 + 0.14); fr.holes.push(circ(new THREE.Path(), o.cx, o.cy, o.w / 2)); g.add(mesh(extrude(fr, 0.32), mat('blue'), 0, 0, -0.15));
      const gl = mesh(new THREE.CircleGeometry(o.w / 2, 24), frostMat(true), o.cx, o.cy, 0.02); gl.castShadow = false; g.add(gl);
      g.add(box(0.12, 0.05, 0.03, glowMat(), o.cx, o.cy + o.w / 2 + 0.24, DE + 0.03)); }
    else { const fr = new THREE.Shape(); rrect(fr, o.cx, o.cy, o.w + 0.26, o.h + 0.26, 0.4); fr.holes.push(rrect(new THREE.Path(), o.cx, o.cy, o.w, o.h, 0.3)); g.add(mesh(extrude(fr, 0.32), mat('blue'), 0, 0, -0.15));
      const gl = mesh(new THREE.PlaneGeometry(o.w, o.h), frostMat(false), o.cx, o.cy, 0.02); gl.castShadow = false; g.add(gl);
      // переплёт (как на промо: одна вертикальная стойка у больших окон)
      if (o.w > 2.8) g.add(box(0.1, o.h, 0.14, mat('blue'), o.cx, o.cy, 0.02)); }
  }
  // шлюз / стыковка: U-рамка арки
  if (kind === 'door' || kind === 'dock') {
    const deep = kind === 'dock' ? 1.0 : 0.42;
    if (kind === 'door') g.add(mesh(extrude(archFrame(DOOR_W, DOOR_W + ARCH_O, yt, yt), deep), mat('blue'), 0, 0, -0.15));
    for (const x of [-1, 1]) g.add(box(0.08, 1.2, 0.04, glowMat(), x * (DOOR_W / 2 + 0.3), Y0 + 1.0, DE + 0.03));
  }
  if (kind === 'door') {
    for (const sg of [-1, 1]) { const d = box(DOOR_W / 2, yt + DOOR_W / 2 - Y0, 0.06, mat('#dfe8f1'), sg * DOOR_W / 4, Y0 + (yt + DOOR_W / 2 - Y0) / 2, 0.02);
      d.add(box(0.06, 1.7, 0.08, mat('blue'), -sg * DOOR_W / 4 + sg * 0.05, -0.15, 0)); d.add(box(0.36, 0.06, 0.08, glowMat(), 0, 0.45, 0)); d.name = 'door' + sg; d.userData.x0 = d.position.x; g.add(d); }
    const lamp = box(0.6, 0.08, 0.06, new THREE.MeshStandardMaterial({ color: C.glow, emissive: C.glow, emissiveIntensity: 1.6 }), 0, yt + DOOR_W / 2 + 0.3, DE + 0.08); lamp.name = 'doorlamp'; g.add(lamp);
  }
  // изнутри: кабель-канал под потолком, светильники, индикаторы
  if (interior === 'pad') {
    g.add(box(L - 0.5, 0.08, 0.1, mat('metal'), 0, Y1 - 0.3, -DI - 0.05));
    for (const x of kind === 'door' || kind === 'dock' ? [-1.4, 1.4] : [-1.2, 1.2]) { g.add(box(0.34, 0.05, 0.14, mat(C.warm, { emissive: '#ffe0a8', emissiveIntensity: 1.4 }), x, Y1 - 0.45, -DI - 0.07)); g.add(box(0.05, 0.05, 0.03, glowMat(), x + 0.3, Y0 + 0.9, -DI - 0.015)); }
  } else { g.add(box(L - 0.6, 0.08, 0.22, mat('hull'), 0, Y1 - 0.55, -0.55)); g.add(box(L - 0.7, 0.03, 0.16, glowMat('#ff5cd8', 2.2), 0, Y1 - 0.6, -0.55)); for (const x of [-1.6, 1.6]) g.add(box(0.03, 0.5, 0.03, mat('metal'), x, Y1 - 0.3, -0.55)); }   // фитолампа над грядкой
  return g;
}

// Пол (решётка + синяя кромка + подбрюшье) — центр модуля, верх пола на y=0.25
export function makeFloor() {
  const g = new THREE.Group();
  const top = mesh(new THREE.BoxGeometry(M, 0.25, M), [mat('navy'), mat('navy'), gridMat(), mat('navy'), mat('navy'), mat('navy')], 0, 0.125, 0); g.add(top);
  for (const [w, d, x, z] of [[M, 0.08, 0, M / 2 - 0.04], [M, 0.08, 0, -M / 2 + 0.04], [0.08, M, M / 2 - 0.04, 0], [0.08, M, -M / 2 + 0.04, 0]]) g.add(box(w, 0.02, d, glowMat(C.glow, 0.9), x, 0.255, z));
  g.add(box(M - 0.1, 0.35, M - 0.1, mat('navy'), 0, -0.175, 0));
  return g;
}
// Потолок-крыша: плита, гранёная светло-голубая «пирамида» (как на промо), бирюзовые кромки, вентблок и антенны
export function makeRoof(glass = false, antennas = true) {
  const g = new THREE.Group();
  g.add(box(M + 0.12, 0.2, M + 0.12, mat('hull'), 0, Y1 + 0.1, 0));
  const pyr = mesh(new THREE.CylinderGeometry(1.25, (M + 0.1) / Math.SQRT2, 0.6, 4, 1), glass ? frostMat(false) : mat('roof'), 0, Y1 + 0.5, 0); pyr.rotation.y = Math.PI / 4; g.add(pyr);
  if (glass) { const fr = mesh(new THREE.CylinderGeometry(1.27, (M + 0.12) / Math.SQRT2, 0.62, 4, 1, true), mat('blue', { wireframe: true }), 0, Y1 + 0.5, 0); fr.rotation.y = Math.PI / 4; g.add(fr); }
  for (const [w, d, x, z] of [[M + 0.14, 0.06, 0, M / 2 + 0.06], [M + 0.14, 0.06, 0, -M / 2 - 0.06], [0.06, M + 0.14, M / 2 + 0.06, 0], [0.06, M + 0.14, -M / 2 - 0.06, 0]]) g.add(box(w, 0.06, d, glowMat(), x, Y1 + 0.17, z));
  g.add(box(1.2, 0.5, 1.2, glass ? mat('blue') : mat('hull'), 0, Y1 + 1.05, 0));
  if (!glass) g.add(box(0.7, 0.24, 0.04, mat('dark'), 0, Y1 + 1.05, 0.62));
  if (antennas) { g.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.3, 5), mat('dark'), 0.35, Y1 + 1.95, -0.3)); g.add(mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.8, 5), mat('dark'), -0.3, Y1 + 1.7, -0.35));
    g.add(mesh(new THREE.SphereGeometry(0.07, 6, 4), glowMat(), 0.35, Y1 + 2.62, -0.3)); }
  // кольцевая лампа под потолком
  const ring = mesh(new THREE.TorusGeometry(0.55, 0.045, 5, 24), glowMat(C.glow, 2), 0, Y1 - 0.12, 0); ring.rotation.x = Math.PI / 2; ring.castShadow = false; g.add(ring);
  g.add(box(0.7, 0.03, 0.7, mat(C.warm, { emissive: '#fff0d0', emissiveIntensity: 1.2 }), 0, Y1 - 0.02, 0));
  return g;
}
export function makePost() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, Y1 - Y0 + 0.2, 6), mat('hull2'), 0, (Y0 + Y1) / 2, 0));   // светлые: не рисуют синюю «квадратную раму» вокруг арки
  g.add(box(0.07, Y1 - Y0 - 0.6, 0.07, glowMat(), 0, (Y0 + Y1) / 2, 0.19));
  return g;
}
function makeLeg(fd) {
  const g = new THREE.Group(), h = fd + 0.4;
  const l = mesh(new THREE.CylinderGeometry(0.17, 0.32, h, 4), mat('hull'), 0, -h / 2, 0); l.rotation.y = Math.PI / 4; g.add(l);
  g.add(box(0.75, 0.12, 0.75, mat('metal'), 0, -h - 0.04, 0)); g.add(box(0.36, 0.05, 0.02, glowMat(), 0, -0.35, 0.2));
  return g;
}
// Низкополигональный кустик: стебель + 5–6 листьев-ромбов веером (иногда — бутон)
const leafGeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.07, 0.12, 0.02, 0, 0.32, 0, 0, 0, 0, 0, 0.32, 0, -0.07, 0.12, 0.02], 3)); g.computeVertexNormals(); return g; })();
function makeBush(x, y, z, k, seed) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(k);
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.22, 4), mat('leaf2'), 0, 0.11, 0));
  const n = 6 + (seed % 2);
  for (let i = 0; i < n; i++) { const l = new THREE.Mesh(leafGeo, mat(i % 2 ? 'leaf' : 'leaf2', { side: THREE.DoubleSide })); l.position.y = 0.12 + (i % 3) * 0.04; l.rotation.set(0, i / n * Math.PI * 2 + seed, 0); l.rotateX(0.55 + (i % 2) * 0.35); l.castShadow = true; g.add(l); }
  if (seed % 3 === 0) g.add(mesh(new THREE.IcosahedronGeometry(0.06, 0), mat('#ff8a5c'), 0, 0.42, 0));
  return g;
}
// Обстановка у стены (каноническая рама: внутрь −z)
function makeProp(type) {
  const g = new THREE.Group();
  if (type === 'bunk') { g.add(box(1.9, 0.42, 0.85, mat('blue'), 0, Y0 + 0.26, -0.55)); g.add(box(1.8, 0.14, 0.78, mat('pad', { color: '#f2e9da' }), 0, Y0 + 0.52, -0.55)); g.add(box(0.5, 0.12, 0.6, mat('#9fd0f5'), -0.6, Y0 + 0.64, -0.55)); }
  if (type === 'desk') { g.add(box(1.6, 0.08, 0.6, mat('hull'), 0, Y0 + 0.78, -0.42)); for (const x of [-0.7, 0.7]) g.add(box(0.08, 0.74, 0.5, mat('blue'), x, Y0 + 0.37, -0.42));
    const scr = box(0.62, 0.3, 0.04, glowMat('#3fd8ff', 1.1), 0.25, Y0 + 1.0, -0.56); scr.rotation.x = -0.25; g.add(scr); g.add(box(0.06, 0.12, 0.06, mat('dark'), 0.25, Y0 + 0.86, -0.56)); g.add(box(0.4, 0.03, 0.18, mat('dark'), -0.35, Y0 + 0.835, -0.36)); }
  if (type === 'shelf') { for (const y of [0.5, 1.1, 1.7]) g.add(box(1.5, 0.06, 0.45, mat('hull'), 0, Y0 + y, -0.32)); for (const x of [-0.72, 0.72]) g.add(box(0.06, 1.8, 0.45, mat('blue'), x, Y0 + 0.9, -0.32));
    for (const [x, y, c] of [[-0.4, 0.66, '#f0a040'], [0.1, 0.66, '#9fd0f5'], [0.4, 1.26, '#f0a040'], [-0.3, 1.26, '#e8e8e8']]) g.add(box(0.36, 0.26, 0.32, mat(c), x, Y0 + y, -0.32)); }
  if (type === 'plants') { g.add(box(3.0, 0.5, 0.55, mat('blue'), 0, Y0 + 0.25, -0.42)); g.add(box(2.9, 0.05, 0.45, mat('soil'), 0, Y0 + 0.51, -0.42));
    for (let i = 0; i < 5; i++) g.add(makeBush(-1.2 + i * 0.6, Y0 + 0.52, -0.42, 0.8 + (i % 3) * 0.2, i)); }
  return g;
}

// ---------- Модуль 4×4 из деталей ----------
// sides: ['wall'|'door'|'dock'|'open'] × 4 (0:−z, 1:+x, 2:+z, 3:−x), как в build.js
const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export function makeIceModule(id, sides, footY) {
  const g = new THREE.Group(), green = id === 'm_glass';
  g.userData.kit = 'ice';
  g.add(makeFloor());
  const fd = Math.max(0.3, footY);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = makeLeg(fd); l.position.set(a * 1.45, -0.35, b * 1.45); g.add(l); }
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = makePost(); p.position.set(a * M / 2, 0, b * M / 2); p.rotation.y = Math.atan2(a, b); g.add(p); }
  const roof = makeRoof(green, !green); roof.name = 'roof'; g.add(roof);
  const props = { window: ['bunk', 'desk'], port: ['desk', 'bunk'] };
  sides.forEach((k, s) => {
    if (k === 'open') return;
    const [a, b] = SIDES[s], f = new THREE.Group(); f.position.set(a * M / 2, 0, b * M / 2); f.rotation.y = s % 2 ? Math.PI / 2 : 0; f.name = 'side' + s; g.add(f);
    const sg = s === 0 || s === 3 ? -1 : 1, w = new THREE.Group(); if (sg < 0) w.rotation.y = Math.PI; f.add(w);   // каноника: наружу +z
    const kind = k === 'wall' ? (green ? 'big' : s % 2 ? 'port' : 'window') : k;
    w.add(makeWall(kind, green ? 'green' : 'pad'));
    if (k === 'wall') w.add(makeProp(green ? 'plants' : props[kind][s >> 1]));
    if (k === 'dock') { g.add(box(Math.abs(a) ? 1.7 : DOOR_W + 0.3, 0.14, Math.abs(b) ? 1.7 : DOOR_W + 0.3, gridMat(), a * 2.75, 0.2, b * 2.75));
      const t = new THREE.Group(); t.position.set(a * M / 2, 0, b * M / 2); t.rotation.y = Math.atan2(a, b); g.add(t);   // рукав: вдоль своей +z, от стены модуля к куполу
      const LEN = 1.3;   // стена модуля → поверхность купола (0.7) + заход под стекло
      t.add(mesh(extrude(archFrame(DOOR_W, DOOR_W + ARCH_O, ARCH_Y, ARCH_Y), LEN), mat('blue'), 0, 0, -0.12));
      const shell = archFrame(DOOR_W + ARCH_O, DOOR_W + ARCH_O + 0.24, ARCH_Y, ARCH_Y); t.add(mesh(extrude(shell, LEN - 0.3), mat('hull'), 0, 0, 0.03));
      t.add(box(DOOR_W + ARCH_O + 0.5, 1.6, LEN - 0.3, mat('navy'), 0, Y0 - 0.8, 0.03 + (LEN - 0.3) / 2));   // юбка под рукавом до грунта
      for (const zz of [0.1, 0.62]) t.add(mesh(extrude(archFrame(DOOR_W + ARCH_O + 0.22, DOOR_W + ARCH_O + 0.34, ARCH_Y, ARCH_Y), 0.08), glowMat(), 0, 0, zz)); }
  });
  return g;
}

// ---------- Купол-оранжерея: гранёный стеклянный купол в синем каркасе, бирюзовые пояса, шлюз ----------
export function makeIceDome(r, doorA, docks = [], H = 0.62) {
  const g = new THREE.Group(); g.userData.kit = 'ice';
  { const fl = mesh(new THREE.CylinderGeometry(r - 0.05, r - 0.05, 0.2, 40), [mat('navy'), gridMat(), mat('navy')], 0, 0.1, 0); fl.receiveShadow = true; fl.material[1] = (cache.gridDome ??= (() => { const m = gridMat().clone(); m.map = gridTex().clone(); m.map.repeat.set(r / 2, r / 2); m.map.needsUpdate = true; return m; })()); g.add(fl); }
  const gap = (DOOR_W / 2 + 0.1) / r, TAU = Math.PI * 2, th = a => ((Math.PI / 2 - a) % TAU + TAU) % TAU;
  const cuts = docks.map(th).sort((a, b) => a - b), arcs = [];
  if (!cuts.length) arcs.push([0, TAU]); else cuts.forEach((c, i) => { const n = i + 1 < cuts.length ? cuts[i + 1] : cuts[0] + TAU; if (n - c > 2 * gap) arcs.push([c + gap, n - c - 2 * gap]); });
  for (const [t0, tl] of arcs) {
    const seg = Math.max(3, Math.round(24 * tl / TAU));
    g.add(mesh(new THREE.CylinderGeometry(r + 0.12, r + 0.45, 3.6, seg, 1, true, t0, tl), mat('hull', { side: THREE.DoubleSide }), 0, -1.33, 0));
    g.add(mesh(new THREE.CylinderGeometry(r + 0.16, r + 0.2, 0.22, seg, 1, true, t0, tl), mat('navy', { side: THREE.DoubleSide }), 0, 0.33, 0));
    g.add(mesh(new THREE.CylinderGeometry(r + 0.21, r + 0.21, 0.06, seg, 1, true, t0, tl), glowMat(C.glow, 1.4), 0, 0.47, 0));
  }
  const shell = new THREE.Group(); shell.name = 'shell'; g.add(shell);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 5, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#cfeeff', transparent: true, opacity: 0.3, roughness: 0.08, metalness: 0.2, flatShading: true, side: THREE.DoubleSide, depthWrite: false }));
  glass.scale.y = H; glass.position.y = 0.45; glass.name = 'glass'; shell.add(glass);
  // каркас по рёбрам гранёной сферы: меридианы + параллели, синие
  const rib = mat('blue');
  for (let k = 0; k < 12; k++) { const q = new THREE.Group(); q.add(new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.075, 4, 20, Math.PI / 2), rib)); q.rotation.y = k / 12 * TAU; q.scale.set(1, H, 1); q.position.y = 0.45; shell.add(q); }
  for (const e of [0.4, 0.75]) { const rr = r * Math.cos(Math.asin(e)), t = new THREE.Mesh(new THREE.TorusGeometry(rr + 0.02, e > 0.5 ? 0.07 : 0.05, 4, 36), e > 0.5 ? rib : glowMat(C.glow, 1.6)); t.rotation.x = Math.PI / 2; t.position.y = 0.45 + r * e * H; shell.add(t); }
  for (const a of docks) { const pr = new THREE.Group(); pr.position.set(Math.cos(a) * (r - 0.05), 0, Math.sin(a) * (r - 0.05)); pr.rotation.y = -a + Math.PI / 2; shell.add(pr);
    pr.add(mesh(extrude(archFrame(DOOR_W + ARCH_O, DOOR_W + ARCH_O + 0.3, ARCH_Y, ARCH_Y), 0.3), mat('blue'), 0, 0, -0.15)); }
  const capY = 0.45 + r * H;
  shell.add(mesh(new THREE.CylinderGeometry(0.7, 0.95, 0.35, 8), mat('hull'), 0, capY, 0));
  shell.add(mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.05, 8), glowMat(), 0, capY + 0.1, 0));
  shell.add(box(0.6, 0.35, 0.5, mat('hull'), 0, capY + 0.35, 0)); shell.add(box(0.3, 0.14, 0.02, glowMat('#3fd8ff', 1.2), 0, capY + 0.37, 0.26));
  shell.add(mesh(new THREE.CylinderGeometry(0.03, 0.045, 1.6, 5), mat('dark'), 0.15, capY + 1.25, -0.1)); shell.add(mesh(new THREE.SphereGeometry(0.08, 6, 4), glowMat(), 0.15, capY + 2.07, -0.1));
  const lamp = new THREE.PointLight('#e8f8ff', 6, r * 2.2, 1.5); lamp.position.y = r * H; g.add(lamp);
  // шлюз
  const door = new THREE.Group(); door.name = 'dome_door'; door.position.set(Math.cos(doorA) * (r + 0.1), 0, Math.sin(doorA) * (r + 0.1)); door.rotation.y = -doorA + Math.PI / 2; door.scale.setScalar(0.82); g.add(door);
  door.add(box(2.6, 2.9, 1.2, mat('hull'), 0, 1.45, 0.2)); door.add(box(2.66, 0.2, 1.24, mat('blue'), 0, 2.9, 0.2)); door.add(box(2.66, 0.08, 1.26, glowMat(), 0, 2.74, 0.2));
  door.add(box(2.66, 0.36, 1.24, mat('navy'), 0, 0.18, 0.2));
  door.add(box(1.9, 2.3, 1.26, mat('dark'), 0, 1.25, 0.2));
  for (const sg of [-1, 1]) { const d = box(0.95, 2.25, 0.08, mat('#dfe8f1'), sg * 0.475, 1.22, 0.84); d.add(box(0.07, 1.6, 0.1, mat('blue'), -sg * 0.42, 0, 0)); d.add(box(0.3, 0.06, 0.1, glowMat(), 0, 0.45, 0)); d.name = 'door' + sg; d.userData.x0 = d.position.x; door.add(d); }
  const dl = box(0.7, 0.12, 0.1, new THREE.MeshStandardMaterial({ color: C.glow, emissive: C.glow, emissiveIntensity: 1.6 }), 0, 2.55, 0.84); dl.name = 'doorlamp'; door.add(dl);
  return g;
}

// Витрина конструктора: все детали рядом (для просмотра/скриншотов, дев)
export function iceKitShowcase() {
  const g = new THREE.Group(); let x = 0;
  const put = (o, w, ry = 0) => { o.position.x = x + w / 2; o.rotation.y = ry; g.add(o); x += w + 0.8; };
  for (const k of ['plain', 'window', 'port', 'door', 'big']) put(makeWall(k, k === 'big' ? 'green' : 'pad'), M);
  const row2 = new THREE.Group(); x = 0;
  for (const k of ['plain', 'window', 'port', 'door']) { const w = makeWall(k, 'pad'); w.add(makeProp(['bunk', 'desk', 'shelf', 'shelf'][['plain', 'window', 'port', 'door'].indexOf(k)])); w.position.x = x + M / 2; w.rotation.y = Math.PI; row2.add(w); x += M + 0.8; }
  row2.position.z = -7; g.add(row2);
  const row3 = new THREE.Group(); x = 0;
  for (const o of [makeFloor(), makeRoof(false), makeRoof(true, false), makePost()]) { o.position.x = x + M / 2; row3.add(o); x += M + 1.2; }
  row3.position.z = 7; g.add(row3);
  return g;
}
