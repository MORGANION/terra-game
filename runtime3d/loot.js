// Лут с редкостью: бросок таблицы → список предметов, панель вскрытия (ящики, тела, ядра метеоритов, тайники).
import * as THREE from 'three';

export class Loot {
  constructor(game) { this.g = game; this.L = game.cfg.loot; this.byId = Object.fromEntries(this.L.rarity.map(r => [r.id, r])); }
  rarityOf(itemId) { return this.g.cfg.items[itemId]?.rarity || 'common'; }
  color(itemId) { return (this.byId[this.rarityOf(itemId)] || this.byId.common).color; }

  // Детерминированный бросок таблицы по seed (чтобы один и тот же ящик давал один и тот же лут)
  roll(table, seed = Math.floor(Math.random() * 1e9)) {
    let s = (seed * 2654435761) >>> 0; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const out = {};
    const add = (id, n) => { out[id] = (out[id] || 0) + n; };
    for (const id of table.guaranteed || []) add(id, 1);
    const [lo, hi] = table.rolls || [2, 3];
    const rolls = lo + Math.floor(rnd() * (hi - lo + 1));
    const total = table.entries.reduce((a, e) => a + e[3], 0);
    for (let r = 0; r < rolls; r++) {
      let t = rnd() * total;
      for (const [id, mn, mx, w] of table.entries) { t -= w; if (t <= 0) { add(id, mn + Math.floor(rnd() * (mx - mn + 1))); break; } }
    }
    // капы по слотам: лишнее режем
    return Object.entries(out).map(([id, n]) => ({ id, n }));
  }

  // Открыть контейнер: показать лут, игрок забирает (бэкпак учитывается; чертежи/особое — всегда)
  async open(src) {
    if (src.opened) return;
    const items = this.roll(src.table ? this.g.cfg.loot.tables[src.table] : src, src.seed);
    src.opened = true;
    if (src.obj) { const lid = src.obj.getObjectByName('lid'); if (lid) lid.rotation.x = -1.2; }
    await this.g.ui.lootPanel(src.name || this.g.cfg.texts.chest, items);
    this.g.qa.event('loot', { table: src.table, items: items.map(i => i.id) });
    if (src.respawn === false && src.obj) { src.obj.traverse(c => { if (c.material?.emissive) c.material.emissive.setHex(0); }); }
  }
}
