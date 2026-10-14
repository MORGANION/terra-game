export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'alien_relic';

  // --- deterministic RNG ---
  let seed = 7331;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();

  // --- materials ---
  const mats = {
    stone: new THREE.MeshStandardMaterial({ color: '#5b616b', flatShading: true, roughness: 0.95, metalness: 0.05 }),
    obelisk: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 0.85, metalness: 0.15 }),
    ground: new THREE.MeshStandardMaterial({ color: '#2e3238', flatShading: true, roughness: 1.0, metalness: 0.0 }),
    gold: new THREE.MeshStandardMaterial({ color: '#ffcf4a', flatShading: true, roughness: 0.4, metalness: 0.6 }),
    runeCrystal: new THREE.MeshStandardMaterial({ color: '#b86bff', emissive: '#b86bff', emissiveIntensity: 1.6, flatShading: true, roughness: 0.3, metalness: 0.1 }),
    runeGold: new THREE.MeshStandardMaterial({ color: '#ffcf4a', emissive: '#ffcf4a', emissiveIntensity: 1.3, flatShading: true, roughness: 0.3, metalness: 0.2 }),
    beam: new THREE.MeshStandardMaterial({ color: '#b86bff', emissive: '#b86bff', emissiveIntensity: 1.2, flatShading: true, roughness: 0.2, metalness: 0.0, transparent: true, opacity: 0.55 }),
    ice: new THREE.MeshStandardMaterial({ color: '#cfeeff', flatShading: true, roughness: 0.15, metalness: 0.0, transparent: true, opacity: 0.7 }),
  };

  const add = (geo, mat, x, y, z, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // --- ground plate (dark rock slab) ---
  const PLATE_H = 0.12;
  const plate = add(new THREE.CylinderGeometry(0.9, 0.95, PLATE_H, 9), mats.ground, 0, PLATE_H / 2, 0);
  plate.rotation.y = 0.2;

  // --- three stones pedestal ---
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3) + Math.PI / 2 + rr(-0.15, 0.15);
    const r = 0.36;
    const sy = rr(0.8, 0.92);
    const s = add(new THREE.DodecahedronGeometry(0.3, 0), mats.stone,
      Math.cos(a) * r, PLATE_H + 0.3 * sy * 0.82, Math.sin(a) * r);
    s.scale.set(rr(0.95, 1.1), sy, rr(0.85, 1.0));
    s.rotation.set(rr(-0.3, 0.3), rr(0, Math.PI), rr(-0.3, 0.3));
  }

  // glowing ring resting on stones
  const ring = add(new THREE.TorusGeometry(0.22, 0.04, 6, 12), mats.runeCrystal, 0, 0.55, 0);
  ring.rotation.x = Math.PI / 2;

  // energy beam linking pedestal to floating obelisk
  add(new THREE.CylinderGeometry(0.06, 0.08, 0.95, 6, 1, true), mats.beam, 0, PLATE_H + 0.475, 0);

  // --- floating obelisk ---
  const Y0 = 1.0;        // bottom tip
  const Y1 = 1.3;        // body start
  const Y2 = 2.6;        // body end
  const RB = 0.32, RT = 0.22;
  const BODY_H = Y2 - Y1;

  const tipDown = add(new THREE.ConeGeometry(RB, Y1 - Y0, 4), mats.obelisk, 0, (Y0 + Y1) / 2, 0);
  tipDown.rotation.set(Math.PI, Math.PI / 4, 0);

  const body = add(new THREE.CylinderGeometry(RT, RB, BODY_H, 4), mats.obelisk, 0, (Y1 + Y2) / 2, 0);
  body.rotation.y = Math.PI / 4;

  const tipUp = add(new THREE.ConeGeometry(RT, 0.35, 4), mats.obelisk, 0, Y2 + 0.175, 0);
  tipUp.rotation.y = Math.PI / 4;

  // crystal gem at apex
  add(new THREE.OctahedronGeometry(0.08, 0), mats.runeCrystal, 0, Y2 + 0.33, 0);

  // gold bands
  const radiusAt = (y) => RB - (RB - RT) * ((y - Y1) / BODY_H);
  const band = (y) => {
    const r = radiusAt(y);
    const b = add(new THREE.CylinderGeometry(r + 0.02, r + 0.025, 0.08, 4), mats.gold, 0, y, 0);
    b.rotation.y = Math.PI / 4;
  };
  band(Y1 + 0.06);
  band(Y2 - 0.08);

  // --- runes (one extruded mesh per face) ---
  const rect = (x, y, w, h) => {
    const s = new THREE.Shape();
    s.moveTo(x - w / 2, y - h / 2);
    s.lineTo(x + w / 2, y - h / 2);
    s.lineTo(x + w / 2, y + h / 2);
    s.lineTo(x - w / 2, y + h / 2);
    s.closePath();
    return s;
  };
  const diamond = (x, y, sz) => {
    const s = new THREE.Shape();
    s.moveTo(x, y - sz);
    s.lineTo(x + sz, y);
    s.lineTo(x, y + sz);
    s.lineTo(x - sz, y);
    s.closePath();
    return s;
  };
  const T = 0.04; // stroke thickness (>=3 cm)
  const glyphs = [
    // ┬ : bar + top crossbar
    (y, out) => { out.push(rect(0, y - 0.02, T, 0.16), rect(0, y + 0.08, 0.17, T)); },
    // ◆ with side ticks
    (y, out) => { out.push(diamond(0, y, 0.07), rect(-0.11, y, 0.05, T), rect(0.11, y, 0.05, T)); },
    // H
    (y, out) => { out.push(rect(-0.06, y, T, 0.17), rect(0.06, y, T, 0.17), rect(0, y, 0.08, T)); },
    // Г + dot
    (y, out) => { out.push(rect(-0.05, y, T, 0.17), rect(0.01, y + 0.065, 0.1, T), diamond(0.05, y - 0.04, 0.035)); },
    // stacked bars
    (y, out) => { out.push(rect(0, y + 0.06, 0.16, T), rect(0, y, 0.1, T), rect(0, y - 0.06, 0.16, T)); },
  ];

  const RUNE_MID = (Y1 + Y2) / 2 - 0.01;
  const apothem = radiusAt(RUNE_MID) * Math.SQRT1_2;
  const lean = Math.atan(((RB - RT) * Math.SQRT1_2) / BODY_H);
  const ROWS = 4, ROW_H = 0.23;

  for (let f = 0; f < 4; f++) {
    const shapes = [];
    for (let i = 0; i < ROWS; i++) {
      const y = (i - (ROWS - 1) / 2) * ROW_H;
      glyphs[Math.floor(rnd() * glyphs.length)](y, shapes);
    }
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: 0.035, bevelEnabled: false });
    const pivot = new THREE.Group();
    pivot.position.y = RUNE_MID;
    pivot.rotation.y = f * Math.PI / 2;
    root.add(pivot);
    const rune = add(geo, f % 2 === 0 ? mats.runeCrystal : mats.runeGold, 0, 0, apothem - 0.015, pivot);
    rune.rotation.x = -lean;
  }

  // --- ice shards on the slab ---
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3) + Math.PI / 2 + Math.PI / 3 + rr(-0.2, 0.2);
    const h = rr(0.4, 0.6);
    const r = rr(0.62, 0.72);
    const shard = new THREE.Mesh(new THREE.ConeGeometry(rr(0.08, 0.11), h, 5), mats.ice);
    const tilt = rr(0.2, 0.35);
    // pivot at base so the shard stays planted on the slab
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * r, PLATE_H - 0.02, Math.sin(a) * r);
    g.rotation.y = -a;
    g.rotation.z = 0; 
    shard.position.y = h / 2;
    const tiltG = new THREE.Group();
    tiltG.rotation.x = 0;
    tiltG.rotation.z = -tilt; // lean outward (local +X points outward after yaw)
    tiltG.add(shard);
    g.add(tiltG);
    root.add(g);
  }

  return root;
}