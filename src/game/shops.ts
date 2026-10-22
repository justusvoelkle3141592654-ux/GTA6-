import { sfx } from "./audio";
import { Car, MODEL_NAME, MODEL_STATS, isCraft, repairBody } from "./vehicles";
import { WEAPON_DEFS } from "./weapons";
import { terrainH } from "./world";
import { MAX_TUNE, PAINTS, TUNE_DEFS, tuneHp } from "./garage";
import { AMMO_FOR_SALE, ARMOR_PRICE, BEARDS, DEALER_CARS, FOOD, GUNS_FOR_SALE, HAIR_STYLES, MARKET, OUTFITS, PAINT_PRICE, REPAIR_PER_HP, ROB_COOLDOWN, ROB_HEAT, ROB_REWARD, TATTOOS, TYRE_PRICE, type ShopAction } from "./economy";
import { MAX_ARMOR, newPed, type Game, type ShopView } from "./engine";

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// what the shops, the workshop and the safehouse garage do (the shop overlay calls these)
export class Shops {
  private robbedAt = new Map<string, number>();

  constructor(private g: Game) {}

  reset() { this.robbedAt.clear(); }

  view(): ShopView {
    const g = this.g;
    const p = g.player, pd = g.ped;
    const pl = g.modal?.kind === "shop" ? g.modal.place : null;
    const inCar = !g.onFoot && !g.playerCarStored;
    return {
      cash: g.cash, hp: pd.hp, maxHp: pd.maxHp, armor: pd.armor, outfit: g.outfit, stars: g.wanted.stars,
      weapons: GUNS_FOR_SALE.map((w) => ({ w, owned: g.inv.has(w), total: g.inv.total(w), canAmmo: AMMO_FOR_SALE.includes(w) })),
      car: inCar ? { name: MODEL_NAME[p.model], hp: p.hp, maxHp: p.maxHp, color: p.color, tune: { ...p.tune }, repair: Math.ceil(Math.max(0, p.maxHp - p.hp) * REPAIR_PER_HP) + (p.flat ? TYRE_PRICE : 0), flat: p.flat } : null,
      garage: g.garage.map((c) => ({ name: MODEL_NAME[c.model], color: c.color, tune: { ...c.tune }, value: Math.round(MODEL_STATS[c.model].price * 0.6) })),
      slots: g.garageSlots,
      bank: g.bank,
      robWait: pl ? Math.max(0, Math.ceil(ROB_COOLDOWN - (g.time - (this.robbedAt.get(pl.id) ?? -1e9)))) : 0,
      style: { ...g.style }, energy: Math.ceil(g.energyT),
      dealer: DEALER_CARS.map((m) => ({ name: MODEL_NAME[m], price: MODEL_STATS[m].price })),
    };
  }

  private pay(price: number): boolean {
    const g = this.g;
    if (g.cash < price) { sfx.empty(); return false; }
    g.cash -= price; sfx.cashier();
    return true;
  }

  // a shop button was pressed; returns the message to show
  act(a: ShopAction): string {
    const g = this.g;
    const p = g.player, pd = g.ped;
    const pl = g.modal?.kind === "shop" ? g.modal.place : null;
    const broke = "Zu wenig Geld";
    switch (a.t) {
      case "weapon": {
        const d = WEAPON_DEFS[a.w];
        if (g.inv.has(a.w)) return "Hast du schon";
        if (!this.pay(d.price)) return broke;
        g.inv.give(a.w, d.ammoPack); g.inv.select(a.w);
        return `${d.name} gekauft`;
      }
      case "ammo": {
        const d = WEAPON_DEFS[a.w];
        if (!g.inv.has(a.w)) return "Erst die Waffe kaufen";
        if (g.inv.total(a.w) >= d.maxAmmo) return "Munition ist voll";
        if (!this.pay(d.ammoPrice)) return broke;
        g.inv.give(a.w, d.ammoPack);
        return `+${d.ammoPack} Schuss ${d.name}`;
      }
      case "armor": {
        if (pd.armor >= MAX_ARMOR) return "Weste ist schon voll";
        const price = Math.ceil(((MAX_ARMOR - pd.armor) / MAX_ARMOR) * ARMOR_PRICE);
        if (!this.pay(price)) return broke;
        pd.armor = MAX_ARMOR;
        return "Schutzweste angezogen";
      }
      case "food": {
        const f = FOOD[a.i];
        if (!f) return "";
        if (pd.hp >= pd.maxHp) return "Du bist satt";
        if (!this.pay(f.price)) return broke;
        pd.hp = Math.min(pd.maxHp, pd.hp + f.heal);
        return `${f.name} – lecker (+${f.heal})`;
      }
      case "outfit": {
        const o = OUTFITS[a.i];
        if (!o || a.i === g.outfit) return "";
        if (!this.pay(o.price)) return broke;
        g.outfit = a.i;
        // a new look throws off the police (up to 2 stars, if nobody sees you right now)
        if (g.wanted.stars > 0 && g.wanted.stars <= 2 && !g.copSeesPlayer()) { g.wanted.clear(); return `${o.name} – die Cops erkennen dich nicht mehr`; }
        return `${o.name} steht dir`;
      }
      case "repair": {
        if (!pl || g.onFoot) return "";
        const cost = Math.ceil(Math.max(0, p.maxHp - p.hp) * REPAIR_PER_HP) + (p.flat ? TYRE_PRICE : 0);
        if (cost <= 0) return "Der Wagen ist in Ordnung";
        if (!this.pay(cost)) return broke;
        p.hp = p.maxHp; p.flat = false; repairBody(p);
        return "Repariert";
      }
      case "paint": {
        if (g.onFoot || !PAINTS.includes(a.color) || a.color === p.color) return "";
        if (!this.pay(PAINT_PRICE)) return broke;
        p.color = a.color; p.hp = p.maxHp; repairBody(p);
        if (g.wanted.stars > 0 && !g.copSeesPlayer()) { g.wanted.clear(); return "Neue Farbe – die Polizei sucht jetzt ein anderes Auto"; }
        return "Frisch lackiert";
      }
      case "tune": {
        if (g.onFoot) return "";
        const lvl = p.tune[a.part];
        if (lvl >= MAX_TUNE) return "Maximal getunt";
        if (!this.pay(TUNE_DEFS[a.part].prices[lvl])) return broke;
        const next = { ...p.tune, [a.part]: lvl + 1 };
        if (a.part === "armor") { const f = tuneHp(next) / tuneHp(p.tune); p.maxHp *= f; p.hp *= f; }
        p.tune = next;
        return `${TUNE_DEFS[a.part].name} Stufe ${lvl + 1}`;
      }
      case "save": {
        pd.hp = pd.maxHp;
        const r = g.saveGame();
        return r === "saved" ? "Ausgeruht und gespeichert" : r === "memory" ? "Ausgeruht – nur vorübergehend gespeichert" : r === "wanted" ? "Mit Fahndung kannst du nicht speichern" : "Gerade nicht möglich";
      }
      case "store": {
        if (g.onFoot || g.playerCarStored || !pl) return "Fahr mit dem Auto in die Garage";
        if (g.garage.length >= g.garageSlots) return "Garage ist voll";
        if (p.tag) return "Den Wagen brauchst du noch für den Auftrag";
        if (isCraft(p.model)) return "Das passt nicht in die Garage";
        g.garage.push({ model: p.model, color: p.color, hp: p.hp, maxHp: p.maxHp, mass: p.mass, tune: { ...p.tune } });
        g.cars.splice(g.cars.indexOf(p), 1);
        g.playerCarStored = true;
        g.ped = newPed(pl.x, pl.y, pl.a); g.ped.armor = pd.armor; g.ped.hp = pd.hp;
        g.onFoot = true;
        g.closeModal();
        return "Eingeparkt";
      }
      case "takeCar": {
        const c = g.garage[a.i];
        if (!c || !pl) return "";
        const car = new Car("civ", c.model, c.color);
        car.x = pl.cx; car.y = pl.cy; car.a = -Math.PI / 2; car.z = terrainH(car.x, car.y);
        for (const o of g.cars) if (Math.hypot(o.x - car.x, o.y - car.y) < 45) car.y += 60; // free spot
        car.hp = c.hp; car.maxHp = c.maxHp; car.mass = c.mass; car.tune = { ...c.tune };
        car.parked = true; car.handbrake = true; car.owned = true; car.keep = true;
        g.cars.push(car);
        g.garage.splice(a.i, 1);
        return `${MODEL_NAME[c.model]} steht vor der Tür`;
      }
      case "sellCar": {
        const c = g.garage[a.i];
        if (!c) return "";
        const v = Math.round(MODEL_STATS[c.model].price * 0.6);
        g.garage.splice(a.i, 1); g.cash += v; g.stats.earned += v; sfx.cashier();
        return `Verkauft für $${v.toLocaleString("de-DE")}`;
      }
      case "deposit": {
        const v = a.amount < 0 ? g.cash : Math.min(a.amount, g.cash);
        if (v <= 0) return "Kein Bargeld dabei";
        g.cash -= v; g.bank += v; sfx.cashier();
        return `$${v.toLocaleString("de-DE")} eingezahlt – sicher vor Klinik und Kaution`;
      }
      case "withdraw": {
        const v = a.amount < 0 ? g.bank : Math.min(a.amount, g.bank);
        if (v <= 0) return "Das Konto ist leer";
        g.bank -= v; g.cash += v; sfx.cashier();
        return `$${v.toLocaleString("de-DE")} abgehoben`;
      }
      case "rob": {
        if (!pl?.robbable) return "";
        const v = this.robValue(pl.id);
        if (v <= 0) return "Die Kasse ist noch leer";
        g.cash += v; g.stats.earned += v;
        this.robAlarm(pl.x, pl.y);
        sfx.cashier();
        g.closeModal();
        g.banner("ÜBERFALL", `+$${v.toLocaleString("de-DE")} – die Polizei ist alarmiert`, "#ff9f43", 2);
        return "";
      }
      case "sleep": {
        // sleep until the next morning (or 8 hours), then save
        if (g.wanted.stars > 0) return "Mit Fahndung findest du keinen Schlaf";
        const h = g.clock < 8 ? 8 - g.clock : 8;
        g.clock = (g.clock + h) % 24; pd.hp = pd.maxHp;
        const r = g.saveGame();
        return `${Math.round(h)} Stunden geschlafen` + (r === "saved" ? " – gespeichert" : "");
      }
      case "market": {
        const m = MARKET[a.i];
        if (!m) return "";
        if (!m.energy && pd.hp >= pd.maxHp) return "Du bist satt";
        if (!this.pay(m.price)) return broke;
        pd.hp = Math.min(pd.maxHp, pd.hp + m.heal);
        if (m.energy) { g.energyT = Math.max(g.energyT, m.energy); return `${m.name}: ${m.energy} s schneller rennen`; }
        return `${m.name} (+${m.heal})`;
      }
      case "buyCar": {
        const model = DEALER_CARS[a.i];
        if (!model) return "";
        if (g.garage.length >= g.garageSlots) return "Die Garage ist voll – verkauf erst ein Auto im Safehouse";
        const st = MODEL_STATS[model];
        if (!this.pay(st.price)) return broke;
        g.garage.push({ model, color: "#c0392b", hp: st.hp, maxHp: st.hp, mass: st.mass, tune: { engine: 0, tires: 0, armor: 0 } as never });
        return `${MODEL_NAME[model]} gekauft – steht in der Garage am Safehouse`;
      }
      case "hair": {
        const h = HAIR_STYLES[a.i];
        if (!h || g.style.hair === h.hair) return "";
        if (!this.pay(h.price)) return broke;
        g.style = { ...g.style, hair: h.hair };
        return `Neue Frisur: ${h.name}`;
      }
      case "beard": {
        const b = BEARDS[a.i];
        if (!b || g.style.beard === a.i) return "";
        if (!this.pay(b.price)) return broke;
        g.style = { ...g.style, beard: a.i };
        return b.name;
      }
      case "tattoo": {
        const t = TATTOOS[a.i];
        if (!t || g.style.tattoo === a.i) return "";
        if (!this.pay(t.price)) return broke;
        g.style = { ...g.style, tattoo: a.i };
        return a.i ? `Tattoo „${t.name}“ gestochen – sichtbar mit kurzen Ärmeln` : "Tattoo entfernt";
      }
    }
    return "";
  }

  // a robbery: money from the till (0 if it was robbed shortly before)
  robValue(id: string) {
    const g = this.g, last = this.robbedAt.get(id) ?? -1e9;
    if (g.time - last < ROB_COOLDOWN) return 0;
    this.robbedAt.set(id, g.time);
    return Math.round(rnd(ROB_REWARD[0], ROB_REWARD[1]));
  }
  robAlarm(x: number, y: number) {
    const g = this.g;
    g.wanted.heat = Math.max(g.wanted.heat, ROB_HEAT);
    g.wanted.lostT = 0;
    g.peds.alarm(x, y, 500, "shot");
  }
}
