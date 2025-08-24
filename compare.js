// compare.js — single-plot with multi‑Y (max 5), X = Time or Engine RPM
// Requires: parser.js (imported as ES module in compare.html)

import { parseCSV, findTimeIndex, findRpmIndex, numericColumns } from "./parser.js";

const $ = (id) => document.getElementById(id);

// DOM
const csvFile = $("csvFile");
const xSelect = $("xSelect");
const yList   = $("yList");
const yCount  = $("yCount");
const plotBtn = $("plotBtn");
const clearBtn= $("clearBtn");
const chart   = $("chart");
const toast   = $("toast");
const fileInfo= $("fileInfo");

// State
let headers = [];
let cols = [];
let timeIdx = -1;
let rpmIdx  = -1;
let lastFile = null;

const MAX_Y = 5;

/* ---------- UI helpers ---------- */
function showToast(msg, type="error"){
  toast.textContent = msg;
  toast.style.display = "block";
  toast.style.background = (type==="error") ? "#3b0b0b" : "#0b3b18";
  toast.style.borderColor = (type==="error") ? "#742020" : "#1a6a36";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> (toast.style.display = "none"), 3500);
}

function fmtBytes(n){
  if (!Number.isFinite(n)) return "";
  const u = ["B","KB","MB","GB"]; let i=0;
  while (n >= 1024 && i < u.length-1){ n/=1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

/* ---------- Build controls ---------- */
function buildXOptions(){
  xSelect.innerHTML = "";
  if (timeIdx !== -1){
    const o = document.createElement("option");
    o.value = String(timeIdx);
    o.textContent = headers[timeIdx] + " (Time)";
    xSelect.appendChild(o);
  }
  if (rpmIdx !== -1){
    const o = document.createElement("option");
    o.value = String(rpmIdx);
    o.textContent = headers[rpmIdx] + " (Engine RPM)";
    xSelect.appendChild(o);
  }

  const ok = xSelect.options.length > 0;
  xSelect.disabled = !ok;
  plotBtn.disabled = !ok;

  if (!ok){
    const o = document.createElement("option");
    o.textContent = "No Time or RPM column found";
    o.disabled = true;
    xSelect.appendChild(o);
  }
}

function populateYList(){
  yList.innerHTML = "";
  const candidates = numericColumns(headers, cols, 5); // indexes of “mostly numeric” cols
  candidates.forEach((idx) => {
    const row = document.createElement("label");
    const cb  = document.createElement("input");
    cb.type = "checkbox";
    cb.value = String(idx);
    cb.addEventListener("change", enforceMaxY);
    const title = document.createElement("span");
    title.textContent = headers[idx];
    row.appendChild(cb);
    row.appendChild(title);
    yList.appendChild(row);
  });
  updateYCounter();
}

function getSelectedY(){
  return Array.from(yList.querySelectorAll('input[type="checkbox"]:checked'))
    .map(cb => Number(cb.value));
}

function updateYCounter(){
  yCount.textContent = `(${getSelectedY().length}/${MAX_Y})`;
}

function enforceMaxY(e){
  const n = getSelectedY().length;
  if (n > MAX_Y){
    e.target.checked = false;
    showToast(`Max ${MAX_Y} Y series`);
  }
  updateYCounter();
}

/* ---------- Plot ---------- */
function plot(){
  const xIdx  = Number(xSelect.value);
  const yIdxs = getSelectedY().filter(i => i !== xIdx).slice(0, MAX_Y);

  if (!Number.isFinite(xIdx)) { showToast("Pick an X axis."); return; }
  if (!yIdxs.length)          { showToast("Pick at least one Y series."); return; }

  const traces = yIdxs.map((i) => ({
    type: "scattergl",
    mode: "lines",
    name: headers[i],
    x: cols[xIdx],
    y: cols[i],
    line: { width: 1 }
  }));

  const layout = {
    paper_bgcolor: "#0f1318",
    plot_bgcolor:  "#0f1318",
    font: { color: "#e7ecf2" },
    margin: { l: 60, r: 10, t: 10, b: 40 },
    xaxis: { title: headers[xIdx], gridcolor: "#1b1f25" },
    yaxis: { gridcolor: "#1b1f25", automargin: true },
    showlegend: true,
    legend: { orientation: "h", y: -0.2 }
  };

  Plotly.react(chart, traces, layout, { displaylogo:false, responsive:true });
}

/* ---------- File flow ---------- */
// Parse ONCE when user selects a file; do NOT parse on Plot click.
csvFile.addEventListener("change", (e)=>{
  lastFile = e.target.files[0] || null;
  chart.innerHTML = "";

  if (!lastFile){
    fileInfo.classList.add("hidden");
    return;
  }
  fileInfo.classList.remove("hidden");
  fileInfo.textContent = `Selected: ${lastFile.name} · ${fmtBytes(lastFile.size)}`;

  const reader = new FileReader();
  reader.onerror = () => showToast("Failed to read file.");
  reader.onload  = (ev) => {
    try{
      const text = String(ev.target.result || "");
      const parsed = parseCSV(text);
      headers = parsed.headers;
      cols    = parsed.cols;
      timeIdx = findTimeIndex(headers);
      rpmIdx  = findRpmIndex(headers);

      buildXOptions();
      populateYList();
      showToast("Parsed. Pick X and up to 5 Y, then Generate Plot.", "ok");
    }catch(err){
      showToast(err.message || "Parse error.");
      headers = []; cols = []; timeIdx = rpmIdx = -1;
      yList.innerHTML = ""; xSelect.innerHTML = ""; chart.innerHTML = "";
    }
  };
  reader.readAsText(lastFile);
});

/* ---------- Buttons ---------- */
// Now Plot just uses current selections — no re-parse.
plotBtn.addEventListener("click", plot);

clearBtn.addEventListener("click", ()=>{
  csvFile.value = "";
  lastFile = null;
  headers = []; cols = []; timeIdx = rpmIdx = -1;
  yList.innerHTML = ""; xSelect.innerHTML = ""; chart.innerHTML = "";
  fileInfo.classList.add("hidden");
  showToast("Cleared.", "ok");
});
