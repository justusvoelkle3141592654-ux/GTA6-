// hand drawn SVG symbols (no emojis in the game UI); 24 x 24, drawn with the current colour
const P: Record<string, string> = {
  taxi: "M4 15h16v-3l-2-5H6l-2 5zM9 7V5h6v2M6 18a1.5 1.5 0 1 0 0 .01M18 18a1.5 1.5 0 1 0 0 .01",
  delivery: "M2 7h11v9H2zM13 10h4l3 3v3h-7zM6 18a1.5 1.5 0 1 0 0 .01M17 18a1.5 1.5 0 1 0 0 .01",
  bounty: "M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5zM9 12l2 2 4-4",
  ambulance: "M2 8h12v8H2zM14 11h4l3 3v2h-7zM7 10v4M5 12h4M6 18a1.5 1.5 0 1 0 0 .01M17 18a1.5 1.5 0 1 0 0 .01",
  fire: "M12 2c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3 0-5 1-8z",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6",
  tow: "M2 14h9V9h4l3 5v3H2zM18 14l4-6M22 8v5M6 18a1.5 1.5 0 1 0 0 .01M16 18a1.5 1.5 0 1 0 0 .01",
  bus: "M4 4h16v13H4zM4 11h16M8 20v-3M16 20v-3M7 14h1M16 14h1",
  icecream: "M8 10a4 4 0 0 1 8 0zM8 10l4 12 4-12",
  courier: "M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9",
  watertaxi: "M2 16h20l-3 4H5zM6 16V9h8l3 7M9 9V6h3",
  heli: "M3 6h18M12 6v3M6 9h10a3 3 0 0 1 0 6H8a2 2 0 0 1-2-2zM16 12h6M7 19h10M9 15v4M15 15v4",
  hunter: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM12 1v6M12 17v6M1 12h6M17 12h6",
  race: "M5 21V3M5 4h14l-3 4 3 4H5",
  stunt: "M2 20h8l8-8M14 12l4 0M18 4a2 2 0 1 0 0 .01",
  phone: "M7 2h10v20H7zM11 18h2",
  contacts: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6",
  map: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
  messages: "M3 5h18v11H8l-5 4z",
  garage: "M3 10l9-6 9 6v11H3zM7 21v-7h10v7M7 17h10",
  radio: "M3 9h18v11H3zM6 9l12-5M8 15a2 2 0 1 0 0 .01M14 13h4M14 16h4",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  hide: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM4 4l16 16",
  door: "M6 3h12v18H6zM14 12h1",
  close: "M5 5l14 14M19 5L5 19",
  check: "M4 12l5 5L20 6",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  star: "M12 2l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9z",
  money: "M2 6h20v12H2zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6M5 9v6M19 9v6",
  // weapons
  fist: "M7 11V7a1.5 1.5 0 0 1 3 0v3M10 10V6a1.5 1.5 0 0 1 3 0v4M13 10V7a1.5 1.5 0 0 1 3 0v4M16 11V9a1.5 1.5 0 0 1 3 0v4c0 4-3 8-7 8s-6-2-7-5l-1-3a1.5 1.5 0 0 1 3-1l1 2",
  bat: "M4 20l2 0 13-13a2.5 2.5 0 0 0-3.5-3.5L2.5 16.5V18zM6 18l-2-2",
  pistol: "M3 7h16v4h-8l-1 2H8l-1 6H4l1-6H3zM11 11v2",
  smg: "M2 8h18v3h-6l-1 2h-2v4H8v-4l-2 0V11H2zM14 11v4h2v-4M20 9h2",
  knife: "M3 21l6-6M9 15l2 2M11 17L21 4c-5 1-9 4-12 9z",
  revolver: "M2 8h13v3h-3a2 2 0 0 1-4 0H7l-1 7H3l1-7H2zM15 9h6M9 11a1 1 0 1 0 2 0",
  rifle: "M1 9h21v3H13l-2 2v4H8v-4H6l-1 3H2l1-4H1zM15 12v3h2v-3M9 9V7h6v2",
  sniper: "M1 10h22v2H12l-2 2v4H7v-4H5l-1 3H1l1-5zM9 10V7h8v3M10 7V5h6v2",
  shotgun: "M2 10h20v3H10l-3 4H4l2-4H2zM14 13v2",
  grenade: "M12 8a6 6 0 1 0 0 12 6 6 0 1 0 0-12zM10 8V5h4v3M14 5l3-2M9 14h6M12 11v6",
  rocket: "M2 11h14l4 1-4 1H2zM6 13v4h3v-4M4 11V9M20 12h2",
  bomb: "M11 9a6 6 0 1 0 0 12 6 6 0 1 0 0-12zM14 10l3-3M17 7l1-3M17 7l3-1",
  // controls and HUD
  camera: "M3 8h4l2-3h6l2 3h4v11H3zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7",
  car: "M3 15h18v-3l-2-5H5l-2 5zM5 12h14M7 18a1.6 1.6 0 1 0 0 .01M17 18a1.6 1.6 0 1 0 0 .01M3 15v3M21 15v3",
  exit: "M14 3h6v18h-6M3 12h12M10 7l5 5-5 5",
  pause: "M8 5v14M16 5v14",
  wheel: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6M12 3v6M12 15v6M3 12h6M15 12h6",
  boom: "M12 2l2 6 6-3-3 6 5 2-6 2 2 6-6-3-3 5-1-6-6 1 4-5-4-4 6 0z",
  tap: "M9 11V5a2 2 0 0 1 4 0v6l5 1c1 0 2 1 2 2l-1 7H10l-4-6a2 2 0 0 1 3-2z",
  vest: "M8 3l-4 3v14h6l2-3 2 3h6V6l-4-3c0 2-2 4-4 4S8 5 8 3z",
  siren: "M6 18v-6a6 6 0 0 1 12 0v6M4 21h16v-3H4zM12 2v2M4 6l1.5 1.5M20 6l-1.5 1.5",
  flag: "M5 21V3M5 4h14l-3 4 3 4H5",
  shell: "M12 3c5 0 9 4 9 9-3 0-4 4-9 9-5-5-6-9-9-9 0-5 4-9 9-9zM12 3v18M7 6l5 15M17 6l-5 15",
  skate: "M3 14h18M5 14l1-3h12l1 3M7 18a1.5 1.5 0 1 0 0 .01M17 18a1.5 1.5 0 1 0 0 .01",
  bank: "M3 9l9-5 9 5zM5 9v9M9 9v9M15 9v9M19 9v9M3 20h18",
  sound: "M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  mute: "M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM12 11v6M12 7v.01",
  save: "M4 4h13l3 3v13H4zM8 4v5h8V4M7 14h10v6H7z",
  shop: "M3 9l2-5h14l2 5M3 9h18v11H3zM9 20v-6h6v6",
  plane: "M2 13l8-1 4-8h2l-2 8 6 1 2-3h1l-1 4 1 4h-1l-2-3-6 1 2 8h-2l-4-8-8-1z",
  city: "M3 21V9h6v12M9 21V4h7v17M16 21V11h5v10M2 21h20",
  heliIcon: "M3 6h18M12 6v3M6 9h10a3 3 0 0 1 0 6H8a2 2 0 0 1-2-2zM16 12h6M7 19h10",
};

export type IconName = keyof typeof P;
export default function Icon({ name, size = 22, className = "", fill = false }: { name: string; size?: number; className?: string; fill?: boolean }) {
  const d = P[name] ?? P.star;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
