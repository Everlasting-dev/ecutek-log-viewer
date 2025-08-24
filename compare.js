// Single page with two tabs:
//  - Compare (multi‑Y single plot)
//  - Multi (many small plots)
// One upload + session cache shared across panes.

import { parseCSV, findTimeIndex, findRpmIndex, numericColumns } from "./parser.js";

const $ = (id) => document.getElementById(id);

// uploader
const csvFile  = $("csvFile");
const fileInfo = $("fileInfo");
const toast    = $("toast");

// compare controls
const axisPanel= $("axisPanel");
const stepPct  = $("stepPct");
const plotBtn  = $("plotBtn");
const clearBtn = $("clearBtn");
const chart    = $("chart");

// multi plots
const plotsEl  = $("plots");

// tabs
const tabBtns  = document.querySelectorAll(".tab");
const paneCompare = $("pane-compare");
const paneMulti   = $("pane-multi");

// ---- state ----
let headers = [];
let cols = [];
let timeIdx = -1, rpmIdx = -1;
let lastFileText = "";
let xIdx = NaN;

const SLOT_COUNT = 5;
const ySlots = Array.from({length: SLOT_COUNT}, () => ({
  enabled: false, colIdx: -1, offset: 0, color: "#00aaff",
}));

// ---- helpers ----
function toastMsg(msg, type="error"){
  toast.textContent = msg;
  toast.classList.remove("hidden");
  toast.style.background = (type==="error") ? "#3b0b0b" : "#0b3b18";
  toast.style.borderColor = (type==="error") ? "#742020" : "#1a6a36";
  clearTimeout(toastMsg._t);
  toastMsg._t = setTimeout(()=> (toast.style.display="none"), 2600);
}
const fmtBytes = n => { const u=["B","KB","MB","GB"]; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++;} return `${n.toFixed(1)} ${u[i]}`; };
function seriesRange(idx){
  const v = cols[idx] || [];
  let mn = +Infinity, mx = -Infinity;
  for (let i=0;i<v.length;i++){ const n=v[i]; if (Number.isFinite(n)){ if(n<mn) mn=n; if(n>mx) mx=n; } }
  return (mx - mn) || 1;
}
function currentStep(idx){
  const pct = Number(stepPct.value || "0.10");
  return Math.max(seriesRange(idx) * pct, 1);
}

// ---- UI (Compare) ----
function buildCompareUI(){
  axisPanel.innerHTML = "";

  // X row (Time / RPM)
  const xRow = document.createElement("div");
  xRow.className = "slot";
  const xLab = document.createElement("label"); xLab.textContent = "X Axis";
  const xSel = document.createElement("select"); xSel.id = "xSel";
  xRow.append(xLab, xSel, document.createElement("div"));
  axisPanel.appendChild(xRow);

  const addX = (idx,label)=>{ const o=document.createElement("option"); o.value=String(idx); o.textContent=label; xSel.appendChild(o); };
  let hasX = false;
  if (timeIdx !== -1){ addX(timeIdx, `${headers[timeIdx]} (Time)`); hasX=true; }
  if (rpmIdx  !== -1){ addX(rpmIdx,  `${headers[rpmIdx]} (Engine RPM)`); hasX=true; }

  if (!hasX){
    const o=document.createElement("option"); o.textContent="No Time or RPM column"; o.disabled=true; xSel.appendChild(o);
    plotBtn.disabled = true;
  } else {
    plotBtn.disabled = false;
    xSel.value = String(Number.isFinite(xIdx) ? xIdx : Number(xSel.options[0].value));
    xIdx = Number(xSel.value);
  }
  xSel.addEventListener("change", ()=> xIdx = Number(xSel.value));

  // Y rows (single line: enable + select + Up/Down/Reset + color)
  const numericIdx = numericColumns(headers, cols, 5);
  for (let i=0;i<SLOT_COUNT;i++){
    const row = document.createElement("div"); row.className = "slot";

    const enable = document.createElement("input"); enable.type="checkbox"; enable.checked=ySlots[i].enabled;
    const lab = document.createElement("label"); lab.textContent=`Y Axis ${i+1}`;

    const sel = document.createElement("select");
    const none = document.createElement("option"); none.value="-1"; none.textContent="(None)"; sel.appendChild(none);
    numericIdx.forEach(idx=>{ const o=document.createElement("option"); o.value=String(idx); o.textContent=headers[idx]; sel.appendChild(o); });
    sel.value = String(ySlots[i].colIdx);

    const btns = document.createElement("div"); btns.className="btns";
    const mk = (t, title, fn)=>{ const b=document.createElement("button"); b.className="mini"; b.textContent=t; b.title=title; b.addEventListener("click", fn); return b; };
    const up    = mk("Up","Offset up",   ()=>{ const k=ySlots[i].colIdx; if(k<0) return; ySlots[i].offset += currentStep(k); plotCompare(); });
    const down  = mk("Down","Offset down",()=>{ const k=ySlots[i].colIdx; if(k<0) return; ySlots[i].offset -= currentStep(k); plotCompare(); });
    const reset = mk("Reset","Clear offset",()=>{ ySlots[i].offset=0; plotCompare(); });
    const color = document.createElement("input"); color.type="color"; color.value=ySlots[i].color; color.style.width="40px"; color.style.height="30px";
    color.addEventListener("input", ()=>{ ySlots[i].color=color.value; plotCompare(); });

    enable.addEventListener("change", ()=>{ ySlots[i].enabled=enable.checked; plotCompare(); });
    sel.addEventListener("change", ()=>{ ySlots[i].colIdx=Number(sel.value); ySlots[i].offset=0; plotCompare(); });

    btns.append(up,down,reset,color);
    row.append(enable, lab, sel, btns);
    axisPanel.appendChild(row);
  }
}

// ---- plotting (Compare) ----
function plotCompare(showToast=true){
  if (!Number.isFinite(xIdx)){ if(showToast) toastMsg("Pick X axis (Time/RPM)."); return; }
  const traces = [];
  for (const s of ySlots){
    if (!s.enabled || s.colIdx < 0) continue;
    const y = cols[s.colIdx].map(v => Number.isFinite(v) ? (v + s.offset) : v);
    traces.push({ type:"scattergl", mode:"lines", name: headers[s.colIdx] + (s.offset?` (Δ=${s.offset.toFixed(3)})`:""), x: cols[xIdx], y, line:{width:1, color:s.color} });
  }
  if (!traces.length){ if(showToast) toastMsg("Enable at least one Y axis."); return; }

  Plotly.react(chart, traces, {
    paper_bgcolor:"#0f1318", plot_bgcolor:"#0f1318", font:{color:"#e7ecf2"},
    margin:{l:60,r:10,t:10,b:40}, xaxis:{title:headers[xIdx]||"X", gridcolor:"#1b1f25"},
    yaxis:{gridcolor:"#1b1f25", automargin:true}, showlegend:true, legend:{orientation:"h", y:-0.2}
  }, {displaylogo:false, responsive:true});
}

// ---- plotting (Multi) ----
function renderMultiPlots(){
  plotsEl.innerHTML = "";
  if (timeIdx === -1){ return; }
  const x = cols[timeIdx];
  for (let i=0;i<headers.length;i++){
    if (i===timeIdx) continue;
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
    plotsEl.appendChild(card);

    Plotly.newPlot(div, [{ x, y: cols[i], mode:"lines", name:headers[i], line:{width:1} }], {
      paper_bgcolor:"#0f1318", plot_bgcolor:"#0f1318", font:{color:"#e7ecf2"},
      margin:{l:50,r:10,t:10,b:40}, xaxis:{title:headers[timeIdx], gridcolor:"#1b1f25"},
      yaxis:{title:headers[i], gridcolor:"#1b1f25", automargin:true}, showlegend:false
    }, {displaylogo:false, responsive:true});
  }
}

// ---- cache ----
function cacheCSV(text,name,size){
  sessionStorage.setItem("csvText", text);
  sessionStorage.setItem("csvName", name||"");
  sessionStorage.setItem("csvSize", String(size||0));
}
function tryLoadCached(){
  const text = sessionStorage.getItem("csvText");
  if (!text) return false;
  lastFileText = text;
  const name = sessionStorage.getItem("csvName") || "cached.csv";
  const size = Number(sessionStorage.getItem("csvSize") || 0);
  fileInfo.classList.remove("hidden");
  fileInfo.textContent = `Selected (cached): ${name} · ${fmtBytes(size)}`;
  parseAndBuild(text);
  toastMsg("Loaded cached CSV.", "ok");
  return true;
}

// ---- parse + build ----
function parseAndBuild(text){
  const parsed = parseCSV(text);
  headers = parsed.headers; cols = parsed.cols;
  timeIdx = findTimeIndex(headers);
  rpmIdx  = findRpmIndex(headers);

  // reset compare slots (keep colors)
  xIdx = Number.isFinite(timeIdx) ? timeIdx : NaN;
  ySlots.forEach((s,i)=>{ s.enabled=false; s.colIdx=-1; s.offset=0; });

  buildCompareUI();
  chart.innerHTML = "";          // wait for Generate or auto‑plot from selections
  renderMultiPlots();            // prebuild multi pane
}

// ---- events ----
csvFile.addEventListener("change", (e)=>{
  const f = e.target.files?.[0];
  if (!f){ fileInfo.classList.add("hidden"); return; }
  const r = new FileReader();
  r.onerror = () => toastMsg("Failed to read file.");
  r.onload  = (ev)=>{
    const text = String(ev.target.result || "");
    lastFileText = text;
    cacheCSV(text, f.name, f.size);
    fileInfo.classList.remove("hidden");
    fileInfo.textContent = `Selected: ${f.name} · ${fmtBytes(f.size)}`;
    try { parseAndBuild(text); toastMsg("Parsed.", "ok"); } catch(err){ toastMsg(err.message||"Parse error."); }
  };
  r.readAsText(f);
});

plotBtn.addEventListener("click", ()=> plotCompare(true));

clearBtn.addEventListener("click", ()=>{
  axisPanel.innerHTML=""; chart.innerHTML=""; plotsEl.innerHTML="";
  headers=[]; cols=[]; timeIdx=rpmIdx=-1; xIdx=NaN; lastFileText="";
  fileInfo.classList.add("hidden");
  toastMsg("Cleared (cache kept).", "ok");
});

// tabs
tabBtns.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    tabBtns.forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".tabpane").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("pane-"+btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "multi") renderMultiPlots();
  });
});

// init from cache if available
document.addEventListener("DOMContentLoaded", ()=>{ tryLoadCached(); });
