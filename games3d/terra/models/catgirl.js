export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'catgirl';

  const mats = {
    skin: new THREE.MeshStandardMaterial({ color: '#ffd9c2', flatShading: false, roughness: 0.75, metalness: 0, emissive: '#ffd9c2', emissiveIntensity: 0.18 }),
    fur: new THREE.MeshStandardMaterial({ color: '#c98a5a', flatShading: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }),
    accent: new THREE.MeshStandardMaterial({ color: '#ff7fb0', flatShading: true, roughness: 0.8, metalness: 0 }),
    cloth: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.9, metalness: 0 }),
    eye: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: false, roughness: 0.3, metalness: 0.1 }),
    eyeHi: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: false, roughness: 0.2, emissive: '#ffffff', emissiveIntensity: 0.6 }),
    mouth: new THREE.MeshStandardMaterial({ color: '#c8456f', flatShading: false, roughness: 0.6 }),
    blush: new THREE.MeshStandardMaterial({ color: '#ff7fb0', flatShading: false, roughness: 0.8, transparent: true, opacity: 0.75 }),
    belt: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.7, metalness: 0.1 }),
    sandal: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.6, metalness: 0.3 })
  };
  mats.skin.name = 'skin';
  mats.fur.name = 'fur';
  mats.accent.name = 'accent';
  mats.cloth.name = 'cloth';
  mats.eye.name = 'eye';
  mats.eyeHi.name = 'eye_highlight';
  mats.mouth.name = 'mouth';
  mats.blush.name = 'blush';
  mats.belt.name = 'belt';
  mats.sandal.name = 'sandal';

  const add = (geo, mat, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    return m;
  };

  // ---------- Тело: туника до щиколоток ----------
  const dressProfile = [
    [0.0, 0.07], [0.22, 0.07], [0.21, 0.2], [0.18, 0.45], [0.16, 0.65],
    [0.165, 0.8], [0.15, 0.88], [0.11, 0.93], [0.05, 0.96], [0.0, 0.965]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const dress = add(new THREE.LatheGeometry(dressProfile, 16), mats.cloth);
  dress.scale.set(1, 1, 0.82);

  const belt = add(new THREE.TorusGeometry(0.162, 0.018, 6, 16), mats.belt);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1, 0.82, 1);
  belt.position.y = 0.64;

  // ---------- Шея ----------
  const neck = add(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 12), mats.skin);
  neck.position.y = 0.98;

  // ---------- Руки ----------
  for (const s of [-1, 1]) {
    const sleeve = add(new THREE.SphereGeometry(0.065, 10, 8), mats.cloth);
    sleeve.position.set(s * 0.17, 0.87, 0);
    sleeve.scale.set(1, 1.1, 0.9);

    const arm = add(new THREE.CapsuleGeometry(0.04, 0.24, 4, 10), mats.skin);
    arm.position.set(s * 0.205, 0.7, 0);
    arm.rotation.z = s * 0.1;

    const hand = add(new THREE.SphereGeometry(0.048, 12, 10), mats.skin);
    hand.position.set(s * 0.222, 0.54, 0);
    hand.scale.set(0.9, 1.1, 0.9);
  }

  // ---------- Ноги / сандалии ----------
  for (const s of [-1, 1]) {
    const sole = add(new THREE.BoxGeometry(0.09, 0.025, 0.17), mats.sandal);
    sole.position.set(s * 0.08, 0.0125, 0.06);

    const foot = add(new THREE.SphereGeometry(0.048, 12, 8), mats.skin);
    foot.position.set(s * 0.08, 0.048, 0.07);
    foot.scale.set(0.9, 0.6, 1.5);

    const strap = add(new THREE.BoxGeometry(0.1, 0.03, 0.03), mats.sandal);
    strap.position.set(s * 0.08, 0.06, 0.1);
  }

  // ---------- Голова ----------
  const HC = new THREE.Vector3(0, 1.22, 0);
  const R = 0.25;
  const head = add(new THREE.SphereGeometry(R, 28, 20), mats.skin);
  head.position.copy(HC);

  // группа на поверхности головы, локальная +Z = нормаль наружу
  const onFace = (x, y, lift = 0) => {
    const dy = y - HC.y;
    const z = Math.sqrt(Math.max(0.0001, R * R - x * x - dy * dy));
    const n = new THREE.Vector3(x, dy, z).normalize();
    const g = new THREE.Group();
    g.position.copy(HC).addScaledVector(n, R + lift);
    root.add(g);
    g.lookAt(g.position.clone().add(n));
    return g;
  };

  // Глаза
  for (const s of [-1, 1]) {
    const g = onFace(s * 0.09, 1.195, -0.004);
    const eye = add(new THREE.SphereGeometry(0.056, 16, 12), mats.eye, g);
    eye.scale.set(0.8, 1.1, 0.35);
    const hi1 = add(new THREE.SphereGeometry(0.017, 10, 8), mats.eyeHi, g);
    hi1.position.set(s * 0.012, 0.024, 0.017);
    hi1.scale.set(1, 1, 0.5);
    const hi2 = add(new THREE.SphereGeometry(0.008, 8, 6), mats.eyeHi, g);
    hi2.position.set(-s * 0.012, -0.022, 0.017);
    hi2.scale.set(1, 1, 0.5);
  }

  // Рот «ω» — ~25% от подбородка до глаз
  {
    const g = onFace(0, 1.04, 0.001);
    for (const s of [-1, 1]) {
      const arc = add(new THREE.TorusGeometry(0.015, 0.005, 6, 10, Math.PI), mats.mouth, g);
      arc.rotation.z = Math.PI; // дугой вниз
      arc.position.set(s * 0.015, 0.006, 0.002);
    }
  }

  // Румянец
  for (const s of [-1, 1]) {
    const g = onFace(s * 0.115, 1.105, -0.003);
    const b = add(new THREE.SphereGeometry(0.034, 12, 8), mats.blush, g);
    b.scale.set(1, 0.55, 0.25);
  }

  // ---------- Волосы ----------
  const cap = add(new THREE.SphereGeometry(0.266, 24, 10, 0, Math.PI * 2, 0, 1.15), mats.fur);
  cap.position.copy(HC);

  const back = add(new THREE.SphereGeometry(0.268, 20, 10, Math.PI, Math.PI, 0.9, 1.3), mats.fur);
  back.position.copy(HC);

  const curtain = add(
    new THREE.CylinderGeometry(0.25, 0.225, 0.2, 18, 1, true, Math.PI / 2 - 0.3, Math.PI + 0.6),
    mats.fur
  );
  curtain.position.set(0, 1.03, -0.005);

  // Чёлка — над глазами, щёки открыты
  const bangs = [[0, 1.355, 1.25], [-0.085, 1.345, 1.1], [0.085, 1.345, 1.1], [-0.165, 1.325, 0.9], [0.165, 1.325, 0.9]];
  for (const [x, y, sc] of bangs) {
    const g = onFace(x, y, 0.006);
    const b = add(new THREE.SphereGeometry(0.055, 10, 8), mats.fur, g);
    b.scale.set(1.1 * sc, 0.8, 0.4);
    b.rotation.z = x * 1.5;
  }

  // ---------- Уши ----------
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.14, 1.455, -0.02);
    ear.rotation.z = -s * 0.3;
    root.add(ear);
    const outer = add(new THREE.ConeGeometry(0.08, 0.16, 10), mats.fur, ear);
    outer.scale.set(1, 1, 0.6);
    const inner = add(new THREE.ConeGeometry(0.05, 0.11, 8), mats.accent, ear);
    inner.position.set(0, -0.015, 0.024);
    inner.scale.set(1, 1, 0.4);
  }

  // ---------- Хвост: плавная дуга из 7 сегментов ----------
  const pts = [
    [0.0, 0.5, -0.16], [0.06, 0.42, -0.2], [0.15, 0.385, -0.21], [0.235, 0.42, -0.205],
    [0.29, 0.52, -0.195], [0.31, 0.635, -0.185], [0.295, 0.745, -0.18], [0.26, 0.83, -0.175]
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dir = b.clone().sub(a);
    const len = dir.length();
    const r = 0.04 - i * 0.0015;
    const seg = add(new THREE.CapsuleGeometry(r, len, 3, 10), mats.fur);
    seg.position.copy(a).add(b).multiplyScalar(0.5);
    seg.quaternion.setFromUnitVectors(up, dir.normalize());
  }
  const tip = add(new THREE.SphereGeometry(0.034, 10, 8), mats.accent);
  tip.position.copy(pts[pts.length - 1]);

  return root;
}