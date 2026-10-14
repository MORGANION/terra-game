export default function build(THREE) {
  const root = new THREE.Group();

  const std = (name, color, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color, flatShading: true, roughness: 0.8, metalness: 0.0, ...extra
    });
    m.name = name;
    return m;
  };

  const mats = {
    fur: std('fur', '#e8e4dc'),
    accent: std('accent', '#f08a3c'),
    eye: std('eye', '#2e3238', { roughness: 0.3 }),
    eyeHL: std('eye_highlight', '#e8e4dc', { emissive: '#e8e4dc', emissiveIntensity: 0.6, roughness: 0.2 }),
    pink: std('nose', '#ff7fb0', { roughness: 0.6 })
  };

  const add = (geo, mat, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    return m;
  };

  const sphere = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);

  // Capsule segment between two points
  const up = new THREE.Vector3(0, 1, 0);
  const segment = (a, b, r, mat) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = add(new THREE.CapsuleGeometry(r, Math.max(len, 0.001), 4, 10), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(up, dir.normalize());
    return m;
  };

  // ---------- Legs & feet (короткие, толстенькие) ----------
  for (const s of [-1, 1]) {
    const leg = add(new THREE.CapsuleGeometry(0.065, 0.04, 4, 12), mats.fur);
    leg.position.set(0.075 * s, 0.1, 0);

    const foot = add(sphere(0.07, 14, 10), mats.fur);
    foot.scale.set(1, 0.55, 1.3);
    foot.position.set(0.08 * s, 0.039, 0.03);
  }

  // ---------- Body ----------
  const body = add(sphere(0.15, 18, 14), mats.fur);
  body.scale.set(1, 1.15, 0.9);
  body.position.set(0, 0.3, 0);

  // ---------- Arms ----------
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.12 * s, 0.4, 0.02);
    shoulder.rotation.set(-0.35, 0, 0.35 * s);
    root.add(shoulder);

    const arm = add(new THREE.CapsuleGeometry(0.045, 0.09, 4, 10), mats.fur, shoulder);
    arm.position.y = -0.07;

    const paw = add(sphere(0.05, 12, 10), mats.fur, shoulder);
    paw.position.y = -0.14;
  }

  // ---------- Head (~45% роста) ----------
  const HY = 0.66, HR = 0.19, HSX = 1.15;
  const head = add(sphere(HR, 20, 16), mats.fur);
  head.scale.set(HSX, 1, 1);
  head.position.set(0, HY, 0);

  // Muzzle
  const muzzle = add(sphere(0.065, 14, 10), mats.fur);
  muzzle.scale.set(1.3, 0.8, 0.8);
  muzzle.position.set(0, 0.585, 0.155);

  // Nose
  const nose = add(sphere(0.02, 10, 8), mats.pink);
  nose.scale.set(1.3, 0.9, 0.8);
  nose.position.set(0, 0.61, 0.205);

  // Big eyes with highlights
  for (const s of [-1, 1]) {
    const eye = add(sphere(0.058, 16, 12), mats.eye);
    eye.scale.set(0.9, 1.05, 0.5);
    eye.position.set(0.08 * s, 0.665, 0.168);

    const hl = add(sphere(0.019, 10, 8), mats.eyeHL);
    hl.position.set(0.08 * s + 0.018, 0.69, 0.192);

    const hl2 = add(sphere(0.015, 8, 6), mats.eyeHL);
    hl2.position.set(0.08 * s - 0.02, 0.64, 0.188);

    // Cheek blush
    const cheek = add(sphere(0.03, 10, 8), mats.pink);
    cheek.scale.set(1.2, 0.7, 0.4);
    cheek.position.set(0.14 * s, 0.59, 0.125);
  }

  // Ears with accent tips
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(0.12 * s, 0.77, 0);
    ear.rotation.set(-0.1, 0, -0.3 * s);
    root.add(ear);

    const base = add(new THREE.ConeGeometry(0.07, 0.13, 8), mats.fur, ear);
    base.scale.set(1, 1, 0.6);
    base.position.y = 0.065;

    const tip = add(new THREE.ConeGeometry(0.037, 0.066, 8), mats.accent, ear);
    tip.scale.set(1.04, 1, 0.64);
    tip.position.y = 0.0975;

    const inner = add(new THREE.ConeGeometry(0.038, 0.07, 6), mats.pink, ear);
    inner.scale.set(1, 1, 0.35);
    inner.position.set(0, 0.045, 0.026);
  }

  // ---------- Tail (изгиб вверх, кончик accent) ----------
  const pts = [
    new THREE.Vector3(0, 0.2, -0.1),
    new THREE.Vector3(0.04, 0.17, -0.18),
    new THREE.Vector3(0.09, 0.25, -0.2),
    new THREE.Vector3(0.12, 0.36, -0.18),
    new THREE.Vector3(0.11, 0.46, -0.14)
  ];
  const tr = 0.035;
  for (let i = 0; i < pts.length - 1; i++) {
    const mat = i === pts.length - 2 ? mats.accent : mats.fur;
    segment(pts[i], pts[i + 1], tr, mat);
    if (i > 0) {
      const j = add(sphere(tr, 10, 8), mats.fur);
      j.position.copy(pts[i]);
    }
  }
  const tailTip = add(sphere(tr * 1.1, 10, 8), mats.accent);
  tailTip.position.copy(pts[pts.length - 1]);

  return root;
}