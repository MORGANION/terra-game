export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'boulder';

  const mats = {
    sand: new THREE.MeshStandardMaterial({ color: '#c98a5a', flatShading: true, roughness: 0.95, metalness: 0.0 }),
    rust: new THREE.MeshStandardMaterial({ color: '#b4532a', flatShading: true, roughness: 0.95, metalness: 0.0 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.9, metalness: 0.05 }),
  };
  const matList = [mats.sand, mats.rust, mats.dark];

  // Детерминированный генератор (mulberry32)
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Угловатый камень: деформированный икосаэдр, вписанный в size, низ на minY,
  // грани распределены по материалам (песок / ржавые / тёмные)
  function makeRock(seed, detail, size, minY, darkChance, rustChance) {
    const rand = rng(seed);
    let g = new THREE.IcosahedronGeometry(1, detail);
    if (g.index) g = g.toNonIndexed();
    const p = g.attributes.position.array;

    // Смещение вершин: одинаковое для совпадающих вершин (без щелей)
    const disp = new Map();
    for (let i = 0; i < p.length; i += 3) {
      const key = `${p[i].toFixed(3)}|${p[i + 1].toFixed(3)}|${p[i + 2].toFixed(3)}`;
      if (!disp.has(key)) disp.set(key, 0.8 + rand() * 0.35);
      const r = disp.get(key);
      p[i] *= r; p[i + 1] *= r; p[i + 2] *= r;
      // приплюснутое основание
      if (p[i + 1] < -0.5) p[i + 1] = -0.5 + (p[i + 1] + 0.5) * 0.2;
    }

    // Нормализация в заданный габарит
    g.computeBoundingBox();
    const bb = g.boundingBox;
    const sx = size[0] / (bb.max.x - bb.min.x);
    const sy = size[1] / (bb.max.y - bb.min.y);
    const sz = size[2] / (bb.max.z - bb.min.z);
    const cx = (bb.max.x + bb.min.x) / 2;
    const cz = (bb.max.z + bb.min.z) / 2;
    for (let i = 0; i < p.length; i += 3) {
      p[i] = (p[i] - cx) * sx;
      p[i + 1] = (p[i + 1] - bb.min.y) * sy + minY;
      p[i + 2] = (p[i + 2] - cz) * sz;
    }

    // Раскладка треугольников по материалам
    const buckets = [[], [], []];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    for (let i = 0; i < p.length; i += 9) {
      a.set(p[i], p[i + 1], p[i + 2]);
      b.set(p[i + 3], p[i + 4], p[i + 5]);
      c.set(p[i + 6], p[i + 7], p[i + 8]);
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize();
      const r = rand();
      let m = 0;
      if (n.y < -0.15) m = 1;                       // нижние грани в тени
      else if (r < darkChance) m = 2;               // тёмные сколы
      else if (r < darkChance + rustChance || (n.y < 0.25 && r < 0.45)) m = 1; // ржавые бока
      const tri = buckets[m];
      for (let k = 0; k < 9; k++) tri.push(p[i + k]);
    }

    const out = new THREE.BufferGeometry();
    const all = [];
    let start = 0;
    buckets.forEach((arr, mi) => {
      const count = arr.length / 3;
      if (count > 0) out.addGroup(start, count, mi);
      start += count;
      for (let k = 0; k < arr.length; k++) all.push(arr[k]);
    });
    out.setAttribute('position', new THREE.Float32BufferAttribute(all, 3));
    out.computeVertexNormals();
    out.computeBoundingBox();
    out.computeBoundingSphere();
    g.dispose();
    return out;
  }

  function addRock(seed, detail, size, minY, x, z, dark, rust) {
    const mesh = new THREE.Mesh(makeRock(seed, detail, size, minY, dark, rust), matList);
    mesh.position.set(x, 0, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }

  // Основной валун: 2.2 x (1.6 + 0.15 в земле) x 2.0
  addRock(1337, 1, [2.2, 1.75, 2.0], -0.15, 0, 0, 0.08, 0.2);

  // Мелкие обломки у основания, частично врастают в валун и в грунт
  addRock(271, 0, [0.6, 0.45, 0.55], -0.1, 0.7, 0.6, 0.1, 0.25);
  addRock(828, 0, [0.45, 0.35, 0.4], -0.1, -0.75, -0.55, 0.1, 0.3);
  addRock(4242, 0, [0.35, 0.28, 0.3], -0.08, -0.55, 0.65, 0.15, 0.25);

  return root;
}