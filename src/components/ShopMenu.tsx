import { useState } from "react";
import type { Game, ShopView } from "../game/engine";
import type { Place } from "../game/places";
import { FOOD, OUTFITS, ARMOR_PRICE, PAINT_PRICE, MARKET, HAIR_STYLES, BEARDS, TATTOOS, type ShopAction } from "../game/economy";
import { WEAPON_DEFS } from "../game/weapons";
import { MAX_TUNE, PAINTS, TUNE_DEFS, TUNE_PARTS } from "../game/garage";
import { fmt } from "./ui";

const TITLE: Record<Place["kind"], string> = {
  hospital: "Klinik", police: "Wache", gunshop: "Waffenladen", workshop: "Werkstatt & Lackiererei", clothes: "Kleidung",
  food: "Imbiss", safehouse: "Safehouse", contact: "", dock: "Bootssteg", heliport: "Heliport", park: "Park", job: "Job",
  market: "Supermarkt", cardealer: "Autohaus", barber: "Friseur & Tattoo", mall: "Foodcourt",
};

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">{children}</div>;
}
function Buy({ label, price, onClick, disabled }: { label: string; price?: number; onClick: () => void; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className="shrink-0 rounded-lg bg-gradient-to-r from-pink-500 to-fuchsia-600 px-3 py-1.5 text-sm font-bold text-white transition active:scale-95 disabled:opacity-35">
      {label}{price !== undefined && price > 0 && <> · ${fmt(price)}</>}
    </button>
  );
}

export default function ShopMenu({ game, place, onClose }: { game: Game; place: Place; onClose: () => void }) {
  const [view, setView] = useState<ShopView>(() => game.shopView());
  const [msg, setMsg] = useState("");
  const act = (a: ShopAction) => {
    const m = game.shopAction(a);
    if (game.modal?.kind !== "shop") return; // the action closed the shop (store car, robbery)
    setMsg(m); setView(game.shopView());
  };
  const robBtn = place.robbable && (
    <div className="mt-3 border-t border-white/10 pt-3">
      <button onClick={() => act({ t: "rob" })} disabled={view.robWait > 0} className="w-full rounded-xl border border-red-400/60 bg-red-600/25 py-2 font-display text-lg tracking-widest text-red-100 active:scale-95 disabled:opacity-40">
        {view.robWait > 0 ? `Kasse leer – in ${view.robWait} s wieder voll` : "🔫 Überfallen (2 Sterne)"}
      </button>
    </div>
  );

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onPointerDown={(e) => e.stopPropagation()}>
      <div className="popin max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#120a1f]/95 p-4 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: place.color }}>{TITLE[place.kind]}</div>
            <h2 className="font-display text-4xl leading-none tracking-wider text-white">{place.name}</h2>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl text-green-300">${fmt(view.cash)}</div>
            <button onClick={onClose} className="mt-1 rounded-lg border border-white/20 px-3 py-1 text-xs text-white/70 hover:text-white">Schließen (Esc)</button>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {place.kind === "gunshop" && <>
            {view.weapons.map(({ w, owned, total, canAmmo }) => {
              const d = WEAPON_DEFS[w];
              return (
                <Row key={w}>
                  <div><span className="mr-2 text-xl">{d.icon}</span><b>{d.name}</b>{owned && d.maxAmmo > 0 && <span className="ml-2 text-white/50">{total}/{d.maxAmmo}</span>}</div>
                  {!owned ? <Buy label="Kaufen" price={d.price} onClick={() => act({ t: "weapon", w })} disabled={view.cash < d.price} />
                    : canAmmo ? <Buy label={`+${d.ammoPack}`} price={d.ammoPrice} onClick={() => act({ t: "ammo", w })} disabled={view.cash < d.ammoPrice || total >= d.maxAmmo} />
                    : <span className="text-xs text-white/40">im Besitz</span>}
                </Row>
              );
            })}
            <Row>
              <div><span className="mr-2 text-xl">🦺</span><b>Schutzweste</b> <span className="ml-2 text-white/50">{Math.round(view.armor)}/100</span></div>
              <Buy label="Anziehen" price={Math.ceil(((100 - view.armor) / 100) * ARMOR_PRICE)} onClick={() => act({ t: "armor" })} disabled={view.armor >= 100} />
            </Row>
          </>}

          {place.kind === "market" && <>
            <div className="text-white/60">Gesundheit {Math.round(view.hp)}/{view.maxHp}{view.energy > 0 && <span className="ml-2 text-cyan-300">Energie noch {view.energy} s</span>}</div>
            {MARKET.map((m, i) => (
              <Row key={m.name}><div><b>{m.name}</b> <span className="text-white/50">{m.energy ? `${m.energy} s schneller rennen` : `+${m.heal} Gesundheit`}</span></div><Buy label="Kaufen" price={m.price} onClick={() => act({ t: "market", i })} disabled={view.cash < m.price || (!m.energy && view.hp >= view.maxHp)} /></Row>
            ))}
            {robBtn}
          </>}

          {place.kind === "cardealer" && <>
            <div className="text-white/60">Gekaufte Autos stehen in deiner Garage am Safehouse ({view.garage.length}/{view.slots} belegt).</div>
            {view.dealer.map((c, i) => (
              <Row key={c.name}><div><b>{c.name}</b></div><Buy label="Kaufen" price={c.price} onClick={() => act({ t: "buyCar", i })} disabled={view.cash < c.price || view.garage.length >= view.slots} /></Row>
            ))}
          </>}

          {place.kind === "barber" && <>
            <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">Frisur</div>
            {HAIR_STYLES.map((h, i) => (
              <Row key={h.hair}><div><b>{h.name}</b></div>{view.style.hair === h.hair ? <span className="text-xs text-green-300">aktuell</span> : <Buy label="Schneiden" price={h.price} onClick={() => act({ t: "hair", i })} disabled={view.cash < h.price} />}</Row>
            ))}
            <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">Bart</div>
            {BEARDS.map((b, i) => (
              <Row key={b.name}><div><b>{b.name}</b></div>{view.style.beard === i ? <span className="text-xs text-green-300">aktuell</span> : <Buy label="Wählen" price={b.price} onClick={() => act({ t: "beard", i })} disabled={view.cash < b.price} />}</Row>
            ))}
            <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">Tattoo (Arme)</div>
            {TATTOOS.map((t, i) => (
              <Row key={t.name}><div><b>{t.name}</b></div>{view.style.tattoo === i ? <span className="text-xs text-green-300">aktuell</span> : <Buy label={i ? "Stechen" : "Entfernen"} price={t.price} onClick={() => act({ t: "tattoo", i })} disabled={view.cash < t.price} />}</Row>
            ))}
            <div className="text-[11px] text-white/45">Mützen und Kappen eines Outfits verdecken die Frisur. Tattoos sieht man nur bei kurzen Ärmeln.</div>
          </>}

          {(place.kind === "food" || place.kind === "mall") && <>
            <div className="text-white/60">Gesundheit {Math.round(view.hp)}/{view.maxHp}</div>
            {FOOD.map((f, i) => (
              <Row key={f.name}><div><b>{f.name}</b> <span className="text-white/50">+{f.heal} Gesundheit</span></div><Buy label="Essen" price={f.price} onClick={() => act({ t: "food", i })} disabled={view.cash < f.price || view.hp >= view.maxHp} /></Row>
            ))}
            {robBtn}
          </>}

          {place.kind === "clothes" && <>
            <div className="text-xs text-white/55">Tipp: Umziehen bei bis zu 2 Sternen schüttelt die Polizei ab, wenn dich gerade keiner sieht.</div>
            {OUTFITS.map((o, i) => (
              <Row key={o.name}>
                <div className="flex items-center gap-2"><span className="h-4 w-4 rounded-full ring-1 ring-white/30" style={{ background: o.shirt }} /><span className="h-4 w-4 rounded-full ring-1 ring-white/30" style={{ background: o.pants }} /><b>{o.name}</b></div>
                {view.outfit === i ? <span className="text-xs text-green-300">trägst du</span> : <Buy label="Anziehen" price={o.price} onClick={() => act({ t: "outfit", i })} disabled={view.cash < o.price} />}
              </Row>
            ))}
            {robBtn}
          </>}

          {place.kind === "workshop" && (!view.car ? <div className="text-white/60">Fahr mit einem Auto in den Ring vor der Werkstatt.</div> : <>
            <Row><div><b>{view.car.name}</b> <span className="text-white/50">Zustand {Math.round((view.car.hp / view.car.maxHp) * 100)} %</span>{view.car.flat && <span className="ml-2 text-orange-300">Reifen platt</span>}</div><Buy label="Reparieren" price={view.car.repair} onClick={() => act({ t: "repair" })} disabled={view.car.repair <= 0 || view.cash < view.car.repair} /></Row>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 flex justify-between"><b>Lackieren</b><span className="text-white/50">${PAINT_PRICE} · löscht die Fahndung, wenn dich keiner sieht</span></div>
              <div className="grid grid-cols-6 gap-2">
                {PAINTS.map((c) => <button key={c} onClick={() => act({ t: "paint", color: c })} disabled={c === view.car!.color || view.cash < PAINT_PRICE} className={"h-9 rounded-lg ring-2 transition active:scale-90 disabled:opacity-60 " + (c === view.car!.color ? "ring-white" : "ring-white/10")} style={{ background: c }} aria-label={c} />)}
              </div>
            </div>
            {TUNE_PARTS.map((p) => {
              const lvl = view.car!.tune[p], d = TUNE_DEFS[p], price = lvl < MAX_TUNE ? d.prices[lvl] : 0;
              return (
                <Row key={p}>
                  <div><b>{d.name}</b> <span className="text-yellow-300">{"■".repeat(lvl)}<span className="text-white/20">{"■".repeat(MAX_TUNE - lvl)}</span></span><div className="text-[11px] text-white/50">{d.desc}</div></div>
                  {lvl < MAX_TUNE ? <Buy label={`Stufe ${lvl + 1}`} price={price} onClick={() => act({ t: "tune", part: p })} disabled={view.cash < price} /> : <span className="text-xs text-green-300">Maximum</span>}
                </Row>
              );
            })}
          </>)}

          {place.kind === "safehouse" && <>
            <Row><div><b>Ausruhen & speichern</b><div className="text-[11px] text-white/50">Volle Gesundheit, nur ohne Sterne</div></div><Buy label="Speichern" onClick={() => act({ t: "save" })} /></Row>
            <Row><div><b>Schlafen</b><div className="text-[11px] text-white/50">Bis zum Morgen (höchstens 8 Stunden), dann speichern</div></div><Buy label="Schlafen" onClick={() => act({ t: "sleep" })} /></Row>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 flex justify-between"><b>Bankkonto</b><span className="font-display text-xl text-green-300">${fmt(view.bank)}</span></div>
              <div className="mb-2 text-[11px] text-white/50">Geld auf dem Konto verlierst du nicht in der Klinik oder bei der Kaution.</div>
              <div className="grid grid-cols-2 gap-2">
                <Buy label="+$500 einzahlen" onClick={() => act({ t: "deposit", amount: 500 })} disabled={view.cash <= 0} />
                <Buy label="Alles einzahlen" onClick={() => act({ t: "deposit", amount: -1 })} disabled={view.cash <= 0} />
                <Buy label="$500 abheben" onClick={() => act({ t: "withdraw", amount: 500 })} disabled={view.bank <= 0} />
                <Buy label="Alles abheben" onClick={() => act({ t: "withdraw", amount: -1 })} disabled={view.bank <= 0} />
              </div>
            </div>
            {view.car && <Row><div><b>{view.car.name} einparken</b><div className="text-[11px] text-white/50">Bleibt dir mit Tuning erhalten</div></div><Buy label="Einparken" onClick={() => act({ t: "store" })} disabled={view.garage.length >= view.slots} /></Row>}
            <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">Garage {view.garage.length}/{view.slots}</div>
            {!view.garage.length && <div className="text-white/50">Leer. Fahr ein Auto in den großen Ring vor dem Safehouse, um es einzuparken.</div>}
            {view.garage.map((c, i) => (
              <Row key={i}>
                <div className="flex items-center gap-2"><span className="h-4 w-4 rounded-full" style={{ background: c.color }} /><b>{c.name}</b><span className="text-[11px] text-white/50">M{c.tune.engine} R{c.tune.tires} P{c.tune.armor}</span></div>
                <div className="flex gap-1.5">
                  <Buy label="Ausparken" onClick={() => act({ t: "takeCar", i })} />
                  <button onClick={() => act({ t: "sellCar", i })} className="rounded-lg border border-white/20 px-2 py-1.5 text-xs text-white/70">${fmt(c.value)}</button>
                </div>
              </Row>
            ))}
          </>}
        </div>
        {msg && <div className="popin mt-3 rounded-lg bg-white/10 px-3 py-2 text-center text-sm text-yellow-100">{msg}</div>}
      </div>
    </div>
  );
}
