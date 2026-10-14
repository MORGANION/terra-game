export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'bush_berry';

  // --- deterministic RNG ---
  let seed = 7331;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const range = (a, b) => a + (b - a) * rnd();

  // --- materials ---
  const mats = {
    plant: new THREE.MeshStandardMaterial({ color: '#5fbf5a', flatShading: true, roughness: 0.85, metalness: 0 }),
    plantDark: new THREE.MeshStandardMaterial({ color: '#2f7f45', flatShading: true, roughness: 0.9, metalness: 0 }),
    berry: new THREE.MeshStandardMaterial({
      color: '#ff7fb0', flatShading: true, roughness: 0.35, metalness: 0.05,
      emissive: '#ff7fb0', emissiveIntensity: 0.18
    }),
    stem: new THREE.MeshStandardMaterial({ color: '#2f7f45', flatShading: true, roughness: 0.9, metalness: 0 })
  };

  // --- trunk (connects crowns to ground) ---
  const trunkGeo = new THREE.CylinderGeometry(0.045, 0.07, 0.24, 6);
  const trunk = new THREE.Mesh(trunkGeo, mats.stem);
  trunk.position.set(0, 0.12, 0);
  root.add(trunk);

  // --- crowns ---
  const crownDefs = [
    { c: [0.0, 0.50, 0.0], r: 0.40, s: [1.05, 0.92, 1.0], m: mats.plant },
    { c: [0.22, 0.34, 0.16], r: 0.30, s: [1.0, 0.95, 1.05], m: mats.plantDark },
    { c: [-0.22, 0.33, 0.14], r: 0.29, s: [1.05, 0.9, 1.0], m: mats.plant },
    { c: [0.04, 0.36, -0.22], r: 0.30, s: [1.1, 0.95, 1.0], m: mats.plantDark }
  ];

  const crownGeo = new THREE.IcosahedronGeometry(1, 1); // 80 tris
  const crowns = crownDefs.map((d) => {
    const mesh = new THREE.Mesh(crownGeo, d.m);
    mesh.position.set(d.c[0], d.c[1], d.c[2]);
    const sx = d.r * d.s[0], sy = d.r * d.s[1], sz = d.r * d.s[2];
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(range(-0.3, 0.3), range(0, Math.PI * 2), range(-0.3, 0.3));
    root.add(mesh);
    return { c: new THREE.Vector3(d.c[0], d.c[1], d.c[2]), e: new THREE.Vector3(sx, sy, sz) };
  });

  // --- berries ---
  const berryGeo = new THREE.IcosahedronGeometry(1, 0); // 20 tris
  const BERRY_COUNT = 18;
  const half = 0.6;
  const maxY = 1.0;
  const placed = [];
  const tmp = new THREE.Vector3();

  const insideOther = (p, skip) => {
    for (let i = 0; i < crowns.length; i++) {
      if (i === skip) continue;
      const cr = crowns[i];
      const dx = (p.x - cr.c.x) / cr.e.x;
      const dy = (p.y - cr.c.y) / cr.e.y;
      const dz = (p.z - cr.c.z) / cr.e.z;
      if (dx * dx + dy * dy + dz * dz < 0.8) return true;
    }
    return false;
  };

  let attempts = 0;
  while (placed.length < BERRY_COUNT && attempts < 600) {
    attempts++;
    const ci = Math.floor(rnd() * crowns.length);
    const cr = crowns[ci];
    // random direction, biased upward/outward
    const theta = range(0, Math.PI * 2);
    const y = range(-0.25, 0.95);
    const rr = Math.sqrt(1 - y * y);
    const dir = new THREE.Vector3(Math.cos(theta) * rr, y, Math.sin(theta) * rr);

    // outward from bush center for side crowns
    const outward = tmp.set(cr.c.x, 0, cr.c.z);
    if (outward.lengthSq() > 0.001) {
      outward.normalize();
      if (dir.x * outward.x + dir.z * outward.z < -0.15) continue;
    }

    const br = range(0.04, 0.06); // diameter 0.08–0.12
    const p = new THREE.Vector3(
      cr.c.x + dir.x * cr.e.x * 0.98,
      cr.c.y + dir.y * cr.e.y * 0.98,
      cr.c.z + dir.z * cr.e.z * 0.98
    );

    if (Math.abs(p.x) > half - br || Math.abs(p.z) > half - br) continue;
    if (p.y > maxY - br || p.y < 0.12) continue;
    if (insideOther(p, ci)) continue;

    let tooClose = false;
    for (const q of placed) {
      if (q.p.distanceTo(p) < (q.r + br) * 1.6) { tooClose = true; break; }
    }
    if (tooClose) continue;

    placed.push({ p, r: br });
  }

  for (const b of placed) {
    const m = new THREE.Mesh(berryGeo, mats.berry);
    m.position.copy(b.p);
    m.scale.setScalar(b.r);
    m.rotation.set(range(0, Math.PI), range(0, Math.PI), 0);
    root.add(m);
  }

  return root;
}