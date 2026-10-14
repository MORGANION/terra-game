export default function build(THREE) {
  const root = new THREE.Group();

  // ---------- детерминированный генератор ----------
  let seed = 918273;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();

  // ---------- материалы ----------
  const mats = {
    rock: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.95, metalness: 0.0 }),
    rockWarm: new THREE.MeshStandardMaterial({ color: '#d9cbb4', flatShading: true, roughness: 0.95, metalness: 0.0 }),
    pebble: new THREE.MeshStandardMaterial({ color: '#c98a5a', flatShading: true, roughness: 0.9, metalness: 0.0 }),
    crystal: new THREE.MeshStandardMaterial({ color: '#8f8aa8', flatShading: true, roughness: 0.35, metalness: 0.6 }),
    crystalTip: new THREE.MeshStandardMaterial({ color: '#a7a2be', flatShading: true, roughness: 0.3, metalness: 0.6 }),
  };

  // ---------- камни с плоским основанием на y=0 ----------
  function makeRock(x, z, r, sy, mat, detailIco) {
    let geo = detailIco
      ? new THREE.IcosahedronGeometry(r, 0)
      : new THREE.DodecahedronGeometry(r, 0);
    geo = geo.toNonIndexed();
    geo.rotateY(rr(0, Math.PI * 2));
    geo.rotateX(rr(-0.3, 0.3));
    geo.rotateZ(rr(-0.3, 0.3));
    geo.scale(rr(0.9, 1.15), sy, rr(0.9, 1.15));
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const cut = bb.min.y + (bb.max.y - bb.min.y) * 0.25; // срезаем низ — плоская опора
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < cut) pos.setY(i, cut);
    }
    geo.translate(0, -cut, 0);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0, z);
    root.add(m);
    return m;
  }

  // основная груда
  makeRock(0.0, 0.0, 0.38, 0.62, mats.rock);
  makeRock(-0.30, 0.20, 0.24, 0.65, mats.rockWarm);
  makeRock(0.32, 0.18, 0.22, 0.70, mats.rock);
  makeRock(0.20, -0.30, 0.25, 0.60, mats.rockWarm);
  makeRock(-0.25, -0.28, 0.22, 0.65, mats.rock);
  makeRock(0.05, 0.38, 0.17, 0.65, mats.rock);
  makeRock(-0.42, -0.02, 0.14, 0.75, mats.rockWarm);

  // мелкие камешки по краям
  makeRock(0.44, -0.08, 0.07, 0.8, mats.pebble, true);
  makeRock(-0.12, 0.47, 0.065, 0.8, mats.rockWarm, true);
  makeRock(-0.45, 0.32, 0.06, 0.8, mats.pebble, true);
  makeRock(0.04, -0.48, 0.07, 0.8, mats.rock, true);

  // ---------- кристаллы: шестигранные столбчатые призмы ----------
  const crystalGeoCache = {};
  const up = new THREE.Vector3(0, 1, 0);

  function makeCrystal(yaw, lean, dist, by, h, r) {
    const g = new THREE.Group();
    const key = h.toFixed(3) + '_' + r.toFixed(3);
    if (!crystalGeoCache[key]) {
      const tipH = r * 2.2;
      const body = new THREE.CylinderGeometry(r, r * 1.05, h, 6);
      body.translate(0, h / 2, 0);
      const tip = new THREE.ConeGeometry(r, tipH, 6);
      tip.translate(0, h + tipH / 2, 0);
      crystalGeoCache[key] = { body, tip };
    }
    const { body, tip } = crystalGeoCache[key];
    g.add(new THREE.Mesh(body, mats.crystal));
    g.add(new THREE.Mesh(tip, mats.crystalTip));

    const dir = new THREE.Vector3(
      Math.sin(lean) * Math.cos(yaw),
      Math.cos(lean),
      Math.sin(lean) * Math.sin(yaw)
    ).normalize();
    g.quaternion.setFromUnitVectors(up, dir);
    g.rotateY(rr(0, Math.PI / 3)); // поворот граней вокруг собственной оси
    g.position.set(Math.cos(yaw) * dist, by, Math.sin(yaw) * dist);
    root.add(g);
  }

  // [yaw, lean, dist, baseY, height, radius]
  const crystals = [
    [0.0, 0.04, 0.00, 0.12, 0.72, 0.090], // главный, верх ≈ 1.04 м
    [0.3, 0.38, 0.12, 0.14, 0.50, 0.070],
    [2.0, 0.42, 0.12, 0.14, 0.46, 0.065],
    [3.6, 0.35, 0.12, 0.12, 0.52, 0.070],
    [4.9, 0.45, 0.13, 0.12, 0.40, 0.060],
    [1.2, 0.55, 0.30, 0.10, 0.28, 0.050],
    [5.6, 0.60, 0.32, 0.10, 0.26, 0.050],
    [2.6, 0.60, 0.33, 0.10, 0.25, 0.045],
    [3.9, 0.50, 0.30, 0.08, 0.22, 0.045],
  ];
  for (const c of crystals) makeCrystal(...c);

  return root;
}