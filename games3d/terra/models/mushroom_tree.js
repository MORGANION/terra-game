export default function build(THREE) {
  const root = new THREE.Group();

  // Детерминированный генератор случайных чисел
  let seed = 7331;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const mats = {
    stem: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.85, metalness: 0 }),
    cap: new THREE.MeshStandardMaterial({ color: '#e86a5a', flatShading: true, roughness: 0.7, metalness: 0 }),
    spot: new THREE.MeshStandardMaterial({ color: '#e8e4dc', flatShading: true, roughness: 0.8, metalness: 0 }),
    gill: new THREE.MeshStandardMaterial({
      color: '#6fe3ff', emissive: '#6fe3ff', emissiveIntensity: 0.35,
      flatShading: true, roughness: 0.6, metalness: 0, side: THREE.DoubleSide
    }),
    root: new THREE.MeshStandardMaterial({ color: '#c98a5a', flatShading: true, roughness: 0.9, metalness: 0 }),
    moss: new THREE.MeshStandardMaterial({ color: '#7fa84a', flatShading: true, roughness: 0.9, metalness: 0 }),
  };

  const V2 = (x, y) => new THREE.Vector2(x, y);

  // Ножка: толстая, с расширенным основанием
  const stemProfile = [
    V2(0, 0), V2(0.48, 0), V2(0.42, 0.12), V2(0.33, 0.5),
    V2(0.27, 1.2), V2(0.25, 1.9), V2(0.24, 2.56), V2(0, 2.56)
  ];
  const stem = new THREE.Mesh(new THREE.LatheGeometry(stemProfile, 9), mats.stem);
  root.add(stem);

  // Кольцо-«юбка» на ножке
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.06, 6, 12), mats.stem);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.9;
  root.add(ring);

  // Шляпка (внешняя сторона)
  const capProfile = [
    V2(1.0, 2.3), V2(1.08, 2.42), V2(1.02, 2.66),
    V2(0.8, 2.95), V2(0.45, 3.12), V2(0, 3.17)
  ];
  const cap = new THREE.Mesh(new THREE.LatheGeometry(capProfile, 14), mats.cap);
  root.add(cap);

  // Светящаяся нижняя сторона шляпки (пластинки)
  const gillProfile = [V2(0.23, 2.53), V2(0.6, 2.42), V2(1.0, 2.3)];
  const gills = new THREE.Mesh(new THREE.LatheGeometry(gillProfile, 14), mats.gill);
  root.add(gills);

  // Радиальные светящиеся пластинки-рёбра
  const finGeo = new THREE.BoxGeometry(0.62, 0.08, 0.04);
  const tilt = Math.atan2(0.21, 0.75); // уклон нижней поверхности
  const finCount = 6;
  for (let i = 0; i < finCount; i++) {
    const a = (i / finCount) * Math.PI * 2 + 0.3;
    const fin = new THREE.Mesh(finGeo, mats.gill);
    const r = 0.6;
    fin.position.set(Math.cos(a) * r, 2.39, -Math.sin(a) * r);
    fin.rotation.set(0, a, -tilt);
    root.add(fin);
  }

  // Белые пятна на шляпке
  const spotGeo = new THREE.IcosahedronGeometry(1, 0);
  const profileLerp = (t) => {
    // t в [0..1] по сегментам шляпки от (1.08,2.42) до (0.45,3.12)
    const pts = [capProfile[1], capProfile[2], capProfile[3], capProfile[4]];
    const f = t * (pts.length - 1);
    const i = Math.min(Math.floor(f), pts.length - 2);
    const k = f - i;
    const p0 = pts[i], p1 = pts[i + 1];
    const x = p0.x + (p1.x - p0.x) * k;
    const y = p0.y + (p1.y - p0.y) * k;
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    return { x, y, nx: dy / len, ny: -dx / len };
  };
  const spotData = [
    [0.25, 0.4], [0.55, 1.6], [0.35, 2.8], [0.7, 4.1], [0.45, 5.3]
  ];
  for (const [t0, a0] of spotData) {
    const t = t0 + (rnd() - 0.5) * 0.1;
    const a = a0 + (rnd() - 0.5) * 0.4;
    const p = profileLerp(t);
    const cx = Math.cos(a), cz = Math.sin(a);
    const pos = new THREE.Vector3(cx * p.x, p.y, cz * p.x);
    const n = new THREE.Vector3(cx * p.nx, p.ny, cz * p.nx);
    const s = 0.12 + rnd() * 0.07;
    const spot = new THREE.Mesh(spotGeo, mats.spot);
    spot.scale.set(s, s * (0.85 + rnd() * 0.3), 0.04);
    spot.position.copy(pos).addScaledVector(n, 0.005);
    spot.lookAt(pos.clone().add(n));
    root.add(spot);
  }
  // Верхушечное пятно
  const topSpot = new THREE.Mesh(spotGeo, mats.spot);
  topSpot.scale.set(0.2, 0.04, 0.2);
  topSpot.position.set(0.05, 3.155, -0.04);
  root.add(topSpot);

  // Корни-наплывы у основания
  const rootGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rnd() * 0.6;
    const r = new THREE.Mesh(rootGeo, mats.root);
    r.scale.set(0.34 + rnd() * 0.08, 0.16, 0.2);
    r.position.set(Math.cos(a) * 0.45, 0.07, -Math.sin(a) * 0.45);
    r.rotation.set(0, a, -0.25);
    root.add(r);
  }

  // Мох у основания
  const moss = new THREE.Mesh(rootGeo, mats.moss);
  moss.scale.set(0.22, 0.1, 0.18);
  moss.position.set(0.3, 0.05, 0.36);
  moss.rotation.y = 0.7;
  root.add(moss);

  return root;
}