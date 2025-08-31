// Compare view: aligned 5-col UI, value-only chips with ▲▼, fixed 50% step, preserve X-range, auto-select Ys.
import { parseCSV, findTimeIndex, findRpmIndex, numericColumns } from "./parser.js";

// ============================================================================
// CURSOR HELPERS
// ============================================================================

let cursorShape = {
  type:'line', xref:'x', yref:'paper', y0:0, y1:1,
  x0:0, x1:0, line:{color:'#43B3FF', width:2, dash:'dot'}
};

function nearestIndex(arr,x){
  let lo=0, hi=arr.length-1;
  while(hi-lo>1){ 
    const m=(lo+hi)>>1; 
    if(arr[m]<x) lo=m; else hi=m; 
  }
  return (x-arr[lo] <= arr[hi]-x) ? lo : hi;
}

function addCursor(gd){ Plotly.relayout(gd, { shapes:[cursorShape] }); }

function updateCursor(gd,x,data){
  Plotly.relayout(gd, { 'shapes[0].x0':x, 'shapes[0].x1':x });
  const i = nearestIndex(data.time, x);
  gd.dispatchEvent(new CustomEvent('cursor-update', { detail:{ index:i, t:data.time[i] } }));
}

function wireCursor(gd,data){
  // tap/click to snap
  gd.on('plotly_click', ev => updateCursor(gd, ev.points[0].x, data));

  // drag anywhere to move
  const rect = gd.querySelector('.plotly .nsewdrag');
  if(!rect) return;
  rect.style.touchAction = 'none'; // stop pinch-zoom
  const move = e => {
    const p = e.touches ? e.touches[0] : e;
    const bb = gd.getBoundingClientRect();
    const xpx = p.clientX - bb.left;
    const x = gd._fullLayout.xaxis.p2d(xpx - gd._fullLayout.margin.l);
    updateCursor(gd, x, data);
  };
  rect.addEventListener('pointerdown', e => { move(e); rect.setPointerCapture(e.pointerId); });
  rect.addEventListener('pointermove', move);
}

// ============================================================================
// THEME HELPERS
// ============================================================================

function applyTheme(isLight, targets){
  document.documentElement.classList.toggle('light', isLight);
  const template = isLight ? 'plotly_white' : 'plotly_dark';
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--plot-paper').trim();
  const plot  = getComputedStyle(document.documentElement).getPropertyValue('--plot-bg').trim();
  targets.forEach(gd => {
    if (!gd) return;
    Plotly.relayout(gd, { template, paper_bgcolor: paper, plot_bgcolor: plot });
  });
}

// Expose globally for theme toggling
window.applyTheme = applyTheme;

// ============================================================================
// ASCII Dot-Matrix Animation
// ============================================================================
const el = document.querySelector('.ascii-loading .matrix');
const ROWS = 8, COLS = 8;
const SCALE = [' ', '.', ':', '*', 'o', 'O', '#', '@'];
const CELL_W = 2;
const SPEED = 2.2;
const FREQ = 1.2;
const GLOW = 0.85;

function render(t) {
  let out = '';
  const cx = (COLS - 1) / 2, cy = (ROWS - 1) / 2;

  for (let y = 0; y < ROWS; y++) {
    let line = '';
    for (let x = 0; x < COLS; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const phase = dist * FREQ - t * SPEED;
      let b = (Math.sin(phase) * 0.5 + 0.5) ** 1.35;
      b = Math.min(1, Math.max(0, b * GLOW));
      const idx = Math.min(SCALE.length - 1, Math.floor(b * (SCALE.length - 1)));
      const ch = SCALE[idx];
      line += ch + ' '.repeat(CELL_W - 1);
    }
    out += line + '\n';
  }
  return out;
}

let start;
function tick(now) {
  if (!start) start = now;
  const t = (now - start) / 1000;
  if (el) el.textContent = render(t);
  requestAnimationFrame(tick);
}

// Start ASCII animation when page loads
document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(tick);
});

const $ = (id) => document.getElementById(id);

const csvFile  = $("csvFile");
const fileInfo = $("fileInfo");
const axisPanel= $("axisPanel");
const genBtn = $("genBtnCompare");
const clearBtn = $("clearBtn");
const chart    = $("chart");
const toast    = $("toast");

const loadingScreen = $("loadingScreen");

let headers=[], cols=[], timeIdx=-1, rpmIdx=-1, xIdx=NaN, snapIndex=null;
let xMin = 0, xMax = 0;
let lastIdx = null;
let parsedData = null; // Store the parsed data with series and raw

const SLOT_COUNT = 5;
const ySlots = Array.from({length: SLOT_COUNT}, () => ({
  enabled:false, colIdx:-1, color:"#00aaff", scale:1, ui:{}
}));
const autoY = true;

/* utils */
const debounce = (fn, ms=60) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
function logStepFactor(){
  const dlog = 0.10;
  return Math.pow(10, dlog);
}
function toastMsg(msg, type="error"){ 
  toast.textContent=msg; toast.style.display="block";
  toast.style.background=(type==="error")?"#3b0b0b":"#0b3b18"; 
  toast.style.borderColor=(type==="error")?"#742020":"#1a6a36";
  clearTimeout(toastMsg._t); toastMsg._t=setTimeout(()=>toast.style.display="none",2600); 
}
function fmtBytes(n){ 
  const u=["B","KB","MB","GB"]; let i=0; 
  while(n>=1024&&i<u.length-1){n/=1024;i++;} 
  return `${n.toFixed(1)} ${u[i]}`; 
}

// Loading screen functions
let loadingTimeout = null;

function showLoading() {
  loadingScreen.classList.remove("hidden");
  
  if (loadingTimeout) clearTimeout(loadingTimeout);
  loadingTimeout = setTimeout(() => {
    hideLoading();
    toastMsg("Processing timeout. Please try again.", "error");
  }, 10000);
}

function hideLoading() {
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }
  loadingScreen.classList.add("hidden");
}

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
  const pad = Math.max((mx - mn) * 0.05, 1e-6);
  Plotly.relayout(chart, { "yaxis.autorange": false, "yaxis.range": [mn - pad, mx + pad] });
}

function updateScaleBox(i){
  const s = ySlots[i];
  if (s?.ui?.val) {
    if (s.ui.val.tagName === 'INPUT') {
      s.ui.val.value = (s.scale ?? 1).toFixed(3);
    } else {
      s.ui.val.textContent = (s.scale ?? 1).toFixed(3);
    }
  }
}

function syncAllScaleBoxes(){ 
  ySlots.forEach((_,i)=>updateScaleBox(i)); 
}

function showPointInfoAt(idx){
  const x = chart.data?.[0]?.x; if (!x || idx==null) return;
  idx = Math.max(0, Math.min(x.length-1, idx)); lastIdx = idx;
  const t = +x[idx];
  
  // Get computed CSS values for theme colors
  const computedStyle = getComputedStyle(document.documentElement);
  const cardBg = computedStyle.getPropertyValue('--card-bg').trim();
  const lineColor = computedStyle.getPropertyValue('--line').trim();
  const fgColor = computedStyle.getPropertyValue('--fg').trim();
  const accent2Color = computedStyle.getPropertyValue('--accent-2').trim();
  
  const rows = (chart.data||[])
    .filter(tr => tr && tr.visible !== "legendonly")
    .map(tr=>{
      const c = tr.line?.color || "#7f7f7f";
      // Prefer RAW from customdata if available; fallback to y
      const rawVal = Array.isArray(tr.customdata) && Number.isFinite(tr.customdata[idx])
        ? tr.customdata[idx]
        : (Number.isFinite(tr.y?.[idx]) ? tr.y[idx] : NaN);
      const y = Number.isFinite(rawVal) ? rawVal.toFixed(3) : "—";
      return `${tr.name}<br>${y}`;
    }).join("<br><br>");
  Plotly.relayout(chart, {
    shapes:[{type:"line", x0:t, x1:t, y0:0, y1:1, xref:"x", yref:"paper",
             line:{color:accent2Color, width:1, dash:"dot"}}],
    annotations:[{
      xref:"paper", yref:"paper", x:1, y:1, xanchor:"right", yanchor:"top",
      text:`Time<br>${t.toFixed(3)} s<br><br>${rows}`,
      bgcolor:cardBg, bordercolor:lineColor, borderwidth:1, borderpad:8,
      font:{color:fgColor, size:11}, align:"left", showarrow:false, captureevents:false
    }]
  });
  
  // Update the readouts in the control panel
  updateReadoutsAt(idx);
}

function bindChartHandlers(){
  // Remove existing listeners
  chart.removeAllListeners?.("plotly_click");
  chart.removeAllListeners?.("plotly_relayout");
  
  // Single click handler that works for all clicks
  chart.on("plotly_click", (ev) => {
    console.log("Plot clicked:", ev);
    
    let targetIdx = null;
    
    // If click is on a data point, use that index
    if (ev?.points?.length > 0) {
      targetIdx = ev.points[0].pointIndex;
    }
    // If click is anywhere else on the plot, find nearest point
    else if (ev?.xval !== undefined) {
      const x = chart.data?.[0]?.x;
      if (x?.length) {
        const targetX = ev.xval;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < x.length; i++) {
          const dist = Math.abs(x[i] - targetX);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
          }
        }
        targetIdx = bestIdx;
      }
    }
    
    if (Number.isFinite(targetIdx)) {
      showPointInfoAt(targetIdx);
    }
  });
  
  // Handle relayout events for auto-rescaling
  chart.on("plotly_relayout", (ev) => {
    if (ev && ( "xaxis.range[0]" in ev || "xaxis.range" in ev || "xaxis.autorange" in ev || "xaxis.range[1]" in ev )) {
      rescaleDebounced();
    }
  });
}

const rescaleDebounced = debounce(() => rescaleYToWindow(), 80);

/* UI */
function buildUI(){
  axisPanel.innerHTML = "";

  // X row
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

  // X options: Time / RPM
  const addX=(idx,label)=>{ const o=document.createElement("option"); o.value=String(idx); o.textContent=label; xSel.appendChild(o); };
  let hasX=false;
  if(timeIdx!==-1){ addX(timeIdx, `${headers[timeIdx]} (Time)`); hasX=true; }
  if(rpmIdx !==-1){ addX(rpmIdx,  `${headers[rpmIdx]} (Engine RPM)`); hasX=true; }
  if(!hasX){ const o=document.createElement("option"); o.textContent="No Time or RPM column"; o.disabled=true; xSel.appendChild(o); genBtn.disabled=true; }
  else { genBtn.disabled=false; xSel.value=String(Number.isFinite(xIdx)?xIdx:Number(xSel.options[0].value)); xIdx=Number(xSel.value); }
  xSel.addEventListener("change", ()=>{ xIdx=Number(xSel.value); updateReadouts(); });

  // Y rows
  const idxs=numericColumns(headers,cols,5);
  for(let i=0;i<SLOT_COUNT;i++){
    const row=document.createElement("div"); row.className="slot";

    // col1: checkbox + label
    const left=document.createElement("div"); left.style.display="flex"; left.style.alignItems="center"; left.style.gap="8px";
    const tick=document.createElement("input"); tick.type="checkbox"; tick.checked=ySlots[i].enabled;
    const lab=document.createElement("label"); lab.textContent=`Y Axis ${i+1}`; left.append(tick,lab);

    // col2: color picker
    const color=document.createElement("input"); color.type="color"; color.value=ySlots[i].color||"#00aaff";
    color.style.width="44px"; color.style.height="32px"; color.style.borderRadius="8px"; color.style.border="1px solid #2a3038";

    // col3: column selector
    const sel=document.createElement("select"); const none=document.createElement("option"); none.value="-1"; none.textContent="(None)"; sel.appendChild(none);
    idxs.forEach(ix=>{ const o=document.createElement("option"); o.value=String(ix); o.textContent=headers[ix]; sel.appendChild(o); });
    sel.value=String(ySlots[i].colIdx);

    // col4: scale value display
    const scaleVal = document.createElement("input");
    scaleVal.type = "number";
    scaleVal.className = "scale-val";
    scaleVal.value = ySlots[i].scale.toFixed(3);
    scaleVal.step = "0.001";
    scaleVal.min = "0.001";
    scaleVal.max = "1000";
    ySlots[i].ui.val = scaleVal;
    
    // col5: value display + arrows
    const val=document.createElement("span"); val.className="valbox"; val.textContent=""; ySlots[i].valEl=val;
    const up=document.createElement("div"); up.className="arrow"; up.textContent="▲";
    const dn=document.createElement("div"); dn.className="arrow"; dn.textContent="▼";
    const valwrap=document.createElement("div"); valwrap.className="valwrap"; valwrap.append(val,up,dn);

    // col5: reset button
    const btns=document.createElement("div"); btns.className="btns"; 
    const reset=document.createElement("button"); reset.className="mini btn"; reset.textContent="Reset"; 
    btns.append(reset);

    // events
    tick.addEventListener("change", ()=>{ ySlots[i].enabled=tick.checked; plot(false,true); });
    color.addEventListener("input", ()=>{ ySlots[i].color=color.value; plot(false,true); });
    sel.addEventListener("change", ()=>{ ySlots[i].colIdx=Number(sel.value); ySlots[i].scale=1.0; plot(false,true); });
    scaleVal.addEventListener("input", ()=>{ 
      const newScale = parseFloat(scaleVal.value);
      if (Number.isFinite(newScale) && newScale > 0) {
        ySlots[i].scale = newScale;
        plot(false,true);
        if (Number.isFinite(lastIdx)) showPointInfoAt(lastIdx);
      }
    });
    up.addEventListener("click", ()=>{ 
      const ix=ySlots[i].colIdx; if(ix<0) return; 
      ySlots[i].scale *= logStepFactor(); 
      updateScaleBox(i); 
      plot(false,true); 
      if (Number.isFinite(lastIdx)) showPointInfoAt(lastIdx);
    });
    dn.addEventListener("click", ()=>{ 
      const ix=ySlots[i].colIdx; if(ix<0) return; 
      ySlots[i].scale /= logStepFactor(); 
      updateScaleBox(i); 
      plot(false,true); 
      if (Number.isFinite(lastIdx)) showPointInfoAt(lastIdx);
    });
    reset.addEventListener("click", ()=>{ 
      ySlots[i].scale = 1; 
      updateScaleBox(i); 
      plot(false,true); 
      if (Number.isFinite(lastIdx)) showPointInfoAt(lastIdx);
    });

    row.append(left,color,sel,scaleVal,valwrap,btns);
    axisPanel.appendChild(row);
  }
}

/* plotting */
function plot(showToasts=true, preserveRange=false){
  if(!Number.isFinite(xIdx)){ if(showToasts) toastMsg("Pick X axis (Time/RPM)."); return; }

  // Clear any previous title (but keep annotations/shapes for point box)
  if (chart && chart.layout) {
    Plotly.relayout(chart, { "title.text":"" });
  }

  // Keep user's current X window
  let keepRange=null;
  if(preserveRange && chart.layout?.xaxis?.range) keepRange=[...chart.layout.xaxis.range];

  const traces=[];
  
  for(let i=0;i<ySlots.length;i++){
    const s = ySlots[i];
    if(!s.enabled || s.colIdx===-1) continue;
    const param = headers[s.colIdx];
    const rawY    = parsedData ? parsedData.raw[param] : cols[s.colIdx];
    const scale   = s.scale ?? 1;
    const scaledY = rawY.map(v => Number.isFinite(v) ? (v * scale) : v);
    
    // Debug: Check if raw data exists and is different from scaled
    if (parsedData && parsedData.raw && parsedData.raw[param]) {
      console.log(`Param: ${param}, Raw[0]: ${parsedData.raw[param][0]}, Scaled[0]: ${scaledY[0]}, Scale: ${scale}`);
    }
    

    const label = headers[s.colIdx];
    
    const typ = cols[s.colIdx].length > 5000 ? "scattergl" : "scatter";
    
    traces.push({
      type: typ,
      mode: "lines",
      x: parsedData ? parsedData.time : cols[xIdx],
      y: scaledY,
      customdata: rawY,
      name: label,
      line: { width: 1, color: s.color },
      hovertemplate: '%{fullData.name}<br>' + 't=%{x:.3f}s<br>' + 'raw=%{customdata}<extra></extra>'
    });
  }
  if(!traces.length){ if(showToasts) toastMsg("Enable at least one Y axis."); return; }

  // Ensure chart element exists
  if (!chart) {
    console.error("Chart element not found");
    return;
  }

  // Get computed CSS values for theme colors
  const computedStyle = getComputedStyle(document.documentElement);
  const cardBg = computedStyle.getPropertyValue('--card-bg').trim();
  const lineColor = computedStyle.getPropertyValue('--line').trim();
  const fgColor = computedStyle.getPropertyValue('--fg').trim();

  Plotly.react(chart,traces,{
    paper_bgcolor:cardBg, plot_bgcolor:cardBg, font:{color:fgColor, size:14},
    margin:{l:60,r:10,t:60,b:44},
    xaxis:{
      title: headers[xIdx] || "Time (s)",
      gridcolor:lineColor,
      color: fgColor,
      titlefont: {color: fgColor},
      tickfont: {color: fgColor}
    },
    yaxis:{
      gridcolor:lineColor, 
      automargin:true,
      color: fgColor,
      titlefont: {color: fgColor},
      tickfont: {color: fgColor}
    },
    showlegend:true, 
    legend:{
      orientation:"h", 
      y:-0.2,
      font: {color: fgColor},
      bgcolor: cardBg,
      bordercolor: lineColor
    },
    hovermode:false,
    hoverdistance:-1,
    spikedistance:-1,
    clickmode:"event",
    dragmode:false,
    modebar: {
      remove: ["zoom2d", "pan2d", "select2d", "lasso2d", "zoomIn2d", "zoomOut2d", "autoScale2d", "resetScale2d"]
    }
  }, {
    displaylogo:false,
    responsive:true,
    scrollZoom:false,
    doubleClick:false,
    staticPlot:false,
    modeBarButtonsToRemove:[
      "zoom2d","pan2d","select2d","lasso2d","zoomIn2d","zoomOut2d","autoScale2d","resetScale2d"
    ]
  }).then(()=>{
    bindChartHandlers();
    const x = traces[0]?.x || [];
    const mid = Math.floor(x.length/2);
    const targetIdx = lastIdx ?? mid;
    showPointInfoAt(targetIdx);
    updateReadoutsAt(targetIdx);
    syncAllScaleBoxes();
    
    // Add cursor functionality
    if (parsedData) {
      addCursor(chart);
      wireCursor(chart, parsedData);
    }
    
    // Ensure chart has proper styling
    chart.style.position = "relative";
    chart.style.cursor = "crosshair";
    
    // Add container click handler as fallback
    const chartContainer = chart.parentElement;
    if (chartContainer) {
      chartContainer.style.position = "relative";
      chartContainer.style.cursor = "crosshair";
      
      // Remove existing click handler
      chartContainer.removeEventListener("click", handleContainerClick);
      
      // Add new click handler
      chartContainer.addEventListener("click", handleContainerClick);
    }
  });

  updateReadouts();
  if (autoY) rescaleYToWindow(chart.layout?.xaxis?.range || null);
}

// Container click handler function
function handleContainerClick(event) {
  // Only handle clicks on the chart area, not on controls
  if (event.target.closest('.plot-frame') || event.target.closest('.plot')) {
    const rect = chart.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Convert screen coordinates to data coordinates
    const xData = chart.layout.xaxis.range[0] + (x / rect.width) * (chart.layout.xaxis.range[1] - chart.layout.xaxis.range[0]);
    
    // Find nearest data point
    const dataX = chart.data[0]?.x;
    if (dataX && dataX.length) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < dataX.length; i++) {
        const dist = Math.abs(dataX[i] - xData);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      showPointInfoAt(bestIdx);
    }
  }
}

/* readouts */
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
  updateReadoutsAt(idx);
}

function updateReadoutsAt(idx){
  if(!Number.isFinite(xIdx) || !Number.isFinite(idx)) return;
  const xs=cols[xIdx]; if(!xs?.length) return;

  // X value
  const xVal=axisPanel.querySelector(".slot .valbox"); if(xVal) xVal.textContent = Number(xs[idx]).toFixed(3);

  // Y values
  for(let i=0;i<ySlots.length;i++){
    const s=ySlots[i]; if(!s.valEl) continue;
    if(!s.enabled || s.colIdx===-1){ s.valEl.textContent=""; continue; }
    const raw=cols[s.colIdx][idx];
    s.valEl.textContent = Number.isFinite(raw) ? raw.toFixed(3) : "";
  }
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
function cacheCSV(text,name,size){ 
  sessionStorage.setItem("csvText",text); 
  sessionStorage.setItem("csvName",name||""); 
  sessionStorage.setItem("csvSize",String(size||0)); 
}

function tryLoadCached(){
  const text=sessionStorage.getItem("csvText"); if(!text) return false;
  const name=sessionStorage.getItem("csvName")||"cached.csv"; 
  const size=Number(sessionStorage.getItem("csvSize")||0);
  fileInfo.classList.remove("hidden"); fileInfo.textContent=`Selected (cached): ${name} · ${fmtBytes(size)}`;
  try{
    parsedData=parseCSV(text); headers=parsedData.headers; cols=parsedData.cols;
    timeIdx=parsedData.timeIdx; rpmIdx=findRpmIndex(headers);
    xIdx=Number.isFinite(timeIdx)?timeIdx:NaN;

    if (Number.isFinite(xIdx)){
      const x = cols[xIdx].filter(Number.isFinite);
      xMin = x.length ? x[0] : 0;
      xMax = x.length ? x[x.length-1] : 100;
    }
    ySlots.forEach(s=>{ s.enabled=false; s.colIdx=-1; s.scale=1; s.color="#00aaff"; s.ui={}; });
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
      
      showLoading();
      
             setTimeout(() => {
         try{
           parsedData=parseCSV(text); headers=parsedData.headers; cols=parsedData.cols;
           timeIdx=parsedData.timeIdx; rpmIdx=findRpmIndex(headers);
           xIdx=Number.isFinite(timeIdx)?timeIdx:NaN;
           if (Number.isFinite(xIdx)){
             const x = cols[xIdx].filter(Number.isFinite);
             xMin = x.length ? x[0] : 0;
             xMax = x.length ? x[x.length-1] : 100;
           }
           ySlots.forEach(s=>{ s.enabled=false; s.colIdx=-1; s.scale=1; s.color="#00aaff"; s.ui={}; });
           
           hideLoading();
           
           fileInfo.classList.remove("hidden"); fileInfo.textContent=`Selected: ${f.name} · ${fmtBytes(f.size)}`;
           autoSelectYs(); buildUI(); chart.innerHTML=""; toastMsg("Parsed. Configure axes, then Generate Plot.","ok");
           
         }catch(err){ 
           hideLoading();
           toastMsg(err.message||"Parse error."); 
         }
       }, 500);
    };
    rd.readAsText(f);
  });

  genBtn.addEventListener("click", ()=>{ plot(true,false); updateReadouts(); });
  


  // Back to top button
  const toTopBtn = document.getElementById("toTop");
  if (toTopBtn) toTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  
  clearBtn.addEventListener("click", ()=>{
    ySlots.forEach(s=>{ s.enabled=false; s.colIdx=-1; s.scale=1; s.color="#00aaff"; s.ui={}; });
    axisPanel.innerHTML=""; chart.innerHTML=""; fileInfo.classList.add("hidden");
    headers=[]; cols=[]; timeIdx=rpmIdx=-1; xIdx=NaN; snapIndex=null; parsedData=null; toastMsg("Cleared page state. Cached CSV retained.","ok");
  });
}

// ============================================================================
// DROPDOWN INTERACTIONS
// ============================================================================

function initDropdowns() {
  // Handle dropdown menu interactions
  const dropdownItems = document.querySelectorAll(".dropdown-item");
  
  dropdownItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const text = item.textContent.trim();
      
      // Handle different menu actions
      switch(text) {
        case "Open CSV File":
          document.getElementById("csvFile").click();
          break;
        case "Export Data":
          toastMsg("Export functionality coming soon!", "ok");
          break;
        case "Mega Plot":
          // Already on mega plot
          break;
        case "Multi Plot":
          window.location.href = "index.html";
          break;
        case "About":
          window.location.href = "about.html";
          break;
        case "Data Analysis":
          toastMsg("Data analysis tools coming soon!", "ok");
          break;
        case "Statistics":
          toastMsg("Statistics panel coming soon!", "ok");
          break;
        case "Performance Metrics":
          toastMsg("Performance metrics coming soon!", "ok");
          break;
        case "Documentation":
          toastMsg("Documentation coming soon!", "ok");
          break;
        default:
          console.log("Menu item clicked:", text);
      }
    });
  });
  
  // Handle navigation menu active states
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      if (!item.parentElement.classList.contains("dropdown")) {
        e.preventDefault();
        navItems.forEach(nav => nav.classList.remove("active"));
        item.classList.add("active");
      }
    });
  });
}

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

function initTheme() {
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  const themeText = document.getElementById("themeText");
  
  // Load saved theme or default to dark
  const savedTheme = localStorage.getItem("theme") || "dark";
  console.log("Initializing theme:", savedTheme);
  
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeUI(savedTheme);
  
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const newTheme = currentTheme === "light" ? "dark" : "light";
      
      console.log("Switching theme from", currentTheme, "to", newTheme);
      
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
      updateThemeUI(newTheme);
      
      // Apply theme to plots
      const isLight = newTheme === "light";
      applyTheme(isLight, [chart]);
    });
  } else {
    console.error("Theme toggle button not found!");
  }
}

// ============================================================================
// STARTUP LOADING SCREEN
// ============================================================================

function showStartupLoading() {
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.classList.remove("hidden");
  }
}

function hideStartupLoading() {
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
  }
}



document.addEventListener("DOMContentLoaded", ()=>{ 
  // Show startup loading screen
  showStartupLoading();
  
  // Hide loading screen after 3-4 seconds
  setTimeout(() => {
    hideStartupLoading();
  }, 3500);
  
  // Initialize theme system
  initTheme();
  // Init mobile drawer
  initDrawer();
  
  // Initialize dropdown interactions
  initDropdowns();
  
  // Add click handler to hide loading screen if stuck
  loadingScreen.addEventListener("click", () => {
    hideLoading();
    toastMsg("Loading cancelled.", "error");
  });
  
  // Add keyboard escape handler
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !loadingScreen.classList.contains("hidden")) {
      hideLoading();
      toastMsg("Loading cancelled.", "error");
    }
  });
  
  tryLoadCached(); 
  wireInitialEventListeners(); 
});
// Drawer init (same as app.js minimal copy)
function initDrawer(){
  const drawer = document.getElementById('drawer');
  const scrim = document.getElementById('drawerScrim');
  const edge = document.getElementById('edgeHint');
  if (!drawer || !scrim || !edge) return;
  const open = ()=>{ drawer.classList.add('open'); scrim.classList.add('show'); drawer.setAttribute('aria-hidden','false'); };
  const close = ()=>{ drawer.classList.remove('open'); scrim.classList.remove('show'); drawer.setAttribute('aria-hidden','true'); };
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') close(); });
  let startX=null, active=false;
  const start=(x)=>{ startX=x; active=true; };
  const move=(x)=>{ if(!active) return; if (x-startX>40) { open(); active=false; } };
  const end=()=>{ active=false; };
  const onTouchStart=e=>{ if (window.matchMedia('(orientation:portrait)').matches) start(e.touches[0].clientX); };
  const onTouchMove =e=>{ if (window.matchMedia('(orientation:portrait)').matches) move(e.touches[0].clientX); };
  const onMouseDown =e=>{ if (window.matchMedia('(orientation:portrait)').matches && e.clientX<14) start(e.clientX); };
  const onMouseMove =e=>{ move(e.clientX); };
  edge.addEventListener('touchstart', onTouchStart, {passive:true});
  edge.addEventListener('touchmove',  onTouchMove,  {passive:true});
  edge.addEventListener('mousedown',  onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', end);
  let dragStartX=null;
  drawer.addEventListener('touchstart', e=>{ dragStartX=e.touches[0].clientX; }, {passive:true});
  drawer.addEventListener('touchmove',  e=>{ const dx=e.touches[0].clientX-dragStartX; if (dx< -40) close(); }, {passive:true});
}



function updateThemeUI(theme) {
  const themeIcon = document.getElementById("themeIcon");
  const themeText = document.getElementById("themeText");
  
  if (theme === "light") {
    // Show moon icon for light mode (click to switch to dark)
    themeIcon.innerHTML = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>';
    themeText.textContent = "Dark";
  } else {
    // Show sun icon for dark mode (click to switch to light)
    themeIcon.innerHTML = '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>';
    themeText.textContent = "Light";
  }
}
