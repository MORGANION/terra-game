export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'oxygen_t2';

  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.6, metalness: 0.1 }),
    accent: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.5, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.45, metalness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.7, metalness: 0.4 }),
    glow: new THREE.MeshStandardMaterial({ color: '#6fe3ff', flatShading: true, roughness: 0.3, metalness: 0.0, emissive: '#6fe3ff', emissiveIntensity: 1.4 }),
    tank: new THREE.MeshStandardMaterial({ color: '#6fe3ff', flatShading: true, roughness: 0.2, metalness: 0.0, emissive: '#6fe3ff', emissiveIntensity: 0.8, transparent: true, opacity: 0.8 }),
  };

  const add = (geo, mat, x = 0, y = 0, z = 0, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // --- Base ---
  add(new THREE.CylinderGeometry(0.95, 0.97, 0.2, 8), mats.dark, 0, 0.1, 0);
  add(new THREE.CylinderGeometry(0.86, 0.9, 0.1, 8), mats.hull, 0, 0.25, 0);

  // --- Lower housing ---
  add(new THREE.CylinderGeometry(0.33, 0.37, 0.6, 8), mats.metal, 0, 0.6, 0);

  // Front service door
  add(new THREE.BoxGeometry(0.28, 0.4, 0.08), mats.accent, 0, 0.55, 0.34);
  add(new THREE.BoxGeometry(0.16, 0.06, 0.04), mats.glow, 0, 0.66, 0.39);

  // --- Main column ---
  add(new THREE.CylinderGeometry(0.22, 0.28, 1.55, 8), mats.hull, 0, 0.9 + 1.55 / 2, 0);

  // Accent bands
  add(new THREE.CylinderGeometry(0.285, 0.285, 0.1, 8), mats.accent, 0, 1.4, 0);
  add(new THREE.CylinderGeometry(0.255, 0.255, 0.1, 8), mats.accent, 0, 2.05, 0);

  // Front glow strip on column
  const strip = add(new THREE.BoxGeometry(0.07, 0.45, 0.06), mats.glow, 0, 1.72, 0.245);
  strip.rotation.x = -0.02;

  // --- Tanks ring ---
  const tankR = 0.62;
  const tankRad = 0.16;
  const tankLen = 0.6;
  const tankCenterY = 0.3 + 0.06 + tankLen / 2 + tankRad;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 6;
    const x = Math.sin(a) * tankR;
    const z = Math.cos(a) * tankR;

    // glowing tank
    add(new THREE.CapsuleGeometry(tankRad, tankLen, 3, 8), mats.tank, x, tankCenterY, z);
    // bottom collar (sits on deck)
    add(new THREE.CylinderGeometry(0.19, 0.2, 0.12, 8), mats.dark, x, 0.36, z);

    // pipe from tank to column
    const pivot = new THREE.Group();
    pivot.rotation.y = a;
    pivot.position.y = 1.0;
    root.add(pivot);
    const pipe = add(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 6), mats.metal, 0, 0, 0.36, pivot);
    pipe.rotation.x = Math.PI / 2;
  }

  // Collar ring tying tanks together
  const ring = add(new THREE.TorusGeometry(tankR, 0.04, 6, 24), mats.metal, 0, 1.12, 0);
  ring.rotation.x = Math.PI / 2;

  // --- Turbine section ---
  add(new THREE.CylinderGeometry(0.55, 0.5, 0.08, 10), mats.metal, 0, 2.49, 0);
  add(new THREE.CylinderGeometry(0.12, 0.12, 0.62, 8), mats.dark, 0, 2.84, 0);

  const bladeCount = 5;
  for (let i = 0; i < bladeCount; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / bladeCount) * Math.PI * 2;
    pivot.position.y = 2.84;
    root.add(pivot);
    const blade = add(
      new THREE.BoxGeometry(0.06, 0.6, 0.4),
      i % 2 === 0 ? mats.hull : mats.accent,
      0, 0, 0.31, pivot
    );
    blade.rotation.y = 0.45;
  }

  add(new THREE.CylinderGeometry(0.5, 0.55, 0.06, 10), mats.metal, 0, 3.18, 0);

  // Top cap + beacon
  add(new THREE.CylinderGeometry(0.1, 0.3, 0.12, 8), mats.hull, 0, 3.27, 0);
  add(new THREE.IcosahedronGeometry(0.07, 0), mats.glow, 0, 3.33, 0);

  return root;
}