/* Extract PNG image artifacts from a REA tool output JSON file (argv[2]) into outDir (argv[3]).
   Verifies each PNG's SHA-256 against the recorded value; writes only matching files. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [src, outDir] = process.argv.slice(2);
if (!src || !outDir) { console.error('usage: node extract_pngs.mjs <tool-output.json> <outDir>'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

function walk(v, hits) {
  if (Array.isArray(v)) { for (const x of v) walk(x, hits); return; }
  if (v && typeof v === 'object') {
    if (v.media_type === 'image/png' && typeof v.data_base64 === 'string' && v.sha256) hits.push(v);
    for (const k of Object.keys(v)) walk(v[k], hits);
  }
}

const j = JSON.parse(fs.readFileSync(src, 'utf8'));
const hits = []; walk(j, hits);
let n = 0;
for (const h of hits) {
  const bytes = Buffer.from(h.data_base64, 'base64');
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  const ok = digest === h.sha256;
  const name = `shot-${String(++n).padStart(2, '0')}-${h.sha256.slice(0, 8)}${ok ? '' : '-MISMATCH'}.png`;
  fs.writeFileSync(path.join(outDir, name), bytes);
  console.log(`${name}: ${bytes.length} bytes, digest match=${ok}, px=${h.width ?? '?'}x${h.height ?? '?'}`);
}
console.log(`total=${hits.length}`);
