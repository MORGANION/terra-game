export default function build(THREE) {
  const root = new THREE.Group();

  // ---------- Материалы ----------
  const std = (color, roughness = 0.7, metalness = 0.1, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness, metalness, ...extra });

  const mats = {
    hull: std('#e8e4dc', 0.6, 0.05, { side: THREE.DoubleSide }),
    accent: std('#f08a3c', 0.55, 0.1),
    metal: std('#5b616b', 0.5, 0.5),
    dark: std('#2e3238', 0.7, 0.3),
    glow: std('#6fe3ff', 0.3, 0.0, { emissive: '#6fe3ff', emissiveIntensity: 1.6 }),
    glass: std('#9fd8ff', 0.15, 0.1, { transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    plant: std('#5fbf5a', 0.8, 0.0),
    plantDark: std('#2f7f45', 0.8, 0.0),
    flower: std('#ff7fb0', 0.6, 0.0),
  };

  // детерминированный ГПСЧ
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    root.add(m);
    return m;
  };

  // ---------- Параметры ----------
  const BASE_H = 0.4;     // высота кольцевого основания
  const R = 2.6;          // радиус купола
  const SPLIT = 1.0;      // угол (от вершины), где стекло переходит в белый пояс

  // ---------- Кольцевое основание ----------
  add(new THREE.CylinderGeometry(2.82, 2.9, BASE_H, 24), mats.metal, 0, BASE_H / 2, 0);
  // пол внутри
  add(new THREE.CylinderGeometry(R - 0.02, R - 0.02, 0.04, 24), mats.hull, 0, BASE_H + 0.02, 0);
  // оранжевая полоса по краю основания
  add(new THREE.TorusGeometry(2.74, 0.06, 4, 32), mats.accent, 0, BASE_H, 0, Math.PI / 2);

  // огни по кругу (пропускаем фронт со шлюзом)
  const LIGHTS = 12;
  const lightGeo = new THREE.IcosahedronGeometry(0.08, 0);
  for (let i = 1; i < LIGHTS; i++) {
    const a = (i / LIGHTS) * Math.PI * 2;
    add(lightGeo, mats.glow, Math.sin(a) * 2.88, 0.22, Math.cos(a) * 2.88);
  }

  // ---------- Купол ----------
  // стеклянная верхняя часть
  add(new THREE.SphereGeometry(R - 0.02, 12, 5, 0, Math.PI * 2, 0, SPLIT), mats.glass, 0, BASE_H, 0);
  // белый нижний пояс сегментов
  add(new THREE.SphereGeometry(R, 12, 3, 0, Math.PI * 2, SPLIT, Math.PI / 2 - SPLIT), mats.hull, 0, BASE_H, 0);

  // меридиональные рёбра (каждая дуга = 2 меридиана)
  const ribGeo = new THREE.TorusGeometry(R + 0.02, 0.06, 4, 16, Math.PI);
  for (let i = 0; i < 6; i++) {
    add(ribGeo, mats.hull, 0, BASE_H, 0, 0, (i / 6) * Math.PI);
  }
  // горизонтальные кольца
  const ringAt = (theta, mat, tube) => {
    const y = BASE_H + Math.cos(theta) * (R + 0.02);
    const r = Math.sin(theta) * (R + 0.02);
    add(new THREE.TorusGeometry(r, tube, 4, 28), mat, 0, y, 0, Math.PI / 2);
  };
  ringAt(SPLIT, mats.accent, 0.07);
  ringAt(0.5, mats.hull, 0.05);

  // верхний хаб и антенна
  add(new THREE.CylinderGeometry(0.42, 0.5, 0.2, 10), mats.metal, 0, BASE_H + R - 0.02, 0);
  add(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 6), mats.dark, 0, BASE_H + R + 0.28, 0);
  add(new THREE.IcosahedronGeometry(0.07, 0), mats.glow, 0, BASE_H + R + 0.5, 0);

  // ---------- Шлюз (+Z) ----------
  const AW = 1.3, AZ0 = 1.9, AZ1 = 2.8;
  const AD = AZ1 - AZ0, AC = (AZ0 + AZ1) / 2;
  // корпус шлюза (стоит на земле)
  add(new THREE.BoxGeometry(AW, 1.8, AD), mats.hull, 0, 0.9, AC);
  // скруглённая крыша
  add(new THREE.CylinderGeometry(AW / 2, AW / 2, AD, 12), mats.hull, 0, 1.8, AC, Math.PI / 2);
  // оранжевые полосы по бокам
  const stripeGeo = new THREE.BoxGeometry(0.04, 0.15, AD * 0.9);
  add(stripeGeo, mats.accent, AW / 2 + 0.01, 1.55, AC);
  add(stripeGeo, mats.accent, -AW / 2 - 0.01, 1.55, AC);
  // тёмная рама и оранжевая дверь
  add(new THREE.BoxGeometry(0.92, 1.55, 0.06), mats.dark, 0, BASE_H + 0.775, AZ1 + 0.02);
  add(new THREE.BoxGeometry(0.72, 1.35, 0.06), mats.accent, 0, BASE_H + 0.7, AZ1 + 0.05);
  // иллюминатор двери
  add(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 10), mats.glow, 0, BASE_H + 1.05, AZ1 + 0.09, Math.PI / 2);
  // световая полоса над дверью
  add(new THREE.BoxGeometry(0.8, 0.08, 0.05), mats.glow, 0, 2.08, AZ1 + 0.02);
  // ступенька
  add(new THREE.BoxGeometry(1.0, 0.2, 0.18), mats.metal, 0, 0.1, AZ1 + 0.09);

  // ---------- Интерьер: O₂-станция ----------
  const FY = BASE_H + 0.04;
  add(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 10), mats.metal, 0, FY + 0.15, 0);
  add(new THREE.CapsuleGeometry(0.24, 0.7, 3, 10), mats.glow, 0, FY + 0.3 + 0.59, 0);
  add(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 10), mats.metal, 0, FY + 0.3 + 1.2, 0);
  add(new THREE.TorusGeometry(0.27, 0.05, 4, 12), mats.accent, 0, FY + 0.32, 0, Math.PI / 2);
  // консоль
  add(new THREE.BoxGeometry(0.6, 0.8, 0.35), mats.dark, -1.3, FY + 0.4, -1.1, 0, 0.8);
  add(new THREE.BoxGeometry(0.45, 0.25, 0.04), mats.glow, -1.17, FY + 0.6, -0.97, -0.3, 0.8);

  // ---------- Интерьер: грядки ----------
  const planterGeo = new THREE.BoxGeometry(1.0, 0.35, 0.45);
  const leafGeo = new THREE.IcosahedronGeometry(0.16, 0);
  const flowerGeo = new THREE.DodecahedronGeometry(0.07, 0);
  const planters = [
    { x: 1.35, z: -0.9, ry: -0.6 },
    { x: 1.0, z: 0.95, ry: 0.9 },
  ];
  for (const p of planters) {
    const g = new THREE.Group();
    g.position.set(p.x, FY, p.z);
    g.rotation.y = p.ry;
    root.add(g);
    const box = new THREE.Mesh(planterGeo, mats.accent);
    box.position.y = 0.175;
    g.add(box);
    for (let i = 0; i < 3; i++) {
      const s = 0.8 + rnd() * 0.6;
      const leaf = new THREE.Mesh(leafGeo, rnd() > 0.5 ? mats.plant : mats.plantDark);
      leaf.position.set(-0.3 + i * 0.3 + (rnd() - 0.5) * 0.08, 0.35 + 0.12 * s, (rnd() - 0.5) * 0.12);
      leaf.scale.set(s, s * (1 + rnd() * 0.5), s);
      leaf.rotation.set(rnd(), rnd() * 3, rnd());
      g.add(leaf);
      if (i === 1) {
        const fl = new THREE.Mesh(flowerGeo, mats.flower);
        fl.position.set(leaf.position.x, leaf.position.y + 0.14 * s * 1.2, leaf.position.z);
        g.add(fl);
      }
    }
  }

  return root;
}