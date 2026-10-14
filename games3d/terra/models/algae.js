// Водоросли: пучок лент-листьев со дна, зелёно-бирюзовые, чуть светятся. Растут в воде до появления рыб.
export default function build(THREE) {
  const root = new THREE.Group(); root.name = 'algae';
  const m1 = new THREE.MeshStandardMaterial({ color: '#1f7a3a', flatShading: true, roughness: 0.7, emissive: '#0d3a2a', emissiveIntensity: 0.7, side: THREE.DoubleSide });
  const m2 = new THREE.MeshStandardMaterial({ color: '#7adf5a', flatShading: true, roughness: 0.7, emissive: '#14503a', emissiveIntensity: 0.7, side: THREE.DoubleSide });
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 6; k++) {
    // лента: 4 сегмента, изгиб волной
    const h = 0.7 + r() * 0.9, w = 0.09 + r() * 0.05, seg = 4;
    const pos = [];
    for (let i = 0; i <= seg; i++) { const t = i / seg, x = Math.sin(t * 2.4 + k) * 0.12 * t, ww = w * (1 - t * 0.7); pos.push(x - ww, t * h, 0, x + ww, t * h, 0); }
    const idx = []; for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const leaf = new THREE.Mesh(g, k % 2 ? m1 : m2);
    const a = k / 6 * Math.PI * 2; leaf.position.set(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08); leaf.rotation.y = a + r(); leaf.rotation.z = (r() - 0.5) * 0.4;
    root.add(leaf);
  }
  const base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), m1); base.scale.y = 0.4; root.add(base);
  return root;
}
