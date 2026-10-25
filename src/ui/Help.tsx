import { ACTIONS, ACTION_LABEL, keyLabel, type Bindings } from "../core/input";
import { PAD_LABEL } from "../core/gamepad";
import { Key } from "./ui";

// controls page (start screen and pause menu); desktop keys come from the current bindings
export default function Help({ isTouch, bind }: { isTouch: boolean; bind: Bindings | null }) {
  return (
    <div className="text-sm">
      {isTouch ? (
        <ul className="space-y-2 text-white/80">
          <li><b className="text-white">Linker Daumen</b> – fahren / laufen (3D und Ego: hoch = Gas, seitlich = lenken; Vogelperspektive: Richtung ziehen)</li>
          <li><b className="text-orange-300">FEUER</b> – schießt (Zielhilfe auf Angreifer), Fäuste und Schläger schlagen zu</li>
          <li><b>Waffe</b> antippen = nächste Waffe · <b>gedrückt halten</b> = Waffenrad · roter Knopf = Bomben zünden</li>
          <li><b className="text-white">DRIFT</b> – Handbremse · <b className="text-cyan-300">NITRO / SPRINT</b> (Nitro verbraucht sich und lädt langsam nach)</li>
          <li>Oben: <b>Einsteigen / Aussteigen</b>, <b>Radio</b>, <b>Kamera</b>, <b>Jobs</b>, <b>Handy</b>, <b>Pause</b></li>
          <li><b>Grüner Knopf</b> – Laden betreten und an der Theke kaufen, Missionen und Versteckspiel starten, hinsetzen</li>
          <li><b>Kampfjet:</b> Gas geben, ab 120 km/h <b className="text-white">HOCH</b> zum Abheben · Feuer: Bordkanone · <b className="text-orange-300">RAKETE</b> (G) sucht sich ein Ziel · landen auf ebener Straße</li>
          <li><b>Hubschrauber:</b> <b className="text-white">HOCH</b> steigen · <b className="text-cyan-300">RUNTER</b> sinken · aussteigen nur gelandet</li>
        </ul>
      ) : (
        <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 gap-y-1.5 text-white/80">
          <span className="text-[11px] uppercase tracking-widest text-white/45">Tastatur</span><span /><span className="text-[11px] uppercase tracking-widest text-white/45">Gamepad</span>
          {ACTIONS.map((a) => (
            <div key={a} className="contents">
              <span>{(bind ? bind.keys[a] : []).slice(0, 2).map((k) => <Key key={k}>{keyLabel(k)}</Key>).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, " / ", el] : [el]), [])}</span>
              <span>{ACTION_LABEL[a]}</span>
              <span className="text-right text-white/55">{PAD_LABEL[a] ?? (a === "left" || a === "right" ? "linker Stick" : "")}</span>
            </div>
          ))}
          <span><Key>Maus</Key> links</span><span>Feuer</span><span className="text-right text-white/55">RT</span>
          <span><Key>Maus</Key> rechts ziehen</span><span>Kamera drehen</span><span className="text-right text-white/55">rechter Stick</span>
          <span><Key>1</Key> … <Key>8</Key> / Mausrad</span><span>Waffe wählen</span><span className="text-right text-white/55">LB</span>
        </div>
      )}
      <div className="mt-4 space-y-1 border-t border-white/10 pt-3 text-xs leading-relaxed text-white/60">
        <p><b className="text-white/80">Open World:</b> Verbrechen vor Zeugen bringen Sterne. Bleib außer Sicht der Polizei, bis die Sterne aufhören zu blinken. Lackieren oder Umziehen (bis 2 Sterne) hilft beim Verstecken. Ab 2 Sternen Abfangjäger, ab 3 Polizei-SUVs und Straßensperren, ab 4 Hubschrauber und Nagelbänder, bei 5 das SEK und Kampfjets, bei 6 das Militär. Wer selbst fliegt, hat ab 3 Sternen Jets am Hals.</p>
        <p><b className="text-white/80">Läden:</b> Zehn Läden kann man betreten (Türsymbol auf der Karte). Gekauft wird an der Theke. Mit gezogener Waffe auf den Verkäufer zielen ist ein Überfall.</p>
        <p><b className="text-white/80">Autos:</b> Verschlossene Autos – die Scheibe wird eingeschlagen (Alarm). Besetzte Autos – der Fahrer wird herausgezogen. Über 60 km/h aussteigen heißt abrollen.</p>
        <p><b className="text-white/80">Jobs:</b> 15 Jobs im Menü (J), im Handy (T) oder an ihrem Punkt auf der Karte annehmen. Fehlt das Fahrzeug, wird es geliefert.</p>
        <p><b className="text-white/80">Versteckspiel:</b> eigener Reiter im Pausenmenü und im Handy, fünf Spielfelder, drei Modi.</p>
        <p><b className="text-white/80">Hardcore:</b> der rote Stern <b>HC</b> hinter den Fahndungssternen schaltet ihn an und aus. <b className="text-white/80">Haft:</b> wie lange, stellst du unter Einstellungen ein (Sekunden).</p>
        <p><b className="text-white/80">Cheats:</b> Pausenmenü oder Handy → Cheats. <b>TNT</b> gibt einen Block Sprengstoff pro Eingabe; ablegen mit Feuer, nach 5 Sekunden geht er hoch – auch ganze Läden.</p>
        <p><b className="text-white/80">Speichern:</b> automatisch jede Minute ohne Sterne, außerdem im Safehouse (Bett) und im Pausenmenü.</p>
      </div>
    </div>
  );
}
