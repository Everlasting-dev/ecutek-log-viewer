// CSV Parser Web Worker
// Parses CSV files in a background thread to avoid blocking the UI

// Import parser functions (workers can't use ES modules directly, so we inline)
function findTimeIndex(headers){
  return headers.findIndex(h => /time|timestamp/i.test(h));
}

function parseCSV(text, onProgress){
  const lines = text.split(/\r?\n/);
  const totalLines = lines.length;
  const filteredLines = [];
  
  // Filter out comments and empty lines, report progress
  for (let i = 0; i < lines.length; i++){
    const line = lines[i];
    if (line && !line.startsWith("#")){
      filteredLines.push(line);
    }
    // Report progress every 1000 lines
    if (onProgress && i % 1000 === 0){
      onProgress(Math.round((i / totalLines) * 100));
    }
  }
  
  if (filteredLines.length < 2) throw new Error("Empty CSV or missing rows.");
  
  const headers = filteredLines[0].split(",").map(h => h.trim());
  const timeIdx = findTimeIndex(headers);
  if (timeIdx === -1) throw new Error("No 'Time' column found.");
  
  const cols = headers.map(()=>[]);
  const totalRows = filteredLines.length - 1;
  
  for (let i = 1; i < filteredLines.length; i++){
    const values = filteredLines[i].split(",");
    if (values.length !== headers.length) continue;
    for (let j = 0; j < values.length; j++){
      const v = parseFloat(values[j]);
      cols[j].push(isFinite(v) ? v : NaN);
    }
    // Report progress every 1000 rows
    if (onProgress && i % 1000 === 0){
      onProgress(Math.round((i / totalRows) * 100));
    }
  }
  
  return { headers, cols, timeIdx };
}

// Worker message handler
self.onmessage = function(e){
  const { text, id } = e.data;
  
  try {
    let lastProgress = 0;
    const result = parseCSV(text, (progress) => {
      // Only send progress updates if changed significantly (every 5%)
      if (Math.abs(progress - lastProgress) >= 5){
        self.postMessage({ type: 'progress', progress, id });
        lastProgress = progress;
      }
    });
    
    self.postMessage({ type: 'done', result, id });
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message, id });
  }
};
