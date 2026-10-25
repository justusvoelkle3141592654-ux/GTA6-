# Solara Bay – Prüfbericht und Änderungen (APK 3.3)

Grundlage: Prüfauftrag „Tiefgehende APK- und Spielanalyse“ (Word-Datei). Abweichend vom Dokument („keine Änderungen“) wurden auf Wunsch die belegten Fehler auch behoben. Stand: Branch `claude/apk-changes-build-98koud`, aufbauend auf APK 3.2 (Commit 690425f).

Kennzeichnung: **Befund** = durch Datei/Code oder ausgeführten Test belegt. **Risiko** = aus dem Code plausibel, ohne Gerätetest nicht bestätigt. **Idee** = optionaler Vorschlag, kein Fehler.

## A. Kurzurteil

Solara Bay ist ein umfangreiches Open-City-Spiel (React + Three.js) in einer schlanken Android-WebView-Hülle. Story, Jobs, Läden, Garage, Polizei und Fortschritt sind über einen gemeinsamen Spielstand und ein gemeinsames Pausen-/Handymenü verbunden. Die App arbeitet komplett offline und fordert keine Berechtigungen an.

Die größten Schwachstellen lagen nicht im Spielinhalt, sondern bei der Android-Integration und beim Speichern: Fortschritt konnte beim Verlassen oder bei einem beschädigten Spielstand still verloren gehen, die Zurück-Taste konnte die App nicht verlassen, und jede neue APK hatte eine andere Signatur. Updates ließen sich deshalb nicht über die installierte App installieren.

Die drei wichtigsten Verbesserungen für Spielende (alle in 3.3 umgesetzt):
1. Spielstand wird beim Wechsel in den Hintergrund gesichert, und ein beschädigter Spielstand fällt auf die vorherige Sicherung zurück.
2. Die Zurück-Taste arbeitet schrittweise und verlässt im Hauptmenü die App.
3. Fester Signaturschlüssel: künftige Updates lassen sich direkt über die installierte App installieren.

## B. Was tatsächlich geprüft wurde

- **APK-Identität:** `solara-bay-2.apk` (3.2) hat SHA-256 `774087a44d129c4061a9c006f38d83575ad3493f770330a53a6d17a036649479`. Der Wert stimmt mit dem Prüfauftrag überein.
- **Quellprojekt:** vollständig vorhanden (`src/`, ca. 22.000 Zeilen TypeScript/TSX), Android-Hülle in `android/` (Java, Gradle Kotlin DSL, AGP 8.7.3), Build-Skripte in `package.json` (`build:html`, `build:apk`).
- **Tests im Projekt:** keine automatisierten Tests vorhanden.
- **Ausgeführt:**
  - `npx tsc --noEmit` lief ohne Fehler.
  - `npm run build:apk` lief erfolgreich (Gradle 8.14.3, Android SDK 35).
  - `apksigner verify`, `aapt2 dump badging` und ein Vergleich von `assets/index.html` mit `solara-bay-2.html` (identisch).
  - Laufzeittests mit Playwright/Chromium (Software-WebGL, 860×400, Touch-Emulation) gegen den Dev-Server und gegen die fertige HTML-Datei über `file://`.
- **Grenzen:** Es gab kein Android-Gerät und keinen Emulator. Das Verhalten der echten WebView (Zurück-Taste, Hintergrund, Sperrbildschirm, Systembackup, Leistung, Akku) ist **ungeprüft**. Es gibt keine FPS-, Speicher- oder Akkuwerte.

## C. Stärken (belegt)

- **Spielstand-Prüfung:** `validate()` in `src/core/save.ts` prüft jedes Feld, begrenzt Werte und wandelt die Versionen 1–3 um. Positionen alter Spielstände werden auf die nächste Straße gesetzt (`applySave`, `legacy`).
- **Speicher-Sperren klar benannt:** `saveBlock()` (`src/core/engine.ts`) liefert Gründe (`wanted`, `busy`, `mode`), und die Oberfläche zeigt passende Texte (`SAVE_MSG`). Gibt es keinen lokalen Speicher, wird das im Startmenü angezeigt.
- **Feste Physik-Schrittweite:** Das Spiel läuft mit einem Akkumulator und gedeckeltem Frame-Delta (`loop`, `dt ≤ 0,05 s`, höchstens 10 Schritte). Die Spielzeit hängt damit nicht von der Bildrate ab.
- **Touch:** Pointer-Capture und `pointercancel` sind für Stick, Kamera und Knöpfe behandelt (`src/ui/TouchControls.tsx`).
- **Offline:** Alle 21 Blender-Modelle und die Schriften sind als `data:`-URIs eingebettet. Im Bundle gibt es keine externen Netzwerkziele. Das Manifest hat keine Berechtigungen, und es gibt keine `addJavascriptInterface`-Brücke.

## D. Priorisierte Verbesserungen

| Prio | Kategorie | Befund / Risiko (Beleg) | Auswirkung | Änderung / nächster Test | Aufwand | Sicherheit |
|---|---|---|---|---|---|---|
| P1 | Android | **Befund:** Jede Sitzung signierte mit einem neuen Debug-Schlüssel. Die APKs 3.0–3.2 haben das Zertifikat `04757b33…`, der Schlüssel liegt nicht im Projekt. | Ein Update über die installierte App wird abgelehnt. Nach dem Deinstallieren sind die Spielstände weg. | **Umgesetzt:** fester Schlüssel `android/app/solarabay.jks` | klein | hoch |
| P1 | Speicher | **Befund:** `loadSave()` las nur den ersten vorhandenen Schlüssel. War `solarabay.save.v4` unlesbar, galt das Spiel als „kein Spielstand“, und der nächste Autosave überschrieb ihn. | Stiller Verlust des gesamten Fortschritts | **Umgesetzt:** Sicherung `solarabay.save.v4.bak` und Rückfall auf Sicherung und alte Versionen | klein | hoch |
| P1 | Speicher | **Befund:** „Hauptmenü (speichert)“ ignorierte das Ergebnis von `saveGame()`. Bei Fahndung wurde nicht gespeichert, ohne Hinweis. | Fortschritt seit dem letzten Speichern weg | **Umgesetzt:** Hinweis und zweites Tippen nötig (Pausenmenü und Handy) | klein | hoch |
| P1 | Android | **Risiko:** Beim Wechsel in den Hintergrund wurde nur pausiert, nicht gespeichert (`onVis`). Android kann die App im Hintergrund beenden. | Bis zu 60 s Fortschritt verloren | **Umgesetzt:** `goBackground()` speichert, wenn erlaubt. Die Android-Hülle ruft es vor `pauseTimers()` auf. Gerätetest offen. | klein | mittel |
| P2 | Android | **Befund:** Die Zurück-Taste sendete nur Escape. Im Hauptmenü und auf dem Game-Over-Bildschirm passierte nichts, die App ließ sich nicht per Zurück verlassen. | Ungewohnte Bedienung | **Umgesetzt:** `window.solaraBack()` arbeitet schrittweise und schickt die App im Hauptmenü in den Hintergrund (`moveTaskToBack`). | klein | hoch (Logik), Gerätetest offen |
| P2 | Steuerung | **Befund:** Beim Pausieren wird `TouchControls` entfernt, ohne „Finger hoch“. `touch.active/jx/fire/nitro` blieben gesetzt, und nach „Weiter“ fuhr oder schoss die Figur weiter. | Ungewolltes Fahren/Schießen | **Umgesetzt:** `releaseInput()` setzt beim Pausieren und bei Fokusverlust alles zurück (im Test bestätigt). | klein | hoch |
| P2 | WebGL | **Risiko:** Für den Verlust des WebGL-Kontexts gab es keine Behandlung im Spiel. Die Simulation lief ohne Bild weiter. | Unfaire Schäden/Fahndung | **Umgesetzt:** Pause bei `webglcontextlost`. Ob danach alles korrekt wiederhergestellt wird, ist ungeprüft. | klein | mittel |
| P3 | UX | **Befund:** Die Gesamtquote konnte bei alten Spielständen mit nicht mehr vorhandenen IDs über 100 % steigen. | Falsche Anzeige | **Umgesetzt:** jeder Anteil auf höchstens 100 % begrenzt | klein | mittel |
| P2 | Sicherheit | **Risiko:** `setAllowFileAccess(true)` ist für `file:///android_asset` laut Android-Doku nicht nötig. | Härtung, kein Angriffsweg nachgewiesen | Auf `false` stellen und auf dem Gerät prüfen (bewusst **nicht** geändert, weil ein Ladefehler ohne Gerätetest nicht auszuschließen ist) | klein | mittel |
| P3 | Android | **Risiko:** `allowBackup="true"` ohne Regeln. WebView-Daten unter `app_webview` fallen vermutlich unter das Auto-Backup. | Spielstände könnten mitgesichert werden (eher Vorteil) | Mit `adb shell bmgr backupnow de.solarabay.game` auf einem Gerät prüfen | klein | niedrig |
| P3 | Energie | **Risiko:** `FLAG_KEEP_SCREEN_ON` gilt auch im Haupt- und Pausenmenü. | Akkuverbrauch im Leerlauf | Flag nur im laufenden Spiel setzen (braucht eine JS→Android-Meldung) | mittel | mittel |
| P3 | Test | **Befund:** Es gibt keine automatisierten Tests. | Rückschritte bleiben unbemerkt | Playwright-Skripte aus dieser Prüfung ins Projekt übernehmen | mittel | hoch |
| P3 | Performance | **Idee:** Es gibt nur feste Grafikstufen, keine Anpassung an die gemessene Bildrate. | – | Erst Frame-Zeiten auf einem schwachen Gerät messen, dann entscheiden | mittel | – |

## E. Detailanalyse (Auswahl)

- **Speichern:**
  - Ablauf: Autosave alle 60 s (`AUTOSAVE_EVERY`), `saveSoon()` setzt den Timer auf 1 s, `saveGame()` → `writeSave()`.
  - Gesperrt wird bei Fahndung, Haft, Spielende und anderen Menüs als dem Handy. Pausenmenü, Handy, Autosave und „Hauptmenü“ nutzen dieselbe Routine.
  - Die Meldung „Automatisch gespeichert“ erscheint nur bei dauerhafter Speicherung (`"saved"`).
  - Neu: `writeSave()` legt vor dem Überschreiben den letzten lesbaren Stand unter `.bak` ab. `loadSave()` probiert der Reihe nach Sitzungsspeicher, `v4`, `.bak`, `v3`, `v2`, `v1`. Nebenwirkung: etwa doppelter Speicherbedarf; der Spielstand ist klein (Listen begrenzt).
  - Schlüssel: Einstellungen `solarabay.settings.v1`, Startoptionen `solarabay.config.v1` (Rückfall `viceheat.config.v3`), Bestenliste `solarabay.scores.v1` und `solarabay.name` (Rückfall `viceheat.*`). Das sind getrennte Daten, kein Spielstand.
- **Zurück-Taste:**

  | Zustand | Zurück bewirkt |
  |---|---|
  | Spiel läuft | Pause |
  | Pausenmenü, erste Seite | Weiterspielen |
  | Andere Pausenseite | Zurück zur ersten Seite |
  | Handy, Laden usw. | Schließen |
  | Dialog | nichts (weiter mit Antippen) |
  | Game Over | Hauptmenü |
  | Hauptmenü | App in den Hintergrund |

- **Einstieg:** Der Tipp „Die Story beginnt bei Lou – das pinke L auf der Karte“ erscheint nach 3 s (`src/core/tips.ts`), aber nur mit eingeschalteten Tipps. **Idee:** beim ersten Start automatisch einen Wegpunkt zu Lou setzen.
- **Progression:** Jobstufe = 1 + erledigte Jobs / 3, höchstens 10 (`jobLevel`). Belohnungen bei Stufe 4, 7 und 10 (`LEVEL_REWARD`). Die Gesamtquote setzt sich aus Story 50 %, Muscheln 20 %, Sprüngen 15 % und Rennrekorden 15 % zusammen. Balance und Erreichbarkeit sind ohne Spieltest nicht bewertbar.
- **Android-Hülle:**
  - Kein `WebViewClient`, aber im Bundle gibt es keine Links oder externe Navigation. Daraus folgt keine Schwachstelle.
  - `targetSdk 35`: `onBackPressed()` funktioniert weiterhin, weil `enableOnBackInvokedCallback` nicht gesetzt ist. Bei einem späteren Wechsel auf SDK 36 muss das umgestellt werden.

## F. Umsetzungsplan

1. **Daten und Stabilität (erledigt in 3.3):** Sicherung, Speichern im Hintergrund, Warnung beim Verlassen, Touch-Reset, fester Schlüssel. Tests: G1–G5.
2. **Gerätetest:** APK 3.3 auf einem echten Handy prüfen (G1, G2, G6), danach `setAllowFileAccess(false)` testen.
3. **Einstieg:** Wegpunkt zu Lou beim ersten Start; Zurück-Taste auch in den Unterseiten des Startmenüs.
4. **Leistung:** Frame-Zeiten (Median, 1-%-Perzentil) mit Chrome Remote Debugging auf einem schwächeren Gerät in jeder Grafikstufe messen, danach entscheiden.
5. **Testautomatisierung:** Playwright-Skripte ins Projekt (`npm test`).

## G. Testmatrix

| Nr | Test | Schritte | Erwartet | Art | Status |
|---|---|---|---|---|---|
| G1 | Hintergrund speichert | Spielen ohne Sterne, Geld ändern, Home-Taste, App im Task-Manager beenden, neu starten | Neuer Geldstand ist da | Gerät | offen (im Browser über `solaraHide()` bestanden) |
| G2 | Zurück-Taste | In jedem Zustand der Tabelle aus E. Zurück drücken | wie in der Tabelle | Gerät | offen (Logik im Browser bestanden) |
| G3 | Beschädigter Spielstand | zweimal speichern, `solarabay.save.v4` durch `{broken` ersetzen, laden | vorheriger Stand wird geladen | automatisiert | bestanden |
| G4 | Verlassen mit Fahndung | 1+ Stern, „Hauptmenü“ tippen | Hinweis, Knopf „ohne Speichern“, erst zweites Tippen verlässt | automatisiert | bestanden |
| G5 | Touch nach Pause | Stick und Feuer halten, pausieren, weiter | nichts bleibt gedrückt | automatisiert | bestanden |
| G6 | Update über die installierte App | 3.3 installieren, Spielstand anlegen, spätere Version mit gleichem Schlüssel installieren | Installation ohne Deinstallieren, Spielstand bleibt | Gerät | offen |
| G7 | Kontextverlust | in DevTools `WEBGL_lose_context` auslösen | Spiel pausiert, nach Wiederherstellung korrektes Bild | Gerät/Browser | offen |
| G8 | Sperren/Entsperren, Notch, Systemleisten | Bildschirm sperren, entsperren, Ausschnitt prüfen | Vollbild kehrt zurück, keine Bedienelemente verdeckt | Gerät | offen |

Ohne Gerät nicht beantwortbar: Leistung und Akku, echtes WebView-Verhalten bei Hintergrund und Prozessende, Android-Backup, TalkBack und Systemschriftgröße, Notch/Cutout.

## H. Top fünf

1. APK 3.3 einmal frisch installieren (alte App vorher deinstallieren). Ab dann lassen sich alle Updates direkt drüber installieren.
2. Auf dem Handy G1 und G2 durchspielen, um Speichern im Hintergrund und die Zurück-Taste zu bestätigen.
3. Nach erfolgreichem Gerätetest `setAllowFileAccess(false)` setzen und erneut testen.
4. Beim ersten Spielstart automatisch einen Wegpunkt zu Lou setzen, damit neue Spieler sofort wissen, wohin.
5. Die Playwright-Tests dieser Prüfung als `npm test` ins Projekt übernehmen, damit Speichern und Zurück-Taste bei künftigen Änderungen geprüft werden.

## Signatur (ab 3.3)

- Schlüsseldatei `android/app/solarabay.jks`, Alias `solarabay`, Zertifikat-SHA-256 `67f3477ddb41909f674274fb16dba289a1f7229c4f1be00acd6ffac76a32647f`.
- Der Schlüssel liegt mit Passwort im Projekt. Er ist nur für die direkte Installation gedacht. Wer Zugriff auf das Repository hat, kann damit Updates signieren.
