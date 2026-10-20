import { BLOCK, ROAD, GRID, inCity } from "./world";

// GPS: shortest path over the street crossings (breadth-first search on the grid, all edges equal length)
const N = GRID + 1;
const prev = new Int16Array(N * N);
const queue = new Int16Array(N * N);
export const MAX_ROUTE = N * N + 2;

const nodeOf = (x: number, y: number) => {
  const i = Math.max(0, Math.min(GRID, Math.round((x - ROAD / 2) / BLOCK)));
  const j = Math.max(0, Math.min(GRID, Math.round((y - ROAD / 2) / BLOCK)));
  return j * N + i;
};

// writes x,y pairs into out (from -> ... -> to) and returns the number of points
export function findRoute(fx: number, fy: number, tx: number, ty: number, out: Float32Array): number {
  let n = 0;
  const push = (x: number, y: number) => { if (n < MAX_ROUTE) { out[n * 2] = x; out[n * 2 + 1] = y; n++; } };
  push(fx, fy);
  if (!inCity(fx, fy) && !inCity(tx, ty)) { push(tx, ty); return n; }
  const a = nodeOf(fx, fy), b = nodeOf(tx, ty);
  prev.fill(-1);
  let head = 0, tail = 0;
  queue[tail++] = a; prev[a] = a;
  while (head < tail) {
    const c = queue[head++];
    if (c === b) break;
    const ci = c % N, cj = (c / N) | 0;
    for (let k = 0; k < 4; k++) {
      const ni = ci + (k === 0 ? 1 : k === 1 ? -1 : 0), nj = cj + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (ni < 0 || nj < 0 || ni > GRID || nj > GRID) continue;
      const id = nj * N + ni;
      if (prev[id] !== -1) continue;
      prev[id] = c; queue[tail++] = id;
    }
  }
  // walk back from b to a, then write the nodes in order
  const path = queue; let len = 0;
  for (let c = b; ; c = prev[c]) { path[len++] = c; if (c === a || prev[c] === -1 || len >= N * N) break; }
  for (let k = len - 1; k >= 0; k--) { const id = path[k]; push((id % N) * BLOCK + ROAD / 2, ((id / N) | 0) * BLOCK + ROAD / 2); }
  push(tx, ty);
  return n;
}
