// Магазин: тематические наборы (перекраска скафандра/марсохода/базы), стили планеты, креатив-режим, витрина.
// Данные — game.json monetization.{iap, themes, styles, soon}. Любая покупка отключает межстраничную рекламу.
import * as THREE from 'three';
import { rigWheels } from './vehicle.js';

// Цвета базовой палитры построек (build.js PAL) → ключ темы
const MAP = { e8e2d6: 'hull', d9cfbd: 'hull', d9d1c2: 'hull', f08a3c: 'trim', '9b3a22': 'stripe', c9563a: 'roof' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class Shop {
  constructor(g) {
    this.g = g; this.M = g.cfg.monetization; this.cache = new Map(); this.t = 0;
    const S = g.state; S.theme ??= 'default'; S.style ??= 'classic'; S.creativeOn ??= false;
  }
  owned(id) { return !!this.g.state.flags['bought_' + id]; }
  hasTheme(id) { return id === 'default' || !!this.g.state.flags['theme_' + id]; }
  hasStyle(id) { return id === 'classic' || !!this.g.state.flags['style_' + id]; }
  get creativeOwned() { return !!this.g.state.flags.creative; }

  // ---------- Применение ----------
  applyAll() { this.applyStyle(); this.applyCreative(); this.retheme(true); }
  setTheme(id) { if (!this.hasTheme(id)) return; this.g.state.theme = id; this.retheme(true); this.g.save(); }
  setStyle(id) { if (!this.hasStyle(id)) return; this.g.state.style = id; this.applyStyle(); this.g.save(); }
  setCreative(on) { if (!this.creativeOwned) return; this.g.state.creativeOn = !!on; this.applyCreative(); this.g.save(); this.g.ui.toast(on ? 'Креатив включён' : 'Креатив выключен', on ? 'rar-legend' : ''); }
  applyStyle() {
    const id = this.g.state.style, st = this.M.styles?.[id], S = id === 'classic' || !st?.ground ? null : st;
    this.g.world.setStyle(S);
    // Камни и растения: общий материал запечённой модели × цвет стиля (vertex-color остаётся — меняется оттенок)
    const groups = { rock: ['boulder', 'rocks', 'res_iron', 'res_silicon', 'res_magnetite'], flora: ['bush', 'bush_berry', 'lichen', 'grass', 'tree', 'succulent', 'reed', 'flowers', 'mushroom_tree'] };
    for (const [k, ids] of Object.entries(groups)) for (const mid of ids) { const B = this.g.models.baked[mid]; if (!B) continue; const m = B.parts[0]?.mat; if (!m?.vertexColors) continue; m.color.set(S?.[k] || '#ffffff'); }
  }
  applyCreative() { const on = this.creativeOwned && this.g.state.creativeOn; this.g.creative = on; this.g.player.creativeJet = on; }

  // Перекраска: материал клонируется один раз на (материал, тема), оригинал хранится в userData
  tint(mat, col, key) {
    const k = mat.uuid + key; let m = this.cache.get(k);
    if (!m) { m = mat.clone(); m.color = new THREE.Color(col); if (key.endsWith('glow') && m.emissive) { m.emissive = new THREE.Color(col); m.emissiveIntensity = 0.5; } this.cache.set(k, m); }
    return m;
  }
  paint(obj, fn) {
    obj.traverse(o => { if (!o.isMesh || o.name === 'outline' || !o.material || Array.isArray(o.material)) return;
      const orig = o.userData.mat0 ??= o.material; const r = fn(orig); o.material = r || orig; });
  }
  // Объект персонажа/машины: текстура перекрашивается по яркости (тёплая база не даёт «грязных» оттенков при умножении)
  paintSkin(obj, col, key) { this.paint(obj, m => (col && m.map && m.color) ? this.recolor(m, col, key) : null); }
  recolor(mat, col, key) {
    const k = mat.uuid + key; let m = this.cache.get(k); if (m) return m;
    m = mat.clone(); const u = { value: new THREE.Color(col) };
    m.onBeforeCompile = sh => { sh.uniforms.uTint = u; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uTint;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n{ float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); vec3 t = uTint * smoothstep(0.0, 0.9, l) * 1.25 + vec3(0.06) * step(0.85, l); diffuseColor.rgb = mix(diffuseColor.rgb, t, 0.88); }'); };
    m.customProgramCacheKey = () => 'tint' + col;   // свой ключ на цвет: иначе three переиспользует программу без onBeforeCompile
    this.cache.set(k, m); return m;
  }
  // Постройки: по цвету базовой палитры
  paintBuild(obj, T, key) {
    this.paint(obj, m => { if (!T || !m.color || m.transparent) return null; const slot = MAP[m.color.getHexString()]; return slot && T[slot] ? this.tint(m, T[slot], key + slot) : null; });
  }
  retheme(force) {
    const g = this.g, id = g.state.theme, T = id === 'default' ? null : this.M.themes?.[id];
    const mark = o => { if (!o) return false; if (!force && o.userData.theme === id) return false; o.userData.theme = id; return true; };
    // скафандр и марсоход шейдером НЕ перекрашиваем (выглядит плохо) — только готовые модели наборов
    const B = g.builder; if (!B) return;
    for (const D of B.domes || []) if (mark(D.obj)) this.paintBuild(D.obj, T, id);
    for (const o of B.mobjs?.values() || []) if (mark(o)) this.paintBuild(o, T, id);
    for (const o of B.objs?.values() || []) if (mark(o)) this.paintBuild(o, T, id);
  }
  // Премиальная модель марсохода из набора: меняем содержимое V.obj (физика и позиция остаются), колёса — заново
  swapRover(V, mid) {
    const g = this.g, want = mid && g.models.protos[mid] ? mid : 'rover';
    if ((V.modelId || 'rover') === want) return;
    const n = g.models.instance(want);
    for (const c of [...V.obj.children]) V.obj.remove(c);
    for (const c of [...n.children]) V.obj.add(c);
    V.modelId = want; V.wheels = null; V.obj.updateMatrixWorld(true);
    try { rigWheels(V); } catch (e) { (window.__qa?.errors || []).push('wheels: ' + e.message); }
  }
  update(dt) { this.t += dt; if (this.t > 0.7) { this.t = 0; this.retheme(false); } }

  // Выдача после покупки (вызывается из Game.buy)
  grant(p) {
    const g = this.g, G = p.grant || {};
    g.state.flags.no_ads = true;
    for (const b of G.bps || []) { (g.state.bps ??= {})[b] = 1; }
    if (G.theme) this.setTheme(G.theme);
    if (G.style) this.setStyle(G.style);
    if (G.creative) { g.state.creativeOn = true; this.applyCreative(); }
    if (G.skin) { (g.state.skins ??= {})[G.skin] = true; g.skins?.wear(G.skin); }   // сразу надеть купленный скафандр
    if (G.rover && G.bps?.length) { const rec = g.cfg.recipes.find(r => r.vehicle && G.bps.includes(r.needs_bp)); if (rec) g.spawnVehicleNear(rec.id, G.rover); }   // марсоход — перед игроком
  }

  // ---------- Витрина ----------
  render(ui) {
    const g = this.g, body = ui.el('pbody'), list = this.M.iap.filter(p => !p.life || g.life?.L.started);
    body.classList.add('shopv');
    if (ui.storeSel) return this.renderItem(ui, list.find(p => p.id === ui.storeSel));
    const by = k => list.filter(p => p.kind === k);
    const hero = by('bundle').find(p => !this.owned(p.id)) || by('bundle')[0];
    let h = `<div class="sh-ads">${this.g.state.flags.no_ads ? 'Реклама отключена — спасибо за поддержку!' : 'Любая покупка отключает рекламу навсегда'}</div>`;
    if (hero) h += this.heroHtml(hero);
    h += `<div class="sh-h">Тематические наборы<small>марсоход · скафандр · база</small></div><div class="sh-grid">${by('bundle').map(p => this.cardHtml(p)).join('')}${this.soonCard(this.M.soon?.[1])}</div>`;
    h += `<div class="sh-h">Стили планеты<small>грунт · вода и зелень · небо · ночь</small></div><div class="sh-grid">${this.styleCard({ id: 'classic', title: this.M.styles?.classic?.name || 'Красная планета', img: this.M.styles?.classic?.img, kind: 'style', accent: '#f58a3c' })}${by('style').map(p => this.styleCard(p)).join('')}</div>`;
    const cr = by('creative')[0]; if (cr) h += this.creativeHtml(cr);
    const loc = this.M.soon?.[0]; if (loc) h += `<div class="sh-h">Новые локации</div><div class="sh-card sh-wide soon"><div class="pic"><img src="${loc.img}" alt=""><b class="sh-tag" style="background:#b78cff">СКОРО</b></div><div class="cnt"><b>${esc(loc.title)}</b><span>${esc(loc.desc)}</span></div></div>`;
    const ex = [...by('extra'), ...by('life')]; if (ex.length) h += `<div class="sh-h">Прочее</div>` + ex.map(p => `<div class="row"><div class="rname">${esc(p.title)}<span class="desc">${esc(p.desc)}</span></div><button class="btn small buy" id="b_iap_${p.id}" data-buy="${p.id}" ${p.once && this.owned(p.id) ? 'disabled' : ''}>${p.once && this.owned(p.id) ? '✓' : esc(p.price)}</button></div>`).join('');
    body.innerHTML = h; this.bind(ui, body);
  }
  itemsHtml(p) { return (p.items || []).map(([i, n, d]) => `<div class="sh-it"><i class="sh-i sh-${i}"></i><div><b>${esc(n)}</b><small>${esc(d)}</small></div></div>`).join(''); }
  buyBtn(p, big) {
    if (this.owned(p.id)) {
      if (p.grant?.theme) { const on = this.g.state.theme === p.grant.theme; return `<button class="btn ${big ? '' : 'small'} ${on ? 'ok' : 'sec'}" data-theme="${on ? 'default' : p.grant.theme}">${on ? '✓ Надето · снять' : 'Надеть'}</button>`; }
      return `<button class="btn ${big ? '' : 'small'} ok" disabled>✓ Куплено</button>`;
    }
    return `<button class="btn ${big ? 'sh-buy' : 'small buy'}" ${big ? `id="b_iap_${p.id}"` : ''} data-buy="${p.id}">${big ? 'Купить · ' : ''}${esc(p.price)}</button>`;
  }
  heroHtml(p) {
    return `<div class="sh-hero" data-open="${p.id}" style="--ac:${p.accent}"><div class="pic"><img src="${p.img}" alt="">${p.badge ? `<b class="sh-rib">${esc(p.badge)}</b>` : ''}</div>
      <div class="info"><h3>${esc(p.title)}</h3><p>${esc(p.sub)}</p><div class="sh-its">${this.itemsHtml(p)}</div>
      ${p.was && !this.owned(p.id) ? `<div class="sh-save">По отдельности <s>${esc(p.was)}</s> → в наборе <b>${esc(p.price)}</b></div>` : ''}${this.buyBtn(p, true)}</div></div>`;
  }
  cardHtml(p) {
    return `<div class="sh-card" data-open="${p.id}" style="--ac:${p.accent}"><div class="pic"><img src="${p.img}" alt="">${p.badge ? `<b class="sh-tag">${esc(p.badge)}</b>` : ''}</div>
      <div class="cnt"><b>${esc(p.title)}</b><span>${(p.items || []).length} предмета · ${esc(p.sub)}</span><div class="sh-row">${this.buyBtn(p)}</div></div></div>`;
  }
  styleCard(p) {
    const sid = p.grant?.style || p.id, st = this.M.styles?.[sid] || {}, cur = this.g.state.style === sid, own = this.hasStyle(sid);
    const sw = st.ground ? [st.ground[0], st.lush, st.sky_live?.[1] || st.sky[1], st.night?.[0]] : ['#b8552f', '#5cd6a8', '#f3b38a', '#1d2340'];
    const btn = own ? `<button class="btn small ${cur ? 'ok' : 'sec'}" data-style="${sid}" ${cur ? 'disabled' : ''}>${cur ? '✓ Выбран' : 'Включить'}</button>` : `<button class="btn small buy" id="b_iap_${p.id}" data-buy="${p.id}">${esc(p.price)}</button>`;
    return `<div class="sh-card" ${p.price ? `data-open="${p.id}"` : ''} style="--ac:${p.accent}"><div class="pic"><img src="${p.img || st.img}" alt=""></div>
      <div class="cnt"><b>${esc(p.title)}</b><div class="sh-sw">${sw.map((c, i) => `<i style="background:${c}" title="${['грунт', 'зелень', 'небо', 'ночь'][i]}"></i>`).join('')}</div><div class="sh-row">${btn}</div></div></div>`;
  }
  soonCard(s) { return s ? `<div class="sh-card soon"><div class="pic sh-q">?</div><div class="cnt"><b>${esc(s.title)}</b><span>${esc(s.desc)}</span></div></div>` : ''; }
  creativeHtml(p) {
    const own = this.creativeOwned, on = own && this.g.state.creativeOn;
    return `<div class="sh-h">Креатив-режим</div><div class="sh-cre"><div class="pic"><img src="${p.img}" alt=""></div><div class="info"><div class="sh-its one">${this.itemsHtml(p)}</div>
      ${own ? `<button class="btn ${on ? 'ok' : 'sec'}" data-creative="${on ? 0 : 1}">${on ? 'Креатив включён · выключить' : 'Включить креатив'}</button><small>Постройки остаются. Переключатель есть и в настройках.</small>` : this.buyBtn(p, true)}</div></div>`;
  }
  renderItem(ui, p) {
    const body = ui.el('pbody'); if (!p) { ui.storeSel = null; return this.render(ui); }
    let extra = '';
    if (p.kind === 'style') { const st = this.M.styles[p.grant.style]; extra = `<div class="sh-its one">${[['ground', 'Грунт и скалы'], ['lush', 'Зелень после терраформации'], ['water', 'Вода'], ['sky', 'Небо днём'], ['night', 'Ночное небо']].map(([k, n]) => `<div class="sh-it"><i class="sh-i" style="background:${[].concat(st[k])[0]}"></i><div><b>${n}</b></div></div>`).join('')}</div>`; }
    body.innerHTML = `<button class="btn small sec sh-back" data-back="1">‹ Назад</button><div class="sh-det" style="--ac:${p.accent}"><div class="pic"><img src="${p.img}" alt=""></div>
      <h3>${esc(p.title)}</h3><p>${esc(p.sub || p.desc)}</p><div class="sh-its one">${this.itemsHtml(p)}</div>${extra}
      ${p.was && !this.owned(p.id) ? `<div class="sh-save">По отдельности <s>${esc(p.was)}</s> → в наборе <b>${esc(p.price)}</b></div>` : ''}
      <div class="sh-ads">${this.g.state.flags.no_ads ? 'Реклама уже отключена' : 'Покупка отключает рекламу навсегда'}</div>${p.kind === 'creative' && this.creativeOwned ? this.creativeHtml(p) : this.buyBtn(p, true)}</div>`;
    body.scrollTop = 0; this.bind(ui, body);
  }
  bind(ui, body) {
    const g = this.g, re = () => this.render(ui);
    const on = (sel, fn) => body.querySelectorAll(sel).forEach(b => b.onpointerdown = async e => { e.stopPropagation(); if (b.disabled) return; await fn(b); });
    on('[data-buy]', async b => { if (await g.buy(b.dataset.buy)) re(); });
    on('[data-theme]', b => { this.setTheme(b.dataset.theme); re(); });
    on('[data-style]', b => { this.setStyle(b.dataset.style); re(); });
    on('[data-creative]', b => { this.setCreative(b.dataset.creative === '1'); re(); });
    on('[data-back]', () => { ui.storeSel = null; re(); });
    on('[data-open]', b => { ui.storeSel = b.dataset.open; re(); });
  }
}
