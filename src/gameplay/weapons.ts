import type { Crime } from "../ai/wanted";

export type Weapon = "fist" | "bat" | "pistol" | "smg" | "shotgun" | "grenade" | "rocket" | "bomb";
// order on the number keys and in the weapon wheel
export const WEAPONS: Weapon[] = ["fist", "bat", "pistol", "smg", "shotgun", "grenade", "rocket", "bomb"];

export type WeaponKind = "melee" | "gun" | "rocket" | "throw" | "sticky";
export interface WeaponDef {
  id: Weapon; name: string; icon: string; kind: WeaponKind; // icon: name of the SVG symbol (components/icons.tsx)
  dmg: number;       // per hit / pellet
  cd: number;        // seconds between shots
  clip: number;      // shots per magazine (0: no magazine)
  reload: number;    // seconds
  speed: number;     // projectile speed
  pellets: number; spread: number;
  range: number;     // melee reach, bullet life time in s for guns
  price: number;     // buy price in the gun shop (0: not sold)
  ammoPack: number; ammoPrice: number; maxAmmo: number;
  crime: Crime | null;
  noise: number;     // radius in which pedestrians panic
}

export const WEAPON_DEFS: Record<Weapon, WeaponDef> = {
  fist: { id: "fist", name: "Fäuste", icon: "fist", kind: "melee", dmg: 14, cd: 0.45, clip: 0, reload: 0, speed: 0, pellets: 1, spread: 0, range: 24, price: 0, ammoPack: 0, ammoPrice: 0, maxAmmo: 0, crime: null, noise: 0 },
  bat: { id: "bat", name: "Baseballschläger", icon: "bat", kind: "melee", dmg: 45, cd: 0.6, clip: 0, reload: 0, speed: 0, pellets: 1, spread: 0, range: 30, price: 150, ammoPack: 0, ammoPrice: 0, maxAmmo: 0, crime: null, noise: 0 },
  pistol: { id: "pistol", name: "Pistole", icon: "pistol", kind: "gun", dmg: 34, cd: 0.17, clip: 12, reload: 1.1, speed: 1500, pellets: 1, spread: 0.025, range: 0.6, price: 400, ammoPack: 36, ammoPrice: 60, maxAmmo: 240, crime: "shot", noise: 520 },
  smg: { id: "smg", name: "Maschinenpistole", icon: "smg", kind: "gun", dmg: 16, cd: 0.075, clip: 30, reload: 1.6, speed: 1600, pellets: 1, spread: 0.07, range: 0.55, price: 1500, ammoPack: 90, ammoPrice: 150, maxAmmo: 450, crime: "shot", noise: 560 },
  shotgun: { id: "shotgun", name: "Schrotflinte", icon: "shotgun", kind: "gun", dmg: 14, cd: 0.8, clip: 6, reload: 2.2, speed: 1300, pellets: 7, spread: 0.16, range: 0.32, price: 1200, ammoPack: 18, ammoPrice: 120, maxAmmo: 90, crime: "shot", noise: 600 },
  grenade: { id: "grenade", name: "Granate", icon: "grenade", kind: "throw", dmg: 0, cd: 0.7, clip: 0, reload: 0, speed: 330, pellets: 1, spread: 0, range: 0, price: 800, ammoPack: 5, ammoPrice: 300, maxAmmo: 25, crime: null, noise: 0 },
  rocket: { id: "rocket", name: "Raketenwerfer", icon: "rocket", kind: "rocket", dmg: 0, cd: 0.85, clip: 0, reload: 0, speed: 720, pellets: 1, spread: 0, range: 3, price: 5000, ammoPack: 5, ammoPrice: 600, maxAmmo: 30, crime: "rocket", noise: 600 },
  bomb: { id: "bomb", name: "Haftbombe", icon: "bomb", kind: "sticky", dmg: 0, cd: 0.45, clip: 0, reload: 0, speed: 280, pellets: 1, spread: 0, range: 4, price: 2500, ammoPack: 5, ammoPrice: 400, maxAmmo: 30, crime: null, noise: 0 },
};

export interface InventorySave { owned: Weapon[]; ammo: Partial<Record<Weapon, number>>; clip: Partial<Record<Weapon, number>>; current: Weapon; }

const zero = (): Record<Weapon, number> => ({ fist: 0, bat: 0, pistol: 0, smg: 0, shotgun: 0, grenade: 0, rocket: 0, bomb: 0 });

// weapons the player carries; ammo = reserve outside the magazine
export class Inventory {
  owned: Weapon[] = ["fist"];
  ammo = zero();
  clip = zero();
  current: Weapon = "fist";
  reloadT = 0;
  infinite = new Set<Weapon>(); // arcade modes: endless ammo, no reloading

  // fists: arcade modes start without them, so 1/2/3 stay pistol/rocket/bomb
  reset(owned: Weapon[], ammo: Partial<Record<Weapon, number>>, infinite: Weapon[] = [], fists = true) {
    this.owned = WEAPONS.filter((w) => (fists && w === "fist") || owned.includes(w));
    this.ammo = zero(); this.clip = zero();
    for (const w of this.owned) {
      const d = WEAPON_DEFS[w], a = ammo[w] ?? 0;
      if (d.clip > 0) { this.clip[w] = Math.min(d.clip, a); this.ammo[w] = a - this.clip[w]; } else this.ammo[w] = a;
    }
    this.infinite = new Set(infinite);
    this.current = this.owned.includes("pistol") ? "pistol" : this.owned[0];
    this.reloadT = 0;
  }

  get def() { return WEAPON_DEFS[this.current]; }
  has(w: Weapon) { return this.owned.includes(w); }

  // shots left right now (magazine, or the whole stock for weapons without one); -1 = endless
  loaded(w = this.current): number {
    const d = WEAPON_DEFS[w];
    if (d.kind === "melee" || this.infinite.has(w)) return -1;
    return d.clip > 0 ? this.clip[w] : this.ammo[w];
  }
  reserve(w = this.current): number { return WEAPON_DEFS[w].clip > 0 && !this.infinite.has(w) ? this.ammo[w] : -1; }
  total(w: Weapon) { return this.clip[w] + this.ammo[w]; }

  give(w: Weapon, ammo: number) {
    if (!this.has(w)) { this.owned = WEAPONS.filter((o) => o === w || this.owned.includes(o)); }
    const d = WEAPON_DEFS[w];
    if (d.kind === "melee") return;
    this.ammo[w] = Math.min(d.maxAmmo - this.clip[w], this.ammo[w] + ammo);
    // bought / picked up ammo goes straight into the magazine
    if (d.clip > 0 && this.clip[w] < d.clip) { const n = Math.min(d.clip - this.clip[w], this.ammo[w]); this.clip[w] += n; this.ammo[w] -= n; }
  }

  // lose some weapons (respawn penalties)
  drop(ws: Weapon[]) {
    this.owned = this.owned.filter((w) => !ws.includes(w));
    for (const w of ws) { this.ammo[w] = 0; this.clip[w] = 0; }
    if (!this.owned.length) this.owned = ["fist"];
    if (!this.has(this.current)) { this.current = this.owned.includes("pistol") ? "pistol" : this.owned[0]; this.reloadT = 0; }
  }

  // true if a shot can be fired now; consumes one round
  consume(): boolean {
    const w = this.current, d = WEAPON_DEFS[w];
    if (d.kind === "melee" || this.infinite.has(w)) return true;
    if (this.reloadT > 0) return false;
    if (d.clip > 0) {
      if (this.clip[w] <= 0) { this.startReload(); return false; }
      this.clip[w]--;
      if (this.clip[w] === 0) this.startReload();
      return true;
    }
    if (this.ammo[w] <= 0) return false;
    this.ammo[w]--;
    return true;
  }

  startReload() {
    const w = this.current, d = WEAPON_DEFS[w];
    if (d.clip <= 0 || this.infinite.has(w) || this.clip[w] >= d.clip || this.ammo[w] <= 0 || this.reloadT > 0) return false;
    this.reloadT = d.reload;
    return true;
  }

  update(dt: number) {
    if (this.reloadT <= 0) return;
    this.reloadT -= dt;
    if (this.reloadT <= 0) {
      const w = this.current, d = WEAPON_DEFS[w];
      const n = Math.min(d.clip - this.clip[w], this.ammo[w]);
      this.clip[w] += n; this.ammo[w] -= n; this.reloadT = 0;
    }
  }

  select(w: Weapon) {
    if (!this.has(w) || w === this.current) return false;
    this.current = w; this.reloadT = 0;
    if (this.loaded() === 0) this.startReload();
    return true;
  }
  cycle(dir: number) {
    const i = this.owned.indexOf(this.current);
    this.select(this.owned[(i + dir + this.owned.length) % this.owned.length]);
  }

  save(): InventorySave {
    const ammo: Partial<Record<Weapon, number>> = {}, clip: Partial<Record<Weapon, number>> = {};
    for (const w of this.owned) { ammo[w] = this.ammo[w]; clip[w] = this.clip[w]; }
    return { owned: [...this.owned], ammo, clip, current: this.current };
  }
  load(s: InventorySave) {
    this.owned = WEAPONS.filter((w) => w === "fist" || s.owned.includes(w));
    this.ammo = zero(); this.clip = zero();
    for (const w of this.owned) {
      const d = WEAPON_DEFS[w];
      this.clip[w] = Math.max(0, Math.min(d.clip, s.clip[w] ?? 0));
      this.ammo[w] = Math.max(0, Math.min(d.maxAmmo, s.ammo[w] ?? 0));
    }
    this.infinite.clear();
    this.current = this.has(s.current) ? s.current : "fist";
    this.reloadT = 0;
  }
}
