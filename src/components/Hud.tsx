import type { CameraMode, HudData } from "../game/engine";
import type { ModeRules } from "../game/modes";
import type { Weapon } from "../game/weapons";
import { Bar, Stars, ammoText, fmt, fmtTime, wIcon, wName } from "./ui";

interface Props {
  hud: HudData; isTouch: boolean; rules: ModeRules; camera: CameraMode;
  onPause: () => void; onCam: () => void; onToggleCar: () => void; onInteract: () => void; onRadio: () => void; onJob: () => void;
  onDetonate: () => void; onWeapon: (w: Weapon) => void; onWheel: () => void;
}

export default function Hud({ hud, isTouch, rules, camera, onPause, onCam, onToggleCar, onInteract, onRadio, onJob, onDetonate, onWeapon, onWheel }: Props) {
  const ammo = ammoText(hud.ammo, hud.reserve);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {/* money / score, wanted level, bars */}
      <div className="absolute left-3 top-3 sm:left-5 sm:top-4">
        {rules.respawn ? (
          <div className="font-display text-4xl leading-none tracking-wide text-green-300 sm:text-6xl" style={{ textShadow: "0 3px 0 rgba(0,0,0,0.6), 0 0 18px rgba(61,255,139,0.5)" }}>${fmt(hud.cash)}</div>
        ) : (
          <div className="font-display text-4xl leading-none tracking-wide text-white sm:text-6xl" style={{ textShadow: "0 3px 0 rgba(0,0,0,0.6), 0 0 18px rgba(255,60,172,0.6)" }}>{fmt(hud.score)}</div>
        )}
        {!rules.respawn && <div className="mt-1 flex items-center gap-2">
          <div key={hud.mult} className={"popin rounded-md px-2 py-0.5 font-display text-xl tracking-wider sm:text-2xl " + (hud.mult > 1 ? "bg-pink-500 text-white shadow-[0_0_14px_rgba(255,60,172,0.9)]" : "bg-white/10 text-white/60")}>x{hud.mult}</div>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10 sm:w-28"><div className="h-full bg-gradient-to-r from-pink-500 to-yellow-300" style={{ width: `${hud.combo01 * 100}%` }} /></div>
        </div>}
        {rules.cops && <div className={"mt-2" + (hud.searching ? " animate-pulse" : "")}><Stars n={hud.stars} size={isTouch ? "text-xl" : "text-3xl"} /></div>}
        <div className="mt-2 w-36 space-y-1.5 sm:w-52">
          {rules.damage && <Bar label="DU" value={hud.health01} from={hud.health01 < 0.3 ? "#ff1a3a" : "#3dff8b"} to={hud.health01 < 0.3 ? "#ff6b3d" : "#9dffc8"} />}
          {rules.damage && hud.armor01 > 0 && <Bar label="WESTE" value={hud.armor01} from="#5aa0ff" to="#b5d6ff" />}
          {rules.damage && !hud.onFoot && <Bar label="AUTO" value={hud.carHealth01} from={hud.carHealth01 < 0.3 ? "#ff1a3a" : "#ff3cac"} to={hud.carHealth01 < 0.3 ? "#ff6b3d" : "#ff8ad1"} />}
          {!hud.onFoot && <Bar label="N2O" value={hud.nitro01} from="#2bf0ff" to="#9d4dff" />}
        </div>
      </div>

      {/* top buttons */}
      <div className="pointer-events-auto absolute left-1/2 top-3 flex -translate-x-1/2 gap-2">
        <button onClick={onPause} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur active:scale-90" aria-label="Pause">
          <span className="flex gap-1"><span className="h-4 w-1.5 rounded bg-white" /><span className="h-4 w-1.5 rounded bg-white" /></span>
        </button>
        <button onClick={onCam} className="flex h-11 items-center justify-center rounded-full border border-white/20 bg-black/40 px-3 text-xs font-bold tracking-wider backdrop-blur active:scale-90">🎥 {camera === "chase" ? "3D" : camera === "fp" ? "EGO" : "TOP"}</button>
        <button onClick={onToggleCar} className={"flex h-11 items-center justify-center rounded-full border px-3 text-xs font-bold tracking-wider backdrop-blur active:scale-90 " + (hud.onFoot && hud.canEnter ? "animate-pulse border-yellow-300 bg-yellow-400/30" : "border-white/20 bg-black/40")}>
          {hud.onFoot ? "🚗 EINSTEIGEN" : "🚪 AUSSTEIGEN"}
        </button>
        {!hud.onFoot && rules.city && <button onClick={onRadio} className="flex h-11 items-center justify-center rounded-full border border-white/20 bg-black/40 px-3 text-xs font-bold backdrop-blur active:scale-90" aria-label="Radio">📻</button>}
        {hud.job && <button onClick={onJob} className={"flex h-11 items-center justify-center rounded-full border px-3 text-xs font-bold backdrop-blur active:scale-90 " + (hud.job === "starten" ? "border-cyan-300 bg-cyan-400/25" : "border-white/20 bg-black/40")}>💼 JOB {hud.job === "starten" ? "" : "ENDE"}{!isTouch && " [J]"}</button>}
      </div>
      <div className="absolute left-1/2 top-16 -translate-x-1/2 text-center text-xs font-semibold tracking-widest text-white/60">{fmtTime(hud.time)}{rules.cops && !rules.respawn && <> · {hud.takedowns} 🚓</>}</div>

      {/* mission objective */}
      {hud.objective && (
        <div className="absolute left-1/2 top-[5.5rem] w-[min(92vw,34rem)] -translate-x-1/2 text-center">
          <div className="inline-block rounded-xl bg-black/65 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur">{hud.objective}{hud.objTimer >= 0 && <span className={"ml-2 font-display text-lg " + (hud.objTimer < 10 ? "text-red-400" : "text-yellow-300")}>{fmtTime(hud.objTimer)}</span>}</div>
        </div>
      )}
      {hud.hint && <div className="popin absolute left-1/2 top-[8.2rem] -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-4 py-1.5 text-sm font-semibold text-yellow-200 backdrop-blur">{hud.hint}</div>}
      {hud.air && <div className="popin absolute left-1/2 top-[30%] -translate-x-1/2 font-display text-5xl tracking-widest text-cyan-200" style={{ textShadow: "0 0 20px rgba(43,240,255,0.8)" }}>AIR!</div>}

      {/* district under the minimap; big for a moment after entering */}
      {hud.district && (
        <div className={"absolute right-3 text-right sm:right-5 " + (isTouch ? "top-[11rem]" : "top-[10.6rem]")}>
          {hud.districtColor
            ? <div key={hud.district} className="popin font-display text-3xl tracking-widest sm:text-4xl" style={{ color: hud.districtColor, textShadow: `0 0 16px ${hud.districtColor}, 0 3px 0 rgba(0,0,0,0.7)` }}>{hud.district}</div>
            : <div className="font-display text-base tracking-widest text-white/60">{hud.district}</div>}
          {hud.radio && <div className="text-[11px] font-semibold tracking-wider text-pink-200/80">📻 {hud.radio}</div>}
        </div>
      )}

      {/* enter a place */}
      {hud.place && (
        <div className="pointer-events-auto absolute bottom-[38%] left-1/2 -translate-x-1/2 sm:bottom-32">
          <button onClick={onInteract} className="popin rounded-2xl border-2 border-green-300 bg-green-500/25 px-5 py-2.5 font-display text-xl tracking-widest text-white shadow-[0_0_20px_rgba(61,255,139,0.6)] backdrop-blur active:scale-95">
            {isTouch ? "👆" : "E"} · {hud.place}
          </button>
        </div>
      )}

      {/* weapons */}
      <div className={"pointer-events-auto absolute right-3 flex items-center gap-1.5 " + (isTouch ? "hidden" : "bottom-6")}>
        {hud.owned.map((w, i) => (
          <button key={w} onClick={() => onWeapon(w)} className={"flex h-14 w-14 flex-col items-center justify-center rounded-xl border transition-all " + (hud.weapon === w ? "border-pink-400 bg-pink-500/30 shadow-[0_0_16px_rgba(255,60,172,0.6)]" : "border-white/15 bg-black/40 hover:border-white/40")}>
            <span className="text-xl leading-none">{wIcon(w)}</span>
            <span className="text-[9px] text-white/40">[{i + 1}]</span>
          </button>
        ))}
        <button onClick={onWheel} className="flex h-14 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/40 text-xs text-white/60 hover:border-white/40" aria-label="Waffenrad">◎</button>
        {hud.bombsPlaced > 0 && <button onClick={onDetonate} className="ml-2 flex h-14 w-20 animate-pulse flex-col items-center justify-center rounded-xl border border-red-400 bg-red-600/60 shadow-[0_0_20px_rgba(255,40,60,0.8)]"><span className="text-xl">💥</span><span className="font-display text-sm tracking-wider">ZÜNDEN [G]</span></button>}
      </div>
      {!isTouch && (
        <div className="absolute bottom-24 right-4 text-right">
          <div className="font-display text-2xl tracking-wider text-white">{wIcon(hud.weapon)} {wName(hud.weapon)} {ammo && <span className={hud.reloading ? "text-yellow-300" : "text-white/80"}>{hud.reloading ? "NACHLADEN" : ammo}</span>}</div>
          <div className="text-[11px] text-white/45">Klick / F = Feuer · Q / Mausrad = Wechsel · Tab = Waffenrad · R = Nachladen</div>
        </div>
      )}

      {!isTouch ? (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center">
          <div className="cyan-text font-display text-5xl leading-none tracking-wider">{hud.kmh}</div>
          <div className="text-[10px] font-semibold tracking-[0.3em] text-white/50">KM/H</div>
        </div>
      ) : (
        <div className="cyan-text absolute bottom-3 left-1/2 -translate-x-1/2 font-display text-2xl tracking-wider">{hud.kmh} <span className="text-xs text-white/50">KM/H</span></div>
      )}

      {hud.drift > 30 && (
        <div className="absolute left-1/2 top-[62%] -translate-x-1/2 text-center">
          <div className="font-display text-xl tracking-[0.3em] text-yellow-200/80">DRIFT</div>
          <div className="font-display text-5xl leading-none text-yellow-300" style={{ textShadow: "0 0 18px rgba(255,210,63,0.8), 0 3px 0 rgba(0,0,0,0.6)", transform: `scale(${1 + Math.min(0.5, hud.drift / 4000)})` }}>{fmt(hud.drift)}</div>
        </div>
      )}
      {rules.cops && hud.bust01 > 0.02 && (
        <div className={"absolute left-1/2 -translate-x-1/2 text-center " + (isTouch ? "top-[40%]" : "bottom-[22%]")}>
          <div className="animate-pulse font-display text-3xl tracking-widest text-blue-300" style={{ textShadow: "0 0 14px rgba(60,120,255,0.9)" }}>FESTNAHME!</div>
          <div className="mx-auto mt-1 h-2 w-48 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-blue-500 to-red-500" style={{ width: `${hud.bust01 * 100}%` }} /></div>
          <div className="mt-1 text-xs text-white/70">{hud.onFoot ? "Lauf weg oder schieß!" : "Gib Gas, um zu entkommen!"}</div>
        </div>
      )}
    </div>
  );
}
