import type { CSSProperties, ReactNode } from "react";
import type { CameraMode, HudData } from "../core/engine";
import type { ModeRules } from "../core/modes";
import { WEAPON_DEFS, type Weapon } from "../gameplay/weapons";
import { currentSettings } from "../core/settings";
import { Stars, WeaponIcon, fmt, fmtTime, wName } from "./ui";
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
  const s = currentSettings.hudScale, g = 12; // gap to the edge in px
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
const CAM_SHORT: Record<CameraMode, string> = { chase: "3D", fp: "EGO", hood: "HAUBE", front: "VORNE", side: "SEITE", top: "OBEN" };
// the toolbar: compact square buttons, a label only where the symbol alone is not clear
const tool = "sb-icon-btn pointer-events-auto h-10 min-w-10 gap-1.5 px-2 text-[11px] font-bold tracking-wider";

// desktop (website): the weapon in the hand with its ammunition, big enough to read at a glance;
// magazine / reserve, a bar for the magazine, yellow when it runs low or reloads, red when empty
function WeaponCard({ hud }: { hud: HudData }) {
  const d = WEAPON_DEFS[hud.weapon];
  const melee = d.kind === "melee", endless = !melee && hud.ammo < 0;
  const mag = Math.max(0, hud.ammo), reserve = hud.reserve;
  const empty = !melee && !endless && mag === 0 && reserve <= 0;
  const low = !melee && !endless && !empty && (d.clip > 0 ? mag <= Math.max(2, Math.ceil(d.clip * 0.25)) : mag <= 1);
  const col = empty ? "text-alert-400" : hud.reloading || low ? "text-sun-400" : "text-fog-100";
  const note = hud.reloading ? "Lädt nach …" : empty ? "Keine Munition – Waffenladen" : low ? (d.clip > 0 && reserve > 0 ? "Bald nachladen (R)" : "Munition knapp") : "";
  return (
    <div className="mb-2 inline-flex items-center gap-3 rounded-[6px] border border-white/10 bg-ink-950/75 py-2 pl-3 pr-3 text-left" style={{ boxShadow: "inset 3px 0 0 var(--color-sun-500)" }}>
      <WeaponIcon w={hud.weapon} size={30} className={melee ? "text-fog-300" : "text-fog-100"} />
      <div className="min-w-[7rem]">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fog-500">{d.name}</div>
        {melee ? <div className="font-display text-2xl leading-tight tracking-wider text-fog-300">Nahkampf</div>
          : endless ? <div className="sb-num text-4xl leading-none text-fog-100" aria-label="Munition unbegrenzt">∞</div>
          : (
            <div className={"flex items-baseline gap-1.5 " + col} aria-label={reserve >= 0 ? `Munition: ${mag} im Magazin, ${reserve} in Reserve` : `Munition: ${mag}`}>
              <span className="sb-num text-[2.6rem] leading-none">{mag}</span>
              {reserve >= 0 ? <span className="sb-num text-xl text-fog-300">/ {reserve}</span> : <span className="text-xs font-semibold text-fog-300">übrig</span>}
            </div>
          )}
        {!melee && !endless && d.clip > 0 && (
          <div className="sb-track mt-1 h-1"><div className={"h-full " + (empty ? "bg-alert-500" : low || hud.reloading ? "bg-sun-400" : "bg-fog-100")} style={{ width: `${Math.min(1, mag / d.clip) * 100}%` }} /></div>
        )}
        {note && <div className={"mt-1 text-[11px] font-semibold " + (empty ? "text-alert-400" : "text-sun-300")}>{note}</div>}
      </div>
    </div>
  );
}

export default function Hud({ hud, isTouch, rules, camera, onPause, onCam, onZoom, onToggleCar, onInteract, onRadio, onJob, onPhone, onDetonate, onWeapon, onWheel, hardcore, onHardcore }: Props) {
  // the minimap is drawn by the game: bottom left (phones: top left), the bars under it
  const mmH = (isTouch ? 92 : 140) * currentSettings.hudScale + (rules.damage ? (hud.onFoot ? 9 : 18) * currentSettings.hudScale : 0) + 10;
  const end = hud.ending, endK = Math.min(1, hud.endT * 2);
  const tb = isTouch ? tool : tool + " w-auto"; // website: labelled buttons as wide as their text
  return (
    <div className="pointer-events-none absolute inset-0 z-[12] select-none font-sans">
      {/* end of a run: the picture turns grey, one calm title with a line under it */}
      {end && (
        <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center" style={{ backdropFilter: `grayscale(${Math.min(1, hud.endT * 1.5)}) brightness(${1 - Math.min(0.35, hud.endT * 0.3)})`, WebkitBackdropFilter: `grayscale(${Math.min(1, hud.endT * 1.5)})` }}>
          <div className="w-full py-5 text-center" style={{ opacity: endK, background: "linear-gradient(90deg, transparent, rgba(7,9,12,0.72) 25%, rgba(7,9,12,0.72) 75%, transparent)" }}>
            <div className="sb-eyebrow" style={{ color: end === "dead" ? "var(--color-alert-400)" : "var(--color-cop-400)" }}>{end === "dead" ? "Krankenhaus" : "Polizeiwache"}</div>
            <div className="sb-title mt-1 whitespace-nowrap text-[min(9.5vw,88px)] tracking-[0.08em]" style={{ transform: `translateY(${(1 - endK) * 8}px)` }}>{end === "dead" ? "NIEDERGESTRECKT" : "FESTGENOMMEN"}</div>
            <span className="mx-auto mt-2 block h-[2px] w-24" style={{ background: end === "dead" ? "var(--color-alert-500)" : "var(--color-cop-500)" }} />
          </div>
        </div>
      )}

      {/* top right: money, wanted level, district (phones); the weapon and its ammunition: bottom right (desktop) / weapon button (phones) */}
      <Zone at="tr">
        {rules.respawn ? (
          <div className="sb-num sb-hud-text text-[2.6rem] leading-none text-fog-100 sm:text-5xl"><span className="mr-0.5 text-[0.7em] text-ok-400">$</span>{fmt(hud.cash)}</div>
        ) : (
          <div className="sb-num sb-hud-text text-[2.6rem] leading-none text-fog-100 sm:text-5xl">{fmt(hud.score)}</div>
        )}
        {!rules.respawn && <div className="mt-1 flex items-center justify-end gap-2">
          <div className="sb-track w-20 sm:w-28"><div className="h-full bg-fog-100" style={{ width: `${hud.combo01 * 100}%` }} /></div>
          <div key={hud.mult} className={"sb-num rounded-[3px] px-1.5 py-0.5 text-lg " + (hud.mult > 1 ? "bg-sun-500 text-ink-950" : "bg-ink-950/50 text-fog-500")}>x{hud.mult}</div>
        </div>}
        {rules.cops && (
          <div className="mt-1.5">
            <div className={hud.searching ? "sb-blink" : ""}><Stars n={hud.stars} max={rules.maxStars} size={isTouch ? "text-xl" : "text-2xl"} hardcore={hardcore} onHardcore={onHardcore} /></div>
            {hud.stars > 0 && <div className="sb-hud-text mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-alert-400">{hud.searching ? "Polizei sucht dich" : "Gesucht"}</div>}
          </div>
        )}
        {!rules.respawn && rules.cops && <div className="sb-hud-text mt-1 flex items-center justify-end gap-1 text-xs text-fog-300"><Icon name="siren" size={14} />{hud.takedowns}</div>}
        {hud.cheats.length > 0 && <div className="sb-hud-text mt-1 max-w-[16rem] text-[10px] font-semibold uppercase leading-tight tracking-wider text-sun-300">{hud.cheats.join(" · ")}</div>}
        {isTouch && hud.district && <div className="sb-hud-text mt-1 font-display text-base tracking-[0.16em] text-fog-300">{hud.district}</div>}
      </Zone>

      {/* help text: a dark card with an info edge (phones: under the map) */}
      {hud.hint && (
        <Zone at="tl" y={isTouch ? mmH : 0}>
          <div key={hud.hint} className="popin sb-toast max-w-[min(70vw,320px)] text-left text-[13px] font-medium leading-snug" style={{ borderLeftColor: "var(--color-cop-400)" }}>{hud.hint}</div>
        </Zone>
      )}

      {/* top centre: toolbar, then the current goal */}
      <Zone at="tc">
        <div className="flex justify-center gap-1.5">
          <button onClick={onPause} className={tb} aria-label="Pause"><Icon name="pause" size={17} /></button>
          <button onClick={onCam} className={tb} aria-label="Kamera wechseln"><Icon name="camera" size={16} />{CAM_SHORT[camera]}</button>
          {(camera === "chase" || camera === "top") && <button onClick={onZoom} className={tb} aria-label="Kamera nah oder weit">{hud.camNear ? "NAH" : "WEIT"}</button>}
          {!isTouch && (
            <button onClick={onToggleCar} className={tb + (hud.onFoot && hud.canEnter ? " is-on" : "")}>
              <Icon name={hud.onFoot ? "car" : "exit"} size={16} />{hud.onFoot ? "EINSTEIGEN" : "AUSSTEIGEN"}
            </button>
          )}
          {!hud.onFoot && rules.city && <button onClick={onRadio} className={tb} aria-label="Radio"><Icon name="radio" size={17} /></button>}
          {hud.job && rules.city && <button onClick={onJob} className={tb + (hud.job === "beenden" ? " is-on" : "")} aria-label={hud.job === "beenden" ? "Job beenden" : "Jobs"}><Icon name="money" size={16} />{hud.job === "beenden" ? "ENDE" : isTouch ? "" : "JOBS"}{!isTouch && <span className="text-fog-500">J</span>}</button>}
          {rules.city && <button onClick={onPhone} className={tb} aria-label="Handy"><Icon name="phone" size={16} />{!isTouch && <span className="text-fog-500">T</span>}</button>}
        </div>
        {!rules.respawn && <div className="sb-hud-text mt-1.5 text-xs font-semibold tracking-widest text-fog-300">{fmtTime(hud.time)}</div>}
        {hud.objective && (
          <div className="mx-auto mt-2 w-max max-w-[min(30rem,calc(100vw-21rem))] text-left">
            <div key={hud.objective} className="popin flex items-center gap-3 rounded-[4px] border border-white/10 bg-ink-950/75 py-1.5 pl-3 pr-3" style={{ boxShadow: "inset 3px 0 0 var(--color-sun-500)" }}>
              <div className="min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-sun-400">Ziel</div>
                <div className="text-[13px] font-semibold leading-snug text-fog-100">{hud.objective}</div>
              </div>
              {hud.objTimer >= 0 && <div className={"sb-num shrink-0 text-2xl " + (hud.objTimer < 10 ? "text-alert-400" : "text-fog-100")}>{fmtTime(hud.objTimer)}</div>}
            </div>
          </div>
        )}
      </Zone>
      {hud.air && <div className="popin sb-title sb-hud-text absolute left-1/2 top-[30%] -translate-x-1/2 text-5xl tracking-[0.2em] text-fog-100">IN DER LUFT</div>}

      {/* bottom centre: the button for places, speed, altitude */}
      <Zone at="bc" y={isTouch ? 64 : 0}>
        {hud.place && (
          <div className="pointer-events-auto mb-2">
            <button onClick={onInteract} className="popin inline-flex min-h-11 items-center gap-2.5 rounded-[4px] border border-sun-500/80 bg-ink-950/80 py-1.5 pl-2 pr-4 text-left active:scale-[0.97]">
              {isTouch ? <span className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-sun-500 text-ink-950"><Icon name="tap" size={17} /></span> : <span className="flex h-7 min-w-7 items-center justify-center rounded-[3px] bg-sun-500 px-1 font-sans text-sm font-bold text-ink-950">E</span>}
              <span className="font-display text-xl tracking-[0.1em] text-fog-100">{hud.place}</span>
            </button>
          </div>
        )}
        {isTouch && !hud.onFoot && <div className="sb-num sb-hud-text text-2xl text-fog-100">{hud.kmh} <span className="text-xs text-fog-300">KM/H</span></div>}
        {hud.alt >= 0 && <div className="sb-num sb-hud-text mt-1 text-2xl text-fog-100">{hud.fly ? "Fliegen · " : ""}Höhe {hud.alt} m</div>}
        {hud.swim && <div className="sb-hud-text mt-1 font-display text-xl tracking-[0.18em] text-cop-400">SCHWIMMEN</div>}
      </Zone>

      {/* bottom right (desktop): district, radio, speed, weapons */}
      {!isTouch && (
        <Zone at="br">
          {hud.district && (
            <div className="sb-hud-text mb-2">
              {hud.districtColor
                ? <div key={hud.district} className="popin font-display text-3xl tracking-[0.12em] text-fog-100">{hud.district}</div>
                : <div className="font-display text-lg tracking-[0.12em] text-fog-300">{hud.district}</div>}
              {hud.radio && <div className="flex items-center justify-end gap-1 text-[11px] font-semibold tracking-wider text-fog-300"><Icon name="radio" size={12} />{hud.radio}</div>}
            </div>
          )}
          {!hud.onFoot && <div className="sb-num sb-hud-text mb-2 text-4xl leading-none text-fog-100">{hud.kmh}<span className="ml-1 text-sm text-fog-300">KM/H</span></div>}
          <WeaponCard hud={hud} />
          <div className="pointer-events-auto flex items-center justify-end gap-1">
            {hud.owned.map((w, i) => (
              <button key={w} onClick={() => onWeapon(w)} aria-label={wName(w)} className={"sb-icon-btn h-11 w-11 flex-col gap-0 " + (hud.weapon === w ? "is-on bg-sun-500/15" : "")}>
                <WeaponIcon w={w} size={21} />
                <span className="text-[9px] leading-none text-fog-500">{i + 1}</span>
              </button>
            ))}
            <button onClick={onWheel} className="sb-icon-btn h-11 w-10 text-fog-300" aria-label="Waffenrad"><Icon name="wheel" size={19} /></button>
            {hud.jet && <button onClick={onDetonate} className="sb-btn sb-btn-danger ml-1.5 h-11"><Icon name="boom" size={18} />RAKETE <span className="sb-kbd">G</span></button>}
            {hud.bombsPlaced > 0 && <button onClick={onDetonate} className="sb-btn sb-btn-danger sb-blink ml-1.5 h-11"><Icon name="boom" size={18} />ZÜNDEN <span className="sb-kbd">G</span></button>}
          </div>
          <div className="sb-hud-text mt-1 text-[11px] text-fog-500">Klick / F Feuer · Q Wechsel · Tab Waffenrad · R Nachladen</div>
        </Zone>
      )}

      {hud.drift > 30 && (
        <div className="absolute left-1/2 top-[62%] -translate-x-1/2 text-center">
          <div className="sb-hud-text text-[10px] font-bold uppercase tracking-[0.3em] text-sun-300">Drift</div>
          <div className="sb-num sb-hud-text text-5xl leading-none text-fog-100" style={{ transform: `scale(${1 + Math.min(0.4, hud.drift / 4000)})` }}>{fmt(hud.drift)}</div>
        </div>
      )}
      {rules.cops && hud.bust01 > 0.02 && (
        <div className={"absolute left-1/2 w-56 -translate-x-1/2 text-center " + (isTouch ? "top-[40%]" : "bottom-[24%]")}>
          <div className="sb-title sb-hud-text text-2xl tracking-[0.2em] text-cop-400">Festnahme</div>
          <div className="sb-track mx-auto mt-1 h-1.5 w-full"><div className="h-full bg-cop-500" style={{ width: `${hud.bust01 * 100}%` }} /></div>
          <div className="sb-hud-text mt-1 text-xs text-fog-300">{hud.onFoot ? "Lauf weg oder schieß!" : "Gib Gas, um zu entkommen!"}</div>
        </div>
      )}
    </div>
  );
}
