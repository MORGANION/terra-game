export default function build(THREE) {
  const root = new THREE.Group();

  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.6, metalness: 0.1 }),
    accent: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.5, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.4, metalness: 0.7 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.5, metalness: 0.6 }),
    glow: new THREE.MeshStandardMaterial({ color: '#6fe3ff', flatShading: true, roughness: 0.3, metalness: 0.0, emissive: '#6fe3ff', emissiveIntensity: 1.4 }),
    glass: new THREE.MeshStandardMaterial({ color: '#9fd8ff', flatShading: true, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    sand: new THREE.MeshStandardMaterial({ color: '#c98a5a', flatShading: true, roughness: 0.95, metalness: 0.0 }),
    plant: new THREE.MeshStandardMaterial({ color: '#5fbf5a', flatShading: true, roughness: 0.8, metalness: 0.0 }),
    plantDark: new THREE.MeshStandardMaterial({ color: '#2f7f45', flatShading: true, roughness: 0.8, metalness: 0.0 }),
    flower: new THREE.MeshStandardMaterial({ color: '#ff7fb0', flatShading: true, roughness: 0.7, metalness: 0.0 }),
  };

  // deterministic RNG
  let seed = 1337;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };

  const BASE_H = 0.2;
  const R = 1.0;       // arch radius (Z)
  const SY = 1.95;     // vertical stretch -> top at 2.15
  const LEN = 2.96;

  // ---- Metal base ----
  add(new THREE.BoxGeometry(LEN, BASE_H, 2.1), mats.metal, 0, BASE_H / 2, 0);
  // orange corner bands
  add(new THREE.BoxGeometry(0.18, BASE_H + 0.01, 2.12), mats.accent, -1.39, BASE_H / 2, 0);
  add(new THREE.BoxGeometry(0.18, BASE_H + 0.01, 2.12), mats.accent, 1.39, BASE_H / 2, 0);
  // front & back glow strips
  add(new THREE.BoxGeometry(2.4, 0.04, 0.03), mats.glow, 0, 0.1, 1.06);
  add(new THREE.BoxGeometry(2.4, 0.04, 0.03), mats.glow, 0, 0.1, -1.06);

  // ---- Glass arch (half cylinder along X) ----
  const archGeo = new THREE.CylinderGeometry(R, R, LEN - 0.04, 16, 1, true, Math.PI, Math.PI);
  archGeo.rotateZ(-Math.PI / 2);
  const arch = add(archGeo, mats.glass, 0, BASE_H, 0);
  arch.scale.set(1, SY, 1);

  // glass end caps (half discs)
  for (const sx of [-1, 1]) {
    const capGeo = new THREE.CylinderGeometry(R, R, 0.02, 16, 1, false, Math.PI, Math.PI);
    capGeo.rotateZ(-Math.PI / 2);
    const cap = add(capGeo, mats.glass, sx * 1.47, BASE_H, 0);
    cap.scale.set(1, SY, 1);
  }

  // ---- Metal ribs ----
  const ribXs = [-1.46, -0.73, 0, 0.73, 1.46];
  for (const x of ribXs) {
    const ribGeo = new THREE.TorusGeometry(R + 0.01, 0.035, 4, 14, Math.PI);
    ribGeo.rotateY(Math.PI / 2);
    const rib = add(ribGeo, mats.dark, x, BASE_H, 0);
    rib.scale.set(1, SY, 1);
  }
  // ridge beam
  add(new THREE.BoxGeometry(LEN, 0.05, 0.08), mats.hull, 0, BASE_H + SY * R + 0.0, 0);

  // ---- Door frame on +X end ----
  add(new THREE.BoxGeometry(0.06, 1.4, 0.07), mats.accent, 1.48, BASE_H + 0.7, 0.38);
  add(new THREE.BoxGeometry(0.06, 1.4, 0.07), mats.accent, 1.48, BASE_H + 0.7, -0.38);
  add(new THREE.BoxGeometry(0.06, 0.08, 0.83), mats.accent, 1.48, BASE_H + 1.4, 0);
  add(new THREE.BoxGeometry(0.04, 0.05, 0.12), mats.dark, 1.5, BASE_H + 0.75, 0.28); // handle

  // ---- Control panel on front ----
  add(new THREE.BoxGeometry(0.4, 0.14, 0.04), mats.hull, 0.85, 0.1, 1.07);
  add(new THREE.BoxGeometry(0.28, 0.07, 0.02), mats.glow, 0.85, 0.11, 1.095);

  // ---- Planter beds ----
  const bedZ = [-0.45, 0.45];
  const PL_H = 0.28;
  const soilTop = BASE_H + PL_H + 0.02;
  for (const z of bedZ) {
    add(new THREE.BoxGeometry(2.4, PL_H, 0.55), mats.hull, 0, BASE_H + PL_H / 2, z);
    add(new THREE.BoxGeometry(2.3, 0.04, 0.47), mats.sand, 0, BASE_H + PL_H, z);
    add(new THREE.BoxGeometry(2.42, 0.04, 0.57), mats.accent, 0, BASE_H + 0.05, z); // bed trim
  }

  // ---- Sprouts ----
  const perBed = 11;
  for (const z of bedZ) {
    for (let i = 0; i < perBed; i++) {
      const x = -1.05 + (2.1 * i) / (perBed - 1) + (rnd() - 0.5) * 0.08;
      const zz = z + (rnd() - 0.5) * 0.22;
      const kind = rnd();
      const s = 0.8 + rnd() * 0.5;
      if (kind < 0.55) {
        // leafy bush sprout
        const h = 0.16 * s;
        const m = add(new THREE.IcosahedronGeometry(0.1 * s, 0), rnd() < 0.5 ? mats.plant : mats.plantDark, x, soilTop + h * 0.45, zz);
        m.scale.set(1, 1.3, 1);
        m.rotation.set(rnd() * 0.4, rnd() * Math.PI, rnd() * 0.4);
      } else if (kind < 0.88) {
        // pointy shoot
        const h = 0.26 * s;
        const m = add(new THREE.ConeGeometry(0.06 * s, h, 5), mats.plant, x, soilTop + h / 2 - 0.01, zz);
        m.rotation.set((rnd() - 0.5) * 0.3, rnd() * Math.PI, (rnd() - 0.5) * 0.3);
      } else {
        // flowering sprout
        const h = 0.2 * s;
        const m = add(new THREE.ConeGeometry(0.06, h, 5), mats.plantDark, x, soilTop + h / 2 - 0.01, zz);
        m.rotation.y = rnd() * Math.PI;
        add(new THREE.DodecahedronGeometry(0.05, 0), mats.flower, x, soilTop + h - 0.01, zz);
      }
    }
  }

  return root;
}