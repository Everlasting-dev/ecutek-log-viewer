export function findTimeIndex(headers){
  const idx = headers.findIndex(h => h.toLowerCase().includes("time"));
  return idx;
}

export function findRpmIndex(headers){
  const idx = headers.findIndex(h => h.toLowerCase().includes("rpm"));
  return idx;
}

export function numericColumns(headers, cols, minNumericCount = 5){
  const numericIdx = [];
  for (let i=0; i<headers.length; i++){
    const count = (cols[i]||[]).reduce((a,v)=>a+(Number.isFinite(v)?1:0),0);
    if (count>=minNumericCount){ numericIdx.push(i); }
  }
  return numericIdx;
}

export function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(line => line && !line.startsWith("#"));
  if (lines.length < 2) throw new Error("Empty CSV or missing rows.");
  const headers = lines[0].split(",");
  const timeIdx = findTimeIndex(headers);
  if (timeIdx === -1) throw new Error("No 'Time' column found.");

  const cols = headers.map(()=> []);
  for (let i=1; i<lines.length; i++){
    const values = lines[i].split(",");
    if (values.length !== headers.length) continue;
    for (let j=0; j<values.length; j++){
      const v = parseFloat(values[j]);
      cols[j].push(isFinite(v) ? v : NaN);
    }
  }
  return { headers, cols, timeIdx };
}
