// «Род»: эволюция жизни после терраформирования. Популяция → индекс биомассы Bi → эпохи (рыбки → мышата → котята →
// кошкодевочки → деревня с бесконечными уровнями). Еда, жильё, инкубатор, черты рода, ласка (ДНК), задания, дары, монетизация.
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const today = () => new Date().toISOString().slice(0, 10);

export class Life {
  constructor(game) {
    this.g = game; this.E = game.cfg.evolution;
    const s = game.state;
    s.life = Object.assign({
      started: false, stage: 0, pop: 0, bi: 0, dna: 0, crystals: 0, food: 0, traits: [], traitLv: {},
      egg: null, pendingChoice: null, villageLv: 0, quests: null, questDay: null, giftAt: 0, petCd: {}, bless: 0, petted: 0,
    }, s.life || {});
    this.L = s.life;
    this.creatures = [];  // визуальные экземпляры {mesh,stage,x,z,dir,t,...}
    this.time = 0;
  }

  // ---------- Бонусы ----------
  bonus(kind) {
    let b = 0;
    for (const id of this.L.traits) {
      const t = this.E.traits.find(x => x.id === id), v = t?.bonus?.[kind];
      if (!v) continue;
      b += v + Math.sign(v) * (this.L.traitLv[id] || 0) * this.E.trait_upgrade.per_level;  // каждый уровень черты: +4 п.п.
    }
    return kind === 'food' ? Math.max(-0.8, b) : b;
  }
  stageCfg(i = this.L.stage) { return this.E.stages[Math.min(i, this.E.stages.length - 1)]; }
  buildings(model) { return this.g.state.buildings.filter(b => b.model === model).length; }

  // Лимит популяции: базовый по эпохе + жильё + кормушки + флора
  cap() {
    const C = this.E.capacity, st = this.stageCfg();
    let c = st.cap + this.buildings('feeder') * C.feeder + this.g.world.flora * C.flora;
    if (this.L.stage >= 1) c += this.buildings('nest') * C.nest;
    if (this.L.stage >= 3) c += this.buildings('hut') * C.hut + this.buildings('campfire') * C.campfire;
    return Math.floor(c * (1 + this.bonus('cap')) * (1 + this.L.villageLv * 0.1));
  }
  foodCap() { return this.buildings('feeder') * this.E.feeder_max; }
  // Природа кормит «дикую» норму эпохи (stage.cap); всё, что сверх, — только с кормушек
  natural() { return this.stageCfg().cap + this.g.world.flora * this.E.capacity.flora; }
  hungry() { return this.L.pop > this.natural() && this.L.food <= 0 && !this.g.state.flags.auto_feeder; }
  blessed() { return (this.L.bless || 0) > Date.now(); }
  biRate() {
    const st = this.stageCfg();
    let r = this.L.pop * st.rate * (1 + this.bonus('bi')) * (this.hungry() ? this.E.unfed_rate : 1);
    if (this.blessed()) r *= 2;
    return r * (this.g.devSpeed || 1);
  }
  nextBi() {
    const st = this.E.stages;
    if (this.L.stage + 1 < st.length) return st[this.L.stage + 1].bi;
    const v = this.E.village_levels; return v.base * Math.pow(v.growth, this.L.villageLv + 1);
  }
  stageName() { return this.L.stage >= this.E.stages.length - 1 ? `${this.stageCfg().name} · ур. ${this.L.villageLv + 1}` : this.stageCfg().name; }

  // ---------- Тик ----------
  update(dt) {
    const g = this.g, L = this.L;
    this.time += dt;
    if (!L.started) {
      if (g.ti() >= this.E.start_ti && g.world.pools.some(p => p.mesh.visible && p.level > p.floor + 0.5)) {
        L.started = true; L.pop = 2; L.food = 0;
        g.ui.stageBanner({ name: this.E.stages[0].name }, g.cfg.texts.life_born);
        g.qa.event('life_start', {});
        this.respawnCreatures();
      }
      return;
    }
    const sp = g.devSpeed || 1;
    // Рост популяции (логистический), еда
    const cap = this.cap();
    const fed = !this.hungry();
    const gr = this.E.growth * (1 + this.bonus('growth')) * (fed ? 1 : 0.15) * (this.blessed() ? 1.5 : 1) * sp;
    L.pop = clamp(L.pop + gr * L.pop * (1 - L.pop / Math.max(1, cap)) * dt + (L.pop < 2 ? 0.02 * dt : 0), 0, cap);
    const eaters = Math.max(0, L.pop - this.natural());
    if (!g.state.flags.auto_feeder) L.food = Math.max(0, L.food - eaters * this.E.food_per_pop * 4 * (1 + this.bonus('food')) * dt * sp);
    else L.food = this.foodCap();
    // Индекс биомассы и эпохи
    L.bi += this.biRate() * dt;
    this.checkEvolution();
    // Яйцо в инкубаторе
    if (L.egg && !L.egg.ready && Date.now() >= L.egg.readyAt) { L.egg.ready = true; g.ui.toast('🥚 ' + g.cfg.texts.egg_ready); g.qa.event('egg_ready', {}); }
    // Задания дня
    if (L.questDay !== today()) this.rollQuests();
    // Дары племени
    if (L.stage >= 3 && this.buildings('campfire') && Date.now() >= (L.giftAt || 0)) { L.giftReady = true; }
    // Визуал
    this.syncCreatures();
    this.animate(dt);
  }

  checkEvolution() {
    const L = this.L, g = this.g;
    const st = this.E.stages;
    if (L.stage + 1 < st.length) {
      if (L.bi >= st[L.stage + 1].bi && !L.egg) {
        // Новое поколение рождается из яйца в инкубаторе — нужна постройка и время
        if (!this.buildings('incubator')) { if (!this.warnedInc) { g.ui.toast('🥚 ' + g.cfg.texts.need_incubator); this.warnedInc = true; } return; }
        const min = st[L.stage + 1].hatch_min;
        L.egg = { to: L.stage + 1, readyAt: Date.now() + min * 60000 / (g.devSpeed || 1), ready: min === 0 };
        g.ui.toast(`🥚 Яйцо нового поколения в инкубаторе: ${st[L.stage + 1].name}`);
        g.qa.event('egg', { to: L.stage + 1 });
      }
    } else if (L.bi >= this.nextBi()) {
      L.villageLv++; g.ui.stageBanner({ name: `Деревня · уровень ${L.villageLv + 1}` }, 'Племя растёт');
      L.crystals += 5 + L.villageLv * 2; g.qa.event('village_up', { lv: L.villageLv });
    }
  }

  // Вылупление: игрок выбирает 1 из 3 черт рода
  offerTraits(reroll = false) {
    const L = this.L, all = this.E.traits.filter(t => !L.traits.includes(t.id));
    const rare = all.filter(t => t.rare), common = all.filter(t => !t.rare);
    const pick = [];
    const pool = [...common].sort(() => Math.random() - 0.5);
    if (this.g.state.flags.rare_next && rare.length) { pick.push(rare[Math.floor(Math.random() * rare.length)]); this.g.state.flags.rare_next = false; }
    else if (rare.length && Math.random() < (reroll ? 0.35 : 0.12)) pick.push(rare[Math.floor(Math.random() * rare.length)]);
    while (pick.length < 3 && pool.length) pick.push(pool.pop());
    L.pendingChoice = pick.map(t => t.id);
    return pick;
  }
  async hatch(useAd = false, crystals = false) {
    const L = this.L, g = this.g;
    if (!L.egg) return false;
    if (!L.egg.ready) {
      const leftMin = (L.egg.readyAt - Date.now()) / 60000;
      if (useAd) { if (!(await g.rewarded('hatch_skip'))) return false; L.egg.readyAt -= this.E.skip_ad_min * 60000; if (L.egg.readyAt <= Date.now()) L.egg.ready = true; return true; }
      if (crystals) {
        const cost = Math.max(1, Math.ceil(leftMin / 10) * this.E.skip_crystal_per_10min);
        if (L.crystals < cost) return false;
        L.crystals -= cost; L.egg.ready = true; g.qa.event('skip_crystals', { cost });
      } else return false;
    }
    const opts = this.offerTraits();
    const chosen = await g.ui.traitDialog(opts, this);
    if (chosen) L.traits.push(chosen);
    L.pendingChoice = null;
    const from = L.stage;
    L.stage = L.egg.to; L.egg = null; this.warnedInc = false;
    L.pop = Math.max(2, L.pop * 0.6);  // новое поколение — часть популяции переходит
    g.ui.stageBanner({ name: this.stageCfg().name }, 'Эволюция рода');
    g.qa.event('evolve', { from, to: L.stage, trait: chosen });
    this.respawnCreatures();
    g.save();
    return true;
  }
  hatchCost() { const L = this.L; if (!L.egg || L.egg.ready) return 0; return Math.max(1, Math.ceil((L.egg.readyAt - Date.now()) / 600000) * this.E.skip_crystal_per_10min); }

  // ---------- Взаимодействия ----------
  fillFeeder() {
    const L = this.L, g = this.g, cap = this.foodCap();
    if (!cap || L.food >= cap - 0.5) return false;
    for (const k of ['food_brick', 'berries']) {
      const n = g.state.inv[k] || 0; if (!n) continue;
      const per = g.cfg.items[k].food, need = Math.ceil((cap - L.food) / per), use = Math.min(n, need);
      g.take({ [k]: use }); L.food = Math.min(cap, L.food + use * per);
      g.ui.toast(`Кормушки: +${use * per} еды`); this.quest('feed', use); return true;
    }
    g.ui.toast('Нужны ягоды или брикеты корма', 'warn'); return false;
  }
  pet(cr) {
    const L = this.L, now = Date.now();
    if ((L.petCd[cr.id] || 0) > now) return false;
    L.petCd[cr.id] = now + this.E.pet_cooldown * 1000;
    const dna = Math.max(1, Math.round(this.E.pet_dna * (1 + L.stage) * (1 + this.bonus('dna'))));
    L.dna += dna; L.petted++;
    cr.jump = 0.6; cr.heart = 1.2;
    this.g.ui.toast(`💕 +${dna} ДНК`);
    this.quest('pet', 1);
    this.g.qa.event('pet', { dna });
    return true;
  }
  upgradeTrait(id) {
    const T = this.E.trait_upgrade, lv = this.L.traitLv[id] || 0, cost = Math.round(T.base * Math.pow(T.growth, lv));
    if (this.L.dna < cost) return false;
    this.L.dna -= cost; this.L.traitLv[id] = lv + 1; this.g.qa.event('trait_up', { id, lv: lv + 1 }); return true;
  }
  traitCost(id) { const T = this.E.trait_upgrade; return Math.round(T.base * Math.pow(T.growth, this.L.traitLv[id] || 0)); }
  async claimGift(x2) {
    const L = this.L, g = this.g;
    if (!L.giftReady) return false;
    let mult = 1 + L.villageLv * 0.15;
    if (x2) { if (!(await g.rewarded('gift_x2'))) return false; mult *= 2; }
    for (const [k, v] of Object.entries(this.E.gifts.grant)) {
      const n = Math.round(v * mult);
      if (k === 'crystals') L.crystals += n; else g.add(k, n);
    }
    L.giftReady = false; L.giftAt = Date.now() + this.E.gifts.every_min * 60000;
    g.ui.toast('🎁 Дары племени получены'); g.qa.event('gift', { x2 }); return true;
  }
  async blessAd() { if (await this.g.rewarded('bless_ad')) { this.L.bless = Math.max(Date.now(), this.L.bless || 0) + this.g.M.rewarded.bless_ad.duration * 1000; this.g.ui.toast('✨ Благословение рода: x2 биомасса'); } }

  // ---------- Задания старейшины ----------
  rollQuests() {
    const all = [...this.E.quests].sort(() => Math.random() - 0.5).slice(0, 3);
    this.L.quests = all.map(q => ({ ...q, have: 0, done: false, claimed: false }));
    this.L.questDay = today(); this.L.questBonus = false;
  }
  quest(id, n) { for (const q of this.L.quests || []) if (q.id === id && !q.done) { q.have += n; if (q.have >= q.n) { q.done = true; this.g.ui.toast('✅ Задание: ' + q.text); } } }
  claimQuest(i) {
    const q = this.L.quests[i]; if (!q?.done || q.claimed) return false;
    q.claimed = true; this.L.crystals += this.E.quest_reward.crystals; this.L.dna += this.E.quest_reward.dna;
    if (this.L.quests.every(x => x.claimed) && !this.L.questBonus) { this.L.questBonus = true; this.L.crystals += this.E.quest_bonus.crystals; this.L.dna += this.E.quest_bonus.dna; this.g.ui.toast('🏆 Все задания дня: бонус!'); }
    return true;
  }

  // ---------- Оффлайн ----------
  offline(sec) {
    if (!this.L.started) return null;
    const L = this.L, before = { bi: L.bi, pop: L.pop };
    const steps = 60, dt = sec * this.E.offline_rate / steps;
    for (let i = 0; i < steps; i++) {
      const cap = this.cap(), fed = !this.hungry();
      L.pop = clamp(L.pop + this.E.growth * (fed ? 1 : 0.15) * L.pop * (1 - L.pop / cap) * dt, 0, cap);
      if (!this.g.state.flags.auto_feeder) L.food = Math.max(0, L.food - Math.max(0, L.pop - this.natural()) * this.E.food_per_pop * 4 * dt);
      L.bi += this.biRate() * dt;
    }
    if (L.egg && Date.now() >= L.egg.readyAt) L.egg.ready = true;
    return { bi: L.bi - before.bi, pop: L.pop - before.pop };
  }

  // ---------- Визуал существ ----------
  look() {
    const L = this.L; const t = [...L.traits].reverse().map(id => this.E.traits.find(x => x.id === id)).find(t => t?.fur);
    return t ? { fur: t.fur, accent: t.accent, glow: !!t.glow } : null;
  }
  respawnCreatures() {
    for (const c of this.creatures) this.g.scene.remove(c.mesh);
    this.creatures = [];
    this.renderedLook = JSON.stringify(this.look());
    this.syncCreatures(true);
  }
  spot(habitat) {
    const w = this.g.world, R = Math.random;
    const pools = w.pools.filter(p => p.mesh.visible && p.level > p.floor + 0.4);
    for (let a = 0; a < 30; a++) {
      if (habitat === 'water' && pools.length) {
        const p = pools[Math.floor(R() * pools.length)], ang = R() * 6.28, r = Math.sqrt(R()) * p.f.r * 0.8;
        const x = p.f.x + Math.cos(ang) * r, z = p.f.z + Math.sin(ang) * r;
        if (w.heightAt(x, z) < p.level - 0.5) return { x, z, y: p.level - 0.12, pool: p };
      } else if ((habitat === 'shore' || habitat === 'land') && pools.length) {
        const p = pools[Math.floor(R() * pools.length)], ang = R() * 6.28, r = p.f.r * (habitat === 'shore' ? 1.0 + R() * 0.5 : 1.2 + R() * 1.3);
        const x = p.f.x + Math.cos(ang) * r, z = p.f.z + Math.sin(ang) * r;
        if (w.heightAt(x, z) > w.waterAt(x, z) + 0.1 && w.slopeAt(x, z) < 0.3) return { x, z };
      } else if (habitat === 'tribe') {
        const homes = this.g.state.buildings.filter(b => ['campfire', 'hut'].includes(b.model));
        const c = homes.length ? homes[Math.floor(R() * homes.length)] : this.g.safeZone;
        const ang = R() * 6.28, r = 3 + R() * 7, x = c.x + Math.cos(ang) * r, z = c.z + Math.sin(ang) * r;
        if (w.waterAt(x, z) < w.heightAt(x, z)) return { x, z, home: c };
      }
    }
    return null;
  }
  syncCreatures(force) {
    const L = this.L, st = this.stageCfg();
    const lookKey = JSON.stringify(this.look());
    if (lookKey !== this.renderedLook) return this.respawnCreatures();
    const want = Math.min(this.E.render_max, Math.floor(L.pop));
    while (this.creatures.length > want) this.g.scene.remove(this.creatures.pop().mesh);
    let tries = 0;
    while (this.creatures.length < want && tries++ < 4) {
      const p = this.spot(st.habitat); if (!p) break;
      const mk = st.char && this.g.models.chars?.[st.char];
      const char = mk ? mk({ shadow: false }) : null;
      const mesh = char ? char.root : this.g.models.instance(st.model, { recolor: this.look() });
      if (char) { if (char.clips.length) { char.play(char.anims.idle); char.mixer.update(Math.random() * 5); } else char.proc = true; }
      mesh.position.set(p.x, p.y ?? this.g.world.heightAt(p.x, p.z), p.z);
      mesh.scale.setScalar(0.85 + Math.random() * 0.3);
      this.g.scene.add(mesh);
      this.creatures.push({ id: Math.random().toString(36).slice(2, 8), mesh, char, ...p, habitat: st.habitat, dir: Math.random() * 6.28, t: Math.random() * 5, speed: { water: 1.2, shore: 1.6, land: 1.4, tribe: 0.9 }[st.habitat], born: 0 });
    }
  }
  animate(dt) {
    const w = this.g.world, p = this.g.player.pos;
    this.nearest = null; let nd = 2.6;
    for (const c of this.creatures) {
      c.t -= dt; c.born = Math.min(1, c.born + dt * 1.5);
      if (c.t <= 0) { c.dir += (Math.random() - 0.5) * 2.4; c.t = 1.5 + Math.random() * 3; c.idle = Math.random() < (c.habitat === 'tribe' ? 0.5 : 0.25); }
      const m = c.mesh;
      const toPl = Math.hypot(p.x - c.mesh.position.x, p.z - c.mesh.position.z);
      if (toPl < 4 && c.habitat !== 'water') c.idle = true;  // подошли — замирают и смотрят на игрока
      const sp = c.idle ? 0 : c.speed;
      let nx = m.position.x + Math.sin(c.dir) * sp * dt, nz = m.position.z + Math.cos(c.dir) * sp * dt;
      // Держаться своей среды
      let ok = true;
      if (c.habitat === 'water') ok = c.pool && w.heightAt(nx, nz) < c.pool.level - 0.45 && Math.hypot(nx - c.pool.f.x, nz - c.pool.f.z) < c.pool.f.r;
      else ok = w.heightAt(nx, nz) > w.waterAt(nx, nz) + 0.05 && w.slopeAt(nx, nz) < 0.35 && (!c.home || Math.hypot(nx - c.home.x, nz - c.home.z) < 12) && !w.blocked(nx, nz);
      if (!ok) { c.dir += Math.PI * (0.6 + Math.random() * 0.8); nx = m.position.x; nz = m.position.z; }
      m.position.x = nx; m.position.z = nz;
      const gy = c.habitat === 'water' ? c.pool.level - 0.12 + Math.sin(this.time * 2 + c.dir) * 0.06 : w.heightAt(nx, nz);
      c.jump = Math.max(0, (c.jump || 0) - dt);
      const hop = c.habitat === 'water' ? 0 : (sp > 0 ? Math.abs(Math.sin(this.time * 9 + c.dir * 3)) * 0.08 : 0) + (c.jump > 0 ? Math.sin(c.jump / 0.6 * Math.PI) * 0.5 : 0);
      m.position.y = gy + (c.char && !c.char.proc ? 0 : hop * (c.char?.proc ? 1.6 : 1));
      // Процедурная анимация для моделей без клипов (лисята): дыхание, сжатие при прыжке, наклон
      if (c.char?.proc) { const md = c.char.model, br = Math.sin(this.time * 3 + c.dir * 5) * 0.03, sq = sp > 0 ? Math.abs(Math.sin(this.time * 9 + c.dir * 3)) : 0;
        md.userData.s0 ??= md.scale.y; md.scale.set(md.userData.s0 * (1 - br * 0.5 + sq * 0.04), md.userData.s0 * (1 + br - sq * 0.08 + 0.08 * Math.max(0, c.heart || 0)), md.userData.s0 * (1 - br * 0.5 + sq * 0.04));
        md.rotation.z = sp > 0 ? Math.sin(this.time * 9 + c.dir * 3) * 0.08 : Math.sin(this.time * 1.3 + c.dir) * 0.04; }
      if (c.char && !c.char.proc) {
        const A = c.char.anims;
        if (sp > 0) c.char.play(A.walk); else if (c.heart > 0) c.char.play(A.cheer); else if (toPl < 4) c.char.play(A.wave);
        else if (!c.pose || c.t > 2.9) { if (!c.pose || Math.random() < 0.02) c.pose = [A.idle, A.idle, A.sit, A.work, A.look, A.dance][Math.floor(Math.random() * 6)]; c.char.play(c.pose); }
        if (sp > 0) c.pose = null;
        c.char.lod(toPl > 22); c.acc = (c.acc || 0) + dt; if (toPl < 22 || c.acc > 0.1) { c.char.update(c.acc); c.acc = 0; }
      }
      const toP = Math.hypot(p.x - m.position.x, p.z - m.position.z);
      let face = c.dir;
      if (sp === 0 && toP < 7) face = Math.atan2(p.x - m.position.x, p.z - m.position.z);
      else if (sp === 0 && c.home) face = Math.atan2(c.home.x - m.position.x, c.home.z - m.position.z);
      let d = face - m.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); m.rotation.y += d * Math.min(1, dt * 6);
      if (c.born < 1) m.scale.setScalar(Math.max(0.01, c.born) * (m.userData.s ??= m.scale.x));
      // Сердечко после ласки
      if (c.heart > 0) {
        c.heart -= dt;
        if (!c.heartMesh) { c.heartMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: '#ff5d8f' })); this.g.scene.add(c.heartMesh); }
        c.heartMesh.position.set(m.position.x, m.position.y + 1.2 + (1.2 - c.heart) * 0.8, m.position.z); c.heartMesh.rotation.y += dt * 4;
      } else if (c.heartMesh) { this.g.scene.remove(c.heartMesh); c.heartMesh = null; }
      const dd = Math.hypot(m.position.x - p.x, m.position.z - p.z);
      if (dd < nd && c.habitat !== 'water' || (c.habitat === 'water' && dd < 4.5 && dd < nd + 2)) { nd = dd; this.nearest = c; }
    }
  }
  petReady(c) { return c && (this.L.petCd[c.id] || 0) <= Date.now(); }
}
