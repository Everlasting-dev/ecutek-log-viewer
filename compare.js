// EcuTek-style: X row + Y1..Y5 rows with dropdown + per-row Up/Down/Scale±/Reset

import { parseCSV, findTimeIndex, findRpmIndex, numericColumns } from "./parser.js";

const $ = (id) => document.getElementById(id);

// DOM
const csvFile = $("csvFile");
const xSelect = $("xSelect");
const ySelects = [0,1,2,3,4].map(i => $(`ySelect${i}`));
const btnRows  = Array.from(document.querySelectorAll(".btns"));
const plotBtn  = $("plotBtn");
const clearBtn = $("clearBtn");
const chart    = $("chart");
const toast    = $("toast");
const fileInfo = $("fileInfo");

// State
let headers = [];
let cols = [];
let timeIdx = -1;
let rpmIdx  = -1;
let lastFile = null;

// Per Y-slot (0..4) adjustment {colIdx, offset, scale}
const ySlots = Array.from({length:5}, ()=>({ colIdx:-1, offset:0, scale:1 }));

/* -------- UI helpers -------- */
function showToast(msg, type="error"){
  toast.textContent = msg;
  toast.style.display = "block";
  toast.style.background = (type==="error") ? "#3b0b0b" : "#0b3b18";
  toast.style.borderColor = (type==="error") ? "#742020" : "#1a6a36";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> (toast.style.display = "none"), 3500);
}
function fmtBytes(n){ const u=["B","KB","MB","GB"]; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++;} return `${n.toFixed(1)} ${u[i]}`; }

/* -------- build selects -------- */
function buildXOptions(){
  xSelect.innerHTML = "";
  const opts = [];
  if (timeIdx !== -1) opts.push({idx: timeIdx, label: `${headers[timeIdx]} (Time)`});
  if (rpmIdx  !== -1) opts.push({idx: rpmIdx,  label: `${headers[rpmIdx]} (Engine RPM)`});
  if (!opts.length){
    const o=document.createElement("option"); o.textContent="No Time or RPM column found"; o.disabled=true; xSelect.appendChild(o);
    xSelect.disabled = true; plotBtn.disabled = true;
    return;
  }
  xSelect.disabled = false; plotBtn.disabled = false;
  for (const odef of opts){
    const o=document.createElement("option"); o.value=String(odef.idx); o.textContent=odef.label; xSelect.appendChild(o);
  }
}

function buildYOptions(){
  // build list of numeric columns
  const numericIdx = numericColumns(headers, cols, 5);
  const makeOptions = (sel)=>{
    sel.innerHTML = "";
    const empty = document.createElement("option"); empty.value = "-1"; empty.textContent = "— none —";
    sel.appendChild(empty);
    for (const idx of numericIdx){
      const o = document.createElement("option");
      o.value = String(idx); o.textContent = headers[idx];
      sel.appendChild(o);
    }
  };
  ySelects.forEach(makeOptions);
}

/* -------- per-row controls -------- */
function computeRange(colIdx){
  const v = cols[colIdx]; if (!v) return {range:1};
  let min=+Infinity,max=-Infinity;
  for (let i=0;i<v.length;i++){ const n=v[i]; if(Number.isFinite(n)){ if(n<min)min=n; if(n>max)max=n; } }
  const r = (max-min) || 1;
  return {min,max,range:r};
}
function wireButtons(){
  btnRows.forEach((row)=>{
    const slot = Number(row.dataset.slot);
    row.innerHTML = ""; // rebuild
    const mk = (label, title, fn)=>{
      const b=document.createElement("button"); b.className="mini-btn"; b.textContent=label; b.title=title; b.addEventListener("click", fn); return b;
    };
    const stepFn = ()=> {
      const idx = ySlots[slot].colIdx;
      return Math.max(computeRange(idx).range * 0.05, 1); // 5% or 1
    };
    row.append(
      mk("Up",    "Shift up",    ()=>{ if(ySlots[slot].colIdx<0) return; ySlots[slot].offset += stepFn(); plot(); }),
      mk("Down",  "Shift down",  ()=>{ if(ySlots[slot].colIdx<0) return; ySlots[slot].offset -= stepFn(); plot(); }),
      mk("Scale+", "Scale up (×1.1)", ()=>{ if(ySlots[slot].colIdx<0) return; ySlots[slot].scale *= 1.1; plot(); }),
      mk("Scale−", "Scale down (×0.9)",()=>{ if(ySlots[slot].colIdx<0) return; ySlots[slot].scale *= 0.9; plot(); }),
      mk("Reset", "Reset offset/scale", ()=>{ ySlots[slot].offset=0; ySlots[slot].scale=1; plot(); }),
    );
  });
}

/* -------- plotting -------- */
function plot(){
  const xIdx = Number(xSelect.value);
  if (!Number.isFinite(xIdx)) { showToast("Pick X axis (Time/RPM)."); return; }

  const traces = [];
  for (let s=0; s<ySlots.length; s++){
    const { colIdx, offset, scale } = ySlots[s];
    if (colIdx < 0) continue;
    const y = cols[colIdx].map(v => Number.isFinite(v) ? (v*scale + offset) : v);
    traces.push({
      type:"scattergl", mode:"lines",
      name: headers[colIdx] + (offset||scale!==1 ? `  (Δ=${offset.toFixed(3)}, ×${scale.toFixed(3)})` : ""),
      x: cols[xIdx], y, line:{width:1}
    });
  }
  if (!traces.length){ showToast("Choose at least one Y axis."); return; }

  Plotly.react(chart, traces, {
    paper_bgcolor:"#0f1318", plot_bgcolor:"#0f1318", font:{color:"#e7ecf2"},
    margin:{l:60,r:10,t:10,b:40},
    xaxis:{title: headers[xIdx], gridcolor:"#1b1f25"},
    yaxis:{gridcolor:"#1b1f25", automargin:true},
    showlegend:true, legend:{orientation:"h", y:-0.2}
  }, {displaylogo:false, responsive:true});
}

/* -------- file load -------- */
csvFile.addEventListener("change", (e)=>{
  lastFile = e.target.files[0] || null;
  chart.innerHTML = "";
  ySlots.forEach(s=>{ s.colIdx=-1; s.offset=0; s.scale=1; });

  if (!lastFile){ fileInfo.classList.add("hidden"); return; }
  fileInfo.classList.remove("hidden");
  fileInfo.textContent = `Selected: ${lastFile.name} · ${fmtBytes(lastFile.size)}`;

  const fr = new FileReader();
  fr.onerror = ()=> showToast("Failed to read file.");
  fr.onload  = (ev)=>{
    try{
      const {headers:h, cols:c} = parseCSV(String(ev.target.result||""));
      headers=h; cols=c;
      timeIdx = findTimeIndex(headers);
      rpmIdx  = findRpmIndex(headers);

      buildXOptions();
      buildYOptions();
      wireButtons();
      showToast("Parsed. Configure axes, then Generate Plot.", "ok");
    }catch(err){
      showToast(err.message || "Parse error.");
      headers=[]; cols=[]; timeIdx=rpmIdx=-1;
      buildXOptions(); buildYOptions(); wireButtons();
    }
  };
  fr.readAsText(lastFile);
});

/* -------- selects + buttons -------- */
ySelects.forEach((sel, slot)=>{
  sel.addEventListener("change", ()=>{
    ySlots[slot].colIdx = Number(sel.value);
    ySlots[slot].offset = 0;
    ySlots[slot].scale  = 1;
  });
});

plotBtn.addEventListener("click", plot);

clearBtn.addEventListener("click", ()=>{
  csvFile.value = "";
  lastFile = null;
  headers=[]; cols=[]; timeIdx=rpmIdx=-1;
  xSelect.innerHTML=""; buildYOptions(); wireButtons();
  chart.innerHTML=""; fileInfo.classList.add("hidden");
  ySlots.forEach(s=>{ s.colIdx=-1; s.offset=0; s.scale=1; });
  showToast("Cleared.","ok");
});
