import { END_LABEL, type Difficulty, type GameOverData } from "../core/engine";
import type { ScoreEntry } from "../core/scores";
import { Btn, ScoreTable, Stat, fmt, fmtTime } from "./ui";

export const DIFF_LABEL: Record<Difficulty, string> = { easy: "Leicht", normal: "Normal", hard: "Schwer", hardcore: "Hardcore" };

export default function GameOver({ data, scores, rank, onRestart, onMenu, isTouch }: { data: GameOverData; scores: ScoreEntry[]; rank: number; onRestart: () => void; onMenu: () => void; isTouch: boolean }) {
  const title = data.reason === "finished" ? "FAHRT BEENDET" : END_LABEL[data.reason];
  const color = data.reason === "dead" ? "var(--color-alert-500)" : data.reason === "arrested" ? "var(--color-cop-500)" : "var(--color-sun-500)";
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto sb-scroll">
      <div className="sb-dim" />
      <div className="relative mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-5 py-8">
        <div className="sb-eyebrow">{data.mode === "free" ? "Freie Fahrt" : `Verfolgungsjagd · ${DIFF_LABEL[data.difficulty]}`}</div>
        <h2 className="popin sb-title text-center text-6xl tracking-[0.1em] sm:text-8xl">{title}</h2>
        <span className="mt-2 block h-[2px] w-24" style={{ background: color }} />
        {rank === 0 && <div className="popin mt-3 rounded-[3px] bg-sun-500 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-ink-950">Neuer Rekord</div>}
        {rank > 0 && <div className="popin mt-3 rounded-[3px] border border-sun-500/60 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-sun-300">Platz {rank + 1} in der Bestenliste</div>}
        <div className="sb-num mt-3 text-6xl text-fog-100 sm:text-7xl">{fmt(data.score)}</div>
        <div className="sb-note">Punkte</div>
        <div className="mt-4 grid w-full max-w-lg grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Zeit" value={fmtTime(data.time)} /><Stat label="Cash" value={"$" + fmt(data.cash)} /><Stat label="Bester Drift" value={fmt(data.bestDrift)} /><Stat label="Cops erledigt" value={data.mode === "free" ? "–" : String(data.takedowns)} />
        </div>
        <div className="mt-6 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
          <div className="flex-1"><Btn primary onClick={onRestart}>NOCHMAL</Btn></div>
          <div className="flex-1"><Btn onClick={onMenu}>MENÜ</Btn></div>
        </div>
        {!isTouch && <div className="sb-note mt-2">Enter / R für sofortigen Neustart</div>}
        <div className="sb-panel mt-6 w-full max-w-md p-4">
          <h3 className="sb-h3 mb-2">Bestenliste</h3>
          <ScoreTable scores={scores} highlight={rank} />
        </div>
      </div>
    </div>
  );
}
