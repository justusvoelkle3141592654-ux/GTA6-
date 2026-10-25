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

## Nachtrag: Wünsche nach dem ersten Spieltest

- Figuren und Fahrzeuge sind 20 % größer (Darstellung und Kollision, auch Fahrer im Auto und Figuren in der Ferne).
- Laufen: Gehen, Laufen und Sprinten werden je nach Tempo überblendet, die Schrittlänge passt zur Geschwindigkeit (kein Rutschen); beim Laufen neigt sich die Figur in Kurven.
- Lebensleiste, Weste, Auto und Nitro stehen jetzt oben links unter Geld und Sternen.
- Einstellungen (Pausenmenü und Handy): Tempo-Faktor für das eigene Fahrzeug (1–5x, auch Boot und Hubschrauber) und Verkehrsdichte (aus bis 300 %).
- Neuer Reiter „Flug“ im Pausenmenü und App „Flug“ im Handy:
  - Fliegen-Modus zu Fuß und mit jedem Auto (Leertaste/HOCH steigen, Shift/RUNTER sinken), Höhenanzeige im HUD, eigene Flug- und Schwebe-Pose.
  - Hubschrauber oder Polizeihubschrauber holen.
  - Schnellreise zu Läden, Stadtteilen und Orten (Klinik, Polizei, Stunt-Park, Bootssteg, Heliport, eigener Wegpunkt): „Fliegen“ als kurzer Flug durch die Luft, „Sofort“ als Teleport. Bei Läden landet man direkt im Laden.
  - Schnellreise und Fahrzeug holen sind während Missionen und des Versteckspiels gesperrt.
- Geprüft im Browser (Playwright, niedrige Grafikstufe): Teleport und Flug in Läden, Fliegen zu Fuß und im Auto, Landen ohne Schaden, Menü-Reiter. Nicht auf einem echten Handy getestet.
- Kamera nah/weit: Neue Einstellung (Standard: nah), HUD-Knopf NAH/WEIT, Taste X, Gamepad Steuerkreuz links. Nah halbiert zu Fuß ungefähr den Kameraabstand (Figur etwa doppelt so groß im Bild), im Auto 60 % Abstand, Vogelperspektive 60 % Höhe. Geprüft per Screenshot in einem flachen Handy-Format (860 x 400), nicht auf einem echten Handy.

## Nachtrag 2: Brücke, Rampen, Physik, neue Fahrzeuge

- Brücken über die Bucht: Zu Fuß galt das Deck als Wasser (man fiel hinein und schwamm), Autos „versanken“ nach ein paar Sekunden auf dem Deck, und ein kurzer Hüpfer am Kartenrand löste den Absturz aus. Behoben; zu Fuß hält ein Geländer, Verkehr bremst auf Brücken nicht mehr, die Polizei schickt dort keine Boote. Geprüft: alle 7 Brücken zu Fuß und im Auto.
- Sprungrampen: 21–28° statt 15–22°, 120–150 lang, gelb-schwarze Kanten. Vor jeder Sprungrampe ein Boostpad mit laufenden Pfeilen: Schub über das Höchsttempo, Nitro voll, weniger Schwerkraft im Flug. Jeder Absprung von einer Sprungrampe füllt Nitro um die Hälfte auf. Gemessen mit dem Corsaro: ohne Boost etwa 65 m, mit Boost etwa 195 m.
- Physik:
  - Überschläge: harte seitliche Treffer heben das leichtere Auto an, es rollt oder überschlägt sich (ein Monstertruck wirft Autos fast immer um). In der Luft steuert man die Drehung (Lenken rollt, Gas/Bremse kippt die Nase); Lenken am Rampenende startet eine Fassrolle. Landet ein Auto auf der Seite oder dem Dach, gehen Scheiben kaputt, es rutscht aus und wird nach knapp 2 s mit einem Hüpfer wieder auf die Räder gestellt.
  - Abfallende Teile: Stoßstangen und (neu) Türen fliegen bei harten Treffern als Trümmer weg und bleiben eine Weile liegen.
  - Straßenmöbel und Laternen: Bänke, Mülleimer, Hydranten, Briefkästen und alle Straßenlaternen lassen sich umfahren. Kleine Teile fliegen und überschlagen sich, Laternen kippen um und ihr Lichtkegel geht aus, Hydranten spritzen eine Wasserfontäne. Sie kommen nach einer Minute zurück, wenn man weit weg ist.
  - Ragdoll: angefahrene Personen fliegen weiter und überschlagen sich in der Luft, bevor sie liegen bleiben.
  - Fahrgefühl: die Karosserie taucht beim Bremsen ein, hebt beim Beschleunigen die Nase und neigt sich in Kurven; bei hohem Tempo bricht das Heck bei starkem Lenken leicht aus.
- Neue Fahrzeuge (Spawn-Menü, Autohaus): Hypercar „Vortex X“ (mit Heckflügel), Formel-Rennwagen (freistehende Räder, Front- und Heckflügel), Monstertruck (riesige Räder, Rahmen, Überrollbügel), Lowrider „Cruzado“ (langes Cabrio, Chromleisten; Handbremse im Stand lässt ihn hüpfen).
- Nicht umgesetzt: echte Gelenkphysik für Personen (weiterhin Animation plus Flugbahn und Drehung), Ampeln lassen sich nicht umfahren.

## Nachtrag 3: Realismus-Update

- Wohnturm Bayview:
  - Erdgeschoss mit Lobby, Fitnessraum, Spielraum, Kino und Lounge.
  - Etagen 1–5 mit je 4 Wohnungen zum Kaufen, oben das Penthouse mit Dachterrasse, Pool und Bar.
  - Aufzug und Treppenhaus, alle Etagen begehbar.
- Karte: mehrere eigene Markierungen; zu jeder Markierung „Hinfliegen“, „Sofort hin“, GPS-Route oder Löschen.
- Handy: alle Funktionen des Pausenmenüs als Apps (auch Spawnen, Flug, Einstellungen, Speichern, Hauptmenü), dazu die App „Cheats“.
- Läden:
  - Bucht-Elektro im Kaufhaus.
  - Neu: Tankstelle 24/7, Bar, Apotheke, Bootshandel, Flugzeughandel.
  - Die bestehenden Läden haben mehr Ware.
- Fahrzeuge: 17 neue, darunter das „GTA V“ mit rund 1000 km/h (gemessen: 1008 km/h), Panzer, Traktor, Gabelstapler, Betonmischer, Flugzeug, Wasserflugzeug, Segelboot, Yacht und Luftkissenboot.
- Menschen und Ragdoll:
  - Mann und Frau sind als eigene Blender-Modelle auf dem Spielskelett aufgebaut.
  - Umfallen ist jetzt echte Gelenkphysik: 18 Punkte mit Gelenkgrenzen, Boden- und Wandkollision.
  - Aufstehen aus Rücken- oder Bauchlage.
- Brücke: Man fiel durch die Fahrbahn.
  - Ursachen: Sehr schnelle Autos blieben an den steilen Rampen unter der Fahrbahn hängen, und ein Teleport auf die Brücke setzte einen ins Wasser darunter.
  - Behoben, die Geländer sind außerdem dicker.
  - Geprüft auf allen 7 Brücken zu Fuß, mit einem normalen Auto und mit dem GTA V bei 940–1000 km/h.
- Haft: Die Dauer gibt man unter Einstellungen als Zahl ein (1–3600 Sekunden, Standard 30).
- Alle abschießbar:
  - Verkäufer, Gäste in Läden und Bars und die Häftlinge im Gefängnishof lassen sich jetzt treffen.
  - Getroffene fallen als Ragdoll um, die Umstehenden ducken sich, Verkäufer heben die Hände.
  - Ist der Verkäufer tot, bleibt der Laden zu, bis man eine Weile weg war.
  - Schüsse fliegen über Theken hinweg.
- Ausrauben: Neben Boutique, Imbissen, Supermarkt, Tankstelle, Bar und Apotheke kann man jetzt auch Waffenladen, Autohaus, Friseur, Boots- und Flugzeughandel ausrauben.
- TNT:
  - Es gibt TNT nur über den Cheat „TNT“ (Pausenmenü oder Handy → Cheats), genau 1 Block pro Eingabe.
  - Unter „Alle Waffen“ im Spawn-Menü ist es nicht enthalten.
  - Abgelegt wird es mit Feuer, nach 5 Sekunden explodiert es deutlich stärker als eine Granate.
  - In einem Laden sterben alle Personen darin, der Laden ist zerstört (Rauch aus der Tür, 2 Minuten geschlossen).
- Polizei:
  - Stärker: mehr Leben für Polizisten, SWAT und Armee sowie für Streifenwagen, etwas mehr Schaden.
  - Klüger: Beamte umzingeln dich von verschiedenen Seiten statt in einem Haufen, weichen beim Schießen seitlich aus und gehen um Hindernisse herum, wenn sie keine Schusslinie haben.
  - Schüsse: Sie halten vor (zielen dorthin, wo du gleich bist). In den ersten Sekunden streuen sie mehr, auf ein laufendes Ziel ebenfalls.
  - Streifenwagen schneiden ab 3 Sternen alle den Weg ab.
  - Nebenbei behoben: Gegnerische Kugeln konnten bei kurzem Abstand durch den Spieler hindurchfliegen.
- Hardcore: Nicht mehr im Startmenü, sondern als roter Stern „HC“ hinter den Fahndungssternen im HUD; antippen schaltet ihn an und aus.
- Passanten:
  - Hände hoch, wenn die Waffe kurz auf sie zeigt, danach rennen sie weg.
  - Sie springen vor schnellen Autos zur Seite und stehen wieder auf.
  - Beim Anrempeln im Sprint fallen sie hin.
  - Liegt jemand am Boden, rufen einige mit dem Handy die Polizei, andere fliehen.
  - Unterwegs bleiben sie kurz stehen (Handy, Zigarette), halten Abstand zueinander und schauen dich an, wenn du nah vorbeigehst.
- GTA-V-Design:
  - Minikarte rechteckig unten links (auf dem Handy oben links) mit Lebens- und Westenbalken (im Fahrzeug auch Fahrzeug und Nitro).
  - Geld, Waffe und Sterne oben rechts, Hilfetexte in einer schwarzen Box oben links, Stadtteil und Tempo unten rechts.
  - Karte und Minikarte in GTA-Farben.
  - Pausenmenü mit Kopfleiste (Uhrzeit, Geld) und eckigen Reitern; Startbildschirm und Knöpfe in Weiß/Schwarz.
  - Farbabstimmung ab Grafikstufe „Mittel“ (wärmer, mehr Kontrast und Farbe, dunkle Ränder), auf „Schnell“ nur die dunklen Ränder.
- Geprüft im Browser (Playwright mit Software-Grafik), nicht auf einem echten Handy:
  - Brücke, Schießen in Bar und Gefängnishof, TNT im Supermarkt, Überfall im Waffenladen.
  - Polizei-Taktik, Passanten-Reaktionen, HUD am Desktop (1280 x 720) und im Handy-Format (860 x 400), Menüs.
  - Die fertige Spieldatei startet ohne Fehler.
- Nicht umgesetzt:
  - Läden werden beim Sprengen nicht sichtbar zerstört (nur Rauch und geschlossen).
  - Verkäufer und Gäste fliehen nicht aus dem Laden, sie ducken sich am Platz.
  - Es gibt nur einen Cheat (TNT).

## Nachtrag 4: Häuser, Codes, Schießen, Kamera, Lauftempo

- **Häuser:**
  - Acht neue begehbare Wohnhäuser, auf der Karte mit Türsymbol:
    - 2 Wohnungen
    - 2 Familienhäuser
    - 2 WGs
    - ein Atelier und ein Musikstudio
  - Jedes hat einen Flur mit Wohnzimmer, ein Bad, eine Arbeitsecke und eine Küche mit Esstisch. Je nach Haus kommt ein eigenes Zimmer dazu: Schlafzimmer, Kinderzimmer mit Hochbett, WG-Zimmer oder Musikraum.
  - In jedem Haus wohnen 2–3 Leute.
  - Von außen ist nichts neu gestaltet.
- **Codes:**
  - Neue Handy-App „Codes“, gesichert mit der PIN 240413.
  - 71 Codes in 9 Gruppen: Geld, Gesundheit, Waffen & Items, Polizei, Fahrzeuge, Fahrzeug-Extras, Welt, Du, Spaß.
  - Das Codebuch steht in der App; Codes zum An- und Ausschalten sind gekennzeichnet und erscheinen aktiv im HUD unter den Sternen.
  - Neue Items:
    - Jetpack
    - Fallschirm
    - Sprungfedern (etwa 22 m hoch)
    - Tarnumhang
    - Explosivmunition, Goldmunition (fünffacher Schaden)
    - Superfaust
    - Feuerwerk, Meteoritenregen
  - Weitere Codes:
    - Unverwundbar, Zeitstopp, Zeitlupe, Mondschwerkraft, Leere Straßen
    - Fahrzeuge: 14 zum Herholen, dazu Turbo und unzerstörbares Fahrzeug
  - „TNT“ gibt 5 Blöcke.
  - Der Cheat-Reiter im Pausenmenü ist entfernt.
- **Feuermodus** (Einstellungen):
  - „Cooldown“ wie bisher.
  - „Dauerfeuer“: keine Pause zwischen den Schüssen (etwa 16 pro Sekunde) und kein Warten beim Nachladen.
- **Zielhilfe:**
  - Ohne Fahndung erfasst sie alle Menschen und fahrenden Autos.
  - Mit Fahndung nur Polizeifahrzeuge jeder Art (Streifenwagen, Boote, Hubschrauber, Jets), dazu Missionsziele. Polizisten zu Fuß werden mit Fahndung nicht automatisch erfasst.
- **In die Luft schießen:**
  - Zu Fuß und aus dem Auto fliegen die Kugeln zu einem Hubschrauber oder Jet hoch, Raketen verfolgen ihn.
  - Ohne Ziel schießt man nach oben, wenn man die Kamera nach oben dreht.
- **Kamera:**
  - Die rechte (oder mittlere) Maustaste gedrückt ziehen bzw. auf dem Handy rechts wischen dreht die Kamera um die Figur. Zu Fuß bleibt sie dann 3 Sekunden so stehen, bevor sie wieder hinter die Figur schwenkt.
  - Neue Autoansichten: Motorhaube, von vorne, seitlich (Taste C bzw. Kameraknopf).
- **Lauftempo:**
  - Laufen etwa 20 km/h, Sprinten etwa 32 km/h (vorher etwa 59 und 90).
  - Regler „Lauftempo“ in den Einstellungen (0,5- bis 3-fach).
  - Polizisten und Banden zu Fuß sind nicht schneller als dein Sprint.
- **Geprüft im Browser** (Playwright, Software-Grafik), nicht auf einem echten Handy:
  - Lauf- und Sprinttempo, Zielhilfe mit und ohne Sterne, Schüsse aus dem Auto auf den Hubschrauber.
  - Alle 71 Codes (fehlerfrei; Boote brauchen Wasser in der Nähe), PIN falsch/richtig, Riesensprung ohne Schaden.
  - Alle 8 Häuser betreten, Codes-App und Autoansicht in der fertigen Spieldatei.

## Nachtrag 5: Klicks auf dem Handy, Aufzug, Dauerfeuer, Lenkung

- **Nichts anklickbar (Handy):** Das unsichtbare Feld für den Lauf-Joystick lag über dem grünen Knopf zum Betreten, Kaufen und für den Aufzug und schluckte jeden Tipp. Die HUD-Knöpfe liegen jetzt darüber.
  - Geprüft mit echten Tipps im Handy-Format (860 x 400) und mit Mausklicks am Desktop: Laden öffnen, etwas kaufen, Aufzug rufen, Etage wählen.
- **Aufzug:** Die Etagenliste passt jetzt auf kleine Bildschirme (zwei Spalten) und lässt sich scrollen.
- **Dauerfeuer:** Gilt nur noch für Schusswaffen. Raketenwerfer, Granaten, Haftbomben und TNT geben pro Druck genau einen Schuss bzw. Wurf ab, auch wenn man die Taste hält.
  - Gemessen: Pistole 6 Schüsse/s mit Cooldown, 15 mit Dauerfeuer.
  - Raketenwerfer, Granate und TNT: je 1 bei 2 s gehaltener Taste.
- **Lenkung** (eigenes Fahrzeug):
  - Mit der Tastatur dreht das Lenkrad schnell, aber nicht schlagartig ein und kommt schneller in die Mitte zurück.
  - Gamepad und Handy lenken um die Mitte feiner.
  - Im Stadttempo lenkt das Auto etwas direkter, bei hohem Tempo ruhiger: bei 300 km/h etwa zwei Drittel, bei 1000 km/h etwa ein Viertel der bisherigen Drehung. Lässt man los, richtet es sich schneller gerade aus.
  - Der Verkehr fährt unverändert.
