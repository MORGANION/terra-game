// Узел ресурса «Магнетит» (процедурный, low-poly): каменная основа + кубические кристаллы с металлическим блеском
export default function build(THREE) {
  const root = new THREE.Group(); root.name = 'res_magnetite';
  let seed = 90211; const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, metalness: 0.05, ...o });
  const base = M('#3a2a2e'), acc = M('#5a6070', { roughness: 0.3, metalness: 0.75 });
  const jit = (g, a) => { const p = g.attributes.position, m = new Map(), v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = v.x.toFixed(3) + v.y.toFixed(3) + v.z.toFixed(3); if (!m.has(k)) m.set(k, 1 + rr(-a, a)); v.multiplyScalar(m.get(k)); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; };
  const rock = (r, sx, sy, sz, x, z, mat = base) => { const g = jit(new THREE.DodecahedronGeometry(r, 0), 0.14); g.scale(sx, sy, sz); g.rotateY(rr(0, 6.28)); g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y - 0.03, 0); const m = new THREE.Mesh(g, mat); m.position.set(x, 0, z); root.add(m); return m; };
  rock(0.4, 1.2, 0.55, 1.1, 0, 0); rock(0.22, 1, 0.8, 1, -0.4, 0.2);
  for (let i = 0; i < 8; i++) { const s = rr(0.12, 0.24), m = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), acc), a = rr(0, 6.28), d = rr(0, 0.4); m.position.set(Math.cos(a) * d, rr(0.25, 0.4), Math.sin(a) * d); m.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3)); root.add(m); }
  const rust = M("#a4502a"); for (let i = 0; i < 3; i++) rock(0.1, 1, 0.5, 1, rr(-0.4, 0.4), rr(-0.4, 0.4), rust);
  return root;
}
