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
// Прозрачное (стекло, иней) тени не принимает и не отбрасывает: иначе на стекле «акне» теней — полосы дрожат, когда мимо ходит герой
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); const tr = [].concat(m).some(q => q.transparent); o.castShadow = o.receiveShadow = !tr; if (tr) o.renderOrder = 2; return o; };
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
const frostMat = round => (cache['frost' + round] ??= new THREE.MeshStandardMaterial({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, color: '#ffffff', map: frostTex(round), transparent: true, roughness: 0.12, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false, emissive: '#3a7fb0', emissiveIntensity: 0.12 }));
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
    if (o.k === 'round') { const fr = new THREE.Shape(); circ(fr, o.cx, o.cy, o.w / 2 + 0.14); fr.holes.push(circ(new THREE.Path(), o.cx, o.cy, o.w / 2 - 0.035)); g.add(mesh(extrude(fr, 0.32), mat('blue'), 0, 0, -0.15));
      const gl = mesh(new THREE.CircleGeometry(o.w / 2, 24), frostMat(true), o.cx, o.cy, 0.02); gl.castShadow = false; g.add(gl);
      g.add(box(0.12, 0.05, 0.03, glowMat(), o.cx, o.cy + o.w / 2 + 0.24, DE + 0.03)); }
    else { const fr = new THREE.Shape(); rrect(fr, o.cx, o.cy, o.w + 0.26, o.h + 0.26, 0.4); fr.holes.push(rrect(new THREE.Path(), o.cx, o.cy, o.w - 0.07, o.h - 0.07, 0.27)); g.add(mesh(extrude(fr, 0.32), mat('blue'), 0, 0, -0.15));
      const gl = mesh(new THREE.PlaneGeometry(o.w, o.h), frostMat(false), o.cx, o.cy, 0.02); gl.castShadow = false; g.add(gl);
      // переплёт (как на промо: одна вертикальная стойка у больших окон)
      if (o.w > 2.8) g.add(box(0.1, o.h, 0.14, mat('blue'), o.cx, o.cy, 0.02)); }
  }
  // шлюз / стыковка: U-рамка арки
  if (kind === 'door' || kind === 'dock') {
    const deep = kind === 'dock' ? 1.0 : 0.42;
    if (kind === 'door') g.add(mesh(extrude(archFrame(DOOR_W - 0.06, DOOR_W + ARCH_O, yt, yt), deep), mat('blue'), 0, 0, -0.15));
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
// Крыша как на промо набора: пологая четырёхскатная усечённая пирамида со свесом, белый карниз,
// на площадке белый вентблок с тёмными жалюзи и две тёмные антенны разной высоты со светлыми навершиями. Оранжерея — такая же.
// Пирамида крыши с разным свесом по сторонам (у соседних модулей свес к соседу = 0, чтобы крыши не налезали)
function hipGeo(o, TOP, RH, y0) {   // o = [−z, +x, +z, −x] свесы
  const x0 = -M / 2 - o[3], x1 = M / 2 + o[1], z0 = -M / 2 - o[0], z1 = M / 2 + o[2], t = TOP / 2, y1 = y0 + RH;
  const B = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], U = [[-t, y1, -t], [t, y1, -t], [t, y1, t], [-t, y1, t]], pos = [];
  for (let k = 0; k < 4; k++) { const a = B[k], b = B[(k + 1) % 4], c = U[(k + 1) % 4], d = U[k]; pos.push(...a, ...d, ...c, ...a, ...c, ...b); }
  pos.push(...U[0], ...U[3], ...U[2], ...U[0], ...U[2], ...U[1]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return { g, B, U };
}
// Крыша как на промо набора: пологая голубая четырёхскатная усечённая пирамида со свесом, белый карниз,
// на площадке белый вентблок с тёмными жалюзи и две тёмные антенны разной высоты со светлыми навершиями. Оранжерея — такая же.
export function makeRoof(glass = false, antennas = true, seed = 0, open = [false, false, false, false]) {
  const g = new THREE.Group(), OV = 0.22, RH = 0.42, TOP = 2.7, o = open.map(v => v ? 0 : OV);
  g.add(box(M + 0.04, 0.16, M + 0.04, mat('hull'), 0, Y1 + 0.08, 0));                                                   // плита перекрытия
  { const w = M + o[1] + o[3], d = M + o[0] + o[2]; g.add(box(w, 0.26, d, mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.15 }), (o[1] - o[3]) / 2, Y1 + 0.2, (o[2] - o[0]) / 2)); g.add(box(w + 0.01, 0.05, d + 0.01, glowMat(C.glow, 2.4), (o[1] - o[3]) / 2, Y1 + 0.05, (o[2] - o[0]) / 2)); }   // белый карниз-свес
  const H = hipGeo(o, TOP, RH, Y1 + 0.3); g.add(mesh(H.g, mat('#82ccff', { emissive: '#3a8fd8', emissiveIntensity: 0.28, roughness: 0.45 })));
  const top = Y1 + 0.3 + RH;
  for (let k = 0; k < 4; k++) { const a = new THREE.Vector3(...H.B[k]), b = new THREE.Vector3(...H.U[k]), L = a.distanceTo(b), r = box(0.05, L, 0.05, mat('#b8e2ff'), 0, 0, 0); r.position.copy(a).add(b).multiplyScalar(0.5); r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(r); }
  g.add(box(TOP, 0.06, TOP, mat('#9fd0f5'), 0, top + 0.03, 0));                                 // площадка
  // вентблок с жалюзи
  const vb = 1.35, vh = 0.55, vy = top + 0.14 + vh / 2; g.add(box(TOP * 0.92, 0.08, TOP * 0.92, mat('#ffffff'), 0, top + 0.1, 0)); g.add(box(vb, vh, vb * 0.85, mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.12 }), 0, vy, 0)); g.add(box(vb + 0.04, 0.05, vb * 0.85 + 0.04, mat('#ffffff'), 0, vy + vh / 2 + 0.02, 0));
  for (const sg of [-1, 1]) { g.add(box(vb * 0.62, vh * 0.6, 0.03, mat('#2b3542'), 0, vy, sg * (vb * 0.425 + 0.01)));
    for (let k = 0; k < 4; k++) g.add(box(vb * 0.6, 0.025, 0.035, mat('#5a6a7c'), 0, vy - vh * 0.22 + k * vh * 0.15, sg * (vb * 0.425 + 0.02))); }
  if (antennas) { const hs = [[0.9, 1.35], [1.45, 1.05], [1.25, 0.8]][seed % 3];
    for (const [k, h] of hs.entries()) { const x = k ? -0.38 : 0.38, z = 0, y0 = vy + vh / 2;
      g.add(mesh(new THREE.CylinderGeometry(0.045, 0.06, h, 6), mat('#2a2f38'), x, y0 + h / 2, z)); g.add(mesh(new THREE.SphereGeometry(0.11, 10, 8), mat('#ffffff', { emissive: '#cfefff', emissiveIntensity: 0.9 }), x, y0 + h + 0.06, z)); } }
  // изнутри: кольцевая лампа и плафон под потолком
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
// Обстановка у стены (каноническая рама: стена на z=0, внутрь −z). X0 — сдвиг к одному краю стены:
// другой край (≈1.4 м) остаётся свободным — место под сундук.
const X0 = -0.6;
function makeTree(x, z, k, seed) {
  const g = new THREE.Group(); g.position.set(x, Y0, z); g.scale.setScalar(k);
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 8), mat('blue'), 0, 0.21, 0)); g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 8), mat('soil'), 0, 0.42, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.6, 5), mat('#8a5a3a'), 0, 0.7, 0));
  for (let i = 0; i < 3; i++) { const c = mesh(new THREE.IcosahedronGeometry(0.28 - i * 0.05, 0), mat(i % 2 ? 'leaf' : 'leaf2'), Math.sin(i * 2.1 + seed) * 0.08, 1.05 + i * 0.2, Math.cos(i * 2.1 + seed) * 0.08); g.add(c); }
  if (seed % 2) for (let i = 0; i < 4; i++) g.add(mesh(new THREE.IcosahedronGeometry(0.045, 0), mat('#ff8a5c'), Math.cos(i * 1.6) * 0.24, 1.0 + (i % 2) * 0.25, Math.sin(i * 1.6) * 0.24));
  return g;
}
function makeProp(type) {
  const g = new THREE.Group(), x = X0;
  if (type === 'bunk') { g.add(box(1.9, 0.42, 0.85, mat('blue'), x, Y0 + 0.26, -0.55)); g.add(box(1.8, 0.14, 0.78, mat('pad', { color: '#f2e9da' }), x, Y0 + 0.52, -0.55)); g.add(box(0.5, 0.12, 0.6, mat('#9fd0f5'), x - 0.6, Y0 + 0.64, -0.55)); g.add(box(0.9, 0.04, 0.8, mat('#4a8fd8'), x + 0.35, Y0 + 0.6, -0.55)); }
  if (type === 'bunk2') { for (const y of [0.3, 1.3]) { g.add(box(1.9, 0.12, 0.85, mat('blue'), x, Y0 + y, -0.55)); g.add(box(1.8, 0.12, 0.78, mat('pad', { color: '#f2e9da' }), x, Y0 + y + 0.12, -0.55)); g.add(box(0.45, 0.1, 0.6, mat('#9fd0f5'), x - 0.62, Y0 + y + 0.23, -0.55)); }
    for (const [a, b] of [[-0.93, -0.12], [0.93, -0.12], [-0.93, -0.97], [0.93, -0.97]]) g.add(box(0.07, 1.75, 0.07, mat('hull'), x + a, Y0 + 0.87, b));
    for (let k = 0; k < 4; k++) g.add(box(0.05, 0.05, 0.4, mat('metal'), x + 0.96, Y0 + 0.45 + k * 0.28, -0.75)); }
  if (type === 'desk') { g.add(box(1.6, 0.08, 0.6, mat('hull'), x, Y0 + 0.78, -0.42)); for (const d of [-0.7, 0.7]) g.add(box(0.08, 0.74, 0.5, mat('blue'), x + d, Y0 + 0.37, -0.42));
    const scr = box(0.62, 0.3, 0.04, glowMat('#3fd8ff', 1.1), x + 0.25, Y0 + 1.0, -0.56); scr.rotation.x = -0.25; g.add(scr); g.add(box(0.06, 0.12, 0.06, mat('dark'), x + 0.25, Y0 + 0.86, -0.56)); g.add(box(0.4, 0.03, 0.18, mat('dark'), x - 0.35, Y0 + 0.835, -0.36));
    g.add(box(0.5, 0.08, 0.5, mat('blue'), x, Y0 + 0.45, -1.05)); g.add(box(0.5, 0.5, 0.08, mat('blue'), x, Y0 + 0.75, -1.28)); g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 5), mat('metal'), x, Y0 + 0.21, -1.05)); }
  if (type === 'locker') { g.add(box(1.0, 2.05, 0.55, mat('hull'), x, Y0 + 1.03, -0.3)); for (const d of [-0.25, 0.25]) { g.add(box(0.46, 1.9, 0.03, mat('#cfe2f2'), x + d, Y0 + 1.03, -0.59)); g.add(box(0.04, 0.3, 0.04, glowMat(), x + d * 0.3, Y0 + 1.1, -0.61)); } }
  if (type === 'kitchen') { g.add(box(2.1, 0.9, 0.62, mat('hull'), x, Y0 + 0.45, -0.33)); g.add(box(2.14, 0.06, 0.66, mat('blue'), x, Y0 + 0.93, -0.33));
    g.add(box(0.5, 0.02, 0.4, mat('dark'), x - 0.5, Y0 + 0.97, -0.33)); for (const d of [0.35, 0.65]) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 10), mat('#ff7a4a', { emissive: '#ff5a2a', emissiveIntensity: 0.6 }), x + d, Y0 + 0.97, -0.33));
    g.add(box(2.1, 0.6, 0.38, mat('#e8f0f8'), x, Y0 + 1.9, -0.2)); g.add(box(1.9, 0.04, 0.02, glowMat(), x, Y0 + 1.58, -0.4)); }
  if (type === 'table') { g.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 12), mat('hull'), x, Y0 + 0.74, -1.0)); g.add(mesh(new THREE.CylinderGeometry(0.06, 0.18, 0.72, 8), mat('blue'), x, Y0 + 0.36, -1.0));
    for (const d of [-0.75, 0.75]) { g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), mat('#4a8fd8'), x + d, Y0 + 0.46, -1.0)); g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.44, 5), mat('metal'), x + d, Y0 + 0.22, -1.0)); }
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 8), mat('#ffffff'), x + 0.15, Y0 + 0.83, -0.95)); }
  if (type === 'console') { g.add(box(2.0, 0.85, 0.7, mat('#dfe8f1'), x, Y0 + 0.43, -0.38)); g.add(box(2.0, 0.06, 0.74, mat('blue'), x, Y0 + 0.88, -0.38));
    for (const d of [-0.65, 0, 0.65]) { const sc = box(0.55, 0.38, 0.04, glowMat(d ? '#3fd8ff' : '#7dffb0', 1.0), x + d, Y0 + 1.25, -0.12); sc.rotation.x = -0.15; g.add(sc); g.add(box(0.6, 0.43, 0.03, mat('dark'), x + d, Y0 + 1.25, -0.09)); }
    for (let k = 0; k < 6; k++) g.add(box(0.08, 0.03, 0.08, glowMat(k % 2 ? '#ffcf4a' : '#40f0ff', 1.4), x - 0.8 + k * 0.32, Y0 + 0.92, -0.62)); }
  if (type === 'sofa') { g.add(box(1.9, 0.4, 0.8, mat('#4a8fd8'), x, Y0 + 0.2, -0.45)); g.add(box(1.9, 0.55, 0.22, mat('#4a8fd8'), x, Y0 + 0.55, -0.15)); for (const d of [-0.95, 0.95]) g.add(box(0.2, 0.55, 0.8, mat('blue'), x + d, Y0 + 0.3, -0.45));
    for (const d of [-0.45, 0.45]) g.add(box(0.8, 0.14, 0.62, mat('#f2e9da'), x + d, Y0 + 0.46, -0.5)); g.add(box(0.35, 0.3, 0.12, mat('#ffcf4a'), x - 0.6, Y0 + 0.65, -0.3)); }
  if (type === 'shelf') { for (const y of [0.5, 1.1, 1.7]) g.add(box(1.5, 0.06, 0.45, mat('hull'), x, Y0 + y, -0.32)); for (const d of [-0.72, 0.72]) g.add(box(0.06, 1.8, 0.45, mat('blue'), x + d, Y0 + 0.9, -0.32));
    for (const [a, y, c] of [[-0.4, 0.66, '#f0a040'], [0.1, 0.66, '#9fd0f5'], [0.4, 1.26, '#f0a040'], [-0.3, 1.26, '#e8e8e8'], [0.2, 1.86, '#7dffb0']]) g.add(box(0.36, 0.26, 0.32, mat(c), x + a, Y0 + y, -0.32)); }
  // --- оранжерея ---
  if (type === 'plants') { g.add(box(2.4, 0.5, 0.55, mat('blue'), x, Y0 + 0.25, -0.42)); g.add(box(2.3, 0.05, 0.45, mat('soil'), x, Y0 + 0.51, -0.42));
    for (let i = 0; i < 4; i++) g.add(makeBush(x - 0.9 + i * 0.6, Y0 + 0.52, -0.42, 0.8 + (i % 3) * 0.2, i)); }
  if (type === 'hydro') { for (const d of [-0.9, 0.9]) g.add(box(0.06, 1.9, 0.5, mat('hull'), x + d, Y0 + 0.95, -0.3));
    for (const [k, y] of [0.3, 0.95, 1.6].entries()) { g.add(box(1.8, 0.08, 0.5, mat('#dfe8f1'), x, Y0 + y, -0.3)); g.add(box(1.7, 0.03, 0.4, glowMat('#ff5cd8', 1.6), x, Y0 + y + 0.5, -0.3));
      for (let i = 0; i < 4; i++) g.add(makeBush(x - 0.65 + i * 0.43, Y0 + y + 0.05, -0.3, 0.55 + ((i + k) % 2) * 0.15, i + k)); } }
  if (type === 'trees') { g.add(makeTree(x - 0.6, -0.5, 1.0, 1)); g.add(makeTree(x + 0.4, -0.5, 0.85, 2));
    g.add(box(1.1, 0.08, 0.4, mat('#c89a6a'), x - 0.1, Y0 + 0.42, -1.25)); for (const d of [-0.45, 0.45]) g.add(box(0.08, 0.4, 0.36, mat('blue'), x - 0.1 + d, Y0 + 0.2, -1.25)); }
  if (type === 'flowers') { for (const d of [-0.55, 0.55]) { g.add(box(0.95, 0.42, 0.7, mat('blue'), x + d, Y0 + 0.21, -0.45)); g.add(box(0.88, 0.04, 0.62, mat('soil'), x + d, Y0 + 0.43, -0.45));
      for (let i = 0; i < 3; i++) { const b = makeBush(x + d - 0.28 + i * 0.28, Y0 + 0.44, -0.45, 0.6, i * 3); b.add(mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(['#ff8ac8', '#ffcf4a', '#ff7a4a'][i]), 0, 0.42, 0)); g.add(b); } }
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.1, 10), mat('#cfeeff', { transparent: true, opacity: 0.55 }), x + 1.35, Y0 + 0.55, -0.4)); g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 10), mat('blue'), x + 1.35, Y0 + 1.12, -0.4)); }
  if (type === 'lamp') { g.add(mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.06, 8), mat('blue'), x, Y0 + 0.03, -0.4)); g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 5), mat('metal'), x, Y0 + 0.73, -0.4)); g.add(mesh(new THREE.ConeGeometry(0.25, 0.25, 10, 1, true), mat('#ffffff', { emissive: '#fff0d0', emissiveIntensity: 1.2, side: THREE.DoubleSide }), x, Y0 + 1.5, -0.4)); }
  return g;
}
// 4 варианта жилого и 4 стеклянного: окна по сторонам (не везде) и обстановка.
// Предметы: [тип, высокий?] — высокие ставим к глухим стенам.
const LAYOUT = {
  m_room: [
    { walls: ['window', 'plain', 'port', 'plain'], props: [['bunk'], ['desk'], ['shelf', 1]] },
    { walls: ['plain', 'port', 'window', 'plain'], props: [['bunk2', 1], ['kitchen'], ['table']] },
    { walls: ['port', 'window', 'plain', 'plain'], props: [['sofa'], ['locker', 1], ['lamp']] },
    { walls: ['plain', 'plain', 'window', 'port'], props: [['console'], ['bunk'], ['shelf', 1]] },
  ],
  m_glass: [
    { walls: ['big', 'big', 'big', 'plain'], props: [['plants'], ['plants'], ['hydro', 1]] },
    { walls: ['big', 'plain', 'big', 'plain'], props: [['trees'], ['hydro', 1], ['flowers']] },
    { walls: ['plain', 'big', 'big', 'big'], props: [['flowers'], ['plants'], ['trees']] },
    { walls: ['big', 'big', 'plain', 'big'], props: [['hydro', 1], ['trees'], ['plants']] },
  ],
};
// ---------- Модуль 4×4 из деталей ----------
// sides: ['wall'|'door'|'dock'|'open'] × 4 (0:−z, 1:+x, 2:+z, 3:−x), как в build.js
const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export function makeIceModule(id, sides, footY, variant = 0) {
  const g = new THREE.Group(), green = id === 'm_glass', L = (LAYOUT[id] || LAYOUT.m_room)[variant % 4];
  g.userData.kit = 'ice'; g.userData.variant = variant % 4;
  g.add(makeFloor());
  const fd = Math.max(0.3, footY);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = makeLeg(fd); l.position.set(a * 1.45, -0.35, b * 1.45); g.add(l); }
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = makePost(); p.position.set(a * M / 2, 0, b * M / 2); p.rotation.y = Math.atan2(a, b); g.add(p); }
  const roof = makeRoof(false, true, variant + (green ? 2 : 0), sides.map(k => k === 'open')); roof.name = 'roof'; g.add(roof);
  // какие стены — под мебель: высокие предметы к глухим, остальные к любым
  const wallSides = sides.map((k, s) => k === 'wall' ? s : -1).filter(s => s >= 0), used = new Set(), placeOn = {};
  for (const [type, tall] of L.props) {
    const pref = wallSides.filter(s => !used.has(s)).sort((a, b) => (tall ? (L.walls[a] === 'plain' ? 0 : 1) - (L.walls[b] === 'plain' ? 0 : 1) : 0));
    const s = pref[0]; if (s == null) break; used.add(s); placeOn[s] = type;
  }
  const solids = [];
  sides.forEach((k, s) => {
    if (k === 'open') return;
    const [a, b] = SIDES[s], f = new THREE.Group(); f.position.set(a * M / 2, 0, b * M / 2); f.rotation.y = s % 2 ? Math.PI / 2 : 0; f.name = 'side' + s; g.add(f);
    const sg = s === 0 || s === 3 ? -1 : 1, w = new THREE.Group(); if (sg < 0) w.rotation.y = Math.PI; f.add(w);   // каноника: наружу +z
    let kind = k === 'wall' ? L.walls[s] : k;
    if (k === 'wall' && kind === 'plain' && !green && placeOn[s] && ['bunk', 'desk', 'sofa', 'console'].includes(placeOn[s]) && L.walls.filter(q => q !== 'plain').length < 2) kind = 'port';
    w.add(makeWall(kind, green ? 'green' : 'pad'));
    if (k === 'wall' && placeOn[s]) { const pr = makeProp(placeOn[s]); pr.name = 'prop'; w.add(pr); }
    if (k === 'dock') { g.add(box(Math.abs(a) ? 1.7 : DOOR_W + 0.3, 0.14, Math.abs(b) ? 1.7 : DOOR_W + 0.3, gridMat(), a * 2.75, 0.2, b * 2.75));
      const t = new THREE.Group(); t.position.set(a * M / 2, 0, b * M / 2); t.rotation.y = Math.atan2(a, b); g.add(t);   // рукав: вдоль своей +z, от стены модуля к куполу
      const LEN = 1.3;   // стена модуля → поверхность купола (0.7) + заход под стекло
      t.add(mesh(extrude(archFrame(DOOR_W - 0.06, DOOR_W + ARCH_O, ARCH_Y, ARCH_Y), LEN), mat('blue'), 0, 0, -0.12));
      const shell = archFrame(DOOR_W + ARCH_O, DOOR_W + ARCH_O + 0.24, ARCH_Y, ARCH_Y); t.add(mesh(extrude(shell, LEN - 0.3), mat('hull'), 0, 0, 0.03));
      t.add(box(DOOR_W + ARCH_O + 0.5, 1.6, LEN - 0.3, mat('navy'), 0, Y0 - 0.8, 0.03 + (LEN - 0.3) / 2));   // юбка под рукавом до грунта
      for (const zz of [0.1, 0.62]) t.add(mesh(extrude(archFrame(DOOR_W + ARCH_O + 0.22, DOOR_W + ARCH_O + 0.34, ARCH_Y, ARCH_Y), 0.08), glowMat(), 0, 0, zz)); }
  });
  // хитбоксы мебели (в осях модуля, XZ): по bbox каждого предмета
  g.updateMatrixWorld(true);
  g.traverse(o => { if (o.name !== 'prop') return; const bb = new THREE.Box3().setFromObject(o); if (bb.isEmpty()) return; solids.push([bb.min.x, bb.min.z, bb.max.x, bb.max.z, bb.max.y]); });
  g.userData.solids = solids;
  return g;
}

// ---------- Купол-оранжерея: гранёный стеклянный купол в синем каркасе, бирюзовые пояса, шлюз ----------
export function makeIceDome(r, doorA, docks = [], H = 0.62) {
  const g = new THREE.Group(); g.userData.kit = 'ice';
  { const fl = mesh(new THREE.CylinderGeometry(r - 0.05, r - 0.05, 0.2, 40), [mat('navy'), gridMat(), mat('navy')], 0, 0.1, 0); fl.receiveShadow = true; fl.material[1] = (cache.gridDome ??= (() => { const m = gridMat().clone(); m.map = gridTex().clone(); m.map.repeat.set(r / 2, r / 2); m.map.needsUpdate = true; return m; })()); g.add(fl); }
  const gap = (DOOR_W / 2 + 0.1) / r, TAU = Math.PI * 2, th = a => ((Math.PI / 2 - a) % TAU + TAU) % TAU;
  const cuts = [...docks, doorA].map(th).sort((a, b) => a - b), arcs = [];
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
  // шлюз — как вход в модуль: короткий тамбур, арочная стена с раздвижными створками
  const door = new THREE.Group(); door.name = 'dome_door'; door.position.set(Math.cos(doorA) * (r - 0.25), 0, Math.sin(doorA) * (r - 0.25)); door.rotation.y = -doorA + Math.PI / 2; door.scale.setScalar(0.8); g.add(door);
  { const TW = 2.5, TL = 1.1, front = makeWall('door', 'pad', TW); front.position.z = TL; door.add(front);
    for (const x of [-1, 1]) { door.add(box(0.18, Y1 - Y0, TL, hullMat(), x * (TW / 2 - 0.09), (Y0 + Y1) / 2, TL / 2)); door.add(box(0.05, 1.0, TL - 0.3, frostMat(false), x * (TW / 2 + 0.005), 1.5, TL / 2)); door.add(box(0.06, Y1 - Y0 - 0.6, 0.06, glowMat(), x * (TW / 2 + 0.03), (Y0 + Y1) / 2, TL - 0.06)); }
    door.add(box(TW + 0.3, 0.22, TL + 0.3, mat('#ffffff'), 0, Y1 + 0.11, TL / 2)); door.add(box(TW + 0.32, 0.05, TL + 0.32, glowMat(C.glow, 2.0), 0, Y1 - 0.02, TL / 2));
    door.add(box(TW + 0.1, 0.06, TL + 0.1, mat('#82ccff'), 0, Y1 + 0.25, TL / 2));
    door.add(box(TW - 0.2, 0.08, TL, gridMat(), 0, Y0 + 0.04, TL / 2)); door.add(box(TW + 0.2, 1.6, TL, mat('navy'), 0, Y0 - 0.8, TL / 2)); }
  for (const sg of [-1, 1]) { const d = door.getObjectByName('door' + sg); if (d) d.name = 'door' + sg; }
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
  for (const o of [makeFloor(), makeRoof(false), makeRoof(false, true, 1), makePost()]) { o.position.x = x + M / 2; row3.add(o); x += M + 1.2; }
  row3.position.z = 7; g.add(row3);
  return g;
}
