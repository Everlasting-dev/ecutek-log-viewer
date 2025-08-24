// EcuTek-style compare (module). Depends on parser.js.
import { parseCSV, findTimeIndex, findRpmIndex, numericColumns } from "./parser.js";

const $ = (id) => document.getElementById(id);
const csvFile = $("csvFile");
const axisPanel = $("axisPanel");
const plotBtn = $("plotBtn");
const clearBtn = $("clearBtn");
const chart = $("chart");
const toast = $("toast");
const fileInfo = $("fileInfo");

// state
let headers = [];
let cols = [];
let timeIdx = -1, rpmIdx = -1;
let lastFile = null;

// X + 5 Y slots
const SLOT_COUNT = 5;
let xIdx = NaN;                                   // chosen X
const ySlots = Array.from({length: SLOT_COUNT}, ()=>({ colIdx:-1, offset:0 })); // per-row

/* UI helpers */
function toastMsg(msg, type="error"){
  toast.textContent = msg;
  toast.style.display = "block";
  toast.style.background = (type==="error") ? "#3b0b0b" : "#0b3b18";
  toast.style.borderColor = (type==="error") ? "#742020" : "#1a6a36";
  clearTimeout(toastMsg._t);
  toastMsg._t = setTimeout(()=> toast.style.display = "none", 3200);
}
function fmtBytes(n){ const u=["B","KB","MB","GB"]; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++;} return `${n.toFixed(1)} ${u[i]}`; }
function rangeOf(colIdx){
  const v = cols[colIdx] || [];
  let min=+Infinity, max=-Infinity;
  for (let i=0;i<v.length;i++){ const n=v[i]; if(Number.isFinite(n)){ if(n<min)min=n; if(n>max)max=n; } }
  return { range: (max-min) || 1 };
}

/* Build axis rows */
function buildUI(){
  axisPanel.innerHTML = "";

  // X row
  const xRow = document.createElement("div");
  xRow.className = "slot";
  const xLab = document.createElement("label"); xLab.textContent = "X Axis";
  const xSel = document.createElement("select"); xSel.id = "xSel";
  const xBtns = document.createElement("div"); xBtns.className = "btns";
  xRow.append(xLab, xSel, xBtns);
  axisPanel.appendChild(xRow);

  // Options: Time / RPM if present
  const addOpt = (idx,label)=>{ const o=document.createElement("option"); o.value=String(idx); o.textContent=label; xSel.appendChild(o); };
  let hasX = false;
  if (timeIdx !== -1){ addOpt(timeIdx, `${headers[timeIdx]} (Time)`); hasX = true; }
  if (rpmIdx  !== -1){ addOpt(rpmIdx,  `${headers[rpmIdx]} (Engine RPM)`); hasX = true; }
  if (!hasX){ const o=document.createElement("option"); o.textContent="No Time or RPM column"; o.disabled=true; xSel.appendChild(o); plotBtn.disabled = true; }
  else { plotBtn.disabled = false; xIdx = Number(xSel.value); }
  xSel.addEventListener("change", () => xIdx = Number(xSel.value));

  // Numeric column list for Y dropdowns
  const numericIdx = numericColumns(headers, cols, 5);

  // Y rows
  for (let i=0;i<SLOT_COUNT;i++){
    const row = document.createElement("div"); row.className = "slot";
    const lab = document.createElement("label"); lab.textContent = `Y Axis ${i+1}`;
    const sel = document.createElement("select");
    // none
    { const o=document.createElement("option"); o.value="-1"; o.textContent="(None)"; sel.appendChild(o); }
    // options
    numericIdx.forEach(idx => {
      const o=document.createElement("option");
      o.value=String(idx); o.textContent=headers[idx];
      sel.appendChild(o);
    });
    sel.value = String(ySlots[i].colIdx ?? -1);
    sel.addEventListener("change", ()=>{
      ySlots[i].colIdx = Number(sel.value);
      ySlots[i].offset = 0; // reset when changing series
      wireBtns(i, row, sel);
    });

    const btns = document.createElement("div"); btns.className = "btns";
    row.append(lab, sel, btns);
    axisPanel.appendChild(row);
    wireBtns(i, row, sel);
  }
}

/* Per-row buttons */
function wireBtns(slotIdx, row, sel){
  const btns = row.querySelector(".btns");
  btns.innerHTML = "";
  const mk = (txt, title, fn)=>{ const b=document.createElement("button"); b.className="mini"; b.textContent=txt; b.title=title; b.addEventListener("click", fn); return b; };
  const colIdx = Number(sel.value);
  if (colIdx === -1){
    const disabled = mk("Reset","Nothing selected", ()=>{});
    disabled.disabled = true;
    btns.appendChild(disabled);
    return;
  }
  const step = Math.max(rangeOf(colIdx).range * 0.05, 1); // 5% or 1
  btns.append(
    mk("Up",   "Offset up",   ()=>{ ySlots[slotIdx].offset += step; plot(); }),
    mk("Down", "Offset down", ()=>{ ySlots[slotIdx].offset -= step; plot(); }),
    mk("Reset","Clear offset",()=>{ ySlots[slotIdx].offset  = 0;    plot(); }),
  );
}

/* Plotting */
function plot(){
  if (!Number.isFinite(xIdx)) return toastMsg("Pick X axis (Time or RPM).");
  const traces = [];
  for (let i=0;i<ySlots.length;i++){
    const { colIdx, offset } = ySlots[i];
    if (colIdx === -1) continue;
    const y = cols[colIdx].map(v => Number.isFinite(v) ? (v + offset) : v);
    traces.push({
      type:"scattergl", mode:"lines",
      name: headers[colIdx] + (offset ? ` (Δ=${offset.toFixed(3)})` : ""),
      x: cols[xIdx], y, line:{width:1}
    });
  }
  if (!traces.length) return toastMsg("Select at least one Y axis.");
  Plotly.react(chart, traces, {
    paper_bgcolor:"#0f1318", plot_bgcolor:"#0f1318", font:{color:"#e7ecf2"},
    margin:{l:60,r:10,t:10,b:40},
    xaxis:{title: headers[xIdx] || "X", gridcolor:"#1b1f25"},
    yaxis:{gridcolor:"#1b1f25", automargin:true},
    showlegend:true, legend:{orientation:"h", y:-0.2}
  }, {displaylogo:false, responsive:true});
}

/* File flow */
csvFile.addEventListener("change", (e)=>{
  lastFile = e.target.files[0] || null;
  if (!lastFile){ fileInfo.classList.add("hidden"); return; }
  fileInfo.classList.remove("hidden");
  fileInfo.textContent = `Selected: ${lastFile.name} · ${fmtBytes(lastFile.size)}`;

  const fr = new FileReader();
  fr.onerror = () => toastMsg("Failed to read file.");
  fr.onload  = (ev) => {
    try{
      const text = String(ev.target.result || "");
      const { headers:h, cols:c } = parseCSV(text);
      headers = h; cols = c;
      timeIdx = findTimeIndex(headers);
      rpmIdx  = findRpmIndex(headers);
      // reset slots
      xIdx = Number.isFinite(timeIdx) ? timeIdx : NaN;
      for (let i=0;i<ySlots.length;i++){ ySlots[i].colIdx = -1; ySlots[i].offset = 0; }
      buildUI();
      chart.innerHTML = "";
      toastMsg("Parsed. Configure axes, then Generate Plot.", "ok");
    }catch(err){
      toastMsg(err.message || "Parse error.");
      headers=[]; cols=[]; timeIdx=rpmIdx=-1; axisPanel.innerHTML=""; chart.innerHTML="";
    }
  };
  fr.readAsText(lastFile);
});

plotBtn.addEventListener("click", plot);

clearBtn.addEventListener("click", ()=>{
  csvFile.value = "";
  lastFile = null;
  headers=[]; cols=[]; timeIdx=rpmIdx=-1; xIdx = NaN;
  axisPanel.innerHTML=""; chart.innerHTML=""; fileInfo.classList.add("hidden");
  ySlots.forEach(s=>{ s.colIdx=-1; s.offset=0; });
  toastMsg("Cleared.","ok");
});
