// Мир из данных: террейн (высоты + фичи), раскраска по стадии, вода, небо, туман, облака, дождь, ледяные стены, буря.
import * as THREE from 'three';
import { makeNoise } from './noise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = t => Math.max(0, Math.min(1, t));
const smooth = t => t * t * (3 - 2 * t);
function segDist(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1;
  const t = clamp01(((px - x1) * dx + (pz - z1) * dz) / l2);
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

export class World {
  constructor(scene, cfg) {
    this.scene = scene;
    this.cfg = cfg;
    this.W = cfg.world;
    this.noise = makeNoise(this.W.seed);
    this.size = this.W.size;
    this.half = this.size / 2;
    this.buildHeightField();
    this.buildTerrain();
    this.buildWater();
    this.buildSky();
    this.buildWeather();
    this.gateObjects = [];
  }

  // ---------- Высоты ----------
  rawHeight(x, z) {
    const h = this.W.height, n = this.noise;
    let y = n.fbm(x * h.base_freq, z * h.base_freq, h.octaves) * h.base_amp;
    const r = 1 - Math.abs(n.simplex(x * h.base_freq * 0.7 + 31, z * h.base_freq * 0.7 - 17));
    y += (r * r - 0.5) * h.base_amp * h.ridge;
    y += n.fbm(x * h.detail_freq + 100, z * h.detail_freq + 100, 2) * h.detail_amp;
    for (const f of this.W.features) {
      const B = f._hb ||= this.featBox(f, false); if (x < B[0] || x > B[1] || z < B[2] || z > B[3]) continue;   // вне зоны влияния — вклад точно 0
      if (f.type === 'basin') {
        const d = Math.hypot(x - f.x, z - f.z) / f.r;
        if (d < 1.3) y -= f.depth * smooth(clamp01(1 - d / 1.3)) * (1 + 0.15 * n.simplex(x * 0.05, z * 0.05));
      } else if (f.type === 'crater') {
        const d = Math.hypot(x - f.x, z - f.z) / f.r;
        if (d < 1) y -= f.depth * smooth(1 - d);
        if (d > 0.75 && d < 1.45) y += f.rim * Math.sin(((d - 0.75) / 0.7) * Math.PI);
      } else if (f.type === 'ridge') {
        const d = segDist(x, z, f.x1, f.z1, f.x2, f.z2) / f.w;
        if (d < 1.5) y += f.h * smooth(clamp01(1 - d / 1.5)) * (0.7 + 0.3 * n.simplex(x * 0.03, z * 0.03));
      } else if (f.type === 'canyon') {
        const d = segDist(x, z, f.x1, f.z1, f.x2, f.z2) / f.w;
        // taper: у начала отрезка мелко (пологий вход), к концу — полная глубина
        let k = 1;
        if (f.taper) { const dx = f.x2 - f.x1, dz = f.z2 - f.z1; k = 0.12 + 0.88 * smooth(clamp01(((x - f.x1) * dx + (z - f.z1) * dz) / (dx * dx + dz * dz))); }
        // Отвесные стены и плоское дно (у taper-разломов), у обычных — мягкий профиль
        if (d < 1.4) y -= f.depth * k * (f.taper ? smooth(clamp01((1.4 - d) / 0.55)) : smooth(clamp01(1 - d / 1.4)));
      } else if (f.type === 'cavern') {
        // Кольцо отвесных скал вокруг грота; разрыв — только там, где ледяная арка (угол gap)
        const dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz) / f.r;
        let ad = Math.abs(Math.atan2(Math.sin(Math.atan2(dz, dx) - f.gap), Math.cos(Math.atan2(dz, dx) - f.gap)));
        const open = smooth(clamp01((0.36 - ad) / 0.1));
        const ring = smooth(clamp01((d - 0.85) / 0.1)) * smooth(clamp01((1.5 - d) / 0.2));
        y += Math.min(f.h, f.h * ring * (1 - open) * (0.9 + 0.1 * n.simplex(x * 0.15, z * 0.15)));
      } else if (f.type === 'shield') {
        // Щитовой вулкан: пологий конус (~27°, марсоход заезжает), радиальные борозды, кальдера с отвесными стенами
        const dx = x - f.x, dz = z - f.z, dist = Math.hypot(dx, dz), d = dist / f.r;
        if (d < 1.15) { const ang = Math.atan2(dz, dx);
          let cone = f.h * (1 - d) + f.h * 0.06 * smooth(clamp01((1.15 - d) / 0.3)) - f.h * 0.06;
          cone = Math.max(0, cone) * (1 + 0.03 * Math.sin(ang * 23 + n.simplex(x * 0.02, z * 0.02) * 3) * smooth(clamp01((0.95 - d) / 0.3)) * smooth(clamp01((d - 0.3) / 0.2)));
          const foot = smooth(clamp01((1.15 - d) / 0.35));
          y = y * (1 - 0.7 * smooth(clamp01((1 - d) / 0.4))) + cone * foot;
          if (dist < f.cr * 1.25) y -= f.cd * smooth(clamp01((f.cr * 1.25 - dist) / (f.cr * 0.35)));
        }
      } else if (f.type === 'pit') {
        // Провал лавовой трубки — круглая шахта
        const d = Math.hypot(x - f.x, z - f.z) / f.r;
        if (d < 1.2) y -= f.depth * smooth(clamp01((1.2 - d) / 0.35));
      } else if (f.type === 'icecap') {
        // Полярная шапка: плато со льдом, обрывы по краю, спиральные желоба-пандусы к центру
        const dx = (x - f.x) / f.rx, dz = (z - f.z) / f.rz, d = Math.hypot(dx, dz) * (1 + 0.06 * n.simplex(x * 0.01, z * 0.01));
        if (d < 1.1) { const ang = Math.atan2(dz, dx);
          let cap = f.h * smooth(clamp01((1 - d) / 0.1)) + f.h * 0.35 * smooth(clamp01((0.75 - d) / 0.6));
          // 3 широких пологих пандуса-желоба: от кромки (уровень земли) по спирали к центру — заезд на марсоходе
          const sp = Math.abs(Math.sin((ang * 3 - d * 5.5) / 2));
          const ramp = smooth(clamp01((0.42 - sp) / 0.2)) * smooth(clamp01((d - 0.1) / 0.2));
          cap = lerp(cap, cap * smooth(clamp01((1.02 - d) / 1.0)) * 0.9, ramp);
          y = y * (1 - smooth(clamp01((1 - d) / 0.2)) * 0.8) + Math.max(cap, -4);
        }
      } else if (f.type === 'dunes') {
        // Море дюн: поперечные гряды с крутым подветренным склоном, амплитуда меняется барханами
        const dx = (x - f.x) / f.rx, dz = (z - f.z) / f.rz, d = Math.hypot(dx, dz);
        if (d < 1.1) { const m = smooth(clamp01((1.1 - d) / 0.3));
          const wx = x + n.simplex(x * 0.006, z * 0.006) * 40, wz = z + n.simplex(x * 0.006 + 50, z * 0.006) * 40;
          const u = (wx * 0.94 + wz * 0.34) / f.wl, t = u - Math.floor(u);
          const prof = t < 0.76 ? smooth(t / 0.76) : smooth((1 - t) / 0.24);
          const amp = f.a * (0.55 + 0.45 * (0.5 + 0.5 * n.simplex(x * 0.004, z * 0.004)));
          y = y * (1 - 0.75 * m) + prof * amp * m;
        }
      } else if (f.type === 'geode') {
        // Жеода: кольцо отвесных стен (выше 60 м), чаша внутри, разлом-вход
        const dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz) / f.r;
        if (d < 1.7) { let ad = Math.abs(Math.atan2(Math.sin(Math.atan2(dz, dx) - f.gap), Math.cos(Math.atan2(dz, dx) - f.gap)));
          const open = smooth(clamp01((0.34 - ad) / 0.1)) * smooth(clamp01((1.75 - d) / 0.1)) * smooth(clamp01((d - 0.55) / 0.2));
          const ring = smooth(clamp01((d - 0.9) / 0.12)) * smooth(clamp01((1.6 - d) / 0.25));
          y = y * smooth(clamp01((d - 0.85) / 0.4)) + f.h * ring * (1 - open) * (0.85 + 0.15 * n.simplex(x * 0.05, z * 0.05));
          y -= f.depth * smooth(clamp01((1.0 - d) / 0.4)) * (1 - open * 0.5);
          // дно: каменные уступы и бугры (не плоско), к центру — холм под Сердцем жеоды
          const inner = smooth(clamp01((0.92 - d) / 0.2));
          y += inner * (Math.max(0, n.simplex(x * 0.05, z * 0.05)) * 5 + smooth(clamp01((0.35 - d) / 0.35)) * 6);
        }
      } else if (f.type === 'mesa') {
        // Столовая гора: отвесные стены, пешком не забраться
        const d = Math.hypot(x - f.x, z - f.z) / (f.r * (1 + 0.08 * n.simplex(x * 0.15, z * 0.15)));
        if (d < 1.25) y += f.h * smooth(clamp01((1.25 - d) / 0.28));
      }
    }
    // Террасы-плиты песчаника (стиль «каньон»): высоту ступенчато квантуем там, где рельеф уже крутой
    const T = this.W.terrace;
    if (T) {
      const mask = clamp01(this.terraceMask(x, z));
      if (mask > 0) {
        const st = T.step, q = Math.floor(y / st), fr = y / st - q;
        const ter = (q + smooth(clamp01((fr - (1 - T.sharp)) / T.sharp))) * st;
        const bw = this.biomeAt(x, z), nb = Math.max(bw[0], bw[2], bw[3]) * 0.85 + bw[1] * 0.4;
        y = lerp(y, ter, mask * T.amount * (1 - nb));
      }
    }
    // Края карты поднимаются — естественная стена
    // Края карты: сплошная гряда по скруглённому квадрату (p-норма — без изломов в углах); подъём плавный,
    // высота гуляет низкочастотно, гребень — крупные холмы (без столбов-зубцов и щелей с небом)
    const edge = this.edgeK(x, z), E0 = this.W.edge_from || 0.8;
    if (edge > E0 - 0.04) { const t = clamp01((edge - E0 + 0.04) / (0.96 - E0 + 0.04)), H = this.W.edge_h || 18;   // к 0.96 — вершина, дальше плато до обреза карты (обрез не виден на фоне неба)
      const v = 0.82 + 0.18 * n.simplex(x * 0.006 + 31, z * 0.006 - 17), bumps = 0.12 * n.simplex(x * 0.03, z * 0.03) * t;
      y = lerp(y, Math.max(y, 0), smooth(t)) + H * v * (smooth(t) * 0.75 + t * t * 0.25 + bumps); }
    for (const fl of this.W.flatten || []) {
      const d = Math.hypot(x - fl.x, z - fl.z) / fl.r;
      if (d < 1.4) { if (fl.h == null) { fl._noFlat = true; fl.h = this.rawHeightNoFlat(fl.x, fl.z); fl._noFlat = false; } y = lerp(fl.h, y, smooth(clamp01((d - 0.7) / 0.7))); }
    }
    return y;
  }
  // AABB, вне которого фича не влияет на высоту (ter=false) или на маску террас (ter=true). Радиусы — с запасом над порогами формул.
  featBox(f, ter) {
    const K = ter ? { canyon: 2.7, mesa: 1.7, cavern: 2.2, ridge: 1.8, crater: 1.7, icecap: 1.1, geode: 1.8 }
      : { basin: 1.4, crater: 1.5, ridge: 1.6, canyon: 1.5, cavern: 1.8, shield: 1.25, pit: 1.3, icecap: 1.25, dunes: 1.15, geode: 1.8, mesa: 1.45 };
    const k = K[f.type]; if (k == null) return ter ? [1, -1, 1, -1] : [-1e9, 1e9, -1e9, 1e9];   // не влияет на маску / неизвестный тип — всегда считать
    if (f.x1 != null) { const e = f.w * k; return [Math.min(f.x1, f.x2) - e, Math.max(f.x1, f.x2) + e, Math.min(f.z1, f.z2) - e, Math.max(f.z1, f.z2) + e]; }
    const ex = (f.rx || f.r) * k, ez = (f.rz || f.r) * k; return [f.x - ex, f.x + ex, f.z - ez, f.z + ez];
  }
  rawHeightNoFlat(x, z) { const F = this.W.flatten; this.W.flatten = []; const y = this.rawHeight(x, z); this.W.flatten = F; return y; }
  // Где делать террасы: стены каньонов, меза, гряды, кромки кратеров, края карты (0..1)
  terraceMask(x, z) {
    let m = 0;
    for (const f of this.W.features) {
      const B = f._tb ||= this.featBox(f, true); if (x < B[0] || x > B[1] || z < B[2] || z > B[3]) continue;
      if (f.type === 'canyon') { const d = segDist(x, z, f.x1, f.z1, f.x2, f.z2) / f.w; m = Math.max(m, smooth(clamp01((d - 0.55) / 0.4)) * smooth(clamp01((2.6 - d) / 0.8))); }
      else if (f.type === 'mesa') { const d = Math.hypot(x - f.x, z - f.z) / f.r; m = Math.max(m, smooth(clamp01((1.6 - d) / 0.4))); }
      else if (f.type === 'cavern') { const d = Math.hypot(x - f.x, z - f.z) / f.r; m = Math.max(m, smooth(clamp01((d - 0.7) / 0.1)) * smooth(clamp01((2.1 - d) / 0.3))); }
      else if (f.type === 'ridge') { const d = segDist(x, z, f.x1, f.z1, f.x2, f.z2) / f.w; m = Math.max(m, smooth(clamp01((1.7 - d) / 0.6))); }
      else if (f.type === 'crater') { const d = Math.hypot(x - f.x, z - f.z) / f.r; m = Math.max(m, smooth(clamp01((d - 0.7) / 0.15)) * smooth(clamp01((1.6 - d) / 0.2))); }
      else if (f.type === 'icecap') { const d = Math.hypot((x - f.x) / f.rx, (z - f.z) / f.rz); m = Math.max(m, smooth(clamp01((1.05 - d) / 0.08)) * smooth(clamp01((d - 0.8) / 0.1))); }
      else if (f.type === 'geode') { const d = Math.hypot(x - f.x, z - f.z) / f.r; m = Math.max(m, smooth(clamp01((d - 0.85) / 0.1)) * smooth(clamp01((1.7 - d) / 0.2))); }
    }
    return m;   // край карты — без террас (давали «зубцы» в шахматном порядке)
  }
  edgeK(x, z) { const P = 8, ax = Math.abs(x) / this.half, az = Math.abs(z) / this.half; return Math.pow(Math.pow(ax, P) + Math.pow(az, P), 1 / P); }
  // Высоты считаются лениво тайлами (TS сегментов): большой мир не тормозит старт. heightAt — билинейно по сетке step.
  buildHeightField() {
    this.step = this.size / this.W.segments;
    this.TS = 48; this.tiles = new Map();
    this.nT = Math.ceil(this.W.segments / this.TS);
  }
  tile(ti, tj) {
    const key = ti * 4096 + tj; let t = this.tiles.get(key); if (t) return t;
    const N = this.TS + 1; t = new Float32Array(N * N);
    const x0 = -this.half + ti * this.TS * this.step, z0 = -this.half + tj * this.TS * this.step;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) t[j * N + i] = this.rawHeight(x0 + i * this.step, z0 + j * this.step);
    this.tiles.set(key, t); return t;
  }
  gridH(i, j) {   // высота в узле сетки (i, j)
    const S = this.W.segments; i = Math.max(0, Math.min(S, i)); j = Math.max(0, Math.min(S, j));
    const ti = Math.min(this.nT - 1, Math.floor(i / this.TS)), tj = Math.min(this.nT - 1, Math.floor(j / this.TS));
    return this.tile(ti, tj)[(j - tj * this.TS) * (this.TS + 1) + (i - ti * this.TS)];
  }
  heightAt(x, z) {
    const fx = (x + this.half) / this.step, fz = (z + this.half) / this.step, S = this.W.segments;
    const i = Math.max(0, Math.min(S - 1, Math.floor(fx))), j = Math.max(0, Math.min(S - 1, Math.floor(fz)));
    const tx = clamp01(fx - i), tz = clamp01(fz - j);
    return lerp(lerp(this.gridH(i, j), this.gridH(i + 1, j), tx), lerp(this.gridH(i, j + 1), this.gridH(i + 1, j + 1), tx), tz);
  }
  normalAt(x, z) {
    const e = 0.6;
    return new THREE.Vector3(this.heightAt(x - e, z) - this.heightAt(x + e, z), 2 * e, this.heightAt(x, z - e) - this.heightAt(x, z + e)).normalize();
  }
  slopeAt(x, z) { return 1 - this.normalAt(x, z).y; }
  // Биом точки: веса [базальт, лёд, тёмный песок, кристалл] — для раскраски
  biomeAt(x, z) {
    const w = [0, 0, 0, 0], idx = { basalt: 0, ice: 1, darksand: 2, crystal: 3 };
    for (const f of this.W.features) { if (!f.biome) continue; let d;
      if (f.rx) d = Math.hypot((x - f.x) / f.rx, (z - f.z) / f.rz); else d = Math.hypot(x - f.x, z - f.z) / (f.r * (f.biome_r || 1.15));
      const k = smooth(clamp01((1 - d) / 0.18)); const i = idx[f.biome]; w[i] = Math.max(w[i], k); }
    return w;
  }

  // ---------- Террейн: чанки CH×CH сегментов, 3 уровня детализации, «юбка» по краю прячет щели между LOD ----------
  buildTerrain() {
    this.groundUniforms = {
      uDry: { value: new THREE.Color() }, uDry2: { value: new THREE.Color() }, uLush: { value: new THREE.Color() },
      uFlora: { value: 0 }, uWaterLevel: { value: -100 }, uPools: { value: [new THREE.Vector4(0,0,0,-100), new THREE.Vector4(0,0,0,-100), new THREE.Vector4(0,0,0,-100), new THREE.Vector4(0,0,0,-100), new THREE.Vector4(0,0,0,-100), new THREE.Vector4(0,0,0,-100)] }, uFrost: { value: new THREE.Vector4(0, 0, 0, 0) }, uFrostAmt: { value: 0 }, uScorch: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) }, uTime: { value: 0 }, uVolc: { value: new THREE.Vector3(0, 0, 1) },
    };
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, flatShading: !!this.W.faceted, vertexColors: false });
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, this.groundUniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aWet; attribute float aNoise; attribute vec4 aBiome; varying float vWet; varying float vNoise; varying vec3 vWPos; varying float vUp; varying vec4 vBiome;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWet = aWet; vNoise = aNoise; vBiome = aBiome; vWPos = (modelMatrix * vec4(position,1.0)).xyz; vUp = normal.y;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uDry; uniform vec3 uDry2; uniform vec3 uLush; uniform float uFlora; uniform float uWaterLevel; uniform vec4 uFrost; uniform float uFrostAmt; uniform vec4 uPools[6]; uniform vec4 uScorch[4]; uniform float uTime; uniform vec3 uVolc; varying float vWet; varying float vNoise; varying vec3 vWPos; varying float vUp; varying vec4 vBiome;')
        // Высотный туман: вершины гор видны издалека (воздух выше — прозрачнее)
        .replace('#include <fog_fragment>', `#ifdef USE_FOG
          float fd2 = vFogDepth * mix(1.0, 0.32, smoothstep(12.0, 140.0, vWPos.y));
          float fogF = 1.0 - exp( - fogDensity * fogDensity * fd2 * fd2 );
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogF );
        #endif`)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
          vec3 base = mix(uDry, mix(uDry, uDry2, 0.45), smoothstep(0.3, 0.8, vNoise));
          float cliff = smoothstep(0.88, 0.7, vUp);
          float band = fract(vWPos.y / 2.6 + vNoise * 0.08);
          vec3 mR1 = vec3(0.66, 0.28, 0.17), mR2 = vec3(0.85, 0.52, 0.33);
          // Скалы биомов: базальт (тёмно-серый), лёд (голубые слои), тёмный песчаник, аметистовая порода
          float bB = vBiome.x, bI = vBiome.y, bD = vBiome.z, bC = vBiome.w;
          mR1 = mix(mR1, vec3(0.035, 0.03, 0.032), bB); mR2 = mix(mR2, vec3(0.09, 0.075, 0.075), bB);
          mR1 = mix(mR1, vec3(0.38, 0.6, 0.82), bI); mR2 = mix(mR2, vec3(0.9, 0.96, 1.0), bI);
          mR1 = mix(mR1, vec3(0.05, 0.035, 0.05), bD); mR2 = mix(mR2, vec3(0.14, 0.09, 0.11), bD);
          mR1 = mix(mR1, vec3(0.10, 0.04, 0.16), bC); mR2 = mix(mR2, vec3(0.30, 0.14, 0.42), bC);
          vec3 rock = mix(mR1 * mix(0.62, 0.85, bC), mR1 * 0.95, smoothstep(0.05, 0.9, band));
          rock = mix(rock, mR2 * 1.05, smoothstep(0.9, 0.98, band));
          rock = mix(rock, mR1 * 0.4, smoothstep(0.98, 1.0, band) + (1.0 - smoothstep(0.0, 0.04, band)));
          // Грунт биомов
          base = mix(base, mix(vec3(0.04, 0.035, 0.035), vec3(0.08, 0.065, 0.06), vNoise), bB);
          base = mix(base, mix(vec3(0.86, 0.92, 0.97), vec3(0.97, 0.99, 1.0), vNoise) * (0.94 + 0.06 * step(0.5, fract(vWPos.y * 0.7))), bI);
          float crest = smoothstep(0.75, 0.98, vUp);
          base = mix(base, mix(vec3(0.045, 0.035, 0.06), vec3(0.085, 0.065, 0.09), vNoise) * mix(0.8, 1.25, crest) + vec3(0.3, 0.09, 0.02) * smoothstep(0.985, 1.0, vUp) * 0.5, bD);
          base = mix(base, mix(vec3(0.16, 0.06, 0.26), vec3(0.32, 0.12, 0.48), vNoise), bC);
          base = mix(base, rock, cliff);
          base *= mix(1.0, 1.12, smoothstep(0.93, 1.0, vUp) * (1.0 - cliff) * 0.6);
          float ripple = fract(sin(dot(floor(vWPos.xz * 0.45), vec2(12.9898, 78.233))) * 43758.5453);
          float green = clamp(uFlora * 2.2 - (1.0 - vWet) * 0.35 + (vNoise - 0.5) * 0.35 + (ripple - 0.5) * 0.25, 0.0, 1.0) * (1.0 - cliff);
          float barren = max(smoothstep(6.0, 10.0, vWPos.y), smoothstep(0.82, 0.9, vNoise) * (1.0 - vWet * 0.6));
          green *= 1.0 - barren;
          green *= 1.0 - clamp(bB + bI + bD + bC, 0.0, 1.0);   // в биомах зелени не будет никогда
          base = mix(base, mix(mR2, mR1, smoothstep(0.3, 0.8, vNoise)) * (1.0 - cliff) + rock * cliff, barren * smoothstep(0.25, 0.6, uFlora) * (1.0 - clamp(bB + bI + bD + bC, 0.0, 1.0)));
          vec3 lush = mix(uLush * 0.72, uLush * vec3(1.18, 1.12, 0.78), smoothstep(0.2, 0.9, vNoise));
          lush = mix(lush, vec3(0.62, 0.66, 0.32), smoothstep(4.0, 12.0, vWPos.y) * 0.6);
          float patchy = smoothstep(0.15, 0.55, fract(vNoise * 3.7 + vWet));
          base = mix(base, lush, green * mix(0.75, 1.0, patchy));
          float shore = 0.0;
          for (int i = 0; i < 6; i++) { vec4 P = uPools[i]; if (P.w < -50.0) continue;
            float inR = step(length(vWPos.xz - P.xy), P.z);
            shore = max(shore, inR * smoothstep(1.3, 0.0, vWPos.y - P.w) * step(P.w - 3.0, vWPos.y)); }
          base = mix(base, mix(base * 0.55, vec3(0.8, 0.72, 0.52), 0.3), shore);
          float fd = length(vWPos.xz - uFrost.xy) / max(uFrost.z, 1.0);
          float inZone = smoothstep(1.05, 0.75, fd);
          float caps = inZone * max(step(0.56, vNoise + 0.04 * sin(vWPos.x * 1.7) * cos(vWPos.z * 1.3)), step(0.9, vUp) * step(0.5, vWPos.y + vNoise * 3.0) * step(0.42, vNoise));
          float frost = max(inZone * uFrostAmt, caps);
          base = mix(base, vec3(0.93, 0.97, 1.0) * (0.92 + 0.08 * vNoise), frost);
          for (int i = 0; i < 4; i++) { vec4 S = uScorch[i]; if (S.w <= 0.0) continue;
            vec2 q = vWPos.xz - S.xy; float ang = atan(q.y, q.x);
            float sd = length(q) / S.z * (1.0 + 0.16 * sin(ang * 7.0) + 0.09 * sin(ang * 13.0 + 1.7)) + (vNoise - 0.5) * 0.12;
            float burn = (1.0 - smoothstep(0.45, 1.0, sd)) * S.w;
            base = mix(base, vec3(0.04, 0.03, 0.028), burn);
            vec2 cell = floor(vWPos.xz * 1.6); float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
            float ember = step(0.88, h) * (1.0 - smoothstep(0.1, 0.65, sd)) * S.w;
            base = mix(base, vec3(1.0, 0.38, 0.06), ember * 0.85); }
          vec4 diffuseColor = vec4( base, opacity );`)
        // Раскалённые трещины базальта светятся (emissive), пульсируют
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          { vec2 vq = vWPos.xz - uVolc.xy; float vr = length(vq) / uVolc.z, va = atan(vq.y, vq.x);
            float lane = abs(fract(va * 3.0 + vNoise * 0.35 + sin(vr * 9.0) * 0.08) - 0.5);
            float wdt = mix(0.018, 0.06, smoothstep(0.25, 0.9, vr)) * (0.7 + 0.6 * vNoise); float crack = vBiome.x * smoothstep(wdt, wdt * 0.45, lane) * smoothstep(0.2, 0.3, vr) * smoothstep(1.02, 0.8, vr) * (1.0 - cliff * 0.7);
            float crust = vBiome.x * smoothstep(wdt * 2.2, wdt, lane) * (1.0 - crack) * smoothstep(0.2, 0.3, vr); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.05, 0.02), crust * 0.8);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.3, 0.02), crack); totalEmissiveRadiance += mix(vec3(1.0, 0.18, 0.02), vec3(1.0, 0.75, 0.2), smoothstep(0.4, 0.95, 1.0 - lane / max(wdt, 1e-3))) * crack * (1.6 + 0.5 * sin(uTime * 2.0 - vr * 30.0));
            float gl = vBiome.w * step(0.9, fract(vNoise * 13.0 + vWPos.z * 0.021)); totalEmissiveRadiance += vec3(0.55, 0.25, 1.0) * gl * 0.6; }`);
    };
    this.terrainMat = mat; { const V = this.W.features.find(f => f.type === 'shield'); if (V) this.groundUniforms.uVolc.value.set(V.x, V.z, V.r); }
    this.terrain = new THREE.Group(); this.terrain.name = 'terrain'; this.scene.add(this.terrain);
    this.CH = 80; const nC = Math.ceil(this.W.segments / this.CH);
    this.chunks = [];
    for (let cj = 0; cj < nC; cj++) for (let ci = 0; ci < nC; ci++) {
      const c = { ci, cj, lod: -1, meshes: [], cx: -this.half + (ci + 0.5) * this.CH * this.step, cz: -this.half + (cj + 0.5) * this.CH * this.step };
      this.chunks.push(c);
    }
    this.lodDist = this.W.lod_dist || [130, 300];
    this.updateTerrain(new THREE.Vector3(0, 0, 0), true);
  }
  // Сетка чанка с шагом stride; skirt — опускание краёв на 4 м
  chunkGeo(c, stride) {
    const CH = this.CH, S = this.W.segments, i0 = c.ci * CH, j0 = c.cj * CH;
    // размеры по осям раздельно: у крайних чанков ширина и глубина разные (раньше брался общий min → дыры-«зубцы» по краю карты)
    const nx = Math.ceil(Math.min(CH, S - i0) / stride), nz2 = Math.ceil(Math.min(CH, S - j0) / stride), NX = nx + 1, NZ = nz2 + 1, N = NX;
    const cnt = NX * NZ + 2 * NX + 2 * NZ, pos = new Float32Array(cnt * 3), wet = new Float32Array(cnt), nz = new Float32Array(cnt), bio = new Float32Array(cnt * 4);
    const idx = []; let k = 0;
    const put = (i, j, drop) => { const x = -this.half + i * this.step, z = -this.half + j * this.step, y = this.gridH(i, j) - drop;
      pos.set([x, y, z], k * 3);
      let w = 0; for (const f of this.W.features) if (f.type === 'basin' || f.type === 'crater' || f.type === 'canyon') { const d = f.type === 'canyon' ? segDist(x, z, f.x1, f.z1, f.x2, f.z2) / (f.w * 2.2) : Math.hypot(x - f.x, z - f.z) / (f.r * 2.2); if (d < 1) w = Math.max(w, 1 - d); }
      wet[k] = clamp01(w * 1.1 + clamp01((2 - y) / 12) * 0.35); nz[k] = this.noise.simplex(x * 0.08, z * 0.08) * 0.5 + 0.5; bio.set(this.biomeAt(x, z), k * 4); return k++; };
    const gi = i => Math.min(i0 + i * stride, S), gj = j => Math.min(j0 + j * stride, S);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) put(gi(i), gj(j), 0);
    for (let j = 0; j < nz2; j++) for (let i = 0; i < nx; i++) { const a = j * N + i, b = a + 1, c2 = a + N, d = c2 + 1; idx.push(a, c2, b, b, c2, d); }
    // юбка: 4 края
    const edge = (list) => { const base = k; for (const [i, j] of list) put(gi(i), gj(j), 4); for (let t = 0; t < list.length - 1; t++) { const a = list[t][1] * N + list[t][0], b = list[t + 1][1] * N + list[t + 1][0]; idx.push(a, b, base + t, b, base + t + 1, base + t); idx.push(a, base + t, b, b, base + t, base + t + 1); } };
    const LX = [...Array(NX).keys()], LZ = [...Array(NZ).keys()];
    edge(LX.map(i => [i, 0])); edge(LX.map(i => [i, nz2])); edge(LZ.map(j => [0, j])); edge(LZ.map(j => [nx, j]));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, k * 3), 3)); g.setAttribute('aWet', new THREE.BufferAttribute(wet.subarray(0, k), 1));
    g.setAttribute('aNoise', new THREE.BufferAttribute(nz.subarray(0, k), 1)); g.setAttribute('aBiome', new THREE.BufferAttribute(bio.subarray(0, k * 4), 4));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  }
  // Каждый кадр: нужный LOD чанкам рядом с камерой; перестройка — не больше budget чанков за кадр
  updateTerrain(cam, all = false) {
    const [d0, d1] = this.lodDist; let budget = all ? 1e9 : 2;
    const dy = Math.max(0, cam.y - 60);   // высоко над картой (джетпак, облёт) — дистанция с учётом высоты: мельче LOD
    const want = c => { const d = Math.hypot(cam.x - c.cx, cam.z - c.cz, dy) - this.CH * this.step * 0.7; return d < d0 ? 0 : d < d1 ? 1 : 2; };
    const order = this.chunks.map(c => [c, want(c)]).filter(([c, w]) => c.lod !== w).sort((a, b) => a[1] - b[1] || Math.hypot(cam.x - a[0].cx, cam.z - a[0].cz) - Math.hypot(cam.x - b[0].cx, cam.z - b[0].cz));
    for (const [c, w] of order) { if (budget-- <= 0) break;
      c.geos ||= []; if (!c.geos[w]) c.geos[w] = this.chunkGeo(c, [1, 2, 4][w]);
      if (!c.mesh) { c.mesh = new THREE.Mesh(c.geos[w], this.terrainMat); c.mesh.receiveShadow = true; c.mesh.name = 'terrain'; this.terrain.add(c.mesh); }
      else c.mesh.geometry = c.geos[w];
      c.lod = w; if (w === 2) { c.geos[0] = null; } }
  }

  // ---------- Вода: своя гладь в каждой лощине/кратере, уровень = дно + заполнение × глубина ----------
  buildWater() {
    this.waterUniforms = { uTime: { value: 0 }, uFrost: this.groundUniforms.uFrost, uFrostAmt: this.groundUniforms.uFrostAmt };
    const mat = this.waterMat = new THREE.MeshStandardMaterial({ color: this.style?.water || this.W.water_color || '#3f8fc4', transparent: true, opacity: 0.62, roughness: 0.25, metalness: 0.05, flatShading: true });
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, this.waterUniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos2;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos2 = (modelMatrix * vec4(position,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform vec4 uFrost; uniform float uFrostAmt; varying vec3 vWPos2;')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( diffuse, opacity );
          float fz = smoothstep(1.0, 0.85, length(vWPos2.xz - uFrost.xy) / max(uFrost.z, 1.0)) * uFrostAmt;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.95, 1.0), fz); diffuseColor.a = mix(diffuseColor.a, 1.0, fz);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          normal = normalize(normal + vec3(sin(vWPos2.x*0.9+uTime*1.7)*0.05, 0.0, cos(vWPos2.z*0.8+uTime*1.3)*0.05));`);
    };
    this.waterMat = mat;
    this.pools = [];
    for (const f of this.W.features) {
      if (f.type !== 'basin' && f.type !== 'crater') continue;
      const floor = this.heightAt(f.x, f.z);
      // Кромка: минимальная высота по кругу на 1.15 r — выше вода «перельётся»
      let rim = Infinity;
      for (let a = 0; a < 32; a++) { const ang = a / 32 * Math.PI * 2; rim = Math.min(rim, this.heightAt(f.x + Math.cos(ang) * f.r * 1.15, f.z + Math.sin(ang) * f.r * 1.15)); }
      const maxLevel = Math.min(rim - 0.6, floor + f.depth * 0.9);
      if (maxLevel <= floor + 0.3) continue;
      const geo = new THREE.CircleGeometry(f.r * 1.5, 48); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat); m.position.set(f.x, -100, f.z); m.name = 'water_' + f.id; m.visible = false;
      this.scene.add(m);
      this.pools.push({ f, floor, maxLevel, mesh: m, level: -100 });
    }
    this.waterLevel = -100;
  }
  // Стена пыльной бури: мягкие края (ярче на касательных — объём), растворяется вверху и внизу, клубится
  dustWallMat() {
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#c07a48') }, opacity: { value: 0.7 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float opacity; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){ float graze = 1.0 - abs(dot(normalize(vN), normalize(vV)));
          float v = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
          float cl = n(vec2(vUv.x * 40.0 + uTime * 0.6, vUv.y * 5.0 - uTime * 0.25)) * 0.6 + n(vec2(vUv.x * 90.0 - uTime, vUv.y * 11.0)) * 0.4;
          float a = opacity * v * smoothstep(1.0, 0.55, graze) * smoothstep(0.15, 0.75, cl + 0.2 * (1.0 - vUv.y));
          gl_FragColor = vec4(uColor * (0.85 + 0.3 * cl), a); }`,
    });
    Object.defineProperty(m, 'opacityV', { get: () => m.uniforms.opacity.value });
    this.dustMats = (this.dustMats || []).concat(m);
    return m;
  }
  // Уровень воды в точке (или -100, если сухо)
  waterAt(x, z) {
    for (const p of this.pools) if (p.mesh.visible && Math.hypot(x - p.f.x, z - p.f.z) < p.f.r * 1.5 && this.heightAt(x, z) < p.level) return p.level;
    return -100;
  }

  // ---------- Небо ----------
  buildSky() {
    this.skyUniforms = { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.3).normalize() }, uSun: { value: new THREE.Color() } };
    const geo = new THREE.SphereGeometry(900, 48, 32);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyUniforms,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSun; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0); vec3 c = mix(uHorizon, uTop, smoothstep(0.12, 0.85, h));
          float s = max(dot(d, uSunDir), 0.0); c += uSun * (pow(s, 600.0) * 2.5 + pow(s, 8.0) * 0.18);
          if (d.y < 0.0) c = uHorizon; gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.name = 'sky';
    // Звёзды для ночи
    const sp = new Float32Array(900 * 3), rr = this.noise.rnd;
    for (let i = 0; i < 900; i++) { const u = rr() * 2 - 1, a = rr() * Math.PI * 2, r = Math.sqrt(1 - u * u); sp.set([Math.cos(a) * r * 850, Math.abs(u) * 850, Math.sin(a) * r * 850], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.name = 'stars'; this.sky.add(this.stars);
    // Крупные небесные тела ночью: газовый гигант с кольцом, бирюзовая луна, красный спутник с кратерами
    this.planets = [];
    const mkPlanet = (r, dir, cols, ring, seed) => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
      const gr = x.createLinearGradient(0, 0, 0, 128); cols.forEach((col, i) => gr.addColorStop(i / (cols.length - 1), col)); x.fillStyle = gr; x.fillRect(0, 0, 256, 128);
      let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 14; i++) { x.fillStyle = cols[i % cols.length] + '88'; const y = rnd() * 128; x.fillRect(0, y, 256, 2 + rnd() * 8); }
      if (!ring) for (let i = 0; i < 18; i++) { x.fillStyle = '#00000033'; x.beginPath(); x.arc(rnd() * 256, rnd() * 128, 2 + rnd() * 7, 0, 7); x.fill(); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const g = new THREE.Group(), L = this.skyUniforms.uSunDir;
      const lit = (map, col) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
        uniforms: { uMap: { value: map }, uCol: { value: new THREE.Color(col || '#ffffff') }, uL: L, uOp: { value: 0 }, uRingIn: { value: r * 1.4 }, uRingOut: { value: r * 2.1 }, uR: { value: r } },
        vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: map ? 'uniform sampler2D uMap; uniform vec3 uL; uniform float uOp; varying vec2 vUv; varying vec3 vN; void main(){ float d = dot(normalize(vN), normalize(uL)); float k = smoothstep(-0.15, 0.25, d) * 0.95 + 0.05; vec3 c = texture2D(uMap, vUv).rgb * k; gl_FragColor = vec4(c, uOp); }'
          : 'uniform vec3 uCol; uniform vec3 uL; uniform float uOp; uniform float uRingIn; uniform float uRingOut; varying vec2 vUv; varying vec3 vP; void main(){ float band = 0.75 + 0.25 * sin(vUv.x * 60.0); gl_FragColor = vec4(uCol * band, uOp * 0.6); }' });
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), lit(tex)); g.add(m);
      if (ring) { const rg = new THREE.Mesh(new THREE.RingGeometry(r * 1.4, r * 2.1, 64), lit(null, ring)); rg.rotation.x = -1.2; rg.rotation.y = 0.35; g.add(rg); }
      g.position.copy(dir.normalize().multiplyScalar(780)); g.lookAt(0, 0, 0);
      g.traverse(o => { if (o.material) o.renderOrder = -1; });
      this.sky.add(g); this.planets.push(g);
    };
    // Низко над горизонтом (10–20°) и по разным сторонам — при обычной камере хотя бы одно тело всегда в кадре
    const at = (azDeg, elDeg) => { const a = azDeg * Math.PI / 180, e = elDeg * Math.PI / 180; return new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)); };
    // Обычная камера смотрит чуть вниз: в кадр попадает небо до ~12° над горизонтом → тела нижним краем у самых гор
    const low = r => Math.atan(r / 780) * 180 / Math.PI + 1.5;
    // Две планеты с разных сторон, не напротив друг друга (~130° между ними) и на разной высоте
    mkPlanet(95, at(215, low(95) + 4), ['#e8b77a', '#c77a4a', '#f2d3a0', '#a95d3a'], '#d9c8a8', 7);
    mkPlanet(55, at(345, low(55) + 9), ['#7fe3d8', '#3a9bb0', '#b8f4ec'], null, 13);
    this.scene.add(this.sky);
    this.scene.fog = new THREE.FogExp2('#d8a274', 0.012);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x664433, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.position.set(80, 120, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 20; sc.far = 200;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);
  }

  // ---------- Облака, дождь, буря ----------
  buildWeather() {
    // Облака: плоские группы шаров высоко
    this.clouds = new THREE.Group();
    const cm = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, transparent: true, opacity: 0.85, roughness: 1, fog: false });
    const r = this.noise.rnd;
    for (let i = 0; i < Math.round(26 * Math.pow(this.size / 400, 1.4)); i++) {
      // Облако = один меш (шары слиты в одну геометрию): 1 draw call вместо 5–9
      const n = 5 + Math.floor(r() * 5), parts = [];
      for (let k = 0; k < n; k++) {
        const g = new THREE.IcosahedronGeometry(9 + r() * 8, 1);
        g.scale(1, 0.6, 1); g.translate(k * 9 - n * 4.5 + r() * 5, r() * 5, r() * 14 - 7); parts.push(g);
      }
      const c = new THREE.Mesh(mergeGeometries(parts, false), cm);
      c.position.set((r() - 0.5) * (this.size + 400), 90 + r() * 60, (r() - 0.5) * (this.size + 400));
      this.clouds.add(c);
    }
    this.clouds.name = 'clouds';
    this.scene.add(this.clouds);
    this.cloudMat = cm;
    // Дождь: линии вокруг игрока
    const N = 2500;
    const pos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) {
      const x = (r() - 0.5) * 60, y = r() * 40, z = (r() - 0.5) * 60;
      pos.set([x, y, z, x + 0.05, y + 0.9, z], i * 6);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.5 });
    this.rain = new THREE.LineSegments(g, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.rain.name = 'rain';
    this.scene.add(this.rain);
    this.rainAmt = 0;
    this.raining = 0;
    this.rainClock = 0;
  }

  // Ночь (n 0..1) и буря (s 0..1) поверх цвета стадии — вызывать после applyTerraform
  setScorch(i, x, z, r, amt) { this.groundUniforms.uScorch.value[i].set(x, z, r, amt); }
  // Стиль планеты из магазина: null — классика; иначе цвета грунта/неба/воды/зелени/ночи поверх стадий терраформации
  setStyle(st) { this.style = st; if (this.waterMat) this.waterMat.color.set(st?.water || this.W.water_color || '#3f8fc4'); this._styleDirty = true; }
  applyAtmos(n, s, sc) {
    this.stormAmt = s; this.stormColor = sc;
    const dark = new THREE.Color(this.style?.night?.[0] || '#0a1226'), st = new THREE.Color(sc);
    this.sun.intensity = 2.2 * (1 - 0.9 * n) * (1 - 0.65 * s);
    this.hemi.intensity = 1.1 * (1 - 0.6 * n) * (1 - 0.25 * s);
    this.hemi.color.lerp(new THREE.Color('#5a7ac8'), 0.7 * n);
    this.skyUniforms.uTop.value.lerp(dark, 0.88 * n).lerp(st, 0.8 * s);
    this.skyUniforms.uHorizon.value.lerp(new THREE.Color(this.style?.night?.[1] || '#1c2140'), 0.82 * n).lerp(st, 0.9 * s);
    this.skyUniforms.uSun.value.multiplyScalar(Math.max(0, 1 - 1.15 * n));
    this.scene.fog.color.copy(this.skyUniforms.uHorizon.value).lerp(st.clone().multiplyScalar(1 - 0.75 * n), s);
    this.scene.fog.density = this.scene.fog.density * (1 + 0.5 * n) + s * 0.07;
    this.rain.rotation.z = -1.3 * s; this.rain.scale.set(1 + s, 1, 1 + s);
    this.stars.material.opacity = n * (1 - s);
    for (const p of this.planets || []) p.traverse(o => { if (o.material?.uniforms) o.material.uniforms.uOp.value = Math.min(1, Math.max(0, n * 1.6 - 0.15)) * (1 - s * 0.8); });
    this.cloudMat.opacity *= 1 - 0.6 * n;
  }

  // Ледяные стены и буря для тайм-гейт зон
  buildGates(models) {
    for (const z of this.W.zones) {
      const g = { zone: z, open: false, objects: [] };
      if (z.ice_ring) {
        // Сплошное ледяное кольцо по границе зоны: торосы внахлёст в два ряда, обойти нельзя
        // Один InstancedMesh-набор на кольцо (было ~220 отдельных групп ≈ 580 draw call)
        const R = z.r, n = Math.ceil(2 * Math.PI * R / 2.6), list = [];
        for (let row = 0; row < 2; row++) for (let i = 0; i < n; i++) {
          const a = (i + row * 0.5) / n * Math.PI * 2, rr = R + (row ? 1.6 : -0.4) + Math.sin(i * 1.7) * 0.5, x = z.x + Math.cos(a) * rr, zz = z.z + Math.sin(a) * rr;
          const sx = 1.5 + (i * 7 % 5) * 0.12, SY = 1.7 + (i * 3 % 4) * 0.25 + (row ? 0.5 : 0);
          list.push({ x, y: this.heightAt(x, zz) - 0.5, z: zz, rot: -a + Math.PI / 2 + Math.sin(i * 3.1) * 0.25, tilt: { x: Math.cos(i * 1.9) * 0.15, z: Math.sin(i * 2.3) * 0.18 }, scale: sx, sy: SY / sx, sz: 1.4 / sx, SY, sx });
        }
        g.ice = { ctl: models.scatter(this.scene, 'ice_wall', list, { shadows: true }), list, k: 1, melt: -1 };
        g.ring = { x: z.x, z: z.z, r: R + 0.6 };
      }
      if (z.storm) {
        // Стена пыли: полупрозрачный цилиндр
        const m = new THREE.Mesh(new THREE.CylinderGeometry(z.r + 6, z.r + 6, 40, 40, 1, true),
          this.dustWallMat());
        m.position.set(z.x, this.heightAt(z.x, z.z) + 12, z.z);
        m.name = 'storm_' + z.id;
        this.scene.add(m);
        g.storm = m;
      }
      if (z.gate.stat === 'heat') { this.groundUniforms.uFrost.value.set(z.x, z.z, z.r * 1.15, 0); this.groundUniforms.uFrostAmt.value = 1; g.frost = true; }
      this.gateObjects.push(g);
    }
  }
  // Блокирует ли закрытая зона точку (x,z)
  blocked(x, z) {
    for (const g of this.gateObjects) {
      if (g.open) continue;
      if (g.ring && Math.abs(Math.hypot(x - g.ring.x, z - g.ring.z) - g.ring.r) < 2.6) return g;
      if (g.storm && Math.hypot(x - g.zone.x, z - g.zone.z) < g.zone.r + 4) return g;
    }
    return null;
  }
  inZone(x, z, id) { const zz = this.W.zones.find(q => q.id === id); return zz && Math.hypot(x - zz.x, z - zz.z) < zz.r; }

  // ---------- Применение стадии (t — непрерывная «позиция» между стадиями) ----------
  applyTerraform(ti, stats, dt, playerPos) {
    const st = this.cfg.terraform.stages;
    let k = 0;
    while (k < st.length - 1 && ti >= st[k + 1].ti) k++;
    const a = st[k], b = st[Math.min(k + 1, st.length - 1)];
    const t = b === a ? 0 : smooth(clamp01((ti - a.ti) / (b.ti - a.ti)));
    const col = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), t);
    const curve = (pts, v) => { if (!pts) return null; for (let i = 1; i < pts.length; i++) if (v <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], smooth(clamp01((v - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])))); return pts[pts.length - 1][1]; };
    const TT = this.cfg.terraform, bio = stats?.biomass || 0;
    // Зелень и вода — только от органики (биомассы), а не от тепла/давления
    const floraOk = k >= (TT.flora_from_stage ?? 0) ? 1 : 0;   // зелень строго с «Мха и лишайников»
    // Лужи — от стадии «Первые лужи» (мелкие, в низинах), большая вода — от органики
    const puddleK = TT.puddles_from_stage ?? 2, puddles = k > puddleK ? 0.16 : k === puddleK ? 0.07 + 0.09 * t : 0;
    const num = key => key === 'flora' && TT.bio_flora ? curve(TT.bio_flora, bio) * floraOk : key === 'water' && TT.bio_water ? Math.max(puddles, curve(TT.bio_water, bio)) : lerp(a[key], b[key], t);
    this.stageIndex = k;
    this.skyUniforms.uTop.value.copy(col(a.sky[0], b.sky[0]));
    this.skyUniforms.uHorizon.value.copy(col(a.sky[1], b.sky[1]));
    this.skyUniforms.uSun.value.copy(col(a.sun, b.sun));
    // Туман = цвет горизонта: дальний рельеф растворяется в небе без полосы
    this.skyUniforms.uHorizon.value.lerp(col(a.fog, b.fog), 0.5);
    this.scene.fog.color.copy(this.skyUniforms.uHorizon.value);
    this.scene.fog.density = num('fog_density');
    this.hemi.color.copy(col(a.sky[0], b.sky[0])).lerp(new THREE.Color('#ffffff'), 0.5);
    this.hemi.groundColor.copy(new THREE.Color(a.ground[0])).multiplyScalar(0.6);
    this.sun.color.copy(col(a.sun, b.sun));
    const gB = k + 1 < (TT.flora_from_stage ?? 0) + 1 && k + 1 >= (TT.flora_from_stage ?? 0) ? a : b;   // в стадии перед «Мхом» грунт не тянется к оливковому
    this.groundUniforms.uDry.value.copy(new THREE.Color(a.ground[0]).lerp(new THREE.Color(gB.ground[0]), t));
    this.groundUniforms.uDry2.value.copy(new THREE.Color(a.ground[1]).lerp(new THREE.Color(gB.ground[1]), t)).multiplyScalar(0.9);
    this.groundUniforms.uLush.value.set('#4f9a3e');
    const SY = this.style;
    if (SY) {   // живость планеты 0..1 по стадии: от «мёртвого» набора цветов стиля к «живому»
      const live = clamp01((k + t) / Math.max(1, st.length - 1)), C = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y || x), live);
      this.skyUniforms.uTop.value.copy(C(SY.sky[0], SY.sky_live?.[0])); this.skyUniforms.uHorizon.value.copy(C(SY.sky[1], SY.sky_live?.[1])).lerp(C(SY.fog, SY.fog_live), 0.5);
      this.skyUniforms.uSun.value.set(SY.sun || '#ffffff'); this.sun.color.set(SY.sun || '#ffffff');
      this.scene.fog.color.copy(this.skyUniforms.uHorizon.value);
      this.hemi.color.copy(C(SY.sky[0], SY.sky_live?.[0])).lerp(new THREE.Color('#ffffff'), 0.5); this.hemi.groundColor.copy(new THREE.Color(SY.ground[0])).multiplyScalar(0.6);
      this.groundUniforms.uDry.value.copy(C(SY.ground[0], SY.ground_live?.[0])); this.groundUniforms.uDry2.value.copy(C(SY.ground[1], SY.ground_live?.[1])).multiplyScalar(0.9);
      this.groundUniforms.uLush.value.set(SY.lush || '#4f9a3e');
    }
    this.flora = num('flora');
    this.groundUniforms.uFlora.value = this.flora;
    // Вода: каждая лощина наполняется по своей глубине
    const wl = num('water');
    this.waterAmt = wl;
    const fill = Math.pow(wl, 1.7); // чаша плоская у дна: медленный подъём = сначала лужи, потом пруд, потом озеро
    let shoreLevel = -100;
    for (const p of this.pools) {
      const target = wl <= 0.001 ? p.floor - 1 : p.floor + 0.2 + (p.maxLevel - p.floor - 0.2) * fill;
      p.level += (target - p.level) * Math.min(1, dt * 0.8);
      if (Math.abs(p.level - target) > 20) p.level = target;
      p.mesh.visible = p.level > p.floor; p.mesh.position.y = p.level;
      shoreLevel = Math.max(shoreLevel, p.mesh.visible ? p.level : -100);
    }
    this.waterLevel = shoreLevel; // для совместимости (HUD/снимок)
    this.groundUniforms.uWaterLevel.value = -100;
    this.pools.slice(0, 6).forEach((p, i) => this.groundUniforms.uPools.value[i].set(p.f.x, p.f.z, p.f.r * 1.5, p.mesh.visible ? p.level : -100));
    this.waterUniforms.uTime.value += dt; this.groundUniforms.uTime.value += dt;
    // Облака и дождь
    const cl = num('clouds');
    this.clouds.visible = cl > 0.02;
    this.cloudMat.opacity = 0.9 * cl;
    this.clouds.children.forEach((c, i) => { c.visible = i / this.clouds.children.length < cl * 1.3; c.position.x += dt * 2.5; if (c.position.x > this.half + 200) c.position.x = -this.half - 200; });
    const rainChance = num('rain');
    this.rainClock -= dt;
    if (this.rainClock <= 0) { this.raining = Math.random() < rainChance ? 1 : 0; this.rainClock = 25 + Math.random() * 30; }
    if (this.forceRain != null) this.raining = this.forceRain;
    this.rainAmt += (this.raining - this.rainAmt) * Math.min(1, dt * 0.5);
    this.rain.visible = this.rainAmt > 0.03 || (this.stormAmt || 0) > 0.05;
    if (this.rain.visible && playerPos) {
      this.rainMat.opacity = Math.max(0.55 * this.rainAmt, 0.7 * (this.stormAmt || 0));
      this.rainMat.color.set((this.stormAmt || 0) > this.rainAmt ? this.stormColor || '#c08850' : '#cfe6ff');
      this.rain.position.set(playerPos.x, playerPos.y - 5, playerPos.z);
      this.rain.position.y -= (performance.now() / 25) % 40 * 0 ; // покой: дождь падает за счёт сдвига вершин ниже
      const p = this.rain.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 2) {
        let y = p.getY(i) - dt * 28; if (y < 0) y += 40;
        p.setY(i, y); p.setY(i + 1, y + 0.9);
      }
      p.needsUpdate = true;
    }
    // Тайм-гейты
    const events = [];
    for (const g of this.gateObjects) {
      const v = stats[g.zone.gate.stat] || 0;
      const prog = clamp01(v / g.zone.gate.value);
      if (g.frost) this.groundUniforms.uFrostAmt.value = 1 - smooth(clamp01((prog - 0.6) / 0.4));
      if (!g.open && prog >= 1) {
        g.open = true; events.push({ type: 'gate_open', zone: g.zone });
      }
      if (g.open) {
        if (g.ice && g.ice.k > 0) { const I = g.ice; I.k *= 1 - Math.min(0.9, dt * 0.6); const kk = I.k * 1.5 < 0.05 ? 0 : I.k;   // 1.5 — мин. исходный масштаб
          I.list.forEach((t, i) => I.ctl.set(i, kk ? { scale: t.sx * kk, visible: true } : { visible: false })); I.ctl.flush(); I.k = kk; }
        if (g.storm) { const u = g.storm.material.uniforms.opacity; u.value *= 1 - Math.min(0.9, dt * 0.8); if (u.value < 0.02) g.storm.visible = false; }
      } else {
        // Ледяные стены подтаивают по мере прогресса
        if (g.ice && Math.abs(prog - g.ice.melt) > 0.002) { const I = g.ice; I.melt = prog; I.list.forEach((t, i) => I.ctl.set(i, { sy: Math.max(0.5, t.SY * (1 - prog * 0.35)) / t.sx })); I.ctl.flush(); }
        if (g.storm) { g.storm.rotation.y += dt * 0.3; g.storm.material.uniforms.uTime.value += dt; }
      }
    }
    return events;
  }
}
