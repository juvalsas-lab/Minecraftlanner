# Minecraftlanner

Ein 3D-Viewer für Minecraft-**Schematic**-Dateien (`.schem` und `.schematic`) im Browser. Er lädt
eine Bauvorlage, zeigt sie als begehbare 3D-Welt mit den **Original-Minecraft-Texturen**
an und hilft beim Planen: Materialbedarf pro Blocktyp, Layer-Ansicht, Turm-Isolierung
und ein Röntgen-Blick zum Hervorheben einzelner Blöcke.

Kein Build, kein Framework – reines HTML/JavaScript mit [three.js](https://threejs.org/).

## Features

- **`.schem` / `.schematic` laden** direkt über den Datei-Dialog:
  - Sponge-Schematic (`.schem`): gzip-komprimiertes NBT mit `Width`/`Height`/`Length`,
    `Palette` und varint-kodierten `BlockData`.
  - Klassisches MCEdit/WorldEdit-Schematic (`.schematic`): numerische Legacy-Block-IDs
    aus `Blocks`/`Data` (inkl. `AddBlocks`), inklusive Metadata-Varianten wie Wollfarben,
    Holzarten und Steinarten (siehe `legacyblocks.js`).
- **Original-Texturen** aller Blöcke, geladen aus
  [`misode/mcmeta`](https://github.com/misode/mcmeta) (Zweig `assets`).
- **Materialliste** rechts: Anzahl pro Blocktyp plus Umrechnung in Stacks (64er).
  Ein Klick auf einen Eintrag aktiviert den **Röntgen-Blick** (X-Ray).
- **Echte Blockmodelle**: Für die meisten Blöcke werden Geometrie, UVs und
  Flächen-Texturen direkt aus den Minecraft-Daten (mcmeta, siehe `blockmodels.js`)
  übernommen – Grass Block (oben/seitlich/unten), Slabs, Treppen, Türen, Fackeln,
  Logs, Furnaces usw. sehen damit wie im Spiel aus. Für Blöcke ohne exportiertes
  Modell (z. B. Zäune/Mauern/Scheiben, `multipart`) greifen die prozeduralen Formen.
  Über die Checkbox abschaltbar (dann wieder Würfel).
- **Fackel-Licht**: leuchtende Blöcke (Fackeln, Laternen, Glowstone, Lava …) haben
  einen **Emissive-Glow**; zusätzlich beleuchtet ein Pool dynamischer **Punktlichter**
  die Umgebung rund um die nächstgelegenen Fackeln.
- **Shader-Look** (an Complementary Reimagined angelehnt, als eigene three.js-Shader):
  - **Schatten** (PCFSoft-Shadow-Mapping) und **Himmel/Atmosphäre** (`Sky`) mit
    **Tageszeit-Regler** (0–24 h).
  - **Wasser-Shader**: animierte Wellen (Vertex-Deformation).
  - **Post-Processing**: Bloom, ACES-Tonemapping, Farb-Grading (Sättigung/Kontrast/Vignette),
    optional **SSAO**.
  - **Qualitätsstufen** Aus / Mittel / Hoch.
- **Höhen-Layer** (Y-Achse): alle Etagen, „bis Layer" (Aufbau) oder „nur aktueller Layer".
- **Turm-Isolierung** (`F`): erkennt automatisch zusammenhängende Türme/Bereiche und
  schneidet die Ansicht darauf zu; mit `+`/`-` vergrößer-/verkleinerbar.
- **Startbauwerk**: Beim Laden wird automatisch das in `START_SCHEMATIC` angegebene
  Bauwerk (Standard `schem/start.schem`) angezeigt; die Kamera wird darauf
  ausgerichtet. Über die Konstante leicht änderbar.
- **Flug-Steuerung** per Pointer-Lock (WASD, Space/Shift).

## Schnellstart

Am einfachsten über einen lokalen Webserver im Projektordner:

```bash
python3 -m http.server 8000
```

Dann im Browser öffnen: <http://localhost:8000/>

Beim Start wird automatisch `schem/start.schem` geladen und angezeigt.
Zum Ausprobieren anderer Dateien links unter „.schem / .schematic Datei einfügen"
z. B. `schem/test.schem` (modernes Format) oder `schem/test.schematic` (Legacy) wählen.

Das Startbauwerk ist über die Konstante `START_SCHEMATIC` (oben in `main.js` bzw. im
Inline-Skript von `index.html`) einstellbar – einfach eine eigene Datei nach `schem/`
legen und den Pfad anpassen.

> **Hinweis:** Der Viewer benötigt eine Internetverbindung. three.js und pako werden von
> CDNs geladen, die Block-Texturen von GitHub. Ohne Verbindung bleibt die 3D-Ansicht leer
> bzw. Blöcke ohne Textur erscheinen grau.

## Steuerung

| Eingabe | Funktion |
|---|---|
| Klick auf die Welt | Maus einfangen (Flugmodus) |
| `W` `A` `S` `D` | Vorwärts / links / rückwärts / rechts |
| `Space` / `Shift` | Auf- / Absteigen |
| Maus | Umsehen |
| `ESC` | Mauszeiger freigeben |
| `↑` / `↓` | Layer hoch / runter |
| `F` | Turm/Bereich unter dem Fadenkreuz isolieren |
| `+` / `-` | Isolierten Bereich vergrößern / verkleinern |
| `R` | Gesamtes Gebäude wieder anzeigen |
| `X` | Röntgen-Blick beenden |
| Klick auf Material (rechts) | Röntgen-Blick für diesen Blocktyp an/aus |

## Optik / Shader

Der Optik-Bereich im linken Panel (Abschnitt „3. Optik / Shader") steuert:

- **Qualität**: `Aus` (keine Effekte), `Mittel` (Schatten, Himmel, Wasser, Bloom),
  `Hoch` (zusätzlich SSAO – rechenintensiver).
- **Tageszeit**: verschiebt Sonne/Mond, Lichtstärke und Himmelsfarbe.
- **Detaillierte Blockmodelle**: echte Formen für Fackeln, Türen, Slabs, Treppen usw.

> **Hinweis:** Es wird **nicht** das OptiFine-/Iris-Shaderpack „Complementary Reimagined"
> eingebunden (das läuft nur in Minecraft Java und ist nicht mit WebGL/three.js
> kompatibel). Stattdessen sind die Effekte mit eigenen three.js-Shadern nachgebaut.

## Projektstruktur

```
index.html                     Viewer (eigenständig, enthält den kompletten 3D-Code inline)
main.js                        gleicher Viewer als ES-Modul (lädt blocktextures.js selbst)
blocktextures.js               generierte Map Block-ID -> Original-Texturdatei
blockmodels.js                 generierte echte Blockmodelle (Geometrie + UVs + Flächen-Texturen)
legacyblocks.js                Map alter numerischer Block-IDs -> moderne Blocknamen
tools/generate-blocktextures.py    Generator für blocktextures.js
tools/generate-blockmodels.mjs     Generator für blockmodels.js (Node)
tools/generate-test-schematic.mjs  Generator für schem/test.schematic
schem/test.schem               kleine Testvorlage (Sponge-Format)
schem/test.schematic           kleine Testvorlage (klassisches Legacy-Format)
schem/start.schem               beim Start geladenes Bauwerk (St. Paul's Cathedral)
```

## Texturen

Der Texturname wird **nicht** geraten, sondern aus `blocktextures.js` gelesen. Diese Map
wird aus den echten Minecraft-Daten (Blockstates → Modelle → Texturen) des Zweigs `assets`
von `misode/mcmeta` erzeugt – also aus derselben Quelle, von der auch die Texturen geladen
werden. Für unbekannte bzw. Modded-Blöcke greift zusätzlich eine Heuristik
(`guessTextureFileName`); erst wenn auch die scheitert, bleibt der Block grau.

Neu erzeugen (z. B. nach einem Minecraft-Update):

```bash
# Textur-Namen (Python)
python3 tools/generate-blocktextures.py --out blocktextures.js
# Blockmodelle (Node)
node tools/generate-blockmodels.mjs --out blockmodels.js
```

Beim ersten Aufruf wird der benötigte mcmeta-Checkout automatisch als
sparse-checkout angelegt (benötigt `git` und Netzwerk).

`blockmodels.js` enthält nur „nicht-triviale" Modelle (nicht den reinen 1×1×1-Würfel
mit einer Textur); reine Würfel deckt der Viewer weiterhin über `blocktextures.js` ab.
