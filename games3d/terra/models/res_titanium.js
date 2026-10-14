export default function build(THREE) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);

  const mats = {
    rock: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.85, metalness: 0.15 }),
    rockDark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.8, metalness: 0.2 }),
    plate: new THREE.MeshStandardMaterial({ color: '#c8d0da', flatShading: true, roughness: 0.3, metalness: 0.8 }),
  };

  // deterministic seed (mulberry32)
  let seed = 74213;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();
  const UP = new THREE.Vector3(0, 1, 0);
  const D2R = Math.PI / 180;

  // ---------- rocks (angular boulders) ----------
  const rockDefs = [
    { t: 'd', r: 0.42, s: [1.0, 1.3, 0.9], p: [0.0, 0.0], m: 'rock' },
    { t: 'i', r: 0.30, s: [1.1, 0.8, 1.0], p: [0.30, 0.25], m: 'rockDark' },
    { t: 'd', r: 0.28, s: [1.0, 0.9, 1.2], p: [-0.33, 0.20], m: 'rock' },
    { t: 'i', r: 0.22, s: [1.2, 0.9, 0.9], p: [0.18, -0.36], m: 'rock' },
    { t: 'd', r: 0.20, s: [0.9, 1.0, 1.1], p: [-0.26, -0.30], m: 'rockDark' },
  ];

  const rocks = rockDefs.map((d) => {
    const geo = d.t === 'd' ? new THREE.DodecahedronGeometry(d.r, 0) : new THREE.IcosahedronGeometry(d.r, 0);
    const mesh = new THREE.Mesh(geo, mats[d.m]);
    const ry = rr(0, Math.PI * 2);
    mesh.scale.set(d.s[0], d.s[1], d.s[2]);
    mesh.rotation.set(rr(-0.15, 0.15), ry, rr(-0.15, 0.15));
    const cy = d.r * d.s[1] * 0.8; // slightly embedded in ground
    mesh.position.set(d.p[0], cy, d.p[1]);
    inner.add(mesh);
    return {
      c: new THREE.Vector3(d.p[0], cy, d.p[1]),
      rx: d.r * d.s[0], ry: d.r * d.s[1], rz: d.r * d.s[2], rotY: ry,
    };
  });

  // ellipsoid radius of a rock in given world direction
  const radiusAlong = (rock, dir) => {
    const l = dir.clone().applyAxisAngle(UP, -rock.rotY);
    return 1 / Math.sqrt((l.x / rock.rx) ** 2 + (l.y / rock.ry) ** 2 + (l.z / rock.rz) ** 2);
  };
  const dirFrom = (azDeg, elDeg) => {
    const a = azDeg * D2R, e = elDeg * D2R;
    return new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
  };

  // ---------- silver metal plates ----------
  // kind 'blade': flat plate sticking out of the rock; 'facet': pentagonal plate lying on a face
  const plateDefs = [
    // main rock
    { k: 0, az: 10, el: 55, kind: 'blade', w: 0.22, len: 0.30 },
    { k: 0, az: 120, el: 40, kind: 'blade', w: 0.18, len: 0.26 },
    { k: 0, az: 230, el: 50, kind: 'blade', w: 0.20, len: 0.28 },
    { k: 0, az: 300, el: 75, kind: 'blade', w: 0.16, len: 0.22 },
    { k: 0, az: 60, el: 15, kind: 'facet', w: 0.15 },
    { k: 0, az: 180, el: 10, kind: 'facet', w: 0.14 },
    // rock 1
    { k: 1, az: 40, el: 45, kind: 'blade', w: 0.15, len: 0.20 },
    { k: 1, az: 150, el: 60, kind: 'facet', w: 0.12 },
    // rock 2
    { k: 2, az: 280, el: 50, kind: 'blade', w: 0.14, len: 0.22 },
    { k: 2, az: 0, el: 30, kind: 'facet', w: 0.11 },
    // rock 3
    { k: 3, az: 160, el: 55, kind: 'blade', w: 0.12, len: 0.16 },
    { k: 3, az: 60, el: 25, kind: 'facet', w: 0.09 },
    // rock 4
    { k: 4, az: 220, el: 60, kind: 'blade', w: 0.11, len: 0.15 },
  ];

  const blades = {};
  const facets = {};
  plateDefs.forEach((p) => {
    const rock = rocks[p.k];
    const az = p.az + rr(-10, 10);
    const el = p.el + rr(-8, 8);
    const dir = dirFrom(az, el);
    const R = radiusAlong(rock, dir);
    let mesh;
    if (p.kind === 'blade') {
      const key = p.w.toFixed(2) + '_' + p.len.toFixed(2);
      if (!blades[key]) blades[key] = new THREE.BoxGeometry(p.w, p.len, 0.04);
      mesh = new THREE.Mesh(blades[key], mats.plate);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
      const spin = new THREE.Quaternion().setFromAxisAngle(UP, rr(0, Math.PI));
      mesh.quaternion.copy(q.multiply(spin));
      mesh.position.copy(rock.c).addScaledVector(dir, R * 0.7 + p.len * 0.3);
    } else {
      const key = p.w.toFixed(2);
      if (!facets[key]) facets[key] = new THREE.CylinderGeometry(p.w, p.w * 1.08, 0.04, 5);
      mesh = new THREE.Mesh(facets[key], mats.plate);
      const tilt = new THREE.Vector3(rr(-0.15, 0.15), 0, rr(-0.15, 0.15));
      const n = dir.clone().add(tilt).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(UP, n);
      const spin = new THREE.Quaternion().setFromAxisAngle(UP, rr(0, Math.PI));
      mesh.quaternion.copy(q.multiply(spin));
      mesh.position.copy(rock.c).addScaledVector(dir, R * 0.9);
    }
    inner.add(mesh);
  });

  // ---------- pebbles and loose metal chips on the ground ----------
  const pebbleGeo = new THREE.DodecahedronGeometry(0.07, 0);
  const pebbleGeo2 = new THREE.IcosahedronGeometry(0.06, 0);
  const pebbles = [
    [0.52, 0.0], [-0.08, 0.48], [-0.52, -0.05], [0.45, -0.25], [0.02, -0.55],
  ];
  pebbles.forEach((pp, i) => {
    const m = new THREE.Mesh(i % 2 ? pebbleGeo2 : pebbleGeo, i % 2 ? mats.rockDark : mats.rock);
    const sy = rr(0.6, 0.9);
    m.scale.set(rr(0.9, 1.3), sy, rr(0.9, 1.3));
    m.rotation.set(rr(0, 1), rr(0, 6.28), rr(0, 1));
    m.position.set(pp[0], 0.07 * sy * 0.7, pp[1]);
    inner.add(m);
  });

  const chipGeo = new THREE.CylinderGeometry(0.06, 0.065, 0.035, 5);
  [[0.12, 0.5], [-0.48, 0.32]].forEach((cp) => {
    const m = new THREE.Mesh(chipGeo, mats.plate);
    m.rotation.set(rr(-0.25, 0.25), rr(0, 6.28), rr(-0.25, 0.25));
    m.position.set(cp[0], 0.02, cp[1]);
    inner.add(m);
  });

  // ---------- fit into size [1.3, 1.1, 1.3] ----------
  const box = new THREE.Box3().setFromObject(inner);
  const sx = 1.3 / (box.max.x - box.min.x);
  const sz = 1.3 / (box.max.z - box.min.z);
  const syFit = 1.1 / Math.max(box.max.y, 0.001);
  const k = Math.min(1, sx, sz, syFit);
  inner.scale.setScalar(k);
  inner.position.set(-(box.min.x + box.max.x) * 0.5 * k, 0, -(box.min.z + box.max.z) * 0.5 * k);

  root.name = 'res_titanium';
  return root;
}