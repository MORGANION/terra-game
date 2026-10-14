export default function build(THREE) {
  const root = new THREE.Group();

  // ---------- Материалы ----------
  const M = (color, o = {}) => new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: o.r ?? 0.7, metalness: o.m ?? 0.1, ...o.extra
  });
  const mats = {
    hull: M('#e8e4dc', { r: 0.6 }),
    accent: M('#f08a3c', { r: 0.5 }),
    metal: M('#5b616b', { r: 0.4, m: 0.6 }),
    dark: M('#2e3238', { r: 0.6, m: 0.3 }),
    glow: M('#6fe3ff', { r: 0.3, extra: { emissive: new THREE.Color('#6fe3ff'), emissiveIntensity: 1.4 } }),
    glass: M('#9fd8ff', { r: 0.1, m: 0.1, extra: { transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false } }),
    sand: M('#c98a5a', { r: 0.9 }),
    rust: M('#b4532a', { r: 0.9 }),
    plant: M('#5fbf5a', { r: 0.8 }),
    plantDark: M('#2f7f45', { r: 0.8 }),
    flower: M('#ff7fb0', { r: 0.6 }),
  };

  // ---------- Детерминированный рандом ----------
  let seed = 1337;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();

  const add = (geo, mat, x = 0, y = 0, z = 0, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // ---------- Основание ----------
  const BASE_H = 0.2;
  const R = 1.5;           // радиус купола
  const WALL_TOP = 0.6;    // верх кольцевой стенки

  add(new THREE.CylinderGeometry(1.8, 1.85, BASE_H, 16), mats.metal, 0, BASE_H / 2, 0);
  const accRing = add(new THREE.TorusGeometry(1.79, 0.04, 4, 24), mats.accent, 0, BASE_H, 0);
  accRing.rotation.x = Math.PI / 2;

  // кольцевая стенка (открытый цилиндр)
  add(new THREE.CylinderGeometry(R, R + 0.03, WALL_TOP - BASE_H, 20, 1, true),
    M('#e8e4dc', { r: 0.6, extra: { side: THREE.DoubleSide } }), 0, (WALL_TOP + BASE_H) / 2, 0);
  const glowRing = add(new THREE.TorusGeometry(R + 0.02, 0.035, 4, 24), mats.glow, 0, WALL_TOP - 0.06, 0);
  glowRing.rotation.x = Math.PI / 2;
  const capRing = add(new THREE.TorusGeometry(R, 0.06, 4, 24), mats.metal, 0, WALL_TOP, 0);
  capRing.rotation.x = Math.PI / 2;

  // ---------- Стеклянный купол ----------
  add(new THREE.SphereGeometry(R - 0.02, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.glass, 0, WALL_TOP, 0);

  // меридианные рёбра
  for (let i = 0; i < 4; i++) {
    const arch = add(new THREE.TorusGeometry(R, 0.045, 4, 16, Math.PI), mats.metal, 0, WALL_TOP, 0);
    arch.rotation.y = (i * Math.PI) / 4;
  }
  // горизонтальные кольца
  [0.5, 1.0].forEach((a) => {
    const ring = add(new THREE.TorusGeometry(R * Math.cos(a), 0.04, 4, 20), mats.metal, 0, WALL_TOP + R * Math.sin(a), 0);
    ring.rotation.x = Math.PI / 2;
  });

  // верхний вентиляционный узел + антенна
  const TOP = WALL_TOP + R;
  add(new THREE.CylinderGeometry(0.28, 0.34, 0.2, 8), mats.hull, 0, TOP + 0.05, 0);
  add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8), mats.glow, 0, TOP + 0.18, 0);
  add(new THREE.CylinderGeometry(0.035, 0.05, 0.55, 6), mats.dark, 0, TOP + 0.48, 0);
  add(new THREE.IcosahedronGeometry(0.07, 0), mats.accent, 0, TOP + 0.78, 0);

  // ---------- Шлюз (лицо к +Z) ----------
  const airlock = new THREE.Group();
  airlock.position.set(0, BASE_H, 1.5);
  root.add(airlock);
  add(new THREE.BoxGeometry(0.85, 0.95, 0.6), mats.hull, 0, 0.475, 0, airlock);
  add(new THREE.BoxGeometry(0.95, 0.1, 0.66), mats.accent, 0, 1.0, 0, airlock);
  add(new THREE.BoxGeometry(0.5, 0.75, 0.06), mats.dark, 0, 0.4, 0.3, airlock);
  add(new THREE.BoxGeometry(0.5, 0.06, 0.07), mats.glow, 0, 0.82, 0.31, airlock);

  // ---------- Внутренняя почва ----------
  add(new THREE.CylinderGeometry(R - 0.04, R - 0.04, 0.06, 16), mats.sand, 0, BASE_H + 0.03, 0);
  const GROUND = BASE_H + 0.06;

  // ---------- Деревья внутри ----------
  const tree = (x, z, h, round) => {
    const s = rr(0.9, 1.1);
    add(new THREE.CylinderGeometry(0.05, 0.08, h, 5), mats.rust, x, GROUND + h / 2, z);
    if (round) {
      const f1 = add(new THREE.IcosahedronGeometry(0.42 * s, 0), mats.plant, x, GROUND + h + 0.2, z);
      f1.rotation.set(rr(0, 1), rr(0, 3), rr(0, 1));
      const f2 = add(new THREE.IcosahedronGeometry(0.3 * s, 0), mats.plantDark, x + rr(-0.1, 0.1), GROUND + h + 0.55, z + rr(-0.1, 0.1));
      f2.rotation.set(rr(0, 1), rr(0, 3), rr(0, 1));
    } else {
      const c1 = add(new THREE.ConeGeometry(0.38 * s, 0.6, 6), mats.plantDark, x, GROUND + h + 0.15, z);
      c1.rotation.y = rr(0, 3);
      const c2 = add(new THREE.ConeGeometry(0.27 * s, 0.45, 6), mats.plant, x, GROUND + h + 0.5, z);
      c2.rotation.y = rr(0, 3);
    }
  };
  tree(0.1, -0.35, 0.75, true);
  tree(-0.75, 0.25, 0.5, false);
  tree(0.7, 0.35, 0.45, false);

  // кусты
  [[-0.5, -0.9], [0.8, -0.6], [-1.0, -0.3], [0.35, 0.8]].forEach(([x, z], i) => {
    const r = rr(0.2, 0.3);
    const b = add(new THREE.DodecahedronGeometry(r, 0), i % 2 ? mats.plant : mats.plantDark, x, GROUND + r * 0.6, z);
    b.scale.set(rr(1, 1.3), rr(0.7, 0.9), rr(1, 1.3));
    b.rotation.y = rr(0, 3);
  });
  // цветы внутри
  [[-0.35, 0.55], [0.45, -0.95], [-0.95, -0.7]].forEach(([x, z]) => {
    add(new THREE.IcosahedronGeometry(rr(0.07, 0.1), 0), mats.flower, x, GROUND + 0.06, z);
  });

  // ---------- Грядки по углам ----------
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => {
    const g = new THREE.Group();
    g.position.set(sx * 1.62, 0, sz * 1.62);
    g.rotation.y = rr(-0.08, 0.08);
    root.add(g);
    add(new THREE.BoxGeometry(0.8, 0.3, 0.8), mats.hull, 0, 0.15, 0, g);
    add(new THREE.BoxGeometry(0.68, 0.05, 0.68), mats.rust, 0, 0.3, 0, g);
    // зелень
    const p1 = add(new THREE.DodecahedronGeometry(0.2, 0), mats.plant, rr(-0.15, -0.05), 0.42, rr(-0.15, 0.05), g);
    p1.scale.set(1.1, rr(0.7, 1), 1.1);
    p1.rotation.y = rr(0, 3);
    const p2 = add(new THREE.ConeGeometry(0.13, rr(0.3, 0.42), 5), mats.plantDark, rr(0.1, 0.2), 0.48, rr(0.05, 0.18), g);
    p2.rotation.set(rr(-0.15, 0.15), rr(0, 3), rr(-0.15, 0.15));
  });

  return root;
}