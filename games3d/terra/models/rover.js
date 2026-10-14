// Процедурная заглушка марсохода (до прихода GLB из Tripo): корпус, 6 колёс, сиденье, кузов
export default function build(THREE) {
  const root = new THREE.Group();
  const m = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8 });
  const hull = m('#efe3cc'), red = m('#b5532f'), dark = m('#2f2a28'), mint = m('#5cd6a8');
  const box = (w, h, d, mat, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); root.add(b); return b; };
  box(1.7, 0.35, 2.6, hull, 0, 0.75, 0);
  box(1.72, 0.12, 2.62, red, 0, 0.95, 0);
  box(1.2, 0.5, 0.5, hull, 0, 1.15, -0.2);          // спинка сиденья
  box(1.1, 0.12, 0.7, dark, 0, 0.98, 0.25);         // сиденье
  box(1.5, 0.45, 0.06, m('#9fd8e8'), 0, 1.25, 0.95); // стекло
  box(1.4, 0.35, 0.8, hull, 0, 1.1, -0.95);          // кузов
  box(0.5, 0.35, 0.5, red, 0.2, 1.4, -0.95);         // ящик
  const ant = box(0.05, 0.8, 0.05, dark, -0.6, 1.5, -1.1); const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mint); tip.position.y = 0.42; ant.add(tip);
  for (const sx of [-1, 1]) box(0.22, 0.16, 0.06, m('#fff6c0'), sx * 0.5, 0.85, 1.32);
  const wheelG = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10); wheelG.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) for (const z of [-0.95, 0, 0.95]) { const w = new THREE.Mesh(wheelG, dark); w.position.set(sx * 1.0, 0.38, z); w.name = 'wheel'; root.add(w); }
  return root;
}
