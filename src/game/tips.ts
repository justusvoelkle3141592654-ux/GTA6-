import type { Game } from "./engine";
import { currentSettings } from "./settings";

// tutorial hints: each one is shown once (remembered in localStorage), only in the open world
type TipId = "story" | "enter" | "nitro" | "radio" | "job" | "star" | "place" | "map" | "weapon" | "swim" | "bank" | "hide" | "chapter2" | "army" | "craft" | "spawn";
interface Tip { id: TipId; when: (g: Game) => boolean; text: (g: Game, touch: boolean) => string; }

const TIPS: Tip[] = [
  { id: "story", when: (g) => g.time > 3, text: (_g, t) => `Die Story beginnt bei Lou – das pinke L auf der ${t ? "Karte (Pause)" : "Karte (M)"}` },
  { id: "nitro", when: (g) => !g.onFoot && g.time > 12, text: (g, t) => `${t ? "NITRO" : g.bind.label("nitro")}: Nitro – der Tank leert sich und lädt langsam nach` },
  { id: "enter", when: (g) => g.onFoot && !!g.nearestEnterable(), text: (g, t) => `${t ? "EINSTEIGEN" : g.bind.label("enter")}: Einsteigen – jedes Auto lässt sich klauen` },
  { id: "place", when: (g) => !!g.nearPlace && g.nearPlace.kind !== "contact", text: (g, t) => `${t ? "Grüner Knopf" : g.bind.label("enter")}: ${g.nearPlace?.name ?? "Laden"} betreten` },
  { id: "star", when: (g) => g.wanted.stars > 0, text: () => "Fahndung! Bleib außer Sicht der Cops, bis die Sterne nicht mehr blinken" },
  { id: "radio", when: (g) => !g.onFoot && g.time > 40, text: (g, t) => `${t ? "Radioknopf" : g.bind.label("radio")}: Radiosender wechseln` },
  { id: "job", when: (g) => g.time > 60, text: () => "Jobs starten an festen Punkten: X Taxistand · P Lieferdepot · S Streife – dort wartet das Fahrzeug" },
  { id: "spawn", when: (g) => g.time > 200, text: () => "Im Pausenmenü unter „Spawnen“ rufst du jedes Fahrzeug, Waffen, Geld und Leute herbei" },
  { id: "weapon", when: (g) => g.inv.owned.length > 2, text: (g, t) => t ? "Waffe gedrückt halten: Waffenrad" : `${g.bind.label("wheel")} halten: Waffenrad · ${g.bind.label("reload")}: Nachladen` },
  { id: "swim", when: (g) => g.onFoot && g.ped.swim, text: () => "Du schwimmst – langsam und ohne Waffen. Am Bootssteg (B) liegt ein Speedboot" },
  { id: "bank", when: (g) => g.nearPlace?.kind === "safehouse", text: () => "Im Safehouse gibt's ein Bankkonto: Geld dort verlierst du nicht in Klinik oder Haft" },
  { id: "hide", when: (g) => g.nearPlace?.kind === "park", text: (g, t) => `${t ? "Grüner Knopf" : g.bind.label("enter")}: Versteckspiel starten – bleib unentdeckt, bis die Zeit um ist` },
  { id: "chapter2", when: (g) => g.progress.missions.includes("m10"), text: () => "Neue Aufträge: Ines im Hafenamt (A) und Kommissarin Ruiz (R)" },
  { id: "army", when: (g) => g.wanted.stars >= 6, text: () => "6 Sterne: Das Militär rückt an. Weg von der Straße – oder ab aufs Wasser" },
  { id: "craft", when: (g) => g.time > 150, text: () => "Am Bootssteg (B) wartet ein Speedboot, am Heliport (F) ein Hubschrauber" },
  { id: "map", when: (g) => g.time > 90, text: (g, t) => t ? "In der Pause: Karte antippen, um einen Wegpunkt zu setzen" : `${g.bind.label("map")}: Karte – klick, um einen Wegpunkt zu setzen` },
];
const KEY = "solarabay.tips.v1";

export class Tips {
  private seen = new Set<TipId>();
  private gap = 4; // seconds until the next tip may appear

  constructor(private g: Game) {
    try { const raw = localStorage.getItem(KEY); if (raw) for (const id of JSON.parse(raw) as TipId[]) this.seen.add(id); } catch { /* ignore */ }
  }

  reset() { this.seen.clear(); try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

  update(dt: number) {
    if (!currentSettings.tips) return;
    this.gap -= dt;
    if (this.gap > 0) return;
    const g = this.g;
    for (const tip of TIPS) {
      if (this.seen.has(tip.id) || !tip.when(g)) continue;
      this.seen.add(tip.id);
      try { localStorage.setItem(KEY, JSON.stringify([...this.seen])); } catch { /* ignore */ }
      g.tip(tip.text(g, g.mobile));
      this.gap = 9;
      return;
    }
  }
}
