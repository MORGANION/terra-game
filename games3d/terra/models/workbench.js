export default function build(THREE) {
  const root = new THREE.Group();

  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.7, metalness: 0.05 }),
    accent: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.6, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.45, metalness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.6, metalness: 0.3 }),
    glow: new THREE.MeshStandardMaterial({ color: '#6fe3ff', flatShading: true, roughness: 0.3, metalness: 0, emissive: '#6fe3ff', emissiveIntensity: 1.6 }),
    holo: new THREE.MeshStandardMaterial({ color: '#6fe3ff', flatShading: true, roughness: 0.2, metalness: 0, emissive: '#6fe3ff', emissiveIntensity: 1.0, transparent: true, opacity: 0.5, depthWrite: false }),
    glass: new THREE.MeshStandardMaterial({ color: '#9fd8ff', flatShading: true, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.6 }),
  };

  function box(w, h, d, mat, x, y, z, parent = root) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function cyl(rt, rb, h, seg, mat, x, y, z, parent = root) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function sphere(r, mat, x, y, z, parent = root) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  // балка между двумя точками
  function beam(a, b, w, d, mat, parent = root) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    parent.add(m);
    return m;
  }

  // ---------- Столешница ----------
  box(1.5, 0.06, 0.8, mats.hull, 0, 0.75, 0);
  box(1.5, 0.04, 0.03, mats.accent, 0, 0.75, 0.415);       // передняя оранжевая кромка
  box(1.3, 0.008, 0.6, mats.metal, 0.05, 0.784, 0.0);       // рабочая металлическая плита

  // ---------- Левая тумба ----------
  box(0.48, 0.04, 0.68, mats.dark, -0.5, 0.02, 0);           // цоколь
  box(0.5, 0.68, 0.72, mats.hull, -0.5, 0.38, 0);            // корпус тумбы
  box(0.44, 0.28, 0.03, mats.accent, -0.5, 0.54, 0.375);     // ящик верхний
  box(0.44, 0.28, 0.03, mats.accent, -0.5, 0.23, 0.375);     // ящик нижний
  box(0.2, 0.04, 0.04, mats.dark, -0.5, 0.62, 0.405);        // ручки
  box(0.2, 0.04, 0.04, mats.dark, -0.5, 0.31, 0.405);
  box(0.04, 0.6, 0.03, mats.metal, -0.25, 0.4, 0.375);       // боковая полоса

  // ---------- Правые ножки ----------
  [-0.32, 0.32].forEach((z) => {
    box(0.12, 0.03, 0.12, mats.dark, 0.66, 0.015, z);        // опора
    box(0.08, 0.69, 0.08, mats.metal, 0.66, 0.375, z);       // ножка
  });
  box(0.06, 0.06, 0.56, mats.metal, 0.66, 0.16, 0);          // поперечина
  box(0.92, 0.04, 0.6, mats.metal, 0.2, 0.16, 0);            // нижняя полка (тумба ↔ ножки)
  box(0.3, 0.12, 0.3, mats.dark, 0.3, 0.24, -0.05);          // ящик-блок питания на полке
  box(0.2, 0.03, 0.03, mats.glow, 0.3, 0.26, 0.11);          // индикатор блока

  // ---------- Манипулятор ----------
  const ax = 0.42, az = -0.24;
  cyl(0.13, 0.14, 0.05, 10, mats.dark, ax, 0.805, az);       // фланец
  cyl(0.09, 0.1, 0.1, 10, mats.hull, ax, 0.88, az);          // поворотная башня
  cyl(0.1, 0.1, 0.03, 10, mats.accent, ax, 0.845, az);       // оранжевое кольцо
  const S = new THREE.Vector3(ax, 0.96, az);                 // плечо
  const E = new THREE.Vector3(ax, 1.11, az + 0.24);          // локоть
  const W = new THREE.Vector3(ax, 1.0, az + 0.42);           // запястье
  sphere(0.07, mats.metal, S.x, S.y, S.z);
  beam(S, E, 0.09, 0.08, mats.hull);                         // верхнее звено
  beam(S.clone().add(new THREE.Vector3(0.05, 0, 0)), E.clone().add(new THREE.Vector3(0.05, 0, 0)), 0.03, 0.05, mats.accent);
  sphere(0.06, mats.metal, E.x, E.y, E.z);
  beam(E, W, 0.07, 0.07, mats.hull);                         // нижнее звено
  sphere(0.045, mats.dark, W.x, W.y, W.z);
  cyl(0.04, 0.05, 0.06, 8, mats.dark, W.x, W.y - 0.06, W.z); // кисть
  cyl(0.055, 0.055, 0.03, 8, mats.accent, W.x, W.y - 0.1, W.z);
  box(0.03, 0.07, 0.04, mats.metal, W.x - 0.035, W.y - 0.15, W.z); // пальцы захвата
  box(0.03, 0.07, 0.04, mats.metal, W.x + 0.035, W.y - 0.15, W.z);
  cyl(0.012, 0.03, 0.05, 6, mats.glow, W.x, W.y - 0.14, W.z);      // светящийся инструмент

  // Заготовка под манипулятором
  cyl(0.09, 0.1, 0.03, 10, mats.dark, ax, 0.803, az + 0.42);
  const part = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.02, 6, 12), mats.glow);
  part.rotation.x = Math.PI / 2;
  part.position.set(ax, 0.838, az + 0.42);
  root.add(part);

  // ---------- Голографический экран ----------
  const holo = new THREE.Group();
  holo.position.set(-0.38, 0, -0.27);
  holo.rotation.y = 0.18;
  root.add(holo);
  box(0.58, 0.05, 0.1, mats.metal, 0, 0.805, 0, holo);       // проектор-основание
  box(0.5, 0.02, 0.04, mats.glow, 0, 0.84, 0.0, holo);       // излучатель
  box(0.04, 0.38, 0.05, mats.dark, -0.27, 0.99, 0, holo);    // стойки рамки
  box(0.04, 0.38, 0.05, mats.dark, 0.27, 0.99, 0, holo);
  box(0.58, 0.03, 0.05, mats.dark, 0, 1.18 - 0.015, 0, holo); // верхняя перекладина
  box(0.06, 0.03, 0.06, mats.accent, -0.27, 1.15, 0.0, holo); // оранжевые уголки
  box(0.06, 0.03, 0.06, mats.accent, 0.27, 1.15, 0.0, holo);
  box(0.5, 0.31, 0.015, mats.holo, 0, 1.0, 0, holo);         // голо-панель
  // «интерфейс» на голограмме
  box(0.3, 0.03, 0.02, mats.glow, -0.06, 1.1, 0.012, holo);
  box(0.2, 0.03, 0.02, mats.glow, -0.11, 1.04, 0.012, holo);
  box(0.24, 0.03, 0.02, mats.glow, -0.08, 0.98, 0.012, holo);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 4, 10), mats.glow);
  ring.position.set(0.15, 1.02, 0.012);
  holo.add(ring);

  // ---------- Пульт управления ----------
  const pad = box(0.34, 0.05, 0.16, mats.dark, -0.4, 0.805, 0.24);
  pad.rotation.x = 0.15;
  box(0.26, 0.02, 0.1, mats.glass, -0.4, 0.835, 0.24).rotation.x = 0.15;
  box(0.05, 0.03, 0.04, mats.accent, -0.21, 0.81, 0.24);
  cyl(0.025, 0.025, 0.03, 8, mats.glow, -0.15, 0.81, 0.24);

  // ---------- Лоток с деталями ----------
  box(0.26, 0.04, 0.16, mats.accent, 0.0, 0.8, 0.22);
  box(0.2, 0.03, 0.1, mats.dark, 0.0, 0.81, 0.22);
  cyl(0.03, 0.03, 0.04, 6, mats.metal, -0.05, 0.83, 0.22);
  box(0.05, 0.04, 0.05, mats.hull, 0.05, 0.83, 0.22);

  return root;
}