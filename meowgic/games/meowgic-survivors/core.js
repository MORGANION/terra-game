window.CoreScene = class Core extends Phaser.Scene {
  constructor(){ super('Core'); }

  create(run){
    this.run = run || {};
    const DEF = {run_duration:150, spawn_interval_start:0.9, spawn_interval_min:0.25, spawn_ramp_per_10s:0.06, max_enemies:150,
      mouse_hp:12, mouse_speed:90, brute_hp:60, dasher_hp:20, enemy_contact_damage:8, miniboss_interval:40, miniboss_hp:600,
      boss_hp:2500, xp_base:5, xp_growth:1.25, coin_drop_chance:0.12, trap_interval:12, trap_damage:20};
    const reg = this.registry.get('tun') || {};
    const T = this.tun = {};
    for (const k in DEF) T[k] = (typeof reg[k] === 'number' && isFinite(reg[k])) ? reg[k] : DEF[k];
    this.tx = this.registry.get('text') || {};
    let L = 1;
    try { L = (Meta.progress() || {}).level || this.run.level || 1; } catch (e) { L = this.run.level || 1; }
    this.L = L = Math.max(1, L | 0);
    const ms = (k, d) => { let v; try { v = Meta.stat(k); } catch (e) {} return (typeof v === 'number' && isFinite(v)) ? v : d; };
    this.st = {maxHp: ms('max_hp', 100), dmg: ms('damage', 10), spd: ms('move_speed', 260), mag: ms('magnet_radius', 90), crit: ms('crit_chance', 0.05)};

    this.hpMul = 1 + 0.15 * (L - 1);
    this.spdMul = Math.min(1.4, 1 + 0.03 * (L - 1));
    this.dmgMul = 1 + 0.08 * (L - 1);
    this.spawnStart = Math.max(T.spawn_interval_min, T.spawn_interval_start * Math.pow(0.94, L - 1));
    this.bruteAt = L >= 3 ? 15 : 30;
    this.pairAt = L >= 5 ? 45 : 90;
    this.dur = T.run_duration;
    this.kingAt = Math.min(120, this.dur - 20);

    const cd = T.enemy_contact_damage;
    this.ED = {
      mouse: {key:'enemy_mouse', hp:T.mouse_hp, spd:T.mouse_speed, dmg:cd, xp:1, pts:10, r:22, kb:1, color:0xb565f0},
      brute: {key:'enemy_brute', hp:T.brute_hp, spd:55, dmg:cd * 2, xp:4, pts:30, r:36, kb:0.5, color:0xa89aa8},
      dasher:{key:'enemy_dasher', hp:T.dasher_hp, spd:70, dmg:cd, xp:2, pts:20, r:25, kb:1, color:0xff6fd8},
      mini:  {key:'boss_rat_king', hp:T.miniboss_hp, spd:60, dmg:25, xp:15, pts:250, r:60, kb:0.15, color:0xb565f0, scale:0.7, tint:0xb57bff, boss:1, coins:10},
      king:  {key:'boss_rat_king', hp:T.boss_hp, spd:50, dmg:35, xp:0, pts:1000, r:78, kb:0.08, color:0x8a2be2, boss:2, coins:25}
    };
    this.PERKS = {
      fire:  {name:'Огненный шар', icon:'fireball', max:5, desc:() => 'Кулдаун −12%, урон +20%'},
      multi: {name:'Мульти-каст', icon:'fireball', tint:0xff9a3c, max:5, desc:l => '+1 снаряд за каст (всего ' + (l + 1) + '), веер 12°'},
      pierce:{name:'Пробивание', icon:'spark', tint:0xffc933, max:5, desc:l => 'Шар пробивает насквозь: ' + l + ' враг.'},
      orbit: {name:'Орбитальные звёзды', icon:'fireball', tint:0xffe066, max:5, desc:l => (l + 1) + ' звёзд кружат вокруг кота, урон 60%'},
      chain: {name:'Цепная молния', icon:'spark', tint:0x4cc9f0, max:5, desc:l => 'Раз в 2.2 с, ' + (l + 1) + ' перескоков, урон 80%'},
      aura:  {name:'Ледяная аура', icon:'spark', tint:0x9be7ff, max:5, desc:l => 'Радиус ' + (100 + 20 * l) + ', замедление 30%, урон 15%/с'},
      vital: {name:'Кошачья живучесть', icon:'icon_hp', max:5, desc:() => '+20% здоровья и лечение 30%'},
      meteor:{name:'Метеоритный дождь', icon:'fireball', tint:0xff7a1a, max:1, gold:true, desc:() => 'ЭВОЛЮЦИЯ! 5 метеоров каждые 1.5 с, урон 250% по области'},
      milk:  {name:'Миска молока', icon:'icon_hp', max:999, desc:() => 'Лечение 30% и +50 очков'}
    };

    this.t = 0; this.secT = 0; this.score = 0; this.coins = 0;
    this.lvl = 1; this.xp = 0; this.xpNeed = this.calcNeed();
    this.maxHp = this.st.maxHp; this.hp = this.maxHp; this.inv = 0;
    this.perks = {fire:0, multi:0, pierce:0, orbit:0, chain:0, aura:0, vital:0, meteor:0};
    this.rerolls = 1; this.pending = 0; this.inLvl = false; this.cardsOpen = false; this.lvlObjs = null;
    this.paused = false; this.ended = false; this.endCalled = false; this.reviving = false; this.revObjs = null; this.revBusy = false;
    this.slow = 1;
    this.enemies = []; this.projs = []; this.picks = []; this.runes = []; this.meteors = []; this.stars = [];
    this.texts = 0; this.emitters = {};
    this.spawnT = 0.6; this.fireT = 0.4; this.chainT = 1; this.auraT = 0.5; this.meteorT = 1.5;
    this.runeT = T.trap_interval; this.nextMini = T.miniboss_interval;
    this.king = null; this.kingSpawned = false; this.kingRingT = 4; this.enraged = false; this.bossRef = null;
    this.orbA = 0;
    this.joy = {on:false, ox:0, oy:0, x:0, y:0};

    try { this.physics.resume(); } catch (e) {}
    this.time.timeScale = 1; this.tweens.timeScale = 1;
    this.cameras.main.setBackgroundColor(UI.c('background'));

    this.add.image(360, 640, 'arena_bg').setDisplaySize(720, 1280).setDepth(0);
    this.auraC = this.add.circle(0, 0, 120, 0x4cc9f0, 0.1).setStrokeStyle(3, 0x9be7ff, 0.5).setDepth(2).setVisible(false);
    this.shadow = this.add.ellipse(360, 760, 64, 20, 0x000000, 0.35).setDepth(4);
    this.cat = this.add.image(360, 720, 'cat_mage').setDepth(5);

    this.joyBase = this.add.circle(0, 0, 60, 0xffffff, 0.08).setStrokeStyle(3, 0xffffff, 0.3).setDepth(19).setVisible(false);
    this.joyKnob = this.add.circle(0, 0, 26, 0xffffff, 0.35).setDepth(19).setVisible(false);

    this.vig = this.add.graphics().setDepth(25).setAlpha(0);
    for (let i = 0; i < 8; i++) {
      const a = 0.45 * (1 - i / 8), w = 12;
      this.vig.fillStyle(0xc92a3a, a);
      this.vig.fillRect(0, i * w, 720, w); this.vig.fillRect(0, 1280 - (i + 1) * w, 720, w);
      this.vig.fillRect(i * w, 0, w, 1280); this.vig.fillRect(720 - (i + 1) * w, 0, w, 1280);
    }
    this.darkR = this.add.rectangle(0, 0, 720, 1280, 0x000000, 1).setOrigin(0).setDepth(18).setAlpha(0);

    this.buildHud();
    this.updateHud();
    this.qa();

    const hint = this.txt(360, 1000, this.tx.hint || 'Веди пальцем — кот колдует сам!', 30, UI.css('text')).setDepth(17);
    this.tweens.add({targets:hint, alpha:0, delay:2200, duration:600, onComplete:() => hint.destroy()});

    this.input.off('pointerdown'); this.input.off('pointermove'); this.input.off('pointerup'); this.input.off('pointerupoutside');
    this.input.on('pointerdown', p => {
      if (this.paused || this.ended || p.y <= 140) return;
      this.joy = {on:true, ox:p.x, oy:p.y, x:p.x, y:p.y};
      this.joyBase.setPosition(p.x, p.y).setVisible(true);
      this.joyKnob.setPosition(p.x, p.y).setVisible(true);
    });
    this.input.on('pointermove', p => { if (this.joy.on) { this.joy.x = p.x; this.joy.y = p.y; } });
    const up = () => { this.joy.on = false; this.joyBase.setVisible(false); this.joyKnob.setVisible(false); };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    try { QA.event('run_start', {level:L}); } catch (e) {}
  }

  // ---------- helpers ----------
  qa(){ try { QA.set({score:Math.round(this.score)}); } catch (e) {} }
  addScore(n){ this.score += n; this.qa(); }
  calcNeed(){ return Math.max(1, Math.round(this.tun.xp_base * Math.pow(this.tun.xp_growth, this.lvl - 1))); }
  kingAlive(){ return !!(this.king && !this.king.dead); }

  txt(x, y, s, size, color, ox = 0.5, oy = 0.5){
    const t = UI.text(this, x, y, String(s), {size, color:color || UI.css('text'), ox, oy});
    if (t.setOrigin) t.setOrigin(ox, oy);
    if (t.setStroke) t.setStroke(UI.css('outline'), Math.max(3, Math.round(size / 7)));
    return t;
  }

  floatText(x, y, s, size, color){
    if (this.texts >= 35) return;
    this.texts++;
    const t = this.txt(x, y, s, size, color).setDepth(15);
    this.tweens.add({targets:t, y:y - 50, alpha:{from:1, to:0}, duration:650, ease:'Cubic.Out', onComplete:() => { t.destroy(); this.texts--; }});
    return t;
  }

  burst(x, y, color, n){
    let em = this.emitters[color];
    if (!em) {
      em = this.add.particles(0, 0, 'spark', {speed:{min:60, max:260}, lifespan:{min:250, max:520}, scale:{start:0.7, end:0},
        alpha:{start:1, end:0}, tint:color, blendMode:'ADD', emitting:false}).setDepth(8);
      this.emitters[color] = em;
    }
    em.explode(n, x, y);
  }

  ring(x, y, color, scaleTo, dur){
    const c = this.add.circle(x, y, 20).setStrokeStyle(6, color, 1).setDepth(8);
    this.tweens.add({targets:c, scale:scaleTo, alpha:0, duration:dur, ease:'Cubic.Out', onComplete:() => c.destroy()});
  }

  banner(str, color){
    this.cameras.main.shake(300, 0.01);
    this.tweens.killTweensOf(this.darkR);
    this.tweens.add({targets:this.darkR, alpha:{from:0.5, to:0}, duration:300});
    const t = this.txt(360, 560, str, 64, color).setDepth(26).setScale(0.3);
    this.tweens.add({targets:t, scale:1, duration:320, ease:'Back.Out'});
    this.tweens.add({targets:t, alpha:0, y:520, delay:1100, duration:400, onComplete:() => t.destroy()});
  }

  // ---------- HUD ----------
  buildHud(){
    const D = 21;
    this.add.rectangle(0, 0, 720, 140, UI.c('background'), 0.85).setOrigin(0).setDepth(20);
    this.add.rectangle(20, 17, 280, 28, 0x000000, 0.55).setOrigin(0).setDepth(D).setStrokeStyle(2, UI.c('outline'));
    this.hpFill = this.add.rectangle(22, 19, 276, 24, UI.c('danger'), 1).setOrigin(0).setDepth(D);
    this.hpTxt = this.txt(160, 31, '', 20).setDepth(D + 1);
    this.timerTxt = this.txt(360, 40, '', 52).setDepth(D);
    this.lvlTxt = this.txt(360, 90, '', 24, UI.css('accent')).setDepth(D);
    this.scoreTxt = this.txt(700, 30, '', 26, UI.css('text'), 1, 0.5).setDepth(D);
    this.coinIcon = this.add.image(590, 75, 'coin').setScale(0.45).setDepth(D);
    this.coinTxt = this.txt(620, 75, '0', 28, UI.css('accent'), 0, 0.5).setDepth(D);
    this.add.rectangle(0, 125, 720, 13, 0x000000, 0.6).setOrigin(0).setDepth(D);
    this.xpFill = this.add.rectangle(0, 125, 720, 13, UI.c('extra1'), 1).setOrigin(0).setDepth(D);
    this.xpFill.scaleX = 0;
    this.xpGlow = this.add.rectangle(0, 121, 720, 21, 0xffffff, 1).setOrigin(0).setDepth(D + 1).setAlpha(0).setBlendMode('ADD');
    this.bossBg = this.add.rectangle(110, 152, 500, 16, 0x000000, 0.6).setOrigin(0).setDepth(D).setStrokeStyle(2, UI.c('outline'));
    this.bossFill = this.add.rectangle(112, 154, 496, 12, UI.c('extra2'), 1).setOrigin(0).setDepth(D);
    this.bossTxt = this.txt(360, 176, '', 20, UI.css('extra2')).setDepth(D);
    this.setBossBar(false);
  }

  setBossBar(v){ this.bossBg.setVisible(v); this.bossFill.setVisible(v); this.bossTxt.setVisible(v); }

  updateHud(){
    const r = Math.max(0, this.hp / this.maxHp);
    this.hpFill.scaleX = r;
    this.hpTxt.setText(Math.max(0, Math.ceil(this.hp)) + ' / ' + Math.round(this.maxHp));
    const rem = Math.max(0, this.dur - this.t), rs = Math.ceil(rem);
    this.timerTxt.setText(Math.floor(rs / 60) + ':' + String(rs % 60).padStart(2, '0'));
    if (rem <= 0 && this.kingAlive()) {
      this.timerTxt.setColor(UI.css('danger'));
      this.timerTxt.setScale(1 + 0.08 * Math.sin(this.t * 10));
    } else if (rem <= 10) this.timerTxt.setColor(UI.css('accent'));
    else this.timerTxt.setColor(UI.css('text'));
    this.lvlTxt.setText('Ур. ' + this.lvl);
    this.scoreTxt.setText((this.tx.score || 'Очки') + ': ' + UI.fmt(Math.round(this.score)));
    this.coinTxt.setText(String(this.coins));
    this.xpFill.scaleX = Math.min(1, this.xp / this.xpNeed);
    const b = this.bossRef;
    if (b && !b.dead) {
      this.setBossBar(true);
      this.bossFill.scaleX = Math.max(0, b.hp / b.maxHp);
      this.bossTxt.setText(b.type === 'king' ? 'Крысиный Король' : 'Теневой Вожак');
    } else this.setBossBar(false);
  }

  // ---------- spawning ----------
  spawnEnemy(type, x, y){
    const D = this.ED[type];
    const s = this.add.image(x, y, D.key).setDepth(D.boss ? 4 : 3);
    if (D.scale) s.setScale(D.scale);
    if (D.tint) s.setTint(D.tint);
    const hp = D.hp * this.hpMul;
    const e = {spr:s, type, D, hp, maxHp:hp, spd:D.spd * this.spdMul, dmg:D.dmg * this.dmgMul, r:D.r, kb:D.kb,
      flash:0, orbCd:0, st:0, stT:1 + Math.random() * 2, dvx:0, dvy:0, ph:Math.random() * 6, dead:false};
    s.setAlpha(0);
    this.tweens.add({targets:s, alpha:1, duration:200});
    this.enemies.push(e);
    return e;
  }

  edgePoint(){
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return {x:30 + Math.random() * 660, y:105};
    if (side === 1) return {x:30 + Math.random() * 660, y:1325};
    if (side === 2) return {x:-45, y:170 + Math.random() * 1080};
    return {x:765, y:170 + Math.random() * 1080};
  }

  spawnGroup(){
    const n = 1 + Math.floor(this.t / 30), p = this.edgePoint();
    for (let i = 0; i < n; i++) {
      if (this.enemies.length >= this.tun.max_enemies) break;
      const r = Math.random();
      let type = 'mouse';
      if (this.t >= 50 && r < 0.18) type = 'dasher';
      else if (this.t >= this.bruteAt && r < 0.33) type = 'brute';
      this.spawnEnemy(type, p.x + (Math.random() - 0.5) * 80, p.y + (Math.random() - 0.5) * 80);
    }
  }

  spawnBoss(type){
    const e = this.spawnEnemy(type, 160 + Math.random() * 400, 60);
    this.bossRef = e;
    if (type === 'king') {
      this.king = e; this.kingSpawned = true;
      this.banner(this.tx.king || 'КРЫСИНЫЙ КОРОЛЬ!', UI.css('danger'));
    } else this.banner(this.tx.miniboss || 'ВОЖАК!', UI.css('extra2'));
    try { QA.event('boss', {type, t:Math.round(this.t)}); } catch (er) {}
  }

  spawnRune(){
    let x = 360, y = 700;
    for (let i = 0; i < 25; i++) {
      x = 100 + Math.random() * 520; y = 240 + Math.random() * 940;
      if (Math.hypot(x - this.cat.x, y - this.cat.y) >= 150) break;
    }
    const s = this.add.image(x, y, 'trap_rune').setDepth(1).setAlpha(0.3).setTint(0xff3344);
    this.runes.push({spr:s, age:0, hitCd:0, dead:false});
  }

  spawnPick(kind, x, y, v){
    x = Phaser.Math.Clamp(x, 30, 690); y = Phaser.Math.Clamp(y, 170, 1250);
    if (kind === 'xp' && this.picks.length > 260) {
      const ex = this.picks.find(q => q.kind === 'xp' && !q.mag && !q.dead);
      if (ex) { ex.v += v; return; }
    }
    const s = kind === 'xp'
      ? this.add.image(x, y, 'spark').setTint(0x4cc9f0).setScale(v >= 3 ? 0.85 : 0.6).setBlendMode('ADD').setDepth(2)
      : this.add.image(x, y, 'coin').setScale(0.5).setDepth(2);
    const bs = s.scale;
    s.setScale(0);
    this.tweens.add({targets:s, scale:bs, duration:220, ease:'Back.Out'});
    this.picks.push({spr:s, kind, v, mag:false, sp:300, dead:false});
  }

  // ---------- combat ----------
  nearest(x, y, maxD, skip){
    let best = null, bd = maxD * maxD;
    for (const e of this.enemies) {
      if (e.dead || (skip && skip.has(e))) continue;
      const dx = e.spr.x - x, dy = e.spr.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  restoreTint(e){ if (e.D.tint) e.spr.setTint(e.D.tint); else e.spr.clearTint(); }

  hitEnemy(e, base, nx, ny, kbPx){
    if (e.dead) return;
    const crit = Math.random() < this.st.crit;
    const dmg = Math.max(1, Math.round(base * (crit ? 2 : 1)));
    e.hp -= dmg;
    e.flash = 0.06; e.spr.setTintFill(0xffffff);
    if (kbPx) { e.spr.x += nx * kbPx * e.kb; e.spr.y += ny * kbPx * e.kb; }
    const ty = e.spr.y - e.r - 6;
    if (crit) {
      const t = this.floatText(e.spr.x, ty, dmg + '!', 34, UI.css('accent'));
      if (t) { t.setScale(1.5); this.tweens.add({targets:t, scale:1, duration:180}); }
    } else this.floatText(e.spr.x + (Math.random() - 0.5) * 20, ty, dmg, 22, '#ffffff');
    if (e.hp <= 0) this.killEnemy(e, true);
  }

  killEnemy(e, reward){
    if (e.dead) return;
    e.dead = true; this.anyDead = true;
    const s = e.spr, x = s.x, y = s.y, D = e.D;
    this.burst(x, y, D.color, D.boss ? 30 : 6 + Math.floor(Math.random() * 5));
    this.tweens.killTweensOf(s);
    s.setTintFill(0xffffff);
    this.tweens.add({targets:s, alpha:0, scale:s.scale * 1.3, delay:60, duration:140, onComplete:() => s.destroy()});
    if (!reward) return;
    this.addScore(D.pts);
    if (D.boss) {
      this.cameras.main.shake(D.boss === 2 ? 500 : 250, D.boss === 2 ? 0.015 : 0.008);
      this.ring(x, y, D.color, 8, 500);
      this.floatText(x, y - 60, '+' + D.pts, 40, UI.css('accent'));
    }
    if (D.boss === 1) {
      for (let i = 0; i < 5; i++) this.spawnPick('xp', x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 120, 3);
      for (let i = 0; i < D.coins; i++) this.spawnPick('coin', x + (Math.random() - 0.5) * 160, y + (Math.random() - 0.5) * 160, 1);
    } else if (D.boss === 2) {
      this.coins += D.coins;
      try { UI.fly(this, 'coin', x, y, 590, 75, 10); } catch (er) {}
      this.banner(this.tx.king_dead || 'КОРОЛЬ ПОВЕРЖЕН!', UI.css('accent'));
    } else {
      this.spawnPick('xp', x, y, D.xp);
      if (Math.random() < this.tun.coin_drop_chance) this.spawnPick('coin', x + 12, y + 8, 1);
    }
  }

  hurtCat(dmg){
    if (this.inv > 0 || this.ended || this.reviving) return false;
    dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg; this.inv = 0.6;
    this.cameras.main.shake(150, 0.004);
    this.tweens.killTweensOf(this.vig);
    this.vig.setAlpha(1);
    this.tweens.add({targets:this.vig, alpha:0, duration:200});
    this.cat.setTint(0xff7070);
    this.time.delayedCall(150, () => { if (this.cat) this.cat.clearTint(); });
    this.floatText(this.cat.x, this.cat.y - 50, '-' + dmg, 28, UI.css('danger'));
    if (this.hp <= 0) this.die();
    return true;
  }

  castFire(tg){
    const cat = this.cat, base = Math.atan2(tg.spr.y - cat.y, tg.spr.x - cat.x);
    const n = 1 + this.perks.multi, spread = Phaser.Math.DegToRad(12);
    const dmg = this.st.dmg * (1 + 0.2 * this.perks.fire);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      const s = this.add.image(cat.x, cat.y, 'fireball').setDepth(6).setRotation(a).setScale(0.8);
      this.projs.push({spr:s, vx:Math.cos(a) * 520, vy:Math.sin(a) * 520, dmg, pierce:this.perks.pierce, hit:new Set(), dead:false});
    }
    this.burst(cat.x + Math.cos(base) * 30, cat.y + Math.sin(base) * 30, 0xff8a2a, 3);
  }

  bolt(x1, y1, x2, y2){
    const d = Math.hypot(x2 - x1, y2 - y1), n = Math.max(3, Math.ceil(d / 22));
    const px = -(y2 - y1) / (d || 1), py = (x2 - x1) / (d || 1);
    for (let i = 0; i <= n; i++) {
      const f = i / n, j = (i === 0 || i === n) ? 0 : (Math.random() - 0.5) * 22;
      const s = this.add.image(x1 + (x2 - x1) * f + px * j, y1 + (y2 - y1) * f + py * j, 'spark')
        .setTint(0x4cc9f0).setScale(0.55).setBlendMode('ADD').setDepth(7);
      this.tweens.add({targets:s, alpha:0, scale:0.2, duration:280, delay:i * 6, onComplete:() => s.destroy()});
    }
  }

  castChain(){
    let cur = this.nearest(this.cat.x, this.cat.y, 520);
    if (!cur) { this.chainT = 0.3; return; }
    let px = this.cat.x, py = this.cat.y;
    const hit = new Set(), total = 1 + (1 + this.perks.chain), dmg = this.st.dmg * 0.8;
    for (let i = 0; i < total && cur; i++) {
      const cx = cur.spr.x, cy = cur.spr.y;
      this.bolt(px, py, cx, cy);
      hit.add(cur);
      this.hitEnemy(cur, dmg, 0, 0, 0);
      this.burst(cx, cy, 0x4cc9f0, 4);
      px = cx; py = cy;
      cur = this.nearest(px, py, 160, hit);
    }
  }

  castMeteors(){
    const vis = this.enemies.filter(e => !e.dead && e.spr.x > 0 && e.spr.x < 720 && e.spr.y > 150 && e.spr.y < 1280);
    for (let i = 0; i < 5; i++) {
      let tx, ty;
      if (vis.length) { const e = vis[Math.floor(Math.random() * vis.length)]; tx = e.spr.x; ty = e.spr.y; }
      else { tx = this.cat.x + (Math.random() - 0.5) * 400; ty = this.cat.y + (Math.random() - 0.5) * 400; }
      const s = this.add.image(tx + 140, ty - 560, 'fireball').setTint(0xff8a1a).setScale(1.6).setDepth(7)
        .setRotation(Math.atan2(560, -140));
      this.meteors.push({spr:s, tx, ty, t:-i * 0.08, dead:false});
    }
  }

  explodeMeteor(x, y){
    const dmg = this.st.dmg * 2.5;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.spr.x - x, dy = e.spr.y - y, d = Math.hypot(dx, dy);
      if (d < 90 + e.r * 0.5) this.hitEnemy(e, dmg, dx / (d || 1), dy / (d || 1), 30);
    }
    this.cameras.main.shake(120, 0.006);
    this.ring(x, y, 0xff8a1a, 4.5, 320);
    this.burst(x, y, 0xff8a1a, 12);
  }

  rebuildStars(){
    this.stars.forEach(s => s.destroy());
    this.stars = [];
    const n = [0, 2, 3, 4, 5, 6][this.perks.orbit] || 0;
    for (let i = 0; i < n; i++) this.stars.push(this.add.image(0, 0, 'fireball').setTint(0xffe066).setScale(0.5).setBlendMode('ADD').setDepth(6));
  }

  // ---------- level up ----------
  gainXp(v){
    this.xp += v;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed; this.lvl++; this.xpNeed = this.calcNeed(); this.pending++;
    }
    this.tweens.killTweensOf(this.xpGlow);
    this.xpGlow.setAlpha(0.6);
    this.tweens.add({targets:this.xpGlow, alpha:0, duration:220});
    if (this.pending > 0 && !this.inLvl) this.beginLevelUp();
  }

  beginLevelUp(){
    this.inLvl = true;
    const c = this.cat;
    const p = this.add.rectangle(c.x, c.y + 40, 100, 1400, UI.c('accent'), 0.6).setOrigin(0.5, 1).setDepth(9).setBlendMode('ADD');
    this.tweens.add({targets:p, scaleX:{from:0.1, to:1}, alpha:{from:0.85, to:0}, duration:700, onComplete:() => p.destroy()});
    this.burst(c.x, c.y, 0xffc933, 18);
    this.slow = 0.25;
    this.time.delayedCall(300, () => {
      this.slow = 1;
      if (this.ended) return;
      if (this.reviving) { this.inLvl = false; return; }
      this.paused = true;
      this.joy.on = false; this.joyBase.setVisible(false); this.joyKnob.setVisible(false);
      this.showCards();
    });
  }

  rollPerks(){
    const P = this.perks, pool = [];
    for (const k of ['fire', 'multi', 'pierce', 'orbit', 'chain', 'aura', 'vital']) if (P[k] < this.PERKS[k].max) pool.push(k);
    Phaser.Utils.Array.Shuffle(pool);
    const out = [];
    if (P.fire >= 3 && P.multi >= 2 && !P.meteor) out.push('meteor');
    while (out.length < 3 && pool.length) out.push(pool.shift());
    if (out.length < 3) out.push('milk');
    return out;
  }

  showCards(){
    this.cardsOpen = true;
    const objs = this.lvlObjs = [];
    objs.push(this.add.rectangle(0, 0, 720, 1280, 0x000000, 0.65).setOrigin(0).setDepth(30));
    const ttl = this.txt(360, 240, (this.tx.level || 'Уровень') + ' ' + this.lvl + '!', 54, UI.css('accent')).setDepth(31).setScale(0.4);
    this.tweens.add({targets:ttl, scale:1, duration:300, ease:'Back.Out'});
    objs.push(ttl);
    const ys = [380, 640, 900];
    this.rollPerks().forEach((id, i) => {
      const P = this.PERKS[id], cur = this.perks[id] || 0;
      const btn = UI.button(this, {id:'perk_' + i, x:360, y:1500, w:600, h:220, label:'', color:P.gold ? 'accent' : 'secondary',
        onClick:() => this.pickPerk(id)});
      btn.setDepth(31);
      const ic = this.add.image(-220, 0, P.icon);
      ic.setScale(110 / Math.max(ic.width, ic.height));
      if (P.tint) ic.setTint(P.tint);
      const tc = P.gold ? '#3a1a00' : UI.css('text');
      const nm = this.txt(-140, -62, P.name, 32, tc, 0, 0.5);
      const lvTxt = id === 'milk' ? '' : id === 'meteor' ? 'ЭВОЛЮЦИЯ' : (cur === 0 ? 'НОВОЕ' : 'Ур. ' + cur + ' → ' + (cur + 1));
      const lv = this.txt(280, -62, lvTxt, 22, P.gold ? '#7a2a00' : UI.css('accent'), 1, 0.5);
      const ds = this.txt(-140, -20, P.desc(cur + 1), 24, tc, 0, 0);
      if (ds.setWordWrapWidth) ds.setWordWrapWidth(410);
      btn.add([ic, nm, lv, ds]);
      this.tweens.add({targets:btn, y:ys[i], duration:480, delay:i * 90, ease:'Back.Out'});
      if (P.gold) this.tweens.add({targets:ic, scale:ic.scale * 1.15, yoyo:true, repeat:-1, duration:400});
      objs.push(btn);
    });
    const rr = UI.button(this, {id:'reroll', x:360, y:1170, w:340, h:90, label:'Реролл (' + this.rerolls + ')', color:'primary',
      disabled:this.rerolls <= 0, onClick:() => {
        if (this.rerolls <= 0 || !this.cardsOpen) return;
        this.rerolls--; this.cardsOpen = false;
        const o = this.lvlObjs; this.lvlObjs = null;
        o.forEach(x => x.setVisible(false));
        this.time.delayedCall(10, () => { o.forEach(x => x.destroy()); if (!this.ended) this.showCards(); });
      }});
    rr.setDepth(31);
    objs.push(rr);
  }

  pickPerk(id){
    if (!this.cardsOpen) return;
    this.cardsOpen = false;
    const o = this.lvlObjs; this.lvlObjs = null;
    o.forEach(x => x.setVisible(false));
    this.time.delayedCall(10, () => o.forEach(x => x.destroy()));
    this.applyPerk(id);
    this.pending--;
    this.updateHud();
    if (this.pending > 0) this.time.delayedCall(160, () => { if (!this.ended) this.showCards(); });
    else { this.paused = false; this.inLvl = false; this.joy.on = false; }
  }

  applyPerk(id){
    if (id !== 'milk') this.perks[id] = (this.perks[id] || 0) + 1;
    const c = this.cat;
    if (id === 'orbit') this.rebuildStars();
    else if (id === 'chain') this.chainT = Math.min(this.chainT, 0.5);
    else if (id === 'aura') this.auraC.setVisible(true).setRadius(100 + 20 * this.perks.aura);
    else if (id === 'vital') {
      this.maxHp = this.st.maxHp * (1 + 0.2 * this.perks.vital);
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3);
      this.burst(c.x, c.y, 0x66ff88, 14);
    } else if (id === 'milk') {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3);
      this.addScore(50);
    } else if (id === 'meteor') {
      this.banner('МЕТЕОРИТНЫЙ ДОЖДЬ!', UI.css('primary'));
      this.meteorT = 0.5;
    }
    try { QA.event('perk', {id, lvl:this.perks[id] || 1}); } catch (e) {}
  }

  // ---------- death / revive / end ----------
  die(){
    if (this.ended || this.reviving) return;
    this.hp = 0;
    this.updateHud();
    let can = false;
    try { can = Flow.canRevive(); } catch (e) {}
    if (can) this.showRevive(); else this.finish(false);
  }

  showRevive(){
    this.reviving = true; this.paused = true;
    try { this.physics.pause(); } catch (e) {}
    this.joy.on = false; this.joyBase.setVisible(false); this.joyKnob.setVisible(false);
    const o = this.revObjs = [];
    o.push(this.add.rectangle(0, 0, 720, 1280, 0x000000, 0.6).setOrigin(0).setDepth(40));
    const pn = UI.panel(this, 360, 640, 620, 480, {alpha:0.97, radius:24});
    if (pn.setDepth) pn.setDepth(41);
    o.push(pn);
    o.push(this.txt(360, 470, this.tx.revive || 'Второй шанс', 46, UI.css('accent')).setDepth(42));
    const q = this.txt(360, 570, this.tx.revive_q || 'Воскресить архимага?', 28).setDepth(42);
    if (q.setWordWrapWidth) { q.setWordWrapWidth(540); if (q.setAlign) q.setAlign('center'); }
    o.push(q);
    const rb = UI.button(this, {id:'revive', x:360, y:700, w:440, h:100, label:this.tx.watch || this.tx.revive || 'Смотреть', icon:'icon_ad', color:'accent',
      onClick:() => this.onRevive(rb)});
    rb.setDepth(42); o.push(rb);
    const nb = UI.button(this, {id:'no_revive', x:360, y:810, w:440, h:80, label:this.tx.no_thanks || 'Нет, спасибо', color:'secondary',
      onClick:() => {
        if (this.revBusy || this.ended) return;
        this.closeRevive(); this.finish(false);
      }});
    nb.setDepth(42); o.push(nb);
  }

  async onRevive(btn){
    if (this.revBusy || this.ended) return;
    this.revBusy = true;
    let ok = false;
    try { ok = await Flow.revive(); } catch (e) { ok = false; }
    this.revBusy = false;
    if (this.ended || !this.reviving) return;
    if (ok) { this.closeRevive(); this.doRevive(); }
    else {
      try { UI.toast(this, this.tx.ad_fail || 'Реклама недоступна'); } catch (e) {}
      if (btn && btn.setDisabled) btn.setDisabled(true);
    }
  }

  closeRevive(){
    const o = this.revObjs; this.revObjs = null;
    if (o) { o.forEach(x => x.setVisible(false)); this.time.delayedCall(10, () => o.forEach(x => x.destroy())); }
  }

  doRevive(){
    const c = this.cat;
    this.hp = this.maxHp * 0.5; this.inv = 2.5;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.spr.x - c.x, dy = e.spr.y - c.y, d = Math.hypot(dx, dy) || 1;
      if (d < 320 && !e.D.boss) this.killEnemy(e, false);
      else { e.spr.x += dx / d * 200; e.spr.y += dy / d * 200; }
    }
    this.runes.forEach(r => r.spr.destroy()); this.runes = [];
    this.cameras.main.flash(450, 255, 240, 200);
    this.cameras.main.shake(300, 0.01);
    this.ring(c.x, c.y, 0xffc933, 16, 600);
    this.ring(c.x, c.y, 0xffffff, 10, 450);
    this.burst(c.x, c.y, 0xffc933, 30);
    this.reviving = false; this.paused = false;
    try { this.physics.resume(); } catch (e) {}
    this.inLvl = false;
    if (this.pending > 0) this.beginLevelUp();
    try { QA.event('revive', {t:Math.round(this.t)}); } catch (e) {}
  }

  finish(win){
    if (this.ended) return;
    this.ended = true; this.paused = true; this.joy.on = false;
    try { this.physics.pause(); } catch (e) {}
    if (win) this.addScore(1000 * this.L);
    const res = {score:Math.round(this.score), win:!!win, coins:this.coins};
    this.qa();
    this.tweens.add({targets:this.darkR, alpha:0.5, duration:500});
    const t = this.txt(360, 620, win ? (this.tx.win || 'Победа!') : (this.tx.lose || 'Поражение...'), 44,
      win ? UI.css('accent') : UI.css('danger')).setDepth(45).setScale(0.3);
    if (t.setWordWrapWidth) t.setWordWrapWidth(640);
    this.tweens.add({targets:t, scale:1, duration:400, ease:'Back.Out'});
    if (win) { this.burst(this.cat.x, this.cat.y, 0xffc933, 40); this.cameras.main.flash(300, 255, 220, 120); }
    try { QA.event('run_end', res); } catch (e) {}
    this.time.delayedCall(1400, () => {
      if (this.endCalled) return;
      this.endCalled = true;
      Flow.endRun(this, res);
    });
  }

  // ---------- main loop ----------
  update(time, delta){
    if (!this.cat || this.paused || this.ended) return;
    const dt = Math.min(delta, 50) / 1000 * this.slow;
    const T = this.tun, cat = this.cat, P = this.perks;
    this.t += dt;
    this.anyDead = false;

    this.secT += dt;
    while (this.secT >= 1) { this.secT -= 1; this.addScore(5); }

    // movement
    const j = this.joy;
    let moving = false;
    if (j.on) {
      const dx = j.x - j.ox, dy = j.y - j.oy, len = Math.hypot(dx, dy);
      if (len > 2) {
        const sp = this.st.spd * Math.min(1, len / 40);
        cat.x += dx / len * sp * dt; cat.y += dy / len * sp * dt;
        if (Math.abs(dx) > 4) cat.setFlipX(dx < 0);
        moving = true;
      }
      const k = Math.min(1, 60 / (len || 1));
      this.joyKnob.setPosition(j.ox + dx * k, j.oy + dy * k);
    }
    cat.x = Phaser.Math.Clamp(cat.x, 30, 690);
    cat.y = Phaser.Math.Clamp(cat.y, 170, 1250);
    cat.angle = moving ? Math.sin(this.t * 14) * 5 : 0;
    this.shadow.setPosition(cat.x, cat.y + 40);
    if (this.inv > 0) { this.inv -= dt; cat.setAlpha(this.inv > 0 && Math.floor(this.inv * 16) % 2 ? 0.35 : 1); }
    else if (cat.alpha !== 1) cat.setAlpha(1);
    if (P.aura) this.auraC.setPosition(cat.x, cat.y).setAlpha(0.8 + 0.2 * Math.sin(this.t * 4));

    // spawning
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = this.t >= this.kingAt ? T.spawn_interval_min
        : Math.max(T.spawn_interval_min, this.spawnStart - T.spawn_ramp_per_10s * Math.floor(this.t / 10));
      this.spawnGroup();
    }
    if (!this.kingSpawned && this.t >= this.kingAt) this.spawnBoss('king');
    if (this.t >= this.nextMini) {
      this.nextMini += T.miniboss_interval;
      if (!this.kingAlive() && Math.abs(this.t - this.kingAt) > 3 && this.t < this.dur) this.spawnBoss('mini');
    }
    if (this.kingAlive()) {
      const ks = this.king.spr;
      this.kingRingT -= dt;
      if (this.kingRingT <= 0) {
        this.kingRingT = 4;
        for (let i = 0; i < 8; i++) {
          if (this.enemies.length >= T.max_enemies + 20) break;
          const a = i / 8 * Math.PI * 2;
          this.spawnEnemy('mouse', ks.x + Math.cos(a) * 95, ks.y + Math.sin(a) * 95);
        }
        this.ring(ks.x, ks.y, 0x8a2be2, 6, 400);
        this.tweens.add({targets:ks, scale:1.12, yoyo:true, duration:150});
      }
      if (!this.enraged && this.t > this.dur + 30) {
        this.enraged = true; this.king.spd *= 1.6;
        this.banner('КОРОЛЬ В ЯРОСТИ!', UI.css('danger'));
      }
    }

    // runes
    this.runeT -= dt;
    if (this.runeT <= 0) {
      this.runeT = T.trap_interval;
      const n = this.t >= this.pairAt ? 2 : 1;
      for (let i = 0; i < n; i++) this.spawnRune();
    }
    for (const r of this.runes) {
      r.age += dt; const s = r.spr;
      if (r.age < 1) {
        s.setAlpha(0.3 + 0.25 * Math.sin(r.age * 25));
        s.setTint(Math.sin(r.age * 30) > 0 ? 0xff2030 : 0xff9090);
      } else if (r.age < 7) {
        if (r.age - dt < 1) { s.clearTint(); s.setAlpha(0.9); this.tweens.add({targets:s, scale:{from:1.15, to:1}, duration:200}); }
        s.angle += dt * 30;
        if (r.hitCd > 0) r.hitCd -= dt;
        if (r.hitCd <= 0 && Math.hypot(cat.x - s.x, cat.y - s.y) < 72) {
          this.hurtCat(T.trap_damage); r.hitCd = 0.6;
        }
      } else if (!r.dead) {
        r.dead = true;
        this.tweens.add({targets:s, alpha:0, duration:300, onComplete:() => s.destroy()});
      }
    }
    if (this.runes.some(r => r.dead)) this.runes = this.runes.filter(r => !r.dead);

    // weapons
    this.fireT -= dt;
    if (this.fireT <= 0) {
      const tg = this.nearest(cat.x, cat.y, 900);
      if (tg) { this.castFire(tg); this.fireT = 1.0 * Math.pow(0.88, P.fire); } else this.fireT = 0.1;
    }
    if (P.chain) { this.chainT -= dt; if (this.chainT <= 0) { this.chainT = 2.2; this.castChain(); } }
    const auraR = P.aura ? 100 + 20 * P.aura : 0;
    if (auraR) {
      this.auraT -= dt;
      if (this.auraT <= 0) {
        this.auraT = 0.5;
        const ad = this.st.dmg * 0.15 * 0.5;
        for (const e of this.enemies) {
          if (!e.dead && Math.hypot(e.spr.x - cat.x, e.spr.y - cat.y) < auraR + e.r) this.hitEnemy(e, ad, 0, 0, 0);
        }
      }
    }
    if (P.meteor) { this.meteorT -= dt; if (this.meteorT <= 0) { this.meteorT = 1.5; this.castMeteors(); } }
    if (this.stars.length) {
      this.orbA += dt * Math.PI * 2 / 1.6;
      const n = this.stars.length, od = this.st.dmg * 0.6;
      for (let i = 0; i < n; i++) {
        const a = this.orbA + i * Math.PI * 2 / n, s = this.stars[i];
        s.setPosition(cat.x + Math.cos(a) * 110, cat.y + Math.sin(a) * 110).setRotation(a + Math.PI / 2);
        for (const e of this.enemies) {
          if (e.dead || e.orbCd > 0) continue;
          const dx = e.spr.x - s.x, dy = e.spr.y - s.y, rr = e.r + 16;
          if (dx * dx + dy * dy < rr * rr) {
            e.orbCd = 0.35;
            const ox = e.spr.x - cat.x, oy = e.spr.y - cat.y, ol = Math.hypot(ox, oy) || 1;
            this.hitEnemy(e, od, ox / ol, oy / ol, 8);
          }
        }
      }
    }

    // projectiles
    for (const p of this.projs) {
      if (p.dead) continue;
      const s = p.spr;
      s.x += p.vx * dt; s.y += p.vy * dt;
      if (s.x < -60 || s.x > 780 || s.y < 90 || s.y > 1340) { p.dead = true; continue; }
      for (const e of this.enemies) {
        if (e.dead || p.hit.has(e)) continue;
        const dx = e.spr.x - s.x, dy = e.spr.y - s.y, rr = e.r + 14;
        if (dx * dx + dy * dy < rr * rr) {
          p.hit.add(e);
          this.hitEnemy(e, p.dmg, p.vx / 520, p.vy / 520, 10);
          this.burst(s.x, s.y, 0xff8a2a, 3);
          if (p.pierce <= 0) { p.dead = true; break; }
          p.pierce--;
        }
      }
    }
    if (this.projs.some(p => p.dead)) {
      this.projs = this.projs.filter(p => { if (p.dead) p.spr.destroy(); return !p.dead; });
    }

    // enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      const s = e.spr;
      let dx = cat.x - s.x, dy = cat.y - s.y;
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const slowK = (auraR && d < auraR + e.r) ? 0.7 : 1;
      const sp = e.spd * slowK;
      if (e.flash > 0) { e.flash -= dt; if (e.flash <= 0) this.restoreTint(e); }
      if (e.orbCd > 0) e.orbCd -= dt;
      if (e.type === 'dasher') {
        e.stT -= dt;
        if (e.st === 0) {
          s.x += dx * sp * dt; s.y += dy * sp * dt;
          if (e.stT <= 0) { e.st = 1; e.stT = 0.4; }
        } else if (e.st === 1) {
          if (e.flash <= 0) s.setTint(Math.sin(this.t * 40) > 0 ? 0xff2030 : 0xff9090);
          if (e.stT <= 0) { e.st = 2; e.stT = 0.5; e.dvx = dx; e.dvy = dy; this.restoreTint(e); }
        } else {
          const v = 360 * this.spdMul * slowK;
          s.x += e.dvx * v * dt; s.y += e.dvy * v * dt;
          if (Math.random() < 0.35) this.burst(s.x, s.y, 0xff6fd8, 1);
          if (e.stT <= 0) { e.st = 0; e.stT = 2.1; }
        }
      } else { s.x += dx * sp * dt; s.y += dy * sp * dt; }
      if (!e.D.boss) s.angle = Math.sin(this.t * 14 + e.ph) * 7;
      s.setFlipX(dx < 0);
      if (d < e.r + 28) {
        this.hurtCat(e.dmg);
        const push = e.D.boss ? 12 : 40;
        s.x -= dx * push; s.y -= dy * push;
      }
    }

    // meteors
    for (const m of this.meteors) {
      if (m.dead) continue;
      m.t += dt;
      const f = Math.max(0, m.t / 0.4);
      m.spr.setPosition(m.tx + 140 * (1 - f), m.ty - 560 * (1 - f));
      if (f >= 1) { m.dead = true; m.spr.destroy(); this.explodeMeteor(m.tx, m.ty); }
    }
    if (this.meteors.some(m => m.dead)) this.meteors = this.meteors.filter(m => !m.dead);

    // pickups
    const mag = this.st.mag;
    for (const p of this.picks) {
      if (p.dead) continue;
      const s = p.spr, dx = cat.x - s.x, dy = cat.y - s.y, d = Math.hypot(dx, dy) || 1;
      if (!p.mag) { if (d < mag) p.mag = true; else continue; }
      p.sp = Math.min(900, p.sp + 1200 * dt);
      const v = Math.max(600, p.sp) * dt;
      if (d < 26 || v >= d) {
        p.dead = true; s.destroy();
        if (p.kind === 'xp') this.gainXp(p.v);
        else {
          this.coins += p.v;
          try { UI.fly(this, 'coin', cat.x, cat.y, 590, 75, 1); } catch (e) {}
          this.tweens.add({targets:this.coinIcon, scale:{from:0.6, to:0.45}, duration:200});
        }
        if (this.paused) break;
      } else { s.x += dx / d * v; s.y += dy / d * v; }
    }
    if (this.picks.some(p => p.dead)) this.picks = this.picks.filter(p => !p.dead);

    if (this.anyDead || this.enemies.some(e => e.dead)) this.enemies = this.enemies.filter(e => !e.dead);

    this.updateHud();

    if (!this.ended && !this.reviving && this.kingSpawned && this.t >= this.dur && !this.kingAlive()) this.finish(true);
  }
};