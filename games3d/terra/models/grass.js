export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'grass';

  // Материалы (переиспользуются)
  const mats = {
    plant: new THREE.MeshStandardMaterial({
      color: '#5fbf5a', flatShading: true, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide
    }),
    plant_dark: new THREE.MeshStandardMaterial({
      color: '#2f7f45', flatShading: true, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide
    })
  };

  // Детерминированный генератор случайных чисел (mulberry32)
  function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = makeRng(20261009);
  const rand = (a, b) => a + (b - a) * rng();

  // Геометрия узкого треугольного листа с V-образным сечением и изгибом наружу (+Z)
  function makeBlade(h, halfW, bend, twist) {
    const levels = [0, 0.4, 0.75];
    const rows = levels.map((t) => {
      const y = t * h;
      const z = bend * Math.pow(t, 1.6);
      const w = halfW * (1 - t * 0.85);
      const ridge = Math.max(w * 0.45, 0.012);
      const c = Math.cos(twist * t), s = Math.sin(twist * t);
      const rot = (x, zz) => [x * c + zz * s, -x * s + zz * c];
      const L = rot(-w, 0), M = rot(0, ridge), R = rot(w, 0);
      return [
        [L[0], y, z + L[1]],
        [M[0], y, z + M[1]],
        [R[0], y, z + R[1]]
      ];
    });
    const tip = [0, h, bend];

    const pos = [];
    const tri = (a, b, c) => { pos.push(...a, ...b, ...c); };
    for (let i = 0; i < rows.length - 1; i++) {
      const [L0, M0, R0] = rows[i];
      const [L1, M1, R1] = rows[i + 1];
      tri(L0, M0, M1); tri(L0, M1, L1);
      tri(M0, R0, R1); tri(M0, R1, M1);
    }
    const [Lt, Mt, Rt] = rows[rows.length - 1];
    tri(Lt, Mt, tip);
    tri(Mt, Rt, tip);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  // Небольшое основание пучка, лежит на земле
  const baseGeo = new THREE.DodecahedronGeometry(0.07, 0);
  const base = new THREE.Mesh(baseGeo, mats.plant_dark);
  base.scale.set(1, 0.4, 1);
  base.position.y = 0.028 * 0.4 + 0.0; // нижняя точка ≈ y=0
  base.position.y = 0.07 * 0.4 * 0.8;
  base.rotation.y = rand(0, Math.PI);
  root.add(base);

  // Листья: 6–8 штук
  const count = 6 + Math.floor(rng() * 3);
  const angleStep = (Math.PI * 2) / count;
  const angle0 = rand(0, Math.PI * 2);

  for (let i = 0; i < count; i++) {
    const h = rand(0.3, 0.48);
    const halfW = rand(0.035, 0.05);
    const bend = rand(0.06, 0.17);
    const twist = rand(-0.5, 0.5);
    const geo = makeBlade(h, halfW, bend, twist);

    const mat = (i % 2 === 0) ? mats.plant : mats.plant_dark;
    const blade = new THREE.Mesh(geo, mat);

    const a = angle0 + i * angleStep + rand(-0.25, 0.25);
    const r = rand(0.01, 0.035);
    blade.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    blade.rotation.y = a;
    root.add(blade);
  }

  return root;
}