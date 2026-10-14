export default function build(THREE) {
  const root = new THREE.Group();

  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.6, metalness: 0.1 }),
    accent: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.5, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.45, metalness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.7, metalness: 0.4 }),
    glow: new THREE.MeshStandardMaterial({ color: '#6fe3ff', flatShading: true, roughness: 0.3, metalness: 0.0, emissive: '#6fe3ff', emissiveIntensity: 1.4 }),
    sand: new THREE.MeshStandardMaterial({ color: '#c98a5a', flatShading: true, roughness: 0.95, metalness: 0.0 }),
    rust: new THREE.MeshStandardMaterial({ color: '#b4532a', flatShading: true, roughness: 0.9, metalness: 0.1 }),
    steam: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 1.0, metalness: 0.0, transparent: true, opacity: 0.6, depthWrite: false }),
  };

  const add = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };

  const UP = new THREE.Vector3(0, 1, 0);
  const beam = (a, b, w, d, mat) => {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
    root.add(m);
    return m;
  };

  // deterministic random
  let seed = 7331;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // ---------- Tripod ----------
  const legAngles = [Math.PI, Math.PI / 3, -Math.PI / 3]; // back, front-right, front-left
  const footR = 0.72, topR = 0.38, footY = 0.08, topY = 1.98;
  const legPoint = (ang, t) => {
    const r = footR + (topR - footR) * t;
    const y = footY + (topY - footY) * t;
    return new THREE.Vector3(Math.sin(ang) * r, y, Math.cos(ang) * r);
  };

  legAngles.forEach((ang) => {
    const foot = legPoint(ang, 0);
    const top = legPoint(ang, 1);
    // thick main beam
    beam(foot, top, 0.16, 0.16, mats.metal);
    // orange sleeve near the foot
    beam(legPoint(ang, 0.04), legPoint(ang, 0.22), 0.19, 0.19, mats.accent);
    // foot pad
    add(new THREE.CylinderGeometry(0.15, 0.17, 0.08, 8), mats.dark, foot.x, 0.04, foot.z);
  });

  // horizontal braces between legs
  const braceT = 0.42;
  for (let i = 0; i < 3; i++) {
    const a = legPoint(legAngles[i], braceT);
    const b = legPoint(legAngles[(i + 1) % 3], braceT);
    beam(a, b, 0.1, 0.1, mats.dark);
  }

  // ---------- Platform & engine ----------
  add(new THREE.CylinderGeometry(0.48, 0.44, 0.12, 10), mats.dark, 0, 2.0, 0);

  // main engine body ~1 m wide
  add(new THREE.BoxGeometry(1.0, 0.55, 0.8), mats.hull, 0, 2.33, 0);
  // orange band
  add(new THREE.BoxGeometry(1.03, 0.1, 0.83), mats.accent, 0, 2.15, 0);
  // top cap
  add(new THREE.BoxGeometry(0.8, 0.1, 0.6), mats.metal, 0, 2.65, 0);

  // front glow window
  add(new THREE.BoxGeometry(0.42, 0.12, 0.05), mats.glow, 0.12, 2.42, 0.41);
  // pressure gauge
  const gauge = add(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10), mats.metal, -0.3, 2.42, 0.42);
  gauge.rotation.x = Math.PI / 2;
  const gaugeFace = add(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 10), mats.glow, -0.3, 2.42, 0.46);
  gaugeFace.rotation.x = Math.PI / 2;

  // side pressure tanks
  [-1, 1].forEach((s) => {
    const tank = add(new THREE.CylinderGeometry(0.14, 0.14, 0.6, 8), mats.hull, s * 0.57, 2.33, 0);
    tank.rotation.x = Math.PI / 2;
    [-1, 1].forEach((e) => {
      const cap = add(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 8), mats.accent, s * 0.57, 2.33, e * 0.3);
      cap.rotation.x = Math.PI / 2;
    });
  });

  // ---------- Exhaust & steam ----------
  const exX = 0.22, exZ = -0.1;
  add(new THREE.CylinderGeometry(0.09, 0.1, 0.28, 8), mats.dark, exX, 2.84, exZ);
  const rim = add(new THREE.TorusGeometry(0.1, 0.035, 6, 10), mats.accent, exX, 2.97, exZ);
  rim.rotation.x = Math.PI / 2;

  add(new THREE.IcosahedronGeometry(0.13, 0), mats.steam, exX, 3.04, exZ);
  add(new THREE.IcosahedronGeometry(0.09, 0), mats.steam, exX + 0.12, 3.1, exZ + 0.03);
  add(new THREE.IcosahedronGeometry(0.08, 0), mats.steam, exX - 0.1, 3.09, exZ - 0.04);
  add(new THREE.IcosahedronGeometry(0.06, 0), mats.steam, exX + 0.03, 3.13, exZ + 0.09);

  // ---------- Drill ----------
  // gearbox under the platform
  add(new THREE.CylinderGeometry(0.2, 0.17, 0.26, 8), mats.accent, 0, 1.81, 0);
  // shaft
  add(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 8), mats.metal, 0, 0.95, 0);
  // glow ring
  const ring = add(new THREE.TorusGeometry(0.12, 0.04, 6, 10), mats.glow, 0, 1.5, 0);
  ring.rotation.x = Math.PI / 2;

  // auger flights
  [0.42, 0.62, 0.82, 1.02].forEach((y, i) => {
    const f = add(new THREE.CylinderGeometry(0.07, 0.24, 0.14, 7), mats.dark, 0, y, 0);
    f.rotation.y = i * 0.45;
    f.rotation.z = 0.08 * (i % 2 ? 1 : -1);
  });

  // bit tip going into the ground
  const tip = add(new THREE.ConeGeometry(0.13, 0.36, 7), mats.metal, 0, 0.18, 0);
  tip.rotation.x = Math.PI;

  // ---------- Ground: sand mound & hole ----------
  add(new THREE.CylinderGeometry(0.22, 0.42, 0.12, 9), mats.sand, 0, 0.06, 0);
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 9), mats.dark, 0, 0.125, 0);

  // rubble around the hole
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd() * 0.6;
    const r = 0.36 + rnd() * 0.12;
    const s = 0.05 + rnd() * 0.04;
    const rock = add(
      new THREE.DodecahedronGeometry(s, 0),
      rnd() > 0.5 ? mats.sand : mats.rust,
      Math.sin(a) * r, s * 0.7, Math.cos(a) * r
    );
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    rock.scale.set(1, 0.7 + rnd() * 0.3, 1);
  }

  return root;
}