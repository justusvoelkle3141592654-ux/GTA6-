import type { CSSProperties, ReactNode } from "react";
import type { CameraMode, HudData } from "../core/engine";
import type { ModeRules } from "../core/modes";
import type { Weapon } from "../gameplay/weapons";
import { currentSettings } from "../core/settings";
import { Bar, Stars, WeaponIcon, ammoText, fmt, fmtTime, wName } from "./ui";
import Icon from "./icons";

interface Props {
  hud: HudData; isTouch: boolean; rules: ModeRules; camera: CameraMode;
  onPause: () => void; onCam: () => void; onZoom: () => void; onToggleCar: () => void; onInteract: () => void; onRadio: () => void; onJob: () => void; onPhone: () => void;
  onDetonate: () => void; onWeapon: (w: Weapon) => void; onWheel: () => void;
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
const pill = "flex h-10 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-3 text-xs font-bold tracking-wider backdrop-blur-md active:scale-90";

export default function Hud({ hud, isTouch, rules, camera, onPause, onCam, onZoom, onToggleCar, onInteract, onRadio, onJob, onPhone, onDetonate, onWeapon, onWheel }: Props) {
  const ammo = ammoText(hud.ammo, hud.reserve);
  const mm = (isTouch ? 104 : 150) * currentSettings.hudScale; // the minimap is drawn by the game in the top right
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none font-sans">
      {/* top left: money (or score) and wanted level */}
      <Zone at="tl">
        {rules.respawn ? (
          <div className="font-display text-4xl leading-none tracking-wide text-green-300 sm:text-5xl" style={{ textShadow: "0 3px 0 rgba(0,0,0,0.6), 0 0 18px rgba(61,255,139,0.45)" }}>${fmt(hud.cash)}</div>
        ) : (
          <div className="font-display text-4xl leading-none tracking-wide text-white sm:text-5xl" style={{ textShadow: "0 3px 0 rgba(0,0,0,0.6), 0 0 18px rgba(255,60,172,0.6)" }}>{fmt(hud.score)}</div>
        )}
        {!rules.respawn && <div className="mt-1 flex items-center gap-2">
          <div key={hud.mult} className={"popin rounded-md px-2 py-0.5 font-display text-xl tracking-wider " + (hud.mult > 1 ? "bg-pink-500 text-white shadow-[0_0_14px_rgba(255,60,172,0.9)]" : "bg-white/10 text-white/60")}>x{hud.mult}</div>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10 sm:w-28"><div className="h-full bg-gradient-to-r from-pink-500 to-yellow-300" style={{ width: `${hud.combo01 * 100}%` }} /></div>
        </div>}
        {rules.cops && <div className={"mt-1.5" + (hud.searching ? " animate-pulse" : "")}><Stars n={hud.stars} max={rules.maxStars} size={isTouch ? "text-xl" : "text-2xl"} /></div>}
        {!rules.respawn && rules.cops && <div className="mt-1 flex items-center gap-1 text-xs text-white/60"><Icon name="siren" size={14} />{hud.takedowns}</div>}
        {/* health, vest, car, nitro: top left under money and stars */}
        <div className="mt-2 w-44 space-y-1.5 rounded-xl border border-white/10 bg-black/35 p-2 backdrop-blur-md sm:w-56">
          {rules.damage && <Bar label="DU" value={hud.health01} from={hud.health01 < 0.3 ? "#ff1a3a" : "#3dff8b"} to={hud.health01 < 0.3 ? "#ff6b3d" : "#9dffc8"} />}
          {rules.damage && hud.armor01 > 0 && <Bar label="WESTE" value={hud.armor01} from="#5aa0ff" to="#b5d6ff" />}
          {rules.damage && !hud.onFoot && <Bar label="AUTO" value={hud.carHealth01} from={hud.carHealth01 < 0.3 ? "#ff1a3a" : "#ff3cac"} to={hud.carHealth01 < 0.3 ? "#ff6b3d" : "#ff8ad1"} />}
          {!hud.onFoot && <Bar label="N2O" value={hud.nitro01} from="#2bf0ff" to="#9d4dff" />}
        </div>
      </Zone>

      {/* top centre: menu buttons, clock, mission objective */}
      <Zone at="tc">
        <div className="pointer-events-auto flex gap-2">
          <button onClick={onPause} className={pill + " w-10 px-0"} aria-label="Pause"><Icon name="pause" size={18} /></button>
          <button onClick={onCam} className={pill} aria-label="Kamera wechseln"><Icon name="camera" size={16} />{camera === "chase" ? "3D" : camera === "fp" ? "EGO" : "TOP"}</button>
          {camera !== "fp" && <button onClick={onZoom} className={pill} aria-label="Kamera nah oder weit">{hud.camNear ? "NAH" : "WEIT"}</button>}
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

      {/* top right: district and radio under the minimap */}
      {hud.district && (
        <Zone at="tr" y={mm + (isTouch ? 54 : 8)}>
          {hud.districtColor
            ? <div key={hud.district} className="popin font-display text-3xl tracking-widest" style={{ color: hud.districtColor, textShadow: `0 0 16px ${hud.districtColor}, 0 3px 0 rgba(0,0,0,0.7)` }}>{hud.district}</div>
            : <div className="font-display text-base tracking-widest text-white/60">{hud.district}</div>}
          {hud.radio && <div className="flex items-center justify-end gap-1 text-[11px] font-semibold tracking-wider text-pink-200/80"><Icon name="radio" size={12} />{hud.radio}</div>}
        </Zone>
      )}

      {/* bottom centre: hints, the button for places, speed */}
      <Zone at="bc" y={isTouch ? 64 : 0}>
        {hud.hint && <div className="popin mb-2 inline-block max-w-[90vw] rounded-full border border-white/10 bg-black/60 px-4 py-1.5 text-sm font-semibold text-yellow-100 backdrop-blur-md">{hud.hint}</div>}
        {hud.place && (
          <div className="pointer-events-auto mb-2">
            <button onClick={onInteract} className="popin inline-flex items-center gap-2 rounded-2xl border-2 border-green-300 bg-green-500/25 px-5 py-2 font-display text-xl tracking-widest text-white shadow-[0_0_20px_rgba(61,255,139,0.6)] backdrop-blur-md active:scale-95">
              {isTouch ? <Icon name="tap" size={20} /> : <span className="rounded bg-white/20 px-1.5 text-base">E</span>} {hud.place}
            </button>
          </div>
        )}
        {!isTouch && <>
          <div className="cyan-text font-display text-5xl leading-none tracking-wider">{hud.kmh}</div>
          <div className="text-[10px] font-semibold tracking-[0.3em] text-white/50">KM/H</div>
        </>}
        {isTouch && <div className="cyan-text font-display text-2xl tracking-wider">{hud.kmh} <span className="text-xs text-white/50">KM/H</span></div>}
        {hud.alt >= 0 && <div className="mt-1 font-display text-2xl tracking-wider text-yellow-200">{hud.fly ? "Fliegen · " : ""}Höhe {hud.alt} m</div>}
        {hud.swim && <div className="mt-1 font-display text-xl tracking-widest text-sky-300">SCHWIMMEN</div>}
      </Zone>

      {/* bottom right: weapon and ammo, weapon slots */}
      {!isTouch && (
        <Zone at="br">
          <div className="mb-2 flex items-center justify-end gap-2 font-display text-2xl tracking-wider text-white">
            <WeaponIcon w={hud.weapon} size={26} /> {wName(hud.weapon)} {ammo && <span className={hud.reloading ? "text-yellow-300" : "text-white/80"}>{hud.reloading ? "NACHLADEN" : ammo}</span>}
          </div>
          <div className="pointer-events-auto flex items-center justify-end gap-1.5">
            {hud.owned.map((w, i) => (
              <button key={w} onClick={() => onWeapon(w)} aria-label={wName(w)} className={"flex h-12 w-12 flex-col items-center justify-center rounded-xl border transition-all " + (hud.weapon === w ? "border-pink-400 bg-pink-500/30 shadow-[0_0_16px_rgba(255,60,172,0.6)]" : "border-white/15 bg-black/40 hover:border-white/40")}>
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
