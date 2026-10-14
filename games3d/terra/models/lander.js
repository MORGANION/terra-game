export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'lander';

  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.6, metalness: 0.1 }),
    accent: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.5, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.45, metalness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.7, metalness: 0.3 }),
    glow: new THREE.MeshStandardMaterial({ color: '#6fe3ff', flatShading: true, roughness: 0.3, metalness: 0.0, emissive: '#6fe3ff', emissiveIntensity: 1.6 }),
    glass: new THREE.MeshStandardMaterial({ color: '#9fd8ff', flatShading: true, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.7, emissive: '#6fe3ff', emissiveIntensity: 0.25 }),
  };

  const V3 = THREE.Vector3;
  const UP = new V3(0, 1, 0);

  function add(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    root.add(m);
    return m;
  }

  function rod(a, b, r, mat, seg = 6, parent = root) {
    const d = new V3().subVectors(b, a);
    const len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    parent.add(m);
    return m;
  }

  const OCT = Math.PI / 8; // поворот восьмиугольника: грани смотрят на +Z/+X и диагонали
  const R = 1.3;
  const APO = R * Math.cos(Math.PI / 8); // ~1.2

  // ---------- Корпус ----------
  const body = add(new THREE.CylinderGeometry(R, R, 1.8, 8), mats.hull, 0, 1.9, 0); // y 1.0..2.8
  body.rotation.y = OCT;

  const skirt = add(new THREE.CylinderGeometry(R, 1.0, 0.4, 8), mats.metal, 0, 0.8, 0); // y 0.6..1.0
  skirt.rotation.y = OCT;

  add(new THREE.CylinderGeometry(0.3, 0.55, 0.35, 8), mats.dark, 0, 0.42, 0); // сопло
  add(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 8), mats.glow, 0, 0.25, 0); // свечение сопла

  const band = add(new THREE.CylinderGeometry(R + 0.04, R + 0.04, 0.16, 8), mats.accent, 0, 2.55, 0);
  band.rotation.y = OCT;

  const cap = add(new THREE.CylinderGeometry(0.7, R, 0.5, 8), mats.hull, 0, 3.05, 0); // y 2.8..3.3
  cap.rotation.y = OCT;

  const deck = add(new THREE.CylinderGeometry(0.72, 0.72, 0.1, 8), mats.metal, 0, 3.35, 0);
  deck.rotation.y = OCT;

  // ---------- Опоры (диагонали) ----------
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const s = Math.sin(a), c = Math.cos(a);
    const top = new V3(s * 1.1, 1.6, c * 1.1);
    const foot = new V3(s * 2.05, 0.12, c * 2.05);
    rod(top, foot, 0.1, mats.metal, 6);

    const t = 0.7;
    const knee = new V3().lerpVectors(top, foot, t);
    rod(new V3(s * 0.9, 0.75, c * 0.9), knee, 0.065, mats.dark, 6);

    const joint = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), mats.accent);
    joint.position.copy(knee);
    root.add(joint);

    add(new THREE.CylinderGeometry(0.28, 0.32, 0.12, 8), mats.dark, foot.x, 0.06, foot.z);
  }

  // ---------- Люк (+Z) ----------
  add(new THREE.BoxGeometry(0.9, 1.1, 0.1), mats.accent, 0, 1.75, APO + 0.03);
  add(new THREE.BoxGeometry(0.7, 0.9, 0.06), mats.metal, 0, 1.73, APO + 0.1);
  add(new THREE.BoxGeometry(0.34, 0.2, 0.04), mats.glow, 0, 2.0, APO + 0.14);

  // ---------- Лестница ----------
  const lz = APO + 0.2;
  add(new THREE.BoxGeometry(0.07, 1.45, 0.07), mats.metal, -0.26, 0.725, lz);
  add(new THREE.BoxGeometry(0.07, 1.45, 0.07), mats.metal, 0.26, 0.725, lz);
  for (let k = 0; k < 4; k++) {
    add(new THREE.BoxGeometry(0.52, 0.05, 0.06), mats.dark, 0, 0.3 + k * 0.3, lz);
  }
  // кронштейн к корпусу
  add(new THREE.BoxGeometry(0.6, 0.1, 0.24), mats.dark, 0, 1.35, APO + 0.1);

  // ---------- Иллюминаторы ----------
  for (const a of [-Math.PI / 4, Math.PI / 4]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 8), mats.glass);
    w.position.set(Math.sin(a) * (APO + 0.02), 2.25, Math.cos(a) * (APO + 0.02));
    w.rotation.order = 'YXZ';
    w.rotation.set(Math.PI / 2, a, 0);
    root.add(w);
  }

  // ---------- Солнечные панели (±X) ----------
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(side * (APO - 0.05), 2.25, 0);
    g.rotation.z = side * 0.18;
    root.add(g);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 6), mats.metal);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(side * 0.2, 0, 0);
    g.add(arm);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 1.5), mats.dark);
    panel.position.set(side * 0.85, 0, 0);
    g.add(panel);

    for (const dz of [-0.37, 0.37]) {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.04, 0.66), mats.glass);
      cell.position.set(side * 0.85, 0.04, dz);
      g.add(cell);
    }
  }

  // ---------- RCS-блоки ----------
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const b = add(new THREE.BoxGeometry(0.22, 0.22, 0.22), mats.dark,
      Math.sin(a) * (APO + 0.08), 2.85, Math.cos(a) * (APO + 0.08));
    b.rotation.y = a;
  }

  // ---------- Антенна-тарелка ----------
  const mastX = -0.3, mastZ = -0.15;
  add(new THREE.CylinderGeometry(0.06, 0.08, 0.95, 6), mats.metal, mastX, 3.85, mastZ); // y 3.375..4.325
  const dish = add(new THREE.CylinderGeometry(0.5, 0.1, 0.16, 10), mats.hull, mastX, 4.38, mastZ);
  dish.rotation.x = 0.5;
  const feed = add(new THREE.CylinderGeometry(0.035, 0.035, 0.35, 5), mats.dark, mastX, 4.6, mastZ + 0.1);
  feed.rotation.x = 0.5;
  add(new THREE.IcosahedronGeometry(0.08, 0), mats.glow, mastX, 4.75, mastZ + 0.18);

  // ---------- Штыревая антенна ----------
  add(new THREE.CylinderGeometry(0.04, 0.05, 0.7, 5), mats.dark, 0.38, 3.75, 0.2); // y 3.4..4.1
  add(new THREE.IcosahedronGeometry(0.08, 0), mats.accent, 0.38, 4.14, 0.2);

  return root;
}