import Icon from "./icons";
import type { ReactNode } from "react";
import type { ScoreEntry } from "../core/scores";
import type { Weapon } from "../gameplay/weapons";
import { WEAPON_DEFS } from "../gameplay/weapons";

export const fmt = (n: number) => Math.round(n).toLocaleString("de-DE");
export const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
export const fmtDate = (t: number) => new Date(t).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const wIcon = (w: Weapon) => WEAPON_DEFS[w].icon; // SVG symbol name
export function WeaponIcon({ w, size = 22, className = "" }: { w: Weapon; size?: number; className?: string }) { return <Icon name={WEAPON_DEFS[w].icon} size={size} className={className} />; }
const starPx = (cls: string) => (cls.includes("3xl") ? 28 : cls.includes("2xl") ? 22 : cls.includes("xl") ? 18 : 16);
export const wName = (w: Weapon) => WEAPON_DEFS[w].name;
// "12 / 36", "∞" or "" for melee
export function ammoText(ammo: number, reserve: number) {
  if (ammo < 0) return reserve < 0 ? "∞" : "";
  return reserve >= 0 ? `${ammo} / ${reserve}` : String(ammo);
}

export function Overlay({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-y-auto bg-[#0b0614]/70 p-6 backdrop-blur-sm">{children}</div>;
}

export function Btn({ children, onClick, primary, disabled }: { children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className={"w-full rounded-xl px-6 py-3 font-display text-2xl tracking-widest transition-all active:scale-95 disabled:opacity-40 " + (primary ? "pulseglow bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white hover:brightness-110" : "border border-white/20 bg-white/5 text-white/90 hover:border-cyan-300/60 hover:bg-white/10")}>
      {children}
    </button>
  );
}

const STAR_SLOTS = [0, 1, 2, 3, 4, 5];
export function Stars({ n, size = "text-2xl", max = 5 }: { n: number; size?: string; max?: number }) {
  return (
    <div className={`flex gap-0.5 ${size} leading-none`}>
      {STAR_SLOTS.slice(0, max).map((i) => <span key={i} className={i < n ? "text-yellow-300" : "text-white/15"} style={i < n ? { filter: "drop-shadow(0 0 6px rgba(255,210,63,0.9))" } : undefined}><Icon name="star" fill size={starPx(size)} /></span>)}
    </div>
  );
}

export function Bar({ label, value, from, to }: { label: string; value: number; from: string; to: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-[10px] font-extrabold tracking-wider text-white/70">{label}</span>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
        <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: `linear-gradient(90deg, ${from}, ${to})`, boxShadow: `0 0 10px ${from}` }} />
      </div>
    </div>
  );
}

export function ScoreTable({ scores, highlight = -1, limit = 10 }: { scores: ScoreEntry[]; highlight?: number; limit?: number }) {
  if (!scores.length) return <div className="py-6 text-center text-sm text-white/40">Noch keine Einträge – sei der Erste!</div>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {scores.slice(0, limit).map((s, i) => (
          <tr key={s.date + "-" + i} className={i === highlight ? "bg-pink-500/25 text-white" : i % 2 ? "bg-white/[0.03]" : ""}>
            <td className={"w-8 py-1.5 pl-2 font-display text-lg " + (i === 0 ? "text-yellow-300" : i === 1 ? "text-slate-200" : i === 2 ? "text-amber-500" : "text-white/40")}>{i + 1}</td>
            <td className="py-1.5 font-semibold tracking-wide">{s.name}</td>
            <td className="py-1.5 text-[10px] uppercase tracking-wider text-white/40">{s.tag || ""}</td>
            <td className="py-1.5 pr-2 text-right font-display text-lg tracking-wide text-cyan-200">{fmt(s.score)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Choice<T extends string>({ value, options, onChange, disabled }: { value: T; options: { v: T; label: string; sub?: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className={"grid gap-2 " + (options.length === 3 ? "grid-cols-3" : options.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2") + (disabled ? " pointer-events-none opacity-35" : "")}>
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={"rounded-xl border px-2 py-2 text-center transition-all active:scale-95 " + (value === o.v ? "border-pink-400 bg-pink-500/25 shadow-[0_0_16px_rgba(255,60,172,0.45)]" : "border-white/15 bg-black/30 hover:border-white/35")}>
          <div className="font-display text-xl leading-none tracking-wider">{o.label}</div>
          {o.sub && <div className="mt-1 text-[10px] leading-tight text-white/55">{o.sub}</div>}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div><div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">{title}</div>{children}</div>;
}
export function StatBar({ v, color }: { v: number; color: string }) {
  return <div className="h-1 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`, background: color }} /></div>;
}
export function Key({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-white/25 bg-white/10 px-1.5 py-0.5 font-sans text-[11px] font-bold text-white">{children}</kbd>;
}
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50">{label}</div>
      <div className="font-display text-2xl tracking-wide text-white">{value}</div>
    </div>
  );
}
