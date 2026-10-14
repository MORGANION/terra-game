export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'res_crystal';

  // Deterministic seed (mulberry32)
  let seed = 917331;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();

  const mats = {
    scorch: new THREE.MeshStandardMaterial({ color: '#1c1714', flatShading: true, roughness: 0.95, metalness: 0.05 }),
    crystal: new THREE.MeshStandardMaterial({
      color: '#b86bff', emissive: '#b86bff', emissiveIntensity: 0.6,
      flatShading: true, roughness: 0.3, metalness: 0.1
    })
  };

  // ---------- Main charred rock (icosahedron, detail 1 = 80 tris) ----------
  const rockGeo = new THREE.IcosahedronGeometry(0.4, 1);
  {
    const pos = rockGeo.attributes.position;
    const cache = new Map();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const key = x.toFixed(3) + ',' + y.toFixed(3) + ',' + z.toFixed(3);
      if (!cache.has(key)) cache.set(key, rr(0.88, 1.1));
      const k = cache.get(key);
      pos.setXYZ(i, x * k, y * k, z * k);
    }
    rockGeo.scale(1.12, 0.8, 1.05);
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < -0.22) pos.setY(i, -0.22); // flat bottom
    }
    rockGeo.translate(0, 0.22, 0);
    pos.needsUpdate = true;
    rockGeo.computeVertexNormals();
  }
  const rock = new THREE.Mesh(rockGeo, mats.scorch);
  root.add(rock);

  // ---------- Small scorched stones ----------
  const stones = [
    { p: [0.36, 0.06, -0.27], r: 0.11, s: [1.1, 0.6, 0.95] },
    { p: [-0.35, 0.05, 0.29], r: 0.09, s: [1.0, 0.6, 1.15] }
  ];
  for (const st of stones) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(st.r, 0), mats.scorch);
    m.position.set(st.p[0], st.p[1], st.p[2]);
    m.scale.set(st.s[0], st.s[1], st.s[2]);
    m.rotation.set(rr(-0.3, 0.3), rr(0, Math.PI * 2), rr(-0.3, 0.3));
    root.add(m);
  }

  // ---------- Crystals (hex lathe: prism + pointed tip, 36 tris each) ----------
  const up = new THREE.Vector3(0, 1, 0);
  const makeCrystal = (px, py, pz, dx, dy, dz, r, h, tip) => {
    const pts = [
      new THREE.Vector2(0.0001, -0.05),
      new THREE.Vector2(r, 0),
      new THREE.Vector2(r * 0.85, h),
      new THREE.Vector2(0.0001, h + tip)
    ];
    const geo = new THREE.LatheGeometry(pts, 6, rr(0, Math.PI), Math.PI * 2);
    const m = new THREE.Mesh(geo, mats.crystal);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    m.quaternion.setFromUnitVectors(up, dir);
    m.position.set(px, py, pz);
    root.add(m);
  };

  // [x, y, z, dirX, dirY, dirZ, radius, height, tip]
  const crystals = [
    [0.02, 0.35, 0.0, 0.05, 1.0, 0.08, 0.11, 0.62, 0.2],   // main spire
    [0.15, 0.35, 0.1, 0.5, 0.9, 0.2, 0.08, 0.4, 0.14],
    [-0.15, 0.33, 0.05, -0.55, 0.85, 0.25, 0.075, 0.36, 0.13],
    [0.05, 0.3, -0.15, 0.1, 0.8, -0.6, 0.07, 0.32, 0.12],
    [-0.08, 0.3, 0.16, -0.2, 0.75, 0.65, 0.065, 0.22, 0.1],
    [0.25, 0.22, -0.05, 0.85, 0.5, -0.1, 0.05, 0.16, 0.08],
    [-0.25, 0.2, -0.12, -0.8, 0.5, -0.3, 0.05, 0.15, 0.08],
    [0.12, 0.25, 0.2, 0.3, 0.6, 0.75, 0.045, 0.15, 0.07],
    [0.28, 0.04, 0.3, 0.3, 1.0, 0.2, 0.04, 0.12, 0.06],    // ground sprout
    [-0.3, 0.04, 0.2, -0.2, 1.0, 0.3, 0.045, 0.13, 0.06]   // ground sprout
  ];
  for (const c of crystals) makeCrystal(...c);

  // ---------- Loose crystal shard lying on the ground ----------
  const shard = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mats.crystal);
  shard.scale.set(1.6, 0.6, 0.9);
  shard.rotation.set(0, rr(0, Math.PI), 0.15);
  shard.position.set(-0.05, 0.035, 0.4);
  root.add(shard);

  return root;
}