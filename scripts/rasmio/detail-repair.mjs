import fs from 'node:fs';
import path from 'node:path';
const validKey = key => /^(company:\d{11}|person:[0-9a-fA-F]+)$/.test(key);
export const hasDetailCounts = result => result?.rows > 0 || result?.tableRows > 0;
export const hasDetailData = d => Array.isArray(d?.rows) && d.rows.length > 0 || (d?.tables || []).some(t => Array.isArray(t.rows) && t.rows.length > 0);
export function restoreIncompleteDetails(frontier, directory) {
  if (frontier.detailRepair?.version === 1) return { ...frontier.detailRepair.summary, reused: true };
  const pending = new Set((frontier.pending || []).map(e => `${e.type}:${e.id}`));
  frontier.pending ||= []; frontier.visited ||= {};
  const buckets = { company: [], person: [] };
  const summary = { eligible: 0, addedToPending: 0, clearedVisited: 0, corruptFiles: 0, types: { company: 0, person: 0 } };
  for (const file of fs.readdirSync(directory).sort()) {
    const match = file.match(/^(company|person)-(.+)\.json$/);
    if (!match) continue;
    const [, type, id] = match, key = `${type}:${id}`;
    if (!validKey(key) || !frontier.graph?.nodes?.[key]) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')); }
    catch { summary.corruptFiles++; }
    if (hasDetailData(data)) continue; // Never reset already populated files.
    summary.eligible++; summary.types[type]++; buckets[type].push(key);
    if (frontier.visited[key]) { delete frontier.visited[key]; summary.clearedVisited++; }
    if (!pending.has(key)) { frontier.pending.push({ type, id }); pending.add(key); summary.addedToPending++; }
  }
  const remaining = [];
  for (let i = 0; i < Math.max(buckets.company.length, buckets.person.length); i++) {
    for (const type of ['company', 'person']) if (buckets[type][i]) remaining.push(buckets[type][i]);
  }
  frontier.detailRepair = { version: 1, at: new Date().toISOString(), cursor: 0, remaining, repaired: 0, summary };
  return summary;
}
export function prioritizeDetailRepair(frontier, queue, limit = 8) {
  const state = frontier.detailRepair;
  if (!state?.remaining?.length) return queue;
  const selected = [], n = state.remaining.length;
  for (let i = 0; i < Math.min(limit, n); i++) {
    const key = state.remaining[(state.cursor + i) % n];
    if (frontier.visited[key]) continue;
    const [type, id] = key.split(':'); selected.push({ type, id });
  }
  state.cursor = (state.cursor + Math.min(limit, n)) % n;
  const selectedKeys = new Set(selected.map(e => `${e.type}:${e.id}`));
  return [...selected, ...queue.filter(e => !selectedKeys.has(`${e.type}:${e.id}`))];
}
export function markDetailRepaired(frontier, key) {
  const state = frontier.detailRepair;
  if (!state?.remaining) return;
  const i = state.remaining.indexOf(key);
  if (i >= 0) { state.remaining.splice(i, 1); state.repaired++; }
}
