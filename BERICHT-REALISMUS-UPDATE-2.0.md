# Solara Bay – Realismus Update 2.0 (APK 3.4)

Grundlage: Umsetzungsauftrag „Realismus Update 2.0“ (Word-Datei). Der Auftrag wurde im Quellprojekt umgesetzt, nicht nur beschrieben. Stand: Branch `claude/apk-changes-build-98koud`, aufbauend auf APK 3.3.

## 1. Umgesetzt

- **Designsystem:** zentrale Farben, Schriften, Abstände, Ecken, Linien, Schatten, Ebenen und Animationstempo in `src/index.css`. Wiederverwendbare Bausteine für Knöpfe, Karten, Listen, Reiter, Menüeinträge, Hinweise, Fortschrittsbalken, Eingabefelder und Tastenkürzel.
- **Startbildschirm:** links die Marke „SOLARA BAY“ mit goldener Linie, kompakter Spielstand (Bargeld, Missionen, Spielzeit) und klare Aktionen: Weiterspielen, Neues Spiel (mit Bestätigung). Rechts in Reitern: Spiel einrichten, Bestenliste, Steuerung. Im Hintergrund fliegt die echte Stadt vorbei, es gibt keine Fremdbilder.
- **HUD:**
  - Schlanke Werkzeugleiste oben mit Symbolen.
  - Eigene Zielkarte mit goldener Kante und Zeitanzeige (rot unter 10 s).
  - Geld oben rechts, Fahndung mit Hinweis „Gesucht“ oder „Polizei sucht dich“, Hinweiskarten links.
  - Aktionsknopf für Orte in Gold.
  - Auf schmalen Handys überlappen Werkzeugleiste und Minikarte nicht mehr.
- **Ansagen:** Mission erfüllt, Fahndung, Orte usw. erscheinen jetzt in einem dunklen Filmband mit einer kurzen Linie in der Bedeutungsfarbe: Grün für Erfolg und Belohnung, Rot für Gefahr, Gold für Fahndung und Hinweise, Weiß neutral. Sie sitzen tiefer und verdecken die Zielkarte nicht mehr.
- **Endbildschirm:** statt „WASTED“/„BUSTED“ (GTA-Wörter) jetzt eigene Titel „NIEDERGESTRECKT“ und „FESTGENOMMEN“ mit Untertitel „Krankenhaus“ bzw. „Polizeiwache“.
- **Pausenmenü:** eigene Struktur mit Seitenleiste links (aktiver Eintrag mit goldener Kante) statt der Reiter oben. Kopfzeile mit Seitentitel, Geld, Uhrzeit und „Weiter“. Neue Übersichtsseite mit Status (Bankkonto, Story, Fahndung, Garage, aktuelles Ziel).
- **Karte:** Karte links, rechts Auswahl, Filter, Legende und Läden. Einheitliche Kartensymbole (dunkle Scheibe, farbiger Ring, helles Zeichen) in Minikarte und großer Karte. Stadtteilnamen ohne Neonfarben. Routen- und Markierungslogik unverändert.
- **Handy, Laden, Garage, Jobs, Kontakte, Flug, Verstecken, Spawnen, Einstellungen, Hilfe, Codes, Aufzug, Waffenrad, Dialoge, Anruf, Game Over:** alle auf dasselbe Designsystem umgestellt. Laden mit fester Kopfzeile und scrollbarer Liste, Handy mit einheitlichen dunklen App-Kacheln statt Regenbogenfarben.
- **Touch-Steuerung:**
  - Ruhige, dunkle Glas-Knöpfe, beim Drücken Gold (Feuer: Rot).
  - Neuer Knopf „REIN / RAUS“ unten rechts.
  - Die Einstellung „HUD-Größe“ gilt jetzt auch für Stick und Aktionsknöpfe; Ränder (Notch, Systemleisten) werden berücksichtigt.
- **Spielwelt:**
  - Filmische Farbkorrektur direkt in der Tonwertabbildung, damit auch die Stufe „Schnell“ ohne zusätzlichen Rechenschritt etwas davon hat: ruhigere Farben, kühle Schatten, warmes Licht.
  - Dunstigerer, weniger knalliger Himmel und Nebel ab kürzerer Entfernung für mehr Tiefe.
  - Etwas weniger Fülllicht, Fassaden mit Betonkörnung, Geschossdecken, Fensterlaibungen, Vorhängen, dunklen Räumen und Schmutzspuren.
  - Neutraler Asphalt, gedämpfte Fahrbahnmarkierungen, Startautos und herbeigerufene Fahrzeuge in Werkslacken statt Neon.
- **Stabilität:** Verlässt das Spiel den laufenden Zustand (Pause, Handy, Laden, Dialog), wird jede Eingabe gelöst. Vorher konnte der Stick hängen bleiben, wenn man beim Fahren das Handy öffnete. Im Pausenmenü wird die 3D-Szene nur noch alle 8 Bilder neu gezeichnet (Akku).
- **App-Symbol:** Palme vor goldener Sonne auf dunklem Grund statt Pink und Türkis.

## 2. Geänderte Dateien

| Datei | Rolle der Änderung |
|---|---|
| `src/index.css` | Design-Tokens und Bausteine, ruhige Einblendung, reduzierte Bewegung bei Systemeinstellung |
| `src/ui/palette.ts` (neu) | Farben für Canvas-Zeichnungen, Zuordnung alter Spielfarben zur Palette |
| `src/ui/ui.tsx`, `src/ui/icons.tsx` | gemeinsame Bausteine (Toast, Seitentitel, Sterne, Auswahl), neue Symbole |
| `src/ui/StartScreen.tsx` | neuer Startbildschirm |
| `src/ui/Hud.tsx`, `src/ui/TouchControls.tsx` | HUD und Touch-Steuerung |
| `src/ui/PauseMenu.tsx`, `src/ui/GameTabs.tsx`, `src/ui/BigMap.tsx` | Pausenmenü mit Seitenleiste, Menüseiten, Karte |
| `src/ui/Phone.tsx`, `src/ui/ShopMenu.tsx`, `src/ui/DialogBox.tsx`, `src/ui/WeaponWheel.tsx`, `src/ui/LiftPanel.tsx`, `src/ui/GameOver.tsx`, `src/ui/Help.tsx`, `src/ui/CodesApp.tsx` | Nebenscreens |
| `src/App.tsx` | HUD nur im laufenden Spiel, neuer Knopf REIN/RAUS, Farben |
| `src/core/engine.ts` | Ansagen, Minikarte, Zielkreuz, Schwebetexte, End-Titel, Eingaben lösen, seltener zeichnen in der Pause |
| `src/core/tips.ts` | Hinweistexte an die neuen Knöpfe und Kartensymbole angepasst |
| `src/world/places.ts` | einheitliche Kartensymbole |
| `src/render/renderer3d.ts`, `src/render/atmosphere.ts`, `src/render/worldmesh.ts` | Farbkorrektur, Himmel, Nebel, Licht, Fassaden, Asphalt, Markierungen |
| `src/vehicles/vehicles.ts`, `src/gameplay/spawner.ts`, `src/gameplay/jobs.ts` | Werkslacke |
| `index.html`, `android/.../MainActivity.java`, `android/app/src/main/res/drawable/ic_*.xml`, `android/app/build.gradle.kts` | Hintergrundfarbe, App-Symbol, Version 3.4 (Code 8) |
| `solara-bay-2.html`, `solara-bay-2.apk` | über `npm run build:apk` neu gebaut |

## 3. Designentscheidungen

- **Farben:**
  - Flächen in Asphalt, Graphit und Nachtblau (`ink-950` bis `ink-600`), Text in neutralem Hellgrau (`fog`).
  - Eine warme Akzentfarbe „Solara-Gold“ (`sun-500` #e6a536) für Navigation, Auswahl, Fokus und Hauptaktion. Sie leitet sich aus dem bisherigen goldenen „BAY“ ab.
  - Getrennte Zustandsfarben: Rot für Gefahr und Fahndung, Grün nur für Geld und Erfolg, Blau für Polizei und Info.
- **Schrift:** die vorhandenen, eingebetteten Schriften Bebas Neue (Titel, Zahlen, Geld) und Inter (Texte, Labels). Kleine Labels in Großbuchstaben mit Sperrung, Zahlen mit festen Ziffernbreiten. Es gibt keine neuen Webfonts und keine Netzwerkzugriffe.
- **Wiedererkennung:** die kurze goldene Linie unter Titeln, Ansagen und der Marke; aktive Elemente mit goldener Kante links. Kleine Ecken (4–6 px) statt großer Rundungen, kein Neon-Glühen. Weichzeichner-Hintergründe in den Menüs sind entfernt (teuer auf Handys) und durch Verläufe ersetzt.
- **HUD:** dauerhaft nur Minikarte mit Balken, Geld, Fahndung und Werkzeugleiste. Ziel, Hinweise, Ortsknopf und Ansagen erscheinen nur bei Bedarf.
- **GTA-Abgrenzung:** keine GTA-Schriften, Logos, Wörter oder Menüaufbauten. „WASTED/BUSTED“ ersetzt, Pausenmenü mit Seitenleiste statt Reiterleiste oben, grünes Dollar-Geld nur noch als kleines Zeichen.
- **Spielwelt:** Realismus über Farbe und Licht statt teurer Effekte. Die Grafikstufen Schnell, Mittel, Hoch und Ultra bleiben unverändert erhalten, Bloom und Schatten wie bisher je Stufe.

## 4. Validierung (tatsächlich ausgeführt)

| Befehl / Test | Ergebnis |
|---|---|
| `npx tsc --noEmit` | ohne Fehler |
| `npm run build:apk` | erfolgreich; `solara-bay-2.html` 3,07 MB; APK 3.4 (Code 8), signiert mit dem festen Schlüssel (Zertifikat `67f3477d…`, wie 3.3); `assets/index.html` identisch mit `solara-bay-2.html` |
| Playwright, Screenshots aller Screens bei 780×360 und 1280×590 | Startmenü, HUD, Pause, Karte, Jobs, Garage, Einstellungen, Fortschritt, Handy, Laden, Dialog, Waffenrad, Aufzug, Anruf, Ansagen, Endbildschirm, Game Over: keine Seitenfehler |
| Playwright, alle 4 Grafikstufen tags und nachts | keine Seiten- und keine Shaderfehler |
| Zurück-Taste, Speichern, Sicherung, Verlassen mit Fahndung | bestanden (wie in 3.3, nach dem Umbau erneut ausgeführt) |
| Mehrfinger-Touch mit echten Touch-Ereignissen (Stick + Feuer gleichzeitig, einen Finger heben, Abbruch, Handy öffnen bei gehaltenem Stick) | bestanden; den Fall „Handy bei gehaltenem Stick“ habe ich im Code gefunden und vor diesem Test in `setState` behoben (ein Testlauf vor dem Fix gibt es nicht) |
| fertige HTML-Datei über `file://` | startet, Zurück-Logik vorhanden, keine Fehler |

Alle Browser-Tests liefen mit Software-WebGL (SwiftShader), nicht auf einer echten Handy-GPU.

## 5. Offen

- **Gerätetest:** Kein Android-Gerät und kein Emulator verfügbar. Bildrate, Akkuverbrauch, Lesbarkeit auf echten Bildschirmen, Notch/Cutout und die echte WebView sind ungeprüft.
- **Neue 3D-Modelle oder Animationen:** wurden nicht erstellt. Gebäude, Bäume, Figuren und Fahrzeuge sind dieselben Modelle wie vorher, nur mit anderen Farben, Materialien und anderem Licht.
- **Hilfe-Texte zu Tastatur und Gamepad:** inhaltlich unverändert, nur neu gestaltet.

## 6. Nächster sinnvoller Schritt

APK 3.4 auf dem Handy installieren (sie installiert sich über 3.3) und prüfen:
- Lesbarkeit von HUD, Pause und Karte in der Sonne,
- Treffsicherheit der Touch-Knöpfe,
- Bildrate auf „Schnell“ und „Mittel“.
