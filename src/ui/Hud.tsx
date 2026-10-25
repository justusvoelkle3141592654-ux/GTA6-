import type { CSSProperties, ReactNode } from "react";
import type { CameraMode, HudData } from "../core/engine";
import type { ModeRules } from "../core/modes";
import type { Weapon } from "../gameplay/weapons";
import { currentSettings } from "../core/settings";
import { Stars, WeaponIcon, ammoText, fmt, fmtTime, wName } from "./ui";
import Icon from "./icons";

interface Props {
  hud: HudData; isTouch: boolean; rules: ModeRules; camera: CameraMode;
  onPause: () => void; onCam: () => void; onZoom: () => void; onToggleCar: () => void; onInteract: () => void; onRadio: () => void; onJob: () => void; onPhone: () => void;
  onDetonate: () => void; onWeapon: (w: Weapon) => void; onWheel: () => void;
  hardcore: boolean; onHardcore: () => void;
}

// one corner / edge of the screen: fixed place, scaled with the HUD size, away from the notch (safe area)
type Corner = "tl" | "tr" | "bl" | "br" | "tc" | "bc";
function Zone({ at, children, className = "", y = 0 }: { at: Corner; children: ReactNode; className?: string; y?: number }) {
  const s = currentSettings.hudScale, g = 14; // gap to the edge in px
  const st: CSSProperties = { position: "absolute", transform: `scale(${s})` };
  const top = `calc(var(--sat) + ${g + y}px)`, bottom = `calc(var(--sab) + ${g + y}px)`, left = `calc(var(--sal) + ${g}px)`, right = `calc(var(--sar) + ${g}px)`;
  if (at === "tl") Object.assign(st, { top, left, transformOrigin: "top left" });
  if (at === "tr") Object.assign(st, { top, right, transformOrigin: "top right", textAlign: "right" });
  if (at === "bl") Object.assign(st, { bottom, left, transformOrigin: "bottom left" });
  if (at === "br") Object.assign(st, { bottom, right, transformOrigin: "bottom right", textAlign: "right" });
  if (at === "tc") Object.assign(st, { top, left: "50%", transform: `translateX(-50%) scale(${s})`, transformOrigin: "top center", textAlign: "center" });
  if (at === "bc") Object.assign(st, { bottom, left: "50%", transform: `translateX(-50%) scale(${s})`, transformOrigin: "bottom center", textAlign: "center" });
  return <div style={st} className={className}>{children}</div>;
}
const CAM_SHORT: Record<CameraMode, string> = { chase: "3D", fp: "EGO", hood: "HAUBE", front: "VORNE", side: "SEITE", top: "TOP" };
const pill = "flex h-10 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-3 text-xs font-bold tracking-wider backdrop-blur-md active:scale-90";

export default function Hud({ hud, isTouch, rules, camera, onPause, onCam, onZoom, onToggleCar, onInteract, onRadio, onJob, onPhone, onDetonate, onWeapon, onWheel, hardcore, onHardcore }: Props) {
  const ammo = ammoText(hud.ammo, hud.reserve);
  // the minimap is drawn by the game: bottom left (phones: top left), the bars under it
  const mmH = (isTouch ? 92 : 140) * currentSettings.hudScale + (rules.damage ? (hud.onFoot ? 9 : 18) * currentSettings.hudScale : 0) + 8;
  const outline = { textShadow: "0 0 2px #000, 0 2px 2px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)" };
  return (
    <div className="pointer-events-none absolute inset-0 z-[12] select-none font-sans">
      {/* WASTED / BUSTED: the picture turns grey, big letters like in the old crime games */}
      {hud.ending && (
        <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center" style={{ backdropFilter: `grayscale(${Math.min(1, hud.endT * 1.5)}) brightness(${1 - Math.min(0.35, hud.endT * 0.3)})`, WebkitBackdropFilter: `grayscale(${Math.min(1, hud.endT * 1.5)})` }}>
          <div className="font-display tracking-[0.12em] drop-shadow-[0_4px_0_rgba(0,0,0,0.85)]" style={{ fontSize: "min(22vw, 170px)", color: hud.ending === "dead" ? "#c8102e" : "#2f7bff", opacity: Math.min(1, hud.endT * 2), transform: `scale(${1.25 - Math.min(0.25, hud.endT * 0.5)})` }}>
            {hud.ending === "dead" ? "WASTED" : "BUSTED"}
          </div>
        </div>
      )}
      {/* top right (GTA style): weapon and ammo, money, wanted stars with the hardcore star behind them */}
      <Zone at="tr">
        {!isTouch && hud.weapon !== "fist" && (
          <div className="mb-1 flex items-center justify-end gap-2 font-display text-xl tracking-wider text-white" style={outline}>
            <WeaponIcon w={hud.weapon} size={24} />{ammo && <span className={hud.reloading ? "text-yellow-300" : ""}>{hud.reloading ? "NACHLADEN" : ammo}</span>}
          </div>
        )}
        {rules.respawn ? (
          <div className="font-display text-4xl leading-none tracking-wide text-white sm:text-5xl" style={outline}><span className="text-green-400">$</span>{fmt(hud.cash)}</div>
        ) : (
          <div className="font-display text-4xl leading-none tracking-wide text-white sm:text-5xl" style={outline}>{fmt(hud.score)}</div>
        )}
        {!rules.respawn && <div className="mt-1 flex items-center justify-end gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-black/40 sm:w-28"><div className="h-full bg-white" style={{ width: `${hud.combo01 * 100}%` }} /></div>
          <div key={hud.mult} className={"popin rounded px-2 py-0.5 font-display text-xl tracking-wider " + (hud.mult > 1 ? "bg-white text-black" : "bg-black/40 text-white/60")}>x{hud.mult}</div>
        </div>}
        {rules.cops && <div className={"mt-1" + (hud.searching ? " animate-pulse" : "")}><Stars n={hud.stars} max={rules.maxStars} size={isTouch ? "text-xl" : "text-2xl"} hardcore={hardcore} onHardcore={onHardcore} /></div>}
        {!rules.respawn && rules.cops && <div className="mt-1 flex items-center justify-end gap-1 text-xs text-white/70" style={outline}><Icon name="siren" size={14} />{hud.takedowns}</div>}
        {hud.cheats.length > 0 && <div className="mt-1 max-w-[16rem] text-[10px] font-semibold uppercase leading-tight tracking-wider text-yellow-200/90" style={outline}>{hud.cheats.join(" · ")}</div>}
        {isTouch && hud.district && <div className="mt-1 font-display text-base tracking-widest text-white/80" style={outline}>{hud.district}</div>}
      </Zone>

      {/* top left: help text in a black box (phones: under the map) */}
      {hud.hint && (
        <Zone at="tl" y={isTouch ? mmH : 0}>
          <div key={hud.hint} className="popin max-w-[min(80vw,340px)] rounded-sm bg-black/80 px-3 py-2 text-left text-sm font-medium leading-snug text-white shadow-lg">{hud.hint}</div>
        </Zone>
      )}

      {/* top centre: menu buttons, clock, mission objective */}
      <Zone at="tc">
        <div className="pointer-events-auto flex gap-2">
          <button onClick={onPause} className={pill + " w-10 px-0"} aria-label="Pause"><Icon name="pause" size={18} /></button>
          <button onClick={onCam} className={pill} aria-label="Kamera wechseln"><Icon name="camera" size={16} />{CAM_SHORT[camera]}</button>
          {(camera === "chase" || camera === "top") && <button onClick={onZoom} className={pill} aria-label="Kamera nah oder weit">{hud.camNear ? "NAH" : "WEIT"}</button>}
          <button onClick={onToggleCar} className={pill + (hud.onFoot && hud.canEnter ? " animate-pulse border-yellow-300 bg-yellow-400/30" : "")}>
            <Icon name={hud.onFoot ? "car" : "exit"} size={16} />{hud.onFoot ? "EINSTEIGEN" : "AUSSTEIGEN"}
          </button>
          {!hud.onFoot && rules.city && <button onClick={onRadio} className={pill + " w-10 px-0"} aria-label="Radio"><Icon name="radio" size={17} /></button>}
          {hud.job && rules.city && <button onClick={onJob} className={pill + (hud.job === "beenden" ? " border-cyan-300 bg-cyan-400/25" : "")}><Icon name="money" size={16} />{hud.job === "beenden" ? "JOB ENDE" : "JOBS"}{!isTouch && " [J]"}</button>}
          {rules.city && <button onClick={onPhone} className={pill} aria-label="Handy"><Icon name="phone" size={16} />HANDY{!isTouch && " [T]"}</button>}
        </div>
        <div className="mt-1.5 text-xs font-semibold tracking-widest text-white/60">{fmtTime(hud.time)}</div>
        {hud.objective && (
          <div className="mt-1.5 w-[min(92vw,34rem)]">
            <div className="inline-block rounded-xl border border-white/10 bg-black/60 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-md">{hud.objective}{hud.objTimer >= 0 && <span className={"ml-2 font-display text-lg " + (hud.objTimer < 10 ? "text-red-400" : "text-yellow-300")}>{fmtTime(hud.objTimer)}</span>}</div>
          </div>
        )}
      </Zone>
      {hud.air && <div className="popin absolute left-1/2 top-[30%] -translate-x-1/2 font-display text-5xl tracking-widest text-cyan-200" style={{ textShadow: "0 0 20px rgba(43,240,255,0.8)" }}>AIR!</div>}

      {/* bottom centre: hints, the button for places, speed */}
      <Zone at="bc" y={isTouch ? 64 : 0}>
        {hud.place && (
          <div className="pointer-events-auto mb-2">
            <button onClick={onInteract} className="popin inline-flex items-center gap-2 rounded-2xl border-2 border-green-300 bg-green-500/25 px-5 py-2 font-display text-xl tracking-widest text-white shadow-[0_0_20px_rgba(61,255,139,0.6)] backdrop-blur-md active:scale-95">
              {isTouch ? <Icon name="tap" size={20} /> : <span className="rounded bg-white/20 px-1.5 text-base">E</span>} {hud.place}
            </button>
          </div>
        )}
        {isTouch && !hud.onFoot && <div className="font-display text-2xl tracking-wider text-white" style={outline}>{hud.kmh} <span className="text-xs text-white/60">KM/H</span></div>}
        {hud.alt >= 0 && <div className="mt-1 font-display text-2xl tracking-wider text-yellow-200">{hud.fly ? "Fliegen · " : ""}Höhe {hud.alt} m</div>}
        {hud.swim && <div className="mt-1 font-display text-xl tracking-widest text-sky-300">SCHWIMMEN</div>}
      </Zone>

      {/* bottom right: weapon and ammo, weapon slots */}
      {!isTouch && (
        <Zone at="br">
          {/* area name, radio station and speed (GTA: bottom right) */}
          {hud.district && (
            <div className="mb-2" style={outline}>
              {hud.districtColor
                ? <div key={hud.district} className="popin font-display text-3xl italic tracking-wider text-white">{hud.district}</div>
                : <div className="font-display text-lg italic tracking-wider text-white/85">{hud.district}</div>}
              {hud.radio && <div className="flex items-center justify-end gap-1 text-[11px] font-semibold tracking-wider text-white/80"><Icon name="radio" size={12} />{hud.radio}</div>}
            </div>
          )}
          {!hud.onFoot && <div className="mb-2 font-display text-4xl leading-none tracking-wider text-white" style={outline}>{hud.kmh}<span className="ml-1 text-sm text-white/70">KM/H</span></div>}
          <div className="mb-1 font-display text-lg tracking-wider text-white/90" style={outline}>{wName(hud.weapon)}</div>
          <div className="pointer-events-auto flex items-center justify-end gap-1.5">
            {hud.owned.map((w, i) => (
              <button key={w} onClick={() => onWeapon(w)} aria-label={wName(w)} className={"flex h-11 w-11 flex-col items-center justify-center rounded-md border transition-all " + (hud.weapon === w ? "border-white bg-white/25" : "border-white/10 bg-black/45 hover:border-white/40")}>
                <WeaponIcon w={w} size={22} />
                <span className="text-[9px] text-white/40">{i + 1}</span>
              </button>
            ))}
            <button onClick={onWheel} className="flex h-12 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/40 text-white/70 hover:border-white/40" aria-label="Waffenrad"><Icon name="wheel" size={20} /></button>
            {hud.jet && <button onClick={onDetonate} className="ml-2 flex h-12 items-center gap-1 rounded-xl border border-orange-300 bg-orange-600/60 px-3 font-display text-sm tracking-wider shadow-[0_0_20px_rgba(255,140,40,0.7)]"><Icon name="boom" size={18} />RAKETE [G]</button>}
            {hud.bombsPlaced > 0 && <button onClick={onDetonate} className="ml-2 flex h-12 animate-pulse items-center gap-1 rounded-xl border border-red-400 bg-red-600/60 px-3 font-display text-sm tracking-wider shadow-[0_0_20px_rgba(255,40,60,0.8)]"><Icon name="boom" size={18} />ZÜNDEN [G]</button>}
          </div>
          <div className="mt-1 text-[11px] text-white/45">Klick / F Feuer · Q Wechsel · Tab Waffenrad · R Nachladen</div>
        </Zone>
      )}

      {hud.drift > 30 && (
        <div className="absolute left-1/2 top-[62%] -translate-x-1/2 text-center">
          <div className="font-display text-xl tracking-[0.3em] text-yellow-200/80">DRIFT</div>
          <div className="font-display text-5xl leading-none text-yellow-300" style={{ textShadow: "0 0 18px rgba(255,210,63,0.8), 0 3px 0 rgba(0,0,0,0.6)", transform: `scale(${1 + Math.min(0.5, hud.drift / 4000)})` }}>{fmt(hud.drift)}</div>
        </div>
      )}
      {rules.cops && hud.bust01 > 0.02 && (
        <div className={"absolute left-1/2 -translate-x-1/2 text-center " + (isTouch ? "top-[40%]" : "bottom-[24%]")}>
          <div className="animate-pulse font-display text-3xl tracking-widest text-blue-300" style={{ textShadow: "0 0 14px rgba(60,120,255,0.9)" }}>FESTNAHME!</div>
          <div className="mx-auto mt-1 h-2 w-48 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-blue-500 to-red-500" style={{ width: `${hud.bust01 * 100}%` }} /></div>
          <div className="mt-1 text-xs text-white/70">{hud.onFoot ? "Lauf weg oder schieß!" : "Gib Gas, um zu entkommen!"}</div>
        </div>
      )}
    </div>
  );
}
