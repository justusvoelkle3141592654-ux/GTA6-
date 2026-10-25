import { useState } from "react";
import type { Game, ShopView } from "../core/engine";
import type { Place } from "../world/places";
import { FOOD, OUTFITS, ARMOR_PRICE, PAINT_PRICE, MARKET, HAIR_STYLES, BEARDS, TATTOOS, GAS_ITEMS, SCRATCH_PRICE, NITRO_FILL_PRICE, WASH_PRICE, DRINKS, PHARMA, GADGETS, PHONE_CASES, NEONS, NEON_PRICE, MAX_KITS, type ShopAction } from "../gameplay/economy";
import { WEAPON_DEFS } from "../gameplay/weapons";
import { MAX_TUNE, PAINTS, TUNE_DEFS, TUNE_PARTS } from "../vehicles/garage";
import { fmt } from "./ui";
import { WeaponIcon } from "./ui";
import Icon from "./icons";

const TITLE: Record<Place["kind"], string> = {
  hospital: "Klinik", police: "Wache", gunshop: "Waffenladen", workshop: "Werkstatt & Lackiererei", clothes: "Kleidung",
  food: "Imbiss", safehouse: "Safehouse", contact: "", dock: "Bootssteg", heliport: "Heliport", park: "Park", job: "Job",
  market: "Supermarkt", cardealer: "Autohaus", barber: "Friseur & Tattoo", mall: "Foodcourt", club: "Nachtclub", home: "Wohnung", prison: "Haftanstalt",
  gas: "Tankstelle & 24/7-Shop", bar: "Bar", pharmacy: "Apotheke", boats: "Bootshändler", planes: "Flugzeughändler", electronics: "Elektronik & Handys", house: "Wohnhaus",
};
const Head = ({ children }: { children: React.ReactNode }) => <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">{children}</div>;

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
        {view.robWait > 0 ? `Kasse leer – in ${view.robWait} s wieder voll` : "Überfallen (2 Sterne)"}
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
                  <div className="flex items-center gap-2"><WeaponIcon w={w} size={20} /><b>{d.name}</b>{owned && d.maxAmmo > 0 && <span className="ml-2 text-white/50">{total}/{d.maxAmmo}</span>}</div>
                  {!owned ? <Buy label="Kaufen" price={d.price} onClick={() => act({ t: "weapon", w })} disabled={view.cash < d.price} />
                    : canAmmo ? <Buy label={`+${d.ammoPack}`} price={d.ammoPrice} onClick={() => act({ t: "ammo", w })} disabled={view.cash < d.ammoPrice || total >= d.maxAmmo} />
                    : <span className="text-xs text-white/40">im Besitz</span>}
                </Row>
              );
            })}
            <Row>
              <div className="flex items-center gap-2"><Icon name="vest" size={20} /><b>Schutzweste</b> <span className="ml-2 text-white/50">{Math.round(view.armor)}/100</span></div>
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
            {FOOD.map((f, i) => f.at.includes(place.id) && (
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
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 flex justify-between"><b>Unterbodenbeleuchtung</b><span className="text-white/50">${NEON_PRICE}</span></div>
              <div className="grid grid-cols-8 gap-2">
                {NEONS.map((c) => <button key={c || "none"} onClick={() => act({ t: "neon", color: c })} disabled={c === view.neon || (!!c && view.cash < NEON_PRICE)} className={"h-9 rounded-lg ring-2 transition active:scale-90 disabled:opacity-60 " + (c === view.neon ? "ring-white" : "ring-white/10")} style={{ background: c || "#2a2d33", boxShadow: c ? `0 0 12px ${c}` : undefined }} aria-label={c || "ohne"}>{!c && <span className="text-[10px] text-white/70">aus</span>}</button>)}
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

          {place.kind === "gas" && <>
            <div className="text-white/60">Gesundheit {Math.round(view.hp)}/{view.maxHp}</div>
            {GAS_ITEMS.map((m, i) => (
              <Row key={m.name}><div><b>{m.name}</b> <span className="text-white/50">+{m.heal}{m.energy ? ` · ${m.energy} s schneller` : ""}</span></div><Buy label="Kaufen" price={m.price} onClick={() => act({ t: "gas", i })} disabled={view.cash < m.price} /></Row>
            ))}
            <Row><div><b>Rubbellos</b> <span className="text-white/50">bis $500</span></div><Buy label="Rubbeln" price={SCRATCH_PRICE} onClick={() => act({ t: "scratch" })} disabled={view.cash < SCRATCH_PRICE} /></Row>
            <Head>Dein Auto</Head>
            <Row><div><b>Nitro auffüllen</b><div className="text-[11px] text-white/50">{view.carNear ? `Nitro ${Math.round(view.nitro * 100)} %` : "Dein Auto muss an der Tankstelle stehen"}</div></div><Buy label="Auffüllen" price={NITRO_FILL_PRICE} onClick={() => act({ t: "nitroFill" })} disabled={!view.carNear || view.cash < NITRO_FILL_PRICE} /></Row>
            <Row><div><b>Waschanlage</b><div className="text-[11px] text-white/50">Dellen und Glas wie neu (Motorschaden: Werkstatt)</div></div><Buy label="Waschen" price={WASH_PRICE} onClick={() => act({ t: "wash" })} disabled={!view.carNear || view.cash < WASH_PRICE} /></Row>
            <div className="text-[11px] text-white/45">Echtes Tanken gibt es nicht – Autos fahren ohne Sprit. An der Zapfsäule gibt es Nitro.</div>
            {robBtn}
          </>}

          {place.kind === "bar" && <>
            <div className="text-white/60">Gesundheit {Math.round(view.hp)}/{view.maxHp}{view.drunk > 0 && <span className="ml-2 text-amber-300">Promille-Gefühl {view.drunk} %</span>}</div>
            {DRINKS.map((d, i) => (
              <Row key={d.name}><div><b>{d.name}</b> <span className="text-white/50">+{d.heal}{d.booze ? " · Alkohol" : ""}</span></div><Buy label="Bestellen" price={d.price} onClick={() => act({ t: "drink", i })} disabled={view.cash < d.price} /></Row>
            ))}
            <div className="text-[11px] text-white/45">Alkohol lässt das Bild schwanken und die Lenkung wackeln. Nicht betrunken fahren – das gibt Ärger.</div>
            {robBtn}
          </>}

          {place.kind === "pharmacy" && <>
            <div className="text-white/60">Gesundheit {Math.round(view.hp)}/{view.maxHp} · Erste-Hilfe-Sets {view.kits}/{MAX_KITS} · Vitamine {view.vit}/5</div>
            {PHARMA.map((m, i) => (
              <Row key={m.name}><div><b>{m.name}</b><div className="text-[11px] text-white/50">{m.desc}</div></div><Buy label="Kaufen" price={m.price} onClick={() => act({ t: "pharma", i })} disabled={view.cash < m.price} /></Row>
            ))}
            {robBtn}
          </>}

          {place.kind === "electronics" && <>
            <Head>Gadgets</Head>
            {GADGETS.map((d) => (
              <Row key={d.id}><div><b>{d.name}</b><div className="text-[11px] text-white/50">{d.desc}</div></div>{view.items.includes(d.id) ? <span className="text-xs text-green-300">im Besitz</span> : <Buy label="Kaufen" price={d.price} onClick={() => act({ t: "gadget", id: d.id })} disabled={view.cash < d.price} />}</Row>
            ))}
            <Head>Handys</Head>
            {PHONE_CASES.map((d) => {
              const owned = d.price === 0 || view.items.includes(d.id), active = view.items.includes("active:" + d.id) || (d.price === 0 && !view.items.some((x) => x.startsWith("active:")));
              return (
                <Row key={d.id}><div className="flex items-center gap-2"><span className="h-5 w-3 rounded-sm ring-1 ring-white/30" style={{ background: d.color }} /><b>{d.name}</b></div>
                  {active ? <span className="text-xs text-green-300">benutzt du</span> : <Buy label={owned ? "Benutzen" : "Kaufen"} price={owned ? 0 : d.price} onClick={() => act({ t: "case", id: d.id })} disabled={!owned && view.cash < d.price} />}</Row>
              );
            })}
          </>}

          {(place.kind === "boats" || place.kind === "planes") && <>
            <div className="text-white/60">{place.kind === "boats" ? "Gekaufte Boote liegen am Bootssteg bereit." : "Gekaufte Flugzeuge und Hubschrauber stehen am Heliport bereit."} Abholen geht hier oder im Handy (App Fahrzeug).</div>
            {view.crafts.map((c) => (
              <Row key={c.model}><div><b>{c.name}</b></div>
                {c.owned ? <Buy label="Abholen" onClick={() => act({ t: "fetchCraft", model: c.model })} /> : <Buy label="Kaufen" price={c.price} onClick={() => act({ t: "buyCraft", model: c.model })} disabled={view.cash < c.price} />}</Row>
            ))}
          </>}

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
