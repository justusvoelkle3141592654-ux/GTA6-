// the design colours for canvas drawing (minimap, big map, banners, floating texts): same values as the tokens in index.css
export const PAL = {
  ink: "#0c1015", ink2: "#11161d", ink3: "#171e27",
  fog: "#eef1f4", fog3: "#b9c1cb", fog5: "#808b98",
  sun: "#e6a536", sun3: "#f8d27e",
  alert: "#e0464b", alert4: "#f06a6e",
  ok: "#43b97c", ok4: "#6fd3a0",
  cop: "#4a86f0", cop4: "#79a8ff",
};

const cache = new Map<string, string>();
// game code passes bright colours for banners, floating texts and map goals; they are drawn with the palette
// colour of the same family: red = danger, orange / yellow / pink = the gold accent, green = money / success,
// cyan / blue = police and info, grey / white = neutral
export function tone(c: string): string {
  const hit = cache.get(c);
  if (hit) return hit;
  let out = PAL.fog;
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) {
    const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d > 0.18) {
      let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
      out = h < 15 || h >= 345 ? PAL.alert4 : h < 70 ? PAL.sun3 : h < 170 ? PAL.ok4 : h < 255 ? PAL.cop4 : PAL.sun3;
    }
  }
  cache.set(c, out);
  return out;
}
