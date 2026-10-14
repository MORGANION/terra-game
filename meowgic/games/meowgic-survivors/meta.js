// Мета «Мяу-магия: Выживание»: хаб в башне кота-мага, улучшения, магазин, результаты.
// Контракт id кнопок (по ним ходит бот): hub: play, upgrades, store, daily | upgrades: up_<id>, back
// store: iap_<id>, gem_<id>, rw_free, back | results: double, continue
(function () {
  const T = s => s.registry.get('text');
  const A = s => s.registry.get('cfg').meta_art || {};
  const W = 720, H = 1280;

  const MAGIC = [0xff9a3c, 0x5ad1ff, 0xffd34d, 0xffffff];

  const col = k => {
    try { const v = UI.c(k); return (typeof v === 'number' && !isNaN(v)) ? v : 0xffffff; } catch (e) { return 0xffffff; }
  };
  // Подбор размера шрифта под ширину (в одну строку).
  const fit = (str, maxW, base, min) => {
    const n = Math.max(1, String(str == null ? '' : str).length);
    return Math.max(min || 16, Math.min(base, Math.floor(maxW / (n * 0.58))));
  };
  const fv = v => typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v == null ? '' : v);

  // ---------- общие визуальные помощники ----------
  function sparkKey(scene) {
    if (scene.textures.exists('spark')) return 'spark';
    if (!scene.textures.exists('__meta_dot')) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1).fillCircle(16, 16, 14);
      g.generateTexture('__meta_dot', 32, 32);
      g.destroy();
    }
    return '__meta_dot';
  }

  // Одна искра: появляется, летит, гаснет.
  function puff(scene, x, y, o) {
    o = o || {};
    const s = scene.add.image(x, y, sparkKey(scene));
    s.setDepth(o.depth == null ? -4 : o.depth);
    s.setTint(o.tint != null ? o.tint : MAGIC[Math.floor(Math.random() * MAGIC.length)]);
    s.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    const sc = o.scale || (0.3 + Math.random() * 0.4);
    const dur = o.dur || 1200;
    s.setScale(sc * 0.3);
    scene.tweens.add({ targets: s, x: x + (o.dx || 0), y: y + (o.dy || 0), duration: dur, ease: 'Sine.out' });
    scene.tweens.add({
      targets: s, alpha: o.alpha || 0.9, scale: sc, duration: dur / 2, yoyo: true, ease: 'Sine.inOut',
      onComplete: () => { if (s && s.active) s.destroy(); },
    });
    return s;
  }
  function burst(scene, x, y, n, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * (o.r || 90);
      puff(scene, x, y, {
        dx: Math.cos(a) * d, dy: Math.sin(a) * d, dur: 500 + Math.random() * 400,
        scale: 0.35 + Math.random() * 0.4, depth: o.depth == null ? 10 : o.depth, alpha: 1,
      });
    }
  }
  // Плавающие магические искры по всей сцене.
  function ambient(scene) {
    const spawn = () => puff(scene, 30 + Math.random() * 660, 280 + Math.random() * 760, {
      dx: (Math.random() - 0.5) * 60, dy: -(80 + Math.random() * 130),
      dur: 2600 + Math.random() * 2000, scale: 0.25 + Math.random() * 0.4, depth: -4,
    });
    for (let i = 0; i < 8; i++) spawn();
    scene.time.addEvent({ delay: 380, loop: true, callback: spawn });
  }
  function glow(scene, x, y, sx, sy, tint, a0, a1, depth, dur) {
    const g = scene.add.image(x, y, sparkKey(scene)).setScale(sx, sy).setTint(tint).setAlpha(a0)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
    scene.tweens.add({ targets: g, alpha: a1, duration: dur || 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    return g;
  }

  function background(scene, dim) {
    const art = A(scene);
    if (art.hub_bg && scene.textures.exists(art.hub_bg)) scene.add.image(W / 2, H / 2, art.hub_bg).setDisplaySize(W, H).setDepth(-10);
    else scene.cameras.main.setBackgroundColor(UI.css('background'));
    if (dim) scene.add.rectangle(W / 2, H / 2, W, H, 0x0b0620, dim).setDepth(-9);
  }
  function header(scene, title) {
    UI.currencyBar(scene, W / 2, 50);
    if (title) UI.text(scene, W / 2, 150, title, { size: 56, color: 'accent' });
  }
  function back(scene) {
    UI.button(scene, { id: 'back', x: W / 2, y: H - 72, w: 300, h: 88, label: T(scene).back || 'Назад', color: 'secondary', onClick: () => Flow.goHub(scene) });
  }

  // ======================= ХАБ =======================
  class Hub extends Phaser.Scene {
    constructor() { super('Hub'); }
    create() {
      const t = T(this), art = A(this);
      background(this);
      ambient(this);
      header(this);

      // --- название ---
      glow(this, W / 2, 185, 20, 6, 0xff9a3c, 0.2, 0.34, -6, 2200);
      const full = t.title || '';
      const parts = full.split(/:\s*/);
      let titleObjs;
      if (parts.length === 2 && parts[0] && parts[1]) {
        titleObjs = [
          UI.text(this, W / 2, 140, parts[0], { size: 64, color: 'accent', wrap: 640 }),
          UI.text(this, W / 2, 216, parts[1], { size: 74, color: 'accent', wrap: 640 }),
        ];
      } else {
        titleObjs = [UI.text(this, W / 2, 185, full, { size: 64, color: 'accent', wrap: 600 })];
      }
      this.tweens.add({ targets: titleObjs, y: '+=6', duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      // --- руны под героем ---
      const ring = this.add.container(W / 2, 706).setDepth(-5).setScale(1, 0.28);
      const rg = this.add.graphics();
      rg.fillStyle(0x5ad1ff, 0.1).fillCircle(0, 0, 150);
      rg.lineStyle(5, col('accent'), 0.85).strokeCircle(0, 0, 150);
      rg.lineStyle(3, 0x5ad1ff, 0.75).strokeCircle(0, 0, 122);
      rg.lineStyle(3, 0xff9a3c, 0.85);
      for (let k = 0; k < 2; k++) {
        const pts = [];
        for (let j = 0; j < 3; j++) {
          const a = Phaser.Math.DegToRad(-90 + k * 60 + j * 120);
          pts.push(Math.cos(a) * 118, Math.sin(a) * 118);
        }
        rg.strokeTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
      }
      rg.fillStyle(0xffd34d, 0.95);
      for (let j = 0; j < 8; j++) {
        const a = j * Math.PI / 4;
        rg.fillCircle(Math.cos(a) * 136, Math.sin(a) * 136, 5);
      }
      ring.add(rg);
      this.tweens.add({ targets: rg, angle: 360, duration: 16000, repeat: -1 });
      this.tweens.add({ targets: ring, alpha: { from: 0.55, to: 1 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      // --- герой ---
      const heroY = 560;
      glow(this, W / 2, heroY + 10, 11, 11, 0x5ad1ff, 0.22, 0.42, -4, 1800);
      if (art.hero && this.textures.exists(art.hero)) {
        const shadow = this.add.ellipse(W / 2, 716, 210, 34, 0x000000, 0.4).setDepth(-3);
        const hc = this.add.container(W / 2, heroY).setDepth(1);
        const hero = this.add.image(0, 0, art.hero);
        const base = Math.min(320 / hero.width, 320 / hero.height);
        hero.setScale(base);
        hc.add(hero);
        this.tweens.add({ targets: hc, y: heroY + 20, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.tweens.add({ targets: hero, scaleX: base * 0.985, scaleY: base * 1.03, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.tweens.add({ targets: hero, angle: { from: -2, to: 2 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.tweens.add({ targets: shadow, scaleX: 0.85, alpha: 0.26, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

        // Тап по коту — мяу и искры.
        let busy = false;
        const meows = ['Мяу!', 'Мурр~', 'Мяу-мяу!'];
        hero.setInteractive({ useHandCursor: true });
        hero.on('pointerdown', () => {
          if (busy) return;
          busy = true;
          this.tweens.add({ targets: hero, y: -34, duration: 140, yoyo: true, ease: 'Quad.out', onComplete: () => { busy = false; } });
          this.tweens.add({ targets: hc, scale: 1.07, duration: 140, yoyo: true });
          burst(this, W / 2, hc.y - 20, 12);
          const m = UI.text(this, W / 2, 440, meows[Math.floor(Math.random() * meows.length)], { size: 40, color: 'accent' });
          m.setDepth(20);
          this.tweens.add({ targets: m, y: 380, alpha: 0, duration: 900, onComplete: () => m.destroy() });
        });
      }

      // --- огненные шары по орбите вокруг героя ---
      const fk = this.textures.exists('fireball') ? 'fireball' : sparkKey(this);
      const isFire = fk === 'fireball';
      const orbs = [];
      for (let i = 0; i < 3; i++) {
        const o = this.add.image(W / 2, 650, fk);
        if (!isFire) o.setTint(0xff9a3c).setBlendMode(Phaser.BlendModes.ADD);
        orbs.push(o);
      }
      const st = { a: 0 };
      let tick = 0;
      this.tweens.add({
        targets: st, a: Math.PI * 2, duration: 7000, repeat: -1, ease: 'Linear',
        onUpdate: () => {
          orbs.forEach((o, i) => {
            const a = st.a + i * Math.PI * 2 / 3;
            const c = Math.cos(a), s = Math.sin(a);
            o.x = W / 2 + c * 200;
            o.y = 650 + s * 52;
            o.rotation = Math.atan2(c * 52, -s * 200);
            o.setDepth(s > 0 ? 2 : 0);
            o.setScale((isFire ? 0.85 : 1.3) * (0.78 + 0.22 * s));
            if (tick % 6 === i * 2) puff(this, o.x, o.y, { dx: 0, dy: -14, dur: 500, scale: 0.3, depth: s > 0 ? 1.5 : -1, tint: 0xffb347 });
          });
          tick++;
        },
      });

      // --- превью статов героя (из апгрейдов) ---
      const ups = Meta.upgrades();
      const chips = ups.slice(0, 5);
      if (chips.length) {
        UI.panel(this, W / 2, 805, 680, 104, { color: 'secondary', alpha: 0.85 });
        const cw = 660 / chips.length;
        chips.forEach((u, i) => {
          const cx = W / 2 - 330 + cw * (i + 0.5);
          const objs = [];
          if (u.icon && this.textures.exists(u.icon)) {
            const im = this.add.image(cx, 783, u.icon);
            im.setScale(52 / Math.max(im.width, im.height));
            this.tweens.add({ targets: im, y: 779, duration: 1000 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            objs.push(im);
          } else {
            objs.push(UI.text(this, cx, 783, String(u.name || '').split(' ')[0], { size: 18, wrap: cw - 8 }));
          }
          const vs = fv(u.value);
          objs.push(UI.text(this, cx, 830, vs, { size: fit(vs, cw - 10, 24, 16), color: 'accent' }));
          objs.forEach(p => {
            p.setAlpha(0);
            this.tweens.add({ targets: p, alpha: 1, duration: 350, delay: 150 + i * 90 });
          });
        });
      }

      // --- уровень и рекорд ---
      const p = Meta.progress();
      UI.text(this, W / 2, 886, `${t.level || 'Уровень'} ${p.level}   •   ${t.best || 'Рекорд'}: ${UI.fmt(p.best)}`, { size: 30 });

      // --- кнопки ---
      const play = UI.button(this, { id: 'play', x: W / 2, y: 980, w: 460, h: 130, label: t.play || 'Играть', color: 'primary', size: 54, onClick: () => Flow.startRun(this) });
      this.tweens.add({ targets: play, scale: 1.045, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      UI.button(this, { id: 'upgrades', x: 200, y: 1140, w: 300, h: 110, label: t.upgrades || 'Улучшения', color: 'secondary', icon: art.upgrades_icon, onClick: () => this.scene.start('Upgrades') });
      UI.button(this, { id: 'store', x: 520, y: 1140, w: 300, h: 110, label: t.store || 'Магазин', color: 'accent', icon: art.store_icon, onClick: () => this.scene.start('Store') });

      // Красный значок «!» если есть что прокачать.
      if (ups.some(u => u.affordable && !u.maxed)) {
        const bd = this.add.container(336, 1092).setDepth(6);
        const bg = this.add.graphics();
        bg.fillStyle(col('danger'), 1).fillCircle(0, 0, 16);
        bg.lineStyle(3, 0x1a0b2e, 1).strokeCircle(0, 0, 16);
        bd.add([bg, UI.text(this, 0, 0, '!', { size: 24 })]);
        this.tweens.add({ targets: bd, scale: 1.2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }

      // Подарок — справа под названием.
      const d = Meta.daily();
      if (d.available) {
        const gl = glow(this, 605, 330, 5, 3, 0xffd34d, 0.3, 0.6, -1, 700);
        const b = UI.button(this, {
          id: 'daily', x: 605, y: 330, w: 190, h: 88, label: t.daily || 'Подарок', color: 'danger', size: 26, icon: art.gift_icon,
          onClick: () => {
            if (Meta.claimDaily()) {
              UI.toast(this, '+' + Object.entries(d.grant).map(([k, v]) => v + ' ' + ((Meta.economy().currencies[k] || {}).name || k)).join(', '));
              burst(this, 605, 330, 14);
              gl.destroy();
              b.destroy();
            }
          },
        });
        this.tweens.add({ targets: b, angle: 6, duration: 160, yoyo: true, repeat: -1, repeatDelay: 1200 });
      }
      QA.set({ state: 'hub' });
    }
  }

  // ======================= УЛУЧШЕНИЯ =======================
  class Upgrades extends Phaser.Scene {
    constructor() { super('Upgrades'); }
    create() {
      const t = T(this);
      background(this, 0.45);
      header(this, t.upgrades || 'Улучшения');
      const list = Meta.upgrades();
      const top = 225, bottom = 1145;
      const rowH = Math.floor(Math.min(150, (bottom - top) / Math.max(1, list.length)));
      const compact = rowH < 125;
      list.forEach((u, i) => {
        const y = top + rowH * i + rowH / 2;
        UI.panel(this, W / 2, y, 660, rowH - 14, { color: 'secondary', alpha: 0.92 });
        if (u.icon && this.textures.exists(u.icon)) {
          const im = this.add.image(90, y, u.icon);
          im.setScale(Math.min(rowH - 40, 90) / Math.max(im.width, im.height));
        }
        const nm = compact ? `${u.name}  ${u.level}/${u.max}` : String(u.name);
        UI.text(this, 150, compact ? y - 18 : y - 34, nm, { size: fit(nm, 340, compact ? 26 : 30, 18), ox: 0 });
        const vs = u.maxed ? fv(u.value) : `${fv(u.value)} → ${fv(u.next)}`;
        UI.text(this, 150, compact ? y + 16 : y + 2, vs, { size: fit(vs, 340, 24, 16), ox: 0, color: 'accent' });
        if (!compact) {
          const frac = u.max > 0 ? Math.max(0, Math.min(1, u.level / u.max)) : 0;
          this.add.rectangle(150, y + 40, 240, 10, 0x000000, 0.5).setOrigin(0, 0.5);
          if (frac > 0) this.add.rectangle(150, y + 40, 240 * frac, 10, col('accent'), 1).setOrigin(0, 0.5);
          UI.text(this, 402, y + 40, `${u.level}/${u.max}`, { size: 20, ox: 0 });
        }
        const cur = Meta.economy().currencies[u.currency] || {};
        UI.button(this, {
          id: 'up_' + u.id, x: 590, y, w: 170, h: rowH - (compact ? 30 : 40), size: 28, icon: u.maxed ? null : cur.icon,
          label: u.maxed ? 'MAX' : UI.fmt(u.price), disabled: !u.affordable, color: 'primary',
          onClick: () => { if (Meta.buyUpgrade(u.id)) { UI.toast(this, u.name + ' ↑'); this.scene.restart(); } },
        });
      });
      back(this);
      QA.set({ state: 'upgrades' });
    }
  }

  // ======================= МАГАЗИН =======================
  class Store extends Phaser.Scene {
    constructor() { super('Store'); }
    create() {
      const t = T(this), eco = Meta.economy();
      background(this, 0.45);
      header(this, t.store || 'Магазин');
      const items = [];
      if (eco.rewarded.free_coins) {
        const r = Meta.rewardedInfo('free_coins');
        items.push({
          id: 'rw_free', title: t.free_coins || 'Бесплатно за рекламу',
          sub: Object.entries(r.grant || {}).map(([k, v]) => `+${v} ${(eco.currencies[k] || {}).name || k}`).join(', '),
          price: r.ready ? (t.watch || 'Смотреть') : '⏳', color: 'danger', disabled: !r.ready, icon: A(this).ad_icon,
          act: async () => { if (await Meta.rewarded('free_coins')) { UI.toast(this, '+'); this.scene.restart(); } },
        });
      }
      for (const p of Meta.products()) {
        items.push({
          id: 'iap_' + p.id, title: p.title, sub: p.desc || '', price: p.owned ? '✓' : p.price, color: p.best ? 'danger' : 'primary',
          disabled: p.owned, badge: p.best ? (t.best_offer || 'ХИТ') : null, icon: p.icon,
          act: async () => { if (await Meta.buy(p.id)) { UI.toast(this, '✓ ' + p.title); this.scene.restart(); } },
        });
      }
      for (const g of Meta.gemShop()) {
        const cur = Object.keys(g.cost)[0];
        items.push({
          id: 'gem_' + g.id, title: g.title, sub: g.desc || '', price: g.cost[cur], priceIcon: (eco.currencies[cur] || {}).icon,
          color: 'secondary', disabled: !g.affordable, icon: g.icon,
          act: () => { if (Meta.exchange(g.id)) { UI.toast(this, '✓ ' + g.title); this.scene.restart(); } },
        });
      }
      const top = 205, bottom = 1150;
      const rowH = Math.floor(Math.max(80, Math.min(150, (bottom - top) / Math.max(1, items.length))));
      const roomy = rowH >= 125;
      items.forEach((it, i) => {
        const cy = top + rowH * i + rowH / 2;
        UI.panel(this, W / 2, cy, 660, rowH - 10, { color: 'secondary', alpha: 0.92 });
        if (it.icon && this.textures.exists(it.icon)) {
          const im = this.add.image(85, cy, it.icon);
          im.setScale(Math.min(rowH - 30, 80) / Math.max(im.width, im.height));
        }

        // Заголовок и описание размещаются сверху вниз, а не относительно
        // центра строки: многострочное описание больше не заходит на заголовок.
        const textX = 140;
        const textW = 340;
        const rowTop = cy - rowH / 2;
        const title = UI.text(this, textX, rowTop + 14, it.title, {
          size: fit(it.title, textW, roomy ? 28 : 24, 16),
          ox: 0, wrap: textW,
        });
        title.setOrigin(0, 0);

        if (it.sub) {
          const subY = title.y + title.height + 5;
          const availableH = Math.max(0, rowTop + rowH - 12 - subY);
          const sub = UI.text(this, textX, subY, it.sub, {
            size: fit(it.sub, textW, roomy ? 22 : 20, 16),
            ox: 0, color: 'accent', wrap: textW,
          });
          sub.setOrigin(0, 0);

          // Не даём длинному описанию вылезти за нижний край карточки.
          if (sub.height > availableH) {
            let shortened = String(it.sub);
            while (shortened.length > 1 && sub.height > availableH) {
              shortened = shortened.slice(0, -1).trimEnd();
              sub.setText(shortened + '…');
            }
            if (sub.height > availableH) sub.setVisible(false);
          }
        }

        if (it.badge) {
          const bx = this.add.container(625, cy - rowH / 2 + 9).setDepth(5);
          const g = this.add.graphics();
          g.fillStyle(col('danger'), 1).fillRoundedRect(-42, -13, 84, 26, 12);
          g.lineStyle(2, 0x1a0b2e, 1).strokeRoundedRect(-42, -13, 84, 26, 12);
          bx.add([g, UI.text(this, 0, 0, it.badge, { size: 18 })]);
          bx.setAngle(6);
        }
        UI.button(this, {
          id: it.id, x: 585, y: cy + 4, w: 180, h: rowH - 40, label: String(it.price), icon: it.priceIcon,
          size: 26, color: it.color, disabled: it.disabled, onClick: it.act,
        });
      });
      back(this);
      QA.set({ state: 'store' });
    }
  }

  // ======================= РЕЗУЛЬТАТЫ =======================
  class Results extends Phaser.Scene {
    constructor() { super('Results'); }
    create(res) {
      const t = T(this), eco = Meta.economy(), art = A(this);
      background(this, 0.4);
      UI.currencyBar(this, W / 2, 50);
      UI.panel(this, W / 2, 610, 620, 760, { color: 'secondary', alpha: 0.95 });

      // Герой выглядывает из-за верхнего края панели.
      if (art.hero && this.textures.exists(art.hero)) {
        const hero = this.add.image(W / 2, 215, art.hero).setDepth(5);
        const base = Math.min(150 / hero.width, 150 / hero.height);
        hero.setScale(base);
        if (res.win) {
          this.tweens.add({ targets: hero, y: 200, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.out' });
        } else {
          hero.setTint(0x8a8a9a).setAngle(-8);
          this.tweens.add({ targets: hero, angle: 8, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        }
      }

      UI.text(this, W / 2, 360, res.win ? (t.win || 'Победа!') : (t.lose || 'Забег окончен'), {
        size: res.win ? 44 : 56, color: res.win ? 'accent' : 'danger', wrap: 560,
      });
      UI.text(this, W / 2, 460, `${t.score || 'Очки'}: ${res.score}`, { size: 44 });
      if (res.newBest) {
        const nb = UI.text(this, W / 2, 520, t.new_best || 'Новый рекорд!', { size: 32, color: 'accent' });
        this.tweens.add({ targets: nb, scale: 1.1, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      const coinIcon = (eco.currencies.coins || {}).icon;
      if (coinIcon && this.textures.exists(coinIcon)) {
        const im = this.add.image(W / 2 - 90, 610, coinIcon);
        im.setScale(80 / Math.max(im.width, im.height));
      }
      const rewardText = UI.text(this, W / 2 - 40, 610, '+' + res.reward.coins, { size: 60, ox: 0 });
      if (coinIcon) UI.fly(this, coinIcon, W / 2, 610, 120, 50, 10);

      const mult = (eco.rewarded.double_reward && eco.rewarded.double_reward.mult) || 2;
      const dbl = UI.button(this, {
        id: 'double', x: W / 2, y: 760, w: 480, h: 110, size: 36, color: 'danger', icon: art.ad_icon,
        label: `x${mult} ${t.for_ad || 'за рекламу'}`,
        onClick: async () => {
          dbl.setDisabled(true);
          if (await Flow.doubleReward(res)) {
            rewardText.setText('+' + res.reward.coins);
            if (coinIcon) UI.fly(this, coinIcon, W / 2, 610, 120, 50, 14);
            burst(this, W / 2, 610, 14, { depth: 20 });
            dbl.setVisible(false);
          } else dbl.setDisabled(false);
        },
      });
      if (!eco.rewarded.double_reward) dbl.setVisible(false);
      UI.button(this, { id: 'continue', x: W / 2, y: 890, w: 360, h: 100, label: t.continue || 'Дальше', color: 'primary', onClick: () => Flow.goHub(this) });

      // Салют при победе.
      if (res.win) {
        this.time.delayedCall(200, () => burst(this, W / 2, 215, 18, { depth: 20, r: 130 }));
        this.time.addEvent({
          delay: 700, repeat: 4,
          callback: () => puff(this, 120 + Math.random() * 480, 200, {
            dx: (Math.random() - 0.5) * 80, dy: 200 + Math.random() * 200, dur: 1600, scale: 0.6, depth: 20, alpha: 1,
          }),
        });
      }
      QA.set({ state: 'results' });
    }
  }

  window.MetaScenes = [Hub, Upgrades, Store, Results];
})();