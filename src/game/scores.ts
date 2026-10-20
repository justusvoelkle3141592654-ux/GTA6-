export interface ScoreEntry {
  name: string;
  score: number;
  time: number;
  stars: number;
  reason: string;
  date: number;
  tag?: string;
}

const KEY = "viceheat.scores.v1";
const NAME_KEY = "viceheat.name";

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScoreEntry[];
    return Array.isArray(arr) ? arr.slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function saveScore(e: ScoreEntry): { list: ScoreEntry[]; rank: number } {
  const list = loadScores();
  list.push(e);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  const rank = top.indexOf(e);
  try {
    localStorage.setItem(KEY, JSON.stringify(top));
  } catch {
    /* ignore */
  }
  return { list: top, rank };
}

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || "TOMMY";
  } catch {
    return "TOMMY";
  }
}

export function saveName(n: string) {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* ignore */
  }
}
