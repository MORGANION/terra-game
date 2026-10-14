export default function build(THREE) {
  const root = new THREE.Group();

  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.7, metalness: 0.1 }),
    accent: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.6, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.5, metalness: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.6, metalness: 0.4 }),
    glow: new THREE.MeshStandardMaterial({ color: '#6fe3ff', flatShading: true, roughness: 0.4, metalness: 0, emissive: '#6fe3ff', emissiveIntensity: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ color: '#9fd8ff', flatShading: true, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.65, emissive: '#6fe3ff', emissiveIntensity: 0.1 }),
    sand: new THREE.MeshStandardMaterial({ color: '#c98a5a', flatShading: true, roughness: 0.95, metalness: 0 }),
    rust: new THREE.MeshStandardMaterial({ color: '#b4532a', flatShading: true, roughness: 0.85, metalness: 0.2 }),
  };

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  // ---- Arc of the ring, clipped flat at y=0 (center below top so height = 14) ----
  const cy = 1.2;
  const arcShape = (Ro, Ri) => {
    const ao = Math.asin(cy / Ro), ai = Math.asin(cy / Ri);
    const s = new THREE.Shape();
    s.moveTo(Ro * Math.cos(ao), 0);
    s.absarc(0, cy, Ro, -ao, Math.PI + ao, false);
    s.lineTo(-Ri * Math.cos(ai), 0);
    s.absarc(0, cy, Ri, Math.PI + ai, -ai, true);
    s.closePath();
    return s;
  };
  const ringGeo = new THREE.ExtrudeGeometry(arcShape(12.8, 8.3), { depth: 6, bevelEnabled: false, curveSegments: 20 });
  ringGeo.translate(0, 0, -3);
  add(ringGeo, mats.hull, 0, 0, 0);

  const bandGeo = new THREE.ExtrudeGeometry(arcShape(10.8, 10.2), { depth: 6.3, bevelEnabled: false, curveSegments: 20 });
  bandGeo.translate(0, 0, -3.15);
  add(bandGeo, mats.accent, 0, 0, 0);

  // ribs on front/back faces
  const ribGeo = box(4.3, 0.5, 0.25);
  [25, 60, 120, 155].forEach((d) => {
    const a = (d * Math.PI) / 180, r = 10.55;
    [3.12, -3.12].forEach((z) => add(ribGeo, mats.dark, Math.cos(a) * r, cy + Math.sin(a) * r, z, 0, 0, a));
  });

  // dim lights (front)
  const lightGeo = box(0.6, 0.4, 0.12);
  [42, 78, 102, 138].forEach((d) => {
    const a = (d * Math.PI) / 180, r = 11.6;
    add(lightGeo, mats.glow, Math.cos(a) * r, cy + Math.sin(a) * r, 3.04, 0, 0, a);
  });

  // ---- Broken trusses with torn solar panels ----
  const truss = (deg, r0, r1, zc) => {
    const g = new THREE.Group();
    g.position.set(0, cy, zc);
    g.rotation.z = (deg * Math.PI) / 180;
    root.add(g);
    const L = r1 - r0;
    add(box(L, 0.22, 0.22), mats.dark, r0 + L / 2, 0.45, 0, 0, 0, 0, g);
    add(box(L * 0.75, 0.22, 0.22), mats.dark, r0 + (L * 0.75) / 2, -0.45, 0, 0, 0, 0, g);
    add(box(0.15, 0.9, 0.15), mats.metal, r0 + L * 0.33, 0, 0, 0, 0, 0, g);
    add(box(0.15, 0.9, 0.15), mats.metal, r0 + L * 0.66, 0, 0, 0, 0, 0.3, g);
    return g;
  };
  const t1 = truss(40, 12.2, 15.0, 1.5);
  add(box(2.0, 0.08, 3.6), mats.glass, 14.2, 0.6, 0, 0.5, 0, 0.1, t1);
  add(box(2.0, 0.12, 0.12), mats.dark, 14.2, 0.5, 0, 0, 0, 0.1, t1);

  const t2 = truss(140, 12.2, 14.8, -1.5);
  add(box(1.8, 0.08, 3.2), mats.glass, 14.0, 0.55, 0, -0.7, 0, -0.15, t2);
  add(box(1.8, 0.12, 0.12), mats.dark, 14.0, 0.5, 0, 0, 0, -0.15, t2);

  truss(115, 12.2, 13.8, 1.8);
  const t4 = truss(70, 12.2, 13.2, -2.0);
  add(box(1.0, 0.08, 1.6), mats.glass, 12.9, 0.55, 0, 0.9, 0, 0, t4);

  // ---- Central airlock module (opening 3x3 at ground, facing +Z) ----
  add(box(7, 5, 6.6), mats.hull, 0, 2.5, -0.7);               // body z -4..2.6
  add(box(2, 5, 1.4), mats.hull, -2.5, 2.5, 3.3);              // left pillar
  add(box(2, 5, 1.4), mats.hull, 2.5, 2.5, 3.3);               // right pillar
  add(box(3, 2, 1.4), mats.hull, 0, 4, 3.3);                   // lintel (opening 0..3)
  add(box(3, 3, 0.2), mats.dark, 0, 1.5, 2.7);                 // airlock interior
  add(box(3.2, 0.14, 0.1), mats.glow, 0, 3.3, 4.03);           // light strip above door
  add(box(0.3, 3, 0.08), mats.accent, -1.75, 1.5, 4.03);
  add(box(0.3, 3, 0.08), mats.accent, 1.75, 1.5, 4.03);
  add(box(7.1, 0.4, 6.7), mats.accent, 0, 4.6, -0.7);          // roof band
  add(box(1.6, 0.5, 1.6), mats.dark, -1.5, 5.25, -1.5);        // roof vent
  add(box(1.4, 1.2, 0.06), mats.rust, 2.3, 1.2, 4.03);         // rust patch
  // struts tying module to arch
  add(box(0.4, 4.6, 0.4), mats.metal, -2, 7.1, 0);
  add(box(0.4, 4.6, 0.4), mats.metal, 2, 7.1, 0);

  // ---- Ground: sand mounds where arch sinks, debris ----
  const mound = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  add(mound, mats.sand, 11, 0, 0).scale.set(2, 1.4, 4.6);
  add(mound, mats.sand, -11, 0, 0).scale.set(2, 1.6, 4.6);
  add(mound, mats.sand, 0, 0, -3.5).scale.set(4.5, 1.2, 1.4);

  // torn panel lying on ground
  add(box(3, 0.08, 1.2), mats.glass, 6, 0.5, 4.2, 0, 0.2, 0.3);
  add(box(3, 0.12, 0.12), mats.dark, 6, 0.45, 3.6, 0, 0.2, 0.3);

  // debris chunks (deterministic variation)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const chunk = new THREE.DodecahedronGeometry(0.6, 0);
  [[-5.5, 4.0], [4.5, -4.2], [-7.5, -4.0], [8.5, 3.6]].forEach(([x, z]) => {
    const s = 0.7 + rnd() * 0.6;
    const m = add(chunk, rnd() > 0.5 ? mats.hull : mats.metal, x, 0.6 * s * 0.8, z, rnd() * 3, rnd() * 3, rnd() * 3);
    m.scale.set(s, s * 0.8, s);
  });

  return root;
}