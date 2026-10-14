export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'res_iron';

  // --- материалы (только палитра) ---
  const mats = {
    rockDark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.95, metalness: 0.05 }),
    rockMetal: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.9, metalness: 0.1 }),
    rust: new THREE.MeshStandardMaterial({ color: '#b4532a', flatShading: true, roughness: 0.55, metalness: 0.6 }),
    rustDeep: new THREE.MeshStandardMaterial({ color: '#c98a5a', flatShading: true, roughness: 0.6, metalness: 0.5 }),
  };

  // --- детерминированный генератор ---
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(7331);
  const rr = (a, b) => a + (b - a) * rand();

  // --- общие геометрии ---
  const geoDodeca = new THREE.DodecahedronGeometry(1, 0);
  const geoIcosa = new THREE.IcosahedronGeometry(1, 0);
  const geoCube = new THREE.BoxGeometry(1, 1, 1);

  const content = new THREE.Group();
  root.add(content);

  // --- камни кластера ---
  const rocks = [
    { x: 0.0,   z: 0.0,   r: 0.42, s: [1.1, 1.25, 1.0], veins: 5 },
    { x: 0.36,  z: 0.18,  r: 0.30, s: [1.0, 0.9, 1.1],  veins: 3 },
    { x: -0.34, z: 0.20,  r: 0.28, s: [1.15, 0.85, 1.0], veins: 3 },
    { x: -0.20, z: -0.32, r: 0.30, s: [1.0, 1.0, 0.9],  veins: 3 },
    { x: 0.25,  z: -0.30, r: 0.26, s: [0.95, 0.9, 1.1], veins: 3 },
    { x: 0.05,  z: 0.42,  r: 0.20, s: [1.1, 0.8, 1.0],  veins: 2 },
    { x: -0.46, z: -0.05, r: 0.18, s: [1.0, 0.85, 1.1], veins: 2 },
    { x: 0.48,  z: -0.04, r: 0.17, s: [1.1, 0.9, 0.95], veins: 2 },
  ];

  rocks.forEach((R, i) => {
    const g = new THREE.Group();

    // камень
    const geo = i % 2 === 0 ? geoDodeca : geoIcosa;
    const mat = i % 3 === 1 ? mats.rockMetal : mats.rockDark;
    const sx = R.s[0] * rr(0.92, 1.08);
    const sy = R.s[1] * rr(0.92, 1.08);
    const sz = R.s[2] * rr(0.92, 1.08);
    const rock = new THREE.Mesh(geo, mat);
    rock.scale.set(R.r * sx, R.r * sy, R.r * sz);
    rock.rotation.set(rr(0, Math.PI), rr(0, Math.PI), rr(0, Math.PI));
    g.add(rock);

    // ржавые вкрапления-кубики, утопленные в грани
    for (let k = 0; k < R.veins; k++) {
      const theta = rr(0, Math.PI * 2);
      const y = rr(0.15, 0.85);
      const h = Math.sqrt(1 - y * y);
      const dir = new THREE.Vector3(Math.cos(theta) * h, y, Math.sin(theta) * h);
      const depth = 0.78; // внутри поверхности → кубик утоплен
      const cube = new THREE.Mesh(geoCube, rand() < 0.75 ? mats.rust : mats.rustDeep);
      const c = R.r * rr(0.28, 0.42);
      const size = Math.max(0.06, Math.min(0.15, c));
      cube.scale.set(size * rr(0.9, 1.2), size * rr(0.8, 1.1), size * rr(0.9, 1.2));
      cube.position.set(dir.x * R.r * sx * depth, dir.y * R.r * sy * depth, dir.z * R.r * sz * depth);
      cube.rotation.set(rr(0, Math.PI), rr(0, Math.PI), rr(0, Math.PI));
      g.add(cube);
    }

    // поворот и посадка камня точно на землю
    g.rotation.set(rr(-0.15, 0.15), rr(0, Math.PI * 2), rr(-0.15, 0.15));
    g.position.set(R.x, 0, R.z);
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g);
    g.position.y -= b.min.y;

    content.add(g);
  });

  // --- вписать в габарит [1.3, 1, 1.3] и поставить основание на y=0 ---
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(content);
  const size = new THREE.Vector3();
  box.getSize(size);
  const k = Math.min(1.3 / size.x, 1.0 / size.y, 1.3 / size.z, 1);
  content.scale.setScalar(k);

  root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(content);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  content.position.set(-cx, -box.min.y, -cz);
  root.updateMatrixWorld(true);

  return root;
}