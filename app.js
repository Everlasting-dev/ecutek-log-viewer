// Pretty UI, same logic: comma CSV, must have a column with "time" in its name.
// One Plotly chart per other column vs time.

const $ = (id) => document.getElementById(id);
const csvFile = $("csvFile");
const genBtn  = $("genBtn");
const clearBtn= $("clearBtn");
const drop    = $("dropzone");
const info    = $("fileInfo");
const toast   = $("toast");
const summary = $("summary");
const plotsEl = $("plots");

let lastFile = null;

function showToast(msg, type="error"){
  toast.textContent = msg;
  toast.style.display = "block";
  toast.style.background = (type==="error") ? "#3b0b0b" : "#0b3b18";
  toast.style.borderColor = (type==="error") ? "#742020" : "#1a6a36";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> toast.style.display = "none", 4000);
}

function fmtBytes(n){
  if (!Number.isFinite(n)) return "";
  const u = ["B","KB","MB","GB"]; let i=0;
  while (n >= 1024 && i < u.length-1){ n/=1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

function handlePicked(file){
  lastFile = file;
  if (!file){ info.classList.add("hidden"); return; }
  info.classList.remove("hidden");
  info.textContent = `Selected: ${file.name}  ·  ${fmtBytes(file.size)}`;
}

function pickTimeIndex(headers){
  const idx = headers.findIndex(h => h.toLowerCase().includes("time"));
  return idx;
}

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(line => line && !line.startsWith("#"));
  if (lines.length < 2) throw new Error("Empty CSV or missing rows.");
  const headers = lines[0].split(",");
  const timeIdx = pickTimeIndex(headers);
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

function renderPlots({ headers, cols, timeIdx }){
  plotsEl.innerHTML = "";
  const x = cols[timeIdx];

  for (let i=0; i<headers.length; i++){
    if (i === timeIdx) continue;

    // skip non-numeric columns (all NaN or very low numeric count)
    const numericCount = cols[i].reduce((a,v)=> a + (isFinite(v)?1:0), 0);
    if (numericCount < 5) continue;

    const card = document.createElement("div");
    card.className = "card plot-card";

    const title = document.createElement("div");
    title.className = "plot-title";
    title.textContent = headers[i];

    const frame = document.createElement("div");
    frame.className = "plot-frame";

    const div = document.createElement("div");
    div.className = "plot";
    frame.appendChild(div);

    card.appendChild(title);
    card.appendChild(frame);
    plotsEl.appendChild(card);

    Plotly.newPlot(
      div,
      [{ x, y: cols[i], mode: "lines", name: headers[i], line: { width: 1 } }],
      {
        paper_bgcolor: "#0f1318",
        plot_bgcolor: "#0f1318",
        font: { color: "#e7ecf2" },
        margin: { l: 50, r: 10, t: 10, b: 40 },
        xaxis: { title: "Time (s)", gridcolor: "#1b1f25" },
        yaxis: { title: headers[i], gridcolor: "#1b1f25", automargin: true },
        showlegend: false
      },
      { displaylogo: false, responsive: true }
    );
  }
}

function handleFileProcess(file){
  if (!file) { showToast("No file selected."); return; }
  const reader = new FileReader();
  reader.onerror = () => showToast("Failed to read file.", "error");
  reader.onload = (e) => {
    try{
      const text = String(e.target.result || "");
      const parsed = parseCSV(text);
      renderPlots(parsed);
      summary.innerHTML = `
        <strong>File:</strong> ${file.name}<br/>
        <strong>Columns:</strong> ${parsed.headers.length} · <strong>Rows:</strong> ${parsed.cols[0].length}
      `;
      showToast("Plots generated.", "ok");
    }catch(err){
      plotsEl.innerHTML = "";
      summary.textContent = "No file loaded.";
      showToast(err.message || "Parse error", "error");
    }
  };
  reader.readAsText(file);
}

/* --- Events --- */
genBtn.addEventListener("click", () => handleFileProcess(lastFile));
clearBtn.addEventListener("click", () => {
  plotsEl.innerHTML = ""; summary.textContent = "No file loaded."; csvFile.value = ""; lastFile = null;
  info.classList.add("hidden");
});

csvFile.addEventListener("change", (e) => handlePicked(e.target.files[0]));

/* Drag & drop */
["dragenter","dragover"].forEach(ev=>{
  drop.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); drop.classList.add("dragover"); });
});
["dragleave","drop"].forEach(ev=>{
  drop.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); drop.classList.remove("dragover"); });
});
drop.addEventListener("drop", (e)=>{
  const f = e.dataTransfer.files?.[0];
  if (f && /\.csv$/i.test(f.name)){ handlePicked(f); handleFileProcess(f); }
  else { showToast("Drop a .csv file."); }
});
