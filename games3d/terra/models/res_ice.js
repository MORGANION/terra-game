export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'res_ice';

  // --- детерминированный ГПСЧ ---
  let seed = 913577;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();

  // --- материалы ---
  const mats = {
    iceA: new THREE.MeshStandardMaterial({
      color: '#cfeeff', flatShading: true, roughness: 0.15, metalness: 0.05,
      transparent: true, opacity: 0.72, emissive: '#9fd8ff', emissiveIntensity: 0.12
    }),
    iceB: new THREE.MeshStandardMaterial({
      color: '#9fd8ff', flatShading: true, roughness: 0.1, metalness: 0.05,
      transparent: true, opacity: 0.62, emissive: '#9fd8ff', emissiveIntensity: 0.15
    }),
    core: new THREE.MeshStandardMaterial({
      color: '#6fe3ff', flatShading: true, roughness: 0.3, metalness: 0.0,
      emissive: '#6fe3ff', emissiveIntensity: 1.2
    }),
    chunk: new THREE.MeshStandardMaterial({
      color: '#cfeeff', flatShading: true, roughness: 0.25, metalness: 0.0,
      transparent: true, opacity: 0.8
    }),
    snow: new THREE.MeshStandardMaterial({
      color: '#e8e4dc', flatShading: true, roughness: 1.0, metalness: 0.0
    }),
    rock: new THREE.MeshStandardMaterial({
      color: '#5b616b', flatShading: true, roughness: 0.9, metalness: 0.1
    })
  };

  // --- кристалл: шестигранная призма + острие ---
  function crystal(x, z, r, h, tip, tilt, mat, withCore) {
    const g = new THREE.Group();
    // опора чуть приподнята, чтобы наклонённое основание не уходило ниже y=0
    g.position.set(x, r * Math.sin(tilt) + 0.005, z);
    g.rotation.order = 'YXZ';
    g.rotation.y = Math.atan2(x, z) + rr(-0.25, 0.25); // наклон наружу
    g.rotation.x = tilt;

    const inner = new THREE.Group();
    inner.rotation.y = rr(0, Math.PI);
    g.add(inner);

    const prism = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, h, 6), mat);
    prism.position.y = h / 2;
    inner.add(prism);

    const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 0.9, tip, 6), mat);
    cone.position.y = h + tip / 2;
    inner.add(cone);

    if (withCore) {
      const ch = h * 0.85;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.38, ch, 6), mats.core);
      c.position.y = ch / 2 + 0.02;
      inner.add(c);
      const ct = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, tip * 0.6, 6), mats.core);
      ct.position.y = ch + 0.02 + tip * 0.3;
      inner.add(ct);
    }
    root.add(g);
  }

  // --- кристаллы (габарит проверен: радиус ≤ 0.62, высота ≤ 1.2) ---
  crystal( 0.00,  0.00, 0.20, 0.80, 0.32, 0.06, mats.iceA, true);
  crystal( 0.22,  0.08, 0.14, 0.50, 0.20, 0.35, mats.iceB, false);
  crystal(-0.20,  0.12, 0.13, 0.42, 0.18, 0.40, mats.iceA, false);
  crystal(-0.08, -0.20, 0.15, 0.55, 0.22, 0.30, mats.iceB, true);
  crystal( 0.14, -0.16, 0.10, 0.30, 0.14, 0.50, mats.iceA, false);
  crystal( 0.05,  0.25, 0.09, 0.25, 0.12, 0.55, mats.iceB, false);
  crystal(-0.30, -0.05, 0.08, 0.20, 0.10, 0.60, mats.iceA, false);

  // --- снег у основания: полусферы, плоское дно на y=0 ---
  const hemi = (r) => new THREE.SphereGeometry(r, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);

  const base = new THREE.Mesh(hemi(0.42), mats.snow);
  base.scale.set(1, 0.22, 1);
  base.rotation.y = rr(0, Math.PI);
  root.add(base);

  const mounds = 6;
  for (let i = 0; i < mounds; i++) {
    const a = (i / mounds) * Math.PI * 2 + rr(-0.3, 0.3);
    const d = rr(0.28, 0.38);
    const r = rr(0.14, 0.2);
    const m = new THREE.Mesh(hemi(r), mats.snow);
    m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    m.scale.set(rr(0.9, 1.15), rr(0.3, 0.45), rr(0.9, 1.15));
    m.rotation.y = rr(0, Math.PI);
    root.add(m);
  }

  // --- обломки льда и пара камешков на земле ---
  const chunks = [
    [0.44, 0.22, 0.07], [-0.38, 0.32, 0.06], [-0.46, -0.24, 0.07], [0.32, -0.42, 0.05]
  ];
  for (const [x, z, r] of chunks) {
    const c = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mats.chunk);
    c.position.set(x, r * 0.7, z);
    c.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
    c.scale.set(1, rr(0.8, 1.2), 1);
    root.add(c);
  }
  const rocks = [[0.12, 0.48, 0.06], [-0.48, 0.05, 0.05]];
  for (const [x, z, r] of rocks) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mats.rock);
    s.position.set(x, r * 0.5, z);
    s.scale.set(1.2, 0.7, 1);
    s.rotation.y = rr(0, 3);
    root.add(s);
  }

  return root;
}