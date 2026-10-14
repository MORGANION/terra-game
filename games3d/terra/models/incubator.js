export default function build(THREE) {
  const root = new THREE.Group();

  const P = {
    hull: '#e8e4dc', accent: '#f08a3c', metal: '#5b616b', dark: '#2e3238',
    glow: '#6fe3ff', glass: '#9fd8ff'
  };

  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: P.hull, flatShading: true, roughness: 0.7, metalness: 0.05 }),
    accent: new THREE.MeshStandardMaterial({ color: P.accent, flatShading: true, roughness: 0.6, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: P.metal, flatShading: true, roughness: 0.5, metalness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: P.dark, flatShading: true, roughness: 0.8, metalness: 0.3 }),
    glow: new THREE.MeshStandardMaterial({
      color: P.glow, flatShading: true, roughness: 0.3, metalness: 0,
      emissive: P.glow, emissiveIntensity: 1.6
    }),
    glass: new THREE.MeshStandardMaterial({
      color: P.glass, flatShading: true, roughness: 0.1, metalness: 0.1,
      transparent: true, opacity: 0.55, depthWrite: false
    })
  };

  const add = (geo, mat, x = 0, y = 0, z = 0, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // --- Base ---
  // Dark plinth on the ground
  add(new THREE.CylinderGeometry(0.68, 0.68, 0.06, 8, 1, false, Math.PI / 8), mats.dark, 0, 0.03, 0);
  // Main hull body of the base
  add(new THREE.CylinderGeometry(0.6, 0.66, 0.19, 8, 1, false, Math.PI / 8), mats.hull, 0, 0.155, 0);
  // Orange band on top of the base
  const band = add(new THREE.TorusGeometry(0.58, 0.035, 4, 16), mats.accent, 0, 0.25, 0);
  band.rotation.x = Math.PI / 2;
  // Metal collar holding the flask
  add(new THREE.CylinderGeometry(0.48, 0.5, 0.13, 12), mats.metal, 0, 0.315, 0);

  // --- Front control panel ---
  const panel = add(new THREE.BoxGeometry(0.38, 0.14, 0.08), mats.dark, 0, 0.15, 0.6);
  panel.rotation.x = -0.15;
  const screen = add(new THREE.BoxGeometry(0.22, 0.07, 0.03), mats.glow, -0.04, 0.155, 0.64);
  screen.rotation.x = -0.15;
  const btnGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8);
  const btn = add(btnGeo, mats.accent, 0.13, 0.155, 0.645);
  btn.rotation.x = Math.PI / 2 - 0.15;

  // --- Inside the flask ---
  // Glowing ring at the bottom
  const ring = add(new THREE.TorusGeometry(0.28, 0.03, 4, 16), mats.glow, 0, 0.4, 0);
  ring.rotation.x = Math.PI / 2;
  // Egg pedestal
  add(new THREE.CylinderGeometry(0.12, 0.18, 0.15, 8), mats.metal, 0, 0.455, 0);
  // Glowing egg
  const egg = add(new THREE.SphereGeometry(1, 12, 10), mats.glow, 0, 0.78, 0);
  egg.scale.set(0.22, 0.3, 0.22);

  // --- Glass capsule ---
  // Capsule: radius 0.4, cylindrical part 0.6 -> total height 1.4
  add(new THREE.CapsuleGeometry(0.4, 0.6, 4, 12), mats.glass, 0, 1.05, 0);

  // --- Vertical struts around the flask ---
  const strutGeo = new THREE.BoxGeometry(0.06, 0.92, 0.06);
  [60, 180, 300].forEach((deg) => {
    const a = THREE.MathUtils.degToRad(deg);
    const s = add(strutGeo, mats.metal, Math.sin(a) * 0.47, 0.84, Math.cos(a) * 0.47);
    s.rotation.y = a;
  });

  // --- Top cap ---
  add(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 12), mats.metal, 0, 1.38, 0);
  const capRing = add(new THREE.TorusGeometry(0.5, 0.03, 4, 16), mats.accent, 0, 1.31, 0);
  capRing.rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.25, 0.46, 0.14, 12), mats.hull, 0, 1.53, 0);

  // --- Lamp ---
  add(new THREE.CylinderGeometry(0.06, 0.08, 0.13, 8), mats.dark, 0, 1.665, 0);
  const lampRing = add(new THREE.TorusGeometry(0.1, 0.03, 4, 12), mats.accent, 0, 1.73, 0);
  lampRing.rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(0.1, 10, 8), mats.glow, 0, 1.79, 0);

  // --- Side pipes (mirrored left and right) ---
  const pipeR = 0.035;
  const makePipe = (mirror) => {
    const g = new THREE.Group();
    g.position.z = -0.15;
    if (mirror) g.scale.x = -1;
    // Vertical section from base top to the elbow
    add(new THREE.CylinderGeometry(pipeR, pipeR, 1.0, 8), mats.metal, 0.58, 0.75, 0, g);
    // Elbow (quarter torus) bending into the cap
    add(new THREE.TorusGeometry(0.08, pipeR, 6, 6, Math.PI / 2), mats.metal, 0.5, 1.25, 0, g);
    // Flange where the pipe enters the cap
    const fl = add(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 8), mats.dark, 0.51, 1.33, 0, g);
    fl.rotation.z = Math.PI / 2;
    // Orange couplings
    const cGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8);
    add(cGeo, mats.accent, 0.58, 0.55, 0, g);
    add(cGeo, mats.accent, 0.58, 0.95, 0, g);
    // Support foot where the pipe meets the base
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), mats.dark, 0.58, 0.27, 0, g);
    root.add(g);
  };
  makePipe(false);
  makePipe(true);

  return root;
}