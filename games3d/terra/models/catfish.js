export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'catfish';

  const mats = {
    fur: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.85, metalness: 0.0 }),
    accent: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.8, metalness: 0.0 }),
    eye: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.3, metalness: 0.1 }),
    shine: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#6fe3ff', emissiveIntensity: 0.6, flatShading: true, roughness: 0.2, metalness: 0.0 }),
    nose: new THREE.MeshStandardMaterial({ color: '#ff7fb0', flatShading: true, roughness: 0.6, metalness: 0.0 }),
    whisker: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.7, metalness: 0.0 }),
  };
  mats.fur.name = 'fur';
  mats.accent.name = 'accent';
  mats.eye.name = 'eye';
  mats.shine.name = 'eye_shine';
  mats.nose.name = 'nose';
  mats.whisker.name = 'whisker';

  const sphere = new THREE.SphereGeometry(1, 12, 9);
  const sphereLo = new THREE.SphereGeometry(1, 8, 6);

  function add(geo, mat, pos, scale, rot, name) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (name) m.name = name;
    root.add(m);
    return m;
  }

  // --- Тело: пухлый шарик
  add(sphere, mats.fur, [0, 0.15, 0.01], [0.15, 0.13, 0.15], null, 'body');
  // Брюшко-подпалина
  add(sphere, mats.accent, [0, 0.11, 0.045], [0.11, 0.08, 0.1], null, 'belly');
  // Щёчки
  add(sphereLo, mats.fur, [0.075, 0.13, 0.115], [0.055, 0.045, 0.045], null, 'cheekR');
  add(sphereLo, mats.fur, [-0.075, 0.13, 0.115], [0.055, 0.045, 0.045], null, 'cheekL');

  // --- Ушки
  const earGeo = new THREE.ConeGeometry(0.045, 0.085, 5);
  const earInGeo = new THREE.ConeGeometry(0.026, 0.055, 5);
  [1, -1].forEach((s) => {
    add(earGeo, mats.fur, [s * 0.075, 0.295, 0.03], null, [0, 0, -s * 0.3], 'ear');
    add(earInGeo, mats.accent, [s * 0.079, 0.29, 0.05], null, [0.15, 0, -s * 0.3], 'earInner');
  });

  // --- Глаза (большие, тёмные, с бликом)
  [1, -1].forEach((s) => {
    add(sphereLo, mats.eye, [s * 0.058, 0.18, 0.138], [0.036, 0.04, 0.03], null, 'eye');
    add(sphereLo, mats.shine, [s * 0.066, 0.194, 0.163], [0.012, 0.012, 0.008], null, 'eyeShine');
  });

  // --- Носик
  add(sphereLo, mats.nose, [0, 0.148, 0.162], [0.018, 0.013, 0.012], null, 'nose');

  // --- Усы
  const whiskerGeo = new THREE.BoxGeometry(0.11, 0.016, 0.016);
  [1, -1].forEach((s) => {
    add(whiskerGeo, mats.whisker, [s * 0.15, 0.145, 0.12], null, [0, s * 0.25, s * 0.12], 'whisker');
    add(whiskerGeo, mats.whisker, [s * 0.15, 0.12, 0.118], null, [0, s * 0.25, -s * 0.12], 'whisker');
  });

  // --- Грудные плавники-«крылышки»
  [1, -1].forEach((s) => {
    add(sphere, mats.fur, [s * 0.225, 0.13, 0.0], [0.11, 0.022, 0.06], [0, s * 0.15, s * 0.25], 'pecFin');
    add(sphereLo, mats.accent, [s * 0.305, 0.152, -0.012], [0.042, 0.022, 0.045], [0, s * 0.15, s * 0.25], 'pecFinTip');
  });

  // --- Брюшные плавнички (касаются y=0)
  [1, -1].forEach((s) => {
    add(sphereLo, mats.fur, [s * 0.055, 0.035, -0.01], [0.025, 0.035, 0.04], null, 'pelvicFin');
  });

  // --- Спинной плавник
  const dorsalGeo = new THREE.ConeGeometry(0.045, 0.06, 6);
  add(dorsalGeo, mats.accent, [0, 0.285, -0.075], [0.35, 1, 1], [-0.5, 0, 0], 'dorsalFin');

  // --- Хвост: стебель + раздвоенный плавник
  const stemGeo = new THREE.ConeGeometry(0.06, 0.06, 8);
  add(stemGeo, mats.fur, [0, 0.15, -0.135], null, [Math.PI / 2, 0, 0], 'tailStem');
  const finGeo = new THREE.ConeGeometry(0.06, 0.07, 6);
  add(finGeo, mats.accent, [0, 0.175, -0.14], [0.3, 1, 1], [Math.PI / 2 + 0.55, 0, 0], 'tailFinTop');
  add(finGeo, mats.accent, [0, 0.125, -0.14], [0.3, 1, 1], [Math.PI / 2 - 0.55, 0, 0], 'tailFinBottom');

  // --- Пятнышки на спинке (детерминированный seed)
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const spots = [
    [0.07, 0.255, -0.02],
    [-0.085, 0.24, -0.05],
    [0.02, 0.27, 0.03],
  ];
  spots.forEach((p) => {
    const r = 0.022 + rnd() * 0.01;
    add(sphereLo, mats.accent, p, [r, r * 0.6, r], [rnd() * 0.5, rnd() * 3, 0], 'spot');
  });

  return root;
}