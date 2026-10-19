// Узел ресурса «Обсидиан» (процедурный, low-poly): каменная основа + глянцевые чёрные сколы
export default function build(THREE) {
  const root = new THREE.Group(); root.name = 'res_obsidian';
  let seed = 77123; const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, metalness: 0.05, ...o });
  const base = M('#3a3434'), acc = M('#1b1424', { roughness: 0.12, metalness: 0.35, emissive: '#3b1d5c', emissiveIntensity: 0.15 });
  const jit = (g, a) => { const p = g.attributes.position, m = new Map(), v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = v.x.toFixed(3) + v.y.toFixed(3) + v.z.toFixed(3); if (!m.has(k)) m.set(k, 1 + rr(-a, a)); v.multiplyScalar(m.get(k)); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; };
  const rock = (r, sx, sy, sz, x, z, mat = base) => { const g = jit(new THREE.DodecahedronGeometry(r, 0), 0.14); g.scale(sx, sy, sz); g.rotateY(rr(0, 6.28)); g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y - 0.03, 0); const m = new THREE.Mesh(g, mat); m.position.set(x, 0, z); root.add(m); return m; };
  rock(0.3, 1.2, 0.5, 1, 0, 0);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + rr(-0.3, 0.3), g = new THREE.ConeGeometry(rr(0.13, 0.2), rr(0.5, 0.95), 4); g.translate(0, g.parameters.height / 2, 0); const m = new THREE.Mesh(g, acc); m.position.set(Math.cos(a) * 0.18, 0.1, Math.sin(a) * 0.18); m.rotation.set(Math.sin(a) * 0.45, rr(0, 3), -Math.cos(a) * 0.45); root.add(m); }
  return root;
}
