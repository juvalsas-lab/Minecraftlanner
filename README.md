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
- **Detaillierte Blockmodelle**: Fackeln, Türen, Treppen, Slabs, Zäune, Scheiben,
  Pflanzen (gekreuzte Ebenen), Teppiche, Schienen u. a. werden als echte Formen statt
  als Würfel dargestellt; die Ausrichtung aus dem Block-State (`facing`, `half`, `axis`)
  wird berücksichtigt. Zäune/Zauntore verbinden sich mit Nachbarblöcken (Latten nur
  in verbundenen Richtungen). Über die Checkbox abschaltbar (dann wieder Würfel).
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
- **Flug-Steuerung** per Pointer-Lock (WASD, Space/Shift).
- **Demo-Burg** beim Start, damit ohne Datei sofort etwas zu sehen ist.

## Schnellstart

Am einfachsten über einen lokalen Webserver im Projektordner:

```bash
python3 -m http.server 8000
```

Dann im Browser öffnen: <http://localhost:8000/>

Für den Test: links unter „.schem / .schematic Datei einfügen" die Datei `schem/test.schem`
(modernes Format) oder `schem/test.schematic` (Legacy-Format) wählen.

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
legacyblocks.js                Map alter numerischer Block-IDs -> moderne Blocknamen
tools/generate-blocktextures.py Generator für blocktextures.js
tools/generate-test-schematic.mjs Generator für schem/test.schematic
schem/test.schem               kleine Testvorlage (Sponge-Format)
schem/test.schematic           kleine Testvorlage (klassisches Legacy-Format)
```

## Texturen

Der Texturname wird **nicht** geraten, sondern aus `blocktextures.js` gelesen. Diese Map
wird aus den echten Minecraft-Daten (Blockstates → Modelle → Texturen) des Zweigs `assets`
von `misode/mcmeta` erzeugt – also aus derselben Quelle, von der auch die Texturen geladen
werden. Für unbekannte bzw. Modded-Blöcke greift zusätzlich eine Heuristik
(`guessTextureFileName`); erst wenn auch die scheitert, bleibt der Block grau.

Neu erzeugen (z. B. nach einem Minecraft-Update):

```bash
python3 tools/generate-blocktextures.py --out blocktextures.js
```

Beim ersten Aufruf wird der benötigte mcmeta-Checkout automatisch als
sparse-checkout angelegt (benötigt `git` und Netzwerk).
