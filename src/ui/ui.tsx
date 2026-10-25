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
  return <div className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-y-auto p-6"><div className="sb-dim" /><div className="relative flex flex-col items-center">{children}</div></div>;
}

export function Btn({ children, onClick, primary, disabled }: { children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return <button disabled={disabled} onClick={onClick} className={"sb-btn sb-btn-lg w-full " + (primary ? "sb-btn-primary" : "")}>{children}</button>;
}

// a short message after an action (bought, not possible, saved ...): the tone picks the colour of the left edge
export type Tone = "info" | "ok" | "warn" | "bad";
export const toneOf = (m: string): Tone => (/^(Nicht|Kein|Zu wenig|Nur|Gerade nicht|Erst|Du hast nicht|Geht nicht|Leer)/i.test(m) ? "warn" : /(gekauft|gespeichert|erledigt|bereit|geliefert|gesetzt|ist da|eingezahlt|abgehoben)/i.test(m) ? "ok" : "info");
export function Toast({ children, tone, className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  const t = tone ?? (typeof children === "string" ? toneOf(children) : "info");
  return <div className={"popin sb-toast " + className} data-tone={t}>{children}</div>;
}

// title of a page: small label, big title, the gold rule
export function PageHead({ label, title, right }: { label?: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {label && <div className="sb-eyebrow mb-1">{label}</div>}
        <h2 className="sb-title truncate text-3xl sm:text-4xl">{title}</h2>
        <span className="sb-rule mt-1.5" />
      </div>
      {right}
    </div>
  );
}

const STAR_SLOTS = [0, 1, 2, 3, 4, 5];
// wanted level: filled stars light, empty ones as faint outlines; behind them a small red tag
// that switches hardcore on and off
export function Stars({ n, size = "text-2xl", max = 5, hardcore, onHardcore }: { n: number; size?: string; max?: number; hardcore?: boolean; onHardcore?: () => void }) {
  const px = starPx(size), rim = "drop-shadow(0 1px 1px rgba(0,0,0,0.9)) drop-shadow(0 0 3px rgba(0,0,0,0.5))";
  return (
    <div className={`flex items-center justify-end gap-[3px] ${size} leading-none`}>
      {STAR_SLOTS.slice(0, max).map((i) => <span key={i} className={i < n ? (hardcore ? "text-alert-400" : "text-fog-100") : "text-fog-100/35"} style={{ filter: rim }}><Icon name="star" fill={i < n} size={px} /></span>)}
      {onHardcore && (
        <button onClick={onHardcore} title="Hardcore an/aus" aria-label={hardcore ? "Hardcore ausschalten" : "Hardcore einschalten"}
          className={"pointer-events-auto ml-1.5 flex h-6 items-center gap-1 rounded-[3px] border px-1.5 active:scale-95 " + (hardcore ? "border-alert-500 bg-alert-500/85 text-white" : "border-alert-500/40 bg-ink-950/50 text-alert-400")}>
          <Icon name="star" fill size={Math.round(px * 0.7)} />
          <span className="text-[10px] font-bold tracking-wider">{hardcore ? "HC AN" : "HC"}</span>
        </button>
      )}
    </div>
  );
}

export function Bar({ label, value, from, to }: { label: string; value: number; from: string; to: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-[10px] font-bold tracking-wider text-fog-500">{label}</span>
      <div className="sb-track relative h-1.5 flex-1">
        <div className="h-full transition-[width] duration-150" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: `linear-gradient(90deg, ${from}, ${to})` }} />
      </div>
    </div>
  );
}

export function ScoreTable({ scores, highlight = -1, limit = 10 }: { scores: ScoreEntry[]; highlight?: number; limit?: number }) {
  if (!scores.length) return <div className="py-6 text-center text-sm text-fog-500">Noch keine Einträge – sei der Erste!</div>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {scores.slice(0, limit).map((s, i) => (
          <tr key={s.date + "-" + i} className={"border-b border-white/[0.06] " + (i === highlight ? "bg-sun-500/15 text-fog-100" : "")}>
            <td className={"sb-num w-8 py-1.5 pl-2 text-lg " + (i === 0 ? "text-sun-400" : "text-fog-500")}>{i + 1}</td>
            <td className="py-1.5 font-semibold tracking-wide">{s.name}</td>
            <td className="py-1.5 text-[10px] uppercase tracking-wider text-fog-500">{s.tag || ""}</td>
            <td className="sb-num py-1.5 pr-2 text-right text-lg text-fog-100">{fmt(s.score)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Choice<T extends string>({ value, options, onChange, disabled }: { value: T; options: { v: T; label: string; sub?: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className={"grid gap-1.5 " + (options.length === 3 ? "grid-cols-3" : options.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2") + (disabled ? " pointer-events-none opacity-35" : "")}>
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} aria-pressed={value === o.v} className={"sb-option " + (value === o.v ? "is-on" : "")}>
          <div className="font-display text-lg leading-none tracking-wider text-fog-100">{o.label}</div>
          {o.sub && <div className="mt-1 text-[10px] leading-tight text-fog-500">{o.sub}</div>}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div><div className="sb-eyebrow mb-1.5">{title}</div>{children}</div>;
}
export function StatBar({ v, color }: { v: number; color: string }) {
  return <div className="h-[3px] w-full overflow-hidden bg-white/10"><div className="h-full" style={{ width: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`, background: color }} /></div>;
}
export function Key({ children }: { children: ReactNode }) {
  return <kbd className="sb-kbd">{children}</kbd>;
}
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="sb-card px-3 py-2 text-center">
      <div className="sb-eyebrow text-[10px]">{label}</div>
      <div className="sb-num text-2xl text-fog-100">{value}</div>
    </div>
  );
}
