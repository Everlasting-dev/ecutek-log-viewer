// Robust CSV helpers – no hard requirement for a Time column here.
export function findTimeIndex(headers){
  return headers.findIndex(h => /time|timestamp/i.test(h));
}

export function findRpmIndex(headers){
  const i = headers.findIndex(h => /\bRPM\b/i.test(h));
  return i !== -1 ? i : headers.findIndex(h => /engine\s*speed/i.test(h));
}

export function numericColumns(headers, cols, minNumericCount = 5){
  const idx = [];
  for (let i = 0; i < headers.length; i++){
    let c = 0; const v = cols[i] || [];
    for (let k = 0; k < v.length; k++) if (Number.isFinite(v[k])) c++;
    if (c >= minNumericCount) idx.push(i);
  }
  return idx;
}

export function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l => l && !l.startsWith("#"));
  if (lines.length < 2) throw new Error("Empty CSV or missing rows.");
  const headers = lines[0].split(",");
  const cols = headers.map(() => []);

  for (let i = 1; i < lines.length; i++){
    const parts = lines[i].split(",");
    if (parts.length !== headers.length) continue;
    for (let j = 0; j < parts.length; j++){
      const n = Number(String(parts[j]).replace(/,/g,"").trim());
      cols[j].push(Number.isFinite(n) ? n : NaN);
    }
  }
  return { headers, cols };
}
