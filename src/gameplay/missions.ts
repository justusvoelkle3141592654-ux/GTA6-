import { Car, type CarModel, type FactionId } from "../vehicles/vehicles";
import { BLOCK, ROAD, GRID, WATER_Y, terrainH, roofOf, isWater } from "../world/world";
import type { DialogLine, Game } from "../core/engine";
import type { Civilian } from "../ai/peds";
import { STAR_HEAT } from "../ai/wanted";
import { oldNode } from "../world/districts";
import { sfx } from "../audio/audio";

// ---------------------------------------------------------------- data
// a location: a place (by id), a road crossing (grid node) or world coordinates
// { last: true }: where the previous target ended up (e.g. the wreck of a destroyed van)
// { roof: [bx, by] }: on top of the tallest building of that block (helicopter landings)
export type Loc = { place: string; car?: boolean } | { node: [number, number] } | { xy: [number, number] } | { last: true } | { roof: [number, number] };

export type Step =
  | { kind: "goto"; text: string; at: Loc; radius?: number; inCar?: boolean; vehicle?: CarModel; landed?: boolean; time?: number }
  | { kind: "catch"; text: string; at: Loc; time?: number }            // a suspect runs away: catch him on foot
  | { kind: "hide"; text: string; stars: number; time: number }        // stay out of the police's sight this long
  | { kind: "steal"; text: string; model: CarModel; color: string; at: Loc; time?: number }
  | { kind: "deliver"; text: string; at: Loc; model?: CarModel; time?: number }
  | { kind: "destroy"; text: string; model: CarModel; color: string; at: Loc; hp: number; flee: boolean; time?: number }
  | { kind: "kill"; text: string; at: Loc; n: number; faction: FactionId; time?: number }
  | { kind: "pickup"; text: string; at: Loc; time?: number }
  | { kind: "escape"; text: string; stars: number }
  | { kind: "race"; text: string; points: Loc[]; time: number }
  | { kind: "talk"; lines: DialogLine[] };

export interface MissionDef {
  id: string; title: string; giver: string; requires: string[];
  reward: number; rep?: Partial<Record<FactionId, number>>;
  intro: DialogLine[]; outro: DialogLine[]; steps: Step[];
}

const KAI = "#ffd23f", LOU = "#2bf0ff", MARISOL = "#ff5ad1", DOCK = "#ff9f43", VALE = "#ff4d4d", INES = "#2bb3ff", RUIZ = "#3d8bff";
const kai = (text: string): DialogLine => ({ speaker: "Kai", text, color: KAI });
const lou = (text: string): DialogLine => ({ speaker: "Lou", text, color: LOU });
const mar = (text: string): DialogLine => ({ speaker: "Marisol", text, color: MARISOL });
const dock = (text: string): DialogLine => ({ speaker: "Teo (Kai 9)", text, color: DOCK });
const vale = (text: string): DialogLine => ({ speaker: "Dorian Vale", text, color: VALE });
const ines = (text: string): DialogLine => ({ speaker: "Ines (Hafenamt)", text, color: INES });
const ruiz = (text: string): DialogLine => ({ speaker: "Kommissarin Ruiz", text, color: RUIZ });

// story: Kai Romero comes back to Solara Bay; the developer Dorian Vale buys up the bay with gang money
export const MISSIONS: MissionDef[] = [
  {
    id: "m1", title: "Heimkehr", giver: "lou", requires: [], reward: 300,
    intro: [lou("Kai Romero. Fünf Jahre weg und kein einziger Anruf."), kai("Ich bin ja jetzt da. Was ist aus der Stadt geworden?"), lou("Vale kauft alles auf. Wer nicht verkauft, hat plötzlich Ärger. Besorg dir erst mal einen fahrbaren Untersatz und bring ihn her.")],
    steps: [
      { kind: "goto", text: "Besorg dir ein Auto", at: { place: "lou" }, radius: 9999, inCar: true },
      { kind: "deliver", text: "Bring das Auto zu Lous Werkstatt", at: { place: "lou", car: true } },
    ],
    outro: [lou("Nicht schlecht. Du hast es noch drauf."), lou("Hier, ein paar Dollar für den Anfang. Und halt dich von Vales Leuten fern – vorerst.")],
  },
  {
    id: "m2", title: "Ersatzteile", giver: "lou", requires: ["m1"], reward: 600,
    intro: [lou("Ich brauche einen Corsaro. Der Motor ist Gold wert."), lou("Einer steht drüben beim Strand. Hol ihn, bevor der Besitzer zurück ist – du hast zwei Minuten.")],
    steps: [
      { kind: "steal", text: "Klau den Corsaro", model: "sport", color: "#c9a227", at: { node: [1, 7] }, time: 120 },
      { kind: "deliver", text: "Bring den Corsaro zu Lou", at: { place: "lou", car: true }, model: "sport" },
    ],
    outro: [lou("Wunderschön. Der Motor kommt in deinen nächsten Wagen – bei mir kriegst du ab jetzt Tuning in der Werkstatt 'Lack & Turbo'.")],
  },
  {
    id: "m3", title: "Kaffee und Gerüchte", giver: "marisol", requires: ["m1"], reward: 500,
    intro: [mar("Lou sagt, du bist zuverlässig. Mal sehen."), mar("Ein Freund hat ein Päckchen am Kai versteckt, bevor Vales Leute ihn erwischt haben. Hol es und bring es zu mir.")],
    steps: [
      { kind: "pickup", text: "Hol das Päckchen am Hafen", at: { node: [10, 9] }, time: 150 },
      { kind: "deliver", text: "Bring das Päckchen ins Café Marisol", at: { place: "marisol", car: true } },
    ],
    outro: [mar("Bauunterlagen. Vale will den ganzen Strand plattmachen."), mar("Die Halcones im Hafen arbeiten für ihn. Das wird ihnen nicht gefallen, dass wir das haben.")],
  },
  {
    id: "m4", title: "Rote Flaggen", giver: "marisol", requires: ["m3"], reward: 900, rep: { halcones: -40 },
    intro: [mar("Die Halcones treiben im Hafen Schutzgeld ein – auch von meinem Bruder."), mar("Vier von ihnen hängen am Ostkai rum. Mach ihnen klar, dass das aufhört.")],
    steps: [
      { kind: "kill", text: "Schalte die Halcones am Ostkai aus", at: { node: [9, 8] }, n: 4, faction: "halcones" },
      { kind: "escape", text: "Werd die Polizei los", stars: 2 },
    ],
    outro: [mar("Mein Bruder hat angerufen. Heute war keiner da."), mar("Pass auf dich auf, Kai. Die Halcones vergessen so etwas nicht.")],
  },
  {
    id: "m5", title: "Schnelle Runde", giver: "lou", requires: ["m2"], reward: 800,
    intro: [lou("Vales Neffe fährt nachts Rennen um die halbe Stadt. Ich hab gewettet, dass du schneller bist."), lou("Fahr die Strecke unter der Zeit. Nimm ein schnelles Auto.")],
    steps: [
      { kind: "goto", text: "Fahr zum Start an der Kreuzung", at: { node: [3, 2] }, inCar: true, radius: 60 },
      { kind: "race", text: "Rennen: alle Checkpoints!", time: 95, points: [{ node: [6, 2] }, { node: [9, 2] }, { node: [9, 5] }, { node: [6, 5] }, { node: [6, 8] }, { node: [3, 8] }, { node: [3, 5] }, { node: [3, 2] }] },
    ],
    outro: [lou("Ha! Der Kleine ist kreidebleich. Das Geld gehört dir.")],
  },
  {
    id: "m6", title: "Geldkurier", giver: "dock", requires: ["m3"], reward: 1500,
    intro: [dock("Ich bin Teo. Marisol schickt dich?"), dock("Vale lässt jeden Tag einen gepanzerten Transporter Geld durch die Stadt fahren. Heute fährt er über die Hauptstraße."), dock("Hol dir das Geld – der Wagen hält einiges aus.")],
    steps: [
      { kind: "destroy", text: "Zerstör den Geldtransporter", model: "swat", color: "#3a3d45", at: { node: [5, 3] }, hp: 420, flee: true, time: 180 },
      { kind: "pickup", text: "Schnapp dir den Geldkoffer", at: { last: true } },
      { kind: "deliver", text: "Bring den Koffer zu Kai 9", at: { place: "dock", car: true } },
    ],
    outro: [dock("Das wird Vale wehtun. Teilen wir's?"), kai("Nimm deinen Anteil. Ich will an Vale selbst ran.")],
  },
  {
    id: "m7", title: "Heiße Ware", giver: "dock", requires: ["m6"], reward: 1200,
    intro: [dock("Ich brauche einen Streifenwagen für eine Sache am Hafen. Frag nicht."), dock("Klau einen, schüttel die Cops ab und bring ihn her.")],
    steps: [
      { kind: "steal", text: "Klau den Streifenwagen", model: "police", color: "#f4f6fa", at: { node: [7, 4] } },
      { kind: "escape", text: "Werd die Polizei los", stars: 3 },
      { kind: "deliver", text: "Bring den Streifenwagen zu Kai 9", at: { place: "dock", car: true }, model: "police" },
    ],
    outro: [dock("Perfekt. Damit kommen wir nächste Woche in Vales Lagerhalle.")],
  },
  {
    id: "m8", title: "Neonnacht", giver: "marisol", requires: ["m4", "m6"], reward: 1500, rep: { kings: -40 },
    intro: [mar("Die Neon Kings aus dem Eisenwerk haben das Café verwüstet. Vale hat sie geschickt, das weiß ich."), mar("Fünf von ihnen stehen vor ihrer Halle. Zeig ihnen, wie wir hier Nachbarschaft machen.")],
    steps: [
      { kind: "kill", text: "Schalte die Neon Kings im Eisenwerk aus", at: { node: [9, 2] }, n: 5, faction: "kings" },
      { kind: "escape", text: "Werd die Polizei los", stars: 2 },
    ],
    outro: [mar("Danke, Kai. Jetzt weiß Vale, wer du bist."), vale("Kai Romero. Du störst meine Geschäfte. Verlass die Stadt, solange du noch kannst.")],
  },
  {
    id: "m9", title: "Vales Liebling", giver: "lou", requires: ["m5", "m7"], reward: 2000,
    intro: [lou("Vale liebt nur eins mehr als Geld: seine Zephyra. Er lässt sie gerade zur Waschanlage fahren."), lou("Mach sie platt, bevor der Fahrer in seiner Tiefgarage verschwindet.")],
    steps: [
      { kind: "destroy", text: "Zerstör Vales Zephyra", model: "super", color: "#f4f4f6", at: { node: [2, 4] }, hp: 220, flee: true, time: 150 },
      { kind: "escape", text: "Werd die Polizei los", stars: 2 },
    ],
    outro: [lou("Ich hab's im Radio gehört. Vale tobt."), lou("Teo will dich sprechen. Er sagt, es ist so weit.")],
  },
  {
    id: "m10", title: "Die Bucht gehört uns", giver: "dock", requires: ["m8", "m9"], reward: 5000, rep: { kings: -20, halcones: 20 },
    intro: [dock("Vale sitzt heute in seinem Turm im Zentrum. Seine Neon Kings bewachen den Eingang."), dock("Mit den Papieren von Marisol und deinem Auftritt ist er erledigt – wenn wir ihn vertreiben."), kai("Dann los.")],
    steps: [
      { kind: "goto", text: "Fahr zu Vales Turm im Zentrum", at: { node: [5, 5] }, radius: 80 },
      { kind: "kill", text: "Schalte Vales Wachen aus", at: { node: [5, 5] }, n: 6, faction: "kings" },
      { kind: "talk", lines: [vale("Du hast keine Ahnung, mit wem du dich anlegst!"), kai("Mit einem Mann, der gerade seine Stadt verliert."), vale("Das ist nicht vorbei, Romero!")] },
      { kind: "escape", text: "Entkomme der Polizei", stars: 4 },
      { kind: "goto", text: "Zurück zum Safehouse", at: { place: "safehouse" }, radius: 30 },
    ],
    outro: [dock("Vale hat die Stadt verlassen. Die Baupläne liegen bei der Zeitung."), mar("Der Strand bleibt, wie er ist. Danke, Kai."), lou("Und jetzt? Die Stadt gehört dir. Fahr vorsichtig – oder auch nicht."), kai("Solara Bay. Endlich wieder zu Hause.")],
  },
  // ---------------- chapter 2: Vale's money leaves the city over the water; the police wants him too
  {
    id: "m11", title: "Spuren im Wasser", giver: "ines", requires: ["m3"], reward: 900,
    intro: [ines("Du bist der, der Marisol die Baupläne gebracht hat? Ich bin Ines vom Hafenamt."), ines("Nachts fahren Schnellboote ohne Licht durch die Bucht. Vales Geld, da bin ich sicher."), ines("Am Bootssteg liegt ein Speedboot. Versenk den Schmuggler.")],
    steps: [
      { kind: "goto", text: "Steig am Bootssteg ins Speedboot", at: { place: "jetty" }, radius: 9999, vehicle: "boat" },
      { kind: "destroy", text: "Versenk das Schmugglerboot", model: "boat", color: "#2b2f3a", at: { xy: [-1500, 3200] }, hp: 140, flee: true, time: 150 },
      { kind: "pickup", text: "Fisch die Kiste aus dem Wasser", at: { last: true } },
      { kind: "goto", text: "Zurück zum Bootssteg", at: { place: "jetty" }, radius: 120 },
    ],
    outro: [ines("Falschgeld und Frachtpapiere mit Vales Firmenstempel."), ines("Damit kann ich arbeiten. Lass das Boot einfach am Steg.")],
  },
  {
    id: "m12", title: "Landung auf dem Turm", giver: "ines", requires: ["m11"], reward: 1400,
    intro: [ines("Vales Leute holen die Ware vom Dach eines Hochhauses im Zentrum ab – per Hubschrauber."), ines("Am Heliport östlich vom Hafen steht einer. Flieg hin, lande auf dem Dach und schnapp dir die Tasche vor ihnen.")],
    steps: [
      { kind: "goto", text: "Steig am Heliport in den Hubschrauber", at: { place: "helipad" }, radius: 9999, vehicle: "heli" },
      { kind: "goto", text: "Lande auf dem markierten Dach", at: { roof: [5, 4] }, radius: 70, vehicle: "heli", landed: true, time: 120 },
      { kind: "talk", lines: [kai("Die Tasche ist hier. Und unten fahren schon ihre Autos vor."), ines("Dann nichts wie weg. Flieg zurück zum Heliport.")] },
      { kind: "goto", text: "Flieg zurück zum Heliport und lande", at: { place: "helipad" }, radius: 110, vehicle: "heli", landed: true },
    ],
    outro: [ines("Bankdaten. Vale hat Konten bei Banken, die es gar nicht gibt."), ines("Kommissarin Ruiz will dich treffen. Keine Sorge – sie ist eine von den Guten.")],
  },
  {
    id: "m13", title: "Kein Name, keine Fragen", giver: "ruiz", requires: ["m12"], reward: 1200,
    intro: [ruiz("Romero. Ich weiß, was du getan hast – und dass es Vale schadet. Deshalb sitzt du nicht in einer Zelle."), ruiz("Einer von Vales Boten verkauft am Markt Informationen. Fang ihn – zu Fuß, ohne Schießerei.")],
    steps: [
      { kind: "goto", text: "Fahr zum Markt", at: { node: [4, 6] }, radius: 120 },
      { kind: "catch", text: "Fang den Boten (berühren oder niederschlagen)", at: { node: [4, 6] }, time: 90 },
      { kind: "talk", lines: [kai("Der Bote redet. Vale trifft sich morgen mit den Neon Kings."), ruiz("Gute Arbeit. Ich melde mich.")] },
    ],
    outro: [ruiz("Offiziell kennen wir uns nicht. Inoffiziell: Danke.")],
  },
  {
    id: "m14", title: "Funkstille", giver: "ruiz", requires: ["m13"], reward: 1800, rep: { kings: -30 },
    intro: [ruiz("Die Neon Kings haben einen Wagen mit Vales Funkgeräten. Ohne die sind sie blind."), ruiz("Stopp den Wagen und die Leute, die ihn bewachen. Meine Kollegen schauen in der Zeit woanders hin – nicht lange.")],
    steps: [
      { kind: "destroy", text: "Zerstör den Funkwagen der Neon Kings", model: "van", color: "#7d3c98", at: { node: [8, 2] }, hp: 260, flee: true, time: 150 },
      { kind: "kill", text: "Schalte die Wachen aus", at: { last: true }, n: 3, faction: "kings" },
      { kind: "escape", text: "Werd die Polizei los", stars: 2 },
    ],
    outro: [ruiz("Funkstille im Eisenwerk. Perfekt."), ruiz("Aber jetzt sucht Vale dich persönlich. Pass auf.")],
  },
  {
    id: "m15", title: "Versteckspiel", giver: "marisol", requires: ["m10"], reward: 1500,
    intro: [mar("Kai! Vales Anwalt hat dich angezeigt. Die halbe Polizei sucht dich."), mar("Du kannst nicht ewig fahren. Versteck dich – unter Bäumen, hinter Häusern, in einem geparkten Auto – bis sich die Lage beruhigt.")],
    steps: [
      { kind: "hide", text: "Bleib vor der Polizei versteckt", stars: 3, time: 40 },
      { kind: "goto", text: "Komm ins Café Marisol", at: { place: "marisol" }, radius: 30 },
    ],
    outro: [mar("Ruiz hat die Anzeige verschwinden lassen. Du hast mächtige Freunde, Kai.")],
  },
  {
    id: "m16", title: "Hafenrundfahrt", giver: "ines", requires: ["m12"], reward: 1600,
    intro: [ines("Vales Schmuggler prahlen, niemand fährt die Bucht schneller als sie."), ines("Beweis das Gegenteil: einmal um die Bojen und zurück, im Speedboot.")],
    steps: [
      { kind: "goto", text: "Steig am Bootssteg ins Speedboot", at: { place: "jetty" }, radius: 9999, vehicle: "boat" },
      { kind: "race", text: "Bootsrennen: alle Bojen!", time: 75, points: [{ xy: [-900, 3300] }, { xy: [-1900, 3500] }, { xy: [-2600, 3100] }, { xy: [-2500, 2000] }, { xy: [-1500, 1900] }, { xy: [-700, 2200] }, { xy: [-400, 3300] }] },
    ],
    outro: [ines("Die Schmuggler haben's gesehen. Die prahlen nicht mehr.")],
  },
  {
    id: "m17", title: "Die letzte Lieferung", giver: "dock", requires: ["m10"], reward: 2500,
    intro: [dock("Vale ist weg, aber sein Geld nicht. Ein Transporter bringt heute alles zum Flughafen."), dock("Wenn wir den kriegen, kommt er nie wieder auf die Beine. Das gibt Ärger – richtig Ärger.")],
    steps: [
      { kind: "destroy", text: "Zerstör den Geldtransporter", model: "swat", color: "#3a3d45", at: { node: [6, 1] }, hp: 520, flee: true, time: 180 },
      { kind: "pickup", text: "Schnapp dir die Geldkoffer", at: { last: true } },
      { kind: "escape", text: "Entkomme der Polizei", stars: 4 },
      { kind: "deliver", text: "Bring das Geld zu Kai 9", at: { place: "dock", car: true } },
    ],
    outro: [dock("Das reicht für neue Dächer im ganzen Hafenviertel."), dock("Aber Vale hat Freunde beim Militär. Hast du die Panzerwagen am Rand der Stadt gesehen?")],
  },
  {
    id: "m18", title: "Doppelspiel", giver: "ruiz", requires: ["m14", "m15"], reward: 2000,
    intro: [ruiz("Vales Anwalt Brenner will heute die Stadt verlassen – mit allen Akten."), ruiz("Er läuft vom Café zum Bahnhof. Hol ihn dir, bevor er abtaucht.")],
    steps: [
      { kind: "goto", text: "Fahr zum Treffpunkt", at: { node: [2, 7] }, radius: 120 },
      { kind: "catch", text: "Fang Brenner zu Fuß", at: { node: [2, 7] }, time: 80 },
      { kind: "talk", lines: [vale("(am Telefon) Brenner? Brenner!"), kai("Brenner redet jetzt mit der Polizei, Vale. Wo bist du?"), vale("Da, wo du mich nie findest.")] },
      { kind: "escape", text: "Werd die Polizei los", stars: 2 },
    ],
    outro: [ruiz("Brenner hat ausgepackt. Vale versteckt sich auf seiner Jacht in der Bucht."), ruiz("Ines weiß mehr.")],
  },
  {
    id: "m19", title: "Sperrgebiet", giver: "dock", requires: ["m17"], reward: 3000,
    intro: [dock("Vale hat sich einen Radpanzer beschafft, um ihn im Hafen zu verstecken."), dock("Der steht im Industriegebiet. Klau ihn, bevor er verschifft wird – und überleb die Antwort.")],
    steps: [
      { kind: "steal", text: "Klau den Radpanzer", model: "armor", color: "#4b5320", at: { node: [10, 1] } },
      { kind: "escape", text: "Schüttel Polizei und Militär ab", stars: 5 },
      { kind: "deliver", text: "Bring den Radpanzer zu Kai 9", at: { place: "dock", car: true }, model: "armor" },
    ],
    outro: [dock("Den kriegt Vale nicht zurück. Jetzt bleibt ihm nur noch das Wasser.")],
  },
  {
    id: "m20", title: "Vales Flucht", giver: "ines", requires: ["m16", "m18", "m19"], reward: 8000, rep: { halcones: 20, kings: 20 },
    intro: [ines("Vales Jacht hat Anker gelichtet. Er will über die offene Bucht raus."), ines("Nimm das Speedboot. Ruiz' Leute warten auf der anderen Seite – du musst ihn nur stoppen."), kai("Diesmal entkommt er nicht.")],
    steps: [
      { kind: "goto", text: "Steig am Bootssteg ins Speedboot", at: { place: "jetty" }, radius: 9999, vehicle: "boat" },
      { kind: "destroy", text: "Stopp Vales Jacht", model: "boat", color: "#f4f4f6", at: { xy: [-2200, 2300] }, hp: 320, flee: true, time: 200 },
      { kind: "talk", lines: [vale("Hör auf! Ich ... ich ergebe mich."), ruiz("(über Funk) Wir haben ihn, Romero. Diesmal endgültig."), kai("Dann ist die Bucht frei.")] },
      { kind: "goto", text: "Zurück zum Safehouse", at: { place: "safehouse" }, radius: 30 },
    ],
    outro: [ines("Der Hafen gehört wieder den Leuten, die hier arbeiten."), ruiz("Vale sitzt. Und du, Romero ... bleib sauber. Zumindest ein bisschen."), mar("Komm vorbei, der Kaffee geht aufs Haus. Für immer."), kai("Solara Bay. Jetzt wirklich zu Hause.")],
  },
];

// ---------------------------------------------------------------- runner
export interface Marker { x: number; y: number; color: string; kind: "goal" | "contact" | "enemy" | "race" | "pickup"; label: string; }

const GOAL = "#ffd23f";

export class Missions {
  active: MissionDef | null = null;
  stepI = 0;
  timer = -1;
  markers: Marker[] = [];
  private target: Car | null = null;
  private enemies: Civilian[] = [];
  private raceI = 0;
  private stepStarted = false;

  constructor(private g: Game) {}

  // next story mission each contact offers
  available(giver: string): MissionDef | null {
    const done = this.g.progress.missions;
    for (const m of MISSIONS) if (m.giver === giver && !done.includes(m.id) && m.requires.every((r) => done.includes(r))) return m;
    return null;
  }
  get done() { return this.g.progress.missions.length; }

  pos(l: Loc): { x: number; y: number } {
    if ("place" in l) {
      const pl = this.g.places.find((p) => p.id === l.place);
      if (!pl) return { x: 0, y: 0 };
      return l.car ? { x: pl.cx, y: pl.cy } : { x: pl.x, y: pl.y };
    }
    if ("node" in l) return { x: oldNode(l.node[0]) * BLOCK + ROAD / 2, y: oldNode(l.node[1]) * BLOCK + ROAD / 2 }; // story data uses the old grid
    if ("last" in l) return this.lastPos;
    if ("roof" in l) {
      const b = this.g.world.blocks[oldNode(l.roof[1]) * GRID + oldNode(l.roof[0])];
      let best = b?.buildings[0];
      for (const bd of b?.buildings ?? []) if (best && roofOf(bd) > roofOf(best)) best = bd;
      return best ? { x: best.x + best.w / 2, y: best.y + best.h / 2 } : { x: 0, y: 0 };
    }
    return { x: l.xy[0], y: l.xy[1] };
  }
  private lastPos = { x: 0, y: 0 };
  private suspect: Civilian | null = null; // catch steps
  private hiddenT = 0;                     // hide steps: seconds out of sight
  private spawned = false; // targets of the current step exist (they appear when you get close)

  // a contact was visited (E); returns true if something happened
  talk(giver: string): boolean {
    const g = this.g;
    if (this.active) { g.say([{ speaker: "Kai", text: "Erst den laufenden Auftrag erledigen.", color: KAI }], null); return true; }
    if (g.jobs.active || g.hide.active) { g.say([{ speaker: "Kai", text: "Erst den Job zu Ende bringen.", color: KAI }], null); return true; }
    const m = this.available(giver);
    const pl = g.places.find((p) => p.id === giver);
    if (!m) {
      const all = MISSIONS.filter((x) => x.giver === giver).every((x) => g.progress.missions.includes(x.id));
      g.say([{ speaker: pl?.name ?? "", text: all ? "Für dich hab ich nichts mehr. Genieß die Stadt." : "Gerade hab ich nichts für dich. Schau dich woanders um.", color: "#ffffff" }], pl ? { x: pl.x, y: pl.y, a: pl.a } : null);
      return true;
    }
    if (g.wanted.stars > 0) { g.say([{ speaker: pl?.name ?? "", text: "Nicht mit den Cops im Nacken! Häng sie erst ab.", color: "#ffffff" }], null); return true; }
    g.say(m.intro, pl ? { x: pl.x, y: pl.y, a: pl.a } : null, () => this.begin(m));
    return true;
  }

  private begin(m: MissionDef) {
    this.active = m; this.stepI = 0; this.stepStarted = false;
    this.g.banner(m.title.toUpperCase(), "Mission gestartet", GOAL, 2);
  }

  fail(reason: string) {
    if (!this.active) return;
    this.cleanup();
    this.active = null;
    sfx.fail();
    this.g.banner("MISSION GESCHEITERT", reason, "#ff4d4d", 2.6);
  }

  private complete() {
    const m = this.active!, g = this.g;
    this.cleanup();
    this.active = null;
    g.progress.missions.push(m.id);
    g.addCash(m.reward);
    if (m.rep) for (const [f, v] of Object.entries(m.rep) as [FactionId, number][]) g.progress.rep[f] = Math.max(-100, Math.min(100, g.progress.rep[f] + v));
    sfx.success();
    g.banner("MISSION ERFÜLLT", `${m.title} · +$${m.reward.toLocaleString("de-DE")}`, "#3dff8b", 3);
    const pl = g.places.find((p) => p.id === m.giver);
    g.saveSoon();
    if (m.id === "m10") g.banner("SOLARA BAY", "Kapitel 1 abgeschlossen – neue Aufträge bei Ines und Kommissarin Ruiz", "#ff3cac", 4);
    if (m.id === "m20") g.banner("SOLARA BAY", "Story abgeschlossen – die Stadt gehört dir", "#ff3cac", 4);
    window.setTimeout(() => { if (g.state === "playing") g.say(m.outro, pl ? { x: pl.x, y: pl.y, a: pl.a } : null); }, 600);
  }

  private cleanup() {
    if (this.target) { this.target.tag = ""; this.target.flee = false; this.target.keep = false; }
    this.target = null;
    for (const e of this.enemies) e.tag = "";
    this.enemies = [];
    if (this.suspect && this.suspect.active) this.suspect.tag = "";
    this.suspect = null; this.hiddenT = 0;
    this.timer = -1; this.raceI = 0; this.stepStarted = false;
    this.g.objective = ""; this.g.objTimer = -1;
  }

  private next() {
    this.stepI++; this.stepStarted = false; this.timer = -1;
    this.target = null; this.enemies = []; this.raceI = 0; this.suspect = null; this.hiddenT = 0;
    sfx.checkpoint();
    if (this.active && this.stepI >= this.active.steps.length) this.complete();
  }

  // set the timer and do what a step needs right away (escape, dialog)
  private startStep(s: Step) {
    const g = this.g;
    this.stepStarted = true; this.spawned = false;
    this.timer = "time" in s && s.time ? s.time : -1;
    if (s.kind === "escape" || s.kind === "hide") {
      g.wanted.heat = Math.max(g.wanted.heat, STAR_HEAT[s.stars]); g.wanted.lostT = 0;
      g.wanted.syncStars(); // otherwise the step would count as escaped before the stars show up
    } else if (s.kind === "talk") {
      g.say(s.lines, { x: g.fx, y: g.fy }, () => this.next());
    }
  }

  // cars and enemies appear once the player is close (far away they would be cleaned up again)
  private spawnTargets(s: Step) {
    const g = this.g;
    if (s.kind !== "steal" && s.kind !== "destroy" && s.kind !== "kill" && s.kind !== "catch") return;
    const p = this.pos(s.at);
    if (Math.hypot(g.fx - p.x, g.fy - p.y) > 750) return;
    this.spawned = true;
    if (s.kind === "catch") {
      // on a real sidewalk near the goal (not inside a building or on the street)
      const sp = g.world.curbPoint(p.x, p.y, 0, 260) ?? { x: p.x, y: p.y };
      const c = g.peds.spawnRole("target", sp.x, sp.y);
      if (c) { c.tag = "suspect"; c.shirt = "#e8e8ec"; c.pants = "#2b2f3a"; c.hp = c.maxHp = 40; g.peds.panic(c, g.fx, g.fy, 30); }
      this.suspect = c;
      return;
    }
    if (s.kind === "kill") {
      const base = g.world.curbPoint(p.x, p.y, 0, 260) ?? { x: p.x, y: p.y };
      for (let i = 0; i < s.n; i++) {
        const a = (i / s.n) * Math.PI * 2;
        let ex = base.x + Math.cos(a) * 30, ey = base.y + Math.sin(a) * 30;
        if (g.world.isSolid(ex, ey, 6) || isWater(ex, ey)) { ex = base.x; ey = base.y; }
        const e = g.peds.spawnRole("gang", ex, ey, s.faction);
        if (e) { e.tag = "target"; this.enemies.push(e); }
      }
      return;
    }
    const c = new Car("civ", s.model, s.color);
    const boat = s.model === "boat";
    c.x = boat ? p.x : p.x + 10; c.y = boat ? p.y : p.y + 34; c.a = 0; c.z = boat ? WATER_Y : terrainH(c.x, c.y);
    c.hp = c.maxHp = s.kind === "destroy" ? s.hp : s.model === "armor" ? 600 : 120; c.mass = s.model === "swat" ? 2 : s.model === "armor" ? 4 : 1.2;
    c.tag = s.kind === "steal" ? "steal" : "target"; c.keep = true;
    if (s.kind === "destroy") { c.flee = s.flee; c.driver = true; c.cruise = 250; c.route = false; }
    else { c.parked = true; c.handbrake = true; }
    g.cars.push(c);
    this.target = c;
  }

  update(dt: number) {
    const g = this.g, m = this.active;
    this.markers.length = 0;
    // contacts with a mission show a marker
    if (!m) {
      for (const pl of g.places) if (pl.kind === "contact" && this.available(pl.id)) this.markers.push({ x: pl.x, y: pl.y, color: "#ff5ad1", kind: "contact", label: pl.icon });
      return;
    }
    const s = m.steps[this.stepI];
    if (!s) return;
    if (!this.stepStarted) this.startStep(s);
    if (s.kind === "talk") { g.objective = ""; return; }
    g.objective = s.text;
    if (this.timer >= 0) {
      this.timer -= dt;
      g.objTimer = Math.max(0, this.timer);
      if (this.timer <= 0) { this.fail("Die Zeit ist abgelaufen"); return; }
    } else g.objTimer = -1;
    const fx = g.fx, fy = g.fy;
    const inCar = !g.onFoot && !g.player.dead && !g.playerCarStored;
    switch (s.kind) {
      case "goto": {
        const p = this.pos(s.at), r = s.radius ?? 40;
        if (r < 9000 || s.vehicle) this.markers.push({ x: p.x, y: p.y, color: GOAL, kind: "goal", label: "" });
        const rightVehicle = !s.vehicle || (inCar && g.player.model === s.vehicle);
        const down = !s.landed || (inCar && g.player.z <= g.groundAt(g.player.x, g.player.y) + 2 && g.player.speed < 60);
        if (s.landed && rightVehicle && !down && Math.hypot(fx - p.x, fy - p.y) < r) g.objective = `${s.text} (Shift / RUNTER zum Landen)`;
        if ((!s.inCar || inCar) && rightVehicle && down && Math.hypot(fx - p.x, fy - p.y) < r) this.next();
        break;
      }
      case "catch": {
        if (!this.spawned) this.spawnTargets(s);
        const c = this.suspect;
        if (!c) { const p = this.pos(s.at); this.markers.push({ x: p.x, y: p.y, color: "#ffd23f", kind: "enemy", label: "" }); break; }
        if (!c.active) { this.fail("Er ist entkommen"); return; }
        this.markers.push({ x: c.x, y: c.y, color: "#ffd23f", kind: "enemy", label: "" });
        const d = Math.hypot(c.x - fx, c.y - fy);
        if (c.state !== "down" && c.state !== "flee") g.peds.panic(c, fx, fy, 30); // keeps running
        if (!g.onFoot) g.objective = `${s.text} – steig aus!`;
        if (c.state === "down" || (g.onFoot && d < 20)) { c.active = false; c.tag = ""; this.suspect = null; g.banner("GESCHNAPPT", "", "#3d8bff", 1.2); this.next(); break; }
        if (d > 1400) { this.fail("Er ist entkommen"); return; }
        break;
      }
      case "hide": {
        // the police looks for you: every second out of their sight counts
        if (!g.police.seen) this.hiddenT += dt;
        g.objective = `${s.text}: ${Math.floor(this.hiddenT)}/${s.time} s`;
        if (this.hiddenT >= s.time || g.wanted.stars === 0) { g.wanted.clear(); this.next(); }
        break;
      }
      case "steal": {
        if (!this.spawned) this.spawnTargets(s);
        const c = this.target;
        if (!c) { const p = this.pos(s.at); this.markers.push({ x: p.x, y: p.y, color: "#3d8bff", kind: "goal", label: "" }); break; }
        if (c.dead) { this.fail("Das Auto ist Schrott"); return; }
        if (inCar && g.player.model === s.model && !g.cars.includes(c)) { this.next(); break; } // you took it
        this.markers.push({ x: c.x, y: c.y, color: "#3d8bff", kind: "goal", label: "" });
        break;
      }
      case "deliver": {
        const p = this.pos(s.at);
        this.markers.push({ x: p.x, y: p.y, color: GOAL, kind: "goal", label: "" });
        const needCar = !!s.model || ("place" in s.at && !!s.at.car);
        const rightCar = !s.model || (inCar && g.player.model === s.model);
        if (s.model && !rightCar) g.objective = `${s.text} (im richtigen Auto)`;
        if (Math.hypot(fx - p.x, fy - p.y) < 46 && (!needCar || inCar) && rightCar) this.next();
        break;
      }
      case "destroy": {
        if (!this.spawned) this.spawnTargets(s);
        const c = this.target;
        if (!c) { const p = this.pos(s.at); this.markers.push({ x: p.x, y: p.y, color: "#ff4d4d", kind: "enemy", label: "" }); break; }
        if (c.dead) { this.lastPos = { x: c.x, y: c.y }; this.next(); break; }
        if (!g.cars.includes(c)) { this.fail("Das Ziel ist entkommen"); return; }
        this.markers.push({ x: c.x, y: c.y, color: "#ff4d4d", kind: "enemy", label: "" });
        if (Math.hypot(c.x - fx, c.y - fy) > 1700) { this.fail("Das Ziel ist entkommen"); return; }
        break;
      }
      case "kill": {
        if (!this.spawned) this.spawnTargets(s);
        let left = 0;
        for (const e of this.enemies) {
          if (e.active && e.state !== "down") { left++; this.markers.push({ x: e.x, y: e.y, color: "#ff4d4d", kind: "enemy", label: "" }); }
        }
        if (!this.enemies.length) { const p = this.pos(s.at); this.markers.push({ x: p.x, y: p.y, color: "#ff4d4d", kind: "enemy", label: "" }); break; }
        // enemies attack once you are close
        for (const e of this.enemies) if (e.active && e.state === "idle" && Math.hypot(e.x - fx, e.y - fy) < 320) e.state = "attack";
        g.objective = `${s.text} (${left} übrig)`;
        if (left === 0) this.next();
        break;
      }
      case "pickup": {
        const p = this.pos(s.at);
        this.markers.push({ x: p.x, y: p.y, color: "#3dff8b", kind: "pickup", label: "" });
        if (Math.hypot(fx - p.x, fy - p.y) < (inCar ? 46 : 28)) { sfx.powerup(); this.next(); }
        break;
      }
      case "escape": {
        if (g.wanted.stars === 0) this.next();
        break;
      }
      case "race": {
        const p = this.pos(s.points[this.raceI]);
        this.markers.push({ x: p.x, y: p.y, color: "#2bf0ff", kind: "race", label: String(this.raceI + 1) });
        g.objective = `${s.text} ${this.raceI + 1}/${s.points.length}`;
        if (inCar && Math.hypot(fx - p.x, fy - p.y) < 70) {
          this.raceI++; sfx.checkpoint();
          if (this.raceI >= s.points.length) this.next();
        }
        break;
      }
    }
  }
}
