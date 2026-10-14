export default function build(THREE) {
  const root = new THREE.Group();

  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, metalness: 0.1, ...o });
  const mats = {
    hull: M('#e8e4dc', { roughness: 0.6 }),
    accent: M('#f08a3c', { roughness: 0.6 }),
    metal: M('#5b616b', { roughness: 0.5, metalness: 0.5 }),
    dark: M('#2e3238', { roughness: 0.8, metalness: 0.3 }),
    darkDS: M('#2e3238', { roughness: 0.8, metalness: 0.3, side: THREE.DoubleSide }),
    glow: M('#6fe3ff', { emissive: '#6fe3ff', emissiveIntensity: 1.2 }),
    glass: M('#9fd8ff', { transparent: true, opacity: 0.6, roughness: 0.1 }),
    rust: M('#b4532a'),
    sand: M('#c98a5a', { roughness: 1 }),
    scorch: M('#1c1714', { roughness: 1 }),
  };

  let seed = 1337;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = root) =>
    add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz, parent);
  // запекает поворот/масштаб в геометрию и ставит объект на землю (min y = 0)
  const grounded = (geo, mat, x, z, rx, ry, rz, sx = 1, sy = 1, sz = 1) => {
    geo.scale(sx, sy, sz);
    geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
    geo.computeBoundingBox();
    return add(geo, mat, x, -geo.boundingBox.min.y, z);
  };

  // ===== КОРПУС (z -10.5..10.5, ширина 6, низ на y=0) =====
  const L = 21, ZH = 10.5, WH = 4.3;
  box(6, 0.2, L, mats.dark, 0, 0.1, 0);                         // пол
  box(0.3, WH, L, mats.hull, -2.85, WH / 2, 0);                  // левая стена
  // правая стена с проёмом z -1.25..1.25, y 0..2.5
  const frontLen = ZH - 1.25;
  box(0.3, WH, frontLen, mats.hull, 2.85, WH / 2, 1.25 + frontLen / 2);
  box(0.3, WH, frontLen, mats.hull, 2.85, WH / 2, -1.25 - frontLen / 2);
  box(0.3, WH - 2.5, 2.5, mats.hull, 2.85, 2.5 + (WH - 2.5) / 2, 0); // перемычка
  box(6, WH, 0.3, mats.hull, 0, WH / 2, -ZH + 0.15);             // задняя переборка

  // крыша и фаски, разрыв z -2.5..2.5 (торчат рёбра)
  const segLen = ZH - 2.5, segZ = 2.5 + segLen / 2;
  for (const s of [1, -1]) {
    box(4.6, 0.25, segLen, mats.hull, 0, 4.9, s * segZ);
    box(1.0, 0.25, segLen, mats.hull, 2.65, 4.65, s * segZ, 0, 0, -Math.PI / 4);
    box(1.0, 0.25, segLen, mats.hull, -2.65, 4.65, s * segZ, 0, 0, Math.PI / 4);
    box(0.8, 0.06, segLen, mats.accent, 0, 5.05, s * segZ);      // полоса по крыше
  }
  // рёбра каркаса
  for (const z of [-1.6, 0, 1.6]) {
    add(new THREE.TorusGeometry(3, 0.18, 4, 8, Math.PI), mats.metal, 0, 2.2, z);
  }
  // оранжевые полосы по бортам
  box(0.06, 0.6, L, mats.accent, 3.03, 3.3, 0);
  box(0.06, 0.6, L, mats.accent, -3.03, 3.3, 0);

  // дыры в обшивке
  box(0.08, 1.2, 2.0, mats.scorch, -3.02, 2.0, 5.5, 0.3, 0, 0);
  box(0.08, 0.9, 1.4, mats.scorch, -3.02, 1.4, -4.5, -0.4, 0, 0);
  box(1.6, 0.06, 1.8, mats.scorch, 0.6, 5.04, 7.0, 0, 0.4, 0);
  box(0.08, 1.0, 1.6, mats.rust, 3.03, 1.2, -7.0, 0.2, 0, 0);

  // ===== ГРУЗОВОЙ ЛЮК (+X) =====
  box(0.25, 2.9, 0.4, mats.metal, 3.12, 1.45, 1.45);
  box(0.25, 2.9, 0.4, mats.metal, 3.12, 1.45, -1.45);
  box(0.25, 0.4, 3.3, mats.accent, 3.12, 2.7, 0);
  box(2.5, 0.15, 2.5, mats.metal, 4.3, 0.075, 0, 0, 0, 0);      // откинутая створка
  box(0.1, 0.3, 2.0, mats.glow, -2.66, 2.0, 0);                 // свет внутри

  // ===== НОС (смят и зарыт) =====
  const prof = new THREE.Shape();
  prof.moveTo(0, 0); prof.lineTo(0, 5); prof.lineTo(1.5, 4.6);
  prof.lineTo(3.5, 2.2); prof.lineTo(4.2, 0.6); prof.lineTo(4.2, 0); prof.lineTo(0, 0);
  const noseGeo = new THREE.ExtrudeGeometry(prof, { depth: 5.6, bevelEnabled: false });
  noseGeo.translate(0, 0, -2.8);
  noseGeo.rotateY(-Math.PI / 2);
  add(noseGeo, mats.hull, 0, 0, ZH);
  box(3.6, 0.1, 1.6, mats.glass, 0, 3.43, ZH + 2.54, 0.876, 0, 0);   // треснувший фонарь
  box(0.08, 1.4, 2.4, mats.accent, 2.82, 1.6, ZH + 1.6, 0.35, 0, 0.1);
  box(0.08, 1.2, 1.4, mats.scorch, -2.82, 1.0, ZH + 2.6, -0.3, 0, 0);

  // наносы песка вокруг носа
  const mound = (r, x, z, sx, sy, sz) =>
    add(new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mats.sand, x, 0, z).scale.set(sx, sy, sz);
  mound(2.6, 0, 13.6, 1.4, 0.55, 0.45);
  mound(1.8, 3.2, 12.6, 0.9, 0.6, 1.0);
  mound(1.8, -3.2, 12.4, 0.9, 0.5, 1.1);

  // ===== ДВИГАТЕЛЬ (разломан) =====
  add(new THREE.CylinderGeometry(2.1, 2.1, 2.5, 8), mats.metal, 0, 2.4, -11.75, Math.PI / 2, 0, Math.PI / 8);
  add(new THREE.CylinderGeometry(1.5, 2.2, 1.8, 8, 1, true), mats.darkDS, 0.3, 2.4, -13.7, Math.PI / 2, 0.25, 0);
  add(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 8), mats.glow, 0, 2.4, -13.05, Math.PI / 2, 0, 0);
  box(1.2, 0.8, 0.3, mats.dark, 1.6, 4.3, -12.8, 0, 0, 0.5);   // оторванный кожух
  grounded(new THREE.CylinderGeometry(0.9, 1.4, 2, 8, 1, true), mats.darkDS, -5.6, -12.2, 0, 0.5, Math.PI / 2 + 0.24);

  // ===== КРЫЛЬЯ =====
  // уцелевшее (+X), кончик упирается в землю
  const wing = new THREE.Group();
  wing.position.set(3, 2.0, -6);
  wing.rotation.z = -Math.atan2(1.8, 5);
  root.add(wing);
  const wl = Math.hypot(1.8, 5);
  box(wl, 0.35, 5, mats.hull, wl / 2, 0, 0, 0, 0, 0, wing);
  box(wl * 0.8, 0.06, 1.0, mats.accent, wl * 0.5, 0.2, 1.4, 0, 0, 0, wing);

  // обломок крыла (-X) у корпуса
  box(1.2, 0.4, 3.5, mats.metal, -3.5, 2.0, -6, 0, 0, 0.15);
  // отломанное крыло лежит рядом
  const ws = new THREE.Shape();
  ws.moveTo(0.3, 0); ws.lineTo(-4, 1.2); ws.lineTo(-4, 3.2); ws.lineTo(0, 5);
  ws.lineTo(0.4, 3.6); ws.lineTo(-0.2, 2.5); ws.lineTo(0.3, 0);
  const wgeo = new THREE.ExtrudeGeometry(ws, { depth: 0.4, bevelEnabled: false });
  wgeo.rotateX(-Math.PI / 2);
  add(wgeo, mats.hull, -3.9, 0, -1.0, 0, 0.12, 0);
  box(3.4, 0.06, 0.8, mats.accent, -6.0, 0.43, -3.7, 0, 0.12, 0);

  // ===== ХВОСТОВОЙ КИЛЬ =====
  box(0.4, 2, 3, mats.hull, 0, 6, -8.5, 0, 0, 0);
  box(0.45, 0.5, 2.2, mats.accent, 0, 6.75, -8.8);

  // ===== ОБЛОМКИ / КАМНИ =====
  for (let i = 0; i < 5; i++) {
    const r = 0.5 + rnd() * 0.6;
    const ang = rnd() * Math.PI * 2;
    const spots = [[5.5, 9], [-5.5, 8], [6.0, -11], [-6.5, 3], [5.5, 4.5]];
    const [x, z] = spots[i];
    grounded(new THREE.DodecahedronGeometry(r, 0), i % 2 ? mats.sand : mats.rust, x, z,
      rnd() * 3, ang, rnd() * 3, 1 + rnd() * 0.3, 0.6 + rnd() * 0.3, 1);
  }
  grounded(new THREE.BoxGeometry(1.6, 0.12, 1.0), mats.hull, 5.8, -3.2, 0, 0.7, 0.15);
  grounded(new THREE.BoxGeometry(1.2, 0.12, 0.8), mats.metal, -2.0, -14.0, 0.2, -0.5, 0);

  // ===== НОРМАЛИЗАЦИЯ: основание строго на y=0, центр XZ, габарит =====
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); bb.getSize(size);
  const k = Math.min(1, 16 / size.x, 7 / size.y, 30 / size.z);
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  root.children.forEach(c => c.position.set(c.position.x - cx, c.position.y - bb.min.y, c.position.z - cz));
  root.scale.setScalar(k);
  root.updateMatrixWorld(true);

  return root;
}