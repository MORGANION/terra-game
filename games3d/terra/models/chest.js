export default function build(THREE) {
  const root = new THREE.Group();

  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.6, metalness: 0.1 }),
    accent: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.5, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.4, metalness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.7, metalness: 0.3 }),
    glow: new THREE.MeshStandardMaterial({ color: '#6fe3ff', flatShading: true, roughness: 0.3, metalness: 0.0, emissive: '#6fe3ff', emissiveIntensity: 1.6 }),
  };

  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };

  // Цоколь (тёмный металл), касается земли
  box(1.1, 0.08, 0.7, mats.dark, 0, 0.04, 0);

  // Корпус ящика
  box(1.14, 0.5, 0.74, mats.hull, 0, 0.33, 0);

  // Оранжевый кант по периметру у линии крышки
  box(1.18, 0.06, 0.78, mats.accent, 0, 0.55, 0);

  // Нижняя часть крышки
  box(1.16, 0.14, 0.76, mats.hull, 0, 0.65, 0);

  // Скошенный верх крышки — шестигранная призма, лежащая вдоль X
  const topGeo = new THREE.CylinderGeometry(0.36, 0.36, 1.08, 6, 1, false, 0);
  const top = new THREE.Mesh(topGeo, mats.hull);
  top.rotation.z = Math.PI / 2;
  top.scale.set(1, 1, 0.35); // после поворота сплющивание по высоте
  top.position.set(0, 0.72, 0);
  root.add(top);
  // учёт масштаба: локальная ось Z призмы после поворота остаётся Z, сплющим по Y корректно
  top.scale.set(0.35, 1, 1); // локальный X -> мировой Y после поворота
  // Плоский верх на высоте ≈ 0.72 + 0.36*0.866*0.35 ≈ 0.829

  // Ручка на крышке
  box(0.4, 0.05, 0.1, mats.metal, 0, 0.852, 0);

  // Оранжевая полоса на передней грани крышки
  box(0.9, 0.04, 0.03, mats.accent, 0, 0.66, 0.39);

  // Передняя тёмная панель под индикатор
  box(0.42, 0.14, 0.02, mats.dark, 0, 0.34, 0.38);

  // Светящийся индикатор
  box(0.3, 0.06, 0.02, mats.glow, 0, 0.34, 0.39);

  // Замок-защёлка на стыке корпуса и крышки
  box(0.14, 0.12, 0.05, mats.accent, 0, 0.57, 0.375);

  // Боковые ручки-скобы
  box(0.03, 0.06, 0.3, mats.metal, 0.585, 0.36, 0);
  box(0.03, 0.06, 0.3, mats.metal, -0.585, 0.36, 0);

  return root;
}