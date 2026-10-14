export default function build(THREE) {
  const root = new THREE.Group();

  const mats = {
    trunk: new THREE.MeshStandardMaterial({ color: 0xb4532a, flatShading: true, roughness: 0.9, metalness: 0.0 }),
    trunkDark: new THREE.MeshStandardMaterial({ color: 0x5b616b, flatShading: true, roughness: 0.85, metalness: 0.05 }),
    plant: new THREE.MeshStandardMaterial({ color: 0x5fbf5a, flatShading: true, roughness: 0.8, metalness: 0.0 }),
    plantDark: new THREE.MeshStandardMaterial({ color: 0x2f7f45, flatShading: true, roughness: 0.8, metalness: 0.0 }),
    glow: new THREE.MeshStandardMaterial({
      color: 0x6fe3ff, emissive: 0x6fe3ff, emissiveIntensity: 1.6,
      flatShading: true, roughness: 0.4, metalness: 0.0,
    }),
  };

  // deterministic RNG (mulberry32)
  let seed = 913577;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();

  const UP = new THREE.Vector3(0, 1, 0);
  // cylinder between two points
  function segment(a, b, rA, rB, mat, radial = 6) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(rB, rA, len, radial, 1);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
    root.add(m);
    return m;
  }
  function joint(p, r, mat) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
    m.position.copy(p);
    m.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
    root.add(m);
  }

  // --- curved trunk (diameter ~0.34 -> 0.26) ---
  const P = [
    new THREE.Vector3(0.0, 0.0, 0.0),
    new THREE.Vector3(0.14, 0.85, 0.05),
    new THREE.Vector3(-0.1, 1.65, -0.03),
    new THREE.Vector3(0.0, 2.45, 0.08),
  ];
  const R = [0.17, 0.155, 0.14, 0.13];
  for (let i = 0; i < 3; i++) segment(P[i], P[i + 1], R[i], R[i + 1], mats.trunk);
  joint(P[1], R[1] * 1.08, mats.trunk);
  joint(P[2], R[2] * 1.08, mats.trunk);

  // --- roots touching ground ---
  for (let i = 0; i < 4; i++) {
    const ang = i * (Math.PI / 2) + rr(-0.3, 0.3) + 0.4;
    const reach = rr(0.4, 0.5);
    const a = new THREE.Vector3(0, 0.32, 0);
    const b = new THREE.Vector3(Math.cos(ang) * reach, 0.03, Math.sin(ang) * reach);
    segment(a, b, 0.1, 0.035, mats.trunkDark, 5);
  }

  // --- crown: 4 large angular balls (y 1.7 .. 4.45) ---
  const crown = [
    { c: new THREE.Vector3(0.05, 3.7, -0.05), r: 0.75, mat: mats.plant },
    { c: new THREE.Vector3(0.38, 2.85, 0.2), r: 0.72, mat: mats.plantDark },
    { c: new THREE.Vector3(-0.4, 2.6, -0.15), r: 0.68, mat: mats.plant },
    { c: new THREE.Vector3(-0.05, 2.25, 0.4), r: 0.55, mat: mats.plantDark },
  ];
  for (const b of crown) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(b.r, 1), b.mat);
    m.position.copy(b.c);
    m.rotation.set(rr(0, Math.PI), rr(0, Math.PI), rr(0, Math.PI));
    const s = rr(0.94, 1.0);
    m.scale.set(s, rr(0.95, 1.0), rr(0.94, 1.0));
    root.add(m);
  }

  // --- glowing fruits embedded in crown surface (2 per ball) ---
  for (const b of crown) {
    for (let k = 0; k < 2; k++) {
      const ang = rr(-1.2, 1.2) + (k === 0 ? 0 : Math.PI) + 0.3; // front & back sides
      const dy = rr(-0.35, 0.4);
      const dir = new THREE.Vector3(Math.sin(ang), dy, Math.cos(ang)).normalize();
      const fr = rr(0.12, 0.15);
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(fr, 0), mats.glow);
      f.position.copy(b.c).addScaledVector(dir, b.r * 0.78);
      f.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
      root.add(f);
    }
  }

  return root;
}