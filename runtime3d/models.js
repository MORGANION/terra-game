// Загрузка процедурных моделей (models/<id>.js → build(THREE)) и массовая расстановка через InstancedMesh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Загрузка по сети ненадёжна (мобильный интернет, туннель): ограничиваем параллельность и повторяем с паузой
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function retry(fn, tries = 5) { let e; for (let i = 0; i < tries; i++) { try { return await fn(i); } catch (x) { e = x; await sleep(400 * (i + 1) + Math.random() * 300); } } throw e; }
async function pool(items, n, fn) { const q = [...items]; await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { while (q.length) await fn(q.shift()); })); }

// Статичные меши-дети группы с общим непрозрачным материалом → один меш на материал (позиция+нормаль+uv).
// Меши с уникальным материалом и skip-набор не трогаем (на них могут ссылаться анимации/логика).
export function mergeStatic(grp, skip = null) {
  const by = new Map();
  for (const m of grp.children) if (m.isMesh && !m.isInstancedMesh && !m.isSkinnedMesh && !m.children.length && !Array.isArray(m.material) && !m.material.transparent && !skip?.has(m)) { if (!by.has(m.material)) by.set(m.material, []); by.get(m.material).push(m); }
  let saved = 0;
  for (const [mat, list] of by) {
    if (list.length < 2) continue;
    const geos = list.map(m => { m.updateMatrix(); let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrix);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; });
    const g = mergeGeometries(geos, false); if (!g) continue;
    const m = new THREE.Mesh(g, mat); m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow; m.name = list[0].name;
    for (const o of list) { grp.remove(o); o.geometry.dispose(); }
    grp.add(m); saved += list.length - 1;
  }
  return saved;
}

export class Models {
  constructor(base) { this.base = base; this.protos = {}; this.baked = {}; this.chunks = []; this._cp = new THREE.Vector3(); }

  // Отсечение scatter-чанков по дальности (раз за render, из scene.onBeforeRender): дальше, чем туман полностью
  // закрывает объект (FogExp2: 1-exp(-(d·ρ)²) > 0.995 ⇒ d > 2.3/ρ), или дальше radius·sizeK (мельче ~2 px) — не рисуем.
  // Туман Three.js считается по глубине вдоль взгляда (vFogDepth), поэтому для тумана — глубина центра чанка, для размера — расстояние.
  cull(cam, fog) {
    const fogD = fog?.density > 0 ? 2.3 / fog.density : 1e9, cp = this._cp.setFromMatrixPosition(cam.matrixWorld), e = cam.matrixWorld.elements;
    const fx = -e[8], fy = -e[9], fz = -e[10];
    for (const ch of this.chunks) {
      const dx = ch.c.x - cp.x, dy = ch.c.y - cp.y, dz = ch.c.z - cp.z, lim = ch.sizeD + ch.r;
      const on = ch.n > 0 && dx * fx + dy * fy + dz * fz - ch.r < fogD && dx * dx + dy * dy + dz * dz < lim * lim;
      if (on !== ch.on) { ch.on = on; for (const im of ch.meshes) im.visible = on; }
    }
  }

  async load(ids) {
    const v = Date.now();
    await pool(ids, 8, async id => {
      try {
        const mod = await retry(i => import(`${this.base}/${id}.js?v=${v}${i ? '&r=' + i : ''}`));
        const o = mod.default(THREE);
        o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        this.protos[id] = o;
      } catch (e) {
        console.error('модель ' + id + ': ' + e.message);
        const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ff00ff' }));
        m.position.y = 0.5;
        const g = new THREE.Group(); g.add(m); this.protos[id] = g;
        (window.__qa?.errors || []).push('модель ' + id + ': ' + e.message);
      }
    });
  }

  // Статичные GLB-модели (Tripo): заменяют процедурную модель с тем же id. Тун-материал + контур, нормализация размера.
  async loadGLB(list) {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const grad = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat); grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
    await pool(list, 4, async P => {
      try {
        const gl = await retry(i => loader.loadAsync(P.glb + (i ? '?r=' + i : '')));
        const o = gl.scene; o.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3());
        const k = (P.size || 10) / Math.max(size.x, size.z), root = new THREE.Group();
        o.scale.setScalar(k); o.position.set(-(box.min.x + size.x / 2) * k, -box.min.y * k - (P.sink || 0), -(box.min.z + size.z / 2) * k);
        o.rotation.y = 0; root.add(o);
        const outl = [];
        o.traverse(m => { if (!m.isMesh) return; const src = m.material; m.material = new THREE.MeshToonMaterial({ map: src.map, color: src.color || 0xffffff, gradientMap: grad }); if (m.material.map) m.material.map.colorSpace = THREE.SRGBColorSpace; m.castShadow = true; m.receiveShadow = true;
          if (P.outline !== 0) { const om = new THREE.MeshBasicMaterial({ color: '#1b1210', side: THREE.BackSide }); const w = (P.outline || 0.06) / k; om.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${w.toFixed(4)};`); }; outl.push([m, om]); } });
        for (const [m, om] of outl) { const ol = new THREE.Mesh(m.geometry, om); ol.name = 'outline'; m.add(ol); }
        root.userData.glb = true; root.rotation.y = P.rotY || 0;
        const wrap = new THREE.Group(); wrap.add(root);
        this.protos[P.id] = wrap;
      } catch (e) { (window.__qa?.errors || []).push('glb ' + P.id + ': ' + e.message); }
    });
  }

  // Отдельный экземпляр (постройки, интерактив). static=true — запечённая копия (1–3 draw call вместо десятков).
  instance(id, { animated = false, recolor = null } = {}) {
    const p = this.protos[id];
    if (!p) throw new Error('нет модели ' + id);
    if (animated || p.children[0]?.userData.glb) return p.clone(true);
    const b = this.bake(id, recolor);
    const g = new THREE.Group(); g.name = id;
    for (const { geo, mat } of b.parts) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.name = id; g.add(m); }
    return g;
  }

  // Запечь модель: непрозрачные несветящиеся части → ОДНА геометрия с цветом в вершинах (1 draw call),
  // прозрачные/светящиеся — по материалу отдельно. recolor = {fur:'#hex', accent:'#hex', glow:bool} — перекраска рода.
  bake(id, recolor = null) {
    const key = id + (recolor ? JSON.stringify(recolor) : '');
    if (this.baked[key]) return this.baked[key];
    const p = this.protos[id];
    if (!p) throw new Error('bake: нет модели ' + id);
    p.updateMatrixWorld(true);
    const roles = recolor ? this.colorRoles(id) : null;
    const opaque = [], special = new Map();
    let rough = 0, metal = 0, cnt = 0;
    p.traverse(c => {
      if (!c.isMesh) return;
      const mat = Array.isArray(c.material) ? c.material[0] : c.material;
      let g = c.geometry.clone();
      g.applyMatrix4(c.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      const isSpecial = mat.transparent || (mat.emissive && mat.emissive.getHex() > 0 && (mat.emissiveIntensity ?? 1) > 0.05);
      if (isSpecial) { if (!special.has(mat)) special.set(mat, []); special.get(mat).push(g); return; }
      let col = mat.color || new THREE.Color('#888');
      if (roles) {
        const role = roles.get(mat);
        const map = (this.recolorMap && this.recolorMap[id]) || { fur: 'fur', accent: 'accent' };
        const src = role && map[role];
        if (src && recolor[src]) col = new THREE.Color(recolor[src]);
      }
      const n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      opaque.push(g);
      rough += mat.roughness ?? 0.8; metal += mat.metalness ?? 0; cnt++;
    });
    const parts = [];
    if (opaque.length) {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: rough / cnt, metalness: metal / cnt });
      if (recolor?.glow) { mat.emissive = new THREE.Color(recolor.accent || recolor.fur || '#88aaff'); mat.emissiveIntensity = 0.28; }
      parts.push({ geo: mergeGeometries(opaque, false), mat });
    }
    for (const [mat, geos] of special) {
      for (const g of geos) for (const k of Object.keys(g.attributes)) if (k === 'color') g.deleteAttribute(k);
      const merged = mergeGeometries(geos, false);
      if (merged) parts.push({ geo: merged, mat });
    }
    const box = new THREE.Box3().setFromObject(p);
    this.baked[key] = { parts, box, radius: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2 };
    return this.baked[key];
  }

  // Какие материалы — «шерсть» и «акцент». По именам (fur/accent), иначе: шерсть = самый большой по площади светлый материал.
  colorRoles(id) {
    const roles = new Map(), area = new Map();
    this.protos[id].traverse(c => {
      if (!c.isMesh) return;
      const m = Array.isArray(c.material) ? c.material[0] : c.material;
      const nm = (m.name || '').toLowerCase();
      if (nm.includes('skin') || nm.includes('cloth') || nm.includes('eye')) { roles.set(m, null); return; }
      if (nm.includes('fur') || nm.includes('body')) roles.set(m, 'fur');
      else if (nm.includes('accent')) roles.set(m, 'accent');
      const g = c.geometry; const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
      const s = new THREE.Vector3(); c.getWorldScale(s);
      area.set(m, (area.get(m) || 0) + tris * s.x * s.y * s.z);
    });
    if (![...roles.values()].includes('fur')) {
      let best = null, bv = 0;
      for (const [m, a] of area) {
        if (m.transparent || !m.color) continue;
        const hsl = {}; m.color.getHSL(hsl);
        if (hsl.l < 0.25 || roles.has(m)) continue; // has() учитывает и явный null (кожа/одежда)
        if (a > bv) { bv = a; best = m; }
      }
      if (best) roles.set(best, 'fur');
    }
    return roles;
  }

  // Много копий одной модели: карта режется на чанки (frustum culling работает), в каждом чанке
  // InstancedMesh на каждую часть модели, в буфер пишутся ТОЛЬКО видимые экземпляры (скрытые не стоят GPU).
  // cell 96: крупнее чанк — меньше draw call; frustum culling по чанку остаётся (см. cull).
  scatter(scene, id, transforms, { shadows = true, cell = 96, sizeK = 600 } = {}) {
    const b = this.bake(id);
    const items = transforms.map((t, i) => ({ ...t, index: i, visible: t.visible !== false }));
    const chunks = new Map();
    for (const it of items) {
      const key = Math.floor(it.x / cell) + ',' + Math.floor(it.z / cell);
      if (!chunks.has(key)) chunks.set(key, { items: [], meshes: [], dirty: true, n: 0, on: true, c: new THREE.Vector3(), r: 0, sizeD: Math.max(60, b.radius * sizeK) });
      const ch = chunks.get(key); it.chunk = ch; ch.items.push(it);
    }
    for (const ch of chunks.values()) {
      ch.meshes = b.parts.map(({ geo, mat }) => {
        const im = new THREE.InstancedMesh(geo, mat, ch.items.length);
        im.castShadow = shadows; im.receiveShadow = true; im.name = 'inst_' + id;
        scene.add(im); return im;
      });
      // центр/радиус чанка по всем экземплярам (для отсечения по дальности)
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const it of ch.items) { x0 = Math.min(x0, it.x); x1 = Math.max(x1, it.x); y0 = Math.min(y0, it.y); y1 = Math.max(y1, it.y); z0 = Math.min(z0, it.z); z1 = Math.max(z1, it.z); }
      ch.c.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); ch.r = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 + b.radius * 3;
      this.chunks.push(ch);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), e = new THREE.Euler();
    const flush = ch => {
      let n = 0;
      for (const it of ch.items) {
        if (!it.visible) continue;
        const sc = it.scale ?? 1;
        e.set(it.tilt?.x || 0, it.rot || 0, it.tilt?.z || 0); q.setFromEuler(e);
        s.set(sc, sc * (it.sy ?? 1), sc * (it.sz ?? 1)); pos.set(it.x, it.y, it.z);
        m4.compose(pos, q, s);
        for (const im of ch.meshes) im.setMatrixAt(n, m4);
        n++;
      }
      for (const im of ch.meshes) {
        im.count = n; im.visible = n > 0 && ch.on; im.instanceMatrix.needsUpdate = true;
        if (n) { im.computeBoundingSphere(); im.boundingSphere.radius += b.radius; }
      }
      ch.n = n; ch.dirty = false;
    };
    const ctl = {
      id, items, radius: b.radius, count: items.length,
      set(i, t) { Object.assign(items[i], t); items[i].chunk.dirty = true; ctl.pending = true; },
      hide(i) { ctl.set(i, { visible: false }); ctl.flush(); },
      show(i) { ctl.set(i, { visible: true }); ctl.flush(); },
      flush() { if (!ctl.pending) return; for (const ch of chunks.values()) if (ch.dirty) flush(ch); ctl.pending = false; },
    };
    for (const ch of chunks.values()) flush(ch);
    return ctl;
  }
}
