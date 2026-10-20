import { useEffect, useRef } from "react";
import type { Game } from "../game/engine";
import { MAP_MIN, MAP_SIZE } from "../game/world";
import { DISTRICTS, districtLabels } from "../game/districts";

// whole map with districts, places, goals; click / tap sets a waypoint
export default function BigMap({ game, onChange }: { game: Game; onChange: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const VIEW = 0.5; // show the middle half of the map (city plus nearby hills)

  const toCanvas = (x: number, y: number, S: number) => {
    const span = MAP_SIZE * VIEW, x0 = MAP_MIN + (MAP_SIZE - span) / 2;
    return { x: ((x - x0) / span) * S, y: ((y - x0) / span) * S };
  };

  const draw = () => {
    const c = ref.current;
    if (!c) return;
    const S = c.width, g = c.getContext("2d")!;
    const img = game.minimap, W = img.width;
    const src = W * VIEW, s0 = (W - src) / 2;
    g.clearRect(0, 0, S, S);
    g.drawImage(img, s0, s0, src, src, 0, 0, S, S);
    g.textAlign = "center"; g.textBaseline = "middle";
    // district names
    g.font = `bold ${Math.round(S / 40)}px 'Bebas Neue', Impact, sans-serif`;
    for (const l of districtLabels()) {
      const p = toCanvas(l.x, l.y, S), d = DISTRICTS[l.id];
      g.fillStyle = "rgba(0,0,0,0.55)"; g.fillText(d.name.toUpperCase(), p.x + 1.5, p.y + 1.5);
      g.fillStyle = d.color; g.fillText(d.name.toUpperCase(), p.x, p.y);
    }
    // places
    g.font = `bold ${Math.round(S / 60)}px Inter, sans-serif`;
    for (const pl of game.places) {
      const p = toCanvas(pl.x, pl.y, S), r = S / 70;
      g.fillStyle = pl.color; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#fff"; g.fillText(pl.icon, p.x, p.y + 1);
    }
    // goals
    for (const list of [game.missions.markers, game.jobs.markers]) for (const mk of list) {
      const p = toCanvas(mk.x, mk.y, S);
      g.strokeStyle = mk.color; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, S / 55, 0, Math.PI * 2); g.stroke();
      if (mk.label) { g.fillStyle = mk.color; g.fillText(mk.label, p.x, p.y + 1); }
    }
    // waypoint and player
    if (game.waypoint) {
      const p = toCanvas(game.waypoint.x, game.waypoint.y, S);
      g.strokeStyle = "#ff3cac"; g.lineWidth = 4; g.beginPath(); g.moveTo(p.x - 9, p.y - 9); g.lineTo(p.x + 9, p.y + 9); g.moveTo(p.x + 9, p.y - 9); g.lineTo(p.x - 9, p.y + 9); g.stroke();
    }
    const me = toCanvas(game.fx, game.fy, S);
    g.save(); g.translate(me.x, me.y); g.rotate(game.fa);
    g.fillStyle = "#ffffff"; g.strokeStyle = "#ff3cac"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(12, 0); g.lineTo(-8, -8); g.lineTo(-3, 0); g.lineTo(-8, 8); g.closePath(); g.fill(); g.stroke();
    g.restore();
  };

  useEffect(() => { draw(); }); // redraw after every render (waypoint changes)

  const click = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!, rect = c.getBoundingClientRect();
    const u = (e.clientX - rect.left) / rect.width, v = (e.clientY - rect.top) / rect.height;
    const span = MAP_SIZE * VIEW, x0 = MAP_MIN + (MAP_SIZE - span) / 2;
    game.setWaypoint(x0 + u * span, x0 + v * span);
    draw(); onChange();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={ref} width={720} height={720} onPointerDown={click} className="aspect-square w-[min(86vw,62vh)] cursor-crosshair rounded-2xl border border-white/15 bg-[#0b3a5c]" />
      <div className="flex items-center gap-3 text-xs text-white/60">
        <span>Tippen/Klicken setzt einen Wegpunkt – die Route erscheint auf der Minikarte.</span>
        {game.waypoint && <button onClick={() => { game.clearWaypoint(); draw(); onChange(); }} className="rounded-lg border border-white/20 px-2 py-1 text-white/80">Wegpunkt löschen</button>}
      </div>
    </div>
  );
}
