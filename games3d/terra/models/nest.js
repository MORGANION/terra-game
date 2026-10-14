export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'nest';

  // ---------- детерминированный рандом ----------
  let seed = 1337;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();

  // ---------- материалы ----------
  const M = (color, roughness = 0.85, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness, metalness, ...extra });
  const mats = {
    hull: M('#e8e4dc', 0.95),
    accent: M('#f08a3c', 0.6),
    metal: M('#5b616b', 0.5, 0.6),
    dark: M('#2e3238', 1.0),
    glow: M('#6fe3ff', 0.3, 0, { emissive: '#6fe3ff', emissiveIntensity: 1.6 }),
    sand: M('#c98a5a', 0.9),
    rust: M('#b4532a', 0.9),
    plant: M('#5fbf5a', 0.95),
    plantDark: M('#2f7f45', 0.95),
    flower: M('#ff7fb0', 0.7),
  };

  const add = (geo, mat, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    return m;
  };

  // ---------- параметры купола ----------
  const R = 0.78;          // радиус купола по XZ
  const H = 0.62;          // высота купола
  const BASE_Y = 0.02;
  const SY = H / R;

  // оболочка (масштаб по Y делает купол низким)
  const shell = new THREE.Group();
  shell.position.y = BASE_Y;
  shell.scale.set(1, SY, 1);
  root.add(shell);

  // сам купол
  add(new THREE.SphereGeometry(R, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.sand, shell);

  // горизонтальные кольца прутьев с разрывом под вход (+Z)
  const ringArc = (radius, tube, gap, mat, y, parent) => {
    const g = new THREE.TorusGeometry(radius, tube, 4, 24, Math.PI * 2 - gap);
    const m = add(g, mat, parent);
    m.rotation.set(Math.PI / 2, 0, Math.PI / 2 + gap / 2);
    m.position.y = y;
    return m;
  };
  [0.3, 0.72, 1.12].forEach((phi, i) => {
    ringArc(R * Math.cos(phi) + 0.012, 0.028, i < 2 ? 0.95 : 0.0001,
      i % 2 ? mats.rust : mats.sand, R * Math.sin(phi), shell);
  });

  // меридиональные прутья (дуги от земли к макушке), без фронтального сектора
  const meridianCount = 10;
  for (let i = 0; i < meridianCount; i++) {
    const a = (i / meridianCount) * Math.PI * 2 + rr(-0.12, 0.12);
    // направление +X после поворота: (cos a, 0, -sin a); фронт (+Z) при a≈-π/2
    const dir = new THREE.Vector2(Math.cos(a), -Math.sin(a));
    if (dir.y > 0.8) continue; // пропускаем вход
    const g = new THREE.TorusGeometry(R + 0.012, rr(0.022, 0.03), 4, 8, Math.PI / 2);
    const m = add(g, i % 3 === 0 ? mats.sand : mats.rust, shell);
    m.rotation.order = 'YXZ';
    m.rotation.set(rr(-0.1, 0.1), a, 0);
  }

  // нижнее толстое кольцо-основание (с разрывом у входа)
  ringArc(0.8, 0.075, 0.82, mats.rust, 0.075, root);

  // ---------- вход ----------
  const archShapeU = (ro, ri, hStraight) => {
    const s = new THREE.Shape();
    s.moveTo(-ro, 0);
    s.lineTo(-ro, hStraight);
    s.absarc(0, hStraight, ro, Math.PI, 0, true);
    s.lineTo(ro, 0);
    s.lineTo(ri, 0);
    s.lineTo(ri, hStraight);
    s.absarc(0, hStraight, ri, 0, Math.PI, false);
    s.lineTo(-ri, 0);
    return s;
  };
  const archShape = (r, hStraight) => {
    const s = new THREE.Shape();
    s.moveTo(-r, 0);
    s.lineTo(-r, hStraight);
    s.absarc(0, hStraight, r, Math.PI, 0, true);
    s.lineTo(r, 0);
    s.lineTo(-r, 0);
    return s;
  };
  // козырёк-арка из прутьев
  const hood = add(new THREE.ExtrudeGeometry(archShapeU(0.3, 0.22, 0.16),
    { depth: 0.36, bevelEnabled: false, curveSegments: 5 }), mats.sand);
  hood.position.z = 0.48;
  // обод арки спереди
  const rim = add(new THREE.TorusGeometry(0.26, 0.035, 4, 10, Math.PI), mats.rust);
  rim.position.set(0, 0.16, 0.845);
  // тёмный проём
  const hole = add(new THREE.ExtrudeGeometry(archShape(0.23, 0.16),
    { depth: 0.04, bevelEnabled: false, curveSegments: 5 }), mats.dark);
  hole.position.z = 0.76;

  // мягкая подстилка, выглядывающая из входа
  const fluff1 = add(new THREE.IcosahedronGeometry(0.17, 1), mats.hull);
  fluff1.scale.set(1.15, 0.32, 0.5);
  fluff1.position.set(0, 0.03, 0.79);
  const fluff2 = add(new THREE.IcosahedronGeometry(0.1, 1), mats.hull);
  fluff2.scale.set(1, 0.55, 0.8);
  fluff2.position.set(0.09, 0.05, 0.77);
  const petal = add(new THREE.IcosahedronGeometry(0.05, 0), mats.flower);
  petal.scale.set(1, 0.6, 1);
  petal.position.set(-0.1, 0.07, 0.8);

  // фонарик на козырьке (голубой свет)
  const lampBase = add(new THREE.CylinderGeometry(0.05, 0.06, 0.04, 8), mats.metal);
  lampBase.position.set(0, 0.47, 0.74);
  const lamp = add(new THREE.SphereGeometry(0.055, 8, 6), mats.glow);
  lamp.position.set(0, 0.53, 0.74);
  const lampCap = add(new THREE.ConeGeometry(0.065, 0.06, 8), mats.metal);
  lampCap.position.set(0, 0.6, 0.74);

  // ---------- утилиты размещения на куполе ----------
  const up = new THREE.Vector3(0, 1, 0);
  const onDome = (theta, phi, lift = 0) => {
    const x = R * Math.cos(phi) * Math.sin(theta);
    const y = H * Math.sin(phi);
    const z = R * Math.cos(phi) * Math.cos(theta);
    const n = new THREE.Vector3(x / (R * R), y / (H * H), z / (R * R)).normalize();
    const p = new THREE.Vector3(x, y + BASE_Y, z).addScaledVector(n, lift);
    return { p, n };
  };
  const orient = (mesh, n) => mesh.quaternion.setFromUnitVectors(up, n);

  // ---------- мох ----------
  const moss = [
    [0, 1.45, 0.2], [0.9, 1.0, 0.17], [2.1, 0.95, 0.19], [-1.0, 0.85, 0.16],
    [-2.4, 0.6, 0.18], [2.9, 0.4, 0.15], [1.6, 0.35, 0.14], [-1.7, 0.3, 0.15],
  ];
  const mossPts = [];
  moss.forEach(([t, ph, r], i) => {
    const { p, n } = onDome(t + rr(-0.15, 0.15), ph, 0);
    const m = add(new THREE.DodecahedronGeometry(r, 0), i % 2 ? mats.plantDark : mats.plant);
    m.scale.set(rr(1.0, 1.3), rr(0.3, 0.4), rr(0.9, 1.2));
    orient(m, n);
    m.rotateY(rr(0, Math.PI));
    m.position.copy(p);
    mossPts.push({ p, n, r });
  });
  // верхушка не выше 0.7
  // цветочки на мху
  [0, 2, 4, 5].forEach((idx) => {
    const { p, n, r } = mossPts[idx];
    const f = add(new THREE.IcosahedronGeometry(0.04, 0), mats.flower);
    const side = new THREE.Vector3(rr(-1, 1), 0, rr(-1, 1)).normalize().multiplyScalar(r * 0.4);
    f.position.copy(p).add(side).addScaledVector(n, r * 0.3);
    if (f.position.y > 0.67) f.position.y = 0.67;
  });

  // ---------- металлическая заплатка (sci-fi хлам в стене) ----------
  {
    const { p, n } = onDome(2.3, 0.45, 0.0);
    const plate = add(new THREE.BoxGeometry(0.3, 0.035, 0.22), mats.metal);
    orient(plate, n);
    plate.rotateY(0.3);
    plate.position.copy(p);
    const stripe = add(new THREE.BoxGeometry(0.3, 0.04, 0.05), mats.accent);
    stripe.quaternion.copy(plate.quaternion);
    stripe.position.copy(p).addScaledVector(n, 0.005);
  }
  {
    const { p, n } = onDome(-2.0, 0.6, 0.0);
    const plate = add(new THREE.BoxGeometry(0.2, 0.035, 0.18), mats.hull);
    orient(plate, n);
    plate.rotateY(-0.4);
    plate.position.copy(p);
  }

  // ---------- светящиеся грибочки у основания ----------
  const shrooms = [[-0.64, 0.48, 0.2], [0.7, -0.4, 0.16], [-0.25, -0.8, 0.18]];
  shrooms.forEach(([x, z, h]) => {
    const stem = add(new THREE.CylinderGeometry(0.022, 0.03, h, 6), mats.hull);
    stem.position.set(x, h / 2, z);
    stem.rotation.set(rr(-0.15, 0.15), 0, rr(-0.15, 0.15));
    const cap = add(new THREE.SphereGeometry(0.065, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mats.glow);
    cap.scale.set(1, 0.7, 1);
    cap.position.set(x, h - 0.01, z);
  });

  // пучки травы-мха у основания
  [[0.42, 0.72], [-0.45, 0.7], [0.82, 0.15], [-0.8, -0.2]].forEach(([x, z], i) => {
    const g = add(new THREE.DodecahedronGeometry(0.1, 0), i % 2 ? mats.plant : mats.plantDark);
    g.scale.set(rr(0.9, 1.1), rr(0.5, 0.7), rr(0.9, 1.1));
    g.rotation.y = rr(0, Math.PI);
    g.position.set(x, 0.04, z);
  });

  return root;
}