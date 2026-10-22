# Solara Bay 2.0 – Abschlussbericht

Branch: `ccr-c7165179-f3hlkt` · Ergebnisdatei: `solara-bay-2.html` (1.598.019 Byte ≈ 1,6 MB, Ziel < 25 MB) · Bauen: `npm run build:html`

Die Einzeldatei wurde offline (`file://`, Netzwerk gesperrt) gestartet: keine externen Anfragen, keine Konsolenfehler beim Start und beim Losfahren.

## Grundsatzentscheidung: Weg B (prozedural) statt Blender

In dieser Umgebung gibt es kein Blender. Fahrzeuge und Figuren werden deshalb vollständig im Code mit three.js erzeugt (keine GLB-Dateien, kein Ordner `tools/blender/`). Es wurden keine fremden Modelle (z. B. MakeHuman) eingebettet. Lizenzen im Paket: eigener Code, three.js (MIT), React (MIT), Schriften Bebas Neue und Inter über Fontsource (SIL Open Font License).

## Fehler F1–F30

| Nr. | Ergebnis |
|---|---|
| F1 | Behoben. Wassermaske (1024²) mit Flutfüllung; Konsole meldet „Wasser: 1 zusammenhängende Fläche, 486220 Zellen (31 abgetrennte Zellen zu Land gemacht)“. |
| F2 | Behoben. Das Meer umgibt die Stadt im Westen, Süden und Osten; der Hafen im Osten liegt mit Kaimauer am Wasser. |
| F3 | Behoben. Wasser-Shader mit überlagerten Wellen, Fresnel, Tiefenfarbe, Uferschaum, Schaum an Brückenpfeilern; Spiegelung (Reflector) ab Stufe „Hoch“. Schaum am Bug fahrender Boote ist nicht umgesetzt. |
| F4 | Behoben. Minikarte und große Karte werden aus der Wassermaske gezeichnet. |
| F5 | Behoben. Boote haben an Land keinen Schub mehr. |
| F6 | Behoben. Verkehr fährt nur auf Straßen; die Polizei plant Routen über das Straßennetz (Dijkstra) und verfolgt nur direkt, wenn kein Wasser dazwischen liegt. |
| F7 | Behoben. Steilküste statt Wand; Sturz ohne Schaden mit Abblende und Rücksetzen auf eine sichere Straße. |
| F8 | Behoben. Rampen nur von vorne befahrbar (Kegel 35°), sonst Wand. |
| F9 | Behoben. Parkhaus-Rampen ≤ 12°, Sprungrampen ≤ 22°. |
| F10 | Behoben. Keine Rampen mehr auf Fahrspuren; feste Orte (Baustellen, Parkplätze, Kais, Strand, Skatepark, Stunt-Park). |
| F11 | Behoben. Holz-, Stahl- und Betonrampen mit Texturen, Pfeilen, Stützen, Schatten. |
| F12 | Behoben. Sperren, Parkplätze und Abholpunkte prüfen den Rampenabstand. |
| F13 | Behoben. Jobs im Menü (J), im Handy (T) und am Kartenpunkt; fehlendes Fahrzeug wird geliefert. |
| F14 | Behoben. 15 Jobs mit Stufen und Freischaltungen. |
| F15 | Behoben. Eigener Reiter, 5 Spielfelder, 3 Modi, 3 Schwierigkeiten, Runden 3/5/7. |
| F16 | Behoben (Weg B). Lofted Karosserie mit Radhausausschnitten, drehbare Türen, getrennte Scheiben, Innenraum, Lenkrad, Wischer, Kennzeichen, schaltbare Lichter, Dellen, Glas- und Stoßstangenschaden. Modelle sind sauber, aber nicht fotorealistisch. |
| F17 | Behoben. Kollision mit gedrehten Rechtecken in echten Maßen (Trennachsen-Test). |
| F18 | Behoben. Fußgänger-Kollision mit den echten Fahrzeugmaßen. |
| F19 | Behoben. Fester Physikschritt 1/120 s mit Akkumulator und Swept-Test. |
| F20 | Behoben. Einsteigen mit Tür, Fahrer sichtbar (Spieler und Verkehr). Ausnahme: in Boot und Hubschrauber ist die Spielfigur nicht sichtbar. |
| F21 | Behoben. Figuren mit Skelett (54 Knochen), Gesicht, Haaren, Händen. |
| F22 | Behoben. Rund 40 Animationsclips mit Überblendung, Ober- und Unterkörper getrennt. |
| F23 | Behoben. 10 begehbare Läden mit Innenräumen. |
| F24 | Behoben. Die Zielhilfe erfasst Polizei, feindliche Banden, Missionsziele und Flüchtende. |
| F25 | Behoben. Verkehr auch auf den Fernstraßen und Brücken. |
| F26 | Behoben. Abholpunkte und Missionsfiguren auf echten Gehwegpunkten. |
| F27 | Behoben. Kaskadierte Schatten (2–3 Kaskaden je nach Stufe, bis 4200 Einheiten). |
| F28 | Behoben. Tag-Nacht (12/24/48 min) und Wetter (Sonne, Wolken, Regen, Nebel). |
| F29 | Behoben. Nur ein Spielerauto; das alte wird zum geparkten Auto oder kommt in die Garage. |
| F30 | Behoben. HUD in festen Zonen, Größe 80–130 %, Safe Area. Auf sehr kleinen Bildschirmen nicht auf einem echten Gerät geprüft. |

## Weitere gefundene und behobene Fehler (F31 ff.)

| Nr. | Fehler | Stand |
|---|---|---|
| F31 | Kamera flog beim Spielstart von der Menüposition quer durch Gebäude. | Behoben (Kamera wird beim Start gesetzt). |
| F32 | Säulenvorbau des Rathauses hatte keine Kollision, Kamera stand darin. | Behoben. |
| F33 | Kaskadenschatten überschrieben den Shader der Figuren (Figuren weiß). | Behoben. |
| F34 | Speicher: Knochen-Texturen und Körpergeometrien von Passanten wurden nie freigegeben; Polizeiwagen erzeugten pro Erscheinen neue Geometrien. | Behoben (Referenzzählung, gemeinsame Geometrien). |
| F35 | Beim Aussteigen ins Wasser lief die Aussteige-Animation statt Schwimmen. | Behoben. |

## Testliste (Abschnitt 18)

Getestet wurde automatisiert in einem Headless-Chromium mit Software-Rendering (SwiftShader); die Spielschleife wurde dafür schrittweise per Skript ausgeführt.

| Nr. | Ergebnis |
|---|---|
| 1 | Teilweise. Eine zusammenhängende Wasserfläche bestätigt; Boot unter einer Brücke durchgefahren. Eine komplette Umrundung von Stadt und Insel unter jeder Brücke wurde nicht gefahren. |
| 2 | Teilweise. Klippensturz an 5 Stellen geprüft: kein Schaden, Rücksetzen, Fahrzeug unverändert. Nicht an 10 Stellen. |
| 3 | Nicht einzeln geprüft. Das Zurückdrängen am äußeren Rand ist umgesetzt, aber nicht für Boot, Schwimmen und Hubschrauber getrennt getestet. |
| 4 | Teilweise. Eine Sprungrampe von vorne (45,1 m Sprung) und von der Seite (Wand) geprüft; nicht jede Rampe. |
| 5 | Teilweise. Alle 15 Jobs starten über das Menü; Handy und Kartenpunkt sowie das Abschließen jedes Jobs wurden nicht für alle 15 einzeln durchgespielt. |
| 6 | Teilweise. Alle 5 Felder in allen 3 Modi ohne Fehler gestartet; nicht jede Schwierigkeitsstufe. |
| 7 | Ja für Betreten und Kartensymbol (alle 10). Kauf geprüft im Supermarkt (Energydrink); Theke öffnet das Ladenfenster. Nicht jeder Artikel in jedem Laden gekauft. |
| 8 | Teilweise. Verschlossenes Auto (Scheibe einschlagen/Kolbenschlag) und besetztes Auto (Fahrer herausziehen, er steht auf und flieht) geprüft; Figur danach sichtbar im Auto. Motorrad, Boot, Hubschrauber: Einsteigen ohne Animation; in Boot und Hubschrauber ist die Figur nicht sichtbar. |
| 9 | Nicht durchgespielt. Die 20 Story-Missionen wurden nicht einzeln abgeschlossen. Die Startpunkte der Missionsfiguren wurden angepasst (F26). |
| 10 | Ja. Ein Spielstand Version 3 lädt, wird auf Version 4 gehoben, Position auf eine Straße gesetzt, Geld und Job-Stufen übernommen. |
| 11 | Nicht erfüllt nachgewiesen. Kürzere Läufe (einige Minuten Spielzeit) ohne Konsolenfehler; 30 Minuten am Stück wurden nicht gemessen. |
| 12 | Nicht messbar. Ohne Grafikkarte (Software-Rendering) sind FPS-Werte nicht aussagekräftig. Gemessen: rund 1.300 Draw Calls in Stufe „Mittel“ im Zentrum mit 33 Autos – das ist hoch und das wahrscheinlichste Leistungsproblem auf schwachen Geräten. |

## Umgesetzt (Kurzfassung)

- Welt: 16×16 Blöcke, 9 Stadtteile, Meer, Insel mit Leuchtturm, Brücken, Tunnel, Kreisverkehr ohne Ampel (Verkehr kreist, blinkt, fährt ab), Ampeln, Bushaltestellen mit Häuschen, Bänke, Mülleimer, Hydranten, Briefkästen.
- Wahrzeichen: Rathaus mit Uhrturm (Zeiger folgen der Spieluhr), Vale Tower, Riesenrad, Stadion mit Flutlicht, Leuchtturm-Lichtkegel nachts.
- Gebäude: 19 Stadttypen mit eigenen Merkmalen (Satteldächer, Markisen, Balkone, Klimageräte, Rücksprünge, Sheddächer, Schornsteine, Ladetore, Arkaden) plus Parkhaus, Villa, Inselhaus, Baucontainer, Leuchtturm, Rathaus, Uhrturm, Stadion, Vale Tower = 28 Typen.
- Fahrzeuge: realistische Maße für Kollision, Lichter (Abblend-, Brems-, Rückfahr-, Blinklicht beim Abbiegen, Warnblinker, Alarmanlage), Federung, Auspuff, Detailstufen nach Entfernung.
- Figuren: Spieler 4.674 Dreiecke, Passanten 2.682–3.426 (einzelne Kleidungskombinationen liegen über dem Ziel von 3.000), Fern-Variante 506. Kai Romero mit 12 Outfits (6 neue), Weste, Frisur/Bart/Tattoo beim Friseur. 16/24/32/40 volle Figuren je Grafikstufe.
- Läden: Kaliber Waffen (Schießstand als Mini-Spiel mit Rekord), Bay Boutique (Spiegel), Taco Loco, Burger Bucht (Sitzen), Lack & Turbo (Halle mit Rolltor, Hebebühne hebt das Auto während des Menüs), Safehouse (Bett: speichern, schlafen), Supermarkt, Autohaus (Drehteller, Kauf in die Garage), Friseur & Tattoo, Einkaufszentrum (zwei Etagen, Rolltreppen, Foodcourt, Versteckspiel-Feld). Überfall durch Zielen auf den Verkäufer, Polizei kommt durch die Tür, Wände von innen durchsichtig.
- Oberfläche: HUD in Zonen, SVG-Symbole statt Emojis, mitdrehende Minikarte, große Karte mit Zoom, Verschieben, Straßennamen, Filtern und Legende, Hauptmenü mit Kamerafahrt zur echten Tageszeit, erweiterte Einstellungen, Gamepad (Spiel und Menüs), freie Kamera (rechte Maustaste oder rechter Stick).
- Speicherstand Version 4 mit Migration von 1–3; Speicher im `localStorage`, sonst im Arbeitsspeicher.
- Projektstruktur nach Abschnitt 19 (`core`, `world`, `vehicles`, `characters`, `ai`, `gameplay`, `render`, `audio`, `ui`).

## Offene Punkte (ehrlich)

- Kein Blender/GLB (siehe oben). Kleidung ist Teil des Körpermodells (Farbzonen mit Falten-Normal-Map), keine getrennten Kleidungs-Meshes.
- „Ragdoll“ ist eine Physik-Animation (Clip), keine echte Gelenkphysik.
- Ego-Sicht im Auto: Lenkrad, Hände, Armaturenbrett, Wischer und Regentropfen ja; ein Tacho mit Nadel im Armaturenbrett fehlt.
- Läden: keine Hintergrundmusik, Begrüßung nur als Text. Kunden stehen oder sitzen an festen Plätzen.
- NPCs sitzen nicht auf Straßenbänken, kein Hund. Gesprächsgruppen, Telefonieren, Rauchen, Ducken und Panik sind vorhanden.
- Fußgänger: gezieltes Warten an Ampeln und Benutzen nur der Zebrastreifen ist nicht umgesetzt.
- Vegetation: eine Palmenart, Laubbäume, Büsche, Blumen am Kreisverkehr; kein Gras mit Wind.
- Straßen: keine Richtungspfeile auf der Fahrbahn.
- Straßenmöbel haben keine Kollision.
- Leistung: Die Stadt ist in Kacheln zusammengefasst, wird aber beim Start vollständig gebaut (kein Laden/Entladen zur Laufzeit); Gebäude haben keine Detailstufen. Draw Calls sind hoch (siehe Test 12).
- Speicher: Nach den Korrekturen bleiben die Texturen konstant; die Geometrien wachsen langsam weiter, bis die (begrenzten) Caches für Automodelle, Fahrer und Körper gefüllt sind. Ein 30-Minuten-Lauf wurde nicht gemessen.
- Gamepad nur im Code und mit simulierten Eingaben geprüft, nicht mit einem echten Controller.
