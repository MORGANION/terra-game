export default function build(THREE) {
  const root = new THREE.Group();

  const mats = {
    moss: new THREE.MeshStandardMaterial({ color: '#7fa84a', flatShading: true, roughness: 0.85, metalness: 0 }),
    plantDark: new THREE.MeshStandardMaterial({ color: '#2f7f45', flatShading: true, roughness: 0.8, metalness: 0 }),
    glow: new THREE.MeshStandardMaterial({ color: '#6fe3ff', emissive: '#6fe3ff', emissiveIntensity: 1.6, flatShading: true, roughness: 0.4, metalness: 0 }),
  };

  // deterministic seed
  let seed = 7331;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // base mound (hemisphere, sits on y=0)
  const moundGeo = new THREE.SphereGeometry(0.2, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  const mound = new THREE.Mesh(moundGeo, mats.plantDark);
  mound.scale.set(1, 0.75, 1);
  root.add(mound);

  // leaf geometry factory: cone with base at origin, pointing +Y
  const makeLeafGeo = (r, h) => {
    const g = new THREE.ConeGeometry(r, h, 5, 1);
    g.translate(0, h / 2, 0);
    return g;
  };

  const addLeaf = (geo, mat, yaw, tilt, radial, baseY, thick) => {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.order = 'YXZ';
    m.rotation.set(tilt, yaw, 0);
    m.position.set(Math.sin(yaw) * radial, baseY, Math.cos(yaw) * radial);
    m.scale.set(1, 1, thick);
    root.add(m);
  };

  // outer ring: 6 thick spreading leaves
  const outerGeo = makeLeafGeo(0.1, 0.44);
  for (let i = 0; i < 6; i++) {
    const yaw = (i / 6) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const tilt = THREE.MathUtils.degToRad(60 + rand() * 6);
    addLeaf(outerGeo, i % 2 === 0 ? mats.moss : mats.plantDark, yaw, tilt, 0.04, 0.07, 0.55 + rand() * 0.1);
  }

  // inner ring: 3 taller, more upright leaves
  const innerGeo = makeLeafGeo(0.085, 0.58);
  for (let i = 0; i < 3; i++) {
    const yaw = (i / 3) * Math.PI * 2 + Math.PI / 6 + (rand() - 0.5) * 0.3;
    const tilt = THREE.MathUtils.degToRad(18 + rand() * 10);
    addLeaf(innerGeo, mats.plantDark, yaw, tilt, 0.05, 0.1, 0.55);
  }

  // glowing bud in the center, resting on the mound
  const bud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), mats.glow);
  bud.position.set(0, 0.36, 0);
  bud.scale.set(1, 1.6, 1);
  bud.rotation.y = rand() * Math.PI;
  root.add(bud);

  return root;
}