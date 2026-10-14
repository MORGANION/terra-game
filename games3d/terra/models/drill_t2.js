export default function build(THREE) {
  const root = new THREE.Group();
  root.name = "drill_t2";

  const M = (color, o = {}) =>
    new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.6, metalness: 0.1 }, o));
  const mats = {
    hull: M("#e8e4dc", { roughness: 0.55 }),
    accent: M("#f08a3c", { roughness: 0.5 }),
    metal: M("#5b616b", { roughness: 0.45, metalness: 0.5 }),
    dark: M("#2e3238", { roughness: 0.7, metalness: 0.3 }),
    glow: M("#6fe3ff", { emissive: "#6fe3ff", emissiveIntensity: 1.6, roughness: 0.3 }),
    steam: M("#cfeeff", { transparent: true, opacity: 0.6, roughness: 0.9 }),
    sand: M("#c98a5a", { roughness: 0.95 }),
    rust: M("#b4532a", { roughness: 0.85 }),
  };

  const add = (geo, mat, x = 0, y = 0, z = 0, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // beam between two points
  const up = new THREE.Vector3(0, 1, 0);
  const beam = (a, b, r, mat, seg = 6, parent = root) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const d = new THREE.Vector3().subVectors(B, A);
    const len = d.length();
    const m = add(new THREE.CylinderGeometry(r, r, len, seg), mat, 0, 0, 0, parent);
    m.position.copy(A).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(up, d.normalize());
    return m;
  };

  // leg geometry: from foot (r=0.95, y=0.12) to top (r=0.38, y=2.85)
  const legR = (y) => 0.95 - 0.57 * ((y - 0.12) / 2.73);
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];

  // feet pads + legs
  corners.forEach(([sx, sz]) => {
    add(new THREE.CylinderGeometry(0.18, 0.2, 0.12, 8), mats.dark, sx * 0.95, 0.06, sz * 0.95);
    beam([sx * 0.95, 0.12, sz * 0.95], [sx * 0.38, 2.86, sz * 0.38], 0.08, mats.hull, 6);
  });

  // ground frame + brace rings
  const ring = (y, r, rad, mat) => {
    const R = legR(y);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      beam([ax * R, y, az * R], [bx * R, y, bz * R], rad, mat, 6);
    }
  };
  // ground frame
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    beam([ax * 0.95, 0.08, az * 0.95], [bx * 0.95, 0.08, bz * 0.95], 0.06, mats.metal, 6);
  }
  ring(1.0, 0, 0.055, mats.metal);
  ring(2.3, 0, 0.05, mats.accent);

  // mid deck
  const deckR = legR(1.45);
  add(new THREE.BoxGeometry(deckR * 2 + 0.04, 0.1, deckR * 2 + 0.04), mats.accent, 0, 1.45, 0);

  // motor housing
  add(new THREE.BoxGeometry(0.9, 0.65, 0.9), mats.hull, 0, 1.825, 0);
  add(new THREE.BoxGeometry(0.6, 0.22, 0.06), mats.accent, 0, 1.95, 0.46);
  add(new THREE.BoxGeometry(0.5, 0.06, 0.05), mats.glow, 0, 1.68, 0.47);
  add(new THREE.BoxGeometry(0.06, 0.5, 0.7), mats.metal, 0.47, 1.825, 0.05);
  add(new THREE.BoxGeometry(0.06, 0.5, 0.7), mats.metal, -0.47, 1.825, 0.05);

  // crown block
  add(new THREE.BoxGeometry(0.9, 0.3, 0.9), mats.accent, 0, 2.98, 0);
  add(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 8), mats.glow, 0.28, 3.19, 0.28);
  const sheave = add(new THREE.TorusGeometry(0.18, 0.05, 6, 12), mats.metal, -0.1, 3.25, 0);
  sheave.rotation.y = Math.PI / 2;

  // rotating drill (group for animation)
  const drill = new THREE.Group();
  drill.name = "drill";
  root.add(drill);
  add(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 8), mats.metal, 0, 1.76, 0, drill);
  add(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 8), mats.dark, 0, 0.67, 0, drill);
  const bit = add(new THREE.ConeGeometry(0.3, 0.6, 8), mats.metal, 0, 0.3, 0, drill);
  bit.rotation.x = Math.PI;
  [[0.47, 0.235], [0.31, 0.155], [0.16, 0.08]].forEach(([y, r], i) => {
    const t = add(new THREE.TorusGeometry(r, 0.04, 4, 10), mats.rust, 0, y, 0, drill);
    t.rotation.x = Math.PI / 2 + 0.18;
    t.rotation.z = i * 1.1;
  });
  const gr = add(new THREE.TorusGeometry(0.15, 0.035, 6, 12), mats.glow, 0, 1.4, 0, drill);
  gr.rotation.x = Math.PI / 2;

  // borehole
  add(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 12), mats.dark, 0, 0.01, 0);
  const mound = add(new THREE.TorusGeometry(0.56, 0.13, 5, 12), mats.sand, 0, 0.03, 0);
  mound.rotation.x = Math.PI / 2;
  mound.scale.set(1, 1, 0.4);
  const hg = add(new THREE.TorusGeometry(0.43, 0.03, 4, 16), mats.glow, 0, 0.05, 0);
  hg.rotation.x = Math.PI / 2;

  // exhaust pipes with steam
  const puffSets = [
    [[0, 3.12, 0, 0.14], [0.04, 3.28, -0.03, 0.17], [-0.03, 3.44, 0.02, 0.14]],
    [[0, 3.12, 0, 0.13], [-0.05, 3.27, 0.03, 0.16], [0.02, 3.43, -0.02, 0.15]],
  ];
  [1, -1].forEach((s, k) => {
    const px = s * 0.68, pz = -0.25;
    beam([s * 0.44, 1.95, pz], [px, 1.95, pz], 0.08, mats.dark, 8);
    add(new THREE.SphereGeometry(0.1, 8, 6), mats.dark, px, 1.95, pz);
    beam([px, 1.95, pz], [px, 2.95, pz], 0.08, mats.dark, 8);
    add(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 8), mats.accent, px, 2.98, pz);
    puffSets[k].forEach(([dx, y, dz, r], i) => {
      const p = add(new THREE.IcosahedronGeometry(r, 1), mats.steam, px + dx * s, y, pz + dz);
      p.rotation.set(i * 0.7 + k, i * 1.3, 0);
    });
  });

  // debris rocks (deterministic)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.57 + 0.6 + rnd() * 0.5;
    const d = 0.62 + rnd() * 0.15;
    const r = 0.06 + rnd() * 0.04;
    const rock = add(new THREE.DodecahedronGeometry(r, 0), i % 2 ? mats.sand : mats.rust,
      Math.cos(a) * d, r * 0.6, Math.sin(a) * d);
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    rock.scale.set(1 + rnd() * 0.3, 0.7 + rnd() * 0.2, 1);
  }

  return root;
}