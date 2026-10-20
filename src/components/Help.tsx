import { ACTIONS, ACTION_LABEL, keyLabel, type Bindings } from "../game/input";
import { Key } from "./ui";

// controls page (start screen and pause menu); desktop keys come from the current bindings
export default function Help({ isTouch, bind }: { isTouch: boolean; bind: Bindings | null }) {
  return (
    <div className="text-sm">
      {isTouch ? (
        <ul className="space-y-2 text-white/80">
          <li><b className="text-white">Linker Daumen</b> – fahren / laufen (3D & Ego: hoch = Gas, seitlich = lenken; Vogelperspektive: Richtung ziehen)</li>
          <li><b className="text-orange-300">FEUER</b> – schießt (Auto-Zielen auf Cops), Fäuste/Schläger schlagen zu</li>
          <li><b>Waffe</b> antippen = nächste Waffe · <b>gedrückt halten</b> = Waffenrad · <b>💥</b> = Bomben zünden</li>
          <li><b className="text-pink-300">DRIFT</b> – Handbremse · <b className="text-cyan-300">NITRO / SPRINT</b> (Nitro verbraucht sich und lädt langsam nach)</li>
          <li><b>🚪 / 🚗</b> oben – aus- & einsteigen (Autos klauen) · <b>📻</b> – Radiosender · <b>🎥</b> – Kamera</li>
          <li><b>Grüner Knopf</b> – Laden / Ort betreten, Missionen starten</li>
          <li><b>⏸</b> Pause – Karte (Wegpunkt setzen), Fortschritt, Speichern, Einstellungen</li>
        </ul>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-white/80">
          {ACTIONS.map((a) => (
            <div key={a} className="contents">
              <span>{(bind ? bind.keys[a] : []).slice(0, 2).map((k) => <Key key={k}>{keyLabel(k)}</Key>).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, " / ", el] : [el]), [])}</span>
              <span>{ACTION_LABEL[a]}</span>
            </div>
          ))}
          <span><Key>Maus</Key> links</span><span>Feuer</span>
          <span><Key>1</Key> … <Key>8</Key> / Mausrad</span><span>Waffe wählen</span>
        </div>
      )}
      <div className="mt-4 border-t border-white/10 pt-3 text-xs leading-relaxed text-white/60">
        🔫 Pistole: 3 Treffer = Cop kaputt · 🚀 Rakete: 1 Treffer · 💣 Haftbombe klebt an Autos · 🍍 Granate explodiert nach 2 s<br />
        Säulen: <b className="text-green-300">grün</b> Cash · <b className="text-orange-300">orange</b> Raketen · <b className="text-red-300">rot</b> Bomben · <b className="text-cyan-300">blau</b> Nitro · <b>weiß</b> Reparatur<br />
        🌆 <b>Open World:</b> Verbrechen vor Zeugen bringen Sterne. Bleib außer Sicht der Cops, bis die Sterne aufhören zu blinken. Lackieren (Werkstatt) oder Umziehen (bis 2 Sterne) hilft beim Verstecken.
        Ab 3 Sternen gibt es Straßensperren, ab 4 einen Hubschrauber, bei 5 das SEK.<br />
        Erledigt → <b className="text-red-300">Krankenhaus</b>, verhaftet → <b className="text-blue-300">Polizeiwache</b>, jeweils mit Geldverlust.<br />
        🏪 Läden: <b>W</b> Waffen · <b>T</b> Lack & Tuning · <b>K</b> Kleidung · <b>I</b> Imbiss · <b>H</b> Safehouse & Garage. Pinke Buchstaben auf der Karte sind Auftraggeber.<br />
        💾 Automatisches Speichern jede Minute ohne Sterne, Safehouse und Pausenmenü speichern ebenfalls.
      </div>
    </div>
  );
}
