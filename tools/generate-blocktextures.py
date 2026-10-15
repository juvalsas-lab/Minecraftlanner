#!/usr/bin/env python3
"""
Erzeugt `blocktextures.js` (Map: Block-ID -> block/interne Texturdatei).

Der Viewer errät Texturdateinamen bisher nur aus dem Blocknamen. Das ist bei
vielen Blöcken falsch (Türen, gewachste Kupferblöcke, Säulen, Treppen/Slabs,
Druckplatten, ...), sodass sie ohne Original-Textur grau bleiben.

Dieses Skript leitet die Textur stattdessen direkt aus den echten Minecraft-
Daten ab: Blockstate -> Modell -> (aufgelöste) Textur. Quelle ist das Repository
`misode/mcmeta`, Zweig `assets` - also derselbe Zweig, von dem der Viewer die
Texturen lädt.

Verwendung:
    python3 tools/generate-blocktextures.py \
        --mcmeta /tmp/opencode/mcmeta \
        --out blocktextures.js

Falls unter --mcmeta noch kein Checkout liegt, wird er automatisch als
sparse-checkout angelegt (benötigt git + Netzwerk).
"""

import argparse
import json
import os
import subprocess
import sys

REPO = "https://github.com/misode/mcmeta.git"
BRANCH = "assets"
SPARSE_PATHS = [
    "assets/minecraft/blockstates",
    "assets/minecraft/models/block",
    "assets/minecraft/textures/block",
]


def ensure_checkout(root):
    blockstates = os.path.join(root, "assets/minecraft/blockstates")
    if os.path.isdir(blockstates):
        return
    print(f"[i] Lege mcmeta sparse-checkout an: {root}", file=sys.stderr)
    os.makedirs(os.path.dirname(os.path.abspath(root)) or ".", exist_ok=True)
    subprocess.run(
        ["git", "clone", "--depth", "1", "--filter=blob:none", "--sparse",
         "--branch", BRANCH, REPO, root],
        check=True,
    )
    subprocess.run(
        ["git", "-C", root, "sparse-checkout", "set", *SPARSE_PATHS],
        check=True,
    )


class Resolver:
    def __init__(self, root):
        self.root = root
        self.tex_dir = os.path.join(root, "assets/minecraft/textures/block")
        self.model_dir = os.path.join(root, "assets/minecraft/models/block")
        self.state_dir = os.path.join(root, "assets/minecraft/blockstates")
        self.textures = {
            name[:-4]
            for name in os.listdir(self.tex_dir)
            if name.endswith(".png")
        }
        self._model_cache = {}

    # -- Modell-Handling -------------------------------------------------
    def _load_model(self, name):
        name = name.replace("minecraft:", "")
        if name.startswith("block/"):
            name = name[6:]
        if name in self._model_cache:
            return self._model_cache[name]
        path = os.path.join(self.model_dir, name + ".json")
        data = None
        if os.path.isfile(path):
            try:
                with open(path, encoding="utf-8") as fh:
                    data = json.load(fh)
            except (OSError, ValueError):
                data = None
        self._model_cache[name] = data
        return data

    def _chain(self, name, depth=0, seen=None):
        """Liefert die zusammengeführten Texturen eines Modells inkl. Parents."""
        if depth > 25:
            return {}
        seen = seen or set()
        if name in seen:
            return {}
        seen = seen | {name}
        data = self._load_model(name)
        if not data:
            return {}
        out = {}
        parent = data.get("parent")
        if parent:
            parent = parent.replace("minecraft:", "")
            if parent.startswith("builtin/"):
                pass
            elif parent.startswith("block/"):
                out.update(self._chain(parent[6:], depth + 1, seen))
            else:
                out.update(self._chain(parent, depth + 1, seen))
        out.update(data.get("textures", {}))
        return out

    def _deref(self, value, textures, depth=0):
        """Löst '#ref'-Verweise und {"sprite": ...}-Objekte zu einem Pfad auf."""
        if depth > 25:
            return None
        if isinstance(value, dict):
            value = value.get("sprite") or value.get("texture") or value.get("all")
            if value is None:
                return None
        if not isinstance(value, str):
            return None
        if value.startswith("#"):
            nxt = textures.get(value[1:])
            if nxt is None:
                return None
            return self._deref(nxt, textures, depth + 1)
        return value

    _PREFERRED_KEYS = [
        "all", "side", "front", "texture", "planks", "base", "content",
        "top", "bottom", "end", "north", "particle",
    ]

    def _pick_texture(self, textures):
        resolved = {}
        for key, value in textures.items():
            ref = self._deref(value, textures)
            if ref:
                resolved[key] = ref
        if not resolved:
            return None
        for key in self._PREFERRED_KEYS:
            if key in resolved:
                return resolved[key]
        for key, value in resolved.items():
            if key != "particle":
                return value
        return next(iter(resolved.values()))

    def _model_names(self, state):
        names = []

        def take(model):
            if isinstance(model, dict):
                names.append(model.get("model"))
            elif isinstance(model, list):
                for entry in model:
                    take(entry)

        for variant in state.get("variants", {}).values():
            take(variant)
        for part in state.get("multipart", []):
            take(part.get("apply"))
        return names

    def block_texture(self, block_id):
        path = os.path.join(self.state_dir, block_id + ".json")
        if not os.path.isfile(path):
            return None
        with open(path, encoding="utf-8") as fh:
            state = json.load(fh)
        for model in self._model_names(state):
            if not model:
                continue
            ref = self._pick_texture(self._chain(model))
            if not ref:
                continue
            ref = ref.replace("minecraft:", "")
            folder, _, base = ref.rpartition("/")
            if folder != "block":
                return None
            return base
        return None

    def all_block_ids(self):
        return sorted(
            name[:-5]
            for name in os.listdir(self.state_dir)
            if name.endswith(".json")
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mcmeta", default="/tmp/opencode/mcmeta",
                        help="Pfad zum mcmeta-Checkout (wird bei Bedarf angelegt)")
    parser.add_argument("--out", default="blocktextures.js",
                        help="Ausgabedatei (Standard: blocktextures.js)")
    args = parser.parse_args()

    ensure_checkout(args.mcmeta)
    resolver = Resolver(args.mcmeta)

    mapping = {}
    missing = []
    for block_id in resolver.all_block_ids():
        tex = resolver.block_texture(block_id)
        if tex and tex in resolver.textures:
            mapping[block_id] = tex
        elif block_id not in ("air", "cave_air", "void_air"):
            missing.append(block_id)

    current = {}
    if os.path.isfile(args.out):
        try:
            with open(args.out, encoding="utf-8") as fh:
                body = fh.read()
            start, end = body.index("{"), body.rindex("}")
            current = json.loads(body[start:end + 1])
        except (OSError, ValueError):
            current = {}

    lines = [
        "// Auto-generiert von tools/generate-blocktextures.py - nicht manuell bearbeiten.",
        "// Quelle: https://github.com/misode/mcmeta (Zweig 'assets').",
        "// Map: Block-ID -> Dateiname der Original-Textur in textures/block (ohne .png).",
        "window.BLOCK_TEXTURES = {",
    ]
    for block_id in sorted(mapping):
        lines.append(f'  "{block_id}": "{mapping[block_id]}",')
    lines.append("};")
    lines.append("")
    content = "\n".join(lines)

    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(content)

    print(f"[ok] {len(mapping)} Blöcke -> {args.out} "
          f"({len(content)} Bytes)", file=sys.stderr)
    if missing:
        print(f"[i] ohne block/-Textur ({len(missing)}): "
              f"{', '.join(missing[:20])}{' ...' if len(missing) > 20 else ''}",
              file=sys.stderr)
    if current:
        changed = [
            key for key in set(current) | set(mapping)
            if current.get(key) != mapping.get(key)
        ]
        print(f"[i] {len(changed)} Einträge gegenüber vorheriger Datei "
              f"geändert/neu.", file=sys.stderr)


if __name__ == "__main__":
    main()
