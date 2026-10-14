export default function build(THREE) {
  const root = new THREE.Group();

  // ---------- Детерминированный генератор случайных чисел ----------
  let seed = 1337;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();

  // ---------- Материалы ----------
  const M = (color, o = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0.05, ...o });
  const mats = {
    stone: M('#5b616b', { roughness: 0.95 }),
    stoneLight: M('#e8e4dc', { roughness: 0.95 }),
    ash: M('#2e3238', { roughness: 1 }),
    wood: M('#c98a5a', { roughness: 0.85 }),
    woodDark: M('#b4532a', { roughness: 0.85 }),
    woodCut: M('#e8e4dc', { roughness: 0.9 }),
    metal: M('#5b616b', { roughness: 0.5, metalness: 0.5 }),
    dark: M('#2e3238', { roughness: 0.7 }),
    flame: M('#f08a3c', { emissive: '#f08a3c', emissiveIntensity: 1.6, roughness: 0.4 }),
    flameCore: M('#e8e4dc', { emissive: '#f08a3c', emissiveIntensity: 2.2, roughness: 0.4 }),
    ember: M('#b4532a', { emissive: '#f08a3c', emissiveIntensity: 0.9 }),
    glow: M('#6fe3ff', { emissive: '#6fe3ff', emissiveIntensity: 1.5, roughness: 0.3 }),
    accent: M('#f08a3c', { roughness: 0.6 }),
    pink: M('#ff7fb0', { roughness: 0.7 }),
  };

  const add = (geo, mat, x = 0, y = 0, z = 0, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // ---------- Костёр ----------
  const FX = 0, FZ = 0.2;

  // Пепельное пятно
  add(new THREE.CylinderGeometry(0.46, 0.5, 0.04, 10), mats.ash, FX, 0.02, FZ);

  // Каменный круг (9 камней)
  const stoneCount = 9;
  for (let i = 0; i < stoneCount; i++) {
    const a = (i / stoneCount) * Math.PI * 2 + rr(-0.1, 0.1);
    const r = rr(0.13, 0.17);
    const s = add(
      new THREE.DodecahedronGeometry(r, 0),
      i % 3 === 0 ? mats.stoneLight : mats.stone,
      FX + Math.cos(a) * 0.58, r * 0.6, FZ + Math.sin(a) * 0.58
    );
    s.scale.set(rr(1.0, 1.3), rr(0.7, 0.9), rr(0.9, 1.15));
    s.rotation.set(rr(0, 1), rr(0, 6.28), rr(0, 1));
  }

  // Поленья-шалаш (4 шт.)
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const len = rr(0.62, 0.72);
    const geo = new THREE.CylinderGeometry(0.045, 0.06, len, 6);
    geo.translate(0, len / 2, 0);
    const bx = FX + Math.cos(a) * 0.32, bz = FZ + Math.sin(a) * 0.32;
    const stick = add(geo, i % 2 ? mats.wood : mats.woodDark, bx, 0.04, bz);
    const dir = new THREE.Vector3(-Math.cos(a) * 0.32, 0.55, -Math.sin(a) * 0.32).normalize();
    stick.quaternion.setFromUnitVectors(up, dir);
  }

  // Угли
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.3;
    const e = add(new THREE.IcosahedronGeometry(rr(0.08, 0.11), 0), mats.ember,
      FX + Math.cos(a) * 0.17, 0.07, FZ + Math.sin(a) * 0.17);
    e.scale.y = 0.6;
    e.rotation.y = rr(0, 6.28);
  }

  // Пламя
  const f1 = add(new THREE.ConeGeometry(0.26, 0.8, 6), mats.flame, FX, 0.04 + 0.4, FZ);
  f1.rotation.y = 0.3;
  const f2 = add(new THREE.ConeGeometry(0.15, 0.5, 5), mats.flame, FX + 0.17, 0.04 + 0.25, FZ + 0.06);
  f2.rotation.z = -0.18;
  const f3 = add(new THREE.ConeGeometry(0.14, 0.45, 5), mats.flame, FX - 0.15, 0.04 + 0.225, FZ - 0.05);
  f3.rotation.z = 0.2;
  add(new THREE.ConeGeometry(0.13, 0.5, 5), mats.flameCore, FX, 0.06 + 0.25, FZ + 0.04);

  // ---------- Тотем ----------
  const TZ = -1.22;
  // Постамент
  add(new THREE.CylinderGeometry(0.36, 0.42, 0.24, 7), mats.stone, 0, 0.12, TZ);
  // Столб
  add(new THREE.CylinderGeometry(0.22, 0.26, 2.4, 8), mats.wood, 0, 0.24 + 1.2, TZ);
  // Резные пояса
  add(new THREE.CylinderGeometry(0.29, 0.29, 0.1, 8), mats.woodDark, 0, 0.62, TZ);
  add(new THREE.CylinderGeometry(0.27, 0.27, 0.1, 8), mats.woodDark, 0, 2.38, TZ);
  // Светящийся техно-обруч
  add(new THREE.CylinderGeometry(0.255, 0.255, 0.06, 8), mats.glow, 0, 1.35, TZ);
  // Поперечина-«крылья»
  const bar = add(new THREE.BoxGeometry(1.0, 0.16, 0.2), mats.woodDark, 0, 1.9, TZ);
  bar.rotation.z = 0.0;
  add(new THREE.BoxGeometry(0.12, 0.3, 0.22), mats.accent, 0.5, 1.9, TZ);
  add(new THREE.BoxGeometry(0.12, 0.3, 0.22), mats.accent, -0.5, 1.9, TZ);

  // Голова кота
  const HY = 2.88;
  add(new THREE.BoxGeometry(0.72, 0.56, 0.5), mats.wood, 0, HY, TZ);
  // Уши
  for (const sx of [-1, 1]) {
    const ear = add(new THREE.ConeGeometry(0.16, 0.32, 4), mats.wood, sx * 0.22, 3.08 + 0.16, TZ);
    ear.rotation.y = Math.PI / 4;
    const inner = add(new THREE.ConeGeometry(0.08, 0.2, 4), mats.pink, sx * 0.22, 3.1 + 0.1, TZ + 0.07);
    inner.rotation.y = Math.PI / 4;
  }
  // Глаза (светящиеся)
  const FZf = TZ + 0.25;
  add(new THREE.BoxGeometry(0.16, 0.1, 0.06), mats.glow, -0.16, HY + 0.08, FZf + 0.01);
  add(new THREE.BoxGeometry(0.16, 0.1, 0.06), mats.glow, 0.16, HY + 0.08, FZf + 0.01);
  // Морда
  add(new THREE.BoxGeometry(0.32, 0.18, 0.1), mats.woodCut, 0, HY - 0.13, FZf + 0.03);
  const nose = add(new THREE.ConeGeometry(0.07, 0.08, 3), mats.accent, 0, HY - 0.03, FZf + 0.06);
  nose.rotation.x = Math.PI;
  // Усы
  for (const sx of [-1, 1]) {
    const w = add(new THREE.BoxGeometry(0.3, 0.04, 0.04), mats.dark, sx * 0.28, HY - 0.13, FZf + 0.06);
    w.rotation.z = sx * 0.12;
  }

  // ---------- Брёвна-сиденья ----------
  const logGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.1, 7);
  const logs = [
    { x: -1.27, z: 0.2, ry: 0 },
    { x: 1.27, z: 0.2, ry: 0 },
    { x: 0, z: 1.32, ry: Math.PI / 2 },
  ];
  for (const l of logs) {
    const log = add(logGeo, mats.wood, l.x, 0.15, l.z);
    log.rotation.order = 'YXZ';
    log.rotation.y = l.ry + rr(-0.12, 0.12);
    log.rotation.x = Math.PI / 2;
  }

  // Пни
  for (const sx of [-1, 1]) {
    const x = sx * 0.98, z = 1.0;
    const st = add(new THREE.CylinderGeometry(0.19, 0.22, 0.38, 7), mats.woodDark, x, 0.19, z);
    st.rotation.y = rr(0, 6.28);
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 7), mats.woodCut, x, 0.395, z);
  }

  return root;
}