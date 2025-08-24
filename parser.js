// Parsing helpers shared by both pages

export function findTimeIndex(headers){
  return headers.findIndex(h => /time|timestamp/i.test(h));
}

export function findRpmIndex(headers){
  const i = headers.findIndex(h => /\bRPM\b/i.test(h));
  return i !== -1 ? i : headers.findIndex(h => /engine\s*speed/i.test(h));
}

export function numericColumns(headers, cols, minNumericCount = 5){
  const idx = [];
  for (let i=0; i<headers.length; i++){
    const c = (cols[i]||[]).reduce((a,v)=> a + (Number.isFinite(v)?1:0), 0);
    if (c >= minNumericCount) idx.push(i);
  }
  return idx;
}

export function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(line => line && !line.startsWith("#"));
  if (lines.length < 2) throw new Error("Empty CSV or missing rows.");

  const headers = lines[0].split(",");
  const cols = headers.map(() => []);

  for (let i=1; i<lines.length; i++){
    const values = lines[i].split(",");
    if (values.length !== headers.length) continue;
    for (let j=0; j<values.length; j++){
      const v = Number(values[j].replace(/,/g,""));
      cols[j].push(Number.isFinite(v) ? v : NaN);
    }
  }
  return { headers, cols };
}
