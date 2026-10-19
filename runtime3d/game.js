// Игровая логика «Терры»: ресурсы, добыча, инвентарь, крафт, постройки, терраформирование, выживание, сейв, монетизация.
import * as THREE from 'three';
import { rng } from './noise.js';
import { Life } from './life.js';
import { Explore } from './explore.js';
import { Builder } from './build.js';
import { Interiors } from './interior.js';
import { Blockout } from './blockout.js';
import { VehicleBody, rigWheels, animWheels } from './vehicle.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  constructor({ scene, world, models, player, cfg, platform, ui, qa }) {
    Object.assign(this, { scene, world, models, player, cfg, platform, ui, qa });
    this.T = cfg.terraform;
    this.S = cfg.survival;
    this.M = cfg.monetization;
    this.state = {
      stats: { heat: 0, pressure: 0, oxygen: 0, biomass: 0 },
      inv: {}, buildings: [], mined: {}, flags: {}, o2: this.S.o2_max, hp: this.S.hp_max,
      craftQueue: [], boosts: {}, cooldowns: {}, lastSeen: Date.now(), playtime: 0, stageSeen: 0,
    };
    this.time = 0;
    this.safe = false;
    this.dead = false;
    this.target = null;
    this.placing = null;
    this.storages = [];
    this.load();
    this.life = new Life(this);
    this.S = { ...this.S };
    this.explore = new Explore(this);
    this.builder = new Builder(this);
    // Стартовые цели: трекер на экране, награда + салют за каждую
    this.state.goal ??= 0; this.state.goalN ??= 0;
    this.qa.listeners?.push((n, d) => this.goalEvent(n, d));
    this.interiors = new Interiors(this);
    this.blockout = new Blockout(this);
    this.player.groundAt = (x, z, h) => this.blockout.groundAt(x, z, this.interiors.groundAt(x, z, this.builder.groundAt(x, z, h)));
    this.player.collide = q => { this.builder.collide(q); this.interiors.collide(q); this.blockout.collide(q); };
    this.player.ceilAt = (x, z, y) => this.blockout.ceilAt(x, z, y) ?? this.interiors.ceilAt(x, z, y) ?? this.builder.ceilAt(x, z, y);
    this.player.camClamp = (t, c) => this.blockout.camClamp(t, c) ?? this.interiors.camClamp(t, c);
  }

  // ---------- Сейв ----------
  saveKey() { return 'gf3d:' + this.cfg.slug; }
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(this.saveKey()));
      if (s && !new URLSearchParams(location.search).has('fresh')) { Object.assign(this.state, s); this.state.stats = { heat: 0, pressure: 0, oxygen: 0, biomass: 0, ...s.stats }; }
    } catch {}
  }
  saveSoon() { clearTimeout(this._svT); this._svT = setTimeout(() => this.save(), 400); }
  save() { if (this.restarting || this.staleTab) return; this.state.lastSeen = Date.now();
    try { if (this.explore) this.state.meteors = this.explore.serializeMeteors(); } catch {}
    if (!this.dead && this.player?.pos && !this.driving) { const p = this.player.pos; this.state.pos = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +this.player.yaw.toFixed(3) }; }
    else if (this.driving) { const V = this.driving, a = V.b.rot + Math.PI / 2; this.state.pos = { x: +(V.b.x + Math.cos(a) * 2).toFixed(2), z: +(V.b.z - Math.sin(a) * 2).toFixed(2), yaw: +this.player.yaw.toFixed(3) }; }
    try { localStorage.setItem(this.saveKey(), JSON.stringify(this.state)); } catch {} }

  // ---------- Мир: ресурсы, флора, постройки ----------
  populate() {
    const W = this.cfg.world, w = this.world, R = rng(W.seed + 11);
    // Стартовый купол — первым: ресурсы и флора вокруг него не спавнятся внутри
    if (this.state.baseDome) this.spawnBaseDome(this.state.baseDome, false);
    else { const L = W.props.find(p => p.model === 'lander'); if (L) this.safeZone = { x: L.x, z: L.z, r: 4.5, lander: true }; }
    const pick = (bias) => {
      for (let a = 0; a < 60; a++) {
        let x, z;
        if (bias.startsWith('near:')) { const [, a0, a1, cx = 0, cz = 0] = bias.split(':').map(Number), ang = R() * 6.28, r = a0 + R() * (a1 - a0); x = cx + Math.cos(ang) * r; z = cz + Math.sin(ang) * r; }
        else if (bias.startsWith('poi:')) {
          const spots = [...(W.pois || []).filter(q => q.type === 'station' || q.type === 'ship'), { x: -122, z: 60 }];
          const c = spots[Math.floor(R() * spots.length)], ang = R() * 6.28, r = 8 + R() * 14;
          x = c.x + Math.cos(ang) * r; z = c.z + Math.sin(ang) * r;
        } else if (bias.startsWith('zone:')) {
          const zone = W.zones.find(q => q.id === bias.slice(5));
          const ang = R() * Math.PI * 2, r = Math.sqrt(R()) * zone.r * 0.9;
          x = zone.x + Math.cos(ang) * r; z = zone.z + Math.sin(ang) * r;
        } else if (bias.startsWith('feat:')) {
          const f = W.features.find(q => q.id === bias.slice(5)), ang = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.9;
          x = f.x + Math.cos(ang) * r * (f.rx || f.r); z = f.z + Math.sin(ang) * r * (f.rz || f.r);
        } else { const S = Math.min(w.size, W.core || w.size); x = (R() - 0.5) * S * 0.8; z = (R() - 0.5) * S * 0.8; }
        const y = w.heightAt(x, z), slope = w.slopeAt(x, z);
        if (slope > 0.35) continue;
        if (!bias.startsWith('near:') && Math.hypot(x, z) < 14) continue;
        if (bias.startsWith('near:') && ((W.dome_wreck || []).some(d => Math.hypot(x - d.x, z - d.z) < 4) || (W.props || []).some(q => Math.hypot(x - q.x, z - q.z) < 4))) continue;
        if (this.builder.domeAt?.(x, z, 2)) continue;
        if ((W.keepout || []).some(k => Math.hypot(x - k.x, z - k.z) < k.r)) continue;   // блокинг/ориентиры: без камней и ресурсов внутри
        if (!bias.startsWith('zone:') && !bias.startsWith('poi:') && !bias.startsWith('feat:') && W.zones.some(q => Math.hypot(x - q.x, z - q.z) < q.r)) continue;
        if (bias === 'basin' && !this.world.pools.some(q => Math.hypot(x - q.f.x, z - q.f.z) < q.f.r * 1.2)) continue;
        if (bias === 'ridge' && y < 3) continue;
        return { x, y, z };
      }
      return null;
    };
    // Ресурсы
    this.nodes = [];
    this.nodeSets = {};
    for (const [key, spec] of Object.entries(W.resources)) {
      if (key.startsWith('_')) continue; const res = spec.res || key;
      const list = [];
      for (let i = 0; i < spec.count; i++) {
        const p = pick(spec.bias); if (!p) continue;
        list.push({ x: p.x, y: p.y - 0.05, z: p.z, rot: R() * 6.28, scale: 0.85 + R() * 0.4 });
      }
      if (spec.min_flora) list.forEach(t => { t.visible = false; t.minFlora = spec.min_flora; });
      const berry = res === 'res_berry';
      const ctl = this.models.scatter(this.scene, berry ? 'bush_berry' : res, list, { shadows: !berry });
      // Под ягодником — «пустой» зелёный куст: виден, когда ягоды собраны
      if (berry) { ctl.empty = this.models.scatter(this.scene, 'bush', list.map(t => ({ ...t, visible: false })), { shadows: false }); }
      ctl.minFlora = spec.min_flora || 0;
      this.nodeSets[key] = ctl;
      list.forEach((t, i) => this.nodes.push({ res, i, x: t.x, y: t.y, z: t.z, key: key + ':' + i, ctl }));
    }
    // Восстановление добытых (респаун через 3 мин)
    for (const n of this.nodes) { const t = this.state.mined[n.key]; if (t && Date.now() - t < 180000) { n.ctl.set(n.i, { visible: false }); n.mined = t; } }
    for (const c of Object.values(this.nodeSets)) c.flush();
    this.syncBerries();
    // Декор
    for (const [id, count] of Object.entries(W.decor)) {
      if (id.startsWith('_')) continue;
      const list = [];
      for (let i = 0; i < count; i++) { const p = pick('plains'); if (p) list.push({ x: p.x, y: p.y - 0.2, z: p.z, rot: R() * 6.28, scale: 0.6 + R() * 1.2 }); }
      this.models.scatter(this.scene, id, list, { shadows: id === 'boulder' });
      if (id === 'boulder') list.forEach(t => this.player.addSolid(t.x, t.z, 0.9 * t.scale));
    }
    // Декор регионов: крупные кристаллы, ледяные торосы, обсидиановые шпили — масштаб и наполнение
    for (const D of W.region_decor || []) {
      const f = W.features.find(q => q.id === D.feat); if (!f) continue; const list = [], [s0, s1] = D.scale || [1, 2];
      for (let i = 0; i < D.count * 3 && list.length < D.count; i++) {
        const a = R() * 6.28, r = Math.sqrt(R()) * 0.95, x = f.x + Math.cos(a) * r * (f.rx || f.r * (f.type === 'geode' ? 1.5 : 1)), z = f.z + Math.sin(a) * r * (f.rz || f.r * (f.type === 'geode' ? 1.5 : 1));
        if (w.slopeAt(x, z) > 0.45 || (W.landmarks || []).some(L => Math.hypot(x - L.x, z - L.z) < L.r + 4)) continue;
        if ((W.keepout || []).some(k => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
        const sc = s0 + Math.pow(R(), 1.6) * (s1 - s0), t = D.tilt || 0;
        list.push({ x, y: w.heightAt(x, z) - (D.sink || 0.1) * sc, z, rot: R() * 6.28, scale: sc, tilt: t ? { x: (R() - 0.5) * t, z: (R() - 0.5) * t } : null });
      }
      const ctl = this.models.scatter(this.scene, D.model, list, { shadows: true }); (this.regionDecor ||= []).push({ ctl, list });
      if (D.solid) list.forEach(t => { t.solid = { x: t.x, z: t.z, r: D.solid * t.scale }; this.player.addSolid(t.x, t.z, t.solid.r); t.solid = this.player.solids.at(-1); });
    }
    // Флора: точки заранее, видимость по стадии
    this.flora = [];
    for (const f of this.T.flora_models) {
      const list = [];
      for (let i = 0; i < f.count; i++) {
        let p = null;
        for (let a = 0; a < 20 && !p; a++) {
          const c = pick('plains') || pick('basin'); if (!c) continue;
          // Не на дне будущих озёр; «у воды» — в кольце вокруг бассейнов
          const pool = this.world.pools.find(q => Math.hypot(c.x - q.f.x, c.z - q.f.z) < q.f.r * 2.4);
          if (f.near === 'in_water') { const q = this.world.pools[Math.floor(R() * this.world.pools.length)]; if (!q) break; const a = R() * 6.28, d = Math.sqrt(R()) * q.f.r * 1.1, x = q.f.x + Math.cos(a) * d, z = q.f.z + Math.sin(a) * d, y = this.world.heightAt(x, z); if (y < q.maxLevel - 0.6) p = { x, y, z, pool: q }; continue; }
          if (pool && c.y < pool.maxLevel + 0.15) continue;
          if (c.y > 6 || this.builder.domeAt(c.x, c.z, 1.5)) continue;
          if (f.near === 'water' && !pool && R() < 0.75) continue;
          p = c;
        }
        if (p) list.push({ x: p.x, y: p.y - 0.03, z: p.z, rot: R() * 6.28, scale: (0.7 + R() * 0.7) * (f.size || 1), th: f.from + R() * (f.near === 'in_water' ? 0.15 : (1 - f.from) * 0.6), visible: false, pool: p.pool });
      }
      const ctl = this.models.scatter(this.scene, f.model, list, { shadows: f.model === 'tree' });
      this.flora.push({ spec: f, ctl, list, shown: 0 });
    }
    // Пропсы базы
    this.workbenches = [];
    for (const p of W.props) {
      if (p.dome) continue;
      const o = this.models.instance(p.model);
      o.position.set(p.x, this.groundY(p.x, p.z), p.z); o.rotation.y = p.rot || 0;
      this.scene.add(o);
      if (p.safe_zone) this.safeZone = { x: p.x, z: p.z, r: p.safe_zone };
      if (p.interact === 'craft') { this.workbench = { x: p.x, z: p.z }; this.workbenches.push(this.workbench); }
      if (p.model !== 'dome') this.player.addSolid(p.x, p.z, p.model === 'lander' ? 2.4 : 0.7);
      if (p.storage) this.storages.push({ key: 'prop:' + p.x + ',' + p.z, x: p.x, z: p.z, slots: p.storage, name: p.name || 'Ящик' });
    }
    this.state.stash ??= {};
    // Сохранённые постройки
    for (const b of this.state.buildings) this.spawnBuilding(b, false);
    this.world.buildGates(this.models);
    this.player.devJet = !!this.state.devJet;
    this.explore.populate();
    this.blockout.build();
    this.builder.populate();
    for (const p of this.state.house) if (this.builder.P[p.id]?.store) this.storages.push(this.builder.storageOf(p));
  }

  // Пустые кусты там, где ягоды собраны, но зелень уже выросла
  syncBerries() {
    const c = this.nodeSets.res_berry; if (!c?.empty) return;
    const grown = this.world.flora >= c.minFlora;
    c.items.forEach((it, i) => { const want = grown && !it.visible; if (c.empty.items[i].visible !== want) c.empty.set(i, { visible: want }); });
    c.empty.flush();
  }
  spawnBuilding(b, fresh) {
    const o = this.models.instance(b.model);
    o.position.set(b.x, b.y ?? this.groundY(b.x, b.z), b.z); o.rotation.y = b.rot || 0;
    this.scene.add(o);
    this.player.addSolid(b.x, b.z, 0.8);
    const R = this.cfg.recipes.find(r => r.id === b.recipe);
    if (b.recipe === 'workbench') (this.workbenches ||= []).push({ x: b.x, z: b.z });
    if (R?.vehicle) { this.vehicles ??= []; const V = { b, obj: o, cfg: this.cfg.vehicles[b.recipe], speed: 0 }; V.body = new VehicleBody(this, V); V.body.apply(); queueMicrotask(() => this.applyUpgrades()); try { rigWheels(V); } catch (e) { (window.__qa?.errors || []).push('wheels: ' + e.message); } this.vehicles.push(V); return o; }
    if (R?.storage) this.storages.push({ key: 'b:' + b.x.toFixed(2) + ',' + b.z.toFixed(2), x: b.x, z: b.z, slots: R.storage, name: R.name });
    if (fresh) { o.scale.setScalar(0.01); this.pop = this.pop || []; this.pop.push({ o, t: 0 }); }
    // Светящаяся «колонна» выхлопа над машиной
    return o;
  }

  // ---------- Терраформирование ----------
  // ref — высота, от которой ищем пол (колесо/ноги): мосты и полы блокинга учитываются, если ниже ref + шаг
  groundY(x, z, ref) { const h = this.builder.groundAt(x, z, this.world.heightAt(x, z)); return ref == null || !this.blockout?.col ? h : this.blockout.col.groundAt(x, z, ref, h); }
  // Мелкие постройки (сундук, фонарь и т.п.) можно ставить внутри модулей; машины — только снаружи
  indoorOk(r) { return !!(r.storage || r.indoor); }
  // ---------- Транспорт ----------
  nearVehicle() { if (this.driving) return null; const p = this.player.pos; return (this.vehicles || []).find(V => Math.hypot(V.b.x - p.x, V.b.z - p.z) < 3.2) || null; }
  toggleDrive() {
    if (this.driving) { const V = this.driving; this.driving = null; this.player._lockRot = false; this.player.obj.rotation.set(0, V.b.rot, 0); this.sfx?.play('engine_stop'); const a = V.b.rot + Math.PI / 2, vy = (V.body?.pos.y ?? this.groundY(V.b.x, V.b.z)) + 0.6;
      // сбоку от машины; если там стена/обрыв (тоннель, мост) — с другой стороны, иначе на место машины. ref = высота машины → пол тоннеля, а не земля под ним
      let ex = V.b.x, ez = V.b.z, ey = this.groundY(ex, ez, vy);
      for (const sg of [1, -1]) { const x = V.b.x + Math.cos(a) * 2 * sg, z = V.b.z - Math.sin(a) * 2 * sg, y = this.groundY(x, z, vy), q = { x, z }; this.blockout?.col?.collide(q, { x: V.b.x, z: V.b.z }, vy - 0.6);
        if (Math.abs(y - (vy - 0.6)) < 1.2 && Math.hypot(q.x - x, q.z - z) < 0.05) { ex = x; ez = z; ey = y; break; } }
      this.player.pos.set(ex, ey + 0.05, ez); this.player.obj.visible = true; this.player.resetFall(1); this.player.driving = null; this.save(); return; }
    const V = this.nearVehicle(); if (!V) return; this.driving = V; this.player.driving = V; V.speed = 0; this.player.yaw = V.b.rot + Math.PI; this.sfx?.play('engine_start'); this.qa.event('drive', {});
  }
  // «Вытащить из застревания» (настройки): марсоход рядом/под нами — на ближайшую ровную точку колёсами вниз; иначе — героя.
  safeSpot(x0, z0, opt = {}) {
    const W = this.world, B = this.builder, ko = this.cfg.world.keepout || [], sz = this.safeZone, R = opt.r || 0.8;
    const okAt = (x, z) => {
      const h = W.heightAt(x, z); if (W.waterAt(x, z) > h - 0.2) return false;
      if (W.blocked(x, z) || W.slopeAt(x, z) > 0.1) return false;
      if (ko.some(k => Math.hypot(x - k.x, z - k.z) < k.r)) return false;
      if (B.domeAt(x, z, R + 1) || B.modOfPos(x, z) || B.dockAt(x, z)) return false;
      if (this.player.nearSolids(x, z).some(s => Math.hypot(x - s.x, z - s.z) < s.r + R)) return false;
      if ((this.vehicles || []).some(V => V !== opt.skip && Math.hypot(V.b.x - x, V.b.z - z) < 3.5)) return false;
      // пятно под машиной/героем ровное, и это не дно ямы (вокруг на 6 м не выше чем на 1.2 м)
      let lo = h, hi = h, ring = 0; for (let a = 0; a < 8; a++) { const an = a / 8 * Math.PI * 2, c = Math.cos(an), s = Math.sin(an);
        const hn = W.heightAt(x + c * R * 1.6, z + s * R * 1.6); lo = Math.min(lo, hn); hi = Math.max(hi, hn); ring += W.heightAt(x + c * 6, z + s * 6) / 8; }
      return hi - lo < (opt.flat || 0.45) && ring - h < 1.2;
    };
    // Кольцами от точки; при равной дистанции — ближе к базе (выход из ямы обычно в её сторону)
    for (let r = 0; r <= 40; r += 2) { const n = Math.max(1, Math.round(r * 1.6)), cand = [];
      for (let k = 0; k < n; k++) { const an = k / n * Math.PI * 2, x = x0 + Math.cos(an) * r, z = z0 + Math.sin(an) * r; if (okAt(x, z)) cand.push([x, z, sz ? Math.hypot(x - sz.x, z - sz.z) : 0]); }
      if (cand.length) { cand.sort((a, b) => a[2] - b[2]); return { x: cand[0][0], z: cand[0][1] }; } }
    // ничего ровного рядом — у шлюза купола базы
    const d = this.state.baseDome; if (d) return { x: d.x + Math.cos(d.door) * (d.r + 4), z: d.z + Math.sin(d.door) * (d.r + 4) };
    return { x: x0, z: z0 };
  }
  unstuck() {
    const p = this.player.pos, V = this.driving || (this.vehicles || []).filter(V => Math.hypot(V.b.x - p.x, V.b.z - p.z) < 40).sort((a, b) => Math.hypot(a.b.x - p.x, a.b.z - p.z) - Math.hypot(b.b.x - p.x, b.b.z - p.z))[0];
    if (V) {
      const B = V.body, q = this.safeSpot(V.b.x, V.b.z, { r: 2.2, flat: 0.6, skip: V }), h = this.groundY(q.x, q.z);
      B.pos.set(q.x, h + (B.C.wheelR || 0.36) + (B.C.travel || 0.45) * 0.5, q.z);
      B.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), V.b.rot || 0);   // колёсами вниз, курс прежний
      B.vel.set(0, 0, 0); B.w.set(0, 0, 0); V.speed = 0; B.wake(); B.apply();
      if (!this.driving) { const a = V.b.rot + Math.PI / 2, x = q.x + Math.cos(a) * 2.6, z = q.z - Math.sin(a) * 2.6; this.player.pos.set(x, this.groundY(x, z) + 0.1, z); }
      this.player.vel.set(0, 0, 0); this.player.resetFall(2); this.qa.event('unstuck', { rover: true, x: q.x, z: q.z });
      return 'rover';
    }
    const q = this.safeSpot(p.x, p.z); this.player.pos.set(q.x, this.groundY(q.x, q.z) + 0.1, q.z); this.player.vel.set(0, 0, 0); this.player.resetFall(2);
    this.qa.event('unstuck', { rover: false, x: q.x, z: q.z }); return 'player';
  }
  preDrive(dt) { this.player.input.poll?.(); this.player._dm = this.player.input.move.clone(); this.updateVehicles(dt); }
  updateVehicles(dt) {
    // физика всех машин (припаркованные тоже катятся под горку, пока не уснут)
    for (const V of this.vehicles || []) {
      const drv = V === this.driving, inp = this.player.input, mv = drv ? (this.player._dm || inp.move) : null;
      if (drv) V.body.wake();
      V.body.step(dt, drv ? { x: mv.x || 0, y: mv.y || 0, run: inp.run } : null); V.body.apply(); animWheels(V, dt);
    }
    const V = this.driving; if (!V) return; const C = V.cfg;
    // сиденье — точка в системе машины: герой жёстко на корпусе
    const seat = new THREE.Vector3(C.seat_x || 0, C.seat_y - 0.9, C.seat_fwd || 0).applyMatrix4(V.obj.matrixWorld);
    const P = this.player; P._seat = seat; P.pos.copy(seat); P.obj.position.copy(seat); P.obj.quaternion.copy(V.obj.quaternion); P.facing = V.b.rot; P._lockRot = true;
    P.speedNow = 0; P.grounded = true; P.vel.set(0, 0, 0); P.resetFall(0.5);
    if (Math.abs(V.speed) > 1) P.yaw += (((V.b.rot + Math.PI) - P.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 1.5);
  }
  // ---------- Купол базы: строится один раз, внутри сразу фабрикатор и сундук ----------
  spawnBaseDome(d, fresh) {
    const D = this.builder.addDome(d, fresh); D.starter = true; this.safeZone = { x: d.x, z: d.z, r: d.r };
    const c = Math.cos(d.door), s = Math.sin(d.door), at = (fwd, side) => [d.x - c * fwd - s * side, d.z - s * fwd + c * side];   // fwd — вглубь от шлюза
    const put = (model, [x, z], rot) => { const o = this.models.instance(model); o.position.set(x, d.y + 0.2, z); o.rotation.y = rot; this.scene.add(o); this.player.addSolid(x, z, 0.6); if (fresh) { o.scale.setScalar(0.01); (this.pop ||= []).push({ o, t: 0 }); } return o; };
    const face = Math.atan2(c, s);   // лицом к шлюзу
    const wb = at(d.r * 0.55, -d.r * 0.25); put('workbench', wb, face); this.workbench = { x: wb[0], z: wb[1] }; (this.workbenches ||= []).push(this.workbench);
    const ch = at(d.r * 0.35, d.r * 0.5); put('chest', ch, face - 0.6); this.storages.push({ key: 'prop:base', x: ch[0], z: ch[1], slots: 8, name: 'Ящик базы' });
  }
  placeBaseDome() {
    const B = this.builder; B.start('__dome'); return true;
  }
  recipeById(id) { return (this._rc ||= Object.fromEntries(this.cfg.recipes.map(r => [r.id, r])))[id]; }
  ti() { const s = this.state.stats; return s.heat + s.pressure + s.oxygen + s.biomass; }
  rates() {
    const r = { heat: 0, pressure: 0, oxygen: 0, biomass: 0 };
    // Отдача — всегда из текущего рецепта (в сейве могли остаться значения старого баланса)
    for (const b of this.state.buildings) { const R = this.recipeById(b.recipe); for (const [k, v] of Object.entries(R?.gives || {})) r[k] += v; }
    for (const [k, v] of Object.entries(this.interiors?.gives() || {})) r[k] += v;
    const boost = ((this.state.boosts.ti || 0) > Date.now() ? 2 : 1) * (this.T.kick_until && this.ti() < this.T.kick_until ? this.T.kick_mul : 1); // стартовый разгон: первая стадия за пару минут
    for (const k in r) r[k] *= boost * (this.T.speed || 1) * (this.devSpeed || 1);
    return r;
  }
  stage() { const st = this.T.stages; let k = 0; while (k < st.length - 1 && this.ti() >= st[k + 1].ti) k++; return k; }

  // ---------- Инвентарь ----------
  // Расход O₂ в секунду: бег и буря дороже. Для UI — запас хода и время до купола.
  o2Rate() { const p = this.player; return this.S.o2_drain * (p.speedNow > (this.cfg.player.walk + this.cfg.player.run) / 2 ? this.S.o2_run_mul || 1 : 1) * (this.drainMul || 1) * (this.devDrain ?? 1); }
  o2Info() {
    const p = this.player.pos, sz = this.safeZone, rate = this.S.o2_drain * (this.drainMul || 1) * (this.devDrain ?? 1);
    const left = rate > 0 ? this.state.o2 / rate : Infinity;
    // До ближайшего места, где дышится: купол или фабрикатор на базе
    const dDome = sz ? Math.max(0, Math.hypot(p.x - sz.x, p.z - sz.z) - sz.r) : Infinity, w = this.workbench;
    const dBench = w && this.S.bench_safe_r ? Math.max(0, Math.hypot(p.x - w.x, p.z - w.z) - this.S.bench_safe_r) : Infinity;
    const home = Math.min(dDome, dBench) === Infinity ? 0 : Math.min(dDome, dBench) / this.cfg.player.walk;
    return { left, home, breathable: this.ti() >= this.T.breathable_ti };
  }
  slots() { return this.explore ? this.explore.slots() : this.cfg.player.inventory_slots; }
  usedSlots() { return Object.values(this.state.inv).reduce((s, n) => s + Math.ceil(n / this.cfg.player.stack), 0); }
  canAdd(item, n = 1) {
    const st = this.cfg.player.stack, have = this.state.inv[item] || 0;
    return this.usedSlots() - Math.ceil(have / st) + Math.ceil((have + n) / st) <= this.slots();
  }
  add(item, n = 1) { if (!this.canAdd(item, n)) return false; this.state.inv[item] = (this.state.inv[item] || 0) + n; this.qa.event('item', { item, n }); return true; }
  // ---------- Онбординг: цепочка коротких целей ----------
  // Цель уже выполнена раньше (порядок действий игрока другой) — засчитать сразу, чтобы не висела
  goalAlreadyDone(G) {
    const c = G?.done_if, s = this.state; if (!c) return false;
    if (c.gear && Object.entries(c.gear).every(([k, v]) => (s.gear?.[k] || 0) >= v)) return true;
    if (c.built && s.buildings.some(b => b.recipe === c.built)) return true;
    if (c.modules && (s.modules?.length || 0) >= c.modules) return true;
    if (c.looted && s.looted?.[c.looted] === true) return true;
    if (c.have && this.has(c.have)) return true;
    return false;
  }
  goal() { const G0 = (this.cfg.onboarding || [])[this.state.goal]; if (G0 && !this._gd && this.goalAlreadyDone(G0)) { this._gd = 1; setTimeout(() => { this._gd = 0; if (this.goal() === G0) this.goalEvent(G0.event, { force: 1 }); }); }
    const G = (this.cfg.onboarding || [])[this.state.goal]; if (G && G.event === 'stage' && this.stage() >= 1 && !this._gs) { this._gs = 1; setTimeout(() => { this._gs = 0; this.goalEvent('stage'); }); } return G; }
  // Куда идти по цели (для дистанции в трекере и маркера)
  goalPos(G) {
    if (G.id === 'crate') return this.explore.containers.find(c => c.key === 'poi:starter_crate' && !c.done);
    if (G.id === 'wreck') { const p = this.player.pos; return this.explore.wrecks.filter(w => !w.done).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] || null; }
    if (G.id === 'dome_enter' && this.state.baseDome) { const d = this.state.baseDome; return { x: d.x + Math.cos(d.door) * (d.r + 0.5), z: d.z + Math.sin(d.door) * (d.r + 0.5) }; }
    
    if (G.id === 'meteor') { const m = this.explore.meteors.find(m => !m.opened && m.fall <= 0); return m ? { x: m.x, z: m.z } : null; }
    if (G.id === 'mine') { const p = this.player.pos; let best = null, bd = 1e9; for (const n of this.nodes) { if (n.mined || !['res_iron', 'res_silicon', 'res_ice'].includes(n.res)) continue; const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < bd) { bd = d; best = n; } } return best; }
    if (G.id === 'bag_res') { const need = Object.entries(G.done_if.have).filter(([k, v]) => !this.has({ [k]: v })).map(([k]) => this.cfg.items[k].from), p = this.player.pos; let best = null, bd = 1e9;
      for (const n of this.nodes) { if (n.mined || !need.includes(n.res) || !n.ctl.items[n.i].visible) continue; const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < bd) { bd = d; best = n; } } return best; }
    if (G.id === 'learn' || G.id === 'gear_open') return this.workbench && !this.nearBench ? this.workbench : null;
    if (G.id === 'find_crew') { const p = this.player.pos; return this.explore.containers.filter(c => c.table === 'body' && !c.done).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] || null; }
    if (G.event === 'visit_poi') { const q = this.cfg.world.pois.find(q => q.id === G.poi); return q ? { x: q.x, z: q.z + (q.type === 'ice_cave' ? 8 : 0) } : null; }
    if (G.event === 'build' || G.id === 'learn') return null;
    return null;
  }
  goalEvent(n, d) {
    const G = this.goal(); if (!G || G.event !== n) return;
    this.state.goalN += d?.force ? (G.n || 1) : n === 'mine' ? (d?.got || 1) : 1;
    if (this.state.goalN < (G.n || 1)) return;
    this.state.goal++; this.state.goalN = 0;
    for (const [k, v] of Object.entries(G.reward || {})) this.state.inv[k] = (this.state.inv[k] || 0) + v;
    this.ui.goalDone?.(G);
    this.qa.event('goal', { id: G.id }); this.save();
  }
  // ---------- Сундуки: хранилище по ключу, ячейка = стопка до stack ----------
  stashOf(st) { return (this.state.stash[st.key] ??= {}); }
  stashUsed(st) { return Object.values(this.stashOf(st)).reduce((s, n) => s + Math.ceil(n / this.cfg.player.stack), 0); }
  // Переложить n штук item: dir 'in' (рюкзак → сундук) или 'out'. Возвращает, сколько переложено.
  moveStash(st, item, n, dir) {
    const S = this.stashOf(st), stack = this.cfg.player.stack;
    const from = dir === 'in' ? this.state.inv : S, to = dir === 'in' ? S : this.state.inv;
    n = Math.min(n, from[item] || 0); let moved = 0;
    for (; moved < n; moved++) {
      if (dir === 'in') { const have = S[item] || 0; if (this.stashUsed(st) - Math.ceil(have / stack) + Math.ceil((have + 1) / stack) > st.slots) break; }
      else if (!this.canAdd(item, 1)) break;
      to[item] = (to[item] || 0) + 1; from[item]--;
    }
    if (!from[item]) delete from[item];
    if (moved) this.save();
    return moved;
  }
  // Ближайший ящик с учётом взгляда: из соседних выбираем тот, к которому стоим лицом
  nearestStorage() { return this.pickNear(this.storages, 2.8); }
  pickNear(list, R, skip) {
    const p = this.player.pos, f = this.player.forward(); let best = null, bs = 1e9;
    for (const s of list) { if (skip?.(s)) continue; const dx = s.x - p.x, dz = s.z - p.z, d = Math.hypot(dx, dz); if (d > R) continue;
      const dot = d > 0.01 ? (dx * f.x + dz * f.z) / d : 1, sc = d - dot * 0.9; if (sc < bs) { bs = sc; best = s; } }
    return best;
  }
  // У фабрикатора крафт берёт ресурсы и из ящиков базы (в радиусе 12 м от него)
  baseStashes() { const w = this.workbench; return this.nearBench && w ? this.storages.filter(s => Math.hypot(s.x - w.x, s.z - w.z) < 12).map(s => this.stashOf(s)) : []; }
  haveAll(k) { return (this.state.inv[k] || 0) + this.baseStashes().reduce((a, S) => a + (S[k] || 0), 0); }
  has(cost) { return Object.entries(cost).every(([k, v]) => this.haveAll(k) >= v); }
  take(cost) {
    if (!this.has(cost)) return false;
    const bags = [this.state.inv, ...this.baseStashes()];
    for (const [k, v] of Object.entries(cost)) { let need = v; for (const B of bags) { const t = Math.min(need, B[k] || 0); if (t) { B[k] -= t; need -= t; if (B[k] <= 0) delete B[k]; } if (!need) break; } }
    return true;
  }
  use(item) {
    const it = this.cfg.items[item]; if (!it?.use || !this.state.inv[item]) return false;
    this.take({ [item]: 1 });
    if (it.use.o2) this.state.o2 = Math.min(this.S.o2_max, this.state.o2 + it.use.o2);
    if (it.use.hp) this.state.hp = Math.min(this.S.hp_max, this.state.hp + it.use.hp);
    this.ui.toast(`${it.name}: использовано`);
    return true;
  }

  // ---------- Добыча ----------
  nearestNode(maxD) {
    const p = this.player.pos; let best = null, bd = maxD;
    for (const n of this.nodes) {
      if (!n.ctl.items[n.i].visible) continue;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  startMine(node) {
    this.sfx?.play('mine_hit');
    if (this.player.mining > 0 || !node) return;
    const item = Object.keys(this.cfg.items).find(k => this.cfg.items[k].from === node.res);
    if (!this.canAdd(item, 1)) { this.ui.toast(this.cfg.texts.inventory_full, 'warn'); return; }
    this.mineNode = node;
    const fast = this.state.flags.fast_mine ? 2 : 1;
    this.player.mining = this.mineTime();
    this.player.facing = Math.atan2(node.x - this.player.pos.x, node.z - this.player.pos.z);
  }
  mineTime() { return this.cfg.player.mine_time / (this.state.flags.fast_mine ? 2 : 1) / (this.player.mineMul || 1); }
  finishMine() {
    this.sfx?.play('mine_done');
    const node = this.mineNode; this.mineNode = null;
    const item = Object.keys(this.cfg.items).find(k => this.cfg.items[k].from === node.res);
    const dbl = (this.state.boosts.mine || 0) > Date.now();
    const n = (dbl ? 2 : 1) * (1 + (Math.random() < 0.35 ? 1 : 0));
    let got = 0; for (let i = 0; i < n; i++) if (this.add(item, 1)) got++;
    node.ctl.hide(node.i);
    if (node.res === 'res_berry') this.syncBerries();
    this.state.mined[node.key] = node.mined = Date.now();
    this.ui.pickup(item, got, node);
    this.qa.event('mine', { res: node.res, got });
    this.life?.quest(node.res === 'res_berry' ? 'berries' : 'mine', got);
    this.stats.mined += got;
  }

  // ---------- Крафт и постройка ----------
  recipeState(r) {
    const ti = this.ti(), L = this.life?.L;
    let locked = !!(r.unlock_ti && ti < r.unlock_ti), why = locked ? `Ti ${r.unlock_ti}` : '';
    if (r.unlock_life != null && (!L?.started || L.stage < r.unlock_life)) { locked = true; why = L?.started ? `эпоха «${this.cfg.evolution.stages[r.unlock_life].name}»` : 'зарождение жизни'; }
    if (r.needs_bp && !(this.state.bps?.[r.needs_bp] >= 1)) { locked = true; why = 'нужен чертёж'; }
    if (r.upgrade && this.state.upg?.[r.upgrade]) { locked = true; why = 'уже улучшено'; }
    const built = r.once && (this.state.buildings.some(b => b.recipe === r.id) || (r.build === '__dome' && (this.state.baseDome || this.state.domeKit)));
    if (built) { locked = true; why = 'уже построено'; }
    return { locked, why, affordable: !locked && this.has(this.costOf(r)) };
  }
  applyUpgrades() {
    for (const V of this.vehicles || []) { const U = V.cfg.upg || {}, C = V.body?.C; if (!C) continue; C._base ||= { engine: C.engine, maxSpeed: C.maxSpeed, climb_deg: C.climb_deg };
      Object.assign(C, C._base); for (const [k, on] of Object.entries(this.state.upg || {})) if (on && U[k]) { C.engine *= U[k].engine || 1; C.maxSpeed *= U[k].maxSpeed || 1; C.climb_deg += U[k].climb_deg || 0; } }
  }
  // Стоимость построек растёт с каждой копией
  costOf(r) {
    if (!r.build) return r.cost;
    const n = this.state.buildings.filter(b => b.recipe === r.id).length, k = Math.pow(this.cfg.build_cost_growth || 1, n);
    return Object.fromEntries(Object.entries(r.cost).map(([a, v]) => [a, Math.ceil(v * k)]));
  }
  craft(id, instant = false) {
    const r = this.cfg.recipes.find(x => x.id === id);
    if (!r) return false;
    const s = this.recipeState(r);
    const cost = this.costOf(r);
    if (s.locked || !this.take(cost)) return false;
    if (r.build === '__dome') { this.state.domeKit = cost; this.qa.event('craft', { id }); this.qa.event('dome_craft'); this.builder.start('__dome'); return true; }
    if (r.build) { this.startPlacing(r, cost); this.qa.event('craft', { id }); return true; }
    if (r.upgrade) { (this.state.upg ||= {})[r.upgrade] = 1; this.applyUpgrades(); this.save(); this.ui.toast(`Улучшено: ${r.name}`); this.qa.event('craft', { id }); return true; }
    const job = { id, end: this.time + (instant ? 0 : r.time), time: r.time };
    this.state.craftQueue.push(job);
    this.qa.event('craft', { id });
    return job;
  }
  async instantCraft(job) {
    if (await this.rewarded('instant_craft')) { job.end = this.time; return true; }
    return false;
  }
  startPlacing(r, cost) {
    const ghost = this.models.instance(r.build);
    ghost.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.55; c.castShadow = false; } });
    this.scene.add(ghost);
    this.placing = { r, ghost, cost: cost || r.cost };
  }
  placeOk() {
    if (!this.placing) return false;
    const g = this.placing.ghost.position;
    const inMod = this.builder.modOfPos(g.x, g.z) || this.builder.domeAt(g.x, g.z, -0.6);
    if (inMod && !this.indoorOk(this.placing.r)) { this.placeWhy = 'машины ставь снаружи'; return false; }
    if (!inMod && this.builder.domeAt(g.x, g.z, 1.2)) { this.placeWhy = 'стена купола'; return false; }
    if (!inMod && this.world.slopeAt(g.x, g.z) > 0.45) { this.placeWhy = 'слишком крутой склон'; return false; }
    if (inMod && Math.abs(g.y - this.player.pos.y) > 1) { this.placeWhy = 'ставь внутри, где стоишь'; return false; }
    if (g.y < this.world.waterAt(g.x, g.z)) { this.placeWhy = 'в воде нельзя'; return false; }
    const minD = this.indoorOk(this.placing.r) ? 1.2 : 2.2;
    if (this.state.buildings.some(b => Math.hypot(b.x - g.x, b.z - g.z) < minD)) { this.placeWhy = 'слишком близко к другой постройке'; return false; }
    this.placeWhy = ''; return true;
  }
  confirmPlace() {
    if (this.placing?.builder) return this.builder.confirm();
    if (!this.placing || !this.placeOk()) return false;
    const { r, ghost } = this.placing;
    const b = { model: r.build, recipe: r.id, x: ghost.position.x, z: ghost.position.z, y: +ghost.position.y.toFixed(2), rot: ghost.rotation.y, gives: r.gives };
    this.scene.remove(ghost);
    this.placing = null;
    this.state.buildings.push(b);
    this.spawnBuilding(b, true);
    this.ui.toast(`Построено: ${r.name || r.desc || r.build}`);
    this.life?.quest('build', 1);
    this.qa.event('build', { id: r.id });
    this.stats.built++;
    this.save();
    return true;
  }
  cancelPlace() {
    if (this.placing?.builder) return this.builder.cancel();
    if (!this.placing) return;
    const cost = this.placing.cost;
    this.scene.remove(this.placing.ghost); this.placing = null;
    for (const [k, v] of Object.entries(cost)) this.state.inv[k] = (this.state.inv[k] || 0) + v; // возврат
  }

  // ---------- Монетизация ----------
  cooldownLeft(p) { const c = this.M.rewarded[p]?.cooldown_sec; return c ? Math.max(0, (this.state.cooldowns[p] || 0) + c * 1000 - Date.now()) / 1000 : 0; }
  async rewarded(p) {
    if (this.cooldownLeft(p) > 0) return false;
    this.paused = true;
    const ok = await this.platform.showRewarded(p);
    this.paused = false;
    this.qa.platform.push({ type: 'rewarded', placement: p, ok });
    if (ok && this.M.rewarded[p]?.cooldown_sec) this.state.cooldowns[p] = Date.now();
    return ok;
  }
  async rewardDoubleMine() { if (await this.rewarded('double_mine')) { this.state.boosts.mine = Date.now() + this.M.rewarded.double_mine.duration * 1000; this.ui.toast('x2 добыча — 2 минуты!'); } }
  async rewardO2() { if (await this.rewarded('o2_refill')) { this.state.o2 = this.S.o2_max; this.ui.toast('Баллоны заправлены'); } }
  async openMeteor() { return this.explore.openMeteor(this.explore.nearM); }
  async buy(id) {
    const p = this.M.iap.find(x => x.id === id); if (!p) return false;
    if (p.once && this.state.flags['bought_' + id]) return false;
    this.paused = true;
    const ok = await this.platform.purchase(id, p);
    this.paused = false;
    this.qa.platform.push({ type: 'purchase', id, ok });
    if (!ok) return false;
    const g = p.grant || {};
    for (const f of g.flags || []) this.state.flags[f] = true;
    for (const [k, v] of Object.entries(g.items || {})) this.state.inv[k] = (this.state.inv[k] || 0) + v;
    if (g.crystals) this.life.L.crystals += g.crystals;
    if (g.bless_sec) this.life.L.bless = Math.max(Date.now(), this.life.L.bless || 0) + g.bless_sec * 1000;
    if (g.boost_ti_sec) this.state.boosts.ti = Math.max(Date.now(), this.state.boosts.ti || 0) + g.boost_ti_sec * 1000;
    if (p.once) this.state.flags['bought_' + id] = true;
    if (g.flags?.includes('suit_gold')) this.applySuit();
    this.save();
    this.ui.toast('Покупка: ' + p.title);
    return true;
  }
  applySuit() {
    if (!this.state.flags.suit_gold) return;
    this.player.model.traverse(c => { if (c.isMesh && c.material.color && c.material.color.getHex() > 0xcccccc) { c.material = c.material.clone(); c.material.color.set('#e8c25a'); c.material.metalness = 0.6; } });
  }
  async maybeInterstitial(kind) {
    const I = this.M.interstitial;
    if (this.state.flags.no_ads || !I.on.includes(kind)) return;
    if (Date.now() - (this.lastInter || 0) < I.min_interval_sec * 1000) return;
    this.lastInter = Date.now();
    this.paused = true; await this.platform.showInterstitial(); this.paused = false;
    this.qa.platform.push({ type: 'interstitial', kind });
  }

  // ---------- Смерть ----------
  async die() {
    if (this.dead) return;
    this.dead = true;
    this.qa.event('death', {});
    this.player.dying = 0.001;                    // анимация падения + оседание на землю
    await new Promise(r => setTimeout(r, 2000));
    const keep = await this.ui.deathDialog();
    this.player.dying = 0;
    let ok = false;
    if (keep === 'ad') ok = await this.rewarded('revive_keep');
    if (!ok) for (const k of Object.keys(this.state.inv)) { this.state.inv[k] = Math.floor(this.state.inv[k] / 2); if (!this.state.inv[k]) delete this.state.inv[k]; }
    const sz = this.safeZone || { x: this.cfg.world.spawn[0], z: this.cfg.world.spawn[2] - 4 };
    this.player.pos.set(sz.x, this.groundY(sz.x, sz.z + 4), sz.z + 4); this.player.resetFall(2);
    this.state.o2 = this.S.o2_max; this.state.hp = this.S.hp_max;
    this.dead = false;
    this.save();
  }

  // ---------- Оффлайн-прогресс ----------
  offline() {
    return null; // не айдл: пока игрока нет, на планете ничего не происходит
    const away = (Date.now() - (this.state.lastSeen || Date.now())) / 1000;
    if (away < 300 || !this.state.buildings.length) return null;
    const sec = Math.min(away, 8 * 3600) * 0.25; // машины без присмотра работают на 25%
    const r = this.rates(), gain = {};
    for (const k in r) { gain[k] = r[k] * sec; this.state.stats[k] += gain[k]; }
    const life = this.life.offline(Math.min(away, 8 * 3600));
    return { away, gain, life };
  }
  async offlineX2(gain, life) {
    if (await this.rewarded('offline_x2')) { for (const k in gain) this.state.stats[k] += gain[k]; if (life) this.life.L.bi += life.bi; return true; }
    return false;
  }

  // ---------- Кадр ----------
  update(dt) {
    if (this.paused || this.dead) return;
    this.time += dt;
    this.state.playtime += dt;
    const p = this.player.pos;
    // Терраформирование
    const r = this.rates();
    for (const k in r) this.state.stats[k] += r[k] * dt;
    const ti = this.ti();
    const st = this.stage();
    if (st > this.state.stageSeen) { this.state.stageSeen = st; this.ui.stageBanner(this.T.stages[st]); this.player.emoteOnce('cheer', 3); this.qa.event('stage', { st, name: this.T.stages[st].name }); this.save(); }
    const events = this.world.applyTerraform(ti, this.state.stats, dt, p);
    for (const e of events) { this.ui.toast(`Открыта зона: ${e.zone.name}!`); this.qa.event('gate_open', { id: e.zone.id }); }
    // Флора по стадии
    for (const f of this.flora) for (let i = 0; i < f.list.length; i++) {
      const it = f.ctl.items[i], L = f.list[i], want = L.pool ? (this.world.waterAmt >= it.th && L.pool.mesh.visible && L.pool.level > L.y + 0.4) : this.world.flora >= it.th && this.world.waterAt(it.x, it.z) < it.y - 0.1;
      if (want !== it.visible) f.ctl.set(i, { visible: want });
      if (want && f.spec.model === 'tree') { const grow = Math.min(1, 0.35 + (this.world.flora - it.th) * 2.2) * f.list[i].scale; if (Math.abs((it.scale ?? 1) - grow) > 0.04) f.ctl.set(i, { scale: grow }); }
    }
    for (const f of this.flora) f.ctl.flush();
    // Выживание
    this.inHouse = this.builder.inside(p) || !!this.driving || !!(this.interiors.inside?.powered);
    // Метеорит: цель засчитывается, когда игрок дошёл до ядра (открытие — отдельно, за рекламу)
    { const G = this.goal(); if (G?.event === 'meteor_touch' && this.explore.meteors?.some(m => m.fall <= 0 && Math.hypot(p.x - m.x, p.z - m.z) < 4.5)) this.goalEvent('meteor_touch'); }
    { const G = this.goal(); if (G?.event === 'visit_poi') { const q = this.cfg.world.pois.find(q => q.id === G.poi); if (q && Math.hypot(p.x - q.x, p.z - (q.z + (q.type === 'ice_cave' ? 8 : 0))) < 16) this.goalEvent('visit_poi'); } }
    if (this.inHouse && this.state.baseDome && !this.state.flags.entered) { this.state.flags.entered = 1; this.qa.event('dome_enter'); }
    if (this.state.baseDome && !this.state.flags.stash_tip && this.usedSlots() >= this.slots()) { this.state.flags.stash_tip = 1; this.ui.coach?.(this.cfg.texts.stash_tip, 'crate'); this.save(); }
    if (this.workbenches?.length) this.workbench = this.workbenches.reduce((a, w) => Math.hypot(p.x - w.x, p.z - w.z) < Math.hypot(p.x - a.x, p.z - a.z) ? w : a);
    this.atBench = !!this.workbench && Math.hypot(p.x - this.workbench.x, p.z - this.workbench.z) < (this.S.bench_safe_r || 0);
    this.safe = (this.safeZone && Math.hypot(p.x - this.safeZone.x, p.z - this.safeZone.z) < this.safeZone.r) || this.inHouse || this.atBench;
    const breathable = ti >= this.T.breathable_ti;
    // Открыта панель (магазин, крафт, снаряжение…), лут или диалог — расход O₂ и удушье на паузе
    this.menuHold = !!(this.ui.panel || this.ui.lootOpen || (typeof document !== 'undefined' && document.getElementById('dialog')?.style.display === 'flex'));
    if (this.menuHold && !this.safe && !breathable) { /* воздух не тратится, пока игрок в меню */ }
    else if (this.safe || breathable) {
      this.state.o2 = Math.min(this.S.o2_max, this.state.o2 + this.S.o2_refill_safe * dt);
      if (this.safe) this.state.hp = Math.min(this.S.hp_max, this.state.hp + this.S.hp_regen_safe * dt);
    } else this.state.o2 = Math.max(0, this.state.o2 - this.o2Rate() * dt);
    // Удушье: без O₂ утекает здоровье (виньетка/пульс в UI). Купол/баллон — спасение.
    this.suffocating = this.state.o2 <= 0 && !this.safe && !breathable && !this.menuHold;
    if (this.suffocating) this.state.hp -= this.S.hp_drain_no_o2 * dt;
    if (this.player.landedFrom > (this.S.fall_height_damage || 4)) { this.state.hp -= this.S.fall_damage || 30; this.ui.flash?.('#ff4a3a'); this.ui.shake?.(0.35); this.ui.toast(`Падение с ${this.player.landedFrom.toFixed(1)} м: −${this.S.fall_damage || 30} HP`, 'warn'); this.player.emoteOnce('fall', 0.6); }
    this.player.landedFrom = 0;
    // --- Звук: шаги, приземление, джетпак, буря, удушье
    const pl = this.player, sx = this.sfx;
    if (sx) {
      if (pl.landingSpeed > 3) sx.play('land', { k: pl.landingSpeed / 8 });
      if (pl.grounded && pl.speedNow > 0.5) { this._stepT = (this._stepT || 0) + dt * pl.speedNow / 2.2; if (this._stepT > 1) { this._stepT = 0; sx.play('step', { k: pl.speedNow > 8 ? 1.2 : 0.9 }); } }
      if (!pl.grounded && this._wasGrounded && pl.vel.y > 2) sx.play('jump');
      this._wasGrounded = pl.grounded;
      // марсоход: мотор + шорох песка/хруст гравия под колёсами
      { const V = this.driving, sp = V ? Math.abs(V.speed) / V.cfg.speed : 0, acc = V ? Math.abs((this.player._dm?.y) || 0) : 0;
        sx.engine(!!V, Math.min(1, sp * 1.1 + acc * 0.15), acc);
        sx.loop('sand', { type: 'bandpass', f: 900, q: 0.5 }); sx.setLoop('sand', V ? Math.min(0.32, sp * 0.4) : 0, 500 + sp * 1600 + Math.random() * 200);
        sx.loop('rumble', { type: 'lowpass', f: 120, q: 1.2 }); sx.setLoop('rumble', V ? Math.min(0.5, sp * 0.6) : 0, 80 + sp * 90);
        if (V && sp > 0.15 && Math.random() < dt * sp * 6) sx.play('step', { k: 0.5 }); }   // камешки под колёсами
      sx.loop('jet', { type: 'bandpass', f: 500, q: 0.8 }); sx.setLoop('jet', pl.jetting ? 0.35 : 0, pl.jetting ? 420 + Math.random() * 120 : 300);
      sx.loop('storm', { type: 'bandpass', f: 400, q: 0.6 }); const st = this.explore.storm || 0; sx.setLoop('storm', st * 0.45 * (this.inHouse ? 0.18 : 1), 300 + st * 500 + Math.sin(this.time * 0.7) * 120);
      if (this.suffocating) { this._hurtT = (this._hurtT || 0) + dt; if (this._hurtT > 0.9) { this._hurtT = 0; sx.play('hurt'); } }
    }
    if (this.state.hp <= 0) { this.state.hp = 0; this.die(); }
    // Добыча
    if (this.player.mining > 0) { this._mh = (this._mh || 0) + dt; if (this._mh > 0.32) { this._mh = 0; this.sfx?.play('mine_hit'); } this.player.mining -= dt; if (this.player.mining <= 0) { this.player.mining = 0; this.finishMine(); } }
    this.target = this.player.mining ? this.mineNode : (this.explore.nearM ? null : this.nearestNode(this.cfg.player.reach)); // у метеорита E — вскрыть его, а не копать породу
    this.nearStash = this.nearestStorage();
    this.nearBench = this.workbench && Math.hypot(p.x - this.workbench.x, p.z - this.workbench.z) < 3.5;
    // Крафт
    for (const j of [...this.state.craftQueue]) if (this.time >= j.end) {
      const r2 = this.cfg.recipes.find(x => x.id === j.id);
      if (this.add(r2.out, r2.count)) { this.state.craftQueue.splice(this.state.craftQueue.indexOf(j), 1); this.ui.toast(`Готово: ${this.cfg.items[r2.out].name} ×${r2.count}`); }
    }
    // Призрак постройки перед игроком
    if (this.placing && !this.placing.builder) {
      const f = this.player.forward(), g = this.placing.ghost, r = this.placing.r;
      const d = this.indoorOk(r) ? 1.7 : 3.2;   // мелочь — прямо перед собой, машины — чуть дальше
      const x = p.x + f.x * d, z = p.z + f.z * d;
      g.position.set(x, this.groundY(x, z), z); g.rotation.y = this.player.obj.rotation.y + Math.PI;
      const ok = this.placeOk();
      g.traverse(c => { if (c.isMesh) c.material.emissive?.set(ok ? '#1a5a1a' : '#6a1010'); });
    }
    // Анимация появления построек
    if (this.pop) for (const q of this.pop) { q.t = Math.min(1, q.t + dt * 2.5); const s = q.t < 1 ? 1 + Math.sin(q.t * Math.PI) * 0.15 : 1; q.o.scale.setScalar(Math.max(0.01, q.t) * s); }
    // Исследование: метеориты, сутки, буря, обломки
    if (!this.driving && this.vehicles?.length) this.updateVehicles(dt);   // припаркованные — тоже физика (пока не уснут)
    this.explore.update(dt);
    this.interiors.update(dt); this.blockout.update?.(dt);
    this.builder.update(dt);
    this.nearMeteor = !!this.explore.nearM;
    // Жизнь
    this.life.update(dt);
    // Респаун ресурсов (3 мин) и ягодники по зелени
    this.respawnClock = (this.respawnClock || 0) + dt;
    if (this.respawnClock > 2) {
      this.respawnClock = 0;
      const now = Date.now();
      for (const n of this.nodes) {
        if (n.dyn) continue;
        const it = n.ctl.items[n.i];
        const grown = !n.ctl.minFlora || this.world.flora >= n.ctl.minFlora;
        const want = grown && (!n.mined || now - n.mined > 180000);
        if (want !== it.visible) { n.ctl.set(n.i, { visible: want }); if (want) n.mined = 0; }
      }
      for (const c of Object.values(this.nodeSets)) c.flush();
      this.syncBerries();
    }
    // Автосейв
    this.saveClock = (this.saveClock || 0) + dt;
    if (this.saveClock > 5) { this.saveClock = 0; this.save(); }
  }
  spawnMeteor(type) { return this.explore.spawnMeteor(type); }
}
