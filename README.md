# Minecraftlanner

Ein 3D-Viewer für Minecraft-**Schematic**-Dateien (`.schem`) im Browser. Er lädt
eine Bauvorlage, zeigt sie als begehbare 3D-Welt mit den **Original-Minecraft-Texturen**
an und hilft beim Planen: Materialbedarf pro Blocktyp, Layer-Ansicht, Turm-Isolierung
und ein Röntgen-Blick zum Hervorheben einzelner Blöcke.

Kein Build, kein Framework – reines HTML/JavaScript mit [three.js](https://threejs.org/).

## Features

- **`.schem` laden** (Sponge-Schematic: gzip-komprimiertes NBT mit `Width`/`Height`/`Length`,
  `Palette` und varint-kodierten `BlockData`) direkt über den Datei-Dialog.
- **Original-Texturen** aller Blöcke, geladen aus
  [`misode/mcmeta`](https://github.com/misode/mcmeta) (Zweig `assets`).
- **Materialliste** rechts: Anzahl pro Blocktyp plus Umrechnung in Stacks (64er).
  Ein Klick auf einen Eintrag aktiviert den **Röntgen-Blick** (X-Ray).
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

Für den Test: links unter „.schem Datei einfügen" die Datei `schem/test.schem` wählen.

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

## Projektstruktur

```
index.html                     Viewer (eigenständig, enthält den kompletten 3D-Code inline)
main.js                        gleicher Viewer als ES-Modul (lädt blocktextures.js selbst)
blocktextures.js               generierte Map Block-ID -> Original-Texturdatei
tools/generate-blocktextures.py Generator für blocktextures.js
schem/test.schem               kleine Testvorlage
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
