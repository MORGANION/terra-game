export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'ice_wall';
  const body = new THREE.Group();
  root.add(body);

  // ---------- материалы ----------
  const mats = {
    ice: new THREE.MeshStandardMaterial({
      color: '#cfeeff', flatShading: true, roughness: 0.15, metalness: 0,
      transparent: true, opacity: 0.8, // запрошено 0.85, ограничено правилом 0.5–0.8
      emissive: new THREE.Color('#3a8fbf'), emissiveIntensity: 0.25
    }),
    iceBlue: new THREE.MeshStandardMaterial({
      color: '#8fd3ff', flatShading: true, roughness: 0.15, metalness: 0,
      transparent: true, opacity: 0.8,
      emissive: new THREE.Color('#3a8fbf'), emissiveIntensity: 0.25
    }),
    snow: new THREE.MeshStandardMaterial({
      color: '#f6fbff', flatShading: true, roughness: 0.9, metalness: 0
    })
  };

  // ---------- общие геометрии ----------
  const geo = {
    box: new THREE.BoxGeometry(1, 1, 1),
    ico: new THREE.IcosahedronGeometry(1, 0),
    dode: new THREE.DodecahedronGeometry(1, 0)
  };

  // ---------- детерминированный seed ----------
  let seed = 0x1ce3a11;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const j = (a) => (rnd() * 2 - 1) * a;

  const add = (g, m, p, s, r) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(p[0], p[1], p[2]);
    mesh.scale.set(s[0], s[1], s[2]);
    mesh.rotation.set(r[0], r[1], r[2]);
    body.add(mesh);
    return mesh;
  };

  // верхняя точка блока (центр верхней грани с учётом поворота)
  const topOf = (mesh, hy) => {
    const v = new THREE.Vector3(0, hy, 0).applyEuler(mesh.rotation);
    return v.add(mesh.position);
  };

  const snowCap = (mesh, w, h, d) => {
    const t = topOf(mesh, h / 2);
    add(geo.dode, mats.snow,
      [t.x, t.y - 0.02, t.z],
      [w * 0.58, 0.14 + rnd() * 0.04, d * 0.58],
      [mesh.rotation.x, mesh.rotation.y + j(0.3), mesh.rotation.z]);
  };

  // ---------- нижний ряд: крупные блоки ----------
  for (let i = 0; i < 5; i++) {
    const w = 0.82 + j(0.06);
    const h = 1.0 + rnd() * 0.45;
    const d = 1.0 + j(0.08);
    const m = add(geo.box, i % 2 ? mats.iceBlue : mats.ice,
      [-1.6 + i * 0.8 + j(0.06), h / 2, j(0.08)],
      [w, h, d],
      [j(0.06), j(0.2), j(0.07)]);
    snowCap(m, w, h, d);
  }

  // ---------- средний ряд: кристаллы-икосаэдры в стыках ----------
  for (let i = 0; i < 4; i++) {
    add(geo.ico, i % 2 ? mats.ice : mats.iceBlue,
      [-1.2 + i * 0.8 + j(0.05), 1.15 + j(0.08), j(0.1)],
      [0.5 + j(0.05), 0.65 + j(0.08), 0.45 + j(0.04)],
      [j(0.4), rnd() * Math.PI, j(0.3)]);
  }

  // ---------- верхний ряд: наклонные торосы ----------
  const shardX = [-1.35, -0.45, 0.45, 1.3];
  for (let i = 0; i < 4; i++) {
    const w = 0.6 + j(0.06);
    const h = 1.15 + rnd() * 0.4;
    const d = 0.75 + j(0.06);
    const tilt = (i < 2 ? 1 : -1) * (0.08 + rnd() * 0.12);
    const m = add(geo.box, i % 2 ? mats.ice : mats.iceBlue,
      [shardX[i] + j(0.05), 1.0 + h / 2, j(0.06)],
      [w, h, d],
      [j(0.08), j(0.35), tilt]);
    snowCap(m, w, h, d);
  }

  // ---------- центральный пик ----------
  const peak = add(geo.ico, mats.iceBlue,
    [0.02, 2.2, 0.0],
    [0.38, 0.75, 0.34],
    [0.1, 0.4, -0.08]);
  {
    const t = topOf(peak, 0.62);
    add(geo.dode, mats.snow, [t.x, t.y, t.z], [0.2, 0.1, 0.18], [0, 0.5, 0]);
  }

  // ---------- кристаллы, выступающие у подножия ----------
  const footX = [-1.9, -0.4, 0.75, 1.9];
  for (let i = 0; i < 4; i++) {
    const r = 0.28 + rnd() * 0.08;
    add(geo.ico, i % 2 ? mats.iceBlue : mats.ice,
      [footX[i] + j(0.05), r * 0.85, (i % 2 ? 0.45 : -0.45) + j(0.05)],
      [r, r * 1.1, r * 0.9],
      [j(0.5), rnd() * Math.PI, j(0.5)]);
  }

  // ---------- снежные надувы у основания (лежат на земле) ----------
  const driftX = [-1.2, 0.0, 1.2, -0.6];
  for (let i = 0; i < 4; i++) {
    const sy = 0.12 + rnd() * 0.04;
    add(geo.dode, mats.snow,
      [driftX[i] + j(0.1), sy, i < 3 ? 0.5 : -0.5],
      [0.45 + j(0.05), sy, 0.28 + j(0.04)],
      [0, rnd() * Math.PI, 0]);
  }

  // ---------- вписывание в габарит [4, 3, 1.5] ----------
  body.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(body);
  const sz = new THREE.Vector3(); box.getSize(sz);
  const s = Math.min(4 / sz.x, 3 / sz.y, 1.5 / sz.z, 1);
  body.scale.setScalar(s);
  body.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(body);
  const c = new THREE.Vector3(); box.getCenter(c);
  body.position.set(-c.x, -box.min.y, -c.z);

  return root;
}