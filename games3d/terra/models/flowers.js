export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'flowers';

  const mats = {
    plant: new THREE.MeshStandardMaterial({ color: '#5fbf5a', flatShading: true, roughness: 0.85, metalness: 0 }),
    plant_dark: new THREE.MeshStandardMaterial({ color: '#2f7f45', flatShading: true, roughness: 0.85, metalness: 0 }),
    flower: new THREE.MeshStandardMaterial({ color: '#ff7fb0', flatShading: true, roughness: 0.7, metalness: 0 }),
    gold: new THREE.MeshStandardMaterial({ color: '#ffcf4a', flatShading: true, roughness: 0.6, metalness: 0.05 }),
    crystal: new THREE.MeshStandardMaterial({ color: '#b86bff', flatShading: true, roughness: 0.6, metalness: 0, emissive: '#b86bff', emissiveIntensity: 0.15 }),
    white: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.7, metalness: 0 }),
  };

  // deterministic RNG
  let s = 1337;
  const rnd = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();

  // geometry buckets per material (merged into one mesh each)
  const buckets = { plant: [], plant_dark: [], flower: [], gold: [], crystal: [], white: [] };
  const dummy = new THREE.Object3D();
  const add = (key, geo, pos, rot, scl, order = 'XYZ') => {
    dummy.position.copy(pos);
    dummy.rotation.set(rot.x, rot.y, rot.z, order);
    dummy.scale.set(scl.x, scl.y, scl.z);
    dummy.updateMatrix();
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(dummy.matrix);
    buckets[key].push(g);
  };

  const ONE = new THREE.Vector3(1, 1, 1);
  const colors = ['flower', 'gold', 'crystal', 'white'];
  const COUNT = 10;
  const bases = [];

  for (let i = 0; i < COUNT; i++) {
    // scattered placement within the patch
    const ang = i * 2.39996 + rr(-0.3, 0.3);
    const rad = Math.sqrt((i + 0.5) / COUNT) * 0.38;
    const base = new THREE.Vector3(Math.cos(ang) * rad, 0, Math.sin(ang) * rad * 0.95);
    bases.push(base);

    const h = rr(0.15, 0.31);
    const tilt = new THREE.Euler(rr(-0.18, 0.18), rr(0, Math.PI * 2), rr(-0.18, 0.18));

    // stem (base at y=0)
    const stem = new THREE.CylinderGeometry(0.015, 0.018, h, 3, 1, true);
    stem.translate(0, h / 2, 0);
    add('plant_dark', stem, base, tilt, ONE);

    // head position = top of tilted stem
    const head = new THREE.Vector3(0, h, 0).applyEuler(tilt).add(base);

    // petals: flared 5-sided cup
    const col = colors[(i + Math.floor(rr(0, 4))) % 4];
    const rTop = rr(0.055, 0.075);
    const petals = new THREE.CylinderGeometry(rTop, 0.02, 0.03, 5, 1);
    petals.translate(0, 0.015, 0);
    add(col, petals, head, tilt, ONE);

    // center
    const center = new THREE.ConeGeometry(0.026, 0.03, 4);
    center.translate(0, 0.045, 0);
    add(col === 'gold' ? 'white' : 'gold', center, head, tilt, ONE);
  }

  // leaves lying near ground, rising from stem bases
  const LEAVES = 8;
  for (let i = 0; i < LEAVES; i++) {
    const b = bases[(i * 3 + 1) % COUNT];
    const len = rr(0.12, 0.17);
    const leaf = new THREE.ConeGeometry(0.04, len, 3);
    leaf.translate(0, len / 2, 0);
    const elev = rr(0.25, 0.55);
    const yaw = rr(0, Math.PI * 2);
    add(
      'plant',
      leaf,
      new THREE.Vector3(b.x, 0.012, b.z),
      new THREE.Vector3(0, yaw, -(Math.PI / 2 - elev)),
      new THREE.Vector3(0.35, 1, 1),
      'YXZ'
    );
  }

  // merge each bucket into a single mesh
  for (const key of Object.keys(buckets)) {
    const list = buckets[key];
    if (!list.length) continue;
    let total = 0;
    for (const g of list) total += g.attributes.position.array.length;
    const arr = new Float32Array(total);
    let off = 0;
    for (const g of list) {
      arr.set(g.attributes.position.array, off);
      off += g.attributes.position.array.length;
      g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, mats[key]);
    mesh.name = 'flowers_' + key;
    root.add(mesh);
  }

  return root;
}