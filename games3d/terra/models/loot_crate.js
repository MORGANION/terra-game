export default function build(THREE) {
  const root = new THREE.Group();

  const mats = {
    metal: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.55, metalness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.7, metalness: 0.4 }),
    accent: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.6, metalness: 0.1 }),
    glow: new THREE.MeshStandardMaterial({ color: '#6fe3ff', emissive: '#6fe3ff', emissiveIntensity: 1.6, flatShading: true, roughness: 0.3, metalness: 0.0 }),
  };

  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };

  // Основание-полозья (y 0..0.06)
  box(1.02, 0.06, 0.72, mats.dark, 0, 0.03, 0);
  // Корпус (y 0.06..0.56)
  box(0.96, 0.5, 0.66, mats.metal, 0, 0.31, 0);
  // Крышка (y 0.56..0.74)
  box(1.0, 0.18, 0.7, mats.metal, 0, 0.65, 0);
  // Верхняя пластина крышки (y 0.74..0.78)
  box(0.86, 0.04, 0.56, mats.dark, 0, 0.76, 0);

  // Оранжевые полосы на корпусе и крышке
  for (const sx of [-1, 1]) {
    box(0.1, 0.5, 0.68, mats.accent, sx * 0.32, 0.31, 0);
    box(0.1, 0.18, 0.72, mats.accent, sx * 0.32, 0.65, 0);
  }

  // Боковые ручки (полукольца, концы утоплены в стенку)
  const handleGeo = new THREE.TorusGeometry(0.08, 0.025, 4, 6, Math.PI);
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(handleGeo, mats.dark);
    h.rotation.set(Math.PI / 2, sx * Math.PI / 2, 0, 'YXZ');
    h.position.set(sx * 0.48, 0.38, 0);
    root.add(h);
  }

  // Замок: тёмная пластина на стыке крышки и корпуса
  box(0.2, 0.18, 0.03, mats.dark, 0, 0.56, 0.365);
  // Светящийся индикатор замка
  box(0.1, 0.07, 0.03, mats.glow, 0, 0.58, 0.385);
  // Светящаяся полоса на крышке (y 0.77..0.80)
  box(0.5, 0.03, 0.06, mats.glow, 0, 0.785, 0);

  return root;
}