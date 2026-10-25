import { useState } from "react";
import { CARS, type CameraMode, type Difficulty, type GameConfig, type Mode, type Quality } from "../core/engine";
import type { Bindings } from "../core/input";
import type { SaveData } from "../core/save";
import { storageAvailable } from "../core/save";
import type { ScoreEntry } from "../core/scores";
import Help from "./Help";
import { Choice, ScoreTable, Section, StatBar, Toast, fmt, fmtDate, fmtTime } from "./ui";
import Icon from "./icons";

interface Props {
  name: string; setName: (n: string) => void; scores: ScoreEntry[]; config: GameConfig; update: (p: Partial<GameConfig>) => void;
  onStart: () => void; onNew: () => void; save: SaveData | null; isTouch: boolean; muted: boolean; toggleMute: () => void; bind: Bindings | null;
}
type Tab = "setup" | "scores" | "help";
const TABS: [Tab, string][] = [["setup", "Spiel einrichten"], ["scores", "Bestenliste"], ["help", "Steuerung"]];
const CAR_STATS = ["Tempo", "Beschl.", "Panzer", "Drift"];

// start screen: the city flies by behind it; on the left the brand and the way into the game,
// on the right the setup (mode, difficulty, car, camera, graphics, name), the scores and the controls
export default function StartScreen({ name, setName, scores, config, update, onStart, onNew, save, isTouch, muted, toggleMute, bind }: Props) {
  const [tab, setTab] = useState<Tab>("setup");
  const [confirmNew, setConfirmNew] = useState(false);
  const cont = config.mode === "open" && !!save;
  return (
    <div className="absolute inset-0 z-20">
      <div className="sb-screen pointer-events-none" />
      <div className="relative flex h-full flex-col gap-3 overflow-y-auto p-3 sb-scroll sm:flex-row sm:gap-5 sm:overflow-hidden sm:p-5"
        style={{ paddingLeft: "max(0.75rem, var(--sal))", paddingRight: "max(0.75rem, var(--sar))" }}>
        {/* brand and the way into the game */}
        <div className="flex shrink-0 flex-col sm:w-[38%] sm:max-w-md sm:overflow-y-auto sm:pr-1 sb-scroll">
          <div className="sb-eyebrow">Open City · Realismus Update 2.0</div>
          <h1 className="sb-title mt-1 whitespace-nowrap text-[clamp(3rem,9vw,6.5rem)] [@media(max-height:480px)]:text-[3.4rem]" style={{ textShadow: "0 4px 18px rgba(0,0,0,0.5)" }}>
            SOLARA <span className="text-sun-500">BAY</span>
          </h1>
          <span className="sb-rule mt-2 w-16" />
          <p className="sb-body mt-3 max-w-sm [@media(max-height:480px)]:hidden">Kai Romero kommt nach Jahren zurück. Die Stadt hat sich verändert – und jemand schuldet ihm noch etwas. Aufträge, Banden, Polizei: arbeite dich nach oben.</p>

          {cont && save && (
            <div className="sb-card mt-3 py-2">
              <div className="flex items-baseline justify-between gap-2"><span className="sb-eyebrow">Spielstand</span><span className="sb-note">gespeichert {fmtDate(save.savedAt)}</span></div>
              <div className="mt-1 grid grid-cols-3 gap-2">
                <div><div className="sb-num text-xl text-ok-400">${fmt(save.cash)}</div><div className="sb-note">Bargeld</div></div>
                <div><div className="sb-num text-xl text-fog-100">{save.progress.missions.length}</div><div className="sb-note">Missionen</div></div>
                <div><div className="sb-num text-xl text-fog-100">{fmtTime(save.stats.playTime)}</div><div className="sb-note">Spielzeit</div></div>
              </div>
            </div>
          )}
          {config.mode === "open" && !storageAvailable() && <Toast tone="warn" className="mt-3 text-xs">Der lokale Speicher ist blockiert – der Fortschritt bleibt nur bis zum Neuladen erhalten.</Toast>}

          <div className="mt-3 flex flex-col gap-1.5">
            <button onClick={onStart} className="sb-btn sb-btn-primary sb-btn-lg w-full justify-between">
              <span>{cont ? "Weiterspielen" : "Spiel starten"}</span><Icon name="arrow" size={20} />
            </button>
            {cont && (
              <button onClick={() => { if (confirmNew) { setConfirmNew(false); onNew(); } else setConfirmNew(true); }} className={"sb-btn w-full justify-between " + (confirmNew ? "sb-btn-danger" : "")}>
                <span>{confirmNew ? "Wirklich neu anfangen?" : "Neues Spiel"}</span>{confirmNew && <span className="text-[10px] normal-case tracking-normal opacity-80">nochmal tippen</span>}
              </button>
            )}
            {confirmNew && <div className="sb-note">Der alte Spielstand wird beim nächsten Speichern überschrieben.</div>}
          </div>
          <div className="mt-auto flex items-center gap-2 pt-3">
            <button onClick={toggleMute} className="sb-btn sb-btn-ghost sb-btn-sm"><Icon name={muted ? "mute" : "sound"} size={16} />{muted ? "Ton aus" : "Ton an"}</button>
            {!isTouch && <span className="sb-note">Enter = Start</span>}
          </div>
        </div>

        {/* setup, scores, controls */}
        <div className="sb-panel flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 border-b border-white/[0.08]" role="tablist">
            {TABS.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={"relative flex-1 px-2 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors " + (tab === k ? "text-fog-100" : "text-fog-500 hover:text-fog-300")}>
                {l}{tab === k && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-sun-500" />}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sb-scroll sm:p-4">
            {tab === "setup" && (
              <div className="space-y-4">
                <Section title="Spielmodus">
                  <Choice<Mode> value={config.mode} onChange={(v) => update({ mode: v })} options={[{ v: "open", label: "Open World", sub: "Story, Jobs, Läden" }, { v: "chase", label: "Verfolgungsjagd", sub: "Cops, Sterne, Takedowns" }, { v: "free", label: "Freie Fahrt", sub: "Keine Cops, kein Schaden" }]} />
                </Section>
                <Section title="Schwierigkeit">
                  <Choice<Difficulty> value={config.difficulty} disabled={config.mode === "free"} onChange={(v) => update({ difficulty: v })} options={[{ v: "easy", label: "Leicht", sub: "Wenig Cops, Heilung" }, { v: "normal", label: "Normal", sub: "Ausgewogen" }, { v: "hard", label: "Schwer", sub: "Bis zu 9 Cops" }]} />
                  <div className="sb-note mt-1.5">Hardcore schaltest du im Spiel ein: das rote HC hinter den Fahndungssternen.</div>
                </Section>
                <Section title="Startfahrzeug">
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {CARS.map((c) => (
                      <button key={c.id} onClick={() => update({ car: c.id })} aria-pressed={config.car === c.id} className={"sb-option " + (config.car === c.id ? "is-on" : "")}>
                        <div className="flex items-center gap-2"><span className="h-3 w-5 rounded-[2px] ring-1 ring-white/25" style={{ background: c.color }} /><span className="font-display text-lg leading-none tracking-wider text-fog-100">{c.name}</span></div>
                        <div className="mb-1.5 mt-0.5 text-[10px] text-fog-500">{c.desc}</div>
                        <div className="space-y-[3px]">
                          {[(c.maxV - 400) / 280, (c.acc - 450) / 320, c.hp / 230, 1 - (c.grip - 6) / 7].map((v, i) => (
                            <div key={i} className="flex items-center gap-1.5"><span className="w-10 text-[9px] uppercase tracking-wider text-fog-500">{CAR_STATS[i]}</span><StatBar v={v} color={config.car === c.id ? "var(--color-sun-400)" : "var(--color-fog-300)"} /></div>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="sb-note mt-1">Unterwegs klaust du dir einfach ein anderes.</div>
                </Section>
                <Section title="Kamera">
                  <Choice<CameraMode> value={config.camera} onChange={(v) => update({ camera: v })} options={[{ v: "chase", label: "Verfolger", sub: "3D hinter dir" }, { v: "fp", label: "Ego-Sicht", sub: "Im Auto sitzen" }, { v: "top", label: "Von oben", sub: "Vogelperspektive" }]} />
                  <div className="sb-note mt-1">Im Spiel wechselbar (C oder Kameraknopf), im Auto auch Motorhaube, von vorne und seitlich.</div>
                </Section>
                <Section title="Grafik">
                  <Choice<Quality> value={config.quality} onChange={(v) => update({ quality: v })} options={[{ v: "low", label: "Schnell", sub: "Für Handys" }, { v: "medium", label: "Mittel", sub: "Schatten, Farbkorrektur" }, { v: "high", label: "Hoch", sub: "Spiegelungen, Glanz" }, { v: "ultra", label: "Ultra", sub: "Weite Sicht" }]} />
                </Section>
                <Section title="Dein Name">
                  <input value={name} maxLength={12} onChange={(e) => setName(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") onStart(); }}
                    className="sb-input w-full font-display text-xl tracking-widest sm:max-w-xs" aria-label="Dein Name" />
                </Section>
              </div>
            )}
            {tab === "scores" && <ScoreTable scores={scores} />}
            {tab === "help" && <Help isTouch={isTouch} bind={bind} />}
          </div>
        </div>
      </div>
    </div>
  );
}
