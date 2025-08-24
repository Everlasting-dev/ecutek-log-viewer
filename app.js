// Pretty UI, same logic: comma CSV, must have a column with "time" in its name.
// One Plotly chart per other column vs time.

import { parseCSV, findTimeIndex } from "./parser.js";

const els = {
  file: document.getElementById("csvFile"),
  analyzeBtn: document.getElementById("genBtn"),
  plotBtn: document.getElementById("genBtn"),
  clearBtn: document.getElementById("clearBtn"),
  dropzone: document.getElementById("dropzone"),
  fileInfo: document.getElementById("fileInfo"),
  toast: document.getElementById("toast"),
  plots: document.getElementById("plots"),
};

let headers = [];
let cols = [];
let lastFile = null;

function showToast(msg, type="error"){
  els.toast.textContent = msg;
  els.toast.classList.remove("hidden");
  els.toast.style.background = (type==="error") ? "#3b0b0b" : "#0b3b18";
  els.toast.style.borderColor = (type==="error") ? "#742020" : "#1a6a36";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> els.toast.style.display = "none", 4000);
}

function fmtBytes(n){
  if (!Number.isFinite(n)) return "";
  const u = ["B","KB","MB","GB"]; let i=0;
  while (n >= 1024 && i < u.length-1){ n/=1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

function handlePicked(file){
  lastFile = file;
  if (!file){ els.fileInfo.classList.add("hidden"); return; }
  els.fileInfo.classList.remove("hidden");
  els.fileInfo.textContent = `Selected: ${file.name}  ·  ${fmtBytes(file.size)}`;
}

/* ---------- Series building & plotting ---------- */

function toNum(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return NaN;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function buildSeries(xKey, yKeys) {
  const series = yKeys.map(k => ({ name: k, x: [], y: [] }));

  for (let i = 0; i < cols[0].length; i++) {
    const xv = toNum(cols[xKey][i]);
    if (!Number.isFinite(xv)) continue;

    for (let s = 0; s < yKeys.length; s++) {
      const yv = toNum(cols[yKeys[s]][i]);
      if (Number.isFinite(yv)) {
        series[s].x.push(xv);
        series[s].y.push(yv);
      }
    }
  }
  return series;
}

function strideDownsample(xs, ys, maxPts = 20000) {
  const n = xs.length;
  if (n <= maxPts) return { x: xs, y: ys };
  const step = Math.ceil(n / maxPts);
  const m = Math.floor(n / step);
  const x = new Array(m), y = new Array(m);
  let j = 0;
  for (let i = 0; i < n; i += step) {
    x[j] = xs[i];
    y[j] = ys[i];
    j++;
  }
  return { x, y };
}

/* ---------- UI wiring ---------- */

function resetUI() {
  headers = [];
  cols = [];
  els.fileInfo.textContent = "";
  clearErr();
  if (window.Plotly) Plotly.purge(els.plots); 
  els.plots.innerHTML = "";
  lastFile = null; 
}

function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// NEW: Caching and loading from sessionStorage
function cacheCSV(text, name, size){
  sessionStorage.setItem("csvText", text);
  sessionStorage.setItem("csvName", name || "");
  sessionStorage.setItem("csvSize", String(size || 0));
}

function tryLoadCached(){
  const text = sessionStorage.getItem("csvText");
  if (!text) return false;
  const name = sessionStorage.getItem("csvName") || "cached.csv";
  const size = Number(sessionStorage.getItem("csvSize") || 0);
  els.fileInfo.classList.remove("hidden");
  els.fileInfo.textContent = `Selected (cached): ${name} · ${fmtBytes(size)}`;

  try{
    const parsed = parseCSV(text);
    headers = parsed.headers;
    cols = parsed.cols;
    const timeIdx = findTimeIndex(headers);
    if (Number.isFinite(timeIdx)) {
      const numericColsToPlot = headers.map((_, i) => i).filter(i => i !== timeIdx && isFinite(cols[i][0]));
      if (numericColsToPlot.length > 0) {
        // Need to convert cols to rows format for existing plot function in app.js if it expects it
        // The renderPlots function below already expects cols, so no conversion needed here.
        // We will just pass the headers, cols, and timeIdx directly to renderPlots.
        renderPlots({headers, cols, timeIdx});
        showToast("Loaded cached CSV. Plots generated from numeric columns vs Time.", "ok");
      } else {
        showToast("Loaded cached CSV. No numeric columns found to plot.", "ok");
      }
    } else {
      showToast("Loaded cached CSV. No 'Time' column found.", "error");
    }
    return true;
  }catch(err){
    console.warn("Failed to parse cache in app.js:", err);
    els.fileInfo.textContent = "No file loaded.";
    showToast(err.message || "Parse error for cached data.", "error");
    return false;
  }
}

function handleFileProcess(file){
  if (!file) { showToast("No file selected."); return; }
  const reader = new FileReader();
  reader.onerror = () => showToast("Failed to read file.", "error");
  reader.onload = (e) => {
    try{
      const text = String(e.target.result || "");
      cacheCSV(text, file.name, file.size); 
      const parsed = parseCSV(text);
      headers = parsed.headers;
      cols = parsed.cols; 

      const timeIdx = findTimeIndex(headers);
      if (Number.isFinite(timeIdx)) {
        const numericColsToPlot = headers.map((_, i) => i).filter(i => i !== timeIdx && isFinite(cols[i][0]));
        if (numericColsToPlot.length > 0) {
          renderPlots({headers, cols, timeIdx});
          showToast("File parsed and plots generated.", "ok");
        } else {
          showToast("File parsed. No numeric columns found to plot.", "ok");
        }
      } else {
        showToast("File parsed. No 'Time' column found.", "error");
      }
      
      els.fileInfo.innerHTML = `
        <strong>File:</strong> ${file.name}<br/>
        <strong>Columns:</strong> ${headers.length} · <strong>Rows:</strong> ${cols[0].length}
      `;
    }catch(err){
      els.plots.innerHTML = "";
      els.fileInfo.textContent = "No file loaded.";
      showToast(err.message || "Parse error", "error");
    }
  };
  reader.readAsText(file);
}

// Function to update the plots area in app.js
function renderPlots({ headers, cols, timeIdx }){
  els.plots.innerHTML = "";
  const x = cols[timeIdx];

  for (let i=0; i<headers.length; i++){
    if (i === timeIdx) continue;

    const numericCount = cols[i].reduce((a,v)=> a + (Number.isFinite(v)?1:0), 0);
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
    els.plots.appendChild(card);

    Plotly.newPlot(
      div,
      [{ x, y: cols[i], mode: "lines", name: headers[i], line: { width: 1, color: "#34a0ff" } }],
      {
        paper_bgcolor: "#0f1318",
        plot_bgcolor: "#0f1318",
        font: { color: "#e7ecf2" },
        margin: { l: 50, r: 10, t: 10, b: 40 },
        xaxis: { title: headers[timeIdx] || "X", gridcolor: "#1b1f25" },
        yaxis: { title: headers[i], gridcolor: "#1b1f25", automargin: true },
        showlegend: false
      },
      { displaylogo: false, responsive: true }
    );
  }
}

/* --- Events --- */
els.analyzeBtn.addEventListener("click", () => handleFileProcess(lastFile));
els.clearBtn.addEventListener("click", () => {
  resetUI();
  els.file.value = ""; // Clear file input visual
});

els.file.addEventListener("change", (e) => {
  lastFile = e.target.files[0];
  if (lastFile) handleFileProcess(lastFile);
});

window.addEventListener("resize", debounce(() => {
  Array.from(els.plots.children).forEach(plotCard => {
    const plotDiv = plotCard.querySelector(".plot");
    if (plotDiv && plotDiv.data && plotDiv.data.length) {
      Plotly.Plots.resize(plotDiv);
    }
  });
}, 150));

["dragenter","dragover"].forEach(ev=>{
  els.dropzone.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); els.dropzone.classList.add("dragover"); });
});
["dragleave","drop"].forEach(ev=>{
  els.dropzone.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); els.dropzone.classList.remove("dragover"); });
});
els.dropzone.addEventListener("drop", (e)=>{
  const f = e.dataTransfer.files?.[0];
  if (f && /\.csv$/i.test(f.name)){ 
    lastFile = f; 
    handleFileProcess(f); 
  }
  else { showToast("Drop a .csv file."); }
});

document.addEventListener("DOMContentLoaded", () => {
  tryLoadCached();
});
