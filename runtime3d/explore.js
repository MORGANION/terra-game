// Исследование: снаряжение и чертежи, метеориты v2, сутки и бури, точки интереса (обломки, тела, пещера), фонари.
import * as THREE from 'three';
import { Loot } from './loot.js';
import { rng } from './noise.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const LAMP_LIGHTS = 6;

export class Explore {
  constructor(g) {
    this.g = g; this.cfg = g.cfg; this.loot = new Loot(g);
    const st = g.state;
    st.gear ??= { backpack: 0, suit: 0, tool: 0, jet: 0 };
    st.bps ??= {};            // gear -> макс. открытый тир чертежа
    st.looted ??= {};         // key -> оставшийся лут [] (или true = пусто)
    st.lamps ??= [];
    st.dayT ??= 60;
    this.meteors = []; this.scorchSlot = 0;
    this.stormT = rnd(...this.cfg.events.storm.every_sec) * 0.6; this.storm = 0; this.stormOn = false;
    this.containers = [];     // {key,x,z,r,table,name,obj,dark?}
    this.darkZones = [];
    // Фиксированный пул света: число источников не меняется → шейдеры не перекомпилируются
    this.lights = [...Array(LAMP_LIGHTS)].map(() => { const l = new THREE.PointLight('#ffe2a0', 0, 8, 2); g.scene.add(l); return l; });
    this.headlamp = new THREE.SpotLight('#ffeccc', 0, 16, 0.45, 0.65, 1.4); g.scene.add(this.headlamp); g.scene.add(this.headlamp.target);
    this.meteorLight = new THREE.PointLight('#ff7a2a', 0, 26, 1.3); g.scene.add(this.meteorLight);
    this.applyGear();
  }

  // ---------- Снаряжение ----------
  gearV(id) { const G = this.cfg.gear[id]; return G.tiers[Math.min(this.g.state.gear[id] || 0, G.tiers.length - 1)].v; }
  applyGear() {
    const g = this.g;
    g.S.o2_max = this.gearV('suit');
    g.state.o2 = Math.min(g.state.o2, g.S.o2_max);
    g.player.mineMul = this.gearV('tool');
    g.player.jetFuelMax = this.gearV('jet');
  }
  slots() { return this.gearV('backpack') + (this.g.state.flags.big_backpack ? 4 : 0); }
  learn(bpItem) {
    const it = this.cfg.items[bpItem]; const [gid, t] = it.bp.split(':'); const tier = +t;
    const st = this.g.state; if ((st.bps[gid] ?? 0) >= tier) return false;
    st.bps[gid] = tier; this.g.qa.event('learn', { gid, tier }); this.g.ui.toast(`${'📜'} Новый ${it.name.replace('Чертёж: ', 'чертёж: ')}`, 'rar-' + it.rarity); return true;
  }
  upgradeState(gid) {
    const G = this.cfg.gear[gid], cur = this.g.state.gear[gid] || 0, next = G.tiers[cur + 1];
    if (!next) return { max: true };
    const known = (this.g.state.bps[gid] ?? 0) >= cur + 1;
    return { next, tier: cur + 1, known, affordable: known && this.g.has(next.cost) };
  }
  upgrade(gid) {
    const s = this.upgradeState(gid); if (!s.affordable || !this.g.take(s.next.cost)) return false;
    this.g.state.gear[gid] = s.tier; this.applyGear(); this.g.save();
    this.g.ui.toast(`${this.cfg.gear[gid].icon} ${this.cfg.gear[gid].name} → тир ${s.tier + 1}`); this.g.qa.event('gear', { gid, tier: s.tier });
    return true;
  }

  // ---------- Точки интереса ----------
  populate() {
    const g = this.g, W = this.cfg.world, M = g.models, w = g.world;
    const R = (() => { let s = 9137; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const put = (model, x, z, rot = 0, sy = 0) => { const o = M.instance(model); o.position.set(x, w.heightAt(x, z) + sy, z); o.rotation.y = rot; g.scene.add(o); return o; };
    const box = (key, x, z, table, name, model = 'loot_crate', rot = 0) => {
      const o = put(model, x, z, rot); const c = { key, x, z, r: 2.4, table, name, obj: o, seed: key.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0) >>> 0, 7) };
      this.containers.push(c); g.player.addSolid(x, z, 0.5); this.markOpened(c); return c;
    };
    for (const p of W.pois || []) {
      const rot = p.rot ?? Math.atan2(-p.x, -p.z);
      if (p.type === 'crate') box('poi:' + p.id, p.x, p.z, p.table, p.name);
      if (p.type === 'ship' || p.type === 'station') {
        const model = p.type === 'ship' ? 'wreck_ship' : 'station_ring';
        put(model, p.x, p.z, rot, -0.6);
        // Обломки — тёмная зона: внутри без света ничего не видно
        this.darkZones.push({ x: p.x, z: p.z, r: p.type === 'ship' ? 15 : 14, name: p.name });
        const D = p.dungeon;
        for (let i = 0; i < D.crates; i++) { const a = R() * 6.28, d = 3 + R() * 9; box(`poi:${p.id}:c${i}`, p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, D.table, `${p.name}: контейнер`, 'loot_crate', R() * 6); }
        for (let i = 0; i < D.bodies; i++) { const a = R() * 6.28, d = 4 + R() * 8; box(`poi:${p.id}:b${i}`, p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 'body', 'Пропавший космонавт', 'suit_body', R() * 6); }
        box(`poi:${p.id}:vault`, p.x + Math.cos(rot) * 2, p.z - Math.sin(rot) * 2, D.vault, `${p.name}: сейф капитана`, 'chest');
      }
      if (p.type === 'ice_cave') {
        // Грот в кольце скал (рельеф world.features.cavern); вход — единственный разрыв, запечатан ледяной аркой
        // Ледяная пробка в проёме скал: каменные косяки цвета скал мира + объёмный ледяной монолит из глыб (тает по прогрессу)
        const o = new THREE.Group(); o.position.set(p.x, w.heightAt(p.x, p.z) - 0.6, p.z); o.rotation.y = p.rot || 0; g.scene.add(o);
        const rockM = new THREE.MeshStandardMaterial({ color: '#b5603a', roughness: 0.95, flatShading: true });
        const iceM = new THREE.MeshStandardMaterial({ color: '#d6efff', transparent: true, opacity: 0.9, roughness: 0.2, emissive: '#5a8fb0', emissiveIntensity: 0.18, flatShading: true });
        const capM = new THREE.MeshStandardMaterial({ color: '#f4fbff', roughness: 0.6, flatShading: true });
        const RR = (a, b) => a + R() * (b - a);
        for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(RR(2.2, 3.2), 0), rockM); r.position.set(sx * RR(5.2, 6.4), RR(1, 7), RR(-2, 1.5)); r.scale.set(1, RR(1.2, 1.8), 1); r.rotation.set(R() * 3, R() * 3, R() * 3); r.castShadow = true; o.add(r); }
        
        for (let k = 0; k < 26; k++) { const ice = new THREE.Mesh(new THREE.IcosahedronGeometry(RR(1.5, 2.6), 0), iceM); ice.position.set(-4.5 + (k % 6) * 1.8 + RR(-0.4, 0.4), 0.6 + Math.floor(k / 6) * 2.1 + RR(-0.3, 0.3), RR(-1.8, 1.8)); ice.scale.set(1, RR(1.1, 1.7), 0.8); ice.rotation.set(R() * 3, R() * 3, R() * 3); ice.castShadow = true; o.add(ice);
          if (k % 3 === 0) { const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), capM); cap.position.set(ice.position.x, ice.position.y + 1.5, ice.position.z); cap.scale.set(1.6, 0.4, 1.2); cap.material = iceM.clone(); cap.material.color.set('#f4fbff'); cap.material.opacity = 0.95; o.add(cap); } }
        // сосульки с перемычки
        for (let k = 0; k < 9; k++) { const ic = new THREE.Mesh(new THREE.ConeGeometry(0.45, RR(1.8, 3.4), 5), iceM); ic.rotation.x = Math.PI; ic.position.set(-4.4 + k * 1.1, 10.2, 1.6); o.add(ic); }
        const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 0), iceM); crown.position.set(0, 10.6, 0); crown.scale.set(2.3, 0.7, 1.1); o.add(crown);
        this.iceCave = { p, obj: o, open: false };
        const orig = w.blocked.bind(w);
        w.blocked = (x, z) => (!this.iceCave.open && Math.hypot(x - p.x, z - p.z) < 5) ? { zone: { name: p.name, gate: p.gate }, cave: true } : orig(x, z);
        // За льдом: реликвия и тайник
        const bx = p.x, bz = p.z - 13;
        this.relic = put('alien_relic', bx, bz);
        box(`poi:${p.id}:relic`, bx + 2.5, bz - 1, p.dungeon.vault, 'Древний тайник');
        this.darkZones.push({ x: bx, z: bz, r: 10, name: p.name });
      }
    }
    // Обломки купола у шаттла: лутаются один раз, дают ресурсы на купол базы
    this.wrecks = [];
    for (const d of W.dome_wreck || []) {
      const o = put(d.model, d.x, d.z, d.rot || 0, -0.35); if (d.scale) o.scale.multiplyScalar(d.scale); o.rotation.z = d.tilt || 0; o.rotation.x = (d.tilt || 0) * 0.5;
      // Разлёт после крушения: треугольные панели, осколки стекла, балки и борозда в песке
      { const Rw = rng(d.id.length * 97 + d.x * 13 + d.z), sc = d.scale || 1, grp = new THREE.Group(); grp.position.set(d.x, 0, d.z); g.scene.add(grp);
        const panelM = new THREE.MeshStandardMaterial({ color: '#e9dcc4', flatShading: true, roughness: 0.8 }), glassM = new THREE.MeshStandardMaterial({ color: '#9fd8d0', flatShading: true, roughness: 0.15, metalness: 0.1, emissive: '#2a6a66', emissiveIntensity: 0.25 }), ribM = new THREE.MeshStandardMaterial({ color: '#b5603a', flatShading: true });
        // подпалина под кучей
        const scorch = new THREE.Mesh(new THREE.CircleGeometry(2.6 * sc, 9), new THREE.MeshBasicMaterial({ color: '#3a1a10', transparent: true, opacity: 0.35, depthWrite: false })); scorch.rotation.x = -Math.PI / 2; scorch.position.y = w.heightAt(d.x, d.z) + 0.06; scorch.scale.set(1, 1.4, 1); grp.add(scorch);
        // рваные куски: неправильные многоугольники с толщиной, воткнуты под углом; гнутые балки
        const shard = (r) => { const sh = new THREE.Shape(), n = 4 + Math.floor(Rw() * 3); for (let i = 0; i < n; i++) { const a = i / n * 6.28 + Rw() * 0.5, q = r * (0.45 + Rw() * 0.75); i ? sh.lineTo(Math.cos(a) * q, Math.sin(a) * q) : sh.moveTo(Math.cos(a) * q, Math.sin(a) * q); } return new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false }); };
        for (let k = 0; k < 12; k++) { const a = Rw() * 6.28, rr = (1.8 + Math.pow(Rw(), 1.6) * 4.5) * sc, x = Math.cos(a) * rr, z = Math.sin(a) * rr, kind = k % 3;
          let m;
          if (kind === 2) { const pts = []; const L = 1 + Rw() * 1.4, bend = (Rw() - 0.5) * 1.2; for (let i = 0; i <= 4; i++) pts.push(new THREE.Vector3(Math.sin(i / 4 * bend) * 0.6, 0, i / 4 * L)); m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.07, 4), ribM); }
          else m = new THREE.Mesh(shard(kind ? 0.45 : 0.75), kind ? glassM : panelM);
          const stuck = Rw() < 0.5;
          m.position.set(x, w.heightAt(d.x + x, d.z + z) + (stuck ? 0.1 : 0.02), z);
          m.rotation.set(stuck ? -0.6 - Rw() * 0.9 : -Math.PI / 2 + (Rw() - 0.5) * 0.4, Rw() * 6.28, (Rw() - 0.5) * 0.5, 'YXZ'); m.castShadow = true; grp.add(m); }
      }
      const wr = { ...d, key: 'wreck:' + d.id, obj: o, r: 2.8 * (d.scale || 1), done: !!g.state.looted['wreck:' + d.id] };
      this.wrecks.push(wr); g.player.addSolid(d.x, d.z, 1.4 * (d.scale || 1));
      if (wr.done) this.dimWreck(wr);
    }
    // Россыпь контейнеров и тел по карте
    const free = () => { for (let a = 0; a < 40; a++) { const x = (R() - 0.5) * w.size * 0.75, z = (R() - 0.5) * w.size * 0.75; if (Math.hypot(x, z) < (W.debris.min_dist || 25) || w.slopeAt(x, z) > 0.3 || w.waterAt(x, z) > -50) continue; return [x, z]; } return null; };
    for (let i = 0; i < W.debris.crates; i++) { const q = free(); if (q) box('deb:c' + i, q[0], q[1], 'crate', 'Грузовой контейнер', 'loot_crate', R() * 6); }
    for (let i = 0; i < W.debris.bodies; i++) { const q = free(); if (q) box('deb:b' + i, q[0], q[1], 'body', 'Пропавший космонавт', 'suit_body', R() * 6); }
    // Кобальт — у обломков станции и в разломе
    // Фонари из сейва
    for (const l of g.state.lamps) this.spawnLamp(l);
  }
  markOpened(c) { const v = this.g.state.looted[c.key]; if (v === true || (Array.isArray(v) && !v.length)) this.dim(c); }
  dim(c) { c.done = true; c.obj.traverse(m => { if (m.isMesh && m.material.emissive) { m.material = m.material.clone(); m.material.emissiveIntensity = 0; } }); }
  dimWreck(w) { w.done = true; w.obj.traverse(m => { if (m.isMesh && m.material) { m.material = m.material.clone(); m.material.color?.multiplyScalar(0.7); } }); }
  async openWreck(w) {
    const st = this.g.state; let items = st.looted[w.key];
    if (!Array.isArray(items)) items = Object.entries(w.give).map(([id, n]) => ({ id, n }));
    const left = await this.g.ui.lootPanel(w.name, items, this);
    st.looted[w.key] = left.length ? left : true;
    if (!left.length) { this.dimWreck(w); this.g.qa.event('wreck', { id: w.id }); }
    this.g.save();
  }
  nearestContainer() {
    return this.g.pickNear(this.wrecks || [], 3.4, c => c.done) || this.g.pickNear(this.containers, 2.6, c => c.done);
  }
  async openContainer(c) {
    if (c.give) return this.openWreck(c);
    const st = this.g.state; let items = st.looted[c.key];
    if (!Array.isArray(items)) items = this.loot.roll(this.cfg.loot.tables[c.table], c.seed);
    const left = await this.g.ui.lootPanel(c.name, items, this);
    st.looted[c.key] = left.length ? left : true;
    if (!left.length) this.dim(c);
    this.g.qa.event('loot', { key: c.key, table: c.table, got: items.length - left.length });
    if (c.table === 'body') this.g.qa.event('loot_body', {});
    this.g.life?.quest('mine', 1);
    this.g.save();
  }
  // Положить предмет из лута: чертёж — учится, остальное — в рюкзак
  takeItem(id, n) {
    const it = this.cfg.items[id];
    if (it?.bp) { this.learn(id); return n; }
    let got = 0; for (let i = 0; i < n; i++) if (this.g.add(id, 1)) got++;
    return got;
  }

  // ---------- Фонари ----------
  spawnLamp(l) { const o = this.g.models.instance('lamp'); o.position.set(l.x, this.g.world.heightAt(l.x, l.z), l.z); this.g.scene.add(o); l.obj = o; }
  placeLamp() {
    const g = this.g; if (!g.state.inv.lamp) { g.ui.toast('Нет фонарей — создай в фабрикаторе', 'warn'); return false; }
    const f = g.player.forward(), p = g.player.pos, l = { x: p.x + f.x * 1.4, z: p.z + f.z * 1.4 };
    g.take({ lamp: 1 }); g.state.lamps.push(l); this.spawnLamp(l); g.save(); g.qa.event('lamp', {}); return true;
  }

  // ---------- Метеориты ----------
  spawnMeteor(type, restore = null) {
    const g = this.g, M = this.cfg.meteors, p = g.player.pos;
    if (restore) type = M.types.find(t => t.id === restore.type) || M.types[0];
    else if (!type) { const tot = M.types.reduce((a, t) => a + t.w, 0); let r = Math.random() * tot; type = M.types.find(t => (r -= t.w) <= 0) || M.types[0]; }
    else type = M.types.find(t => t.id === type);
    let x, z;
    if (restore) { x = restore.x; z = restore.z; } else for (let a = 0; a < 20; a++) { const [d0, d1] = this.cfg.meteors.dist || [22, 40], ang = Math.random() * 6.28, d = d0 + Math.random() * (d1 - d0); x = p.x + Math.cos(ang) * d; z = p.z + Math.sin(ang) * d; if (g.world.waterAt(x, z) < -50 && Math.abs(x) < g.world.half * 0.8 && Math.abs(z) < g.world.half * 0.8) break; }
    const y = g.world.heightAt(x, z);
    const core = g.models.instance('meteor_core');
    core.traverse(c => { if (c.isMesh && c.material.emissive && c.material.emissiveIntensity > 0.3) { c.material = c.material.clone(); c.material.emissive.set(type.color); } });
    core.scale.setScalar(type.id === 'star' ? 1.6 : 1.25); core.position.set(x, y + 90, z); g.scene.add(core);
    // Хвост
    const trail = new THREE.Mesh(new THREE.ConeGeometry(1.1, 26, 10, 1, true), new THREE.MeshBasicMaterial({ color: type.color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    trail.position.y = 13; core.add(trail);
    // Огни пожара (биллборды-конусы, мерцают)
    const fires = new THREE.Group();
    const fm = new THREE.MeshBasicMaterial({ color: '#ff4a10', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    const fm2 = new THREE.MeshBasicMaterial({ color: '#ffb02a', transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28, d = 1.4 + Math.random() * type.scorch * 0.45; const f = new THREE.Mesh(new THREE.ConeGeometry(0.45 + Math.random() * 0.5, 1.4 + Math.random() * 2.2, 6), i % 3 ? fm : fm2); const fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d; f.position.set(fx, g.world.heightAt(fx, fz) + 0.4, fz); f.userData.ph = Math.random() * 6; fires.add(f); }
    // Дым: тёмные шары поднимаются и тают
    const sm = new THREE.MeshBasicMaterial({ color: '#1e1a17', transparent: true, opacity: 0.5, depthWrite: false, fog: false });
    for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + Math.random(), 0), sm); s.userData.smoke = Math.random(); s.position.set(x + (Math.random() - 0.5) * 3, y, z + (Math.random() - 0.5) * 3); fires.add(s); }
    fires.visible = false; g.scene.add(fires);
    const m = { type, core, trail, fires, x, z, y, fall: 1.6, age: 0, slot: this.scorchSlot++ % 4, shards: [], id: restore?.id || ('M' + Date.now().toString(36) + (Math.random() * 1e4 | 0)) };
    this.meteors.push(m);
    if (restore) { m.fall = 0; m.age = restore.age || 0; m.opened = !!restore.opened; m.items = restore.items || null; this.impact(m, restore.shards); if (m.opened) m.core.traverse(c => { if (c.isMesh && c.material.emissive) { c.material = c.material.clone(); c.material.emissiveIntensity *= 0.15; } }); return m; }
    g.ui.toast(`☄️ ${type.name} падает!`, type.id === 'star' ? 'rar-legendary' : type.id === 'crystal' ? 'rar-epic' : type.id === 'cobalt' ? 'rar-rare' : '');
    g.qa.event('meteor_spawn', { type: type.id });
    return m;
  }
  impact(m, saved = null) {
    const g = this.g, w = g.world;
    m.core.position.y = m.y - 0.3; m.trail.visible = false; m.fires.visible = true;
    w.setScorch(m.slot, m.x, m.z, m.type.scorch, 1);
    if (!saved) { g.ui.shake(Math.min(1.2, 0.5 + m.type.scorch / 20)); g.ui.flash(m.type.color);
      const d = Math.hypot(m.x - g.player.pos.x, m.z - g.player.pos.z); g.sfx?.play('meteor_impact', { k: Math.max(0.25, 1.4 - d / 120) }); }
    g.player.addSolid(m.x, m.z, 1.0);
    // Осколки — добываемые узлы вокруг
    const S = m.type.shards, list = [];
    if (saved) for (const q of saved) list.push(q);
    else for (let k = 0; k < S.length; k += 2) for (let i = 0; i < S[k + 1]; i++) { const a = Math.random() * 6.28, d = 2.2 + Math.random() * m.type.scorch * 0.7; list.push({ res: S[k], x: m.x + Math.cos(a) * d, z: m.z + Math.sin(a) * d }); }
    for (const q of list) {
      const x = q.x, z = q.z;
      const o = g.models.instance(q.res); o.position.set(x, w.heightAt(x, z) - 0.05, z); o.rotation.set(Math.random() * 0.5, Math.random() * 6, Math.random() * 0.5); o.scale.setScalar(0.6 + Math.random() * 0.35); g.scene.add(o);
      const node = { res: q.res, i: 0, x, z, y: o.position.y, key: 'm:' + Math.random(), dyn: true, obj: o };
      node.ctl = { items: [{ visible: true }], hide: () => { node.ctl.items[0].visible = false; g.scene.remove(o); g.saveSoon?.(); }, set() {}, flush() {} };
      g.nodes.push(node); m.shards.push(node);
    }
    g.qa.event('meteor', { type: m.type.id });
  }
  nearestMeteor() { const p = this.g.player.pos; return this.meteors.find(m => m.fall <= 0 && (!m.opened || m.items?.length) && Math.hypot(p.x - m.x, p.z - m.z) < 3.6); }
  async openMeteor(m) {
    if (!m) return;
    if (m.opened) { if (!m.items?.length) return; const left = await this.g.ui.lootPanel(`Ядро: ${m.type.name}`, m.items, this); m.items = left; this.g.save(); return; }
    this.g.qa.event('meteor_touch', {});
    if (!(await this.g.rewarded('meteor_cache'))) return;
    m.opened = true;
    const items = m.items || this.loot.roll(m.type.core, Math.random() * 1e9 | 0); m.items = items; this.g.save();
    m.core.traverse(c => { if (c.isMesh && c.material.emissive) { c.material = c.material.clone(); c.material.emissiveIntensity *= 0.15; } });
    const left = await this.g.ui.lootPanel(`Ядро: ${m.type.name}`, items, this);
    m.left = left; m.items = left; this.g.save();
    this.g.qa.event('meteor_open', { type: m.type.id });
  }

  // ---------- Сейв метеоритов: место, тип, возраст, лут ядра, несобранные осколки ----------
  serializeMeteors() {
    return this.meteors.filter(m => m.fall <= 0).map(m => ({ id: m.id, type: m.type.id, x: +m.x.toFixed(2), z: +m.z.toFixed(2), age: Math.round(m.age), opened: !!m.opened, items: m.items || null,
      shards: m.shards.filter(s => s.ctl.items[0].visible).map(s => ({ res: s.res, x: +s.x.toFixed(2), z: +s.z.toFixed(2) })) }));
  }
  restoreMeteors(list) { for (const r of list || []) { try { this.spawnMeteor(null, r); } catch (e) { console.warn('meteor restore', e); } } }

  // ---------- Кадр ----------
  update(dt) {
    const g = this.g, E = this.cfg.events, w = g.world, p = g.player.pos;
    // Метеориты
    const MC = this.cfg.meteors;
    this.meteorClock = (this.meteorClock ?? MC.first_sec) - dt;
    if (this.meteorClock <= 0) { this.meteorClock = rnd(...MC.every_sec); if (this.meteors.length < 3) this.spawnMeteor(); }
    let bestM = null;
    for (const m of [...this.meteors]) {
      m.age += dt;
      if (m.fall > 0) {
        m.fall -= dt; const t = Math.max(0, m.fall) / 1.6;
        m.core.position.set(m.x + t * 40, m.y + t * 90, m.z + t * 22); m.core.rotation.x += dt * 4;
        m.trail.lookAt(m.x + 80, m.y + 180, m.z + 44); m.trail.rotateX(Math.PI / 2);
        if (m.fall <= 0) this.impact(m);
      } else {
        // Пожар затухает за ~4 мин, выжженная земля — за ~8
        const fire = Math.max(0, 1 - m.age / 240), burn = Math.max(0.35, 1 - m.age / 480);
        m.fires.children.forEach(f => { if (f.userData.smoke != null) { const u = (f.userData.smoke + m.age * 0.12) % 1; f.position.y = m.y + 1 + u * 14 * Math.max(0.3, fire); f.scale.setScalar(0.6 + u * 2.4); f.visible = fire > 0.05; return; } const s = (0.7 + 0.5 * Math.sin(m.age * 9 + f.userData.ph)) * fire; f.scale.set(s, s * (1 + 0.3 * Math.sin(m.age * 13 + f.userData.ph)), s); f.visible = s > 0.05; });
        w.setScorch(m.slot, m.x, m.z, m.type.scorch, burn);
        const d = Math.hypot(p.x - m.x, p.z - m.z);
        if (!bestM || d < bestM.d) bestM = { m, d, fire };
        // Убрать, когда всё собрано и пожар потух
        if (m.age > 600 && m.shards.every(s => !s.ctl.items[0].visible)) { g.scene.remove(m.core, m.fires); w.setScorch(m.slot, 0, 0, 0, 0); this.meteors.splice(this.meteors.indexOf(m), 1); }
      }
    }
    const fallingM = this.meteors.find(m => m.fall > 0);
    if (fallingM) { this.meteorLight.position.copy(fallingM.core.position); this.meteorLight.color.set(fallingM.type.color); this.meteorLight.intensity = 120; }
    else if (bestM) { this.meteorLight.position.set(bestM.m.x, bestM.m.y + 2.5, bestM.m.z); this.meteorLight.color.set(bestM.m.type.color); this.meteorLight.intensity = 18 * Math.max(0.25, bestM.fire) * (0.85 + 0.15 * Math.sin(performance.now() / 90)); }
    else this.meteorLight.intensity = 0;
    // Сутки: длинный день, короткая ночь
    const cyc = E.day_sec + E.night_sec; g.state.dayT = (g.state.dayT + dt) % cyc;
    const t = g.state.dayT, ds = E.dusk_sec;
    let n = t < E.day_sec - ds ? 0 : t < E.day_sec ? (t - (E.day_sec - ds)) / ds : t < cyc - ds ? 1 : 1 - (t - (cyc - ds)) / ds;
    n = n * n * (3 - 2 * n);
    // Буря
    const SC = E.storm;
    if (g.ti() < SC.max_ti) this.stormT -= dt;
    if (!this.stormOn && this.stormT <= SC.warn_sec && !this.warned) { this.warned = true; g.ui.toast('🌪️ Приближается пыльная буря! Укройся или держись ближе к базе', 'warn'); g.qa.event('storm_warn', {}); }
    if (!this.stormOn && this.stormT <= 0) { this.stormOn = true; this.stormDur = rnd(...SC.dur_sec); g.qa.event('storm', {}); }
    if (this.stormOn) { this.stormDur -= dt; if (this.stormDur <= 0) { this.stormOn = false; this.warned = false; this.stormT = rnd(...SC.every_sec); g.ui.toast('Буря стихла'); } }
    this.storm += ((this.stormOn ? 1 : 0) - this.storm) * Math.min(1, dt * 0.35);
    // Тёмные зоны (обломки, пещера) — как ночь
    // Темнее только глубоко внутри зоны (0.55 r), плавно; снаружи и на подходе — обычный день
    let inDark = 0, dz = null;
    for (const z of this.darkZones) { const k = 1 - Math.hypot(p.x - z.x, p.z - z.z) / (z.r * 0.55); if (k > 0 && k * 0.85 > inDark) { inDark = Math.min(0.85, k * 1.6); dz = z; } }
    this.darkAmt = (this.darkAmt || 0) + (inDark - (this.darkAmt || 0)) * Math.min(1, dt * 2); inDark = this.darkAmt;
    this.darkName = inDark > 0.4 ? dz?.name : null;
    g.player.indoor = inDark > 0.3; g.player.night = n;
    const nn = Math.max(n, inDark);
    this.night = n;
    w.applyAtmos(nn, this.storm, SC.color);
    g.drainMul = 1 + (SC.o2_mul - 1) * this.storm;
    // Свет: налобный фонарь ночью/во тьме, фонари — ближайшие 6
    { const f = g.player.forward(); this.headlamp.intensity = 45 * nn; this.headlamp.position.set(p.x + f.x * 0.6, p.y + 1.45, p.z + f.z * 0.6); this.headlamp.target.position.set(p.x + f.x * 14, g.world.heightAt(p.x + f.x * 14, p.z + f.z * 14), p.z + f.z * 14); }
    const lamps = g.state.lamps.filter(l => l.obj).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    this.lights.forEach((L, i) => { const l = lamps[i]; if (!l) { L.intensity = 0; return; } L.position.set(l.x, g.world.heightAt(l.x, l.z) + 1.7, l.z); L.intensity = 8 + 30 * nn; });
    // Ледяная пещера
    if (this.iceCave && !this.iceCave.open) {
      const gt = this.iceCave.p.gate, v = g.state.stats[gt.stat] || 0, prog = Math.min(1, v / gt.value);
      this.iceCave.obj.children.forEach(c => { if (c.material?.transparent) c.material.opacity = 0.9 - 0.4 * prog; });
      if (prog >= 1) { this.iceCave.open = true; g.ui.stageBanner({ name: this.iceCave.p.name }, 'Тысячелетний лёд растаял'); g.qa.event('cave_open', {}); }
    }
    if (this.iceCave?.open && !this.iceCave.melted) {
      const ice = this.iceCave.obj.children.filter(c => c.material?.transparent);
      ice.forEach(c => { c.scale.y *= 1 - Math.min(0.9, dt * 0.5); if (c.scale.y < 0.05) c.visible = false; });
      if (ice.every(c => !c.visible)) this.iceCave.melted = true;
    }
    this.nearC = this.nearestContainer();
    this.nearM = this.nearestMeteor();
  }
}
