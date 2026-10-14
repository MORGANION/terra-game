export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'rocks';

  // Shared materials (palette only)
  const mats = {
    sand: new THREE.MeshStandardMaterial({ color: '#c98a5a', flatShading: true, roughness: 0.95, metalness: 0.0 }),
    stone: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.9, metalness: 0.05 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.9, metalness: 0.05 }),
    rust: new THREE.MeshStandardMaterial({ color: '#b4532a', flatShading: true, roughness: 0.92, metalness: 0.0 }),
  };

  // Deterministic PRNG (mulberry32)
  function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = makeRng(1337);

  // Build one stylized rock geometry, sitting on y=0 with a flat base
  function makeRockGeometry(sx, sy, sz, detail, useDodeca) {
    const geo = useDodeca
      ? new THREE.DodecahedronGeometry(1, 0)
      : new THREE.IcosahedronGeometry(1, detail);
    const pos = geo.attributes.position;

    // Consistent jitter for shared corners (geometry is non-indexed)
    const jitter = new Map();
    const v = new THREE.Vector3();
    const cut = -0.55; // flat base cut in unit space

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const key = `${v.x.toFixed(3)}|${v.y.toFixed(3)}|${v.z.toFixed(3)}`;
      if (!jitter.has(key)) jitter.set(key, 0.84 + rand() * 0.28);
      v.multiplyScalar(jitter.get(key));
      if (v.y < cut) v.y = cut; // flatten bottom so rock rests on ground
      pos.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
    }
    pos.needsUpdate = true;

    geo.computeBoundingBox();
    // Sink slightly into the ground (2 cm) so it never floats
    geo.translate(0, -geo.boundingBox.min.y - 0.02, 0);
    geo.computeVertexNormals();
    return geo;
  }

  // Rock layout: x, z, scale x/y/z, material, detail, dodeca
  const rocks = [
    { x: -0.20, z: -0.20, sx: 0.55, sy: 0.32, sz: 0.45, m: 'sand',  d: 1, dod: false }, // main boulder
    { x:  0.45, z:  0.10, sx: 0.35, sy: 0.22, sz: 0.30, m: 'stone', d: 1, dod: false },
    { x: -0.60, z:  0.45, sx: 0.25, sy: 0.15, sz: 0.22, m: 'sand',  d: 0, dod: true  },
    { x:  0.15, z:  0.60, sx: 0.20, sy: 0.12, sz: 0.18, m: 'rust',  d: 0, dod: false },
    { x:  0.65, z: -0.55, sx: 0.22, sy: 0.14, sz: 0.20, m: 'sand',  d: 1, dod: false },
    { x: -0.70, z: -0.60, sx: 0.15, sy: 0.09, sz: 0.14, m: 'dark',  d: 0, dod: true  },
    { x: -0.15, z:  0.50, sx: 0.12, sy: 0.08, sz: 0.11, m: 'stone', d: 0, dod: false },
  ];

  for (const r of rocks) {
    const geo = makeRockGeometry(r.sx, r.sy, r.sz, r.d, r.dod);
    const mesh = new THREE.Mesh(geo, mats[r.m]);
    mesh.position.set(r.x, 0, r.z);
    mesh.rotation.y = rand() * Math.PI * 2;
    // Tiny tilt; the 2 cm ground sink keeps the base in contact
    mesh.rotation.x = (rand() - 0.5) * 0.08;
    mesh.rotation.z = (rand() - 0.5) * 0.08;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  return root;
}