// Детерминированный шум: 2D simplex + fbm. Без зависимостей.
export function makeNoise(seed = 1) {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = (seed * 2654435761) >>> 0;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  function simplex(x, y) {
    const s2 = (x + y) * F2, i = Math.floor(x + s2), j = Math.floor(y + s2);
    const t = (i + j) * G2, x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    const c = (tx, ty, gi) => { let tt = 0.5 - tx * tx - ty * ty; if (tt < 0) return 0; tt *= tt; const g = G[gi & 7]; return tt * tt * (g[0] * tx + g[1] * ty); };
    n += c(x0, y0, perm[ii + perm[jj]]);
    n += c(x1, y1, perm[ii + i1 + perm[jj + j1]]);
    n += c(x2, y2, perm[ii + 1 + perm[jj + 1]]);
    return 70 * n; // ~[-1,1]
  }
  function fbm(x, y, oct = 4) {
    let a = 1, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) { sum += a * simplex(x * f, y * f); norm += a; a *= 0.5; f *= 2; }
    return sum / norm;
  }
  return { simplex, fbm, rnd };
}

// Детерминированный ГПСЧ для расстановки
export function rng(seed) {
  let s = (seed * 9301 + 49297) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
