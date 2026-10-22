import { END_LABEL, type Difficulty, type GameOverData } from "../core/engine";
import type { ScoreEntry } from "../core/scores";
import { Btn, ScoreTable, Stat, fmt, fmtTime } from "./ui";

export const DIFF_LABEL: Record<Difficulty, string> = { easy: "Leicht", normal: "Normal", hard: "Schwer" };

export default function GameOver({ data, scores, rank, onRestart, onMenu, isTouch }: { data: GameOverData; scores: ScoreEntry[]; rank: number; onRestart: () => void; onMenu: () => void; isTouch: boolean }) {
  const title = data.reason === "finished" ? "FAHRT BEENDET" : END_LABEL[data.reason];
  const color = data.reason === "dead" ? "#ff2a3a" : data.reason === "arrested" ? "#4da3ff" : "#ff3cac";
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0b0614]/75 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-5 py-8">
        <h2 className="popin text-center font-display text-7xl tracking-wider sm:text-9xl" style={{ color, textShadow: `0 0 30px ${color}` }}>{title}</h2>
        {rank === 0 && <div className="popin mt-1 rounded-full bg-yellow-300 px-4 py-1 font-display text-xl tracking-widest text-black shadow-[0_0_24px_rgba(255,210,63,0.9)]">NEUER REKORD!</div>}
        {rank > 0 && <div className="popin mt-1 rounded-full bg-pink-500 px-4 py-1 font-display text-xl tracking-widest">PLATZ {rank + 1} IN DER BESTENLISTE</div>}
        <div className="mt-4 font-display text-6xl tracking-wide text-white sm:text-7xl" style={{ textShadow: "0 0 20px rgba(255,60,172,0.7)" }}>{fmt(data.score)}</div>
        <div className="mt-1 text-xs uppercase tracking-widest text-white/50">{data.mode === "free" ? "Freie Fahrt" : `Verfolgungsjagd · ${DIFF_LABEL[data.difficulty]}`}</div>
        <div className="mt-4 grid w-full max-w-lg grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Zeit" value={fmtTime(data.time)} /><Stat label="Cash" value={"$" + fmt(data.cash)} /><Stat label="Bester Drift" value={fmt(data.bestDrift)} /><Stat label="Cops erledigt" value={data.mode === "free" ? "–" : String(data.takedowns)} />
        </div>
        <div className="mt-6 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
          <div className="flex-1"><Btn primary onClick={onRestart}>NOCHMAL</Btn></div>
          <div className="flex-1"><Btn onClick={onMenu}>MENÜ</Btn></div>
        </div>
        {!isTouch && <div className="mt-2 text-xs text-white/40">Enter / R für sofortigen Neustart</div>}
        <div className="mt-6 w-full max-w-md rounded-2xl border border-pink-400/30 bg-black/50 p-4">
          <h3 className="mb-2 font-display text-2xl tracking-widest text-pink-300">Bestenliste</h3>
          <ScoreTable scores={scores} highlight={rank} />
        </div>
      </div>
    </div>
  );
}
