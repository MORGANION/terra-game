export default function build(THREE) {
  const root = new THREE.Group();

  // ---------- Материалы ----------
  const mats = {
    rockDark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.95, metalness: 0.0 }),
    rockSand: new THREE.MeshStandardMaterial({ color: '#c98a5a', flatShading: true, roughness: 0.9, metalness: 0.0 }),
    ice: new THREE.MeshStandardMaterial({ color: '#cfeeff', flatShading: true, roughness: 0.2, metalness: 0.05, transparent: true, opacity: 0.85 }),
    iceShard: new THREE.MeshStandardMaterial({ color: '#cfeeff', flatShading: true, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.75 }),
    crack: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.4, metalness: 0.0, transparent: true, opacity: 0.8 }),
    cave: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 1.0, metalness: 0.0 }),
    figure: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.5, metalness: 0.1, emissive: '#b86bff', emissiveIntensity: 0.25 }),
    core: new THREE.MeshStandardMaterial({ color: '#b86bff', flatShading: true, roughness: 0.3, metalness: 0.1, emissive: '#b86bff', emissiveIntensity: 0.45 }),
  };

  // ---------- Детерминированный seed ----------
  let seed = 7331;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // хеш по позиции — общие вершины смещаются одинаково (без дыр)
  const hash = (x, y, z, s) => {
    const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + s * 3.17) * 43758.5453;
    return v - Math.floor(v);
  };
  const jitter = (geo, amount, s, clampY0 = false, minY = 0) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const rx = Math.round(x * 100) / 100, ry = Math.round(y * 100) / 100, rz = Math.round(z * 100) / 100;
      let nx = x + (hash(rx, ry, rz, s) - 0.5) * amount;
      let ny = y + (hash(ry, rz, rx, s + 1) - 0.5) * amount;
      let nz = z + (hash(rz, rx, ry, s + 2) - 0.5) * amount;
      if (clampY0 && ny < minY) ny = minY;
      p.setXYZ(i, nx, ny, nz);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  };

  // ---------- Варианты угловатых скал ----------
  const rockGeos = [0, 1, 2].map(i => jitter(new THREE.DodecahedronGeometry(1, 0), 0.35, 11 + i * 5));
  const rock = (x, y, z, sx, sy, sz, mat) => {
    const m = new THREE.Mesh(rockGeos[Math.floor(rnd() * 3)], mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set((rnd() - 0.5) * 0.3, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.25);
    root.add(m);
    return m;
  };

  // ---------- Каменная арка ----------
  // левая колонна
  rock(-4.9, 1.5, 0.0, 2.1, 1.9, 2.5, mats.rockDark);
  rock(-4.7, 4.6, 0.1, 1.9, 1.8, 2.3, mats.rockSand);
  rock(-4.4, 7.4, -0.1, 1.8, 1.6, 2.2, mats.rockDark);
  // правая колонна
  rock(4.9, 1.6, 0.1, 2.1, 2.0, 2.4, mats.rockSand);
  rock(4.6, 4.8, -0.1, 1.9, 1.7, 2.2, mats.rockDark);
  rock(4.5, 7.5, 0.1, 1.8, 1.6, 2.2, mats.rockSand);
  // перемычка
  const lintel = new THREE.Mesh(rockGeos[1], mats.rockSand);
  lintel.position.set(0, 8.7, 0.1);
  lintel.scale.set(4.4, 1.5, 2.6);
  lintel.rotation.set(0.05, 0.1, 0.03);
  root.add(lintel);
  // венчающие скалы
  rock(-2.6, 9.8, -0.4, 2.2, 1.1, 1.8, mats.rockDark);
  rock(2.8, 9.6, -0.2, 2.0, 1.2, 1.8, mats.rockDark);
  // боковые валуны
  rock(-6.2, 0.6, 1.2, 0.8, 0.9, 0.9, mats.rockSand);
  rock(6.1, 0.5, -1.0, 0.9, 0.8, 0.9, mats.rockDark);
  // осыпь перед входом
  rock(-2.4, 0.2, 1.7, 0.7, 0.5, 0.6, mats.rockSand);
  rock(2.0, 0.25, 1.9, 0.6, 0.5, 0.6, mats.rockDark);
  rock(-3.6, 0.4, 1.9, 0.9, 0.7, 0.8, mats.rockDark);
  rock(3.5, 0.35, 2.0, 0.8, 0.6, 0.7, mats.rockSand);
  rock(0.9, 0.1, 2.2, 0.4, 0.3, 0.4, mats.rockSand);

  // ---------- Тёмная глубина пещеры за льдом ----------
  const cave = new THREE.Mesh(new THREE.BoxGeometry(6.4, 7.4, 0.6), mats.cave);
  cave.position.set(0, 3.7, -0.9);
  root.add(cave);

  // ---------- Тёмный древний силуэт внутри льда ----------
  const fz = 0.15;
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mats.figure);
  body.position.set(0, 3.6, fz);
  body.scale.set(0.8, 1.9, 0.5);
  body.rotation.set(0, 0.3, 0.05);
  root.add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mats.figure);
  head.position.set(0.05, 5.8, fz);
  head.rotation.set(0.2, 0.5, 0.1);
  root.add(head);

  const shardGeo = new THREE.ConeGeometry(0.35, 1.8, 4);
  const armL = new THREE.Mesh(shardGeo, mats.figure);
  armL.position.set(-1.0, 4.4, fz);
  armL.rotation.z = 0.75;
  root.add(armL);
  const armR = new THREE.Mesh(shardGeo, mats.figure);
  armR.position.set(1.0, 4.5, fz);
  armR.rotation.z = -0.7;
  root.add(armR);

  const leg = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.8, 4), mats.figure);
  leg.position.set(0, 1.2, fz);
  leg.rotation.set(0, 0.4, Math.PI);
  root.add(leg);

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), mats.core);
  core.position.set(0, 4.1, fz + 0.3);
  root.add(core);

  // ---------- Ледяной монолит ----------
  const iceGeo = jitter(new THREE.BoxGeometry(6.2, 7.2, 1.6, 3, 4, 1), 0.35, 42);
  // опустить на землю: подрезаем низ к y=0 после смещения
  iceGeo.translate(0, 3.6, 0);
  {
    const p = iceGeo.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, 0);
    p.needsUpdate = true;
    iceGeo.computeVertexNormals();
  }
  const ice = new THREE.Mesh(iceGeo, mats.ice);
  ice.position.set(0, 0, 0.3);
  root.add(ice);

  // ---------- Трещины во льду (зигзаг) ----------
  const cracks = [
    [-1.9, 6.0, 1.6, -0.9],
    [-1.2, 4.9, 1.4, -0.3],
    [-1.6, 3.8, 1.3, 0.8],
    [1.6, 2.6, 1.8, 1.1],
    [2.0, 5.4, 1.5, -1.2],
  ];
  cracks.forEach(([x, y, len, rz]) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.6), mats.crack);
    c.position.set(x, y, 0.75);
    c.rotation.z = rz;
    root.add(c);
  });

  // ---------- Сосульки под перемычкой ----------
  const icicleGeo = new THREE.ConeGeometry(0.25, 1.2, 5);
  [[-1.8, 0.9], [-0.5, 1.3], [0.9, 1.0], [2.2, 0.8]].forEach(([x, h]) => {
    const ic = new THREE.Mesh(icicleGeo, mats.iceShard);
    ic.scale.set(1, h, 1);
    ic.position.set(x, 7.6 - 0.6 * h, 1.3);
    ic.rotation.set(Math.PI, rnd() * Math.PI, 0);
    root.add(ic);
  });

  // ---------- Ледяные осколки у подножия ----------
  const shardGround = new THREE.ConeGeometry(0.35, 1.4, 5);
  [[-1.4, 1.8, 0.4], [1.3, 1.6, -0.5], [-0.3, 2.0, 0.2]].forEach(([x, z, tilt]) => {
    const s = new THREE.Mesh(shardGround, mats.iceShard);
    s.position.set(x, 0.45, z);
    s.rotation.set(0.3, rnd() * Math.PI, tilt);
    root.add(s);
  });

  return root;
}