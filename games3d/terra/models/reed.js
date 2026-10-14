export default function build(THREE) {
  const root = new THREE.Group();
  root.name = 'reed';

  // Материалы (переиспользуются)
  const mats = {
    reed: new THREE.MeshStandardMaterial({ color: '#9bbf5a', flatShading: true, roughness: 0.85, metalness: 0.0 }),
    plant: new THREE.MeshStandardMaterial({ color: '#5fbf5a', flatShading: true, roughness: 0.85, metalness: 0.0 }),
    plantDark: new THREE.MeshStandardMaterial({ color: '#2f7f45', flatShading: true, roughness: 0.9, metalness: 0.0 }),
    cattail: new THREE.MeshStandardMaterial({ color: '#b4532a', flatShading: true, roughness: 0.95, metalness: 0.0 }),
  };

  // Детерминированный генератор случайных чисел
  let seed = 0x5eed17;
  const rand = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (a, b) => a + (b - a) * rand();

  // Кочка у основания: 1 меш, 36 треугольников
  const moundGeo = new THREE.DodecahedronGeometry(0.17, 0);
  const mound = new THREE.Mesh(moundGeo, mats.plantDark);
  mound.scale.set(1.15, 0.35, 1.0);
  mound.rotation.y = 0.4;
  mound.position.y = 0;
  root.add(mound);

  // Общая геометрия стебля: конус, основание в y=0, высота 1 (масштабируется)
  // 4 сегмента → 12 треугольников
  const stalkGeo = new THREE.ConeGeometry(1, 1, 4, 1);
  stalkGeo.translate(0, 0.5, 0);

  // Геометрия початка: 5 сегментов → 20 треугольников
  const cattailGeo = new THREE.CylinderGeometry(0.04, 0.036, 0.2, 5, 1);

  const count = 8;
  const withCattail = new Set([0, 3, 6]);
  const stalkMats = [mats.reed, mats.plant, mats.reed, mats.plantDark];

  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();

    // Положение основания внутри кочки
    const ang = (i / count) * Math.PI * 2 + range(-0.3, 0.3);
    const rad = range(0.03, 0.13);
    g.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);

    // Наклон наружу (небольшой), чтобы пучок раскрывался веером
    const tilt = range(0.05, 0.16);
    g.rotation.order = 'YXZ';
    g.rotation.y = -ang + Math.PI / 2;
    g.rotation.x = tilt;

    const hasCat = withCattail.has(i);
    const h = hasCat ? range(1.15, 1.36) : range(0.7, 1.2);
    const r = range(0.03, 0.04);

    const stalk = new THREE.Mesh(stalkGeo, stalkMats[i % stalkMats.length]);
    stalk.scale.set(r, h, r);
    stalk.rotation.y = range(0, Math.PI);
    g.add(stalk);

    if (hasCat) {
      // Початок насажен на стебель, тонкий кончик выходит выше
      const cat = new THREE.Mesh(cattailGeo, mats.cattail);
      cat.position.y = h * range(0.72, 0.78);
      cat.rotation.y = range(0, Math.PI);
      g.add(cat);
    }

    root.add(g);
  }

  // Итого: 1 + 8 + 3 = 12 мешей, ~36 + 96 + 60 = 192 треугольника
  return root;
}