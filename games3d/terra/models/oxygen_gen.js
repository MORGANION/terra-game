export default function build(THREE) {
  const root = new THREE.Group();

  const std = (color, rough = 0.6, metal = 0.1, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough, metalness: metal, ...extra });

  const mats = {
    hull: std('#e8e4dc', 0.55, 0.05),
    hullDS: std('#e8e4dc', 0.55, 0.05, { side: THREE.DoubleSide }),
    metal: std('#5b616b', 0.45, 0.6),
    dark: std('#2e3238', 0.7, 0.3),
    glass: std('#9fd8ff', 0.15, 0.1, { transparent: true, opacity: 0.55 }),
    pipe: std('#9fd8ff', 0.25, 0.2, { transparent: true, opacity: 0.8, emissive: '#6fe3ff', emissiveIntensity: 0.25 }),
    glow: std('#6fe3ff', 0.3, 0.0, { emissive: '#6fe3ff', emissiveIntensity: 1.6 }),
    ice: std('#cfeeff', 0.3, 0.0, { emissive: '#6fe3ff', emissiveIntensity: 0.9 }),
  };

  const add = (geo, mat, x = 0, y = 0, z = 0, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // ---------- Основание-рама ----------
  add(new THREE.BoxGeometry(1.5, 0.1, 1.2), mats.dark, 0, 0.05, 0);

  // ---------- Опоры-ложементы ----------
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.14, 0.38, 0.9), mats.metal, sx * 0.45, 0.1 + 0.19, 0);
  }

  // ---------- Горизонтальный бак-капсула ----------
  const tankY = 0.85;
  const tank = add(new THREE.CapsuleGeometry(0.45, 0.6, 4, 14), mats.hull, 0, tankY, 0);
  tank.rotation.z = Math.PI / 2;

  // светящиеся кольца-бандажи
  for (const sx of [-1, 1]) {
    const ring = add(new THREE.TorusGeometry(0.46, 0.035, 6, 20), mats.glow, sx * 0.32, tankY, 0);
    ring.rotation.y = Math.PI / 2;
  }

  // ---------- Смотровая колба с пузырями (фронт) ----------
  const tube = add(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 10), mats.glass, 0, tankY, 0.42);
  tube.rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) {
    const cap = add(new THREE.CylinderGeometry(0.155, 0.155, 0.06, 10), mats.metal, sx * 0.27, tankY, 0.42);
    cap.rotation.z = Math.PI / 2;
  }
  // детерминированный seed
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 5; i++) {
    const r = 0.04 + rnd() * 0.035;
    add(new THREE.IcosahedronGeometry(r, 1), mats.glow,
      -0.18 + i * 0.09, tankY - 0.06 + rnd() * 0.12, 0.44 + (rnd() - 0.5) * 0.04);
  }

  // ---------- Верхняя палуба ----------
  add(new THREE.BoxGeometry(0.9, 0.2, 0.5), mats.metal, 0, 1.2, 0);
  add(new THREE.BoxGeometry(1.3, 0.08, 1.0), mats.hull, 0, 1.32, 0);

  // ---------- Два вентилятора-турбины ----------
  const fanR = 0.33, fanBot = 1.36, fanTop = 2.0;
  for (const sx of [-1, 1]) {
    const fx = sx * 0.42;
    const fan = new THREE.Group();
    fan.position.set(fx, 0, 0);
    root.add(fan);

    add(new THREE.CylinderGeometry(fanR, fanR + 0.03, fanTop - fanBot, 14, 1, true), mats.hullDS,
      0, (fanBot + fanTop) / 2, 0, fan);
    add(new THREE.CylinderGeometry(fanR - 0.02, fanR - 0.02, 0.06, 14), mats.dark, 0, 1.7, 0, fan);
    add(new THREE.CylinderGeometry(0.08, 0.09, 0.24, 8), mats.metal, 0, 1.85, 0, fan);
    add(new THREE.IcosahedronGeometry(0.06, 0), mats.glow, 0, 1.98, 0, fan);

    const ring = add(new THREE.TorusGeometry(fanR, 0.035, 6, 20), mats.glow, 0, fanTop, 0, fan);
    ring.rotation.x = Math.PI / 2;

    // лопасти
    for (let i = 0; i < 6; i++) {
      const piv = new THREE.Group();
      piv.position.y = 1.9;
      piv.rotation.y = (i / 6) * Math.PI * 2 + (sx > 0 ? 0.3 : 0);
      fan.add(piv);
      const b = add(new THREE.BoxGeometry(0.22, 0.03, 0.11), mats.metal, 0.18, 0, 0, piv);
      b.rotation.x = 0.5 * sx;
    }
  }

  // ---------- Центральная колонна с пузырями ----------
  add(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10), mats.metal, 0, 1.4, 0);
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.86, 10), mats.glass, 0, 1.44 + 0.43, 0);
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), mats.metal, 0, 2.27, 0);
  add(new THREE.IcosahedronGeometry(0.09, 1), mats.glow, 0, 2.31, 0);
  for (let i = 0; i < 3; i++) {
    add(new THREE.IcosahedronGeometry(0.04 + rnd() * 0.015, 0), mats.ice,
      (rnd() - 0.5) * 0.03, 1.6 + i * 0.2, (rnd() - 0.5) * 0.03);
  }

  // ---------- Голубые трубки (сзади) ----------
  const pipeY = 1.6, pz = -0.55;
  for (const sx of [-1, 1]) {
    const px = sx * 0.6;
    add(new THREE.CylinderGeometry(0.05, 0.05, pipeY - 0.1, 8), mats.pipe, px, 0.1 + (pipeY - 0.1) / 2, pz);
    const h = add(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8), mats.pipe, px, pipeY, pz + 0.18);
    h.rotation.x = Math.PI / 2;
    add(new THREE.IcosahedronGeometry(0.075, 0), mats.metal, px, pipeY, pz);
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8), mats.metal, px, 0.13, pz);
  }

  // ---------- Пульт с индикаторами (фронт) ----------
  add(new THREE.BoxGeometry(0.3, 0.35, 0.08), mats.metal, 0.55, 0.1 + 0.175, 0.5);
  for (let i = 0; i < 3; i++) {
    add(new THREE.BoxGeometry(0.06, 0.06, 0.04), mats.glow, 0.47 + i * 0.08, 0.36, 0.55);
  }
  add(new THREE.BoxGeometry(0.2, 0.08, 0.04), mats.ice, 0.55, 0.22, 0.55);

  return root;
}