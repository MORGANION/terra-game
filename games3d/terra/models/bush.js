export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'bush';

  // Детерминированный генератор случайных чисел
  let seed = 7319;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const mats = {
    plant: new THREE.MeshStandardMaterial({ color: '#5fbf5a', flatShading: true, roughness: 0.9, metalness: 0 }),
    plant_dark: new THREE.MeshStandardMaterial({ color: '#2f7f45', flatShading: true, roughness: 0.9, metalness: 0 }),
    flower: new THREE.MeshStandardMaterial({ color: '#ff7fb0', flatShading: true, roughness: 0.7, metalness: 0 }),
  };

  // Общая геометрия: единичный икосаэдр (detail 0 = 20 треугольников)
  const ico = new THREE.IcosahedronGeometry(1, 0);

  // Кроны: [x, y, z, радиус, материал]
  // Икосаэдр вписан в сферу радиуса r, поэтому при любом повороте
  // он не выходит за габарит. Нижние кроны касаются земли (y - r = 0).
  const crowns = [
    [0.0, 0.45, 0.0, 0.45, 'plant'],
    [-0.3, 0.3, 0.15, 0.3, 'plant_dark'],
    [0.3, 0.3, -0.1, 0.3, 'plant'],
    [0.05, 0.28, 0.3, 0.28, 'plant_dark'],
    [-0.1, 0.7, -0.15, 0.28, 'plant'],
  ];

  crowns.forEach(([x, y, z, r, m]) => {
    const mesh = new THREE.Mesh(ico, mats[m]);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(r);
    mesh.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
    root.add(mesh);
  });

  // Цветы: [индекс кроны, направление dx, dy, dz]
  const flowers = [
    [0, 0.3, 0.6, 0.75],
    [0, -0.5, 0.8, 0.3],
    [3, 0.5, 0.4, 0.6],
    [2, 0.6, 0.6, 0.2],
  ];

  const half = 0.6;
  flowers.forEach(([ci, dx, dy, dz]) => {
    const [cx, cy, cz, r] = crowns[ci];
    const d = new THREE.Vector3(dx, dy, dz).normalize();
    // Чуть утоплены в крону, чтобы не висеть в воздухе
    const fr = 0.07 + rnd() * 0.02;
    const p = new THREE.Vector3(cx, cy, cz).addScaledVector(d, r * 0.85);

    // Держим цветок внутри габарита
    p.x = Math.max(-half + fr, Math.min(half - fr, p.x));
    p.z = Math.max(-half + fr, Math.min(half - fr, p.z));
    p.y = Math.min(1.0 - fr, p.y);

    const mesh = new THREE.Mesh(ico, mats.flower);
    mesh.position.copy(p);
    mesh.scale.setScalar(fr);
    mesh.rotation.set(rnd() * Math.PI, rnd() * Math.PI, 0);
    root.add(mesh);
  });

  // Итого: 9 мешей × 20 треугольников = 180 треугольников
  return root;
}