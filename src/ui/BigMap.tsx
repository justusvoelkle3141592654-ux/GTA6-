import { useEffect, useRef, useState } from "react";
import type { Game } from "../core/engine";
import { MAP_MIN, MAP_SIZE } from "../world/world";
import { DISTRICTS, STREETS, districtLabels } from "../world/districts";
import { drawPlaceIcon, WALKABLE } from "../world/places";
import Icon from "./icons";
import { PAL, tone } from "./palette";
import { Toast } from "./ui";

type Filter = "shops" | "jobs" | "missions" | "collect" | "ramps";
const FILTERS: [Filter, string][] = [["shops", "Läden"], ["jobs", "Jobs"], ["missions", "Missionen"], ["collect", "Sammelobjekte"], ["ramps", "Rampen"]];

type Sel = { kind: "marker"; id: number } | { kind: "place"; id: string } | null;

// the whole map: districts, street names, places, goals; zoom (wheel, pinch, buttons) and pan (drag, buttons);
// a click / tap without dragging sets a marker (or picks the place / marker under it); for the picked one:
// GPS route, fly there, jump there, delete. onTravel: the menu closes when a trip starts
export default function BigMap({ game, onChange, onTravel }: { game: Game; onChange: () => void; onTravel?: () => void }) {
  const [sel, setSel] = useState<Sel>(null);
  const [msg, setMsg] = useState("");
  const ref = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState(() => ({ x: MAP_MIN + MAP_SIZE / 2, y: MAP_MIN + MAP_SIZE / 2 }));
  const [filters, setFilters] = useState<Record<Filter, boolean>>({ shops: true, jobs: true, missions: true, collect: false, ramps: false });
  const span = (MAP_SIZE * 0.5) / zoom; // world units across the canvas
  const x0 = center.x - span / 2, y0 = center.y - span / 2;
  const toCanvas = (x: number, y: number, S: number) => ({ x: ((x - x0) / span) * S, y: ((y - y0) / span) * S });
  const clampC = (c: { x: number; y: number }, z = zoom) => { const h = (MAP_SIZE * 0.5) / z / 2, lo = MAP_MIN + MAP_SIZE * 0.1 + h * 0.2, hi = MAP_MIN + MAP_SIZE * 0.9 - h * 0.2; return { x: Math.max(lo, Math.min(hi, c.x)), y: Math.max(lo, Math.min(hi, c.y)) }; };

  const draw = () => {
    const c = ref.current;
    if (!c) return;
    const S = c.width, g = c.getContext("2d")!;
    const img = game.minimap, W = img.width, k = W / MAP_SIZE;
    g.fillStyle = "#2c4a63"; g.fillRect(0, 0, S, S);
    g.imageSmoothingEnabled = zoom < 3;
    g.drawImage(img, (x0 - MAP_MIN) * k, (y0 - MAP_MIN) * k, span * k, span * k, 0, 0, S, S);
    g.textAlign = "center"; g.textBaseline = "middle";
    // district names
    g.font = `bold ${Math.round(S / 34)}px 'Bebas Neue', Impact, sans-serif`;
    for (const l of districtLabels()) {
      const p = toCanvas(l.x, l.y, S), d = DISTRICTS[l.id];
      g.letterSpacing = `${Math.round(S / 220)}px`;
      g.fillStyle = "rgba(7,9,12,0.6)"; g.fillText(d.name.toUpperCase(), p.x + 1.5, p.y + 1.5);
      g.fillStyle = "rgba(238,241,244,0.9)"; g.fillText(d.name.toUpperCase(), p.x, p.y);
      g.fillStyle = tone(d.color); g.fillRect(p.x - S / 60, p.y + S / 62, S / 30, 2); // a short line in the district colour
      g.letterSpacing = "0px";
    }
    // street names along the main roads
    g.font = `600 ${Math.round(S / 62)}px Inter, sans-serif`;
    for (const st of STREETS) {
      const a = toCanvas(st.x0, st.y0, S), b = toCanvas(st.x1, st.y1, S), len = Math.hypot(b.x - a.x, b.y - a.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x), n = Math.max(1, Math.floor(len / (S * 0.45)));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        if (x < 0 || y < 0 || x > S || y > S) continue;
        g.save(); g.translate(x, y); g.rotate(Math.abs(ang) > Math.PI / 2 ? ang + Math.PI : ang);
        g.lineWidth = 3; g.strokeStyle = "rgba(7,9,12,0.85)"; g.strokeText(st.name, 0, 0); g.fillStyle = PAL.fog3; g.fillText(st.name, 0, 0);
        g.restore();
      }
    }
    g.font = `bold ${Math.round(S / 60)}px Inter, sans-serif`;
    const r = (S / 70) * Math.min(1.6, 0.8 + zoom * 0.2);
    if (filters.ramps) for (const rp of game.world.ramps) { const p = toCanvas(rp.x0, rp.y0, S); g.fillStyle = rp.jump ? PAL.sun3 : PAL.fog3; g.fillRect(p.x - 2, p.y - 2, 4, 4); }
    if (filters.collect) {
      const pr = game.progress;
      for (const sh of game.jobs.shells) { if (pr.shells.includes(sh.id)) continue; const p = toCanvas(sh.x, sh.y, S); g.fillStyle = "#f5e6c8"; g.beginPath(); g.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2); g.fill(); }
      for (const j of game.jobs.jumps) { if (pr.jumps.includes(j.id)) continue; const p = toCanvas(j.x, j.y, S); g.strokeStyle = PAL.sun3; g.lineWidth = 2; g.strokeRect(p.x - r * 0.5, p.y - r * 0.5, r, r); }
    }
    for (const pl of game.places) {
      const isJob = pl.kind === "job", isShop = WALKABLE.has(pl.id);
      if ((isJob && !filters.jobs) || (isShop && !filters.shops) || (pl.kind === "contact" && !filters.missions)) continue;
      const p = toCanvas(pl.x, pl.y, S);
      drawPlaceIcon(g, pl, p.x, p.y, r);
      if (zoom >= 2.5) { g.fillStyle = PAL.fog; g.font = `600 ${Math.round(S / 70)}px Inter, sans-serif`; g.fillText(pl.name, p.x, p.y + r + 9); g.font = `bold ${Math.round(S / 60)}px Inter, sans-serif`; }
    }
    // goals
    if (filters.missions) for (const list of [game.missions.markers, game.jobs.markers]) for (const mk of list) {
      const p = toCanvas(mk.x, mk.y, S);
      g.strokeStyle = "rgba(7,9,12,0.8)"; g.lineWidth = 5; g.beginPath(); g.arc(p.x, p.y, S / 55, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = tone(mk.color); g.lineWidth = 3; g.stroke();
      if (mk.label) { g.fillStyle = tone(mk.color); g.fillText(mk.label, p.x, p.y + 1); }
    }
    // own markers (a pin with its number), the picked one bigger
    g.font = `bold ${Math.round(S / 64)}px Inter, sans-serif`;
    for (const mk of game.markers) {
      const p = toCanvas(mk.x, mk.y, S), big = sel?.kind === "marker" && sel.id === mk.id, rr = big ? 13 : 10;
      g.fillStyle = big ? PAL.sun3 : PAL.cop4; g.strokeStyle = "rgba(0,0,0,0.75)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - rr * 0.7, p.y - rr * 1.2); g.arc(p.x, p.y - rr * 1.5, rr * 0.8, Math.PI * 0.8, Math.PI * 0.2); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = PAL.ink; g.fillText(String(mk.id), p.x, p.y - rr * 1.5);
    }
    if (sel?.kind === "place") {
      const pl = game.places.find((q) => q.id === sel.id);
      if (pl) { const p = toCanvas(pl.x, pl.y, S); g.strokeStyle = PAL.sun3; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, r * 1.6, 0, Math.PI * 2); g.stroke(); }
    }
    g.font = `bold ${Math.round(S / 60)}px Inter, sans-serif`;
    // waypoint and player
    if (game.waypoint) {
      const p = toCanvas(game.waypoint.x, game.waypoint.y, S);
      g.strokeStyle = PAL.sun; g.lineWidth = 4; g.beginPath(); g.moveTo(p.x - 9, p.y - 9); g.lineTo(p.x + 9, p.y + 9); g.moveTo(p.x + 9, p.y - 9); g.lineTo(p.x - 9, p.y + 9); g.stroke();
    }
    const me = toCanvas(game.fx, game.fy, S);
    g.save(); g.translate(me.x, me.y); g.rotate(game.fa);
    g.fillStyle = PAL.fog; g.strokeStyle = PAL.ink; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(12, 0); g.lineTo(-8, -8); g.lineTo(-3, 0); g.lineTo(-8, 8); g.closePath(); g.fill(); g.stroke();
    g.restore();
  };
  useEffect(() => { draw(); });

  // ---- input: drag pans, wheel / pinch zooms, a tap sets the waypoint
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef({ moved: 0, pinch: 0 });
  const worldAt = (cx: number, cy: number) => { const c = ref.current!, rc = c.getBoundingClientRect(); return { x: x0 + ((cx - rc.left) / rc.width) * span, y: y0 + ((cy - rc.top) / rc.height) * span }; };
  const zoomTo = (z: number, about?: { x: number; y: number }) => {
    const nz = Math.max(1, Math.min(6, z));
    if (about) { const f = zoom / nz; setCenter(clampC({ x: about.x + (center.x - about.x) * f, y: about.y + (center.y - about.y) * f }, nz)); }
    else setCenter((c) => clampC(c, nz));
    setZoom(nz);
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current.moved = 0;
    if (pts.current.size === 2) { const [a, b] = [...pts.current.values()]; drag.current.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pts.current.get(e.pointerId);
    if (!p) return;
    const c = ref.current!, rc = c.getBoundingClientRect();
    if (pts.current.size === 2) {
      pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pts.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (drag.current.pinch > 0) zoomTo(zoom * (d / drag.current.pinch), worldAt((a.x + b.x) / 2, (a.y + b.y) / 2));
      drag.current.pinch = d; drag.current.moved = 99;
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    drag.current.moved += Math.abs(dx) + Math.abs(dy);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (drag.current.moved > 6) setCenter((cc) => clampC({ x: cc.x - (dx / rc.width) * span, y: cc.y - (dy / rc.height) * span }));
  };
  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasTap = pts.current.size === 1 && drag.current.moved <= 6;
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) drag.current.pinch = 0;
    if (!wasTap) return;
    const w = worldAt(e.clientX, e.clientY);
    // what is under the finger: a marker, a place, else a new marker
    const c = ref.current!, px = (span / c.getBoundingClientRect().width) * 16; // 16 screen pixels in world units
    const mk = game.markers.find((m) => Math.hypot(m.x - w.x, m.y - w.y + px * 0.8) < px * 1.2);
    const pl = mk ? null : game.places.find((q) => Math.hypot(q.x - w.x, q.y - w.y) < px && (filters.shops || !WALKABLE.has(q.id)) && (filters.jobs || q.kind !== "job"));
    if (mk) setSel({ kind: "marker", id: mk.id });
    else if (pl) setSel({ kind: "place", id: pl.id });
    else { const m = game.addMarker(w.x, w.y); setSel({ kind: "marker", id: m.id }); }
    setMsg("");
    draw(); onChange();
  };
  // the picked marker / place and what you can do with it
  const picked = (() => {
    if (sel?.kind === "marker") { const m = game.markers.find((q) => q.id === sel.id); return m ? { name: m.name, x: m.x, y: m.y, marker: m.id } : null; }
    if (sel?.kind === "place") { const pl = game.places.find((q) => q.id === sel.id); return pl ? { name: pl.name, x: pl.x, y: pl.y, marker: 0 } : null; }
    return null;
  })();
  const go = (instant: boolean) => {
    if (!picked) return;
    const r = game.travelToPoint(picked.x, picked.y, picked.name, instant);
    if (r) { setMsg(r); return; }
    onTravel?.();
  };
  const dist = picked ? Math.hypot(picked.x - game.fx, picked.y - game.fy) / 10 : 0;
  const wheel = (e: React.WheelEvent<HTMLCanvasElement>) => zoomTo(zoom * (e.deltaY < 0 ? 1.25 : 0.8), worldAt(e.clientX, e.clientY));
  const pan = (dx: number, dy: number) => setCenter((c) => clampC({ x: c.x + dx * span * 0.25, y: c.y + dy * span * 0.25 }));
  const btn = "sb-icon-btn h-7 w-7 bg-ink-950/70 text-sm font-bold @lg:h-8 @lg:w-8 [@media(max-height:480px)]:h-7 [@media(max-height:480px)]:w-7";
  const panel = "flex min-w-0 flex-1 flex-col gap-2.5";

  // the map on the left, the picked place, filters and legend next to it (a narrow box like the phone: under it)
  return (
    <div className="@container">
      <div className="flex flex-col gap-3 @lg:flex-row @lg:items-start">
        <div className="relative mx-auto shrink-0 @lg:mx-0">
          <canvas ref={ref} width={720} height={720} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}
            className="block aspect-square w-[min(100cqw,calc(100dvh-7rem))] max-w-[34rem] cursor-crosshair touch-none rounded-[6px] border border-white/15 bg-[#2c4a63] @lg:w-[min(58cqw,calc(100dvh-7rem))]" aria-label="Karte von Solara Bay" />
          <div className="absolute right-2 top-2 flex flex-col gap-1">
            <button className={btn} onClick={() => zoomTo(zoom * 1.5)} aria-label="Hineinzoomen">+</button>
            <button className={btn} onClick={() => zoomTo(zoom / 1.5)} aria-label="Herauszoomen">−</button>
            <button className={btn} onClick={() => { setZoom(2.5); setCenter(clampC({ x: game.fx, y: game.fy }, 2.5)); }} aria-label="Auf mich zentrieren"><Icon name="map" size={15} /></button>
          </div>
          <div className="absolute bottom-2 right-2 hidden grid-cols-3 gap-1 [@media(min-height:481px)]:grid">{/* small screens: drag the map instead */}
            <span /><button className={btn} onClick={() => pan(0, -1)} aria-label="Nach Norden">↑</button><span />
            <button className={btn} onClick={() => pan(-1, 0)} aria-label="Nach Westen">←</button><span /><button className={btn} onClick={() => pan(1, 0)} aria-label="Nach Osten">→</button>
            <span /><button className={btn} onClick={() => pan(0, 1)} aria-label="Nach Süden">↓</button><span />
          </div>
        </div>
        <div className={panel}>
          {picked ? (
            <div className="sb-card is-active">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="sb-eyebrow">Auswahl</div>
                  <div className="truncate text-sm font-bold text-fog-100">{picked.name}</div>
                  <div className="sb-note">{dist >= 1000 ? (dist / 1000).toFixed(1).replace(".", ",") + " km" : Math.round(dist) + " m"} entfernt</div>
                </div>
                <button onClick={() => { setSel(null); setMsg(""); }} className="sb-btn sb-btn-ghost sb-btn-sm px-2" aria-label="Auswahl schließen"><Icon name="close" size={14} /></button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button onClick={() => { game.setWaypoint(picked.x, picked.y); setMsg("GPS-Route gesetzt"); draw(); onChange(); }} className="sb-btn sb-btn-sm sb-btn-primary">GPS-Route</button>
                <button onClick={() => go(false)} className="sb-btn sb-btn-sm">Hinfliegen</button>
                <button onClick={() => go(true)} className="sb-btn sb-btn-sm">Sofort hin</button>
                {picked.marker ? <button onClick={() => { game.removeMarker(picked.marker); setSel(null); draw(); onChange(); }} className="sb-btn sb-btn-sm sb-btn-danger">Löschen</button>
                  : <button onClick={() => { const m = game.addMarker(picked.x, picked.y); m.name = picked.name; setSel({ kind: "marker", id: m.id }); draw(); onChange(); }} className="sb-btn sb-btn-sm">Markieren</button>}
              </div>
              {msg && <Toast className="mt-2 text-xs">{msg}</Toast>}
            </div>
          ) : (
            <div className="sb-card sb-body">Tippe auf einen Ort, um ihn auszuwählen, oder auf eine freie Stelle für eine Markierung. Ziehen verschiebt, Mausrad oder zwei Finger zoomen.</div>
          )}
          {game.waypoint && <button onClick={() => { game.clearWaypoint(); draw(); onChange(); }} className="sb-btn sb-btn-sm self-start">GPS-Route beenden</button>}
          {game.markers.length > 0 && (
            <div>
              <div className="sb-eyebrow mb-1">Markierungen</div>
              <div className="flex flex-wrap gap-1.5">
                {game.markers.map((m) => (
                  <button key={m.id} onClick={() => { setSel({ kind: "marker", id: m.id }); setCenter(clampC({ x: m.x, y: m.y })); setMsg(""); }}
                    className={"sb-chip max-w-[11rem] truncate " + (sel?.kind === "marker" && sel.id === m.id ? "is-on" : "")}>{m.name}</button>
                ))}
                <button onClick={() => { game.clearMarkers(); setSel(null); draw(); onChange(); }} className="sb-chip">Alle löschen</button>
              </div>
            </div>
          )}
          <div>
            <div className="sb-eyebrow mb-1">Anzeigen</div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map(([f, l]) => (
                <button key={f} onClick={() => setFilters({ ...filters, [f]: !filters[f] })} aria-pressed={filters[f]} className={"sb-chip " + (filters[f] ? "is-on" : "")}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="sb-eyebrow mb-1">Legende</div>
            <div className="grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] text-fog-300 @sm:grid-cols-2">
              <span className="flex items-center gap-1.5"><span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-fog-300 bg-ink-850"><span className="h-1.5 w-1 bg-fog-100" /></span>Begehbarer Laden</span>
              <span className="flex items-center gap-1.5"><span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-sun-400 bg-ink-850 text-[7px] font-bold text-fog-100">X</span>Job-Punkt</span>
              <span className="flex items-center gap-1.5"><span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-fog-300 bg-ink-850 text-[7px] font-bold text-fog-100">L</span>Auftraggeber</span>
              <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full border-2 border-sun-400" />Ziel / GPS</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-2.5 rounded-t-full bg-cop-400" />Eigene Markierung</span>
              {filters.collect && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#f5e6c8]" />Muschel · <span className="h-2.5 w-2.5 border-2 border-sun-300" />Stuntsprung</span>}
              {filters.ramps && <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-sun-300" />Sprungrampe</span>}
            </div>
          </div>
          <div>
            <div className="sb-eyebrow mb-1">Läden</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fog-500">
              {game.places.filter((pl) => WALKABLE.has(pl.id)).map((pl) => <span key={pl.id} className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: pl.color }} />{pl.name}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
