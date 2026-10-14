export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'astronaut';

  const P = {
    hull: '#e8e4dc', accent: '#f08a3c', metal: '#5b616b', dark: '#2e3238',
    glow: '#6fe3ff', glass: '#9fd8ff'
  };

  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: P.hull, flatShading: true, roughness: 0.75, metalness: 0.05 }),
    accent: new THREE.MeshStandardMaterial({ color: P.accent, flatShading: true, roughness: 0.6, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: P.metal, flatShading: true, roughness: 0.45, metalness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: P.dark, flatShading: true, roughness: 0.8, metalness: 0.2 }),
    glow: new THREE.MeshStandardMaterial({ color: P.glow, flatShading: true, roughness: 0.3, metalness: 0.0, emissive: P.glow, emissiveIntensity: 1.4 }),
    glass: new THREE.MeshStandardMaterial({ color: P.glass, flatShading: true, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7, emissive: P.glow, emissiveIntensity: 0.25 })
  };

  function add(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  }

  // ---------- LEGS (pivot at hip, y = 0.85) ----------
  function makeLeg(name, side) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(0.12 * side, 0.85, 0);
    // thigh
    add(g, new THREE.CapsuleGeometry(0.095, 0.22, 3, 8), mats.hull, 0, -0.2, 0);
    // knee pad
    add(g, new THREE.TorusGeometry(0.088, 0.03, 5, 10), mats.accent, 0, -0.41, 0, Math.PI / 2, 0, 0);
    // shin
    add(g, new THREE.CapsuleGeometry(0.088, 0.22, 3, 8), mats.hull, 0, -0.56, 0);
    // boot
    add(g, new THREE.BoxGeometry(0.17, 0.12, 0.26), mats.metal, 0, -0.77, 0.03);
    // sole
    add(g, new THREE.BoxGeometry(0.18, 0.04, 0.27), mats.dark, 0, -0.83, 0.03);
    root.add(g);
    return g;
  }
  makeLeg('legL', 1);
  makeLeg('legR', -1);

  // ---------- BODY (pivot at hip) ----------
  const body = new THREE.Group();
  body.name = 'body';
  body.position.set(0, 0.85, 0);
  root.add(body);

  // pelvis
  add(body, new THREE.BoxGeometry(0.38, 0.16, 0.28), mats.hull, 0, 0.04, 0);
  // belt
  add(body, new THREE.BoxGeometry(0.4, 0.05, 0.3), mats.accent, 0, 0.11, 0);
  // torso
  add(body, new THREE.BoxGeometry(0.46, 0.46, 0.32), mats.hull, 0, 0.36, 0);
  // collar
  add(body, new THREE.CylinderGeometry(0.15, 0.18, 0.05, 10), mats.metal, 0, 0.6, 0);
  // chest control panel
  add(body, new THREE.BoxGeometry(0.22, 0.13, 0.04), mats.dark, 0, 0.38, 0.17);
  add(body, new THREE.BoxGeometry(0.04, 0.04, 0.03), mats.glow, -0.06, 0.4, 0.195);
  add(body, new THREE.BoxGeometry(0.04, 0.04, 0.03), mats.accent, 0, 0.4, 0.195);
  add(body, new THREE.BoxGeometry(0.04, 0.04, 0.03), mats.glow, 0.06, 0.4, 0.195);
  add(body, new THREE.BoxGeometry(0.16, 0.03, 0.03), mats.glow, 0, 0.345, 0.195);
  // chest accent stripes
  add(body, new THREE.BoxGeometry(0.05, 0.3, 0.02), mats.accent, -0.17, 0.4, 0.165);
  add(body, new THREE.BoxGeometry(0.05, 0.3, 0.02), mats.accent, 0.17, 0.4, 0.165);

  // backpack plate
  add(body, new THREE.BoxGeometry(0.4, 0.48, 0.08), mats.hull, 0, 0.37, -0.2);
  // tanks
  for (const s of [-1, 1]) {
    const x = 0.1 * s;
    add(body, new THREE.CylinderGeometry(0.06, 0.06, 0.44, 10), mats.metal, x, 0.37, -0.235);
    add(body, new THREE.CylinderGeometry(0.066, 0.066, 0.04, 10), mats.accent, x, 0.49, -0.235);
    add(body, new THREE.CylinderGeometry(0.066, 0.066, 0.04, 10), mats.accent, x, 0.25, -0.235);
    add(body, new THREE.CylinderGeometry(0.035, 0.045, 0.05, 8), mats.dark, x, 0.615, -0.235);
  }
  // backpack status light between tanks
  add(body, new THREE.BoxGeometry(0.04, 0.12, 0.03), mats.glow, 0, 0.37, -0.25);

  // ---------- ARMS (pivot at shoulder) ----------
  function makeArm(name, side) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(0.3 * side, 1.38, 0);
    // shoulder pad
    add(g, new THREE.SphereGeometry(0.1, 8, 6), mats.accent, 0, 0, 0);
    // upper arm
    add(g, new THREE.CapsuleGeometry(0.075, 0.2, 3, 8), mats.hull, 0, -0.18, 0);
    // lower arm
    add(g, new THREE.CapsuleGeometry(0.07, 0.2, 3, 8), mats.hull, 0, -0.42, 0);
    // cuff
    add(g, new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10), mats.accent, 0, -0.56, 0);
    // glove
    add(g, new THREE.SphereGeometry(0.075, 8, 6), mats.metal, 0, -0.64, 0.01);
    root.add(g);
    return g;
  }
  makeArm('armL', 1);
  makeArm('armR', -1);

  // ---------- HEAD (pivot at neck, y = 1.44) ----------
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 1.44, 0);
  root.add(head);

  // neck ring
  add(head, new THREE.TorusGeometry(0.13, 0.03, 5, 12), mats.metal, 0, 0.02, 0, Math.PI / 2, 0, 0);
  // helmet shell
  add(head, new THREE.SphereGeometry(0.19, 12, 9), mats.hull, 0, 0.17, 0);
  // visor (front patch of a slightly larger sphere, centered on +Z)
  add(
    head,
    new THREE.SphereGeometry(0.197, 12, 6, Math.PI / 2 - 0.95, 1.9, 0.75, 1.25),
    mats.glass, 0, 0.17, 0
  );
  // side ear modules with lamps
  for (const s of [-1, 1]) {
    add(head, new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), mats.accent, 0.18 * s, 0.17, 0, 0, 0, Math.PI / 2);
    add(head, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8), mats.glow, 0.21 * s, 0.17, 0, 0, 0, Math.PI / 2);
  }
  // top headlamp
  add(head, new THREE.BoxGeometry(0.08, 0.04, 0.06), mats.dark, 0, 0.345, 0.03);
  add(head, new THREE.BoxGeometry(0.05, 0.03, 0.03), mats.glow, 0, 0.345, 0.065);

  return root;
}