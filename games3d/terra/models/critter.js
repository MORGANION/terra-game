export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'critter';

  const std = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0.0, ...extra });

  const mats = {
    fur: std('#e8e4dc', { roughness: 0.9 }),
    accent: std('#ff7fb0', { roughness: 0.7 }),
    eye: std('#2e3238', { roughness: 0.3, metalness: 0.1 }),
    shine: std('#cfeeff', { emissive: '#cfeeff', emissiveIntensity: 0.6, roughness: 0.2 }),
  };
  mats.fur.name = 'fur';
  mats.accent.name = 'accent';
  mats.eye.name = 'eye';
  mats.shine.name = 'eye_shine';

  const add = (geo, mat, pos, scale, rot, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(m);
    return m;
  };

  // Сегмент-цилиндр между двумя точками
  const UP = new THREE.Vector3(0, 1, 0);
  const segment = (a, b, r0, r1, mat, radial = 6) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(r1, r0, len * 1.08, radial, 1);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(va.clone().add(vb).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
    root.add(m);
    return m;
  };

  // ---------- Тело ----------
  add(new THREE.SphereGeometry(1, 14, 10), mats.fur, [0, 0.15, -0.03], [0.15, 0.12, 0.17]);

  // ---------- Голова ----------
  const headC = [0, 0.22, 0.08];
  add(new THREE.SphereGeometry(0.11, 14, 10), mats.fur, headC, [1.05, 0.95, 0.95]);

  // Щёчки (кошачьи пушистые)
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.05, 8, 6), mats.fur, [s * 0.07, 0.185, 0.13], [1.1, 0.8, 0.9]);
  }

  // Вытянутая мордочка
  add(new THREE.SphereGeometry(0.055, 10, 7), mats.fur, [0, 0.19, 0.17], [0.9, 0.75, 1.3]);
  // Розовый носик
  add(new THREE.SphereGeometry(0.02, 8, 6), mats.accent, [0, 0.2, 0.238], [1.2, 0.9, 1]);

  // Усы
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const w = add(
        new THREE.BoxGeometry(0.12, 0.012, 0.012),
        mats.eye,
        [s * 0.09, 0.19 - i * 0.015, 0.2],
        null,
        [0, s * 0.25, s * (0.15 - i * 0.15)]
      );
      w.name = 'whisker';
    }
  }

  // ---------- Глаза ----------
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.036, 10, 8), mats.eye, [s * 0.052, 0.245, 0.165], [1, 1.1, 0.6]);
    add(new THREE.SphereGeometry(0.015, 6, 4), mats.shine, [s * 0.052 + 0.012, 0.262, 0.185]);
  }

  // ---------- Большие круглые уши-тарелочки ----------
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.1, 0.3, 0.05);
    ear.rotation.set(-0.15, s * -0.25, s * -0.35);
    root.add(ear);
    add(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 12, 1), mats.fur, [0, 0, 0], null, [Math.PI / 2, 0, 0], ear);
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 12, 1), mats.accent, [0, -0.005, 0.012], null, [Math.PI / 2, 0, 0], ear);
  }

  // ---------- Лапки ----------
  const legs = [
    [-0.075, 0.09],
    [0.075, 0.09],
    [-0.08, -0.12],
    [0.08, -0.12],
  ];
  for (const [x, z] of legs) {
    add(new THREE.CylinderGeometry(0.028, 0.03, 0.09, 6, 1), mats.fur, [x, 0.065, z]);
    add(new THREE.SphereGeometry(0.036, 8, 5), mats.fur, [x, 0.02, z + 0.012], [1, 0.6, 1.2]);
  }

  // ---------- Длинный тонкий хвост ----------
  const tail = [
    [0, 0.1, -0.17],
    [0, 0.07, -0.24],
    [0.03, 0.085, -0.285],
    [0.07, 0.13, -0.29],
    [0.095, 0.19, -0.275],
    [0.105, 0.25, -0.25],
    [0.1, 0.3, -0.22],
  ];
  for (let i = 0; i < tail.length - 1; i++) {
    const r0 = 0.024 - i * 0.0015;
    const r1 = 0.024 - (i + 1) * 0.0015;
    segment(tail[i], tail[i + 1], r0, r1, i === tail.length - 2 ? mats.accent : mats.fur);
  }
  // Кончик хвоста
  add(new THREE.SphereGeometry(0.02, 6, 5), mats.accent, tail[tail.length - 1]);

  return root;
}