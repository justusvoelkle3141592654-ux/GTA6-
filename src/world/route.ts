import { BLOCK, ROAD, GRID, inCity, cityDist } from "./terrain";
import type { RoadNet } from "./roads";

// street graph: the crossings of the city grid plus points along the highways (bridges and the tunnel included);
// shortest paths (GPS, police) with Dijkstra
const N = GRID + 1;
const ROAD_EVERY = 10; // a graph node every 10 highway points (200 units)

let nx: Float32Array, ny: Float32Array, adj: number[][] = [], built: RoadNet | null = null;
export let MAX_ROUTE = 1024;

function build(net: RoadNet) {
  const X: number[] = [], Y: number[] = [];
  adj = [];
  const add = (x: number, y: number) => { X.push(x); Y.push(y); adj.push([]); return X.length - 1; };
  const link = (a: number, b: number) => { adj[a].push(b); adj[b].push(a); };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) add(i * BLOCK + ROAD / 2, j * BLOCK + ROAD / 2);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const id = j * N + i; if (i < GRID) link(id, id + 1); if (j < GRID) link(id, id + N); }
  for (const r of net.roads) {
    let prev = r.node.j * N + r.node.i;
    for (let p = ROAD_EVERY; p < r.n; p += ROAD_EVERY) { const id = add(r.pts[p * 2], r.pts[p * 2 + 1]); link(prev, id); prev = id; }
    if ((r.n - 1) % ROAD_EVERY) { const id = add(r.pts[(r.n - 1) * 2], r.pts[(r.n - 1) * 2 + 1]); link(prev, id); }
  }
  nx = new Float32Array(X); ny = new Float32Array(Y);
  MAX_ROUTE = X.length + 2;
  built = net;
}

function nearestNode(net: RoadNet, x: number, y: number): number {
  if (inCity(x, y) || cityDist(x, y) < 150) {
    const i = Math.max(0, Math.min(GRID, Math.round((x - ROAD / 2) / BLOCK)));
    const j = Math.max(0, Math.min(GRID, Math.round((y - ROAD / 2) / BLOCK)));
    return j * N + i;
  }
  let best = 0, bd = Infinity;
  for (let k = 0; k < nx.length; k++) { const d = (nx[k] - x) ** 2 + (ny[k] - y) ** 2; if (d < bd) { bd = d; best = k; } }
  void net;
  return best;
}

let dist = new Float32Array(0), prev = new Int32Array(0), heap = new Int32Array(0);
// writes x,y pairs into out (from -> ... -> to) and returns the number of points
export function findRoute(net: RoadNet, fx: number, fy: number, tx: number, ty: number, out: Float32Array): number {
  if (built !== net) build(net);
  let n = 0;
  const cap = out.length / 2;
  const push = (x: number, y: number) => { if (n < cap) { out[n * 2] = x; out[n * 2 + 1] = y; n++; } };
  push(fx, fy);
  const a = nearestNode(net, fx, fy), b = nearestNode(net, tx, ty);
  const V = nx.length;
  if (dist.length !== V) { dist = new Float32Array(V); prev = new Int32Array(V); heap = new Int32Array(V * 4); }
  dist.fill(Infinity); prev.fill(-1);
  dist[a] = 0;
  // binary heap of node ids (lazy deletion)
  let hs = 0;
  const hpush = (v: number) => {
    let i = hs++; heap[i] = v;
    while (i > 0) { const p = (i - 1) >> 1; if (dist[heap[p]] <= dist[heap[i]]) break; const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; }
  };
  const hpop = () => {
    const top = heap[0]; heap[0] = heap[--hs];
    let i = 0;
    for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < hs && dist[heap[l]] < dist[heap[m]]) m = l; if (r < hs && dist[heap[r]] < dist[heap[m]]) m = r; if (m === i) break; const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m; }
    return top;
  };
  hpush(a);
  while (hs > 0) {
    const c = hpop();
    if (c === b) break;
    for (const o of adj[c]) {
      const d = dist[c] + Math.hypot(nx[o] - nx[c], ny[o] - ny[c]);
      if (d < dist[o]) { dist[o] = d; prev[o] = c; if (hs < heap.length) hpush(o); }
    }
  }
  // walk back from b to a, then write the nodes in order
  const path: number[] = [];
  for (let c = b; c >= 0 && path.length < V; c = prev[c]) { path.push(c); if (c === a) break; }
  if (path[path.length - 1] === a) for (let k = path.length - 1; k >= 0; k--) push(nx[path[k]], ny[path[k]]);
  push(tx, ty);
  return n;
}
