export function splitLines(text) {
  return text.split(/\r?\n/).filter(l => l && !l.startsWith("#"));
}
export function parseCSV(text) {
  const lines = splitLines(text);
  if (lines.length < 2) throw new Error("Empty CSV or missing rows.");
  const headers = lines[0].split(",");
  const cols = headers.map(() => []);
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length !== headers.length) continue;
    for (let j = 0; j < parts.length; j++) {
      const v = Number(parts[j].replace(/,/g, ""));
      cols[j].push(Number.isFinite(v) ? v : NaN);
    }
  }
  return { headers, cols, rows: cols[0]?.length ?? 0 };
}
export function findTimeIndex(headers) {
  return headers.findIndex(h => /time|timestamp/i.test(h));
}
export function findRpmIndex(headers) {
  const i = headers.findIndex(h => /\bRPM\b/i.test(h));
  return i !== -1 ? i : headers.findIndex(h => /engine\s*speed/i.test(h));
}
export function numericColumns(headers, cols, minNumeric=5) {
  const out = [];
  for (let c = 0; c < headers.length; c++) {
    let cnt = 0;
    const v = cols[c];
    for (let i=0;i<v.length;i++) if (Number.isFinite(v[i])) cnt++;
    if (cnt >= minNumeric) out.push(c);
  }
  return out;
}
