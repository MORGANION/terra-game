export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'lichen';

  // Детерминированный генератор случайных чисел (seed)
  let seed = 7319;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const range = (a, b) => a + (b - a) * rnd();

  const mats = {
    stone: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.95, metalness: 0.05 }),
    plant: new THREE.MeshStandardMaterial({ color: '#5fbf5a', flatShading: true, roughness: 0.9, metalness: 0 }),
    plantDark: new THREE.MeshStandardMaterial({ color: '#2f7f45', flatShading: true, roughness: 0.9, metalness: 0 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#c98a5a', flatShading: true, roughness: 0.9, metalness: 0 }),
  };

  // --- Камешек: приплюснутый додекаэдр (36 треугольников) ---
  const R = 0.3;
  const sx = 0.95, sy = 0.22, sz = 0.9;
  const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(R, 0), mats.stone);
  stone.scale.set(sx, sy, sz);
  stone.rotation.y = 0.4;
  stone.position.y = R * sy; // основание на y=0
  root.add(stone);

  // Полуоси «эллипсоида» камня и консервативная высота поверхности
  const ax = R * sx, ay = R * sy, az = R * sz;
  const surfaceY = (x, z) => {
    const u = (x / ax) ** 2 + (z / az) ** 2;
    return ay + 0.8 * ay * Math.sqrt(Math.max(0, 1 - u)); // 0.8 ≈ вписанная сфера граней
  };

  // --- Бляшки лишайника: плоские 6-гранные конусы (по 12 треугольников) ---
  const patches = [
    { x: 0.02, z: 0.03, r: 0.11, m: mats.plant },
    { x: -0.12, z: -0.08, r: 0.08, m: mats.yellow },
    { x: 0.13, z: -0.06, r: 0.07, m: mats.plantDark },
    { x: -0.09, z: 0.12, r: 0.065, m: mats.plantDark },
    { x: 0.11, z: 0.12, r: 0.06, m: mats.yellow },
  ];

  const patchGeo = new THREE.ConeGeometry(1, 1, 6, 1);
  for (const p of patches) {
    const mesh = new THREE.Mesh(patchGeo, p.m);
    const h = range(0.022, 0.032);
    mesh.scale.set(p.r * range(0.85, 1.15), h, p.r * range(0.8, 1.1));
    // основание бляшки немного утоплено в камень
    mesh.position.set(p.x, surfaceY(p.x, p.z) - 0.008 + h / 2, p.z);
    // лёгкий наклон по склону камня + случайный поворот
    mesh.rotation.set(p.z * 0.9, range(0, Math.PI), -p.x * 0.9);
    root.add(mesh);
  }

  return root;
}