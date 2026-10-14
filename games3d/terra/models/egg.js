export default function build(THREE) {
  const root = new THREE.Group();

  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.55, metalness: 0.05 }),
    sand: new THREE.MeshStandardMaterial({ color: '#c98a5a', flatShading: true, roughness: 0.95, metalness: 0.0 }),
    rust: new THREE.MeshStandardMaterial({ color: '#b4532a', flatShading: true, roughness: 0.9, metalness: 0.0 }),
    plant: new THREE.MeshStandardMaterial({ color: '#5fbf5a', flatShading: true, roughness: 0.8, metalness: 0.0 }),
    glow: new THREE.MeshStandardMaterial({ color: '#6fe3ff', emissive: '#6fe3ff', emissiveIntensity: 1.6, flatShading: true, roughness: 0.4, metalness: 0.0 }),
  };

  // deterministic RNG
  let seed = 4242;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // ---------- NEST ----------
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.05, 10), mats.sand);
  base.position.y = 0.025;
  root.add(base);

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.04, 6, 14), mats.sand);
  ring1.rotation.x = Math.PI / 2;
  ring1.position.y = 0.05;
  root.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.033, 6, 14), mats.rust);
  ring2.rotation.x = Math.PI / 2;
  ring2.rotation.z = 0.3;
  ring2.position.y = 0.095;
  root.add(ring2);

  // twigs wrapped around the ring
  const up = new THREE.Vector3(0, 1, 0);
  const twigCount = 14;
  for (let i = 0; i < twigCount; i++) {
    const a = (i / twigCount) * Math.PI * 2 + rnd() * 0.3;
    const len = 0.17 + rnd() * 0.04;
    const r = 0.165 + rnd() * 0.01;
    const y = 0.045 + rnd() * 0.065;
    const tilt = (rnd() - 0.5) * 0.7;
    const dir = new THREE.Vector3(-Math.sin(a), tilt, Math.cos(a)).normalize();
    const twig = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, len, 5),
      i % 2 ? mats.rust : mats.sand
    );
    twig.quaternion.setFromUnitVectors(up, dir);
    twig.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    root.add(twig);
  }

  // a couple of leaves tucked into the nest
  for (let i = 0; i < 2; i++) {
    const a = 0.6 + i * 2.6;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), mats.plant);
    leaf.scale.set(1, 1, 0.4);
    leaf.position.set(Math.cos(a) * 0.17, 0.12, Math.sin(a) * 0.17);
    leaf.rotation.y = -a;
    leaf.rotation.z = (i ? 1 : -1) * 0.9;
    root.add(leaf);
  }

  // ---------- EGG ----------
  const EGG_Y0 = 0.045;
  const EGG_H = 0.52;
  const EGG_R = 0.165;
  const eggR = (t) => {
    const s = Math.sin(Math.PI * t);
    return Math.max(0.0001, EGG_R * Math.pow(s, 0.85) * (1 + 0.16 * (0.45 - t)));
  };

  const pts = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new THREE.Vector2(i === 0 || i === N ? 0 : eggR(t), t * EGG_H));
  }
  const egg = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), mats.hull);
  egg.position.y = EGG_Y0;
  root.add(egg);

  // glowing bands
  [0.36, 0.64].forEach((t, i) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(eggR(t) * 0.99, 0.015, 4, 18), mats.glow);
    band.rotation.x = Math.PI / 2;
    band.rotation.y = i ? 0.12 : -0.1;
    band.position.y = EGG_Y0 + t * EGG_H;
    root.add(band);
  });

  // glowing spots pattern
  const rows = [
    { t: 0.22, n: 4, off: 0.0, s: 0.038 },
    { t: 0.5, n: 5, off: 0.5, s: 0.042 },
    { t: 0.78, n: 3, off: 0.2, s: 0.032 },
  ];
  rows.forEach((row) => {
    for (let k = 0; k < row.n; k++) {
      const a = ((k + row.off) / row.n) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
      const t = row.t + (rnd() - 0.5) * 0.04;
      const rr = eggR(t) * 0.97;
      const pos = new THREE.Vector3(Math.cos(a) * rr, EGG_Y0 + t * EGG_H, Math.sin(a) * rr);
      const spot = new THREE.Mesh(new THREE.SphereGeometry(row.s * (0.85 + rnd() * 0.3), 6, 4), mats.glow);
      spot.position.copy(pos);
      const out = new THREE.Vector3(Math.cos(a), (0.5 - t) * -0.8, Math.sin(a)).normalize();
      spot.lookAt(pos.clone().add(out));
      spot.scale.set(1, 1.3, 0.35);
      root.add(spot);
    }
  });

  // small glowing cap at the top
  const capT = 0.93;
  const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 0), mats.glow);
  cap.position.y = EGG_Y0 + capT * EGG_H;
  cap.scale.set(1, 0.6, 1);
  root.add(cap);

  return root;
}