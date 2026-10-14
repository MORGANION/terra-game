export default function build(THREE) {
  const root = new THREE.Group();

  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.7, metalness: 0.1 }),
    accent: new THREE.MeshStandardMaterial({ color: '#f08a3c', flatShading: true, roughness: 0.6, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.5, metalness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.8, metalness: 0.3 }),
    hotFin: new THREE.MeshStandardMaterial({
      color: '#b4532a', flatShading: true, roughness: 0.5, metalness: 0.3,
      emissive: '#f08a3c', emissiveIntensity: 0.75,
    }),
    hotGlow: new THREE.MeshStandardMaterial({
      color: '#f08a3c', flatShading: true, roughness: 0.4, metalness: 0.0,
      emissive: '#f08a3c', emissiveIntensity: 1.6,
    }),
  };

  const HEX_ROT = Math.PI / 6; // flat face toward +Z

  function hex(rTop, rBot, h, yBottom, mat) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 6), mat);
    m.position.y = yBottom + h / 2;
    m.rotation.y = HEX_ROT;
    root.add(m);
    return m;
  }

  // --- Base plinth ---
  hex(0.5, 0.52, 0.15, 0, mats.dark);

  // --- Main tapered hex body (wider at top) ---
  const bodyY0 = 0.15, bodyH = 1.3, rBot = 0.42, rTop = 0.55;
  hex(rTop, rBot, bodyH, bodyY0, mats.hull);

  // Orange stripe at the foot of the body
  hex(0.45, 0.44, 0.12, 0.15, mats.accent);

  // Face geometry helpers
  const cos30 = Math.cos(Math.PI / 6);
  const radiusAt = (y) => rBot + ((y - bodyY0) / bodyH) * (rTop - rBot);
  const apothemAt = (y) => radiusAt(y) * cos30;
  const tilt = Math.atan(((rTop - rBot) * cos30) / bodyH);

  // --- Hot radiator fins on 5 faces, glowing grille on front face ---
  const finH = 1.0, finY = 0.9, finDepth = 0.16, finW = 0.06;
  const finGeo = new THREE.BoxGeometry(finW, finH, finDepth);
  const apoMid = apothemAt(finY);

  for (let k = 0; k < 6; k++) {
    const face = new THREE.Group();
    face.rotation.y = k * (Math.PI / 3); // k=0 -> +Z (front)
    root.add(face);

    if (k === 0) {
      // Front: dark recessed grille with glowing hot slats
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.85, 0.05), mats.dark);
      plate.position.set(0, finY, apoMid + 0.01);
      plate.rotation.x = tilt;
      face.add(plate);
      const slatGeo = new THREE.BoxGeometry(0.28, 0.07, 0.05);
      for (let i = 0; i < 4; i++) {
        const dy = -0.28 + i * 0.185;
        const slat = new THREE.Mesh(slatGeo, mats.hotGlow);
        slat.position.set(0, finY + dy, apoMid + 0.035 + dy * Math.tan(tilt));
        slat.rotation.x = tilt;
        face.add(slat);
      }
    } else {
      for (const off of [-0.12, 0.12]) {
        const fin = new THREE.Mesh(finGeo, mats.hotFin);
        fin.position.set(off, finY, apoMid + finDepth / 2 - 0.02);
        fin.rotation.x = tilt;
        face.add(fin);
      }
    }
  }

  // --- Top collar ---
  const collarY = bodyY0 + bodyH; // 1.45
  hex(0.6, 0.58, 0.12, collarY, mats.metal);

  // --- Glowing core chamber ---
  const chamberY0 = collarY + 0.12; // 1.57
  const chamberY1 = 1.98;

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.1, 6), mats.metal);
  pedestal.position.y = chamberY0 + 0.05;
  pedestal.rotation.y = HEX_ROT;
  root.add(pedestal);

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.29, 1), mats.hotGlow);
  core.position.y = 1.79;
  root.add(core);

  // Cage posts at hex vertices
  const postH = chamberY1 - chamberY0;
  const postGeo = new THREE.BoxGeometry(0.08, postH, 0.08);
  for (let k = 0; k < 6; k++) {
    const a = HEX_ROT + k * (Math.PI / 3);
    const post = new THREE.Mesh(postGeo, mats.dark);
    post.position.set(Math.sin(a) * 0.5, chamberY0 + postH / 2, Math.cos(a) * 0.5);
    post.rotation.y = a;
    root.add(post);
  }

  // --- Top cap ---
  hex(0.3, 0.58, 0.14, chamberY1, mats.hull);

  // Exhaust vent with hot glow
  const ventY0 = chamberY1 + 0.14; // 2.12
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.07, 6), mats.dark);
  vent.position.y = ventY0 + 0.035;
  vent.rotation.y = HEX_ROT;
  root.add(vent);

  const ventGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 6), mats.hotGlow);
  ventGlow.position.y = 2.19;
  ventGlow.rotation.y = HEX_ROT;
  root.add(ventGlow);

  return root;
}