// Compare view: aligned 5-col UI, value-only chips with ▲▼, fixed 50% step, preserve X-range, auto-select Ys.
import { parseCSV, findTimeIndex, findRpmIndex, numericColumns } from "./parser.js";
const $ = (id) => document.getElementById(id);

const csvFile  = $("csvFile");
const fileInfo = $("fileInfo");
const axisPanel= $("axisPanel");
const plotBtn  = $("plotBtn");
const clearBtn = $("clearBtn");
const chart    = $("chart");
const toast    = $("toast");

let headers=[], cols=[], timeIdx=-1, rpmIdx=-1, xIdx=NaN, snapIndex=null;

const SLOT_COUNT = 5;
const ySlots = Array.from({length:SLOT_COUNT}, ()=>({enabled:false,colIdx:-1,scale:1.0,color:"#00aaff",valEl:null}));
const autoY = true; // Added for optional toggle

/* utils */
const debounce = (fn, ms=60) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
const SCALE_STEP = 0.10;                    // 10% up/down per click
const scaleUp   = (s) => s * (1 + SCALE_STEP);
const scaleDown = (s) => s / (1 + SCALE_STEP);   // symmetric down
function toastMsg(msg, type="error"){ toast.textContent=msg; toast.style.display="block";
  toast.style.background=(type==="error")?"#3b0b0b":"#0b3b18"; toast.style.borderColor=(type==="error")?"#742020":"#1a6a36";
  clearTimeout(toastMsg._t); toastMsg._t=setTimeout(()=>toast.style.display="none",2600); }
function fmtBytes(n){ const u=["B","KB","MB","GB"]; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++;} return `${n.toFixed(1)} ${u[i]}`; }
function seriesRange(idx){ const v=cols[idx]||[]; let mn=+Infinity,mx=-Infinity; for(let i=0;i<v.length;i++){const n=v[i]; if(Number.isFinite(n)){ if(n<mn)mn=n; if(n>mx)mx=n; }} return (mx-mn)||1; }
const currentStep=(idx)=>Math.max(seriesRange(idx)*0.50,1); // fixed 50%

function rescaleYToWindow(rangeOverride){
  const xs = cols[xIdx]; if (!xs || !xs.length) return;
  const xr = rangeOverride || (chart.layout?.xaxis?.range || null);
  if (!xr || xr.length !== 2) return;
  const [lo, hi] = xr;
  let mn = +Infinity, mx = -Infinity;

  for (let s of ySlots){
    if (!s.enabled || s.colIdx === -1) continue;
    const ys = cols[s.colIdx];
    for (let i = 0; i < xs.length; i++){
      const x = xs[i]; if (x < lo || x > hi) continue;
      const v = ys[i]; if (!Number.isFinite(v)) continue;
      const y = v * (s.scale || 1);
      if (y < mn) mn = y; if (y > mx) mx = y;
    }
  }
  if (mn === +Infinity || mx === -Infinity) return;
  const pad = Math.max((mx - mn) * 0.05, 1e-6); // 5% headroom
  Plotly.relayout(chart, { "yaxis.autorange": false, "yaxis.range": [mn - pad, mx + pad] });
}

/* UI */
function buildUI(){
  axisPanel.innerHTML = "";

  // X row: [tick+label][color-pad][select][valbox+arrows][pad]
  const xRow=document.createElement("div"); xRow.className="slot";
  const xLeft=document.createElement("div"); xLeft.style.display="flex"; xLeft.alignItems="center"; xLeft.gap="8px";
  const xTick=document.createElement("input"); xTick.type="checkbox"; xTick.checked=true; xTick.disabled=true;
  const xLab=document.createElement("label"); xLab.textContent="X Axis"; xLeft.append(xTick,xLab);
  const colorPad=document.createElement("div"); colorPad.style.width="46px";
  const xVal=document.createElement("span"); xVal.className="valbox"; xVal.textContent="";
  const xWrap=document.createElement("div"); xWrap.className="valwrap"; xWrap.append(xVal);
  const xSel=document.createElement("select"); xSel.id="xSel"; xSel.style.minWidth="340px";
  const xPad=document.createElement("div"); xPad.className="btns";
  xRow.append(xLeft,colorPad,xSel,xWrap,xPad);
  axisPanel.appendChild(xRow);

  // options: Time / RPM
  const addX=(idx,label)=>{ const o=document.createElement("option"); o.value=String(idx); o.textContent=label; xSel.appendChild(o); };
  let hasX=false;
  if(timeIdx!==-1){ addX(timeIdx, `${headers[timeIdx]} (Time)`); hasX=true; }
  if(rpmIdx !==-1){ addX(rpmIdx,  `${headers[rpmIdx]} (Engine RPM)`); hasX=true; }
  if(!hasX){ const o=document.createElement("option"); o.textContent="No Time or RPM column"; o.disabled=true; xSel.appendChild(o); plotBtn.disabled=true; }
  else { plotBtn.disabled=false; xSel.value=String(Number.isFinite(xIdx)?xIdx:Number(xSel.options[0].value)); xIdx=Number(xSel.value); }
  xSel.addEventListener("change", ()=>{ xIdx=Number(xSel.value); updateReadouts(); });

  // Y rows: [tick+label][color][select][valbox+arrows][reset]
  const idxs=numericColumns(headers,cols,5);
  for(let i=0;i<SLOT_COUNT;i++){
    const row=document.createElement("div"); row.className="slot";

    // col1
    const left=document.createElement("div"); left.style.display="flex"; left.style.alignItems="center"; left.style.gap="8px";
    const tick=document.createElement("input"); tick.type="checkbox"; tick.checked=ySlots[i].enabled;
    const lab=document.createElement("label"); lab.textContent=`Y Axis ${i+1}`; left.append(tick,lab);

    // col2
    const color=document.createElement("input"); color.type="color"; color.value=ySlots[i].color||"#00aaff";
    color.style.width="44px"; color.style.height="32px"; color.style.borderRadius="8px"; color.style.border="1px solid #2a3038";

    // col3
    const sel=document.createElement("select"); const none=document.createElement("option"); none.value="-1"; none.textContent="(None)"; sel.appendChild(none);
    idxs.forEach(ix=>{ const o=document.createElement("option"); o.value=String(ix); o.textContent=headers[ix]; sel.appendChild(o); });
    sel.value=String(ySlots[i].colIdx);

    // col4
    const val=document.createElement("span"); val.className="valbox"; val.textContent=""; ySlots[i].valEl=val;
    const up=document.createElement("div"); up.className="arrow"; up.textContent="▲";
    const dn=document.createElement("div"); dn.className="arrow"; dn.textContent="▼";
    const valwrap=document.createElement("div"); valwrap.className="valwrap"; valwrap.append(val,up,dn);

    // col5
    const btns=document.createElement("div"); btns.className="btns"; const reset=document.createElement("button"); reset.className="mini btn"; reset.textContent="Reset"; btns.append(reset);

    // events
    tick.addEventListener("change", ()=>{ ySlots[i].enabled=tick.checked; plot(false,true); });
    color.addEventListener("input", ()=>{ ySlots[i].color=color.value; plot(false,true); });
    sel.addEventListener("change", ()=>{ ySlots[i].colIdx=Number(sel.value); ySlots[i].scale=1.0; plot(false,true); });
    up.addEventListener("click", ()=>{ const ix=ySlots[i].colIdx; if(ix<0) return; ySlots[i].scale=scaleUp(ySlots[i].scale || 1); plot(false,true); });
    dn.addEventListener("click", ()=>{ const ix=ySlots[i].colIdx; if(ix<0) return; ySlots[i].scale=scaleDown(ySlots[i].scale || 1); plot(false,true); });
    reset.addEventListener("click", ()=>{ ySlots[i].scale=1.0; plot(false,true); });

    row.append(left,color,sel,valwrap,btns);
    axisPanel.appendChild(row);
  }
}

/* plotting */
function plot(showToasts=true, preserveRange=false){
  if(!Number.isFinite(xIdx)){ if(showToasts) toastMsg("Pick X axis (Time/RPM)."); return; }

  // keep users current X window
  let keepRange=null;
  if(preserveRange && chart.layout?.xaxis?.range) keepRange=[...chart.layout.xaxis.range];

  const traces=[];
  for(let i=0;i<ySlots.length;i++){
    const s = ySlots[i];
    if(!s.enabled || s.colIdx===-1) continue;
    const rawY    = cols[s.colIdx];                       // original CSV
    const scale   = s.scale ?? 1;
    const scaledY = rawY.map(v => Number.isFinite(v) ? v * scale : v);
    const label = headers[s.colIdx] + (Math.abs(scale-1)>1e-6 ? ` (×${scale.toFixed(3)})` : "");
    traces.push({
      type: "scattergl",
      mode: "lines+markers",
      x: cols[xIdx],
      y: scaledY,                 // visual scaling only
      customdata: rawY,           // raw numbers for hover
      name: label,
      line: { width: 1, color: s.color },
      marker: { size: 5 },
      hovertemplate: `%{x:.6g}<br>%{customdata:.3f}<extra>${headers[s.colIdx]}</extra>`
    });
  }
  if(!traces.length){ if(showToasts) toastMsg("Enable at least one Y axis."); return; }

  Plotly.react(chart,traces,{
    paper_bgcolor:"#0f1318", plot_bgcolor:"#0f1318", font:{color:"#e7ecf2", size:14},
    margin:{l:60,r:10,t:10,b:44},
    xaxis:{title:headers[xIdx]||"X", gridcolor:"#1b1f25", rangeslider:{visible:true,bgcolor:"#10161e"}, type:"linear", range: keepRange||undefined},
    yaxis:{gridcolor:"#1b1f25", automargin:true},
    hovermode:"x unified", showlegend:true, legend:{orientation:"h", y:-0.2}
  }, {displaylogo:false, responsive:true});

  if(keepRange) Plotly.relayout(chart, {"xaxis.range": keepRange});
  updateReadouts();
  // auto-fit Y to current X window
  if (autoY) rescaleYToWindow(chart.layout?.xaxis?.range || null);
}

/* readouts = numbers only */
function nearestIndexByX(xTarget){
  const xs=cols[xIdx]; if(!xs?.length) return null;
  let bestI=0,bestD=Infinity; for(let i=0;i<xs.length;i++){ const d=Math.abs(xs[i]-xTarget); if(d<bestD){bestD=d; bestI=i;} }
  return bestI;
}
function updateReadouts(){
  if(!Number.isFinite(xIdx)) return;
  const xs=cols[xIdx]; if(!xs?.length) return;
  let idx=snapIndex??(xs.length-1);
  const r=chart.layout?.xaxis?.range; if(r){ const [lo,hi]=r; if(xs[idx]<lo) idx=nearestIndexByX(lo); else if(xs[idx]>hi) idx=nearestIndexByX(hi); }
  snapIndex=idx;

  // X value (with label)
  const xVal=axisPanel.querySelector(".slot .valbox"); if(xVal) xVal.textContent = Number(xs[idx]).toFixed(3);

  // Y value chips (with labels)
  for(let i=0;i<ySlots.length;i++){
    const s=ySlots[i]; if(!s.valEl) continue;
    if(!s.enabled || s.colIdx===-1){ s.valEl.textContent=""; continue; }
    const raw=cols[s.colIdx][idx];              // RAW
    s.valEl.textContent = Number.isFinite(raw) ? raw.toFixed(3) : "";
  }
}
const rescaleDebounced = debounce(() => rescaleYToWindow(), 80);
function wireChartEvents(){
  chart.on("plotly_click",(ev)=>{
    if(!ev?.points?.length) return;
    // snap by nearest x
    let best=ev.points[0], bestD=Math.abs(ev.points[0].x-ev.event.x);
    for(const p of ev.points){const d=Math.abs(p.x-ev.event.x); if(d<bestD){bestD=d; best=p;}};;
    snapIndex=best.pointNumber; updateReadouts();
  });
  chart.on("plotly_relayout", (ev) => {
    // Only care about X changes
    if (ev && ( "xaxis.range[0]" in ev || "xaxis.range" in ev || "xaxis.autorange" in ev || "xaxis.range[1]" in ev )) {
      rescaleDebounced();
    }
  });
}

/* auto-select */
function autoSelectYs(){
  const prefs=[/boost/i,/afr/i,/throttle|pedal/i,/load/i,/ign/i];
  const used=new Set(); let slot=0;
  for(const rx of prefs){
    const ix=headers.findIndex((h,i)=>rx.test(h)&&i!==timeIdx&&i!==rpmIdx);
    if(ix>-1 && !used.has(ix)){ ySlots[slot].enabled=true; ySlots[slot].colIdx=ix;
      ySlots[slot].color=slot===0?"#2aa6ff":slot===1?"#ffaa2a":slot===2?"#7bdc7b":slot===3?"#ff5aa2":"#a98bff";
      used.add(ix); slot++; if(slot>=3) break; }
  }
}

/* cache/load */
function cacheCSV(text,name,size){ sessionStorage.setItem("csvText",text); sessionStorage.setItem("csvName",name||""); sessionStorage.setItem("csvSize",String(size||0)); }
function tryLoadCached(){
  const text=sessionStorage.getItem("csvText"); if(!text) return false;
  const name=sessionStorage.getItem("csvName")||"cached.csv"; const size=Number(sessionStorage.getItem("csvSize")||0);
  fileInfo.classList.remove("hidden"); fileInfo.textContent=`Selected (cached): ${name} · ${fmtBytes(size)}`;
  try{
    const parsed=parseCSV(text); headers=parsed.headers; cols=parsed.cols;
    timeIdx=findTimeIndex(headers); rpmIdx=findRpmIndex(headers);
    xIdx=Number.isFinite(timeIdx)?timeIdx:NaN;
    ySlots.forEach(s=>{ s.enabled=false; s.colIdx=-1; s.scale=1.0; s.color="#00aaff"; s.valEl=null; });
    autoSelectYs(); buildUI(); chart.innerHTML=""; toastMsg("Loaded cached CSV. Configure axes, then Generate Plot.","ok");
    return true;
  }catch(e){ console.warn("cache parse fail",e); return false; }
}

/* file flow */
function wireInitialEventListeners(){
  csvFile.addEventListener("change",(e)=>{
    const f=e.target.files[0]||null; if(!f){ fileInfo.classList.add("hidden"); return; }
    const rd=new FileReader();
    rd.onerror=()=>toastMsg("Failed to read file.");
    rd.onload=(ev)=>{
      const text=String(ev.target.result||""); cacheCSV(text,f.name,f.size);
      fileInfo.classList.remove("hidden"); fileInfo.textContent=`Selected: ${f.name} · ${fmtBytes(f.size)}`;
      try{
        const parsed=parseCSV(text); headers=parsed.headers; cols=parsed.cols;
        timeIdx=findTimeIndex(headers); rpmIdx=findRpmIndex(headers);
        xIdx=Number.isFinite(timeIdx)?timeIdx:NaN;
        ySlots.forEach(s=>{ s.enabled=false; s.colIdx=-1; s.scale=1.0; s.color="#00aaff"; s.valEl=null; });
        autoSelectYs(); buildUI(); chart.innerHTML=""; toastMsg("Parsed. Configure axes, then Generate Plot.","ok");
      }catch(err){ toastMsg(err.message||"Parse error."); }
    };
    rd.readAsText(f);
  });

  plotBtn.addEventListener("click", ()=>{ plot(true,false); wireChartEvents(); updateReadouts(); });
  clearBtn.addEventListener("click", ()=>{
    ySlots.forEach(s=>{ s.enabled=false; s.colIdx=-1; s.scale=1.0; s.color="#00aaff"; s.valEl=null; });
    axisPanel.innerHTML=""; chart.innerHTML=""; fileInfo.classList.add("hidden");
    headers=[]; cols=[]; timeIdx=rpmIdx=-1; xIdx=NaN; snapIndex=null; toastMsg("Cleared page state. Cached CSV retained.","ok");
  });
}

document.addEventListener("DOMContentLoaded", ()=>{ tryLoadCached(); wireInitialEventListeners(); });
