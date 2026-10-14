export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'res_uranium';

  // --- детерминированный генератор случайных чисел ---
  let seed = 74219;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();

  // --- материалы ---
  const mats = {
    rock: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.95, metalness: 0.05 }),
    rockLight: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.9, metalness: 0.1 }),
    rust: new THREE.MeshStandardMaterial({ color: '#b4532a', flatShading: true, roughness: 0.9, metalness: 0.1 }),
    crystal: new THREE.MeshStandardMaterial({
      color: '#5fbf5a', emissive: '#5fbf5a', emissiveIntensity: 1.1,
      flatShading: true, roughness: 0.3, metalness: 0.0,
      transparent: true, opacity: 0.8
    }),
    crystalCore: new THREE.MeshStandardMaterial({
      color: '#5fbf5a', emissive: '#5fbf5a', emissiveIntensity: 1.8,
      flatShading: true, roughness: 0.4, metalness: 0.0
    }),
    crystalDeep: new THREE.MeshStandardMaterial({
      color: '#2f7f45', emissive: '#2f7f45', emissiveIntensity: 1.2,
      flatShading: true, roughness: 0.4, metalness: 0.0
    })
  };

  const add = (geo, mat, x, y, z, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // --- каменное основание ---
  const rocks = [
    { r: 0.42, x: 0.0,   z: 0.0,   sy: 0.62, mat: mats.rock },
    { r: 0.28, x: 0.26,  z: 0.2,   sy: 0.7,  mat: mats.rock },
    { r: 0.26, x: -0.28, z: 0.16,  sy: 0.65, mat: mats.rockLight },
    { r: 0.24, x: -0.18, z: -0.28, sy: 0.7,  mat: mats.rock },
    { r: 0.22, x: 0.3,   z: -0.22, sy: 0.6,  mat: mats.rockLight },
    { r: 0.14, x: 0.05,  z: 0.4,   sy: 0.7,  mat: mats.rust }
  ];
  rocks.forEach((p, i) => {
    const geo = i % 2 === 0
      ? new THREE.DodecahedronGeometry(p.r, 0)
      : new THREE.IcosahedronGeometry(p.r, 0);
    const sx = rr(0.95, 1.15), sz = rr(0.95, 1.15);
    const m = add(geo, p.mat, p.x, p.r * p.sy * 0.75, p.z);
    m.scale.set(sx, p.sy, sz);
    m.rotation.set(rr(-0.2, 0.2), rr(0, Math.PI * 2), rr(-0.2, 0.2));
  });

  // --- кристаллы ---
  const up = new THREE.Vector3(0, 1, 0);
  const crystal = (bx, by, bz, dx, dy, dz, len, rad, mat) => {
    const g = new THREE.Group();
    const tip = rad * 1.8;
    const body = add(new THREE.CylinderGeometry(rad, rad * 1.08, len, 6), mat, 0, len / 2, 0, g);
    body.rotation.y = rr(0, Math.PI);
    const cone = add(new THREE.ConeGeometry(rad, tip, 6), mat, 0, len + tip / 2, 0, g);
    cone.rotation.y = body.rotation.y;
    g.position.set(bx, by, bz);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    g.quaternion.setFromUnitVectors(up, dir);
    g.rotateY(rr(0, Math.PI));
    root.add(g);
  };

  // главный кристалл (верх ≈ 0.97 м)
  crystal(0.0, 0.3, 0.0, 0.05, 1, 0.08, 0.52, 0.085, mats.crystalCore);
  // окружение главного
  crystal(0.08, 0.3, 0.06, 0.45, 1, 0.3, 0.4, 0.06, mats.crystal);
  crystal(-0.08, 0.3, 0.04, -0.5, 1, 0.25, 0.36, 0.06, mats.crystal);
  crystal(0.0, 0.28, -0.08, 0.1, 1, -0.55, 0.38, 0.055, mats.crystalDeep);
  // боковые кристаллы на камнях
  crystal(0.28, 0.25, 0.2, 0.8, 1, 0.6, 0.26, 0.05, mats.crystalCore);
  crystal(-0.3, 0.22, 0.18, -0.9, 1, 0.5, 0.24, 0.05, mats.crystal);
  crystal(-0.18, 0.24, -0.28, -0.5, 1, -0.9, 0.22, 0.045, mats.crystalCore);
  crystal(0.3, 0.18, -0.22, 0.9, 1, -0.6, 0.2, 0.045, mats.crystalDeep);
  crystal(0.06, 0.12, 0.4, 0.2, 1, 1.0, 0.16, 0.04, mats.crystal);
  crystal(0.16, 0.3, -0.04, 1.0, 1, -0.1, 0.22, 0.045, mats.crystal);

  // --- мелкие светящиеся осколки у подножия (лежат на земле) ---
  const shards = [
    [0.46, 0.02, 0.32], [-0.48, -0.05, -0.1], [0.12, 0.0, 0.52],
    [-0.36, 0.0, 0.42], [0.44, 0.0, -0.4]
  ];
  shards.forEach(([x, , z], i) => {
    const r = rr(0.035, 0.055);
    const m = add(new THREE.OctahedronGeometry(r, 0),
      i % 2 ? mats.crystal : mats.crystalCore, x, r * 0.8, z);
    m.scale.set(1, rr(1.2, 1.6), 1);
    m.rotation.set(rr(-0.3, 0.3), rr(0, Math.PI), rr(-0.3, 0.3));
  });

  // --- мелкие камушки ---
  [[-0.5, 0.3], [0.5, 0.05], [-0.1, -0.5]].forEach(([x, z]) => {
    const r = rr(0.06, 0.09);
    const m = add(new THREE.DodecahedronGeometry(r, 0), mats.rock, x, r * 0.6, z);
    m.scale.y = 0.7;
    m.rotation.y = rr(0, Math.PI);
  });

  return root;
}