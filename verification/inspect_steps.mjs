/* Inspect a REA capture_browser_scenario output: step statuses + final URL + history. */
import fs from 'node:fs';
const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

function findSteps(v, out) {
  if (Array.isArray(v)) { for (const x of v) findSteps(x, out); return; }
  if (v && typeof v === 'object') {
    if (Array.isArray(v.steps) && v.steps.some((s) => s && s.step_id)) out.push(v.steps);
    for (const k in v) findSteps(v[k], out);
  }
}
function findOne(v, key, out) {
  if (Array.isArray(v)) { for (const x of v) findOne(x, key, out); return; }
  if (v && typeof v === 'object') {
    if (key in v && key !== 'steps') out.push(v[key]);
    for (const k in v) findOne(v[k], key, out);
  }
}

const out = []; findSteps(j, out);
for (const s of out[0]) {
  const a = s.artifacts || {};
  const u = a.url && a.url.state === 'captured' ? a.url.value.url : '(none)';
  console.log(s.step_id.padEnd(12), s.action.padEnd(14), 'completed=' + (s.status === 'completed'), '| after URL:', u);
}
const h = []; findOne(j, 'navigation_entries', h);
const entries = Array.isArray(h[0]) ? h[0] : h;
for (const e of entries.slice(0, 8)) console.log('history entry:', e.type, e.name?.url ?? JSON.stringify(e.name));
const cur = []; findOne(j, 'current_url', cur);
for (const c of cur.slice(0, 2)) console.log('current_url:', c.url);
