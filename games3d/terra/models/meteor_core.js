export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'meteor_core';

  const mats = {
    scorch: new THREE.MeshStandardMaterial({ color: '#1c1714', flatShading: true, roughness: 0.95, metalness: 0.05 }),
    ember: new THREE.MeshStandardMaterial({ color: '#ff6a1a', emissive: '#ff6a1a', emissiveIntensity: 0.9, flatShading: true, roughness: 0.6, metalness: 0.0 }),
    crystal: new THREE.MeshStandardMaterial({ color: '#b86bff', emissive: '#b86bff', emissiveIntensity: 0.25, flatShading: true, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.8 }),
  };

  // deterministic RNG
  let seed = 1337;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hash3 = (x, y, z) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };

  // ---- main boulder ----
  const AX = 1.05, AY = 0.68, AZ = 1.0, CLAMP = -0.75;
  const rockGeo = new THREE.IcosahedronGeometry(1, 2);
  const pos = rockGeo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const kx = Math.round(v.x * 1000) / 1000, ky = Math.round(v.y * 1000) / 1000, kz = Math.round(v.z * 1000) / 1000;
    const f = 1 + (hash3(kx, ky, kz) - 0.5) * 0.16;
    v.multiplyScalar(f);
    if (v.y < CLAMP) v.y = CLAMP;
    pos.setXYZ(i, v.x * AX, v.y * AY, v.z * AZ);
  }
  rockGeo.computeVertexNormals();
  rockGeo.computeBoundingBox();
  const cy = -rockGeo.boundingBox.min.y; // ellipsoid centre in world Y
  const rock = new THREE.Mesh(rockGeo, mats.scorch);
  rock.position.y = cy;
  root.add(rock);

  // ---- molten puddle at base ----
  const puddle = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.06, 7), mats.ember);
  puddle.position.y = 0.03;
  puddle.rotation.y = 0.3;
  root.add(puddle);

  // ---- fused secondary chunks ----
  const chunkDefs = [
    { a: 0.6, d: 0.82, r: 0.34 },
    { a: 2.7, d: 0.85, r: 0.3 },
    { a: 4.4, d: 0.8, r: 0.36 },
  ];
  chunkDefs.forEach((c) => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(c.r, 0), mats.scorch);
    m.position.set(Math.cos(c.a) * c.d, c.r * 0.6, Math.sin(c.a) * c.d);
    m.scale.set(1, 0.75 + rnd() * 0.15, 1.05);
    m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    root.add(m);
  });

  // ---- glowing cracks (seams sunk into the surface) ----
  const crackGeo = new THREE.BoxGeometry(0.09, 1, 0.22);
  const nrm = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    const theta = (i / 8) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
    const phi = -0.25 + rnd() * 0.85; // elevation
    const dx = Math.cos(phi) * Math.cos(theta), dy = Math.sin(phi), dz = Math.cos(phi) * Math.sin(theta);
    const p = new THREE.Vector3(dx * AX * 0.97, dy * AY * 0.97 + cy, dz * AZ * 0.97);
    nrm.set(dx / AX, dy / AY, dz / AZ).normalize();
    const crack = new THREE.Mesh(crackGeo, mats.ember);
    crack.position.copy(p);
    crack.scale.y = 0.45 + rnd() * 0.35;
    crack.lookAt(p.clone().add(nrm));
    crack.rotateZ(rnd() * Math.PI);
    root.add(crack);
  }

  // ---- crystals grown on top ----
  const surfY = (x, z) => {
    const t = 1 - (x / AX) ** 2 - (z / AZ) ** 2;
    return Math.sqrt(Math.max(t, 0)) * AY + cy;
  };
  const crystalDefs = [
    { x: 0.05, z: -0.05, h: 0.55, r: 0.14, rx: -0.08, rz: 0.06 },
    { x: 0.32, z: 0.15, h: 0.4, r: 0.11, rx: 0.2, rz: -0.35 },
    { x: -0.3, z: 0.2, h: 0.34, r: 0.1, rx: 0.25, rz: 0.4 },
    { x: -0.08, z: -0.36, h: 0.42, r: 0.11, rx: -0.4, rz: 0.1 },
  ];
  crystalDefs.forEach((c) => {
    const g = new THREE.Group();
    const prism = new THREE.Mesh(new THREE.CylinderGeometry(c.r * 0.85, c.r, c.h, 6), mats.crystal);
    prism.position.y = c.h / 2;
    const tipH = c.h * 0.4;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(c.r * 0.85, tipH, 6), mats.crystal);
    tip.position.y = c.h + tipH / 2;
    g.add(prism, tip);
    g.position.set(c.x, surfY(c.x, c.z) - 0.18, c.z);
    g.rotation.set(c.rx, rnd() * Math.PI, c.rz);
    root.add(g);
  });

  return root;
}