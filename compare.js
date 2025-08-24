
// EcuTek-style compare with: session cache, enable/disable, colors, configurable step, auto-select Y
import { parseCSV, findTimeIndex, findRpmIndex, numericColumns } from "./parser.js";

const $ = (id) => document.getElementById(id);
const csvFile  = $("csvFile");
const fileInfo = $("fileInfo");
const axisPanel= $("axisPanel");
const stepPct  = $("stepPct");
const plotBtn  = $("plotBtn");
const clearBtn = $("clearBtn");
const chart    = $("chart");
const toast    = $("toast");

// ---- state ----
let headers = [];
let cols = [];
let timeIdx = -1, rpmIdx = -1;
let lastFile = null;
let xIdx = NaN;

const SLOT_COUNT = 5;
// per-slot state
const ySlots = Array.from({length: SLOT_COUNT}, () => ({
  enabled: false,
  colIdx: -1,
  offset: 0,
  color: "#00aaff",
}));

// ---- helpers ----
function toastMsg(msg, type="error"){
  toast.textContent = msg;
  toast.style.display = "block";
  toast.style.background = (type==="error") ? "#3b0b0b" : "#0b3b18";
  toast.style.borderColor = (type==="error") ? "#742020" : "#1a6a36";
  clearTimeout(toastMsg._t);
  toastMsg._t = setTimeout(()=> (toast.style.display = "none"), 2800);
}
function fmtBytes(n){ const u=["B","KB","MB","GB"]; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++;} return `${n.toFixed(1)} ${u[i]}`;} 
function seriesRange(idx){
  const v = cols[idx] || [];
  let mn = +Infinity, mx = -Infinity;
  for (let i=0;i<v.length;i++){ const n=v[i]; if (Number.isFinite(n)){ if(n<mn) mn=n; if(n>mx) mx=n; } } /* Corrected line: if(n>mx) mx=n; */
  return (mx - mn) || 1;
}
function currentStep(idx){
  const pct = Number(stepPct.value || "0.10"); // default 10%
  return Math.max(seriesRange(idx) * pct, 1);
}

// ---- UI build ----
function buildUI(){
  axisPanel.innerHTML = "";

  // X row
  const xRow = document.createElement("div");
  xRow.className = "slot";
  const xLab = document.createElement("label"); xLab.textContent = "X Axis";
  const xSel = document.createElement("select"); xSel.id = "xSel";
  const xBtns= document.createElement("div"); xBtns.className = "btns";
  xRow.append(xLab, xSel, xBtns);
  axisPanel.appendChild(xRow);

  // X options: Time / RPM
  let hasX = false;
  const addX = (idx,label)=>{ const o=document.createElement("option"); o.value=String(idx); o.textContent=label; xSel.appendChild(o); };
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

  // Y rows
  const numericIdx = numericColumns(headers, cols, 5);
  for (let i=0;i<SLOT_COUNT;i++){
    const row = document.createElement("div"); row.className = "slot";

    // enable checkbox
    const enableWrap = document.createElement("div");
    enableWrap.style.display = "flex"; enableWrap.style.alignItems = "center"; enableWrap.style.gap = "8px";
    const enable = document.createElement("input"); enable.type="checkbox"; enable.checked = ySlots[i].enabled;
    const lab = document.createElement("label"); lab.textContent = `Y Axis ${i+1}`;
    enable.addEventListener("change", ()=>{ ySlots[i].enabled = enable.checked; plot(false); });
    enableWrap.append(enable, lab);

    // select
    const sel = document.createElement("select");
    const none = document.createElement("option"); none.value="-1"; none.textContent="(None)";
    sel.appendChild(none);
    numericIdx.forEach(idx=>{
      const o=document.createElement("option"); o.value=String(idx); o.textContent=headers[idx]; sel.appendChild(o);
    });
    sel.value = String(ySlots[i].colIdx);
    sel.addEventListener("change", ()=>{
      ySlots[i].colIdx = Number(sel.value);
      ySlots[i].offset = 0; // reset offset when series changes
      plot(false);
    });

    // buttons + color
    const btns = document.createElement("div"); btns.className = "btns";
    const mk = (t, title, fn)=>{ const b=document.createElement("button"); b.className="mini"; b.textContent=t; b.title=title; b.addEventListener("click", fn); return b; };
    const up   = mk("Up",   "Offset up",   ()=>{ const idx=ySlots[i].colIdx; if(idx<0) return; ySlots[i].offset += currentStep(idx); plot(false); });
    const down = mk("Down", "Offset down", ()=>{ const idx=ySlots[i].colIdx; if(idx<0) return; ySlots[i].offset -= currentStep(idx); plot(false); });
    const reset= mk("Reset","Clear offset",()=>{ ySlots[i].offset = 0; plot(false); });

    const color = document.createElement("input"); color.type="color"; color.value = ySlots[i].color || "#00aaff";
    color.style.width="44px"; color.style.height="32px"; color.style.borderRadius="8px"; color.style.border="1px solid #2a3038";
    color.addEventListener("input", ()=>{ ySlots[i].color = color.value; plot(false); });

    btns.append(up, down, reset, color);

    row.append(enableWrap, sel, btns);
    axisPanel.appendChild(row);
  }
}

// ---- plotting ----
function plot(showToasts=true){
  if (!Number.isFinite(xIdx)) { if(showToasts) toastMsg("Pick X axis (Time/RPM)."); return; }
  const traces = [];
  for (let i=0;i<ySlots.length;i++){
    const { enabled, colIdx, offset, color } = ySlots[i];
    if (!enabled || colIdx === -1) continue;
    const y = cols[colIdx].map(v => Number.isFinite(v) ? (v + offset) : v);
    traces.push({
      type:"scattergl",
      mode:"lines",
      name: headers[colIdx] + (offset ? ` (Δ=${offset.toFixed(3)})` : ""),
      x: cols[xIdx],
      y,
      line:{ width:1, color }
    });
  }
  if (!traces.length){ if(showToasts) toastMsg("Enable at least one Y axis."); return; }

  Plotly.react(chart, traces, {
    paper_bgcolor:"#0f1318",
    plot_bgcolor:"#0f1318",
    font:{ color:"#e7ecf2" },
    margin:{ l:60, r:10, t:10, b:40 },
    xaxis:{ title: headers[xIdx] || "X", gridcolor:"#1b1f25" },
    yaxis:{ gridcolor:"#1b1f25", automargin:true },
    showlegend:true,
    legend:{ orientation:"h", y:-0.2 }
  }, { displaylogo:false, responsive:true });
}

// ---- auto-select helpful Ys (first load only) ----
function autoSelectYs(){
  // try preferred keywords first
  const prefs = [/boost/i, /afr/i, /throttle|pedal/i, /load/i, /ign/i];
  const used = new Set();
  let slot = 0;

  for (const rx of prefs){
    const idx = headers.findIndex((h,i)=> rx.test(h) && i!==timeIdx && i!==rpmIdx);
    if (idx> -1 && !used.has(idx)){
      ySlots[slot].enabled = true;
      ySlots[slot].colIdx  = idx;
      ySlots[slot].color   = slot===0?"#2aa6ff": slot===1?"#ffaa2a": slot===2?"#7bdc7b": slot===3?"#ff5aa2":"#a98bff";
      used.add(idx); slot++; if (slot>=3) break;
    }
  }
  // if still empty, pick first 2 numeric columns != x
  if (slot === 0){
    let picked=0;
    for (let i=0;i<headers.length && picked<2;i++){
      if (i===timeIdx || i===rpmIdx) continue;
      const count = (cols[i]||[]).reduce((a,v)=>a+(Number.isFinite(v)?1:0),0);
      if (count>=5){ ySlots[picked].enabled=true; ySlots[picked].colIdx=i; picked++; }
    }
  }
}

// ---- session cache (no re-upload across pages) ----
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
  fileInfo.classList.remove("hidden");
  fileInfo.textContent = `Selected (cached): ${name} · ${fmtBytes(size)}`;

  try{
    const parsed = parseCSV(text);
    headers = parsed.headers; cols = parsed.cols;
    timeIdx = findTimeIndex(headers);
    rpmIdx  = findRpmIndex(headers);
    // reset slots + auto-select
    xIdx = Number.isFinite(timeIdx) ? timeIdx : NaN;
    ySlots.forEach(s=>{ s.enabled=false; s.colIdx=-1; s.offset=0; s.color="#00aaff"; });
    autoSelectYs();
    buildUI();
    chart.innerHTML="";
    toastMsg("Loaded cached CSV. Configure axes, then Generate Plot.", "ok");
    return true;
  }catch(err){
    console.warn("Failed to parse cache:", err);
    return false;
  }
}

// ---- file flow ----
csvFile.addEventListener("change", (e)=>{
  lastFile = e.target.files[0] || null;
  if (!lastFile){ fileInfo.classList.add("hidden"); return; }
  const reader = new FileReader();
  reader.onerror = ()=> toastMsg("Failed to read file.");
  reader.onload  = (ev)=>{
    const text = String(ev.target.result || "");
    cacheCSV(text, lastFile.name, lastFile.size);  // cache for other pages
    fileInfo.classList.remove("hidden");
    fileInfo.textContent = `Selected: ${lastFile.name} · ${fmtBytes(lastFile.size)}`;

    try{
      const parsed = parseCSV(text);
      headers = parsed.headers; cols = parsed.cols;
      timeIdx = findTimeIndex(headers);
      rpmIdx  = findRpmIndex(headers);
      xIdx = Number.isFinite(timeIdx) ? timeIdx : NaN;
      ySlots.forEach(s=>{ s.enabled=false; s.colIdx=-1; s.offset=0; s.color="#00aaff"; });
      autoSelectYs();
      buildUI();
      chart.innerHTML="";
      toastMsg("Parsed. Configure axes, then Generate Plot.", "ok");
    }catch(err){ toastMsg(err.message || "Parse error."); }
  };
  reader.readAsText(lastFile);
});

plotBtn.addEventListener("click", ()=> plot(true));

clearBtn.addEventListener("click", ()=>{
  // keep cache (so you can still switch tabs without re-upload); clear only UI state
  ySlots.forEach(s=>{ s.enabled=false; s.colIdx=-1; s.offset=0; s.color="#00aaff"; });
  axisPanel.innerHTML=""; chart.innerHTML="";
  fileInfo.classList.add("hidden");
  headers=[]; cols=[]; timeIdx=rpmIdx=-1; xIdx=NaN;
  toastMsg("Cleared page state. Cached CSV retained.", "ok");
});

// try load from sessionStorage on first visit
document.addEventListener("DOMContentLoaded", ()=>{
  tryLoadCached();
});
