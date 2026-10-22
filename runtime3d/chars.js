// Персонажи из Tripo (GLB со скелетом Mixamo и клипами): загрузка, toon-шейдинг с контуром, аниматор.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = {};
let gradient = null;
function toonGradient() {
  if (gradient) return gradient;
  // 3 ступени света — мягкий cel-shading
  const d = new Uint8Array([90, 170, 255]);
  gradient = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true;
  return gradient;
}

const inPlaceCache = new WeakMap();
function inPlace(clip, scene) {
  if (inPlaceCache.has(clip)) return inPlaceCache.get(clip);
  const c = clip.clone();
  for (const t of c.tracks) {
    if (!t.name.endsWith('.position') || !/hips|root|bone_0\b|pelvis/i.test(t.name)) continue;
    const v = t.values, n = t.times.length; if (n < 2) continue;
    const T = t.times[n - 1] - t.times[0] || 1;
    for (const ax of [0, 2]) {
      // линейный тренд (дрейф) от первого кадра к последнему + выравнивание к стартовой точке
      const a0 = v[ax], a1 = v[(n - 1) * 3 + ax];
      for (let k = 0; k < n; k++) v[k * 3 + ax] -= (a1 - a0) * ((t.times[k] - t.times[0]) / T);
      // и любой оставшийся вынос вперёд — к среднему, чтобы модель не «стояла» сзади своей тени
      const bone = scene.getObjectByName(t.name.replace(/\.position$/, '')), rest = bone ? (ax ? bone.position.z : bone.position.x) : a0;
      let m = 0; for (let k = 0; k < n; k++) m += v[k * 3 + ax]; m /= n;
      for (let k = 0; k < n; k++) v[k * 3 + ax] += rest - m;
    }
  }
  inPlaceCache.set(clip, c); return c;
}

export async function loadCharacter(url) {
  if (!cache[url]) cache[url] = (async () => { let e; for (let i = 0; i < 5; i++) { try { return await loader.loadAsync(url + (i ? '?r=' + i : '')); } catch (x) { e = x; await new Promise(r => setTimeout(r, 500 * (i + 1))); } } throw e; })();
  return cache[url];
}

// Жёсткие части (ранец, баллоны): вершины в зоне/цвета → 100% на одну кость, чтобы не гнулись при анимации.
// rigid: [{ bone: 'Spine2', box: [[x0,y0,z0],[x1,y1,z1]] (в долях bbox меша 0..1), color?: 'mint'|[r,g,b,tol], feather?: 0.02 }]
function rigidify(model, rules) {
  model.traverse(o => {
    if (!o.isSkinnedMesh || o.userData.rigidDone) return; o.userData.rigidDone = true;
    const g = o.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, UV = g.attributes.uv;
    const bones = o.skeleton.bones.map(b => b.name.replace(/^mixamorig:?/, ''));
    g.computeBoundingBox(); const bb = g.boundingBox, sz = new THREE.Vector3().subVectors(bb.max, bb.min);
    let px = null; const img = o.material?.map?.image;
    if (img && rules.some(r => r.color)) { try { const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); px = { d: cx.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height, flip: o.material.map.flipY }; } catch {} }
    const colorAt = i => { if (!px || !UV) return null; const u = UV.getX(i), v = UV.getY(i); const x = Math.min(px.w - 1, Math.max(0, Math.round(u * px.w))), y = Math.min(px.h - 1, Math.max(0, Math.round((px.flip ? 1 - v : v) * px.h))); const k = (y * px.w + x) * 4; return [px.d[k], px.d[k + 1], px.d[k + 2]]; };
    const isColor = (c, want) => { if (!c) return false; const [r, gg, b] = c; if (want === 'mint') return gg > r + 25 && b > r + 5 && gg > 120; const [R, G, B, tol = 40] = want; return Math.abs(r - R) + Math.abs(gg - G) + Math.abs(b - B) < tol * 3; };
    let changed = 0;
    for (const R of rules) {
      const bi = bones.indexOf(R.bone); if (bi < 0) continue;
      const [a, c] = R.box || [[0, 0, 0], [1, 1, 1]];
      const lo = new THREE.Vector3(bb.min.x + a[0] * sz.x, bb.min.y + a[1] * sz.y, bb.min.z + a[2] * sz.z), hi = new THREE.Vector3(bb.min.x + c[0] * sz.x, bb.min.y + c[1] * sz.y, bb.min.z + c[2] * sz.z);
      const pick = new Uint8Array(P.count);
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (x < lo.x || x > hi.x || y < lo.y || y > hi.y || z < lo.z || z > hi.z) continue; if (R.color && !isColor(colorAt(i), R.color)) continue; pick[i] = 1; }
      // швы UV: вершины в той же точке пространства, что и выбранные, тоже берём (иначе ранец «рвётся» по шву)
      const key = i => `${P.getX(i).toFixed(4)},${P.getY(i).toFixed(4)},${P.getZ(i).toFixed(4)}`, set = new Set(); for (let i = 0; i < P.count; i++) if (pick[i]) set.add(key(i));
      for (let i = 0; i < P.count; i++) if (pick[i] || set.has(key(i))) { SI.setXYZW(i, bi, 0, 0, 0); SW.setXYZW(i, 1, 0, 0, 0); changed++; }
    }
    SI.needsUpdate = SW.needsUpdate = true; o.userData.rigidCount = changed;
  });
}

// Стекло визора: тёмно-синие пиксели текстуры в зоне головы → отражение неба (по нормали), френель-кайма и блик.
// visor: { y: доля высоты меша, выше которой голова (0.62) }. Маска головы — атрибут вершин, края визора — по цвету текстуры.
function glassVisor(o, V) {
  const g = o.geometry, P = g.attributes.position;
  // маска — коробка визора в метрах в системе персонажа (после скиннинга в позе привязки): только лицевая часть шлема
  const [lo, hi] = V.box, R = V.root; R.updateMatrixWorld(true); const inv = R.matrixWorld.clone().invert(), T = new THREE.Vector3();
  const head = new Float32Array(P.count); for (let i = 0; i < P.count; i++) { o.getVertexPosition(i, T); T.applyMatrix4(o.matrixWorld).applyMatrix4(inv); head[i] = T.x > lo[0] && T.x < hi[0] && T.y > lo[1] && T.y < hi[1] && T.z > lo[2] && T.z < hi[2] ? 1 : 0; }
  g.setAttribute('aHead', new THREE.BufferAttribute(head, 1));
  const m = o.material;
  // Маска стекла: синие пиксели (b > r) в зоне визора, светлая оболочка исключена.
  // Отражение по направлению R.y: тёмный грунт → тёплый горизонт → красное небо Марса; тонированное тёмное стекло,
  // френель-кайма, широкий мягкий блик + точечный. Комментарии — только здесь: «//» внутри GLSL-строки съест код.
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aHead; varying float vHead;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHead = aHead;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vHead; float gVis;')
      .replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 c = diffuseColor.rgb; gVis = vHead * smoothstep(0.02, 0.12, c.b - c.r) * (1.0 - smoothstep(0.5, 0.7, min(c.r, c.g))); }`)
      .replace('#include <opaque_fragment>', `{ vec3 Nv = normalize(normal), Vv = normalize(vViewPosition);
    float fr = smoothstep(0.35, 0.95, pow(1.0 - clamp(dot(Nv, Vv), 0.0, 1.0), 1.6)) * 0.6;
    vec3 R = reflect(-Vv, Nv); float sky = clamp(R.y * 0.6 + 0.5, 0.0, 1.0);
    vec3 ground = mix(vec3(0.22, 0.08, 0.04), vec3(0.62, 0.26, 0.1), smoothstep(0.1, 0.48, sky));
    vec3 heaven = mix(vec3(1.0, 0.58, 0.32), vec3(0.62, 0.22, 0.14), smoothstep(0.6, 0.95, sky));
    vec3 refl = mix(ground, heaven, smoothstep(0.47, 0.53, sky));
    float sp = pow(max(dot(R, normalize(vec3(-0.45, 0.55, 0.7))), 0.0), 40.0) * 1.6 + pow(max(dot(R, normalize(vec3(-0.3, 0.62, 0.72))), 0.0), 300.0) * 4.0 + pow(max(dot(R, normalize(vec3(0.5, 0.3, 0.8))), 0.0), 10.0) * 0.25;
    vec3 glass = vec3(0.02, 0.05, 0.13) + refl * refl * 0.55 + fr * vec3(0.35, 0.75, 1.0) * 1.4 + vec3(sp) * 1.2;
    outgoingLight = mix(outgoingLight, glass, gVis); }
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'visor';
}

// Экземпляр персонажа: { root, play(name), update(dt) }. height — рост в метрах.
export function makeCharacter(gltf, opts = {}) {
  const { height = 1.6, outline = 0.012, toon = true } = opts;   // + visor: {y} — стеклянный визор шейдером
  const root = new THREE.Group();
  const model = skClone(gltf.scene);
  // Модели «лёжа» (Z-up у четвероногих из Tripo Other-рига) — поднять на ноги
  if (opts.rotX) { const w = new THREE.Group(); w.rotation.set(opts.rotX, 0, 0); const w2 = new THREE.Group(); w2.rotation.y = opts.rotY || 0; w2.add(w); w2.updateMatrixWorld(true); w.add(model); w2.updateMatrixWorld(true); return makeFrom(w2); }
  return makeFrom(model);
  function makeFrom(model) {
  // Нормализовать рост и поставить ступни на 0
  model.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(model, true), h = box.max.y - box.min.y || 1;
  const s = height / h; model.scale.setScalar(s); model.position.y = -box.min.y * s;
  const outlines = [];
  if (opts.rigid) rigidify(model, opts.rigid);
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = opts.shadow !== false; o.receiveShadow = false; o.frustumCulled = false;
    if (toon) {
      const src = o.material;
      o.material = new THREE.MeshToonMaterial({ map: src.map, color: src.color || 0xffffff, gradientMap: toonGradient() });
      if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
    }

    // Контур: копия меша с BackSide, раздутая вдоль нормалей
    if (outline && o.isSkinnedMesh) {
      const om = new THREE.MeshBasicMaterial({ color: '#1b1210', side: THREE.BackSide });
      om.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(objectNormal) * ${(outline / s).toFixed(5)};`); };
      const ol = new THREE.SkinnedMesh(o.geometry, om); ol.bind(o.skeleton, o.bindMatrix); ol.frustumCulled = false; ol.name = 'outline'; ol.castShadow = false; outlines.push(ol);
      o.parent.add(ol);
    }
  });
  // Tripo смотрит в -Z, игра ждёт «лицо» к +Z
  if (opts.flip) model.rotation.y = Math.PI;
  root.add(model);
  if (opts.visor) model.traverse(o => { if (o.isSkinnedMesh && o.name !== 'outline') glassVisor(o, { ...opts.visor, root }); });
  // cut: [[x0,y0,z0],[x1,y1,z1]] в метрах (система персонажа, поза привязки) — убрать треугольники кривого ранца Tripo; вместо него ранец кодом
  if (opts.cut) model.traverse(o => { if (!o.isSkinnedMesh || o.name === 'outline' || !o.geometry.index || o.geometry.userData.cutDone) return;
    const g = o.geometry, n = g.attributes.position.count, inv = root.matrixWorld.clone().invert(), T = new THREE.Vector3(), inb = new Uint8Array(n);
    root.updateMatrixWorld(true); for (let i = 0; i < n; i++) { o.getVertexPosition(i, T); T.applyMatrix4(o.matrixWorld).applyMatrix4(inv); inb[i] = opts.cut.some(([a, c]) => T.x > a[0] && T.x < c[0] && T.y > a[1] && T.y < c[1] && T.z > a[2] && T.z < c[2]) ? 1 : 0; }
    const I = g.index.array, keep = []; for (let t = 0; t < I.length; t += 3) if (!(inb[I[t]] && inb[I[t + 1]] && inb[I[t + 2]])) keep.push(I[t], I[t + 1], I[t + 2]);
    g.setIndex(keep); g.userData.cutDone = true; });
  const mixer = new THREE.AnimationMixer(model);
  // Root motion из Mixamo/Tripo (бёдра уезжают вперёд за цикл и прыгают назад) — движение делает игра,
  // поэтому горизонтальный дрейф корневой кости вычитаем: оставляем только покачивание вокруг среднего.
  const clips = Object.fromEntries(gltf.animations.map(c => [c.name, inPlace(c, gltf.scene)]));
  const actions = {};
  let cur = null;
  const ctl = {
    root, model, mixer, clips: Object.keys(clips), outlines,
    // LOD: дальше lodDist — без контура и без обновления скелета каждый кадр
    lod(far) { if (far === this.far) return; this.far = far; for (const o of outlines) o.visible = !far; },
    has: n => !!clips[n],
    play(name, { fade = 0.2, once = false, speed = 1 } = {}) {
      if (!clips[name]) return;
      const a = actions[name] ||= mixer.clipAction(clips[name]);
      a.timeScale = speed;
      if (cur === a && !once) return;
      a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
      a.enabled = true; a.setEffectiveWeight(1);
      if (cur && cur !== a) a.crossFadeFrom(cur, fade, false); a.play();
      cur = a; ctl.current = name;
    },
    update(dt) { mixer.update(dt); },
  };
  return ctl;
}
}
