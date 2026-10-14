export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'suit_body';

  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.7, metalness: 0.05 }),
    accent: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.6, metalness: 0.05 }),
    metal: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.45, metalness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.15, metalness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: '#9fd8ff', flatShading: true, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.5 }),
    crack: new THREE.MeshStandardMaterial({ color: '#cfeeff', flatShading: true, roughness: 0.3, metalness: 0.1 }),
    glow: new THREE.MeshStandardMaterial({ color: '#6fe3ff', flatShading: true, roughness: 0.3, metalness: 0.0, emissive: '#6fe3ff', emissiveIntensity: 1.6 }),
  };

  const add = (geo, mat, x, y, z, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  const bx = -0.07; // body center X (backpack lies to the +X side)

  // --- Torso ---
  add(new THREE.BoxGeometry(0.46, 0.28, 0.5), mats.hull, bx, 0.14, 0.25);
  // Chest plate
  add(new THREE.BoxGeometry(0.3, 0.04, 0.26), mats.accent, bx, 0.3, 0.3);
  // Beacon on chest
  add(new THREE.CylinderGeometry(0.05, 0.055, 0.06, 8), mats.glow, bx, 0.35, 0.3);

  // --- Neck ring ---
  add(new THREE.TorusGeometry(0.16, 0.04, 6, 12), mats.metal, bx, 0.2, 0.5);

  // --- Helmet ---
  add(new THREE.IcosahedronGeometry(0.2, 1), mats.hull, bx, 0.2, 0.68);

  // Visor (dark base, facing up — suit lies on its back)
  const visor = add(new THREE.SphereGeometry(0.16, 10, 6), mats.dark, bx, 0.33, 0.73);
  visor.scale.set(1, 0.5, 0.9);
  // Glass layer
  const visorGlass = add(new THREE.SphereGeometry(0.16, 10, 6), mats.glass, bx, 0.335, 0.73);
  visorGlass.scale.set(1.06, 0.55, 0.95);

  // Cracks on the glass
  const crack1 = add(new THREE.BoxGeometry(0.03, 0.02, 0.15), mats.crack, bx + 0.03, 0.41, 0.73);
  crack1.rotation.y = 0.6;
  const crack2 = add(new THREE.BoxGeometry(0.03, 0.02, 0.1), mats.crack, bx - 0.02, 0.405, 0.77);
  crack2.rotation.y = -0.7;
  crack2.rotation.x = 0.15;

  // --- Arms (lying along the body) ---
  const armGeo = new THREE.CapsuleGeometry(0.07, 0.3, 2, 8);
  const armL = add(armGeo, mats.hull, bx - 0.31, 0.07, 0.3);
  armL.rotation.x = Math.PI / 2;
  const armR = add(armGeo, mats.hull, bx + 0.31, 0.07, 0.3);
  armR.rotation.x = Math.PI / 2;

  // Gloves
  const gloveGeo = new THREE.SphereGeometry(0.08, 6, 4);
  add(gloveGeo, mats.accent, bx - 0.31, 0.08, 0.06);
  add(gloveGeo, mats.accent, bx + 0.31, 0.08, 0.06);

  // --- Legs ---
  const legGeo = new THREE.CapsuleGeometry(0.09, 0.72, 2, 8);
  const legL = add(legGeo, mats.hull, bx - 0.12, 0.09, -0.42);
  legL.rotation.x = Math.PI / 2;
  const legR = add(legGeo, mats.hull, bx + 0.12, 0.09, -0.42);
  legR.rotation.x = Math.PI / 2;

  // Boots (toes up)
  const bootGeo = new THREE.BoxGeometry(0.17, 0.22, 0.12);
  add(bootGeo, mats.accent, bx - 0.12, 0.11, -0.86);
  add(bootGeo, mats.accent, bx + 0.12, 0.11, -0.86);

  // --- Backpack, detached, lying beside the legs ---
  const pack = new THREE.Group();
  pack.position.set(0.27, 0, -0.4);
  pack.rotation.y = 0.1;
  root.add(pack);
  add(new THREE.BoxGeometry(0.28, 0.4, 0.5), mats.metal, 0, 0.2, 0, pack);
  const tank = add(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 8), mats.accent, 0, 0.465, 0, pack);
  tank.rotation.x = Math.PI / 2;
  tank.position.y = 0.4 + 0.065;

  return root;
}