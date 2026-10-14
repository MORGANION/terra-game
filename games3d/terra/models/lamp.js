export default function build(THREE) {
  const root = new THREE.Group();

  const mats = {
    metal: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.45, metalness: 0.7 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.6, metalness: 0.4 }),
    accent: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.55, metalness: 0.1 }),
    hull: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.6, metalness: 0.05 }),
    glow: new THREE.MeshStandardMaterial({
      color: '#6fe3ff', emissive: '#6fe3ff', emissiveIntensity: 1.0,
      flatShading: true, roughness: 0.3, metalness: 0.0
    })
  };

  // --- Tripod legs (3 meshes) ---
  const hubY = 0.45;
  const topR = 0.04;
  const footR = 0.21;
  const legRadius = 0.035;
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2; // one leg towards +Z
    const top = new THREE.Vector3(Math.cos(a) * topR, hubY, Math.sin(a) * topR);
    const bottom = new THREE.Vector3(Math.cos(a) * footR, 0.0, Math.sin(a) * footR);
    const dir = new THREE.Vector3().subVectors(top, bottom);
    const len = dir.length();
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(legRadius * 0.8, legRadius, len, 6), mats.metal);
    leg.position.copy(bottom).add(top).multiplyScalar(0.5);
    leg.quaternion.setFromUnitVectors(up, dir.normalize());
    root.add(leg);
  }

  // --- Hub joining legs ---
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 6), mats.dark);
  hub.position.y = hubY;
  root.add(hub);

  // --- Central pole ---
  const poleBottom = hubY;
  const poleTop = 1.3;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, poleTop - poleBottom, 6), mats.metal);
  pole.position.y = (poleTop + poleBottom) / 2;
  root.add(pole);

  // --- Orange carry grip on pole ---
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.14, 6), mats.accent);
  grip.position.y = 0.95;
  root.add(grip);

  // --- Lamp cup holder ---
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.055, 0.08, 8), mats.accent);
  cup.position.y = poleTop + 0.04;
  root.add(cup);

  // --- Glowing lamp sphere ---
  const glowR = 0.12;
  const glowY = 1.44;
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(glowR, 1), mats.glow);
  bulb.position.y = glowY;
  root.add(bulb);

  // --- Top cap ---
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.045, 8), mats.hull);
  cap.position.y = glowY + glowR - 0.005 + 0.0225; // top ≈ 1.58
  root.add(cap);

  return root;
}