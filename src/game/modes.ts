export type Mode = "open" | "chase" | "free";

// what a game mode switches on or off
export interface ModeRules {
  cops: boolean;       // police spawns and chases
  damage: boolean;     // player and car can take damage
  timeHeat: boolean;   // heat rises over time by itself (arcade chase)
  minStars: number;    // lowest wanted level
  starsDecay: boolean; // stars drop again after escaping the police
  respawn: boolean;    // no game over: hospital / police station instead
  scoreboard: boolean; // result goes to the high score list
  city: boolean;       // pedestrians and parked cars
  save: boolean;       // progress can be saved
  maxStars: number;    // highest wanted level (open world: 6 = military)
}

export const MODE_RULES: Record<Mode, ModeRules> = {
  open: { cops: true, damage: true, timeHeat: false, minStars: 0, starsDecay: true, respawn: true, scoreboard: false, city: true, save: true, maxStars: 6 },
  chase: { cops: true, damage: true, timeHeat: true, minStars: 1, starsDecay: false, respawn: false, scoreboard: true, city: false, save: false, maxStars: 5 },
  free: { cops: false, damage: false, timeHeat: false, minStars: 0, starsDecay: false, respawn: false, scoreboard: true, city: false, save: false, maxStars: 0 },
};

export const MODE_LABEL: Record<Mode, string> = { open: "Open World", chase: "Verfolgungsjagd", free: "Freie Fahrt" };
