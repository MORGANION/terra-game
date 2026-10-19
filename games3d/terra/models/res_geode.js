// Узел ресурса «Кристалл жеоды» (процедурный, low-poly): каменная основа + высокие фиолетовые призмы
export default function build(THREE) {
  const root = new THREE.Group(); root.name = 'res_geode';
  let seed = 61007; const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, metalness: 0.05, ...o });
  const base = M('#2a1834'), acc = M('#b46bff', { roughness: 0.25, emissive: '#8a3dff', emissiveIntensity: 0.55 });
  const jit = (g, a) => { const p = g.attributes.position, m = new Map(), v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = v.x.toFixed(3) + v.y.toFixed(3) + v.z.toFixed(3); if (!m.has(k)) m.set(k, 1 + rr(-a, a)); v.multiplyScalar(m.get(k)); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; };
  const rock = (r, sx, sy, sz, x, z, mat = base) => { const g = jit(new THREE.DodecahedronGeometry(r, 0), 0.14); g.scale(sx, sy, sz); g.rotateY(rr(0, 6.28)); g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y - 0.03, 0); const m = new THREE.Mesh(g, mat); m.position.set(x, 0, z); root.add(m); return m; };
  rock(0.38, 1.2, 0.5, 1, 0, 0);
  const cy = M("#5fe6ff", { roughness: 0.25, emissive: "#2fb8ff", emissiveIntensity: 0.5 });
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28, h = rr(0.6, 1.35), r = rr(0.09, 0.15), g = new THREE.CylinderGeometry(r * 0.2, r, h, 6); g.translate(0, h / 2, 0); const m = new THREE.Mesh(g, i % 3 ? acc : cy); const tilt = i ? 0.45 : 0; m.position.set(Math.cos(a) * (i ? 0.16 : 0), 0.15, Math.sin(a) * (i ? 0.16 : 0)); m.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt); if (!i) m.scale.setScalar(1.4); root.add(m); }
  return root;
}
