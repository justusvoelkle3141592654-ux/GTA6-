import { useState } from "react";
import { CARS, type CameraMode, type Difficulty, type GameConfig, type Mode, type Quality } from "../core/engine";
import type { Bindings } from "../core/input";
import type { SaveData } from "../core/save";
import { storageAvailable } from "../core/save";
import type { ScoreEntry } from "../core/scores";
import Help from "./Help";
import { Choice, ScoreTable, Section, StatBar, fmt, fmtDate, fmtTime } from "./ui";
import Icon from "./icons";

interface Props {
  name: string; setName: (n: string) => void; scores: ScoreEntry[]; config: GameConfig; update: (p: Partial<GameConfig>) => void;
  onStart: () => void; onNew: () => void; save: SaveData | null; isTouch: boolean; muted: boolean; toggleMute: () => void; bind: Bindings | null;
}

export default function StartScreen({ name, setName, scores, config, update, onStart, onNew, save, isTouch, muted, toggleMute, bind }: Props) {
  const [tab, setTab] = useState<"setup" | "scores" | "help">("setup");
  const [confirmNew, setConfirmNew] = useState(false);
  const cont = config.mode === "open" && !!save;
  const startLabel = cont ? "WEITERSPIELEN" : "LOS GEHT'S";
  const saveBox = cont && save && (
    <div className="rounded-xl border border-green-300/30 bg-green-400/10 p-3 text-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-green-200/80">Spielstand</div>
      <div className="mt-1 text-white/85">${fmt(save.cash)} · Story {save.progress.missions.length} Missionen · Spielzeit {fmtTime(save.stats.playTime)} · gespeichert {fmtDate(save.savedAt)}</div>
      <button onClick={() => { if (confirmNew) { setConfirmNew(false); onNew(); } else setConfirmNew(true); }} className="mt-2 text-xs font-semibold text-white/60 underline hover:text-white">
        {confirmNew ? "Wirklich neu anfangen? Der Spielstand wird beim nächsten Speichern überschrieben – nochmal tippen" : "Neues Spiel starten"}
      </button>
    </div>
  );
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b0614]/95 via-[#0b0614]/55 to-[#0b0614]/80 lg:to-transparent" />
      <div className="scanlines pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:gap-10">
        <div className="flex flex-col items-center text-center lg:w-[42%] lg:items-start lg:text-left">
          <div className="mb-2 rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-200">3D Open World · Stadt, Strand & Berge</div>
          <h1 className="floaty font-display text-[24vw] leading-[0.82] tracking-wide text-white neon-text sm:text-[8.5rem]">
            SOLARA<br /><span className="bg-gradient-to-b from-yellow-200 via-orange-400 to-pink-500 bg-clip-text text-transparent" style={{ textShadow: "none", filter: "drop-shadow(0 0 18px rgba(255,120,60,0.6))" }}>BAY</span>
          </h1>
          <p className="mt-3 max-w-md text-sm text-white/75 sm:text-base">Kai Romero kommt nach Jahren zurück nach Solara Bay. Die Stadt hat sich verändert – und jemand schuldet ihm noch etwas. Klau Autos, erledige Aufträge, leg dich mit Banden und Polizei an und arbeite dich nach oben.</p>
          <div className="mt-5 hidden w-full max-w-sm lg:block">
            <button onClick={onStart} className="pulseglow w-full rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-orange-400 px-8 py-4 font-display text-4xl tracking-[0.2em] text-white transition-transform hover:scale-[1.03] active:scale-95">{startLabel}</button>
            <div className="mt-2 text-xs text-white/40">Enter zum Starten</div>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-white/10 bg-black/55 p-4 backdrop-blur-md lg:w-[58%]">
          <div className="mb-4 flex gap-1 rounded-xl bg-white/5 p-1">
            {([["setup", "Einstellungen"], ["scores", "Bestenliste"], ["help", "Steuerung"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={"flex-1 rounded-lg py-2 font-display text-lg tracking-widest transition-colors " + (tab === k ? "bg-pink-500 text-white" : "text-white/60 hover:text-white")}>{l}</button>
            ))}
          </div>

          {tab === "setup" && (
            <div className="space-y-4">
              {saveBox}
              {config.mode === "open" && !storageAvailable() && <div className="rounded-xl border border-yellow-300/30 bg-yellow-300/10 p-3 text-xs text-yellow-100">Dein Browser blockiert den lokalen Speicher – der Fortschritt bleibt nur bis zum Neuladen der Seite erhalten.</div>}
              <Section title="Spielmodus">
                <Choice<Mode> value={config.mode} onChange={(v) => update({ mode: v })} options={[{ v: "open", label: "Open World", sub: "Story, Jobs, Läden" }, { v: "chase", label: "Verfolgungsjagd", sub: "Cops, Sterne, Takedowns" }, { v: "free", label: "Freie Fahrt", sub: "Keine Cops, kein Schaden" }]} />
              </Section>
              <Section title="Schwierigkeit">
                <Choice<Difficulty> value={config.difficulty} disabled={config.mode === "free"} onChange={(v) => update({ difficulty: v })} options={[{ v: "easy", label: "Leicht", sub: "Wenig Cops, Heilung" }, { v: "normal", label: "Normal", sub: "Ausgewogen" }, { v: "hard", label: "Schwer", sub: "Bis zu 9 Cops" }]} />
              </Section>
              <Section title="Dein Auto (unterwegs klaust du dir einfach ein anderes)">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CARS.map((c) => (
                    <button key={c.id} onClick={() => update({ car: c.id })} className={"rounded-xl border p-2 text-left transition-all active:scale-95 " + (config.car === c.id ? "border-pink-400 bg-pink-500/20 shadow-[0_0_16px_rgba(255,60,172,0.45)]" : "border-white/15 bg-black/30 hover:border-white/35")}>
                      <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} /><span className="font-display text-xl leading-none tracking-wider">{c.name}</span></div>
                      <div className="mb-1.5 mt-0.5 text-[10px] text-white/55">{c.desc}</div>
                      <div className="space-y-1">
                        <StatBar v={(c.maxV - 400) / 280} color="#2bf0ff" /><StatBar v={(c.acc - 450) / 320} color="#ffd23f" /><StatBar v={c.hp / 230} color="#ff3cac" /><StatBar v={1 - (c.grip - 6) / 7} color="#3dff8b" />
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex gap-3 text-[10px] text-white/45"><span><b className="text-cyan-300">■</b> Tempo</span><span><b className="text-yellow-300">■</b> Beschl.</span><span><b className="text-pink-400">■</b> Panzerung</span><span><b className="text-green-400">■</b> Drift</span></div>
              </Section>
              <Section title="Kamera (im Spiel mit C oder dem Kameraknopf wechselbar)">
                <Choice<CameraMode> value={config.camera} onChange={(v) => update({ camera: v })} options={[{ v: "chase", label: "3D Verfolger" }, { v: "fp", label: "Ego-Sicht", sub: "Im Auto sitzen" }, { v: "top", label: "Vogelperspektive" }]} />
              </Section>
              <Section title="Grafik">
                <Choice<Quality> value={config.quality} onChange={(v) => update({ quality: v })} options={[{ v: "low", label: "Schnell", sub: "Für Handys" }, { v: "medium", label: "Mittel", sub: "2 Schattenstufen" }, { v: "high", label: "Hoch", sub: "Spiegelungen + Bloom" }, { v: "ultra", label: "Ultra", sub: "Weite Sicht, scharfe Spiegelung" }]} />
              </Section>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Section title="Dein Name">
                    <input value={name} maxLength={12} onChange={(e) => setName(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") onStart(); }} className="w-full rounded-xl border border-white/20 bg-black/40 px-4 py-2.5 font-display text-2xl tracking-widest text-white outline-none focus:border-pink-400 focus:shadow-[0_0_18px_rgba(255,60,172,0.5)]" />
                  </Section>
                </div>
                <button onClick={toggleMute} className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white/70 hover:text-white"><span className="inline-flex items-center gap-2"><Icon name={muted ? "mute" : "sound"} size={18} />{muted ? "Ton aus" : "Ton an"}</span></button>
              </div>
              <button onClick={onStart} className="pulseglow w-full rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-orange-400 px-8 py-4 font-display text-4xl tracking-[0.2em] text-white transition-transform active:scale-95 lg:hidden">{startLabel}</button>
            </div>
          )}

          {tab === "scores" && <ScoreTable scores={scores} />}
          {tab === "help" && <Help isTouch={isTouch} bind={bind} />}
        </div>
      </div>
    </div>
  );
}
