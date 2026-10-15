// Точка входа 3D-рантайма: рендерер, цикл, платформа, QA-хуки, дев-панель.
import * as THREE from 'three';
import { World } from './world.js';
import { Models } from './models.js';
import { Input, Player } from './player.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';

const params = new URLSearchParams(location.search);
const QA_MODE = params.has('qa');
const Q = (window.__qa = { ready: false, state: 'boot', errors: [], events: [], platform: [], fps: 0 });
addEventListener('error', e => Q.errors.push(`${e.message} @ ${String(e.filename).split('/').pop()}:${e.lineno}`));
addEventListener('unhandledrejection', e => Q.errors.push('promise: ' + (e.reason?.stack || e.reason)));
const QA = { listeners: [], event(n, d) { Q.events.push({ n, d, t: Date.now() }); if (Q.events.length > 400) Q.events.shift(); for (const f of this.listeners) f(n, d); } };
QA.platform = Q.platform;

// ---------- Платформа: заглушка или Яндекс ----------
function overlay(html, buttons, autoMs) {
  return new Promise(resolve => {
    const el = document.createElement('div'); el.className = 'overlay';
    el.innerHTML = `<div class="card">${html}<div class="dbtns"></div></div>`;
    const done = v => { el.remove(); resolve(v); };
    for (const [label, val, cls] of buttons) { const b = document.createElement('button'); b.className = 'btn ' + (cls || ''); b.textContent = label; b.onclick = () => done(val); el.querySelector('.dbtns').append(b); }
    document.body.append(el);
    if (autoMs) setTimeout(() => el.isConnected && done(true), autoMs);
  });
}
const Mock = {
  async init() {},
  async showRewarded(p) {
    if (QA_MODE) return true;
    const pr = overlay(`📺 Тестовая ревардед-реклама<br><small>${p}</small><div id="cd" style="font-size:40px">3</div>`, [['Закрыть', false, 'sec'], ['Получить награду', true, 'ok']]);
    const b = [...document.querySelectorAll('.overlay .btn')].pop(); b.disabled = true;
    let n = 3; const t = setInterval(() => { const cd = document.getElementById('cd'); if (!cd) return clearInterval(t); cd.textContent = --n; if (n <= 0) { clearInterval(t); b.disabled = false; cd.textContent = '✓'; } }, 1000);
    return pr;
  },
  async showInterstitial() { if (!QA_MODE) await overlay('📺 Тестовая межстраничная реклама', [], 1500); },
  async purchase(id, p) { return QA_MODE ? true : overlay(`🛒 Тестовая покупка<br><b>${p.title}</b><br>${p.price}`, [['Отмена', false, 'sec'], ['Купить', true, 'ok']]); },
  gameplayStart() {}, gameplayStop() {}, ready() {},
};
const Yandex = {
  async init() {
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/sdk.js'; s.onload = res; s.onerror = rej; document.head.append(s); });
    this.ysdk = await window.YaGames.init();
    try { this.payments = await this.ysdk.getPayments({ signed: false }); } catch { this.payments = null; }
  },
  ready() { try { this.ysdk.features.LoadingAPI?.ready(); } catch {} },
  gameplayStart() { try { this.ysdk.features.GameplayAPI?.start(); } catch {} },
  gameplayStop() { try { this.ysdk.features.GameplayAPI?.stop(); } catch {} },
  showRewarded() { return new Promise(r => { let ok = false; this.ysdk.adv.showRewardedVideo({ callbacks: { onRewarded: () => (ok = true), onClose: () => r(ok), onError: () => r(false) } }); }); },
  showInterstitial() { return new Promise(r => this.ysdk.adv.showFullscreenAdv({ callbacks: { onClose: () => r(), onError: () => r() } })); },
  async purchase(id, p) { if (!this.payments) return false; try { const x = await this.payments.purchase({ id }); if (!p.once && x?.purchaseToken) await this.payments.consumePurchase(x.purchaseToken); return true; } catch { return false; } },
};
const Platform = params.get('platform') === 'yandex' ? Yandex : Mock;

// ---------- Старт ----------
async function boot() {
  const cfg = await fetch('game.json', { cache: 'no-store' }).then(r => r.json());
  const man = await fetch('models.manifest.json', { cache: 'no-store' }).then(r => r.json());
  try { await Platform.init(); } catch (e) { Q.errors.push('platform: ' + e.message); }

  const lowEnd = params.has('low') || /Android|iPhone/i.test(navigator.userAgent) && (navigator.hardwareConcurrency || 4) <= 4;
  const renderer = new THREE.WebGLRenderer({ antialias: !lowEnd, powerPreference: 'high-performance', preserveDrawingBuffer: QA_MODE }); if (QA_MODE) Q.renderer = renderer;
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowEnd ? 1 : 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = !lowEnd;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.getElementById('app').append(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 1500);
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

  const scene = new THREE.Scene();
  const setLoad = (t, p) => { document.getElementById('loadtxt').textContent = t; document.getElementById('loadbar').style.width = p + '%'; };
  setLoad('Модели…', 10);
  const models = new Models(new URL('models', location.href).pathname);
  await models.load(man.models.map(m => m.id));
  if (man.props?.length && !params.has('procedural')) await models.loadGLB(man.props);
  models.recolorMap = Object.fromEntries(man.models.filter(m => m.recolor_map).map(m => [m.id, m.recolor_map]));
  setLoad('Планета…', 45);
  await new Promise(r => setTimeout(r, 20));
  const world = new World(scene, cfg);
  const input = new Input(renderer.domElement);
  // Персонаж из Tripo (если есть): GLB со скелетом и клипами
  let heroChar = null, game_skinLoad = null;
  if (man.characters?.hero && !params.has('procedural')) {
    try { const { loadCharacter, makeCharacter } = await import('./chars.js'); const H = man.characters.hero; heroChar = makeCharacter(await loadCharacter(H.url), H); heroChar.anims = H.anims; }
    catch (e) { Q.errors.push('hero glb: ' + e.message); }
  }
  // Остальные GLB-персонажи (популяция) — загружаются заранее, экземпляры создаёт Life
  models.chars = {};
  for (const [id, C] of Object.entries(man.characters || {})) if (id !== 'hero' && !params.has('procedural')) {
    try { const { loadCharacter, makeCharacter } = await import('./chars.js'); const gl = await loadCharacter(C.url); models.chars[id] = (o = {}) => { const c = makeCharacter(gl, { ...C, ...o }); c.anims = C.anims; return c; }; }
    catch (e) { Q.errors.push(id + ' glb: ' + e.message); }
  }
  const player = new Player(scene, world, models, cfg, input, heroChar);
  // Скины героя: персонажи из манифеста с флагом skin; грузятся по требованию
  const skinChars = { hero: heroChar };
  game_skinLoad = async id => { if (skinChars[id]) return skinChars[id]; const C = man.characters?.[id]; if (!C) return null;
    const { loadCharacter, makeCharacter } = await import('./chars.js'); const c = makeCharacter(await loadCharacter(C.url), C); c.anims = C.anims; return (skinChars[id] = c); };
  UI.applyScale(); addEventListener('resize', () => UI.applyScale());
  const ui = new UI(cfg);
  const game = new Game({ scene, world, models, player, cfg, platform: Platform, ui, qa: QA });
  game.stats = { mined: 0, built: 0 };
  setLoad('Ресурсы…', 70);
  game.populate();
  ui.camera = camera; window.THREE_NS = THREE;
  // ---------- Календарь наград за вход: один шаг за новый календарный день (серверное время Яндекса, иначе — устройство) ----------
  const now = () => { try { return Platform.ysdk?.serverTime?.() || Date.now(); } catch { return Date.now(); } };
  const dayKey = () => { const d = new Date(now()); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  game.skins = {
    // скины всех уже забранных дней календаря — даже если день забран до появления скина (награда задним числом)
    owned: () => { const o = { hero: true, ...(game.state.skins || {}) }, n = game.state.daily?.claimed || 0; cfg.daily_calendar.slice(0, n).forEach(d => { if (d.skin && man.characters?.[d.skin]) o[d.skin] = true; }); return o; },
    cur: () => game.state.skin || 'hero',
    async wear(id) { if (!this.owned()[id]) return false; const c = await game_skinLoad(id); if (!c) return false; player.setChar(c); game.state.skin = id; game.save?.(); return true; },
  };
  if (game.state.skin && game.state.skin !== 'hero') game.skins.wear(game.state.skin).catch(e => Q.errors.push('skin: ' + e.message));
  game.daily = {
    st: () => (game.state.daily ??= { claimed: 0, last: '' }),
    canClaim() { const s = this.st(); return s.claimed < cfg.daily_calendar.length && s.last !== dayKey(); },
    claim() { if (!this.canClaim()) return false; const s = this.st(), d = cfg.daily_calendar[s.claimed];
      for (const [k, v] of Object.entries(d.items || {})) { const it = cfg.items[k]; if (it?.bp) { const [gid] = it.bp.split(':'); if (game.cfg.gear[gid]) game.explore.learn(k); else { game.state.bps[gid] = 1; ui.toast(`Новый ${it.name.toLowerCase()}`, 'rar-epic'); } } else game.state.inv[k] = (game.state.inv[k] || 0) + v; }
      if (d.skin) (game.state.skins ??= {})[d.skin] = true;
      s.claimed++; s.last = dayKey(); game.qa.event('daily', { day: s.claimed }); ui.toast(`${d.title} — получено!`, d.big ? 'rar-epic' : ''); game.save(); return true; },
    dev() { const s = this.st(); s.last = ''; this.claim(); },
  };
  // 3D-превью награды: отдельный маленький рендерер, модель крутится
  game.previewModel = (canvas, id) => {
    const r = (game._pvr ||= new THREE.WebGLRenderer({ antialias: true, alpha: true })); r.setSize(360, 220, false);
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 360 / 220, 0.1, 100);
    sc.add(new THREE.HemisphereLight('#fff4e0', '#5a3020', 2.2)); const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.position.set(3, 5, 4); sc.add(sun);
    const sk = id.startsWith?.('skin_') ? id : null; if (sk && !game._skinPv?.[sk]) { (game._skinPv ||= {})[sk] = 'loading'; game_skinLoad(sk).then(c => { game._skinPv[sk] = c; if (canvas.isConnected) game.previewModel(canvas, id); }); return; } if (game._skinPv?.[sk] === 'loading') return;
    const src = sk ? skClone(game._skinPv[sk].root) : id === 'skin' ? player.model : models.instance(id === 'drone' ? 'oxygen_gen' : id); const o = id === 'skin' ? src.clone(true) : src;
    const box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()); o.position.sub(c); const g0 = new THREE.Group(); g0.add(o); sc.add(g0);
    const R = size.length() / 2, D = R / Math.sin(THREE.MathUtils.degToRad(15)) * 0.8; cam.position.set(D * 0.55, D * 0.38, D * 0.74); cam.lookAt(0, 0, 0);
    if (id === 'skin' && !sk) o.traverse(m => { if (m.isMesh && m.material?.color && m.name !== 'outline') { m.material = m.material.clone(); m.material.color.lerp(new THREE.Color('#5cd6a8'), 0.55); } });
    const ctx = canvas.getContext('2d'); let t0 = performance.now();
    const tick = () => { if (!canvas.isConnected || document.getElementById('dprev')?.style.display === 'none') return; g0.rotation.y = (performance.now() - t0) / 1400; r.render(sc, cam); ctx.clearRect(0, 0, 360, 220); ctx.drawImage(r.domElement, 0, 0); requestAnimationFrame(tick); };
    tick();
  };
  // При входе в новый день — сразу подсветить, что есть награда
  setTimeout(() => { if (game.daily.canClaim()) { ui.toast(`${'🎁'} Награда за вход ждёт — K`, 'rar-epic'); ui.buttons.daily?.classList.add('pulseb'); } }, 4000);
  const { Audio } = await import('./audio.js'); const sfx = new Audio(ui.settings); game.sfx = ui.sfx = sfx; window.__sfx = sfx;
  // События игры → звуки
  QA.listeners.push((n, d) => { const S = { loot: 'loot_open', craft: 'craft', build: 'build', house: 'build', goal: 'goal', stage: 'stage', meteor_spawn: 'meteor_whoosh', storm_warn: 'storm_warn', learn: 'rare', gear: 'craft', gate_open: 'stage', cave_open: 'stage', death: 'death', lamp: 'build', pet: 'pickup', egg_ready: 'rare', evolve: 'stage', meteor_open: 'loot_open', item: 'tank' }[n]; if (S) sfx.play(S); if (n === 'meteor') sfx.play('meteor_impact', { k: 1 }); });
  ui.bind(game);
  game.applySuit();
  // Позиция после сейва — у купола
  const sz = game.safeZone;
  const SP = game.state.pos;
  if (SP && isFinite(SP.x) && isFinite(SP.z)) { player.pos.set(SP.x, game.groundY(SP.x, SP.z) + 0.05, SP.z); if (isFinite(SP.yaw)) player.yaw = SP.yaw; }   // где вышел — там и продолжаешь
  else if (game.state.playtime > 0 && sz) player.pos.set(sz.x, game.groundY(sz.x, sz.z + 5), sz.z + 5);
  try { game.explore.restoreMeteors(game.state.meteors); } catch (e) { Q.errors.push('meteors: ' + e.message); }
  player.resetFall(3);
  world.applyTerraform(game.ti(), game.state.stats, 10, player.pos);
  setLoad('Готово', 100);
  document.getElementById('loading').style.display = 'none';
  Platform.ready(); Platform.gameplayStart();

  // Оффлайн-прогресс
  const off = game.offline();
  if (off) {
    const txt = Object.entries(off.gain).filter(([, v]) => v > 0.05).map(([k, v]) => `${cfg.terraform.stats[k].icon} +${v.toFixed(1)}`).join('  ');
    const lt = off.life ? `<br>Род подрос: 🐾 +${Math.max(0, off.life.pop).toFixed(0)}, Bi +${off.life.bi.toFixed(0)}` + (game.life.hungry() ? '<br><b style="color:#ff8a8a">Кормушки пусты — род голодает!</b>' : '') : '';
    ui.dialog(`<h2>Пока тебя не было ${Math.round(off.away / 60)} мин</h2><p>Машины работали: ${txt}${lt}</p>`, [['offx2', '📺 x2', 'ad'], ['offok', 'Забрать', 'ok']])
      .then(id => id === 'offx2' && game.offlineX2(off.gain, off.life));
  }

  // Цикл
  const clock = new THREE.Clock();
  let focused = document.hasFocus() || !!new URLSearchParams(location.search).has('qa');   // в автотестах окно без фокуса
  addEventListener('blur', () => { if (!new URLSearchParams(location.search).has('qa')) { focused = false; for (const k in input.keys) input.keys[k] = false; } });
  addEventListener('focus', () => { focused = true; clock.getDelta(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) clock.getDelta(); });
  let frames = 0, fpsT = performance.now();
  const shadowFollow = new THREE.Vector3();
  function frame() {
    requestAnimationFrame(frame);
    // Время симуляции = реальное (до 0.25 с за кадр), шаги по 1/30 — на слабом устройстве игра не «замедляется»
    const real = Math.min(0.25, clock.getDelta());
    const steps = Math.max(1, Math.ceil(real / 0.034)), dt = real / steps;
    // Пауза: вкладка скрыта / окно без фокуса / открыты настройки — мир стоит (O₂, бури, метеориты, крафт, Род)
    const hold = document.hidden || !focused || ui.panel === 'settings';
    if (hold !== Q.paused) { Q.paused = hold; ui.pauseVeil?.(hold && ui.panel !== 'settings'); sfx.ctx && (hold ? sfx.ctx.suspend() : sfx.ctx.resume()); if (hold) game.save(); }
    if (hold) { renderer.render(scene, camera); ui.update(); return; }
    for (let i = 0; i < steps; i++) {
      if (game.driving && !game.paused && !game.dead && !ui.panel) game.preDrive(dt);   // сначала едет машина, потом герой и камера — без отставания
      if (!game.paused && !game.dead && !ui.panel) player.update(dt, camera);
      else player.update(game.dead && player.dying ? dt : 0, camera, game.dead);
      game.update(dt);
    }
    // Тень следует за игроком
    shadowFollow.copy(player.pos);
    world.sun.position.set(shadowFollow.x + 40, shadowFollow.y + 80, shadowFollow.z + 30);
    world.sun.target.position.copy(shadowFollow);
    world.sky.position.copy(camera.position);
    if (ui.shakeAmt > 0) { camera.position.x += (Math.random() - 0.5) * ui.shakeAmt; camera.position.y += (Math.random() - 0.5) * ui.shakeAmt; ui.shakeAmt *= 0.9; if (ui.shakeAmt < 0.01) ui.shakeAmt = 0; }
    renderer.render(scene, camera);
    ui.update();
    frames++;
    const now = performance.now();
    if (now - fpsT > 1000) { Q.fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; document.getElementById('fps').textContent = Q.fps + ' fps'; }
  }
  frame();
  // Одна активная вкладка: новая вкладка забирает сейв, старая перестаёт сохранять (иначе она затирала новые постройки)
  { const ownKey = game.saveKey() + ':owner', me = Math.random().toString(36).slice(2);
    localStorage.setItem(ownKey, me);
    addEventListener('storage', e => { if (e.key === ownKey && e.newValue !== me && !game.staleTab) { game.staleTab = true; game.paused = true; ui.staleVeil?.(); } }); }
  addEventListener('beforeunload', () => game.save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });

  // ---------- QA/дев API ----------
  Object.assign(Q, {
    ready: true, state: 'playing',
    game, world, player, camera, renderer, input,
    snapshot: () => ({ life: { started: game.life.L.started, stage: game.life.L.stage, pop: +game.life.L.pop.toFixed(1), cap: game.life.cap(), bi: +game.life.L.bi.toFixed(1), dna: game.life.L.dna, crystals: game.life.L.crystals, food: +game.life.L.food.toFixed(1), egg: game.life.L.egg, traits: game.life.L.traits, creatures: game.life.creatures.length, village: game.life.L.villageLv, quests: game.life.L.quests }, pos: player.pos.toArray().map(v => +v.toFixed(1)), ti: +game.ti().toFixed(1), stage: game.stage(), stats: { ...game.state.stats }, o2: +game.state.o2.toFixed(1), hp: +game.state.hp.toFixed(1), inv: { ...game.state.inv }, buildings: game.state.buildings.length, water: +world.waterLevel.toFixed(2), flora: +world.flora.toFixed(2), gates: world.gateObjects.map(g => ({ id: g.zone.id, open: g.open })), mined: game.stats.mined, built: game.stats.built, target: game.target?.res || null, panel: ui.panel, fps: Q.fps }),
    setTi(ti) { const s = game.state.stats; const k = ti / 4; s.heat = k * 1.2; s.pressure = k; s.oxygen = k; s.biomass = k * 0.8; },
    // Снять крупный план точки: камера на расстоянии dist под углом yaw, высота h
    frame(x, z, { yaw = 0, dist = 4, h = 1.6, ty = 0.4 } = {}) {
      if (x == null) { player.camOverride = null; return; }
      const gy = world.heightAt(x, z), wy = Math.max(gy, world.waterAt(x, z));
      const cx = x + Math.sin(yaw) * dist, cz = z + Math.cos(yaw) * dist;
      player.camOverride = { pos: new THREE.Vector3(cx, Math.max(world.heightAt(cx, cz) + 0.5, wy + h), cz), target: new THREE.Vector3(x, wy + ty, z) };
    },
    teleport(x, z) { player.pos.set(x, game.groundY ? game.groundY(x, z) : world.heightAt(x, z), z); player.resetFall(); },
    look(yaw, pitch, dist) { player.yaw = yaw; if (pitch != null) player.pitch = pitch; if (dist) player.dist = dist; },
    nodes: () => game.nodes.filter(n => n.ctl.items[n.i].visible).map(n => ({ res: n.res, x: +n.x.toFixed(1), z: +n.z.toFixed(1) })),
    give(items) { for (const [k, v] of Object.entries(items)) game.state.inv[k] = (game.state.inv[k] || 0) + v; },
    buttons: () => [...document.querySelectorAll('button')].filter(b => b.offsetParent && b.id).map(b => { const r = b.getBoundingClientRect(); return { id: b.id.replace(/^b_/, ''), x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: b.disabled }; }),
  });
  window.dev = Q;
}
boot().catch(e => { Q.errors.push('boot: ' + (e.stack || e.message)); document.getElementById('loadtxt').textContent = 'Ошибка: ' + e.message; });
