export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'res_cobalt';

  // ---------- materials ----------
  const mats = {
    dark: new THREE.MeshStandardMaterial({
      color: '#2e3238', flatShading: true, roughness: 0.95, metalness: 0.05,
    }),
    cobalt: new THREE.MeshStandardMaterial({
      color: '#3d7bff', flatShading: true, roughness: 0.35, metalness: 0.2,
      emissive: '#3d7bff', emissiveIntensity: 0.3,
    }),
  };

  // ---------- deterministic random ----------
  let seed = 48213;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();

  // ---------- rocks ----------
  // jitter vertices consistently (shared positions get same offset -> no gaps)
  function jitter(geo, amount) {
    const pos = geo.attributes.position;
    const map = new Map();
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const key = `${v.x.toFixed(3)}_${v.y.toFixed(3)}_${v.z.toFixed(3)}`;
      if (!map.has(key)) map.set(key, 1 + rr(-amount, amount));
      v.multiplyScalar(map.get(key));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  function rock(geo, sx, sy, sz, rotY, x, z) {
    jitter(geo, 0.12);
    geo.scale(sx, sy, sz);
    geo.rotateY(rotY);
    geo.computeBoundingBox();
    geo.translate(0, -geo.boundingBox.min.y - 0.02, 0); // slightly sunk into ground
    const m = new THREE.Mesh(geo, mats.dark);
    m.position.set(x, 0, z);
    root.add(m);
    return m;
  }

  // main base rock
  rock(new THREE.IcosahedronGeometry(0.45, 1), 1.05, 0.62, 0.95, rr(0, Math.PI), 0, 0);
  // side rocks
  rock(new THREE.DodecahedronGeometry(0.22, 0), 1.0, 0.7, 1.0, rr(0, Math.PI), 0.35, 0.2);
  rock(new THREE.DodecahedronGeometry(0.2, 0), 1.0, 0.75, 1.1, rr(0, Math.PI), -0.32, -0.25);
  rock(new THREE.IcosahedronGeometry(0.14, 0), 1.1, 0.7, 1.0, rr(0, Math.PI), -0.2, 0.38);

  // ---------- crystals ----------
  const UP = new THREE.Vector3(0, 1, 0);
  function crystal(x, y, z, dx, dy, dz, h, r, segs) {
    const tip = r * 1.7;
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(r, 0),
      new THREE.Vector2(r * 0.85, h - tip),
      new THREE.Vector2(0, h),
    ];
    const geo = new THREE.LatheGeometry(pts, segs || 6);
    const m = new THREE.Mesh(geo, mats.cobalt);
    m.position.set(x, y, z);
    m.quaternion.setFromUnitVectors(UP, new THREE.Vector3(dx, dy, dz).normalize());
    m.rotateY(rr(0, Math.PI * 2));
    const s = rr(0.94, 1.06);
    m.scale.set(s, rr(0.95, 1.05), s);
    root.add(m);
    return m;
  }

  // central cluster on main rock
  crystal( 0.02, 0.35,  0.00,  0.05, 1,  0.05, 0.60, 0.09, 6);
  crystal( 0.15, 0.30,  0.10,  0.5,  1,  0.3,  0.48, 0.07, 6);
  crystal(-0.15, 0.32,  0.05, -0.6,  1,  0.2,  0.50, 0.075, 6);
  crystal( 0.00, 0.28, -0.18,  0.1,  1, -0.6,  0.45, 0.07, 6);
  crystal( 0.05, 0.25,  0.22,  0.15, 1,  0.7,  0.36, 0.06, 5);
  crystal( 0.22, 0.25, -0.15,  0.5,  1, -0.4,  0.34, 0.055, 5);
  crystal(-0.08, 0.30, -0.05, -0.2,  1, -0.3,  0.40, 0.06, 5);
  // crystals on side rocks
  crystal( 0.36, 0.20,  0.20,  0.7,  1,  0.3,  0.28, 0.05, 5);
  crystal(-0.32, 0.18, -0.25, -0.5,  1, -0.5,  0.30, 0.055, 5);
  crystal(-0.20, 0.12,  0.36, -0.3,  1,  0.6,  0.20, 0.04, 5);

  return root;
}