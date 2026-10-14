export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'feeder';

  const std = (color, roughness = 0.7, metalness = 0.1, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness, metalness, ...extra });

  const mats = {
    hull: std('#e8e4dc', 0.6, 0.1),
    accent: std('#f08a3c', 0.55, 0.1),
    metal: std('#5b616b', 0.45, 0.6),
    dark: std('#2e3238', 0.6, 0.4),
    wood: std('#c98a5a', 0.85, 0.0),
    woodDark: std('#b4532a', 0.85, 0.0),
    glow: std('#6fe3ff', 0.3, 0.0, { emissive: '#6fe3ff', emissiveIntensity: 1.4 }),
    glass: std('#9fd8ff', 0.15, 0.1, { transparent: true, opacity: 0.55 }),
    water: std('#9fd8ff', 0.1, 0.1, { transparent: true, opacity: 0.75, emissive: '#6fe3ff', emissiveIntensity: 0.15 }),
    fruitO: std('#f08a3c', 0.6, 0.0),
    fruitG: std('#5fbf5a', 0.6, 0.0),
    fill: std('#2f7f45', 0.9, 0.0),
  };

  // deterministic seed
  let s = 1337;
  const rnd = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const box = (w, h, d, mat, x, y, z, parent = root) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const cyl = (rt, rb, h, seg, mat, x, y, z, parent = root) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // ---------- TROUGH ----------
  const tx = -0.2, tz = -0.1;   // trough center
  const L = 0.9, W = 0.6;       // outer length (x), width (z)
  const wall = 0.05;
  const yBot = 0.4, yTop = 0.65;

  // bottom
  box(L, 0.05, W, mats.woodDark, tx, yBot + 0.025, tz);
  // front & back walls — two planks each
  for (const sz of [1, -1]) {
    const z = tz + sz * (W / 2 - wall / 2);
    box(L, 0.1, wall, mats.wood, tx, 0.5, z);
    box(L, 0.1, wall, mats.woodDark, tx, 0.6, z);
  }
  // side walls
  for (const sx of [1, -1]) {
    box(wall, 0.2, W - wall * 2, mats.wood, tx + sx * (L / 2 - wall / 2), 0.55, tz);
  }
  // metal rim bands (front/back)
  for (const sz of [1, -1]) {
    box(L + 0.02, 0.04, wall + 0.02, mats.metal, tx, yTop + 0.01, tz + sz * (W / 2 - wall / 2));
  }

  // corner posts = legs + feet
  const px = L / 2 + 0.015, pz = W / 2 + 0.015;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const x = tx + sx * px, z = tz + sz * pz;
      box(0.06, 0.67, 0.06, mats.metal, x, 0.03 + 0.335, z);
      box(0.11, 0.03, 0.11, mats.dark, x, 0.015, z);
    }
  }
  // lower braces front/back
  for (const sz of [1, -1]) {
    box(L, 0.04, 0.04, mats.dark, tx, 0.16, tz + sz * pz);
  }
  // lower braces sides
  for (const sx of [1, -1]) {
    box(0.04, 0.04, W, mats.dark, tx + sx * px, 0.16, tz);
  }

  // front label plate with glow strip
  const frontZ = tz + W / 2;
  box(0.34, 0.12, 0.03, mats.hull, tx, 0.54, frontZ + 0.015);
  box(0.26, 0.035, 0.02, mats.glow, tx, 0.54, frontZ + 0.035);
  box(0.06, 0.12, 0.035, mats.accent, tx - 0.2, 0.54, frontZ + 0.017);
  box(0.06, 0.12, 0.035, mats.accent, tx + 0.2, 0.54, frontZ + 0.017);

  // fill mound under fruits
  box(L - wall * 2, 0.12, W - wall * 2, mats.fill, tx, 0.51 + 0.06, tz);

  // ---------- FRUITS ----------
  const fruitGeo = new THREE.IcosahedronGeometry(1, 1);
  const fillTop = 0.63;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      const r = 0.065 + rnd() * 0.025;
      const isGreen = rnd() < 0.4;
      const m = new THREE.Mesh(fruitGeo, isGreen ? mats.fruitG : mats.fruitO);
      const x = -0.53 + i * 0.165 + (rnd() - 0.5) * 0.04;
      const z = -0.29 + j * 0.13 + (rnd() - 0.5) * 0.03;
      m.scale.set(r, r * (0.85 + rnd() * 0.25), r * (0.9 + rnd() * 0.2));
      m.position.set(x, fillTop + r * (0.3 + rnd() * 0.4), z);
      m.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
      root.add(m);
    }
  }

  // ---------- WATERER ----------
  const wx = 0.5, wz = 0.28;
  // base plate
  cyl(0.19, 0.19, 0.05, 12, mats.dark, wx, 0.025, wz);
  // bowl (lathe)
  const prof = [
    new THREE.Vector2(0.0, 0.05),
    new THREE.Vector2(0.18, 0.05),
    new THREE.Vector2(0.2, 0.15),
    new THREE.Vector2(0.185, 0.15),
    new THREE.Vector2(0.165, 0.08),
    new THREE.Vector2(0.0, 0.08),
  ];
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 12), mats.metal);
  bowl.position.set(wx, 0, wz);
  root.add(bowl);
  // water in bowl
  cyl(0.17, 0.165, 0.05, 12, mats.water, wx, 0.105, wz);
  // tank collar
  cyl(0.125, 0.13, 0.05, 12, mats.hull, wx, 0.105, wz);
  // glass tank
  cyl(0.11, 0.11, 0.42, 12, mats.glass, wx, 0.13 + 0.21, wz);
  // water inside tank
  cyl(0.095, 0.095, 0.28, 10, mats.water, wx, 0.13 + 0.14, wz);
  // glow ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.018, 6, 14), mats.glow);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(wx, 0.42, wz);
  root.add(ring);
  // cap
  cyl(0.12, 0.125, 0.06, 12, mats.metal, wx, 0.58, wz);
  cyl(0.06, 0.08, 0.04, 8, mats.accent, wx, 0.63, wz);
  // handle
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 10, Math.PI), mats.dark);
  handle.position.set(wx, 0.65, wz);
  root.add(handle);
  // accent stripe on base
  cyl(0.195, 0.195, 0.03, 12, mats.accent, wx, 0.065, wz);

  return root;
}