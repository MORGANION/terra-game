// HTML-интерфейс поверх 3D в стиле «наручный планшет колониста» (concepts/terra-ui):
// HUD (O₂ с запасом хода, HP с удушьем, джетпак, сутки), меню разделов, единая панель «Снаряжение»
// (экипировка + рюкзак), фабрикатор, Род, магазин, настройки, лут, диалоги, тосты.
import { ic, icc, itemIcon, injectSprite } from './icons.js';

const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : n >= 100 ? Math.floor(n) : (+n).toFixed(1);
const fmtT = s => s <= 0 ? '0с' : s < 60 ? Math.ceil(s) + 'с' : s < 3600 ? Math.ceil(s / 60) + 'м' : (h => Math.floor(h / 60) + 'ч ' + (h % 60) + 'м')(Math.ceil(s / 60));
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const STAT_IC = { heat: 'heat', pressure: 'pressure', oxygen: 'bubbles', biomass: 'leaf' };
const kbd = k => `<span class="kbd">${k}</span>`;
const SETTINGS_KEY = 'terra_settings';

export class UI {
  // Весь UI масштабируется пропорционально экрану: база — 1366×768, на больших мониторах крупнее (до ×2.2), на малых — как есть
  static applyScale() {
    const z = Math.max(1, Math.min(2.2, Math.min(innerWidth / 1366, innerHeight / 768)));
    document.documentElement.style.setProperty('--uiz', z.toFixed(3)); UI.zoom = z; return z;
  }
  constructor(cfg) {
    this.cfg = cfg; this.T = cfg.texts;
    this.el = id => document.getElementById(id);
    this.root = this.el('ui');
    this.panel = null;
    this.buttons = {};
    injectSprite();
    this.touch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('touch', this.touch);
    try { this.settings = { master: 0.8, music: 0.6, sfx: 0.8, lang: 'ru', ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { this.settings = { master: 0.8, music: 0.6, sfx: 0.8, lang: 'ru' }; }
    window.__settings = this.settings;
  }
  sic(k) { return ic(STAT_IC[k] || 'star'); }
  chip(k, have, need) {
    const it = this.cfg.items[k] || { name: k };
    const bad = need != null && have < need;
    return `<span class="chip ${need == null ? '' : bad ? 'bad' : 'okc'}" title="${it.name}">${itemIcon(k, it)}${it.name} ${need != null ? `${need} <small>(есть ${have})</small>` : '×' + have}</span>`;
  }

  bind(game) {
    document.addEventListener('pointerdown', e => { if (e.target.closest?.('#panel button, #dialog button, .dialog button')) this.sfx?.play('click'); }, true);
    this.g = game;
    const g = game;
    this.qa = /[?&]qa/.test(location.search);
    const btn = (id, label, cls, fn) => {
      const b = document.createElement('button'); b.id = 'b_' + id; b.className = 'btn ' + (cls || ''); b.innerHTML = label;
      b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); this.sfx?.play('click'); fn(); });
      b.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
      this.buttons[id] = b; return b;
    };
    // Статичные иконки HUD
    this.el('o2box').querySelector('b').innerHTML = ic('o2');
    this.el('hpbox').querySelector('b').innerHTML = ic('hp');
    this.el('jetbox').querySelector('b').innerHTML = ic('rocket');
    this.el('ti').querySelector('.ico').innerHTML = ic('planet');
    this.el('lifehud').querySelector('.ico').innerHTML = ic('fox');
    this.el('safe').innerHTML = `${ic('dome')} ${this.T.safe}`;
    const act = this.el('actions');
    act.append(
      btn('mine', ic('pick') + `<small>${this.T.mine}</small>` + kbd('E'), 'big', () => g.target && g.startMine(g.target)),
      btn('jump', ic('jump'), 'mid', () => { g.player.input.jump = true; }),
      btn('place', ic('check') + `<small>${this.T.place}</small>` + kbd('E'), 'big ok', () => g.confirmPlace() || this.toast('Здесь нельзя: ' + (g.placeWhy || 'нужно ровное место'), 'warn')),
      btn('cancel', ic('close'), 'mid bad', () => g.cancelPlace()),
      btn('rot', '⟳' + kbd('R'), 'mid', () => g.builder.rotate()),
      btn('unbuild', ic('pick') + '<small>Разобрать</small>' + kbd('X'), 'mid bad', () => g.builder.removeNear()),
      btn('meteor', ic('meteor') + '<small>Ядро</small><i class="adb">' + ic('ad') + '</i>', 'big ad', () => g.openMeteor()),
      btn('loot', ic('crate') + `<small>${this.T.open}</small>` + kbd('E'), 'big ok', () => g.explore.nearC && g.explore.openContainer(g.explore.nearC)),
      btn('lamp', icc('r-lamp') + kbd('F'), 'mid', () => g.explore.placeLamp()),
      btn('pet', ic('pet') + `<small>${this.T.pet}</small>` + kbd('E'), 'big pink', () => g.life.nearest && g.life.pet(g.life.nearest)),
      btn('fill', icc('r-berries') + `<small>${this.T.fill}</small>` + kbd('E'), 'big', () => g.life.fillFeeder()),
      btn('hatch', ic('egg') + `<small>${this.T.hatch}</small>`, 'big ok', () => this.open('life')),
      btn('gift', ic('gift') + '<small>Дары</small>', 'big ok', () => this.open('life')),
      btn('stash', ic('crate') + `<small>Открыть</small>` + kbd('E'), 'big ok', () => g.nearStash && (this.stashSt = g.nearStash, this.open('stash'))),
      btn('tank', icc('r-o2_tank') + '<small>Баллон</small>' + kbd('Q'), 'big', () => g.use('o2_tank')),
      btn('medkit', icc('r-medkit') + '<small>Аптечка</small>', 'mid', () => g.use('medkit')),
    );
    const side = this.el('side');
    side.append(
      btn('craft', ic('craft') + '<small>Крафт</small>' + kbd('C'), 'icon', () => this.toggle('craft')),
      btn('inv', icc('g-suit') + '<small>Снаряж.</small>' + kbd('I') + '<i class="cnt" id="slots"></i>', 'icon', () => this.toggle('inv')),
      btn('house', ic('house') + '<small>Стройка</small>' + kbd('B'), 'icon', () => this.toggle('house')),
      btn('daily', ic('gift') + '<small>Награды</small>' + kbd('K'), 'icon', () => this.toggle('daily')),
      btn('life', ic('paw') + '<small>Род</small>' + kbd('L'), 'icon', () => this.toggle('life')),
      btn('store', ic('store') + '<small>Магазин</small>', 'icon', () => this.toggle('store')),
    );
    // Реклама — таблетками под барами, далеко от «Добыть»
    this.el('pills').append(btn('x2', `${ic('pick')} x2 добыча ${ic('ad')}`, 'pill ad', () => g.rewardDoubleMine()));
    this.el('o2box').append(btn('o2ad', `${ic('o2')} Заправить ${ic('ad')}`, 'pill ad', () => g.rewardO2()));
    this.root.append(btn('settings', ic('settings'), 'icon', () => this.toggle('settings')));
    { const d = btn('dev', 'DEV', 'icon devbtn', () => this.toggle('dev')); this.root.append(d); }
    this.el('close').addEventListener('pointerdown', e => { e.stopPropagation(); this.close(); });
    this.buttons.close = this.el('close');
    // Сворачивание блоков Ti / Рода (запоминается)
    let fold = {}; try { fold = JSON.parse(localStorage.getItem('terra_fold') || 'null') ?? null; } catch {}
    if (!fold) { const port = matchMedia('(max-width:700px)').matches, land = matchMedia('(max-height:500px)').matches; fold = { ti: land, lifehud: port || land }; }
    for (const [id, v] of Object.entries(fold)) this.el(id)?.classList.toggle('collapsed', !!v);
    this.root.addEventListener('pointerdown', e => {
      const h = e.target.closest('.tihead[data-collapse]'); if (!h) return;
      e.stopPropagation(); const el = this.el(h.dataset.collapse); el.classList.toggle('collapsed');
      fold[h.dataset.collapse] = el.classList.contains('collapsed'); try { localStorage.setItem('terra_fold', JSON.stringify(fold)); } catch {}
    });
    addEventListener('keydown', e => {
      // Игровые клавиши (прыжок/ходьба стрелками) не должны листать открытую панель браузером
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.code) && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) e.preventDefault();
      if (e.code === 'KeyE' && !g.placing && (g.driving || g.nearVehicle())) { g.toggleDrive(); return; }
      if (e.code === 'KeyE') { if (g.placing) { if (!g.confirmPlace() && !g.placing?.builder) this.toast('Здесь нельзя: ' + (g.placeWhy || 'нужно ровное место'), 'warn'); } else if (g.nearFeeder && g.life.foodCap() && g.life.L.food < g.life.foodCap() - 1) g.life.fillFeeder(); else if (g.life.nearest && g.life.petReady(g.life.nearest) && !g.target) g.life.pet(g.life.nearest); else if (g.explore.nearC) g.explore.openContainer(g.explore.nearC); else if (g.nearMeteor) g.openMeteor(); else if (g.nearStash) { if (this.panel !== 'stash') this.stashSt = g.nearStash; this.toggle('stash'); } else if (g.target) g.startMine(g.target); }
      if (e.code === 'KeyF' && !this.panel) g.explore.placeLamp();
      if (e.code === 'KeyQ' && (g.state.inv.o2_tank || 0) > 0) g.use('o2_tank');
      if (e.code === 'KeyG' || e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); this.toggle('inv'); }
      if (e.code === 'KeyL') this.toggle('life');
      if (e.code === 'F9') { e.preventDefault(); this.toggle('dev'); }
      if (e.code === 'KeyK') this.toggle('daily');
      if (e.code === 'KeyB') this.toggle('house');
      if (e.code === 'KeyR' && g.builder.mode) g.builder.rotate();
      if (e.code === 'KeyX' && !this.panel) g.builder.removeNear();
      if (e.code === 'KeyC') this.toggle('craft');
      if (e.code === 'Escape') { if (g.placing) g.cancelPlace(); this.panel ? this.close() : this.open('settings'); }
    });
  }
  toggle(name) { this.panel === name ? this.close() : this.open(name); }

  // ---------- HUD каждый кадр ----------
  update() {
    { const t = Math.floor(this.g.state.playtime || 0), el = this.el('ptime'); if (el && t !== this._pt) { this._pt = t; el.textContent = `⏱ ${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; } }
    const g = this.g, s = g.state, X = g.explore;
    const pct = (v, m) => Math.max(0, Math.min(100, v / m * 100)) + '%';
    const set = (id, html) => { const e = this.el(id); if (e._h !== html) { e._h = html; e.innerHTML = html; } };
    // --- O₂: полоса + запас хода и дорога до купола
    this.el('o2bar').style.width = pct(s.o2, g.S.o2_max);
    this.el('hpbar').style.width = pct(s.hp, g.S.hp_max);
    this.el('o2val').textContent = Math.ceil(s.o2);
    this.el('hpval').textContent = Math.ceil(s.hp);
    const info = g.o2Info();
    const low = s.o2 < g.S.o2_max * 0.3 && !g.safe && !info.breathable;
    this.el('o2box').classList.toggle('low', low);
    // Главное правило вылазки: воздуха (в секундах) должно хватить на дорогу до купола
    const late = !g.safe && !info.breathable && s.o2 > 0 && info.left < info.home;
    const risky = !g.safe && !info.breathable && info.left < info.home * 1.15 + 4;
    this.el('o2val').textContent = g.safe || info.breathable || !isFinite(info.left) ? Math.ceil(s.o2) : Math.floor(info.left) + 'с';
    if (g.safe) set('o2eta', `<span class="ok">${ic(g.inHouse ? 'house' : g.atBench ? 'craft' : 'dome')} ${g.inHouse ? 'дом' : g.atBench ? 'база' : g.safeZone?.lander ? 'шаттл' : 'купол'}: заправка</span>`);
    else if (info.breathable) set('o2eta', `<span class="ok">${ic('leaf')} можно дышать</span>`);
    else if (s.o2 <= 0) set('o2eta', `<span class="warn">нет воздуха</span>`);
    else if (late) set('o2eta', `<span class="warn">не успеешь!</span> ${ic('dome')} <b>${Math.ceil(info.home)}с</b>`);
    else set('o2eta', `${ic('dome')} ${g.safeZone?.lander ? 'до шаттла' : 'до купола'} <b>${Math.ceil(info.home)}с</b>${risky ? ' <span class="warn">пора назад</span>' : ''}`);
    this.el('o2eta').classList.toggle('risky', risky);
    // Стрелка к куполу — когда пора возвращаться
    const sz = g.safeZone, pp = g.player.pos;
    if (sz && risky) { const dx = sz.x - pp.x, dz = sz.z - pp.z, y = g.player.yaw, f = -dx * Math.sin(y) - dz * Math.cos(y), r = dx * Math.cos(y) - dz * Math.sin(y); this.el('homearrow').style.cssText = `display:block;transform:translate(-50%,-50%) rotate(${Math.atan2(r, f)}rad)`; }
    else this.el('homearrow').style.display = 'none';
    this.buttons.o2ad.style.display = low && !(s.inv.o2_tank > 0) && g.cooldownLeft('o2_refill') <= 0 ? '' : 'none';
    // --- HP и удушье
    const suff = !!g.suffocating;
    this.el('hpbox').classList.toggle('drain', suff);
    const sf = this.el('suffo'); sf.classList.toggle('on', suff);
    if (suff) set('suffotxt', `<b>НЕТ ВОЗДУХА</b><span>${ic('hp')} смерть через ${Math.ceil(s.hp / g.S.hp_drain_no_o2)}с · ${s.inv.o2_tank ? `баллон <span class="kbd">Q</span> (${s.inv.o2_tank}) или ` : ''}бегом к куполу ${Math.ceil(info.home)}с</span>`); sf.classList.toggle('low', !suff && low && s.o2 < g.S.o2_max * 0.15);
    document.body.classList.toggle('dying', suff && s.hp < g.S.hp_max * 0.5); document.body.classList.toggle('suffo', suff);
    // --- Джетпак — своя полоса, только если он есть
    const jm = g.player.jetFuelMax;
    this.el('jetbox').style.display = jm ? 'flex' : 'none';
    if (jm) { this.el('jetbar').style.width = pct(g.player.jetFuel, jm); this.el('jetval').textContent = Math.round(g.player.jetFuel / jm * 100) + '%'; }
    // --- Цель онбординга
    const G = g.goal();
    const gp = G && g.goalPos?.(G), gd = gp ? Math.round(Math.hypot(gp.x - g.player.pos.x, gp.z - g.player.pos.z)) : 0;
    for (const k of ['craft', 'inv', 'house']) this.buttons[k]?.classList.toggle('pulseb', !this.panel && G?.pulse === k && !(G.id === 'learn' && !g.nearBench));
    set('goal', G ? `<i class="ico">${ic('star')}</i><span><small>Цель ${s.goal + 1}/${g.cfg.onboarding.length}${gp && gd > 4 ? ` · ${gd} м` : ''}</small><b>${G.text}${G.n > 1 ? ` <span class="num">${s.goalN}/${G.n}</span>` : ''}</b><em>${G.hint}${Object.keys(G.reward || {}).length ? ' · награда: ' + Object.entries(G.reward).map(([k, v]) => `${itemIcon(k, g.cfg.items[k])}${v}`).join(' ') : ''}</em></span>` : '');
    // --- Сутки: иконка + полоса «сколько до ночи/рассвета» + буря
    const E = g.cfg.events, dT = s.dayT, isDay = dT < E.day_sec, phase = isDay ? dT / E.day_sec : (dT - E.day_sec) / E.night_sec;
    const left = isDay ? E.day_sec - dT : E.day_sec + E.night_sec - dT;
    set('clock', `${icc(isDay ? 'g-day' : 'g-night')}<span class="dbar"><u style="width:${((1 - phase) * 100).toFixed(0)}%"></u></span><span>${isDay ? 'до ночи' : 'до рассвета'} ${mmss(left)}</span>${X.stormOn ? `${icc('g-storm')}<span class="lbl">буря</span>` : X.warned ? `${icc('g-storm')}<span>скоро</span>` : ''}`);
    this.el('clock').classList.toggle('night', !isDay);
    // --- Ti
    const ti = g.ti(), st = g.T.stages, k = g.stage(), next = st[k + 1];
    this.el('tival').textContent = ti.toFixed(1);
    this.el('stage').textContent = st[k].name;
    this.el('tibar').style.width = next ? pct(ti - st[k].ti, next.ti - st[k].ti) : '100%';
    this.el('tinext').textContent = next ? `→ ${next.name} (${next.ti})` : 'Планета жива';
    const r = g.rates();
    for (const key of ['heat', 'pressure', 'oxygen', 'biomass']) set('st_' + key, `${this.sic(key)} ${s.stats[key].toFixed(1)}<small>${r[key] ? ' +' + (r[key] * 60).toFixed(r[key] * 60 < 1 ? 2 : 1) + '/мин' : ''}</small>`);
    set('boost', (s.boosts.ti || 0) > Date.now() ? `${ic('sun')} x2 Ti · ${Math.ceil((s.boosts.ti - Date.now()) / 60000)} мин` : (s.boosts.mine || 0) > Date.now() ? `${ic('pick')} x2 добыча · ${Math.ceil((s.boosts.mine - Date.now()) / 1000)} с` : '');
    this.el('safe').style.display = g.safe ? '' : 'none';
    { const gb = this.el('goal').getBoundingClientRect(), sf = this.el('safe'); if (gb.height && innerWidth > 700) sf.style.top = Math.round(gb.bottom / UI.zoom + 6) + 'px'; else sf.style.top = ''; }
    if (g.inHouse !== this._inHouse) { this._inHouse = g.inHouse; this.el('safe').innerHTML = g.inHouse ? `${ic('house')} Дом герметичен: O₂ восполняется` : `${ic('dome')} ${this.T.safe}`; }
    // --- Кнопки действий по контексту
    const vis = (id, v) => { this.buttons[id].style.display = v ? '' : 'none'; };
    vis('mine', !g.placing && g.target && !g.player.mining && !X.nearC && !g.nearStash);
    vis('place', !!g.placing); vis('cancel', !!g.placing); vis('rot', !!g.builder.mode);
    // «Разобрать» — когда рядом своя деталь дома и не идёт стройка
    const pl = g.player.pos, nearHouse = !g.placing && s.house.some(p => { const q = p.x != null ? p : g.builder.place(p); return Math.hypot(q.x - pl.x, q.z - pl.z) < 2.4; });
    vis('unbuild', nearHouse && !g.target && !X.nearC && !g.nearStash);
    vis('meteor', !g.placing && g.nearMeteor);
    vis('loot', !g.placing && !!X.nearC && !this.lootOpen);
    vis('stash', !g.placing && !!g.nearStash && !X.nearC);
    if (this.panel === 'stash' && (!this.stashSt || Math.hypot(this.stashSt.x - g.player.pos.x, this.stashSt.z - g.player.pos.z) > 3.6)) this.close();
    this.worldTag();
    vis('lamp', !g.placing && (s.inv.lamp || 0) > 0 && (X.night > 0.3 || !!X.darkName));
    vis('jump', !g.placing);
    vis('tank', !g.placing && !g.safe && (s.inv.o2_tank || 0) > 0 && s.o2 < g.S.o2_max * 0.45);
    if (this.buttons.tank.style.display !== 'none') { const n = s.inv.o2_tank || 0, c = this.buttons.tank.querySelector('.cnt'); if (!c) this.buttons.tank.insertAdjacentHTML('beforeend', `<i class="cnt">${n}</i>`); else c.textContent = n; }
    vis('medkit', !g.placing && (s.inv.medkit || 0) > 0 && s.hp < g.S.hp_max * 0.5);
    this.buttons.x2.style.display = g.cooldownLeft('double_mine') > 0 || (s.boosts.mine || 0) > Date.now() ? 'none' : '';
    // Прогресс добычи
    const mb = this.el('minebar');
    if (g.player.mining > 0) { mb.style.display = ''; mb.firstElementChild.style.width = (100 - g.player.mining / g.mineTime() * 100) + '%'; } else mb.style.display = 'none';
    // --- Подсказка
    const PP = g.player.pos, cave = X.iceCave && !X.iceCave.open && Math.hypot(PP.x - X.iceCave.p.x, PP.z - X.iceCave.p.z) < 18 ? { zone: { name: X.iceCave.p.name, gate: X.iceCave.p.gate }, cave: true } : null;
    const gate = g.player.blockedBy || cave || g.world.gateObjects.find(q => !q.open && q.ring && Math.abs(Math.hypot(PP.x - q.ring.x, PP.z - q.ring.z) - q.ring.r) < 16) || g.world.gateObjects.find(q => !q.open && q.storm && Math.hypot(PP.x - q.zone.x, PP.z - q.zone.z) < q.zone.r + 18);
    const extra = gate?.cave ? `${icc('r-ice')} Тысячелетний лёд. Растает при ${ic('heat')} ${gate.zone.gate.value} (сейчас ${s.stats.heat.toFixed(0)})`
      : X.darkName && !(s.inv.lamp > 0) && !s.lamps.some(l => Math.hypot(l.x - g.player.pos.x, l.z - g.player.pos.z) < 12) ? `${icc('r-lamp')} ${X.darkName}: темно. Ставь фонари${kbd('F')}` : X.stormOn ? `${icc('g-storm')} Буря: плохая видимость, кислород тратится быстрее` : '';
    set('hint', extra || (gate ? `${ic(gate.zone.gate.stat === 'heat' ? 'heat' : 'storm')} ${gate.zone.gate.stat === 'heat' ? this.T.gate_ice : this.T.gate_storm} (${g.T.stats[gate.zone.gate.stat].name}: ${s.stats[gate.zone.gate.stat].toFixed(0)}/${gate.zone.gate.value})`
      : g.nearBench && !this.panel ? `${ic('craft')} Фабрикатор рядом — крафт и улучшения${kbd('C')}` : s.craftQueue.length ? `${ic('timer')} ` + s.craftQueue.map(j => `${(g.cfg.recipes.find(r => r.id === j.id) || {}).name || g.cfg.items[j.id]?.name || j.id} ${Math.max(0, Math.ceil(j.end - g.time))}с`).join(', ') : ''));
    // --- Род
    const life = g.life, L = life.L;
    const lifeOn = L.started;
    this.el('lifehud').style.display = lifeOn ? '' : 'none';
    if (lifeOn) {
      const nx = life.nextBi(), prev = L.stage + 1 < g.cfg.evolution.stages.length ? g.cfg.evolution.stages[L.stage].bi : g.cfg.evolution.village_levels.base * Math.pow(g.cfg.evolution.village_levels.growth, L.villageLv);
      this.el('bival').textContent = fmt(L.bi);
      this.el('bistage').textContent = life.stageName();
      this.el('bibar').style.width = pct(L.bi - prev, nx - prev);
      set('pop', `${ic('paw')} ${Math.floor(L.pop)}/${life.cap()}`);
      const fc = life.foodCap();
      set('food', `${icc('r-berries')} ${s.flags.auto_feeder ? 'авто' : fc ? `${Math.floor(L.food)}/${fc}` : 'нет кормушек'}`);
      this.el('food').classList.toggle('bad', life.hungry());
      set('dna', `${ic('dna')} ${fmt(L.dna)}`); set('cry', `${ic('crystal')} ${fmt(L.crystals)}`);
      set('bless', life.blessed() ? `${ic('star')} x2 · ${Math.ceil((L.bless - Date.now()) / 60000)} мин` : '');
      set('egg', L.egg ? (L.egg.ready ? `${ic('egg')} готово!` : `${ic('egg')} ${fmtT((L.egg.readyAt - Date.now()) / 1000)}`) : (L.stage + 1 < g.cfg.evolution.stages.length && L.bi >= nx && !life.buildings('incubator') ? `${ic('egg')} нужен инкубатор` : ''));
      const qd = (L.quests || []).filter(q => q.done && !q.claimed).length;
      const dot = this.buttons.life.querySelector('.dot'), want = !!(qd || L.egg?.ready || L.giftReady);
      if (want && !dot) this.buttons.life.insertAdjacentHTML('beforeend', '<i class="dot"></i>'); else if (!want && dot) dot.remove();
    }
    g.nearFeeder = s.buildings.some(b => b.model === 'feeder' && Math.hypot(b.x - g.player.pos.x, b.z - g.player.pos.z) < 3.2);
    vis('pet', !g.placing && !g.target && life.nearest && life.petReady(life.nearest));
    vis('fill', !g.placing && g.nearFeeder && life.foodCap() && L.food < life.foodCap() - 1 && !s.flags.auto_feeder);
    vis('hatch', !g.placing && L.egg?.ready);
    vis('gift', !g.placing && L.giftReady && s.buildings.some(b => b.model === 'campfire' && Math.hypot(b.x - g.player.pos.x, b.z - g.player.pos.z) < 6));
    this.buttons.life.style.display = lifeOn ? '' : 'none';
    // Живое обновление панели без сброса прокрутки и без пересборки, если ничего не поменялось
    this.tick = (this.tick || 0) + 1;
    if (this.panel === 'craft' && this.tick % 15 === 0) this.keepScroll(() => this.renderCraft());
    if (this.panel === 'life' && this.tick % 20 === 0) this.keepScroll(() => this.renderLife());
    if (this.panel === 'inv' && this.tick % 20 === 0) this.keepScroll(() => this.renderInv());
    this.el('slots').textContent = `${g.usedSlots()}/${g.slots()}`;
    this.el('slots').classList.toggle('full', g.usedSlots() >= g.slots());
    this.el('fps').style.display = this.qa ? '' : 'none';
  }

  // ---------- Панели ----------
  open(name) {
    this.sfx?.play('open');
    if (name === 'gear') name = 'inv';
    if (name === 'inv') this.g.qa.event('gear_open', {});
    const body = this.el('pbody');
    if (!this.scrollHooked) { this.scrollHooked = true; const mark = () => { this.scrolling = performance.now(); }; for (const ev of ['wheel', 'scroll', 'touchmove', 'pointerdown']) body.addEventListener(ev, mark, { passive: true }); }
    if (this.panel !== name) body.scrollTop = 0;
    this.panel = name;
    this.el('panel').style.display = 'flex';
    const [i, t, c] = { dev: [ic('settings'), 'Дев-панель', 'var(--pink)'], daily: [ic('gift'), 'Награды за вход', 'var(--gold)'], craft: [ic('craft'), this.g.state?.baseDome ? this.T.craft : 'Сборка'], inv: [icc('g-suit'), 'Снаряжение', 'var(--sky)'], store: [ic('store'), this.T.store, 'var(--mint)'], life: [ic('paw'), 'Род фенеков', 'var(--mint)'], settings: [ic('settings'), 'Настройки · пауза', 'var(--cocoa-3)'], stash: [ic('crate'), this.g.nearStash?.name || 'Ящик', 'var(--sand)'], house: [ic('house'), 'Стройка', 'var(--sand)'] }[name];
    this.el('ptitle').innerHTML = `<i class="ico" style="${c ? '--c:' + c : ''}">${i}</i>${t}`;
    ({ craft: () => this.renderCraft(), inv: () => this.renderInv(), store: () => this.renderStore(), life: () => this.renderLife(), settings: () => this.renderSettings(), dev: () => this.renderDev(), daily: () => this.renderDaily(), stash: () => this.renderStash(), house: () => this.renderHouse() })[name]();
    window.__qa.state = 'panel:' + name;
  }
  // Живая перерисовка панели без дёрганья: рендер в отвязанный div, в DOM меняем только изменившиеся строки.
  // Пока игрок листает (колесо/тачпад с инерцией/палец) — DOM не трогаем.
  keepScroll(render) {
    const body = this.el('pbody');
    if (this.scrolling && performance.now() - this.scrolling < 900) return;
    const real = this.el, tmp = document.createElement('div');
    this.el = id => id === 'pbody' ? tmp : real(id);
    try { render(); } finally { this.el = real; }
    if (tmp.innerHTML === body.innerHTML) return;
    const top = body.scrollTop, a = [...body.children], b = [...tmp.children];
    if (a.length === b.length) a.forEach((n, i) => { if (n.outerHTML !== b[i].outerHTML) n.replaceWith(b[i]); });
    else body.replaceChildren(...tmp.childNodes);
    body.scrollTop = top;
  }
  close() { if (this.panel) this.sfx?.play('close'); this.panel = null; this.el('panel').style.display = 'none'; window.__qa.state = 'playing'; }
  itemChip(k, n, need) {
    const it = this.cfg.items[k] || { name: k };
    if (need == null && it.rarity && it.rarity !== 'common') return `<span class="chip rar rar-${it.rarity}">${itemIcon(k, it)}${it.name} ×${n}</span>`;
    return this.chip(k, need != null ? this.g.haveAll(k) : n, need);
  }
  sbtn(id, label, cls, fn, dis) {
    const b = document.createElement('button'); b.id = 'b_' + id; b.className = 'btn small ' + (cls || ''); b.innerHTML = label; b.disabled = !!dis;
    b.onpointerdown = async e => { e.stopPropagation(); if (b.disabled) return; await fn(); };
    return b;
  }
  renderCraft() {
    const g = this.g, body = this.el('pbody');
    const near = g.nearBench;
    body.innerHTML = (near ? '' : `<div class="note">${ic('pin')} ${g.state.baseDome ? 'Подойди к фабрикатору в куполе, чтобы создавать предметы. Постройки можно ставить где угодно.' : 'Собери купол из секций — в нём уже стоят фабрикатор и сундук.'}</div>`);
    if (g.state.domeKit && !g.state.baseDome) { const r = document.createElement('div'); r.className = 'row'; r.innerHTML = `<div class="rname">${ic('dome')} Купол базы готов<span class="desc">выбери место и поставь</span></div>`; const b = document.createElement('button'); b.className = 'btn small ok'; b.id = 'b_place_dome'; b.innerHTML = this.T.build; b.onpointerdown = e => { e.stopPropagation(); this.close(); g.builder.start('__dome'); }; r.append(b); body.append(r); }
    // Секции по тирам: машины старших тиров не теряются среди расходников
    const secOf = r => r.unlock_life != null || ['feeder', 'incubator'].includes(r.id) ? 9 : !r.build ? -1 : (r.tier || 0) < 2 ? 1 : r.tier;
    const secName = { '-1': [ic('craft'), 'Предметы'], 1: ['I', 'Базовые машины'], 2: ['II', 'Нужен титан'], 3: ['III', 'Нужен уран'], 9: [ic('paw'), 'Род'] };
    const recs = [...g.cfg.recipes].filter(r => g.state.baseDome ? r.build !== '__dome' : r.build === '__dome' && !g.state.domeKit).sort((a, b) => secOf(a) - secOf(b));
    const where = k => {
      const res = g.cfg.world.resources[g.cfg.items[k]?.from]; const zid = res?.bias?.startsWith('zone:') && res.bias.slice(5);
      const z = zid && g.cfg.world.zones.find(z => z.id === zid); if (!z) return '';
      const dir = (z.z > 0 ? 'С' : 'Ю') + (z.x > 0 ? 'В' : 'З'), st = g.state.stats[z.gate.stat], open = st >= z.gate.value;
      return `${itemIcon(k, g.cfg.items[k])} ${g.cfg.items[k].name}: ${z.name} (${dir}, ${Math.round(z.x)}/${Math.round(z.z)}) — ${open ? 'открыта' : `откроется при ${this.sic(z.gate.stat)} ${z.gate.value} (сейчас ${st.toFixed(1)})`}`;
    };
    let sec = null;
    for (const r of recs) {
      if (secOf(r) !== sec) {
        sec = secOf(r);
        const need = { 2: ['titanium'], 3: ['uranium'] }[sec] || [], [no, nm] = secName[sec];
        body.append(Object.assign(document.createElement('div'), { className: 'note sec', innerHTML: `<span class="secno">${no}</span>${nm}${need.map(k => `<small>${ic('pin')} ${where(k)}</small>`).join('')}` }));
      }
      const s = g.recipeState(r);
      const job = g.state.craftQueue.find(j => j.id === r.id);
      const name = r.build ? `${ic('build')} ${r.name || r.build}<span class="desc">${r.desc || ''}</span>` : `${itemIcon(r.out, g.cfg.items[r.out])} ${g.cfg.items[r.out].name} ×${r.count}${g.cfg.items[r.out].use ? `<span class="desc">${Object.entries(g.cfg.items[r.out].use).map(([k, v]) => `+${v} ${k === 'o2' ? 'O₂' : 'HP'}`).join(', ')}</span>` : ''}`;
      const gives = r.gives ? Object.entries(r.gives).map(([k, v]) => `${this.sic(k)}+${+(v * 60 * (g.T.speed || 1)).toFixed(2)}/мин`).join(' ') : '';
      const row = document.createElement('div'); row.className = 'row' + (s.locked ? ' locked' : '');
      row.innerHTML = `<div class="rname">${name} <small>${gives}</small></div><div class="rcost">${s.locked ? `${ic('lock')} ${s.why}` : Object.entries(g.costOf(r)).map(([k, v]) => this.itemChip(k, 0, v)).join('')}</div>`;
      const b = document.createElement('button'); b.id = 'b_craft_' + r.id; b.className = 'btn small';
      if (job) {
        const left = Math.max(0, Math.ceil(job.end - g.time));
        b.innerHTML = `${ic('timer')} ${left}с` + (left > 6 ? ` · ${ic('ad')}` : ''); b.classList.add('ad');
        b.onpointerdown = e => { e.stopPropagation(); if (left > 6) g.instantCraft(job); };
      } else {
        b.innerHTML = r.build ? this.T.build : 'Создать';
        b.disabled = s.locked || !s.affordable || (!r.build && !near);
        if (r.build === '__dome') b.innerHTML = 'Собрать';
        b.onpointerdown = e => { e.stopPropagation(); if (b.disabled) return; if (g.craft(r.id)) { if (r.build) this.close(); else this.renderCraft(); } };
      }
      row.append(b); body.append(row);
    }
  }
  renderLife() {
    const g = this.g, life = g.life, L = life.L, E = g.cfg.evolution, body = this.el('pbody');
    const st = E.stages, icons = ['bubbles', 'egg', 'paw', 'fox', 'house'];
    let h = `<div class="evo">${st.map((x, i) => `<span class="${i < L.stage ? 'done' : i === L.stage ? 'cur' : ''}"><i class="ico">${ic(icons[i] || 'star')}</i><small>${x.name}</small></span>`).join('<b>›</b>')}</div>`;
    h += `<div class="note">Индекс биомассы <b class="num">${fmt(L.bi)}</b> (+${life.biRate().toFixed(2)}/с) → ${fmt(life.nextBi())}. Популяция ${Math.floor(L.pop)}/${life.cap()}${life.hungry() ? ' · <b style="color:#ff8a8a">голодают!</b>' : ''}</div>`;
    body.innerHTML = h;
    const row = (html, btns) => { const r = document.createElement('div'); r.className = 'row'; r.innerHTML = `<div class="rname">${html}</div>`; for (const b of btns) r.append(b); body.append(r); return r; };
    const mk = (id, label, cls, fn, dis) => this.sbtn(id, label, cls, async () => { await fn(); this.renderLife(); }, dis);
    if (L.egg) {
      if (L.egg.ready) row(`${ic('egg')} <b>${st[L.egg.to].name}</b> готовы вылупиться!`, [mk('hatch_go', 'Вылупить', 'ok', () => life.hatch())]);
      else { const c = life.hatchCost(); row(`${ic('egg')} <b>${st[L.egg.to].name}</b>: ещё ${fmtT((L.egg.readyAt - Date.now()) / 1000)}`, [mk('hatch_ad', `${ic('ad')} −${E.skip_ad_min} мин`, 'ad', () => life.hatch(true)), mk('hatch_cry', `${ic('crystal')} ${c}`, 'buy', () => life.hatch(false, true), L.crystals < c)]); }
    } else if (L.stage + 1 < st.length) row(L.bi >= st[L.stage + 1].bi ? `${ic('egg')} Построй <b>инкубатор</b> — там появится яйцо нового поколения` : `Следующая эпоха: <b>${st[L.stage + 1].name}</b> при Bi ${fmt(st[L.stage + 1].bi)}`, []);
    row(`${ic('star')} Благословение рода: x2 биомасса, x1.5 рост ${life.blessed() ? `<small>ещё ${fmtT((L.bless - Date.now()) / 1000)}</small>` : ''}`, [mk('bless_ad', `${ic('ad')} 30 мин`, 'ad', () => life.blessAd(), g.cooldownLeft('bless_ad') > 0)]);
    if (life.buildings('campfire')) row(L.giftReady ? `${ic('gift')} Племя приготовило дары!` : `${ic('gift')} Дары через ${fmtT(((L.giftAt || 0) - Date.now()) / 1000)}`, L.giftReady ? [mk('gift_take', 'Забрать', 'ok', () => life.claimGift(false)), mk('gift_x2', `${ic('ad')} x2`, 'ad', () => life.claimGift(true))] : []);
    body.append(Object.assign(document.createElement('div'), { className: 'note sec', innerHTML: `<span class="secno">${ic('star')}</span>Задания старейшины` }));
    (L.quests || []).forEach((q, i) => row(`<span class="quest ${q.claimed ? 'claimed' : q.done ? 'done' : ''}">${q.done ? ic('check') : ''}</span>${q.text} <span class="num">${Math.min(q.have, q.n)}/${q.n}</span><span class="qbar"><u style="width:${Math.min(100, q.have / q.n * 100)}%"></u></span>`, q.done && !q.claimed ? [mk('quest_' + i, `+${E.quest_reward.crystals} ${ic('crystal')} +${E.quest_reward.dna} ${ic('dna')}`, 'ok', () => life.claimQuest(i))] : []));
    body.append(Object.assign(document.createElement('div'), { className: 'note sec', innerHTML: `<span class="secno">${ic('dna')}</span>Черты рода<small>${fmt(L.dna)} ДНК · гладь сородичей</small>` }));
    if (!L.traits.length) row('Черты появятся при первой эволюции', []);
    for (const id of L.traits) {
      const t = E.traits.find(x => x.id === id), lv = L.traitLv[id] || 0, c = life.traitCost(id);
      row(`${ic(t.rare ? 'star' : 'dna')} <b>${t.name}</b> ур. ${lv + 1}<span class="desc">${t.desc}</span>`, [mk('trait_' + id, `${ic('dna')} ${c}`, '', () => life.upgradeTrait(id), L.dna < c)]);
    }
  }
  traitDialog(opts, life) {
    return new Promise(res => {
      if (this.panel) this.close();
      const d = this.el('dialog'); d.style.display = 'flex';
      const card = d.firstElementChild; card.className = 'card';
      const draw = list => {
        card.innerHTML = `<h2>Новое поколение!</h2><p>Выбери черту, которую унаследует род</p><div class="traits">${list.map(t => `<button class="trait ${t.rare ? 'rare' : ''}" id="b_trait_pick_${t.id}">${t.fur ? `<i style="background:${t.fur};border-color:${t.accent}"></i>` : `<i class="ico" style="--c:var(--mint)">${ic('dna')}</i>`}<b>${t.name}</b><small>${t.desc}</small>${t.rare ? '<em>редкая</em>' : ''}</button>`).join('')}</div><div class="dbtns"><button class="btn ad" id="b_trait_reroll">${ic('ad')} Другие варианты</button></div>`;
        for (const t of list) card.querySelector('#b_trait_pick_' + t.id).onpointerdown = e => { e.stopPropagation(); d.style.display = 'none'; window.__qa.state = 'playing'; res(t.id); };
        card.querySelector('#b_trait_reroll').onpointerdown = async e => { e.stopPropagation(); if (await this.g.rewarded('trait_reroll')) draw(life.offerTraits(true)); };
      };
      draw(opts);
      window.__qa.state = 'dialog';
    });
  }
  // Единая панель «Снаряжение»: 4 карточки экипировки (с улучшением) + сетка слотов рюкзака
  renderInv() {
    const g = this.g, X = g.explore, body = this.el('pbody');
    const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const d = n % 10; return n > 10 && n < 20 ? c : d > 1 && d < 5 ? b : d === 1 ? a : c; };
    const unit = { slots: v => ` ${plural(v, 'слот', 'слота', 'слотов')}`, o2: () => ' O₂', mine: () => '×', fuel: () => ' с' };
    let h = '<div class="gear">';
    for (const [gid, G] of Object.entries(g.cfg.gear)) {
      const cur = g.state.gear[gid] || 0, u = X.upgradeState(gid), un = unit[G.stat], cap = { slots: 'вместимость', o2: 'запас воздуха', mine: 'скорость добычи', fuel: 'время полёта (подъём до 3 м)' }[G.stat];
      const tiers = `<span class="tier">${G.tiers.map((_, i) => `<i class="${i <= cur ? 'on' : ''}"></i>`).join('')}</span>`;
      const val = G.stat === 'fuel' && !G.tiers[cur].v ? 'нет' : G.tiers[cur].v + un(G.tiers[cur].v);
      const need = u.max ? `<b style="color:var(--gold)">максимум</b>` : u.known ? Object.entries(u.next.cost).map(([k, v]) => this.itemChip(k, 0, v)).join('') : `${icc('r-bp')} чертёж <span class="rar-${g.cfg.items[u.next.bp].rarity}">«${g.cfg.items[u.next.bp].name.replace('Чертёж: ', '')}»</span>`;
      h += `<div class="gcard ${u.max ? 'max' : ''}" data-g="${gid}"><div class="gt">${icc('g-' + gid)}<span><b>${G.name}</b>${tiers}</span></div><div class="gv"><em>${cap}</em>${val}${u.next ? ` <small>→ ${u.next.v}${un(u.next.v)}</small>` : ''}</div><div class="gneed">${need}</div></div>`;
    }
    h += '</div>';
    const used = g.usedSlots(), max = g.slots(), stack = g.cfg.player.stack;
    h += `<div class="balance ${used > max ? 'over' : ''}"><span>${icc('g-backpack')} Рюкзак</span><b>${used}/${max}</b><span class="note" style="padding:0">клетка = до ${stack} шт.${used > max ? ' · <b style="color:#ff9a8c">перегруз!</b>' : ''}</span></div>`;
    h += '<div class="slots" id="slotgrid"></div>';
    if (!g.nearBench) h += `<div class="note">${ic('pin')} Улучшать снаряжение можно у фабрикатора на базе. Чертежи — в контейнерах, у пропавших космонавтов, в обломках и ядрах метеоритов.</div>`;
    body.innerHTML = h;
    // Кнопки улучшения в карточках
    for (const [gid] of Object.entries(g.cfg.gear)) {
      const u = X.upgradeState(gid); if (u.max) continue;
      const lbl = !u.known ? `${ic('lock')} Нет чертежа` : !u.affordable ? `${ic('lock')} Не хватает ресурсов` : !g.nearBench ? `${ic('pin')} У фабрикатора` : 'Улучшить';
      const card = body.querySelector(`.gcard[data-g="${gid}"]`);
      if (u.known && !u.affordable) { card.classList.add('need'); const miss = Object.entries(u.next.cost).filter(([k, v]) => g.haveAll(k) < v).map(([k, v]) => `${g.cfg.items[k].name} ${v - g.haveAll(k)}`).join(', '); card.insertAdjacentHTML('beforeend', `<div class="gmiss">${ic('lock')} Не хватает: <b>${miss}</b></div>`); }
      body.querySelector(`.gcard[data-g="${gid}"]`).append(this.sbtn('gear_' + gid, lbl, u.affordable && g.nearBench ? 'ok' : '', () => { if (X.upgrade(gid)) this.renderInv(); }, !u.affordable || !g.nearBench));
    }
    // Слоты: каждая стопка — клетка; расходники — по тапу
    const grid = body.querySelector('#slotgrid');
    const cells = [];
    for (const [k, n] of Object.entries(g.state.inv)) for (let left = n; left > 0; left -= stack) cells.push([k, Math.min(stack, left)]);
    cells.forEach(([k, n], i) => {
      const it = g.cfg.items[k] || { name: k }, b = document.createElement('button');
      b.className = `slot ${it.rarity && it.rarity !== 'common' ? 'rar-' + it.rarity : ''} ${it.use ? 'use' : ''}`; b.title = it.name;
      if (it.use && !cells.slice(0, i).some(c => c[0] === k)) b.id = 'b_use_' + k;
      b.innerHTML = `${itemIcon(k, it)}<b>${n}</b><span>${it.name.replace('Чертёж: ', '')}</span>${it.use ? `<small>${Object.entries(it.use).map(([a, v]) => `+${v} ${a === 'o2' ? 'O₂' : 'HP'}`).join(' ')}</small>` : ''}`;
      if (it.use) b.onpointerdown = e => { e.stopPropagation(); g.use(k); this.renderInv(); };
      else if (it.bp) { b.classList.add('use'); b.insertAdjacentHTML('beforeend', '<small>изучить</small>'); b.onpointerdown = e => { e.stopPropagation(); X.learn(k); if (!--g.state.inv[k]) delete g.state.inv[k]; this.renderInv(); }; }
      grid.append(b);
    });
    for (let i = cells.length; i < max; i++) grid.insertAdjacentHTML('beforeend', '<div class="slot empty"></div>');
    const G = g.cfg.gear.backpack, top = G.tiers[G.tiers.length - 1].v;
    for (let i = max; i < top; i++) grid.insertAdjacentHTML('beforeend', `<div class="slot lockd">${ic('lock')}</div>`);
  }
  // Вскрытие лута: предметы появляются по одному, по возрастанию редкости; эпик/легендарка — со вспышкой
  lootPanel(title, items, X) {
    return new Promise(res => {
      const order = ['common', 'uncommon', 'rare', 'epic', 'legendary'], R = Object.fromEntries(this.g.cfg.loot.rarity.map(r => [r.id, r]));
      const list = items.map(x => ({ ...x })).sort((a, b) => order.indexOf(X.loot.rarityOf(a.id)) - order.indexOf(X.loot.rarityOf(b.id)));
      const d = this.el('dialog'); d.style.display = 'flex'; this.lootOpen = true; window.__qa.state = 'loot';
      const card = d.firstElementChild; card.className = 'card lootcard';
      const best = list.length ? X.loot.rarityOf(list[list.length - 1].id) : 'common';
      card.innerHTML = `${best === 'legendary' ? '<div class="rays"></div>' : ''}<h2>${title}</h2><div class="lsub">${ic('crate')} Рюкзак ${this.g.usedSlots()}/${this.g.slots()}</div><div class="lootgrid"></div><div class="dbtns"><button class="btn ok" id="b_loot_all">${icc('g-backpack')} Забрать всё</button><button class="btn sec" id="b_loot_close">Закрыть</button></div>`;
      const grid = card.querySelector('.lootgrid');
      const cells = list.map((x, i) => {
        const it = this.g.cfg.items[x.id] || { name: x.id }, r = X.loot.rarityOf(x.id);
        const c = document.createElement('button'); c.className = `lcell rar-${r} hidden`; c.id = 'b_lootitem_' + i;
        c.innerHTML = `${it.bp ? `<span class="bp">${ic('blueprint')}</span>` : ''}<i>${itemIcon(x.id, it)}${x.n > 1 ? `<u>×${x.n}</u>` : ''}</i><b>${it.name}</b><small>${R[r].name}</small>`;
        c.onpointerdown = e => { e.stopPropagation(); take(i); };
        grid.append(c); return c;
      });
      const take = i => { const x = list[i]; if (!x || x.n <= 0) return; const got = X.takeItem(x.id, x.n); x.n -= got; if (!got) this.toast(this.T.inventory_full, 'warn'); if (x.n <= 0) cells[i].classList.add('taken'); else { const u = cells[i].querySelector('u'); if (u) u.textContent = '×' + x.n; } card.querySelector('.lsub').innerHTML = `${ic('crate')} Рюкзак ${this.g.usedSlots()}/${this.g.slots()}`; };
      let k = 0; const reveal = () => { if (k >= cells.length || !this.lootOpen) return; const r = X.loot.rarityOf(list[k].id); cells[k].classList.remove('hidden'); if (r === 'epic' || r === 'legendary') { this.flash(R[r].color); this.shake(0.15); card.classList.add(r === 'legendary' ? 'legend' : 'epic'); } k++; setTimeout(reveal, r === 'legendary' ? 700 : r === 'epic' ? 450 : 230); };
      setTimeout(reveal, 250);
      const close = () => { d.style.display = 'none'; card.className = 'card'; this.lootOpen = false; window.__qa.state = 'playing'; res(list.filter(x => x.n > 0)); };
      card.querySelector('#b_loot_all').onpointerdown = e => { e.stopPropagation(); cells.forEach(c => c.classList.remove('hidden')); list.forEach((_, i) => take(i)); if (list.every(x => x.n <= 0)) close(); };
      card.querySelector('#b_loot_close').onpointerdown = e => { e.stopPropagation(); close(); };
    });
  }
  // Цель выполнена: салют, вспышка, тост с наградой
  goalDone(G) {
    const g = this.g;
    this.flash('#ffcf4a'); this.shake(0.12);
    this.el('toasts').prepend(document.createElement('span'));
    this.toast(`${ic('check')} <b>${G.text}</b> — готово! ${Object.entries(G.reward).map(([k, v]) => `${itemIcon(k, g.cfg.items[k])}+${v}`).join(' ')}`, 'rar-legendary');
    const box = this.el('goal'); box.classList.remove('done'); void box.offsetWidth; box.classList.add('done');
    const conf = document.createElement('div'); conf.className = 'confetti';
    const r = box.getBoundingClientRect();
    for (let i = 0; i < 28; i++) { const c = document.createElement('i'); c.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;--dx:${(Math.random() - 0.5) * 320}px;--dy:${-60 - Math.random() * 200}px;--r:${Math.random() * 720}deg;background:${['#ffcf4a', '#5cd6a8', '#f58a3c', '#6cc8ff', '#ff7aa8'][i % 5]};animation-delay:${Math.random() * 0.1}s`; conf.append(c); }
    document.body.append(conf); setTimeout(() => conf.remove(), 1500);
    g.player.emoteOnce?.('cheer', 1.6);
  }
  flash(color) { const f = this.el('flash'); f.style.background = `radial-gradient(circle, ${color}cc 0%, ${color}00 70%)`; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
  renderStore() {
    const g = this.g, body = this.el('pbody');
    body.innerHTML = `<div class="balance"><span>${ic('crystal')} Кристаллы</span><b>${Math.floor(g.life.L.crystals)}</b></div>`;
    for (const p of g.M.iap) {
      if (p.life && !g.life.L.started) continue;
      const owned = p.once && g.state.flags['bought_' + p.id];
      const row = document.createElement('div'); row.className = 'row' + (p.best ? ' best' : '');
      row.innerHTML = `<div class="rname">${p.best ? '<b class="tag">ХИТ</b> ' : ''}${p.title}<span class="desc">${p.desc}</span></div>`;
      row.append(this.sbtn('iap_' + p.id, owned ? ic('check') : p.price, 'buy', async () => { if (await g.buy(p.id)) this.renderStore(); }, owned));
      body.append(row);
    }
  }
  // Сундук: две сетки (рюкзак ↔ ящик). Перетаскивание или тап — переложить стопку; «Сложить всё» — ресурсы в ящик.
  renderStash() {
    const g = this.g, st = this.stashSt || g.nearStash, body = this.el('pbody'); if (!st) return this.close();
    const stack = g.cfg.player.stack, S = g.stashOf(st);
    const cells = bag => { const out = []; for (const [k, n] of Object.entries(bag)) for (let l = n; l > 0; l -= stack) out.push([k, Math.min(stack, l)]); return out; };
    const grid = (bag, max, side) => {
      const cs = cells(bag);
      return `<div class="slots dropzone" data-side="${side}">${cs.map(([k, n]) => { const it = g.cfg.items[k] || { name: k }; return `<button class="slot ${it.rarity && it.rarity !== 'common' ? 'rar-' + it.rarity : ''}" draggable="true" data-k="${k}" data-n="${n}" data-from="${side}" id="b_${side}_${k}">${itemIcon(k, it)}<b>${n}</b><span>${it.name.replace('Чертёж: ', '')}</span></button>`; }).join('')}${'<div class="slot empty"></div>'.repeat(Math.max(0, max - cs.length))}</div>`;
    };
    body.innerHTML = `<div class="balance"><span>${icc('g-backpack')} Рюкзак</span><b>${g.usedSlots()}/${g.slots()}</b><span class="note" style="padding:0">тап или перетащи в ящик</span></div>${grid(g.state.inv, g.slots(), 'inv')}`
      + `<div class="dbtns" style="margin:4px 0 12px"><button class="btn small ok" id="b_stash_all">↓ Ресурсы в ящик</button><button class="btn small sec" id="b_stash_take">↑ Забрать в рюкзак</button></div>`
      + `<div class="balance"><span>${ic('crate')} ${st.name}</span><b>${g.stashUsed(st)}/${st.slots}</b></div><div class="note" style="margin:-6px 0 4px">Тап — забрать в рюкзак. Не теряется при смерти.</div>${grid(S, st.slots, 'stash')}`;
    const move = (k, n, from) => { const m = g.moveStash(st, k, n, from === 'inv' ? 'in' : 'out'); if (!m) this.toast(from === 'inv' ? 'Ящик полон' : this.T.inventory_full, 'warn'); this.renderStash(); };
    body.querySelectorAll('.slot[data-k]').forEach(b => {
      b.onclick = e => { e.stopPropagation(); move(b.dataset.k, +b.dataset.n, b.dataset.from); };
      b.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', JSON.stringify(b.dataset)); b.classList.add('drag'); });
      b.addEventListener('dragend', () => b.classList.remove('drag'));
      // Тач-перетаскивание: палец ведёт клон, отпускание над другой сеткой — перенос
      b.addEventListener('touchstart', e => {
        const t0 = e.touches[0]; let ghost = null, moved = false;
        const mv = ev => { const t = ev.touches[0]; if (!moved && Math.hypot(t.clientX - t0.clientX, t.clientY - t0.clientY) < 10) return; moved = true; ev.preventDefault();
          if (!ghost) { ghost = b.cloneNode(true); ghost.classList.add('ghost'); document.body.append(ghost); }
          ghost.style.left = t.clientX - 36 + 'px'; ghost.style.top = t.clientY - 36 + 'px'; };
        const up = ev => { removeEventListener('touchmove', mv); removeEventListener('touchend', up); if (ghost) ghost.remove();
          if (!moved) return; const t = ev.changedTouches[0], z = document.elementFromPoint(t.clientX, t.clientY)?.closest('.dropzone');
          if (z && z.dataset.side !== b.dataset.from) move(b.dataset.k, +b.dataset.n, b.dataset.from); };
        addEventListener('touchmove', mv, { passive: false }); addEventListener('touchend', up);
      }, { passive: true });
    });
    body.querySelectorAll('.dropzone').forEach(z => {
      z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('over'); });
      z.addEventListener('dragleave', () => z.classList.remove('over'));
      z.addEventListener('drop', e => { e.preventDefault(); z.classList.remove('over'); const d = JSON.parse(e.dataTransfer.getData('text/plain') || '{}'); if (d.k && d.from !== z.dataset.side) move(d.k, +d.n, d.from); });
    });
    body.querySelector('#b_stash_all').onclick = e => { e.stopPropagation(); let m = 0; for (const [k] of Object.entries({ ...g.state.inv })) { const it = g.cfg.items[k]; if (it?.use || it?.bp) continue; m += g.moveStash(st, k, g.state.inv[k], 'in'); } if (!m) this.toast('Нечего сложить или ящик полон', 'warn'); this.renderStash(); };
    body.querySelector('#b_stash_take').onclick = e => { e.stopPropagation(); for (const [k, n] of Object.entries({ ...S })) g.moveStash(st, k, n, 'out'); this.renderStash(); };
  }
  // Стройка: каталог модульных деталей. Выбор → режим установки (призрак по сетке 2 м), ставить подряд.
  renderHouse() {
    const g = this.g, body = this.el('pbody'), B = g.builder;
    if (!g.state.baseDome) { body.innerHTML = `<div class="note">${ic('pin')} Сначала поставь купол базы: Крафт (C) → «Купол базы». Потом к нему можно пристраивать модули.</div>`; if (g.state.domeKit) { const b = document.createElement('button'); b.className = 'btn ok'; b.innerHTML = 'Поставить купол'; b.onpointerdown = e => { e.stopPropagation(); this.close(); g.builder.start('__dome'); }; body.append(b); } return; }
    const kinds = { module: 'Модули', floor: 'Основа', wall: 'Стены', post: 'Опоры', deco: 'Обстановка' };
    let h = `<div class="note"><b>Модули</b> ставятся где угодно целиком и стыкуются бок о бок — получается одно помещение. Дверь-шлюз открывается сама, внутри восполняются O₂ и здоровье. R — сторона двери.<br>${ic('jump')} Поставить — E · повернуть/другая сторона — R · разобрать с возвратом — X.</div>`;
    body.innerHTML = h;
    for (const [k, title] of Object.entries(kinds)) {
      const list = g.cfg.build_pieces.filter(p => (p.kind === k) || (k === 'floor' && p.roof));
      const uniq = list.filter((p, i) => list.indexOf(p) === i && (k !== 'floor' || p.kind === 'floor'));
      if (!uniq.length) continue;
      body.append(Object.assign(document.createElement('div'), { className: 'note sec', innerHTML: `<span class="secno">${ic(k === 'deco' ? 'star' : 'house')}</span>${title}` }));
      for (const P of uniq) {
        const row = document.createElement('div'); row.className = 'row' + (P.legendary ? ' best' : '');
        row.innerHTML = `<div class="rname">${P.name}${P.store ? `<span class="desc">хранилище на ${P.store} ячеек</span>` : P.pass ? '<span class="desc">проход и шлюз — комната остаётся герметичной</span>' : P.kind === 'dome' ? '<span class="desc">большой герметичный купол со шлюзом: O₂, буря тише, внутри можно ставить фабрикатор и сундуки</span>' : P.kind === 'module' ? '<span class="desc">герметичная комната: O₂, буря тише</span>' : P.id === 'b_beacon' ? '<span class="desc">в песчаную бурю светит лучом в небо — база видна издалека</span>' : P.recipe === 'chest' ? '<span class="desc">хранилище, можно ставить внутри</span>' : P.recipe === 'workbench' ? '<span class="desc">ещё один крафт-пункт, можно ставить внутри</span>' : ''}</div><div class="rcost">${Object.entries(P.cost).map(([c, v]) => this.itemChip(c, 0, v)).join('')}</div>`;
        const cost = P.recipe ? g.costOf(g.cfg.recipes.find(r => r.id === P.recipe)) : P.cost; if (P.recipe) row.querySelector('.rcost').innerHTML = Object.entries(cost).map(([c, v]) => this.itemChip(c, 0, v)).join('');
        row.append(this.sbtn('house_' + P.id, 'Ставить', '', () => { if (B.start(P.id)) this.close(); }, !g.has(cost)));
        body.append(row);
      }
    }
  }
  // ---------- Дев-панель (временная): выдать ресурсы, чертежи, награды календаря ----------
  renderDev() {
    const g = this.g, body = this.el('pbody');
    const row = (label, fn, sub = '') => { const r = document.createElement('div'); r.className = 'row'; r.innerHTML = `<div class="rname">${label}<span class="desc">${sub}</span></div>`; r.append(this.sbtn('dev_' + label.replace(/\W+/g, '_'), 'Дать', 'ok', () => { fn(); this.toast('DEV: ' + label); this.renderDev(); })); body.append(r); };
    body.innerHTML = `<div class="note">${ic('settings')} Временная панель разработчика (F9). В релизе её не будет.</div>`;
    row('Чертёж: Марсоход', () => { g.state.bps.rover = 1; g.save(); }, g.state.bps?.rover ? 'уже изучен — Крафт (C) → Марсоход' : 'рецепт появится в Крафте');
    row('Ресурсы на марсоход', () => { g.give?.({}) ; for (const [k, v] of Object.entries({ iron: 20, silicon: 8, titanium: 4, cobalt: 4 })) g.state.inv[k] = (g.state.inv[k] || 0) + v; }, '20 железа, 8 кремния, 4 титана, 4 кобальта');
    row('Поставить марсоход рядом', () => { const r = g.cfg.recipes.find(x => x.id === 'rover'), p = g.player.pos, f = g.player.forward(); const b = { model: 'rover', recipe: 'rover', x: +(p.x + f.x * 4).toFixed(2), z: +(p.z + f.z * 4).toFixed(2), rot: g.player.obj.rotation.y }; g.state.buildings.push(b); g.spawnBuilding(b, true); g.save(); }, 'без ресурсов, сразу перед героем');
    row('Джетпак 1 уровня', () => { const st = g.state; st.bps.jet = Math.max(st.bps.jet || 0, 1); st.gear.jet = Math.max(st.gear.jet || 0, 1); g.explore.applyGear(); g.player.jetFuel = g.player.jetFuelMax; g.save(); }, (g.state.gear?.jet || 0) >= 1 ? 'уже есть — двойной прыжок (Пробел в воздухе)' : 'чертёж + сразу надет, без ресурсов');
    row('Следующий день календаря', () => { g.daily?.dev(); }, `сейчас открыто дней: ${g.state.daily?.claimed || 0}`);
    row('Сбросить календарь', () => { g.state.daily = { claimed: 0, last: '' }; g.save(); });
    row('+50 ко всем ресурсам', () => { for (const k of ['iron', 'silicon', 'ice', 'titanium', 'cobalt']) g.state.inv[k] = (g.state.inv[k] || 0) + 50; });
    row('Бессмертие (O₂ не тратится)', () => { g.devDrain = g.devDrain === 0 ? 1 : 0; }, g.devDrain === 0 ? 'включено' : 'выключено');
  }
  // ---------- Календарь наград за вход ----------
  renderDaily() {
    const g = this.g, body = this.el('pbody'), D = g.cfg.daily_calendar, st = g.state.daily || { claimed: 0 };
    body.innerHTML = `<div class="note">${ic('gift')} Каждый новый день, когда заходишь в игру, — следующая награда. Пропуски ничего не сбрасывают.</div><div class="daily"></div>`;
    const box = body.querySelector('.daily');
    D.forEach((d, i) => {
      const got = i < st.claimed, next = i === st.claimed, c = document.createElement('div');
      c.className = `dcell ${got ? 'got' : ''} ${next ? 'next' : ''} ${d.big ? 'big' : ''}`; c.dataset.i = i;
      c.innerHTML = `<small>День ${d.day}</small><div class="dico">${d.preview === 'rover' ? ic('rocket') : d.preview === 'skin' ? ic('suit') : d.preview === 'drone' ? ic('star') : ic('gift')}</div><b>${d.title}</b><em>${got ? ic('check') + ' получено' : next ? (g.daily?.canClaim() ? 'сегодня!' : 'завтра') : ''}</em>`;
      const show = () => { box.querySelectorAll('.dcell.hov').forEach(e => e.classList.remove('hov')); c.classList.add('hov'); this.dailyPreview(d, c); }; c.addEventListener('pointerenter', show); c.addEventListener('pointerdown', e => { e.stopPropagation(); show(); });
      c.addEventListener('pointerleave', () => { c.classList.remove('hov'); this.dailyPreview(null); });
      box.append(c);
    });
    if (g.daily?.canClaim()) { const b = this.sbtn('daily_claim', `${ic('gift')} Забрать награду дня ${st.claimed + 1}`, 'ok', () => { g.daily.claim(); this.buttons.daily?.classList.remove('pulseb'); this.renderDaily(); }); b.classList.remove('small'); body.append(b); }
  }
  dailyPreview(d, cell) {
    let pv = document.getElementById('dprev'); if (!d) { if (pv) pv.style.display = 'none'; return; }
    if (!pv) { pv = document.createElement('div'); pv.id = 'dprev'; this.el('ui').append(pv); }
    const items = Object.entries(d.items || {}).map(([k, v]) => this.itemChip(k, v)).join('');
    pv.innerHTML = `<div class="pvimg">${d.preview ? `<canvas width="360" height="220"></canvas>` : `<div class="pvicon">${ic('gift')}</div>`}</div><b>День ${d.day}: ${d.title}</b>${d.desc ? `<p>${d.desc}</p>` : ''}<div class="pvitems">${items}</div>`;
    pv.style.display = 'block';
    const z = UI.zoom || 1, P = this.el('pbody').parentElement.getBoundingClientRect(), r = cell.getBoundingClientRect(), W = innerWidth / z, H = innerHeight / z;
    const wpv = 360; pv.style.width = wpv + 'px';
    let x = P.right / z + 8; if (x + wpv > W - 4) x = P.left / z - wpv - 8;
    if (x >= 4) { pv.style.left = x + 'px'; pv.style.top = Math.min(H - 350, Math.max(8, P.top / z)) + 'px'; }
    else { pv.style.left = (P.left / z + (P.width / z - wpv) / 2) + 'px'; pv.style.top = (P.top / z + 56) + 'px'; } // узкий экран — по центру окна, под заголовком
    if (d.preview) this.g.previewModel?.(pv.querySelector('canvas'), d.preview === 'skin' && d.skin?.startsWith('skin_') ? d.skin : d.preview);
  }
  skinsHtml() {
    const g = this.g; if (!g.skins) return '';
    const own = g.skins.owned(), cur = g.skins.cur(), names = { hero: 'Стандартный', ...Object.fromEntries(Object.entries(g.cfg.skins || {}).map(([k, v]) => [k, v.name])) };
    const all = ['hero', ...Object.keys(g.cfg.skins || {})];
    return `<div class="note sec"><span class="secno">${ic('suit')}</span>Скафандр</div><div class="dbtns">` + all.map(id => own[id]
      ? `<button class="btn ${id === cur ? 'ok' : 'sec'}" data-skin="${id}" ${id === cur ? 'disabled' : ''}>${names[id] || id}${id === cur ? ' ✓' : ''}</button>`
      : `<button class="btn sec" disabled>${names[id] || id} 🔒</button>`).join('') + `</div>`;
  }
  renderSettings() {
    const S = this.settings, body = this.el('pbody');
    const range = (id, icon, label) => `<div class="set">${ic(icon)}<label for="s_${id}">${label}</label><input type="range" id="s_${id}" min="0" max="100" step="5" value="${Math.round(S[id] * 100)}"><output>${Math.round(S[id] * 100)}%</output></div>`;
    body.innerHTML = `<div class="note sec"><span class="secno">${ic('sound')}</span>Звук</div>`
      + range('master', 'sound', 'Общая') + range('music', 'music', 'Музыка') + range('sfx', 'pick', 'Эффекты')
      + `<div class="note sec"><span class="secno">${ic('lang')}</span>Язык</div>`
      + `<div class="set">${ic('lang')}<label for="s_lang">Язык</label><select id="s_lang"><option value="ru">Русский</option><option value="en">English (скоро)</option><option value="tr">Türkçe (скоро)</option></select></div>`
      + `<div class="note">Переводы появятся в следующих версиях — настройки уже сохраняются.</div>`
      + this.skinsHtml()
      + `<div class="note sec"><span class="secno">${ic('timer')}</span>Сохранение</div><div class="dbtns"><button class="btn bad" id="b_restart">Начать заново</button></div>`;
    const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(S)); } catch {} dispatchEvent(new CustomEvent('terra-settings', { detail: S })); };
    for (const id of ['master', 'music', 'sfx']) {
      const inp = body.querySelector('#s_' + id);
      inp.addEventListener('input', () => { S[id] = inp.value / 100; inp.nextElementSibling.textContent = inp.value + '%'; save(); });
      for (const ev of ['pointerdown', 'touchstart', 'keydown']) inp.addEventListener(ev, e => e.stopPropagation(), { passive: true });
    }
    body.querySelectorAll('[data-skin]').forEach(b => b.onclick = async e => { e.stopPropagation(); b.disabled = true; await this.g.skins?.wear(b.dataset.skin); this.renderSettings(); });
    body.querySelector('#b_restart').onclick = async e => { e.stopPropagation(); this.close();
      const id = await this.dialog(`<h2>Начать заново?</h2><p>Весь прогресс планеты, постройки, снаряжение и Род будут удалены. Это нельзя отменить.</p>`, [['rs_no', 'Отмена', 'sec'], ['rs_yes', 'Удалить и начать', 'bad']]);
      if (id !== 'rs_yes') return; this.g.restarting = true; try { localStorage.removeItem(this.g.saveKey()); } catch {} location.reload(); };
    const sel = body.querySelector('#s_lang'); sel.value = S.lang;
    sel.addEventListener('change', () => { S.lang = sel.value; save(); if (sel.value !== 'ru') this.toast('Перевод появится позже — пока русский'); });
    for (const ev of ['pointerdown', 'touchstart']) sel.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  }

  // ---------- Сообщения ----------
  // Стрелка над целью задания: 3D-указатель над объектом + метка у края экрана, если цель вне кадра
  goalTag() {
    const g = this.g, el = this.el('qtag'); if (!el || !this.camera) return;
    const G = g.goal(), gp = G && g.goalPos?.(G);
    if (!this.qarrow) { const T = window.THREE_NS; const m = new T.Mesh(new T.ConeGeometry(0.5, 1.0, 4), new T.MeshBasicMaterial({ color: '#ffb400', fog: false })); m.rotation.x = Math.PI; const o = new T.Mesh(new T.ConeGeometry(0.58, 1.12, 4), new T.MeshBasicMaterial({ color: '#1c110d', side: T.BackSide, fog: false })); m.add(o); g.scene.add(m); this.qarrow = m; }
    const P = g.player.pos, d = gp ? Math.hypot(gp.x - P.x, gp.z - P.z) : 0;
    this.qarrow.visible = !!gp && !g.dead && d > 2.2;
    if (!gp) { el.style.display = 'none'; return; }
    const y = g.world.heightAt(gp.x, gp.z) + 2.6 + Math.sin(performance.now() / 260) * 0.25;
    this.qarrow.position.set(gp.x, y, gp.z); this.qarrow.rotation.y += 0.04; this.qarrow.scale.setScalar(Math.min(4, 1 + d / 30));
    const v = (this._qv ||= this.camera.position.clone()).set(gp.x, y, gp.z).project(this.camera);
    const on = v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.85;
    if (on || this.panel || d < 6) { el.style.display = 'none'; return; }
    let x = v.x, yy = v.y; if (v.z > 1) { x = -x; yy = -yy; } const k = Math.max(Math.abs(x) / 0.88, Math.abs(yy) / 0.78, 1); x /= k; yy /= k;
    el.style.display = ''; el.innerHTML = `${ic('star')}<b>${Math.round(d)} м</b>`;
    el.style.transform = `translate(${(x * 0.5 + 0.5) * innerWidth / UI.zoom}px, ${(-yy * 0.5 + 0.5) * innerHeight / UI.zoom}px) translate(-50%, -50%)`;
  }
  // Метка-маяк: где база (ближайший маяк, иначе купол), прижата к краю экрана, с дистанцией
  beaconTag() {
    const g = this.g, el = this.el('btag'); if (!el || !this.camera) return;
    const P = g.player.pos, bs = g.builder.beacons.map(o => o.position);
    const b = bs.sort((a, c) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(c.x - P.x, c.z - P.z))[0];
    const d = b ? Math.hypot(b.x - P.x, b.z - P.z) : 0;
    if (!b || d < 18 || this.panel) { el.style.display = 'none'; return; }
    const v = (this._bv ||= this.camera.position.clone()).set(b.x, b.y + 4, b.z).project(this.camera);
    let x = v.x, y = v.y; if (v.z > 1) { x = -x; y = -1; }
    const k = Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.82, 1); x /= k; y /= k;
    el.style.display = ''; el.innerHTML = `${ic('pin')}<b>${Math.round(d)} м</b>`;
    el.style.transform = `translate(${(x * 0.5 + 0.5) * innerWidth / UI.zoom}px, ${(-y * 0.5 + 0.5) * innerHeight / UI.zoom}px) translate(-50%, -50%)`;
  }
  // Метка «Открыть [E]» над тем объектом, который откроется по E
  worldTag() {
    this.beaconTag(); this.goalTag();
    const g = this.g, X = g.explore, el = this.el('wtag'); if (!el || !this.camera) return;
    let t = null;
    if (!this.panel && !g.placing && !g.dead) {
      if (g.driving) t = null;
      else if (g.nearVehicle()) { const V = g.nearVehicle(); t = { x: V.b.x, z: V.b.z, h: 2.2, txt: 'Сесть', sub: 'Марсоход' }; }
      else if (X.nearC) t = { x: X.nearC.x, z: X.nearC.z, h: 1.1, txt: 'Открыть', sub: X.nearC.name };
      else if (g.nearMeteor && X.nearM) t = { x: X.nearM.x, z: X.nearM.z, h: 1.3, txt: 'Вскрыть', sub: 'Метеорит', r: 1.4 };
      else if (g.nearStash) t = { x: g.nearStash.x, z: g.nearStash.z, h: 1.15, txt: 'Открыть', sub: g.nearStash.name };
    }
    // Светящееся кольцо на земле под выбранным объектом — видно, даже если метку закрывает герой
    if (false) { const T = window.THREE_NS; if (T) { this.ring = new T.Mesh(new T.RingGeometry(0.62, 0.78, 40), new T.MeshBasicMaterial({ color: '#ffcf4a', transparent: true, opacity: 0.85, depthWrite: false, depthTest: false })); this.ring.renderOrder = 999; this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 5; g.scene.add(this.ring); } }
    if (this.ring) this.ring.visible = false; if (false) { this.ring.visible = !!t; if (t) { this.ring.position.set(t.x, g.world.heightAt(t.x, t.z) + 0.06, t.z); const k = 1 + Math.sin(performance.now() / 260) * 0.06; this.ring.scale.setScalar(k * (t.r || 1)); } }
    if (!t) { el.style.display = 'none'; this._wt = null; return; }
    const v = this._v ||= this.camera.position.clone(); v.set(t.x, g.world.heightAt(t.x, t.z) + t.h, t.z).project(this.camera);
    if (v.z > 1) { el.style.display = 'none'; return; }
    const key = t.txt + t.sub; if (this._wt !== key) { this._wt = key; el.innerHTML = `<b>${t.txt}</b>${kbd('E')}<small>${t.sub}</small>`; }
    el.style.display = ''; el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth / UI.zoom}px, ${(-v.y * 0.5 + 0.5) * innerHeight / UI.zoom}px) translate(-50%, -100%)`;
  }
  staleVeil() {
    const v = document.createElement('div'); v.id = 'pauseveil'; v.style.display = 'flex'; v.innerHTML = `<div><b>Игра открыта в другой вкладке</b><small>прогресс сохраняется там. Нажми, чтобы играть здесь</small></div>`;
    v.onpointerdown = () => location.reload(); document.getElementById('pauseveil')?.remove(); document.body.append(v);
  }
  pauseVeil(on) { if (this.g?.staleTab) return;
    let v = document.getElementById('pauseveil'); if (!v) { v = document.createElement('div'); v.id = 'pauseveil'; v.innerHTML = `<div><b>Пауза</b><small>нажми или кликни, чтобы продолжить</small></div>`; v.onpointerdown = () => { window.focus(); }; document.body.append(v); }
    v.style.display = on ? 'flex' : 'none';
  }
  coach(msg, icon) {
    this.sfx?.play('toast'); const c = document.createElement('div'); c.className = 'coach'; c.innerHTML = `${ic(icon || 'pin')}<span>${msg}</span><button class="btn small ok">Понятно</button>`;
    c.querySelector('button').onpointerdown = e => { e.stopPropagation(); c.remove(); }; document.body.append(c); setTimeout(() => c.remove(), 14000);
  }
  toast(msg, kind) {
    this.sfx?.play(kind === 'warn' ? 'warn' : /rar-(epic|legendary)/.test(kind || '') ? 'rare' : /готово!/.test(msg) ? 'none' : 'toast');
    const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.innerHTML = msg;
    const box = this.el('toasts'); if (/готово!/.test(msg)) { t.classList.add('big'); box.prepend(t); } else box.append(t); while (box.children.length > 4) box.firstElementChild.remove();
    setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2700);
  }
  pickup(item, n) { const it = this.cfg.items[item]; this.sfx?.play('pickup'); if (n) this.toast(`${itemIcon(item, it)} +${n} ${it.name}`); else this.toast(this.T.inventory_full, 'warn'); }
  stageBanner(stage, sub) {
    const b = this.el('banner'); b.innerHTML = `<small>${sub || this.T.stage_new}</small><span class="bn">${stage.name}</span>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  shake(a) { this.shakeAmt = a; }
  dialog(html, buttons) {
    return new Promise(res => {
      const d = this.el('dialog'); d.style.display = 'flex';
      d.firstElementChild.className = 'card';
      d.firstElementChild.innerHTML = html + '<div class="dbtns"></div>';
      for (const [id, label, cls] of buttons) {
        const b = document.createElement('button'); b.id = 'b_' + id; b.className = 'btn ' + (cls || ''); b.innerHTML = label.replace('📺', ic('ad'));
        b.onpointerdown = e => { e.stopPropagation(); d.style.display = 'none'; window.__qa.state = 'playing'; res(id); };
        d.querySelector('.dbtns').append(b);
      }
      window.__qa.state = 'dialog';
    });
  }
  deathDialog() {
    return this.dialog(`<div class="badge">${ic('o2')}</div><h2>${this.T.dead}</h2><p>Кислород кончился вдали от купола. Без рекламы потеряешь половину ресурсов из&nbsp;рюкзака.</p><p style="font-size:12px">Совет: следи за строкой под O₂ — там запас воздуха и время до купола. Скафандр получше — дальше вылазки.</p>`,
      [['ad', `${ic('ad')}<span>${this.g.M.rewarded.revive_keep.label}<span class="sub">смотреть рекламу</span></span>`, 'ad'], ['respawn', `${ic('dome')}<span>Очнуться на базе<span class="sub">−50% ресурсов</span></span>`, 'sec']]);
  }
}
