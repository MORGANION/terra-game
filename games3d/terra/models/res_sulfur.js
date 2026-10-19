// Узел ресурса «Сера» (процедурный, low-poly): каменная основа + жёлтые кристаллические корки
export default function build(THREE) {
  const root = new THREE.Group(); root.name = 'res_sulfur';
  let seed = 51821; const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, metalness: 0.05, ...o });
  const base = M('#2b2626'), acc = M('#f2d23c', { roughness: 0.5, emissive: '#c9a000', emissiveIntensity: 0.18 });
  const jit = (g, a) => { const p = g.attributes.position, m = new Map(), v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = v.x.toFixed(3) + v.y.toFixed(3) + v.z.toFixed(3); if (!m.has(k)) m.set(k, 1 + rr(-a, a)); v.multiplyScalar(m.get(k)); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; };
  const rock = (r, sx, sy, sz, x, z, mat = base) => { const g = jit(new THREE.DodecahedronGeometry(r, 0), 0.14); g.scale(sx, sy, sz); g.rotateY(rr(0, 6.28)); g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y - 0.03, 0); const m = new THREE.Mesh(g, mat); m.position.set(x, 0, z); root.add(m); return m; };
  rock(0.42, 1.2, 0.6, 1.0, 0, 0); rock(0.24, 1, 0.7, 1, 0.42, 0.2); rock(0.2, 1, 0.8, 1, -0.38, -0.25);
  for (let i = 0; i < 9; i++) { const a = rr(0, 6.28), d = rr(0.05, 0.42), g = new THREE.OctahedronGeometry(rr(0.09, 0.17), 0); g.scale(1, rr(0.6, 1.1), 1); const m = new THREE.Mesh(g, acc); m.position.set(Math.cos(a) * d, rr(0.22, 0.38), Math.sin(a) * d); m.rotation.set(rr(0, 1), rr(0, 6), rr(0, 1)); root.add(m); }
  return root;
}
