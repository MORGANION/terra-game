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

// Экземпляр персонажа: { root, play(name), update(dt) }. height — рост в метрах.
export function makeCharacter(gltf, opts = {}) {
  const { height = 1.6, outline = 0.012, toon = true } = opts;
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
