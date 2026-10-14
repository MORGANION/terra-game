// ===== AI Game Factory runtime =====
// Общий рантайм всех игр завода. Агенты его НЕ пишут, а пользуются API:
//   Meta (кошелёк, улучшения, инапы, ревардед, ежедневка), Flow (забег), UI (кнопки/панели), Platform (реклама/покупки), Save, QA.
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const QA_MODE = params.has('qa');

  // ---------- QA-хуки ----------
  const Q = (window.__qa = { ready: false, state: 'boot', score: 0, errors: [], events: [], runs: [], platform: [], buttons: [] });
  const shortFile = f => String(f || '').split('/').pop().split('?')[0];
  window.addEventListener('error', e => Q.errors.push(`${e.message} @ ${shortFile(e.filename)}:${e.lineno}`));
  window.addEventListener('unhandledrejection', e => Q.errors.push('promise: ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)));
  const QA = {
    set(o) { Object.assign(Q, o); },
    event(name, data) { Q.events.push({ name, data, t: Date.now() }); if (Q.events.length > 300) Q.events.shift(); },
  };

  // ---------- Save ----------
  const Save = {
    key: 'gf:game', data: {},
    load(slug) { this.key = 'gf:' + slug; try { this.data = JSON.parse(localStorage.getItem(this.key)) || {}; } catch { this.data = {}; } },
    flush() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch {} Platform.saveRemote && Platform.saveRemote(this.data); },
    get(k, d) { return k in this.data ? this.data[k] : d; },
    set(k, v) { this.data[k] = v; this.flush(); },
    reset() { this.data = {}; localStorage.removeItem(this.key); },
  };

  // ---------- Platform: mock (по умолчанию) и Яндекс Игры (?platform=yandex) ----------
  function overlay(html, buttons, autoMs) {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;inset:0;z-index:99;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;font:600 18px/1.4 system-ui,sans-serif;color:#fff';
      el.innerHTML = `<div style="background:#22252c;border-radius:16px;padding:22px 26px;max-width:80%;text-align:center">${html}<div id="ob" style="margin-top:16px;display:flex;gap:10px;justify-content:center"></div></div>`;
      const done = v => { el.remove(); window.__game && window.__game.resume && window.__game.resume(); resolve(v); };
      for (const [label, val, color] of buttons) {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = `font:inherit;border:0;border-radius:10px;padding:10px 16px;color:#fff;background:${color || '#3d7cf0'};cursor:pointer`;
        b.onclick = () => done(val);
        el.querySelector('#ob').appendChild(b);
      }
      document.body.appendChild(el);
      window.__game && window.__game.pause && window.__game.pause();
      if (autoMs) setTimeout(() => el.isConnected && done(true), autoMs);
    });
  }

  const MockPlatform = {
    name: 'mock',
    async init() {},
    ready() {},
    gameplayStart() {}, gameplayStop() {},
    async showRewarded(placement) {
      if (QA_MODE) return true;
      // Имитация ролика: 3 с, потом можно забрать награду; закрыть раньше — без награды
      const p = overlay(`📺 Тестовая ревардед-реклама<br><small>${placement}</small><div id="gf-cd" style="font-size:42px;margin-top:8px">3</div>`,
        [['Закрыть (без награды)', false, '#555'], ['Получить награду', true, '#2fa84f']]);
      const btn = [...document.querySelectorAll('#ob button')].pop();
      btn.disabled = true; btn.style.opacity = 0.4;
      let left = 3;
      const t = setInterval(() => {
        const cd = document.getElementById('gf-cd');
        if (!cd) return clearInterval(t);
        cd.textContent = --left;
        if (left <= 0) { clearInterval(t); cd.textContent = '✓'; btn.disabled = false; btn.style.opacity = 1; }
      }, 1000);
      return p;
    },
    async showInterstitial() { if (QA_MODE) return; await overlay('📺 Тестовая межстраничная реклама', [], 1500); },
    async purchase(id, p) {
      if (QA_MODE) return true;
      return overlay(`🛒 Тестовая покупка<br><b>${p.title}</b><br>${p.price || ''}`, [['Купить', true, '#2fa84f'], ['Отмена', false, '#555']]);
    },
  };

  // Адаптер Яндекс Игр (SDK v2). На площадке не проверялся: перед релизом прогнать в черновике Яндекса.
  const YandexPlatform = {
    name: 'yandex', ysdk: null, payments: null,
    async init() {
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/sdk.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      this.ysdk = await window.YaGames.init();
      try { this.payments = await this.ysdk.getPayments({ signed: false }); } catch { this.payments = null; }
    },
    ready() { try { this.ysdk.features.LoadingAPI && this.ysdk.features.LoadingAPI.ready(); } catch {} },
    gameplayStart() { try { this.ysdk.features.GameplayAPI && this.ysdk.features.GameplayAPI.start(); } catch {} },
    gameplayStop() { try { this.ysdk.features.GameplayAPI && this.ysdk.features.GameplayAPI.stop(); } catch {} },
    showRewarded() {
      return new Promise(resolve => {
        let rewarded = false;
        this.ysdk.adv.showRewardedVideo({ callbacks: { onRewarded: () => (rewarded = true), onClose: () => resolve(rewarded), onError: () => resolve(false) } });
      });
    },
    showInterstitial() { return new Promise(resolve => this.ysdk.adv.showFullscreenAdv({ callbacks: { onClose: () => resolve(), onError: () => resolve() } })); },
    async purchase(id, p) {
      if (!this.payments) return false;
      try {
        const pur = await this.payments.purchase({ id });
        if (!p.once && pur && pur.purchaseToken) await this.payments.consumePurchase(pur.purchaseToken);
        return true;
      } catch { return false; }
    },
  };

  const Platform = params.get('platform') === 'yandex' ? YandexPlatform : MockPlatform;

  // ---------- Meta: экономика из economy.json ----------
  let ECO = null, CFG = null;
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { Q.errors.push('Meta.on: ' + e.message); } });
  const today = () => new Date().toISOString().slice(0, 10);

  const Meta = {
    init(eco, cfg) {
      ECO = eco; CFG = cfg;
      ECO.upgrades = ECO.upgrades || []; ECO.iap = ECO.iap || []; ECO.gem_shop = ECO.gem_shop || []; ECO.rewarded = ECO.rewarded || {}; ECO.stats = ECO.stats || {};
      if (!Save.get('init')) {
        for (const [k, c] of Object.entries(ECO.currencies)) Save.data['cur_' + k] = c.start || 0;
        Object.assign(Save.data, { init: 1, up: {}, flags: {}, progress: { level: 1, best: 0, runs: 0 } });
        Save.flush();
      }
      Save.data.up = Save.data.up || {}; Save.data.flags = Save.data.flags || {}; Save.data.progress = Save.data.progress || { level: 1, best: 0, runs: 0 };
    },
    economy() { return ECO; },
    currencies() { return Object.entries(ECO.currencies).map(([key, c]) => ({ key, ...c, amount: Meta.get(key) })); },
    get(cur) { return Save.data['cur_' + cur] || 0; },
    add(cur, n, reason) {
      if (!n) return;
      Save.data['cur_' + cur] = Math.max(0, Math.round(Meta.get(cur) + n));
      Save.flush(); QA.event('currency', { cur, n, reason }); emit();
    },
    canAfford(cost) { return Object.entries(cost || {}).every(([c, v]) => Meta.get(c) >= v); },
    spend(cost, reason) {
      if (!Meta.canAfford(cost)) return false;
      for (const [c, v] of Object.entries(cost)) Save.data['cur_' + c] -= v;
      Save.flush(); QA.event('spend', { cost, reason }); emit();
      return true;
    },
    grant(g, reason) {
      for (const [k, v] of Object.entries(g || {})) {
        if (k === 'flags') (v || []).forEach(f => (Save.data.flags[f] = true));
        else if (ECO.currencies[k]) Meta.add(k, v, reason);
      }
      Save.flush(); emit();
    },
    has(flag) { return !!Save.data.flags[flag]; },

    // Улучшения: стоимость = base_cost * cost_growth^level, эффект = stats[stat].base + per_level * level
    level(id) { return Save.data.up[id] || 0; },
    upgrade(id) {
      const u = ECO.upgrades.find(x => x.id === id);
      if (!u) return null;
      const level = Meta.level(id), max = u.max_level || 10;
      const cur = u.currency || 'coins';
      const cost = level >= max ? null : { [cur]: Math.round(u.base_cost * Math.pow(u.cost_growth || 1.5, level)) };
      const value = Meta.stat(u.stat);
      return { ...u, level, max, cost, price: cost ? cost[cur] : null, currency: cur, value, next: level >= max ? null : Math.round((value + u.per_level) * 1000) / 1000, affordable: !!cost && Meta.canAfford(cost), maxed: level >= max };
    },
    upgrades() { return ECO.upgrades.map(u => Meta.upgrade(u.id)); },
    buyUpgrade(id) {
      const u = Meta.upgrade(id);
      if (!u || !u.cost || !Meta.spend(u.cost, 'upgrade:' + id)) return false;
      Save.data.up[id] = u.level + 1; Save.flush();
      QA.event('upgrade', { id, level: u.level + 1 }); emit();
      return true;
    },
    stat(key) {
      const s = ECO.stats[key] || (CFG.stats && CFG.stats[key]);
      let v = s ? Number(s.base) : 0;
      for (const u of ECO.upgrades) if (u.stat === key) v += (u.per_level || 0) * Meta.level(u.id);
      return Math.round(v * 1000) / 1000;
    },
    progress() { return Save.data.progress; },

    // Инапы
    products() { return ECO.iap.map(p => ({ ...p, owned: !!(p.once && Meta.has('bought_' + p.id)) })); },
    async buy(productId) {
      const p = ECO.iap.find(x => x.id === productId);
      if (!p || (p.once && Meta.has('bought_' + p.id))) return false;
      const ok = await Platform.purchase(p.id, p);
      Q.platform.push({ type: 'purchase', id: p.id, ok });
      if (ok) { Meta.grant(p.grant, 'iap:' + p.id); if (p.once) Save.data.flags['bought_' + p.id] = true; Save.flush(); emit(); }
      return ok;
    },
    // Обмен кристаллов на монеты/бусты
    gemShop() { return ECO.gem_shop.map(x => ({ ...x, affordable: Meta.canAfford(x.cost) })); },
    exchange(id) {
      const x = ECO.gem_shop.find(i => i.id === id);
      if (!x || !Meta.spend(x.cost, 'gemshop:' + id)) return false;
      Meta.grant(x.grant, 'gemshop:' + id);
      return true;
    },

    // Ревардед-реклама
    rewardedReady(p) {
      const r = ECO.rewarded[p];
      if (!r || !r.cooldown_sec) return true;
      return Date.now() - (Save.data['cd_' + p] || 0) > r.cooldown_sec * 1000;
    },
    rewardedInfo(p) { const r = ECO.rewarded[p] || {}; return { ...r, ready: Meta.rewardedReady(p) }; },
    async rewarded(placement) {
      if (!Meta.rewardedReady(placement)) return false;
      const r = ECO.rewarded[placement] || {};
      const ok = await Platform.showRewarded(placement);
      Q.platform.push({ type: 'rewarded', placement, ok });
      if (ok) {
        if (r.grant) Meta.grant(r.grant, 'rewarded:' + placement);
        if (r.cooldown_sec) { Save.data['cd_' + placement] = Date.now(); Save.flush(); }
      }
      emit();
      return ok;
    },

    // Ежедневная награда
    daily() { return { available: Save.data.daily_last !== today(), grant: ECO.daily || { coins: 50 } }; },
    claimDaily() {
      if (!Meta.daily().available) return false;
      Save.data.daily_last = today(); Meta.grant(ECO.daily || { coins: 50 }, 'daily');
      return true;
    },

    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    cheat() { for (const k of Object.keys(ECO.currencies)) Meta.add(k, 1e6, 'cheat'); },
    reset() { Save.reset(); location.reload(); },
  };

  // ---------- Flow: забег ----------
  const Flow = {
    current: null, last: null,
    startRun(scene, data = {}) {
      const p = Meta.progress();
      Flow.current = { id: p.runs + 1, level: p.level, revived: false, t0: Date.now(), ...data };
      Platform.gameplayStart();
      QA.set({ state: 'playing', score: 0 });
      scene.scene.start('Core', Flow.current);
    },
    canRevive() { return !!Flow.current && !Flow.current.revived && !!ECO.rewarded.revive; },
    async revive() {
      if (!Flow.canRevive()) return false;
      const ok = await Meta.rewarded('revive');
      if (ok) Flow.current.revived = true;
      return ok;
    },
    async endRun(scene, res = {}) {
      if (!Flow.current) return; // защита от двойного вызова
      const run = Flow.current; Flow.current = null;
      const rr = ECO.run_reward || {};
      const score = Math.max(0, Math.round(res.score || 0));
      const coins = Math.max(rr.coins_min || 0, Math.floor(score * (rr.coins_per_score || 0))) + (res.win ? rr.win_bonus || 0 : 0) + Math.round(res.coins || 0);
      const p = Meta.progress();
      p.runs++;
      const newBest = score > p.best;
      if (newBest) p.best = score;
      if (res.win) p.level++;
      Save.flush();
      Meta.add('coins', coins, 'run');
      const result = { ...res, score, win: !!res.win, level: run.level, reward: { coins }, best: p.best, newBest, doubled: false, seconds: Math.round((Date.now() - run.t0) / 1000) };
      Flow.last = result;
      Q.runs.push(result);
      QA.set({ state: 'results', score });
      Platform.gameplayStop();
      const every = ECO.interstitial_every_runs || 0;
      if (every && !Meta.has('no_ads') && p.runs % every === 0) await Platform.showInterstitial();
      scene.scene.start('Results', result);
    },
    async doubleReward(result) {
      result = result || Flow.last;
      if (!result || result.doubled) return false;
      const mult = (ECO.rewarded.double_reward && ECO.rewarded.double_reward.mult) || 2;
      const ok = await Meta.rewarded('double_reward');
      if (ok) {
        const extra = result.reward.coins * (mult - 1);
        Meta.add('coins', extra, 'double');
        result.doubled = true; result.reward.coins += extra;
      }
      return ok;
    },
    goHub(scene) { QA.set({ state: 'hub' }); scene.scene.start('Hub'); },
  };

  // ---------- UI-кит (общий стиль всех игр) ----------
  const UI = {
    theme: null,
    c(k) {
      const v = (UI.theme.colors && UI.theme.colors[k]) || k;
      if (typeof v === 'number') return v;
      try { return Phaser.Display.Color.HexStringToColor(v).color; } catch { return 0xffffff; }
    },
    css(k) { return (UI.theme.colors && UI.theme.colors[k]) || k; },
    text(scene, x, y, str, o = {}) {
      const size = o.size || 36;
      const t = scene.add.text(x, y, String(str), {
        fontFamily: UI.theme.font || 'Arial Black, Arial, sans-serif',
        fontSize: size + 'px',
        color: UI.css(o.color || 'text'),
        align: o.align || 'center',
        fontStyle: o.bold === false ? 'normal' : 'bold',
        stroke: o.stroke === false ? undefined : UI.css(o.strokeColor || 'outline'),
        strokeThickness: o.stroke === false ? 0 : (o.strokeThickness != null ? o.strokeThickness : Math.max(2, Math.round(size / 7))),
        wordWrap: o.wrap ? { width: o.wrap } : undefined,
      });
      t.setOrigin(o.ox != null ? o.ox : 0.5, o.oy != null ? o.oy : 0.5);
      return t;
    },
    panel(scene, x, y, w, h, o = {}) {
      const r = o.radius != null ? o.radius : 28;
      const g = scene.add.graphics({ x, y });
      g.fillStyle(0x000000, 0.28).fillRoundedRect(-w / 2 + 4, -h / 2 + 10, w, h, r);
      g.fillStyle(UI.c(o.color || 'secondary'), o.alpha != null ? o.alpha : 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.lineStyle(o.line != null ? o.line : 4, UI.c(o.lineColor || 'outline'), 1).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
      return g;
    },
    // Кнопка. id обязателен для кнопок меты: по нему ходит бот-тестер.
    button(scene, o) {
      const x = o.x, y = o.y, w = o.w || 360, h = o.h || 100;
      const c = scene.add.container(x, y);
      const bg = scene.add.graphics();
      const draw = dis => {
        const col = dis ? 0x7a7a7a : UI.c(o.color || 'primary');
        const r = Math.min(h / 3, 36);
        bg.clear();
        bg.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, r);
        bg.fillStyle(col, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
        bg.fillStyle(0xffffff, 0.2).fillRoundedRect(-w / 2 + 8, -h / 2 + 6, w - 16, h * 0.36, r * 0.7);
        bg.lineStyle(4, UI.c('outline'), 1).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
      };
      draw(o.disabled);
      c.add(bg);
      let tx = 0;
      if (o.icon && scene.textures.exists(o.icon)) {
        const s = Math.min(h * 0.68, 76);
        const im = scene.add.image(o.label != null ? -w / 2 + h * 0.55 : 0, 0, o.icon);
        im.setScale(s / Math.max(im.width, im.height));
        c.add(im);
        if (o.label != null) tx = h * 0.28;
      }
      const lbl = o.label != null ? UI.text(scene, tx, 0, o.label, { size: o.size || Math.round(h * 0.34), color: o.textColor || 'text', wrap: w - (tx ? h : 24) }) : null;
      if (lbl) c.add(lbl);
      const hit = scene.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
      c.add(hit);
      c.id = o.id; c.disabled = !!o.disabled; c.label = lbl;
      hit.on('pointerdown', (pointer, lx, ly, event) => {
        if (event && event.stopPropagation) event.stopPropagation();
        if (c.disabled) { scene.tweens.add({ targets: c, x: x + 8, duration: 45, yoyo: true, repeat: 2, onComplete: () => c.setX(x) }); return; }
        scene.tweens.add({ targets: c, scale: 0.92, duration: 70, yoyo: true });
        QA.event('click', o.id);
        if (o.onClick) o.onClick(c);
      });
      c.setLabel = t => { if (lbl) lbl.setText(t); return c; };
      c.setDisabled = d => { c.disabled = !!d; draw(c.disabled); return c; };
      if (o.id) {
        const entry = { id: o.id, obj: c, scene };
        Q.buttons.push(entry);
        c.once('destroy', () => { const i = Q.buttons.indexOf(entry); if (i >= 0) Q.buttons.splice(i, 1); });
      }
      return c;
    },
    // Плашка валют, обновляется сама
    currencyBar(scene, x = 360, y = 48) {
      const c = scene.add.container(x, y);
      const items = Meta.currencies();
      const slotW = 230, total = items.length * slotW;
      const texts = {};
      items.forEach((cur, i) => {
        const cx = -total / 2 + slotW * i + slotW / 2;
        const g = scene.add.graphics();
        g.fillStyle(0x000000, 0.35).fillRoundedRect(cx - slotW / 2 + 10, -28, slotW - 20, 56, 28);
        c.add(g);
        if (cur.icon && scene.textures.exists(cur.icon)) { const im = scene.add.image(cx - slotW / 2 + 40, 0, cur.icon); im.setScale(52 / Math.max(im.width, im.height)); c.add(im); }
        const t = UI.text(scene, cx + 14, 0, UI.fmt(cur.amount), { size: 30 });
        texts[cur.key] = t; c.add(t);
      });
      const off = Meta.on(() => { for (const k in texts) if (texts[k].active) texts[k].setText(UI.fmt(Meta.get(k))); });
      scene.events.once('shutdown', off);
      c.texts = texts;
      return c;
    },
    fmt(n) { n = Math.round(n); return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : String(n); },
    toast(scene, msg, color) {
      const t = UI.text(scene, scene.scale.width / 2, scene.scale.height * 0.18, msg, { size: 34, color: color || 'accent' }).setDepth(1000);
      scene.tweens.add({ targets: t, y: t.y - 60, alpha: 0, delay: 700, duration: 700, onComplete: () => t.destroy() });
      return t;
    },
    // Летящие иконки валюты (сочность наград)
    fly(scene, icon, fromX, fromY, toX, toY, n = 8) {
      if (!scene.textures.exists(icon)) return;
      for (let i = 0; i < n; i++) {
        const im = scene.add.image(fromX + Phaser.Math.Between(-40, 40), fromY + Phaser.Math.Between(-40, 40), icon).setDepth(999);
        im.setScale(44 / Math.max(im.width, im.height));
        scene.tweens.add({ targets: im, x: toX, y: toY, scale: im.scale * 0.6, delay: i * 50, duration: 550, ease: 'Cubic.easeIn', onComplete: () => im.destroy() });
      }
    },
  };

  // ---------- Загрузка ----------
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src + '?v=' + Date.now(); s.onload = res; s.onerror = () => rej(new Error('не загрузился ' + src)); document.body.appendChild(s); });
  }

  class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }
    preload() {
      const cfg = this.registry.get('cfg');
      const w = this.scale.width, h = this.scale.height;
      const bar = this.add.rectangle(w / 2 - 200, h / 2, 4, 24, UI.c('accent')).setOrigin(0, 0.5);
      this.load.on('progress', p => bar.setSize(400 * p, 24));
      const v = Date.now();
      for (const a of cfg.assets) this.load.svg(a.key, `assets/${a.key}.svg?v=${v}`, { width: a.w, height: a.h });
    }
    create() {
      Platform.ready();
      Q.ready = true;
      Flow.goHub(this);
    }
  }

  async function boot() {
    try {
      const get = f => fetch(f, { cache: 'no-store' }).then(r => r.json());
      const [cfg, theme, eco] = await Promise.all([get('config.json'), get('theme.json'), get('economy.json')]);
      Save.load(cfg.slug || 'game');
      UI.theme = theme;
      Meta.init(eco, cfg);
      try { await Platform.init(); } catch (e) { Q.errors.push('platform init: ' + e.message); }
      await loadScript('meta.js');
      await loadScript('core.js');
      if (!window.CoreScene) throw new Error('core.js не определил window.CoreScene');
      if (!Array.isArray(window.MetaScenes)) throw new Error('meta.js не определил window.MetaScenes');
      const W = cfg.width || 720, H = cfg.height || 1280;
      const game = new Phaser.Game({
        type: Phaser.AUTO, parent: 'game', width: W, height: H,
        backgroundColor: theme.colors.background,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
        scene: [BootScene, ...window.MetaScenes, window.CoreScene],
        callbacks: {
          preBoot: g => {
            g.registry.set('cfg', cfg);
            g.registry.set('tun', Object.fromEntries(Object.entries(cfg.tunables || {}).map(([k, v]) => [k, v.value])));
            g.registry.set('text', cfg.texts || {});
            g.registry.set('theme', theme);
          },
        },
      });
      window.__game = game;
    } catch (e) {
      Q.errors.push('boot: ' + e.message);
      document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f66;padding:20px;white-space:pre-wrap">${e.message}</pre>`);
    }
  }

  // Для бота: видимые кнопки активных сцен с координатами в пикселях страницы
  Q.clickables = function () {
    const canvas = window.__game && window.__game.canvas;
    if (!canvas) return [];
    const r = canvas.getBoundingClientRect();
    const sx = r.width / window.__game.scale.width, sy = r.height / window.__game.scale.height;
    const out = [];
    for (const b of Q.buttons) {
      const o = b.obj;
      if (!o.active || !o.scene || !o.scene.sys.isActive() || !o.visible) continue;
      let vis = true;
      for (let p = o.parentContainer; p; p = p.parentContainer) if (!p.visible) vis = false;
      if (!vis) continue;
      const bd = o.getBounds();
      const cx = bd.centerX, cy = bd.centerY;
      if (cx < 0 || cy < 0 || cx > window.__game.scale.width || cy > window.__game.scale.height) continue;
      out.push({ id: b.id, scene: o.scene.sys.settings.key, disabled: !!o.disabled, x: r.left + cx * sx, y: r.top + cy * sy, label: o.label ? o.label.text : '' });
    }
    return out;
  };
  Q.scenes = () => (window.__game ? window.__game.scene.getScenes(true).map(s => s.sys.settings.key) : []);

  // Отладка/бот: завершить текущий забег из консоли
  Flow.debugEnd = (score = 100, win = true) => {
    const s = window.__game && window.__game.scene.getScene('Core');
    if (s && s.sys.isActive() && Flow.current) Flow.endRun(s, { score, win });
  };

  Object.assign(window, { QA, Save, Platform, Meta, Flow, UI, FactoryBoot: boot });
})();
