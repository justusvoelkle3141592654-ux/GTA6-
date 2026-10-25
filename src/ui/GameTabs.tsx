import { useState } from "react";
import type { Game } from "../core/engine";
import { JOB_DEFS, JOB_KINDS, LEVEL_REWARD, RACES, jobLevel, jobLevelProgress, type JobKind } from "../gameplay/jobs";
import { DIFF_NAME, MODE_NAME, MODE_RULES, ROUND_CHOICES, type HideDiff, type HideMode } from "../gameplay/hide";
import { MISSIONS } from "../gameplay/missions";
import { MODEL_NAME } from "../vehicles/vehicles";
import { STATIONS } from "../audio/radio";
import Icon from "./icons";
import { Toast, fmt } from "./ui";

// shared looks of the menu pages (pause menu and phone): design system classes from index.css
const card = "sb-card";
const btn = "sb-btn sb-btn-sm";
const btnHi = "sb-btn sb-btn-sm sb-btn-primary";
const h3 = "sb-h3";

// ---------------------------------------------------------------- jobs (pause menu tab and phone app)
export function JobsTab({ game, onDone, compact = false }: { game: Game; onDone: () => void; compact?: boolean }) {
  const [msg, setMsg] = useState("");
  const [, redraw] = useState(0);
  const jobs = game.jobs, active = jobs.active;
  const pr = game.progress;
  return (
    <div className="space-y-3">
      {active && (
        <div className={card + " is-active flex items-center justify-between gap-3"}>
          <div className="flex items-center gap-3"><Icon name={active.kind} size={28} className="text-sun-400" /><div><div className="sb-h3">{JOB_DEFS[active.kind].name} läuft</div><div className="text-xs text-fog-500">{active.count} erledigt · Serie: alle 5 Aufträge $500 Bonus</div></div></div>
          <button className={btn} onClick={() => { jobs.stop("Job beendet"); redraw((n) => n + 1); }}>Job beenden</button>
        </div>
      )}
      {jobs.delivery && <div className={card + " text-sm text-fog-100"}>{MODEL_NAME[jobs.delivery.model]} {jobs.delivery.car ? "steht bereit – Markierung auf der Karte" : `kommt in ${Math.ceil(jobs.delivery.t)} s`}</div>}
      <div className={"grid gap-2 " + (compact ? "grid-cols-1" : "@lg:grid-cols-2 @4xl:grid-cols-3")}>
        {JOB_KINDS.map((k) => <JobCard key={k} game={game} k={k} onPick={(m) => { setMsg(m); redraw((n) => n + 1); if (!jobs.blocked(k)) onDone(); }} />)}
      </div>
      {msg && <Toast>{msg}</Toast>}
      <div className={card + " text-xs text-fog-300"}>
        <div className="sb-h3 mb-1 text-lg">Rekorde</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 @2xl:grid-cols-4">
          <span>Weitester Sprung</span><b>{pr.records.jumpDist ? `${pr.records.jumpDist.toFixed(1).replace(".", ",")} m` : "–"}</b>
          <span>Längste Zeit in der Luft</span><b>{pr.records.airTime ? `${pr.records.airTime.toFixed(2).replace(".", ",")} s` : "–"}</b>
          {RACES.map((r) => [<span key={r.id + "n"}>{r.name}</span>, <b key={r.id}>{pr.records[r.id] ? `${pr.records[r.id].toFixed(1).replace(".", ",")} s` : "–"}</b>])}
        </div>
      </div>
    </div>
  );
}

function JobCard({ game, k, onPick }: { game: Game; k: JobKind; onPick: (msg: string) => void }) {
  const d = JOB_DEFS[k], done = game.jobs.done(k), lvl = jobLevel(done), prog = jobLevelProgress(done);
  const why = game.jobs.blocked(k), best = game.jobs.best(k), running = game.jobs.active?.kind === k;
  const veh = d.models.length ? d.models.map((m) => MODEL_NAME[m]).join(" / ") + (d.foot ? " / zu Fuß" : "") : k === "hunter" ? "beliebig, auch zu Fuß" : "eigenes Auto";
  const next = [4, 7, 10].find((l) => l > lvl);
  return (
    <div className={card + " flex flex-col gap-1.5 " + (running ? "is-active" : "")}>
      <div className="flex items-start gap-2">
        <div className="rounded-[4px] border border-white/10 bg-white/[0.05] p-2 text-fog-100"><Icon name={k} size={24} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2"><span className="sb-h3">{d.name}</span><span className="text-[11px] font-semibold uppercase tracking-wider text-sun-300">Stufe {lvl}</span></div>
          <div className="text-xs leading-snug text-fog-300">{d.desc}</div>
        </div>
      </div>
      <div className="sb-track"><div className="sb-fill" style={{ width: `${prog * 100}%` }} /></div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 text-[11px] text-fog-500">
        <span>Fahrzeug</span><span className="text-fog-100">{veh}</span>
        <span>Verdienst</span><span className="text-ok-400">${fmt(d.pay[0])} – ${fmt(d.pay[1])}</span>
        <span>Bestleistung</span><span>{best ? `$${fmt(best)}` : "–"}</span>
        {next && <><span>Stufe {next}</span><span>{LEVEL_REWARD[next]}</span></>}
      </div>
      <div className="sb-note">{d.extra}{d.when === "day" ? " · nur tagsüber" : ""}</div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-sun-300">{!running && why ? why : ""}</span>
        {running ? <button className={btn} onClick={() => { game.jobs.stop("Job beendet"); onPick("Job beendet"); }}>Beenden</button>
          : <button className={btnHi} disabled={!!why} onClick={() => onPick(game.jobs.accept(k))}>Job annehmen</button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- hide and seek
export function HideTab({ game, onDone }: { game: Game; onDone: () => void }) {
  const hs = game.hide;
  const [, redraw] = useState(0);
  const [msg, setMsg] = useState("");
  const set = (f: () => void) => { f(); redraw((n) => n + 1); };
  const why = hs.blocked();
  return (
    <div className="space-y-3">
      <div className={card}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-xs text-fog-500">Modus</span>
          {(["hide", "seek", "tag"] as HideMode[]).map((m) => <button key={m} className={hs.mode === m ? btnHi : btn} onClick={() => set(() => { hs.mode = m; })}>{MODE_NAME[m]}</button>)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="w-20 text-xs text-fog-500">Stufe</span>
          {(["easy", "normal", "hard"] as HideDiff[]).map((d) => <button key={d} className={hs.diff === d ? btnHi : btn} onClick={() => set(() => { hs.diff = d; })}>{DIFF_NAME[d]}</button>)}
          <span className="ml-3 text-xs text-fog-500">Runden</span>
          {ROUND_CHOICES.map((n) => <button key={n} className={hs.rounds === n ? btnHi : btn} onClick={() => set(() => { hs.rounds = n; })}>{n}</button>)}
        </div>
        <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-sm text-fog-300">{MODE_RULES[hs.mode].map((r) => <li key={r}>{r}</li>)}</ol>
        <div className="mt-1 text-[11px] text-fog-500">{hs.diff === "easy" ? "3 Sucher, langsam, kleiner Sichtkegel" : hs.diff === "normal" ? "4 Sucher" : "6 Sucher, schnell, hören dich sprinten"}</div>
      </div>
      <div className="grid gap-2 @xl:grid-cols-2">
        {hs.fields.map((f) => (
          <div key={f.id} className={card + " flex flex-col gap-1"}>
            <div className="flex items-baseline justify-between"><span className="sb-h3">{f.name}</span><span className="text-[11px] text-fog-500">{f.spots.length} Verstecke</span></div>
            <div className="text-xs text-fog-300">{f.desc}</div>
            <div className="text-[11px] text-sun-300">Rekord ({MODE_NAME[hs.mode]}, {DIFF_NAME[hs.diff]}): {hs.record(f)} Runden</div>
            <div className="mt-1 flex gap-2">
              <button className={btnHi} disabled={!!why} onClick={() => { const m = hs.play(f.id, true); setMsg(m); if (hs.active) onDone(); }}>Sofort hinbringen</button>
              <button className={btn} disabled={!!why} onClick={() => setMsg(hs.play(f.id, false))}>Wegpunkt setzen</button>
            </div>
          </div>
        ))}
      </div>
      {(msg || why) && <Toast tone={msg ? undefined : "warn"}>{msg || why}</Toast>}
    </div>
  );
}

// ---------------------------------------------------------------- contacts: call the story people
const CONTACTS = ["lou", "marisol", "dock", "ines", "ruiz"];
export function ContactsTab({ game }: { game: Game }) {
  const [reply, setReply] = useState<{ who: string; text: string } | null>(null);
  const done = game.progress.missions;
  const call = (id: string) => {
    const pl = game.places.find((p) => p.id === id);
    const m = game.missions.available(id);
    const name = pl?.name ?? id;
    if (m) {
      if (pl) game.setWaypoint(pl.x, pl.y);
      setReply({ who: name, text: `Ich hab was für dich: „${m.title}“. Komm vorbei – ich hab dir einen Wegpunkt geschickt.` });
      game.addMessage(name, `Neuer Auftrag: „${m.title}“ – Wegpunkt gesetzt`);
    } else {
      const all = MISSIONS.filter((x) => x.giver === id).every((x) => done.includes(x.id));
      setReply({ who: name, text: all ? "Für dich hab ich nichts mehr. Genieß die Stadt." : "Gerade hab ich nichts. Erledige erst die Aufträge der anderen." });
    }
  };
  return (
    <div className="space-y-2">
      {CONTACTS.map((id) => {
        const pl = game.places.find((p) => p.id === id), m = game.missions.available(id);
        const total = MISSIONS.filter((x) => x.giver === id), got = total.filter((x) => done.includes(x.id)).length;
        return (
          <div key={id} className={card + " flex items-center justify-between gap-2"}>
            <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-fog-100"><Icon name="contacts" size={18} /></span><div><div className="font-semibold">{pl?.name ?? id}</div><div className="text-[11px] text-fog-500">{got}/{total.length} Aufträge{m ? ` · neu: „${m.title}“` : ""}</div></div></div>
            <button className={btnHi} onClick={() => call(id)}>Anrufen</button>
          </div>
        );
      })}
      {reply && <div className={card + " is-active text-sm text-fog-300"}><b className="text-fog-100">{reply.who}:</b> {reply.text}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- garage: have a car delivered
export function GarageTab({ game, onDone }: { game: Game; onDone: () => void }) {
  const [msg, setMsg] = useState("");
  const [, redraw] = useState(0);
  return (
    <div className="space-y-2">
      <div className="text-xs text-fog-500">Deine Autos aus dem Safehouse – geliefert an die nächste Straße. Plätze: {game.garage.length}/{game.garageSlots}</div>
      {!game.garage.length && <div className={card + " text-sm text-fog-500"}>Die Garage ist leer. Stell ein Auto im Safehouse ab oder kauf eins im Autohaus.</div>}
      {game.garage.map((c, i) => (
        <div key={i} className={card + " flex items-center justify-between gap-2"}>
          <div className="flex items-center gap-3"><span className="h-5 w-8 rounded-[3px] ring-1 ring-white/25" style={{ background: c.color }} /><div><div className="font-semibold">{MODEL_NAME[c.model]}</div><div className="text-[11px] text-fog-500">Zustand {Math.round((c.hp / c.maxHp) * 100)} % · Motor {c.tune.engine} · Reifen {c.tune.tires} · Panzerung {c.tune.armor}</div></div></div>
          <button className={btnHi} disabled={!!game.jobs.delivery} onClick={() => { const m = game.jobs.order(c.model, c.color, null, i); setMsg(m); redraw((n) => n + 1); if (game.jobs.delivery) onDone(); }}>Liefern lassen</button>
        </div>
      ))}
      {msg && <Toast>{msg}</Toast>}
    </div>
  );
}

// ---------------------------------------------------------------- flight: fly mode, aircraft, travel (shops: straight inside)
export function FlightTab({ game, onDone }: { game: Game; onDone: () => void }) {
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState<"Läden" | "Stadtteile" | "Orte">("Läden");
  const [, redraw] = useState(0);
  const blocked = !game.rules.city ? "Nur in der Open World" : game.missions.active || game.hide.active ? "Nicht während einer Mission oder des Versteckspiels" : "";
  const go = (id: string, instant: boolean) => { const m = game.travelTo(id, instant); if (m) setMsg(m); else onDone(); };
  const craft = (m: "heli" | "policeheli" | "jet") => { const r = game.spawner.vehicle(m); if (/ist da$/.test(r)) onDone(); else setMsg(r); };
  const list = game.flightTargets().filter((t) => t.group === filter);
  return (
    <div className="space-y-2">
      <div className={card}>
        <div className="flex items-center justify-between gap-2">
          <div><div className={h3}>Fliegen-Modus</div><div className="text-[11px] text-fog-500">Zu Fuß oder mit jedem Auto frei fliegen. {game.mobile ? "HOCH / RUNTER" : `${game.bind.label("handbrake")} steigen · ${game.bind.label("nitro")} sinken`}.</div></div>
          <button className={game.flyMode ? btnHi : btn} onClick={() => { game.toggleFly(); redraw((n) => n + 1); onDone(); }}>{game.flyMode ? "An" : "Aus"}</button>
        </div>
      </div>
      <div className={card}>
        <div className={h3}>Fluggerät holen</div>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <button className={btn} disabled={!!blocked} onClick={() => craft("heli")}>{MODEL_NAME.heli}</button>
          <button className={btn} disabled={!!blocked} onClick={() => craft("policeheli")}>{MODEL_NAME.policeheli}</button>
          <button className={btn + " col-span-2"} disabled={!!blocked} onClick={() => craft("jet")}>{MODEL_NAME.jet} (Kanone + Raketen)</button>
        </div>
      </div>
      <div className={card}>
        <div className={h3}>Schnellreise</div>
        <div className="text-[11px] text-fog-500">„Fliegen“ bringt dich in ein paar Sekunden durch die Luft hin, „Sofort“ teleportiert. Bei Läden landest du direkt drinnen.</div>
        {blocked && <div className="mt-1 text-xs text-sun-300">{blocked}</div>}
        <div className="mt-2 flex gap-1">
          {(["Läden", "Stadtteile", "Orte"] as const).map((g) => <button key={g} className={(filter === g ? btnHi : btn) + " flex-1"} onClick={() => setFilter(g)}>{g}</button>)}
        </div>
        <div className="mt-2 space-y-1.5">
          {list.map((t) => (
            <div key={t.id} className="sb-row py-1.5">
              <span className="text-sm">{t.name}</span>
              <span className="flex shrink-0 gap-1">
                <button className={btn} disabled={!!blocked} onClick={() => go(t.id, false)}>Fliegen</button>
                <button className={btn} disabled={!!blocked} onClick={() => go(t.id, true)}>Sofort</button>
              </span>
            </div>
          ))}
        </div>
      </div>
      {msg && <Toast>{msg}</Toast>}
    </div>
  );
}

// ---------------------------------------------------------------- phone apps: messages and radio
export function MessagesApp({ game }: { game: Game }) {
  if (!game.messages.length) return <div className="p-3 text-sm text-fog-500">Keine Nachrichten.</div>;
  return (
    <div className="space-y-2">
      {game.messages.map((m, i) => (
        <div key={i} className="sb-card p-2 text-sm text-fog-300"><div className="flex justify-between text-[11px] text-fog-500"><b className="text-fog-100">{m.from}</b><span>{String(Math.floor(m.time)).padStart(2, "0")}:{String(Math.floor((m.time % 1) * 60)).padStart(2, "0")}</span></div>{m.text}</div>
      ))}
    </div>
  );
}
export function RadioApp({ game }: { game: Game }) {
  const [, redraw] = useState(0);
  const cur = game.radio.station;
  return (
    <div className="space-y-1.5">
      <button className={(cur < 0 ? btnHi : btn) + " w-full"} onClick={() => { game.radio.station = -1; redraw((n) => n + 1); }}>Radio aus</button>
      {STATIONS.map((st, i) => <button key={st.name} className={(cur === i ? btnHi : btn) + " w-full text-left"} onClick={() => { game.radio.station = i; redraw((n) => n + 1); }}>{st.name} <span className="text-xs text-fog-500">· {st.genre}</span></button>)}
      <div className="text-[11px] text-fog-500">Das Radio spielt nur im Auto.</div>
    </div>
  );
}
export const tabTitle = h3;
