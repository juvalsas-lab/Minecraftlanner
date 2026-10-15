// Erzeugt eine kleine klassische .schematic-Testdatei (gzip-komprimiertes NBT,
// numerische Legacy-Block-IDs) zum Prüfen des Legacy-Parsers.
// Aufruf: node tools/generate-test-schematic.mjs schem/test.schematic
import { gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const W = 5, H = 3, L = 5;

const blocks = new Array(W * H * L).fill(0);
const data = new Array(W * H * L).fill(0);
const idx = (x, y, z) => (y * L + z) * W + x;
const set = (x, y, z, id, meta = 0) => { blocks[idx(x, y, z)] = id; data[idx(x, y, z)] = meta; };

for (let x = 0; x < W; x++) for (let z = 0; z < L; z++) set(x, 0, z, 1);            // Steinboden
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    set(x, y, 0, 5, 0);   // Eichenholzplanken
    set(x, y, L - 1, 5, 1); // Fichtenholzplanken
  }
  set(0, y, 2, 20);       // Glas
  set(W - 1, y, 2, 95, 14); // rotes Glas
}
set(2, 1, 2, 35, 14); // rote Wolle
set(2, 2, 2, 35, 11); // blaue Wolle
set(1, 1, 1, 45);     // Ziegel
set(3, 1, 3, 155, 2); // Quartzsäule

// --- NBT schreiben ---
const tag = (type, name, payload) => {
  const n = Buffer.from(name, 'utf8');
  const head = Buffer.alloc(3 + n.length);
  head.writeUInt8(type, 0);
  head.writeUInt16BE(n.length, 1);
  n.copy(head, 3);
  return Buffer.concat([head, payload]);
};
const short = (v) => { const b = Buffer.alloc(2); b.writeInt16BE(v, 0); return b; };
const str = (s) => { const b = Buffer.from(s, 'utf8'); const l = Buffer.alloc(2); l.writeUInt16BE(b.length, 0); return Buffer.concat([l, b]); };
const byteArray = (arr) => { const l = Buffer.alloc(4); l.writeInt32BE(arr.length, 0); return Buffer.concat([l, Buffer.from(arr)]); };

const payload = Buffer.concat([
  tag(2, 'Width', short(W)),
  tag(2, 'Height', short(H)),
  tag(2, 'Length', short(L)),
  tag(8, 'Materials', str('Alpha')),
  tag(7, 'Blocks', byteArray(blocks)),
  tag(7, 'Data', byteArray(data)),
  Buffer.from([0]) // TAG_End
]);

const root = tag(10, 'Schematic', payload);
const out = process.argv[2] || 'schem/test.schematic';
writeFileSync(out, gzipSync(root));
console.log(`geschrieben: ${out} (${W}x${H}x${L})`);
