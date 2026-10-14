export default function build(THREE) {
  const root = new THREE.Group();

  const mk = (color, roughness = 0.8, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness, metalness, ...extra });

  const mats = {
    fabric: mk('#c98a5a', 0.9),
    accent: mk('#f08a3c', 0.85, 0, { side: THREE.DoubleSide }),
    rust: mk('#b4532a', 0.85, 0, { side: THREE.DoubleSide }),
    flower: mk('#ff7fb0', 0.85, 0, { side: THREE.DoubleSide }),
    hull: mk('#e8e4dc', 0.85),
    dark: mk('#2e3238', 0.95),
    wood: mk('#b4532a', 0.9),
    metal: mk('#5b616b', 0.5, 0.6),
    basket: mk('#c98a5a', 0.95),
    glow: mk('#6fe3ff', 0.3, 0, { emissive: '#6fe3ff', emissiveIntensity: 1.6 }),
  };

  const V3 = THREE.Vector3;
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // deterministic seed
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // ---- Main cone ----
  const H = 2.5, R = 1.35;
  const tilt = Math.atan(R / H); // surface lean
  const rAt = (y) => R * (1 - y / H);
  add(new THREE.ConeGeometry(R, H, 10), mats.fabric, 0, H / 2, 0);

  // ---- Ornament bands (gap at entrance, +Z) ----
  const gap = 0.42;
  const band = (y0, h, mat) => {
    const y1 = y0 + h;
    const g = new THREE.CylinderGeometry(
      rAt(y1) * 1.025 + 0.01, rAt(y0) * 1.025 + 0.01, h, 10, 1, true,
      gap, Math.PI * 2 - gap * 2
    );
    add(g, mat, 0, y0 + h / 2, 0);
  };
  band(0.0, 0.14, mats.rust);
  band(0.28, 0.12, mats.accent);
  band(0.95, 0.14, mats.rust);
  band(1.55, 0.12, mats.flower);
  band(2.05, 0.1, mats.accent);

  // ---- Diamond ornaments ----
  const diamond = (a, y, s, mat) => {
    const pivot = new THREE.Group();
    pivot.rotation.y = a;
    root.add(pivot);
    const d = add(new THREE.BoxGeometry(s, s, 0.04), mat, 0, y, rAt(y) + 0.02, pivot);
    d.rotation.set(-tilt, 0, Math.PI / 4);
  };
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + Math.PI / 9;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.6) continue;
    diamond(a, 0.65, 0.17, i % 2 ? mats.flower : mats.hull);
    diamond(a + Math.PI / 9, 1.3, 0.12, mats.accent);
  }

  // ---- Entrance (dark opening) ----
  const tri = (pts) => {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false });
  };
  const onSurface = (a, geo, mat, out = 0.01) => {
    const pivot = new THREE.Group();
    pivot.rotation.y = a;
    root.add(pivot);
    const m = add(geo, mat, 0, 0.005, R + out, pivot);
    m.rotation.x = -tilt;
    return m;
  };
  onSurface(0, tri([[-0.42, 0], [0.42, 0], [0, 1.25]]), mats.dark, 0.005);

  // ---- Folded-back flaps ----
  onSurface(-0.4, tri([[0.22, 0], [-0.22, 0], [0.22, 1.1]]), mats.accent, 0.03);
  onSurface(0.4, tri([[-0.22, 0], [0.22, 0], [-0.22, 1.1]]), mats.accent, 0.03);
  // ties holding flaps
  const tieL = onSurface(-0.4, new THREE.BoxGeometry(0.06, 0.06, 0.05), mats.hull, 0.06);
  tieL.position.y = 0.45;
  const tieR = onSurface(0.4, new THREE.BoxGeometry(0.06, 0.06, 0.05), mats.hull, 0.06);
  tieR.position.y = 0.45;

  // ---- Wooden poles poking out the top ----
  const stick = (a, b, r, mat) => {
    const d = new V3().subVectors(b, a);
    const len = d.length();
    const m = add(new THREE.CylinderGeometry(r, r * 1.15, len, 6), mat);
    m.position.addVectors(a, b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
    return m;
  };
  const apex = new V3(0, H, 0);
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    const base = new V3(Math.sin(a) * 1.37, 0, Math.cos(a) * 1.37);
    const dir = new V3().subVectors(apex, base).normalize();
    const ext = 0.5 + rnd() * 0.15;
    const top = apex.clone().addScaledVector(dir, ext);
    stick(base, top, 0.045, mats.wood);
  }
  // binding wrap at apex
  add(new THREE.CylinderGeometry(0.1, 0.13, 0.16, 8), mats.rust, 0, H - 0.05, 0);
  add(new THREE.TorusGeometry(0.11, 0.035, 5, 10), mats.flower, 0, H + 0.04, 0).rotation.x = Math.PI / 2;

  // ---- Glow lantern stake by the entrance ----
  const lx = -0.95, lz = 1.2;
  add(new THREE.CylinderGeometry(0.035, 0.05, 0.75, 6), mats.metal, lx, 0.375, lz);
  add(new THREE.CylinderGeometry(0.09, 0.07, 0.05, 6), mats.dark, lx, 0.77, lz);
  add(new THREE.IcosahedronGeometry(0.09, 0), mats.glow, lx, 0.87, lz);
  add(new THREE.ConeGeometry(0.1, 0.1, 6), mats.accent, lx, 1.0, lz);

  // ---- Basket ----
  const bx = 1.0, bz = 1.25;
  const prof = [
    new THREE.Vector2(0.0, 0),
    new THREE.Vector2(0.16, 0),
    new THREE.Vector2(0.21, 0.08),
    new THREE.Vector2(0.23, 0.22),
    new THREE.Vector2(0.2, 0.22),
    new THREE.Vector2(0.18, 0.06),
    new THREE.Vector2(0.0, 0.06),
  ];
  add(new THREE.LatheGeometry(prof, 10), mats.basket, bx, 0, bz);
  add(new THREE.CylinderGeometry(0.225, 0.205, 0.05, 10), mats.rust, bx, 0.11, bz);
  const rim = add(new THREE.TorusGeometry(0.215, 0.03, 5, 12), mats.wood, bx, 0.22, bz);
  rim.rotation.x = Math.PI / 2;
  const handle = add(new THREE.TorusGeometry(0.2, 0.025, 5, 10, Math.PI), mats.wood, bx, 0.22, bz);
  handle.rotation.y = 0.6;
  // yarn balls / fruits inside
  const ballMats = [mats.flower, mats.accent, mats.hull];
  const ballPos = [[-0.07, 0.03], [0.08, -0.02], [0.0, 0.09]];
  ballPos.forEach(([dx, dz], i) => {
    const s = 0.085 + rnd() * 0.02;
    const b = add(new THREE.IcosahedronGeometry(s, 0), ballMats[i], bx + dx, 0.2 + rnd() * 0.03, bz + dz);
    b.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
  });

  return root;
}