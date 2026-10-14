export default function build(THREE) {
  const root = new THREE.Group();

  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.6, metalness: 0.1 }),
    accent: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.5, metalness: 0.2 }),
    metal: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.4, metalness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.5, metalness: 0.5 }),
    glow: new THREE.MeshStandardMaterial({ color: '#6fe3ff', flatShading: true, roughness: 0.3, metalness: 0.0, emissive: '#6fe3ff', emissiveIntensity: 1.2 }),
    plasma: new THREE.MeshStandardMaterial({ color: '#ff7fb0', flatShading: true, roughness: 0.2, metalness: 0.0, emissive: '#f08a3c', emissiveIntensity: 2.0 }),
    plasmaCore: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.3, metalness: 0.0, emissive: '#ff7fb0', emissiveIntensity: 1.6 }),
    glass: new THREE.MeshStandardMaterial({ color: '#9fd8ff', flatShading: true, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.5, emissive: '#ff7fb0', emissiveIntensity: 0.3 }),
  };

  function add(geo, mat, x = 0, y = 0, z = 0, parent = root) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // --- Base plinth (octagonal) ---
  const plinth = add(new THREE.CylinderGeometry(0.82, 0.86, 0.18, 8), mats.metal, 0, 0.09, 0);
  plinth.rotation.y = Math.PI / 8;
  const plinthTop = add(new THREE.CylinderGeometry(0.76, 0.8, 0.08, 8), mats.hull, 0, 0.22, 0);
  plinthTop.rotation.y = Math.PI / 8;

  // --- Lower housing ---
  add(new THREE.CylinderGeometry(0.58, 0.68, 0.5, 12), mats.hull, 0, 0.51, 0);
  add(new THREE.TorusGeometry(0.64, 0.045, 6, 16), mats.accent, 0, 0.46, 0).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.5, 0.58, 0.1, 12), mats.metal, 0, 0.81, 0);

  // Diagonal buttresses
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const g = new THREE.Group();
    g.rotation.y = a;
    root.add(g);
    const b = add(new THREE.BoxGeometry(0.16, 0.42, 0.3), mats.dark, 0, 0.47, 0.66, g);
    b.rotation.x = -0.25;
    add(new THREE.BoxGeometry(0.18, 0.06, 0.2), mats.accent, 0, 0.62, 0.62, g);
  }

  // Front control panel (+Z)
  add(new THREE.BoxGeometry(0.44, 0.3, 0.1), mats.dark, 0, 0.52, 0.64);
  add(new THREE.BoxGeometry(0.32, 0.12, 0.04), mats.glow, 0, 0.56, 0.7);
  add(new THREE.BoxGeometry(0.08, 0.06, 0.04), mats.accent, -0.1, 0.44, 0.7);
  add(new THREE.BoxGeometry(0.08, 0.06, 0.04), mats.accent, 0.1, 0.44, 0.7);

  // --- Central glowing core column ---
  add(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 10), mats.dark, 0, 1.46, 0);
  add(new THREE.CylinderGeometry(0.34, 0.34, 1.1, 10), mats.plasmaCore, 0, 1.43, 0).scale.set(1, 1, 1);

  // --- Radiator rings ---
  const ringYs = [0.98, 1.2, 1.42, 1.64, 1.86];
  ringYs.forEach((y, i) => {
    const r = 0.66 - Math.abs(i - 2) * 0.04;
    add(new THREE.CylinderGeometry(r, r, 0.08, 14), i % 2 === 0 ? mats.metal : mats.hull, 0, y, 0);
    add(new THREE.TorusGeometry(r, 0.03, 4, 14), mats.accent, 0, y, 0).rotation.x = Math.PI / 2;
  });

  // Vertical struts tying rings together
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const g = new THREE.Group();
    g.rotation.y = a;
    root.add(g);
    add(new THREE.BoxGeometry(0.1, 1.18, 0.1), mats.dark, 0, 1.43, 0.6, g);
    add(new THREE.BoxGeometry(0.06, 0.9, 0.04), mats.glow, 0, 1.43, 0.66, g);
  }

  // --- Top collar ---
  add(new THREE.CylinderGeometry(0.42, 0.52, 0.16, 12), mats.hull, 0, 2.04, 0);
  add(new THREE.CylinderGeometry(0.36, 0.42, 0.1, 12), mats.metal, 0, 2.17, 0);
  add(new THREE.TorusGeometry(0.45, 0.04, 4, 14), mats.accent, 0, 2.0, 0).rotation.x = Math.PI / 2;

  // Emitter cup
  add(new THREE.CylinderGeometry(0.22, 0.14, 0.1, 10), mats.dark, 0, 2.27, 0);

  // --- Plasma sphere ---
  add(new THREE.IcosahedronGeometry(0.26, 1), mats.plasma, 0, 2.46, 0);
  add(new THREE.IcosahedronGeometry(0.34, 1), mats.glass, 0, 2.46, 0);

  // Prongs holding sphere
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3) + Math.PI / 6;
    const g = new THREE.Group();
    g.rotation.y = a;
    root.add(g);
    const p = add(new THREE.BoxGeometry(0.08, 0.5, 0.1), mats.metal, 0.4, 2.42, 0, g);
    p.rotation.z = 0.12;
    add(new THREE.BoxGeometry(0.12, 0.08, 0.12), mats.accent, 0.42, 2.2, 0, g);
    add(new THREE.IcosahedronGeometry(0.05, 0), mats.plasma, 0.37, 2.68, 0, g);
  }

  return root;
}