import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { parseCSV, findTimeIndex, findRpmIndex, numericColumns } from "./parser.js";
import { downsampleLTTB, calculateOptimalSampleSize, shouldDownsample } from "./modules/downsample.js";

function openShiftLabModal(){
  if (shiftLabModal) {
    shiftLabModal.classList.remove("hidden");
    runShiftLab();
  }
}

function closeShiftLabModal(){
  if (shiftLabModal) shiftLabModal.classList.add("hidden");
}

function openMetadataModal(){
  if (metadataModal) {
    updateMetaSummary();
    metadataModal.classList.remove("hidden");
  }
}

function closeMetadataModal(){
  if (metadataModal) metadataModal.classList.add("hidden");
}
// Compare view: aligned 5-col UI, value-only chips with ▲▼, fixed 50% step, preserve X-range, auto-select Ys.

// Classic loader (startup + runtime)
const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));
const classicLoaderState = { stop:false, req:null };
function renderClassicMatrix(t){
  const el = document.getElementById("classicMatrix");
  if (!el) return;
  const ROWS=8, COLS=8, SCALE=[' ','.',':','*','o','O','#','@'], CELL_W=2, SPEED=2.2, FREQ=1.2, GLOW=0.85;
  let out="";
  const cx=(COLS-1)/2, cy=(ROWS-1)/2;
  for(let y=0;y<ROWS;y++){
    let line="";
    for(let x=0;x<COLS;x++){
      const dx=x-cx, dy=y-cy;
      const dist=Math.hypot(dx,dy);
      const phase=dist*FREQ - t*SPEED;
      let b=(Math.sin(phase)*0.5+0.5)**1.35;
      b=Math.min(1, Math.max(0,b*GLOW));
      const idx=Math.min(SCALE.length-1, Math.floor(b*(SCALE.length-1)));
      const ch=SCALE[idx];
      line += ch + ' '.repeat(CELL_W-1);
    }
    out += line + '\n';
  }
  el.textContent = out;
}
function tickClassic(startTs){
  if (classicLoaderState.stop) return;
  const ts = performance.now();
  const t = (ts - startTs)/1000;
  renderClassicMatrix(t);
  classicLoaderState.req = requestAnimationFrame(()=>tickClassic(startTs));
}
function startClassicLoader(){
  const classic = document.getElementById("classicLoader");
  if (classic) classic.classList.remove("hidden");
  classicLoaderState.stop = false;
  if (classicLoaderState.req) cancelAnimationFrame(classicLoaderState.req);
  const now = performance.now();
  classicLoaderState.req = requestAnimationFrame(()=>tickClassic(now));
}
function stopClassicLoader(){
  classicLoaderState.stop = true;
  if (classicLoaderState.req) cancelAnimationFrame(classicLoaderState.req);
  classicLoaderState.req = null;
}

// Supabase client (upload-only; no reads)
const SUPABASE_URL = window.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{ autoRefreshToken:false, persistSession:false } })
  : null;
let cachedIp = null;
async function getClientIp(){
  if (cachedIp) return cachedIp;
  try{
    const res = await fetch("https://api.ipify.org?format=json");
    if (res.ok){
      const data = await res.json();
      cachedIp = data?.ip || "";
    }
  }catch(_e){
    cachedIp = "";
  }
  return cachedIp || "";
}

async function logSession({ remark="", fileName="", size=0, page="compare" }){
  if (!supabase) return;
  const ip = await getClientIp();
  const ua = navigator.userAgent || "";
  await supabase.from("session_logs").insert({
    remark,
    file_name: fileName,
    size: size || 0,
    page,
    user_agent: ua,
    ip: ip || null,
    logged_at: new Date().toISOString()
  });
}

function makeUploadPath(name){
  const safeName = (name || "log.txt").replace(/[^a-zA-Z0-9._-]/g,"_");
  const uuid = (crypto.randomUUID?.() || Math.random().toString(16).slice(2));
  return `logs/${Date.now()}-${uuid}-${safeName}`;
}

async function uploadLogToSupabase(text, name, size, remark, source="compare"){
  if (!supabase) return;
  const safeName = (remark || name || "log").replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = safeName.endsWith(".csv") ? safeName : safeName + ".csv";
  const path = `logs/${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}-${fileName}`;
  const blob = new Blob([text], { type:"text/plain" });
  const { error: storageError } = await supabase.storage.from("logs").upload(path, blob, { upsert:false });
  if (storageError) {
    console.warn("Supabase storage upload failed", storageError);
    toastMsg("Cloud upload failed (storage).", "error");
    return;
  }
  const { error: metaError } = await supabase.from("log_uploads").insert({
    remark: remark || "",
    path,
    name: fileName,
    size: size || text?.length || 0,
    source,
    uploaded_at: new Date().toISOString()
  });
  if (metaError) {
    console.warn("Supabase metadata insert failed", metaError);
    toastMsg("Cloud upload saved file; metadata failed.", "error");
    return;
  }
  logSession({ remark, fileName: fileName, size, page:"compare" }).catch(()=>{});
  toastMsg("Uploaded to cloud.", "ok");
}

// ============================================================================
// Cursor helpers – dotted blue line, tap-to-snap + drag-to-scroll
// ============================================================================

let cursorShape = {
  type:'line', xref:'x', yref:'paper', y0:0, y1:1,
  x0:0, x1:0, line:{color:'#43B3FF', width:2, dash:'dot'}
};

function nearestIndex(arr,x){
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  let lo=0, hi=arr.length-1;
  while(hi-lo>1){ const m=(lo+hi)>>1; if(arr[m]<x) lo=m; else hi=m; }
  return (x-arr[lo] <= arr[hi]-x) ? lo : hi;
}

function addCursor(gd){ Plotly.relayout(gd, { shapes:[cursorShape] }); }

function updateCursor(gd,x,data){
  Plotly.relayout(gd, { 'shapes[0].x0':x, 'shapes[0].x1':x });
  const i = nearestIndex(data.time, x);
  gd.dispatchEvent(new CustomEvent('cursor-update', { detail:{ index:i, t:data.time[i] } }));
}

function wireCursor(gd, data){
  let dragging = false;
  let lastX = null;        // data-space x under the finger
  let suppressClick = false;

  // remove any old handlers
  gd.removeAllListeners?.('plotly_click');

  // ignore the synthetic click after a drag
  gd.on('plotly_click', ev => {
    if (suppressClick) return;                       // <- stop post-drag click
    const x = ev?.points?.[0]?.x;
    if (Number.isFinite(x)) {
      const i = nearestIndex(data.time, x);
      showPointInfoAt(i);
      lastX = x;
    }
  });

  const layer = gd.querySelector('.plotly .nsewdrag');
  if (!layer) return;

  // hard-disable browser scroll/zoom gestures over the plot
  layer.style.touchAction = 'none';
  (gd.parentElement || gd).style.overscrollBehavior = 'contain';

  const f = () => gd._fullLayout;
  const clamp = (x) => {
    const xs = data.time;
    if (!xs?.length) return x;
    if (x <= xs[0]) return xs[0];
    if (x >= xs[xs.length-1]) return xs[xs.length-1];
    return x;
  };

  const move = (e) => {
    // must be non-passive to actually stop scroll on iOS
    e.preventDefault();
    e.stopPropagation();
    const p = e.touches ? e.touches[0] : e;
    const bb = gd.getBoundingClientRect();
    const fl = f(); if (!fl || !fl.xaxis || !fl.margin) return;
    const xpx = p.clientX - bb.left - fl.margin.l;   // px inside plot area
    const x   = clamp(fl.xaxis.p2d(xpx));           // px -> data, clamped
    lastX = x;
    const i = nearestIndex(data.time, x);
    showPointInfoAt(i);                              // updates dotted line + box
  };

  const onDown = (e) => {
    dragging = true;
    suppressClick = true;
    layer.setPointerCapture?.(e.pointerId);
    move(e);
  };
  const onUp = (e) => {
    // keep the line at the last position (don’t jump)
    if (lastX != null) {
      const i = nearestIndex(data.time, lastX);
      showPointInfoAt(i);
    }
    dragging = false;
    // allow clicks again on next tick
    setTimeout(() => { suppressClick = false; }, 0);
  };
  const onCancel = () => { dragging = false; /* keep lastX; don’t reset */ };

  // Pointer events
  layer.addEventListener('pointerdown', onDown,   { passive:false });
  layer.addEventListener('pointermove',  (e) => { if (dragging) move(e); }, { passive:false });
  layer.addEventListener('pointerup',    onUp,    { passive:false });
  layer.addEventListener('pointercancel',onCancel,{ passive:false });

  // iOS fallback
  layer.addEventListener('touchstart', onDown,   { passive:false });
  layer.addEventListener('touchmove',  (e)=>{ if (dragging) move(e); }, { passive:false });
  layer.addEventListener('touchend',   onUp,     { passive:false });
}

const $ = (id) => document.getElementById(id);

const csvFile  = $("csvFile");
const fileInfo = $("fileInfo");
const axisPanel= $("axisPanel");
const genBtn = $("genBtnCompare");
const clearBtn = $("clearBtn");
const chart    = $("chart");
const toast    = $("toast");

const loadingScreen = $("loadingScreen");
const scaleHelpBtn = $("scaleHelpBtn");
const scaleHelpModal = $("scaleHelpModal");
const scaleHelpClose = $("scaleHelpClose");
const autoScaleBtn = $("autoScaleBtn");
const changelogBtn = $("changelogBtn");
const changelogModal = $("changelogModal");
const changelogClose = $("changelogClose");
const hintsBtn = $("hintsBtn");
const hintsModal = $("hintsModal");
const hintsClose = $("hintsClose");
const dataAnalysisLink = $("dataAnalysisLink");
const statsLink = $("statsLink");
const performanceLink = $("performanceLink");
const dataAnalysisModal = $("dataAnalysisModal");
const dataAnalysisClose = $("dataAnalysisClose");
const statsModal = $("statsModal");
const statsClose = $("statsClose");
const performanceModal = $("performanceModal");
const performanceClose = $("performanceClose");
const performanceTabs = $("performanceTabs");
const derivedInputA = $("derivedInputA");
const derivedInputB = $("derivedInputB");
const derivedOperation = $("derivedOperation");
const derivedNameInput = $("derivedName");
const derivedComputeBtn = $("derivedComputeBtn");
const derivedResult = $("derivedResult");
const smoothingPresetGroup = $("smoothingPresetGroup");
const anomalyAutoToggle = $("anomalyAutoToggle");
const anomalySummary = $("anomalySummary");
const correlationChecklist = $("correlationChecklist");
const correlationRunBtn = $("correlationRunBtn");
const correlationResult = $("correlationResult");
const statsColumnSelect = $("statsColumnSelect");
const statsComputeBtn = $("statsComputeBtn");
const statsSummary = $("statsSummary");
const rangeMinInput = $("rangeMinInput");
const rangeMaxInput = $("rangeMaxInput");
const rangeComputeBtn = $("rangeComputeBtn");
const rangeSummary = $("rangeSummary");
const sessionComparison = $("sessionComparison");
const healthSummary = $("healthSummary");
const highlightSummary = $("highlightSummary");
const shiftLabModal = $("shiftLabModal");
const shiftLabClose = $("shiftLabClose");
const shiftLabLink = $("shiftLabLink");
const shiftRedline = $("shiftRedline");
const shiftFinal = $("shiftFinal");
const shiftTire = $("shiftTire");
const shiftRatios = $("shiftRatios");
const shiftClutchFill = $("shiftClutchFill");
const shiftSlip = $("shiftSlip");
const shiftAnalyzeBtn = $("shiftAnalyzeBtn");
const shiftResetBtn = $("shiftResetBtn");
const shiftPlot = $("shiftPlot");
const shiftNotes = $("shiftNotes");
const lineWidthSlider = $("lineWidthSlider");
const lineWidthValue = $("lineWidthValue");
const resetYRangeBtn = $("resetYRangeBtn");
const metadataModal = $("metadataModal");
const metadataClose = $("metadataClose");
const metadataLink = $("metadataLink");
const metadataMenuCompare = $("metadataMenuCompare");
const metaSummary = $("metaSummary");
const archiveLogBtn = $("archiveLogBtn");
const archiveNoteInput = $("archiveNoteInput");
const timeSelectToggle = null;
const timeWindowReset = null;
const timeMinSlider = $("timeMinSlider");
const timeMaxSlider = $("timeMaxSlider");
const timeMinInput = $("timeMinInput");
const timeMaxInput = $("timeMaxInput");
const timeMinDisplay = $("timeMinDisplay");
const timeMaxDisplay = $("timeMaxDisplay");
const resetTimeRange = $("resetTimeRange");
const fullTimeRange = null;
const smoothSelect = $("smoothSelect");
const highlightToggle = $("highlightToggle");
const highlightColumn = $("highlightColumn");
const highlightModeSel = $("highlightMode");
const highlightThresholdInput = $("highlightThreshold");
const compareFileInfo = $("compareFileInfo");
const csvCompareFile = $("csvCompareFile");

let headers=[], cols=[], timeIdx=-1, rpmIdx=-1, xIdx=NaN, snapIndex=null;
let xMin = 0, xMax = 0;
let lastIdx = null;

// Time range filtering
let timeRangeMin = 0;
let timeRangeMax = 0;
let timeRangeEnabled = false;
let activeTimeSeries = [];
let activeIndexMap = [];
let smoothingWindow = 0;
let timeWindowSelectEnabled = false;
let chartReady = false;
let highlightSettings = {
  enabled:false,
  columnIdx:-1,
  mode:'gt',
  threshold:0
};
let compareLog = null;
const AUTO_SCALE_TARGET = 200;
const EPS = 1e-3;
let autoAnomaly = { enabled:false, zScore:2.0 };
let primaryLogRaw = "";
let primaryLogName = "";
let primaryLogSize = 0;
let primaryMeta = null;
let detectedSpeedIdx = -1;
let lastYRange = null;

if (smoothSelect) smoothSelect.value = String(smoothingWindow);
if (highlightThresholdInput) highlightThresholdInput.value = highlightSettings.threshold;
refreshHighlightOptions();
syncHighlightControls();

const SLOT_COUNT = 5;
const DEFAULT_LINE_WIDTH = 1.4;
const ySlots = Array.from({length: SLOT_COUNT}, () => ({
  enabled:false,
  colIdx:-1,
  color:"#00aaff",
  scale:0,
  ui:{}  // ui hooks for inputs / displays
}));
let globalLineWidth = DEFAULT_LINE_WIDTH;
const autoY = true;

const HIGHLIGHT_TESTS = {
  gt:(v,t)=>Number.isFinite(v) && v > t,
  gte:(v,t)=>Number.isFinite(v) && v >= t,
  lt:(v,t)=>Number.isFinite(v) && v < t,
  lte:(v,t)=>Number.isFinite(v) && v <= t,
  eq:(v,t)=>Number.isFinite(v) && v === t
};

if (lineWidthValue && lineWidthSlider) {
  const initVal = parseFloat(lineWidthSlider.value) || DEFAULT_LINE_WIDTH;
  if (lineWidthValue) lineWidthValue.textContent = `${initVal.toFixed(1)} px`;
  globalLineWidth = initVal;
}

/* utils */
const debounce = (fn, ms=60) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
// Power-based scaling: apply x^exponent to values
function applyPowerScaling(v, exponent) {
  if (!Number.isFinite(v) || !Number.isFinite(exponent)) return v;
  // Special case: exponent 0 means no scaling (return value as-is, not x^0=1)
  if (exponent === 0) return v;
  if (v === 0 && exponent < 0) return Infinity; // 0^(-n) = Infinity
  if (v < 0 && exponent !== Math.floor(exponent)) return NaN; // Negative base with fractional exponent
  try {
    // For integer exponents, handle sign correctly
    const absResult = Math.pow(Math.abs(v), exponent);
    // Preserve sign: if v is negative and exponent is odd, result is negative
    return absResult * (v < 0 && exponent % 2 !== 0 ? -1 : 1);
  } catch (e) {
    return NaN;
  }
}

function formatExponent(value){
  const num = Number(value) || 0;
  const formatted = num.toFixed(3).replace(/\.?0+$/,'');
  return formatted === '' ? '0' : formatted;
}

function getScaleStep(evt){
  if (evt?.altKey && evt?.shiftKey) return 0.001;
  if (evt?.altKey) return 0.01;
  if (evt?.shiftKey) return 0.1;
  return 1;
}

function openScaleHelp(){
  if (scaleHelpModal) {
    scaleHelpModal.classList.remove("hidden");
  }
}

function clearTimeWindowSelection(){
  timeRangeEnabled = false;
  timeRangeMin = xMin;
  timeRangeMax = xMax;
  lastYRange = null;
  if (chart && chartReady && chart._fullLayout){
    Plotly.relayout(chart, { 'xaxis.autorange': true, selections: [] });
  }
  plot(false, false);
  rescaleYToWindow();
  syncTimeRangeControls();
}

function applyDragSelection(ev){
  if (!chartReady || !chart || !chart._fullLayout) return;
  if (!timeWindowSelectEnabled) return;
  const rx = ev?.range?.x;
  if (!Array.isArray(rx) || rx.length < 2) return;
  let t0 = Math.min(rx[0], rx[1]);
  let t1 = Math.max(rx[0], rx[1]);
  t0 = Math.max(t0, xMin);
  t1 = Math.min(t1, xMax);
  if (t1 - t0 <= EPS) return;
  timeRangeMin = t0;
  timeRangeMax = t1;
  timeRangeEnabled = true;
  lastYRange = null;
  plot(false, false);
  rescaleYToWindow();
  syncTimeRangeControls();
}

function setChartDragMode(){
  if (!chart || !chartReady || !chart._fullLayout) return;
  const dragmode = timeWindowSelectEnabled ? "select" : false;
  Plotly.relayout(chart, { dragmode, selectdirection:"h" });
}

function wirePlotSelectionHandlers(){
  if (!chart || !chartReady || typeof chart.on !== "function") return;
  chart.removeAllListeners?.('plotly_selected');
  chart.removeAllListeners?.('plotly_doubleclick');
  chart.on('plotly_selected', applyDragSelection);
  chart.on('plotly_doubleclick', () => clearTimeWindowSelection());
  setChartDragMode();
}

function applySmoothing(series, window){
  if (!Array.isArray(series) || !series.length || window < 3) return series.slice();
  const half = Math.floor(window / 2);
  const result = [];
  for (let i = 0; i < series.length; i++){
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++){
      if (j >= 0 && j < series.length && Number.isFinite(series[j])){
        sum += series[j];
        count++;
      }
    }
    result.push(count ? sum / count : series[i]);
  }
  return result;
}

function prepareSeries(raw, exponent){
  const base = Array.isArray(raw) ? raw : [];
  const smoothed = smoothingWindow >=3 ? applySmoothing(base, smoothingWindow) : base.slice();
  return smoothed.map(v => applyPowerScaling(v, exponent));
}

function refreshHighlightOptions(){
  if (!highlightColumn) return;
  highlightColumn.innerHTML = "";
  if (!headers.length){
    const placeholder = document.createElement("option");
    placeholder.value = "-1";
    placeholder.textContent = "Load a file to enable highlighting";
    placeholder.disabled = true;
    placeholder.selected = true;
    highlightColumn.appendChild(placeholder);
    return;
  }
  if (!headers[highlightSettings.columnIdx]) {
    highlightSettings.columnIdx = -1;
  }
  const placeholder = document.createElement("option");
  placeholder.value = "-1";
  placeholder.textContent = "Select column";
  if (highlightSettings.columnIdx === -1) placeholder.selected = true;
  highlightColumn.appendChild(placeholder);
  const enabledCols = new Set(ySlots.filter(s=>s.enabled && s.colIdx >= 0).map(s=>s.colIdx));
  enabledCols.forEach(idx => {
    const h = headers[idx];
    const option = document.createElement("option");
    option.value = String(idx);
    option.textContent = h;
    if (idx === highlightSettings.columnIdx) option.selected = true;
    highlightColumn.appendChild(option);
  });

  if (!enabledCols.has(highlightSettings.columnIdx)) {
    highlightSettings.columnIdx = -1;
    highlightColumn.value = "-1";
  }
}

function updateCompareInfo(){
  if (!compareFileInfo) return;
  if (compareLog){
    compareFileInfo.classList.remove("hidden");
    compareFileInfo.textContent = `Comparison loaded: ${compareLog.name} (${compareLog.rows} rows)`;
    if (statsColumnSelect && statsColumnSelect.value) {
      updateSessionComparison(Number(statsColumnSelect.value));
    }
  } else {
    compareFileInfo.classList.add("hidden");
    compareFileInfo.textContent = "";
    if (sessionComparison) sessionComparison.textContent = "Load a comparison log to see session deltas.";
  }
}

function loadComparisonFile(file){
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try{
      const text = String(ev.target.result || "");
      const parsed = parseCSV(text);
      const refTimeIdx = findTimeIndex(parsed.headers);
      if (!Number.isFinite(refTimeIdx) || refTimeIdx < 0){
        toastMsg("Comparison log missing a Time column.", "error");
        return;
      }
      compareLog = {
        name: file.name,
        headers: parsed.headers,
        cols: parsed.cols,
        timeIdx: refTimeIdx,
        rows: parsed.rows
      };
      updateCompareInfo();
      toastMsg("Comparison log ready.", "ok");
      plot(false, true);
    }catch(err){
      compareLog = null;
      updateCompareInfo();
      toastMsg(err.message || "Failed to parse comparison log.", "error");
    }
  };
  reader.onerror = () => {
    compareLog = null;
    updateCompareInfo();
    toastMsg("Unable to read comparison file.", "error");
  };
  reader.readAsText(file);
}

function syncHighlightControls(){
  if (highlightToggle) highlightToggle.checked = !!highlightSettings.enabled;
  const disabled = !highlightSettings.enabled;
  if (highlightColumn) highlightColumn.disabled = disabled;
  if (highlightModeSel) highlightModeSel.disabled = disabled;
  if (highlightThresholdInput) highlightThresholdInput.disabled = disabled;
  if (highlightThresholdInput && Number.isFinite(highlightSettings.threshold)){
    highlightThresholdInput.value = highlightSettings.threshold;
  }
  if (highlightModeSel) highlightModeSel.value = highlightSettings.mode;
}

function updateHighlightSummary(count){
  if (!highlightSummary) return;
  const total = highlightSettings.enabled ? count : 0;
  highlightSummary.textContent = `Highlighted samples: ${total}`;
}

function closeScaleHelp(){
  if (scaleHelpModal) {
    scaleHelpModal.classList.add("hidden");
  }
}

function openChangelog(){
  if (changelogModal) {
    changelogModal.classList.remove("hidden");
  }
}

function closeChangelog(){
  if (changelogModal) {
    changelogModal.classList.add("hidden");
  }
}

function openHints(){
  if (hintsModal) {
    hintsModal.classList.remove("hidden");
  }
}

function closeHints(){
  if (hintsModal) {
    hintsModal.classList.add("hidden");
  }
}

function autoScaleTraces(){
  if (!headers.length || !Number.isFinite(xIdx)) {
    toastMsg("Load a log before auto-scaling.","error");
    return;
  }
  const xs = cols[xIdx];
  if (!xs || !xs.length){
    toastMsg("No time data available.","error");
    return;
  }
  let changed = false;

  for (let i = 0; i < ySlots.length; i++){
    const slot = ySlots[i];
    if (!slot.enabled || slot.colIdx === -1) continue;
    const raw = cols[slot.colIdx];
    if (!raw) continue;

    const magnitudes = [];
    let hasNegative = false;
    for (let j = 0; j < xs.length; j++){
      const t = xs[j];
      if (timeRangeEnabled && (t < timeRangeMin || t > timeRangeMax)) continue;
      const v = raw[j];
      if (!Number.isFinite(v)) continue;
      if (v < 0) hasNegative = true;
      const abs = Math.abs(v);
      if (abs > 0) magnitudes.push(abs);
    }
    if (!magnitudes.length) continue;
    magnitudes.sort((a,b)=>a-b);
    const max = magnitudes[magnitudes.length - 1];
    if (!Number.isFinite(max) || max <= 0) continue;

    let exponent = Math.log(AUTO_SCALE_TARGET) / Math.log(max);
    if (!Number.isFinite(exponent)) continue;
    exponent = Math.max(-3, Math.min(3, exponent));

    if (hasNegative && Math.abs(exponent % 1) > 1e-6){
      exponent = Math.round(exponent);
    }
    exponent = Number(exponent.toFixed(3));
    if (!Number.isFinite(exponent)) continue;

    if ((slot.scale ?? 0) !== exponent){
      slot.scale = exponent;
      updateScaleBox(i);
      changed = true;
    }
  }

  if (changed){
    lastYRange = null;
    plot(false, true);
    if (Number.isFinite(lastIdx)) showPointInfoAt(lastIdx);
    toastMsg("Scaling normalized.", "ok");
  } else {
    toastMsg("Nothing to auto-scale.", "error");
  }
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

// Time range filtering functions
function filterDataByTimeRange(xData, yData, customData) {
  if (!timeRangeEnabled || !Array.isArray(xData) || xData.length === 0) {
    return {
      x: xData,
      y: yData,
      customdata: customData,
      indices: xData?.map((_, idx) => idx) || []
    };
  }

  const filtered = [];
  const filteredY = [];
  const filteredCustom = [];
  const filteredIndices = [];

  for (let i = 0; i < xData.length; i++) {
    const x = xData[i];
    if (Number.isFinite(x) && x >= timeRangeMin && x <= timeRangeMax) {
      filtered.push(x);
      filteredIndices.push(i);
      if (Array.isArray(yData)) {
        filteredY.push(yData[i]);
      }
      if (customData && customData[i] !== undefined) {
        filteredCustom.push(customData[i]);
      }
    }
  }

  return {
    x: filtered,
    y: Array.isArray(yData) ? filteredY : undefined,
    customdata: filteredCustom.length > 0 ? filteredCustom : undefined,
    indices: filteredIndices
  };
}

function getFilteredSeries(colIdx){
  if (!Number.isInteger(colIdx) || colIdx < 0 || !cols[colIdx] || !cols[xIdx]) return null;
  return filterDataByTimeRange(cols[xIdx], cols[colIdx], cols[colIdx]);
}

function computeBasicStats(values){
  const cleaned = values.filter(Number.isFinite);
  if (!cleaned.length) return null;
  cleaned.sort((a,b)=>a-b);
  const count = cleaned.length;
  const sum = cleaned.reduce((a,b)=>a+b,0);
  const mean = sum / count;
  const median = cleaned[Math.floor(count/2)];
  const min = cleaned[0];
  const max = cleaned[count-1];
  const variance = cleaned.reduce((acc,v)=> acc + (v-mean)**2, 0) / count;
  const std = Math.sqrt(variance);
  const p90 = cleaned[Math.min(count-1, Math.floor(count*0.9))];
  const p10 = cleaned[Math.min(count-1, Math.floor(count*0.1))];
  return {count, mean, median, min, max, std, p90, p10};
}

const SPEED_PATTERNS = [
  { regex:/vehicle\s*speed.*mph/i },
  { regex:/vehicle\s*speed/i },
  { regex:/\bmph\b/i },
  { regex:/km\/?h|kmh|kph/i },
  { regex:/\bspeed\b/i }
];

function detectSpeedColumn(){
  for (const rule of SPEED_PATTERNS){
    const idx = headers.findIndex(h => rule.regex.test(h));
    if (idx !== -1) return idx;
  }
  return headers.findIndex(h => /speed|mph|kmh|kph/i.test(h));
}

function summarizeShiftFromLog(){
  const gearIdx = headers.findIndex(h => /gear/i.test(h));
  const rpmIdx = findRpmIndex(headers);
  if (gearIdx < 0 || rpmIdx < 0 || !Number.isFinite(xIdx)) return ["Need Gear + RPM channels for shift analysis."];
  const gear = cols[gearIdx];
  const rpm = cols[rpmIdx];
  const time = cols[xIdx];
  const events = [];
  for (let i=1;i<gear.length;i++){
    const gPrev = gear[i-1];
    const gCurr = gear[i];
    if (!Number.isFinite(gPrev) || !Number.isFinite(gCurr)) continue;
    if (Math.round(gCurr) > Math.round(gPrev)) {
      const rpmBefore = findLastFinite(rpm, i-1);
      const rpmAfter = findFirstFinite(rpm, i);
      const tStamp = time[i] ?? time[i-1];
      if (!Number.isFinite(rpmBefore) || !Number.isFinite(rpmAfter)) continue;
      const drop = rpmBefore - rpmAfter;
      events.push({
        from: Math.round(gPrev),
        to: Math.round(gCurr),
        rpmBefore,
        rpmAfter,
        drop,
        time: tStamp
      });
    }
  }
  if (!events.length) return ["No clear GR6 shifts detected (verify Gear channel)."];
  return events.slice(0,4).map(evt=>{
    return `G${evt.from}→G${evt.to} @ ${evt.rpmBefore.toFixed(0)} rpm (drops to ${evt.rpmAfter.toFixed(0)}, Δ${evt.drop.toFixed(0)} rpm)`;
  });
}

function summarizeProtection(){
  const result = { torque: [], slip: [], mil: [], wheel: [] };
  const torqueIdx = headers.findIndex(h => /torque/i.test(h) && /(limit|reduc|cut)/i.test(h));
  if (torqueIdx >= 0){
    const series = getFilteredSeries(torqueIdx);
    const exceed = (series?.y || []).filter(v => Number.isFinite(v) && v > 0).length;
    if (exceed){
      result.torque.push(`Torque intervention active ${exceed} samples`);
    }
  }
  const slipIdx = headers.findIndex(h => /slip|traction/i.test(h));
  if (slipIdx >= 0){
    const series = getFilteredSeries(slipIdx);
    const threshold = Number(shiftSlip?.value) || 6;
    const slipEvents = (series?.y || []).filter(v => Number.isFinite(v) && v >= threshold).length;
    if (slipEvents){
      result.slip.push(`Wheel slip exceeded ${threshold}% on ${slipEvents} samples`);
    }
  }
  const clutchIdx = headers.findIndex(h => /clutch.*(pressure|fill|duty)/i.test(h));
  if (clutchIdx >= 0){
    const stats = computeBasicStats((getFilteredSeries(clutchIdx)?.y) || []);
    if (stats) result.torque.push(`Clutch control avg ${stats.mean.toFixed(1)} (peak ${stats.max.toFixed(1)})`);
  }
  const milIdx = headers.findIndex(h => /mil|dtc|flag|malf/i.test(h));
  if (milIdx >= 0){
    const series = getFilteredSeries(milIdx);
    const triggered = (series?.y || []).some(v => Number.isFinite(v) && v !== 0);
    if (triggered){
      result.mil.push(`${headers[milIdx]} flagged during this run`);
    }
  }
  return result;
}

function summarizeWheelSpeeds(){
  const notes = [];
  const frontIdx = headers.findIndex(h => /(front|lf|rf|fl)/i.test(h) && /wheel.*speed/i.test(h));
  const rearIdx = headers.findIndex(h => /(rear|lr|rr)/i.test(h) && /wheel.*speed/i.test(h));
  if (frontIdx >= 0 && rearIdx >= 0){
    const frontSeries = getFilteredSeries(frontIdx);
    const rearSeries = getFilteredSeries(rearIdx);
    const len = Math.min(frontSeries?.y?.length || 0, rearSeries?.y?.length || 0);
    let maxDiff = 0;
    for (let i=0;i<len;i++){
      const f = frontSeries.y[i];
      const r = rearSeries.y[i];
      if (!Number.isFinite(f) || !Number.isFinite(r)) continue;
      maxDiff = Math.max(maxDiff, Math.abs(f-r));
    }
    if (maxDiff){
      notes.push(`Front vs rear wheel speed delta peaks at ${maxDiff.toFixed(2)} (${headers[frontIdx]} vs ${headers[rearIdx]})`);
    }
  }
  return notes;
}

function extractHeaderMeta(text){
  const meta = {};
  if (!text) return meta;
  const lines = text.split(/\r?\n/);
  for (const line of lines){
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.startsWith("#")) break;
    const payload = trimmed.replace(/^#+/, "").trim();
    if (!payload) continue;
    const idx = payload.indexOf(":");
    if (idx === -1) continue;
    const key = payload.slice(0, idx).trim();
    const value = payload.slice(idx+1).trim();
    if (key) meta[key] = value;
  }
  return meta;
}

function updateMetaSummary(){
  if (!metaSummary) return;
  if (!headers.length || !cols.length || !Number.isFinite(xIdx)){
    metaSummary.innerHTML = "<span>Upload a log to see VIN, ECU SW, sampling stats, and GR6 insights.</span>";
    if (archiveLogBtn) archiveLogBtn.disabled = true;
    return;
  }
  const timeSeries = cols[xIdx] || [];
  const finiteTime = timeSeries.filter(Number.isFinite);
  const samples = finiteTime.length;
  const duration = samples >= 2 ? finiteTime[finiteTime.length-1] - finiteTime[0] : 0;
  const sampleRate = duration > 0 ? samples / duration : 0;
  const rpmIdx = findRpmIndex(headers);
  const rpmStats = rpmIdx >= 0 ? computeBasicStats((cols[rpmIdx] || []).filter(Number.isFinite)) : null;
  detectedSpeedIdx = detectSpeedColumn();
  const speedLabel = detectedSpeedIdx >=0 ? headers[detectedSpeedIdx] : "—";
  const shiftNotes = summarizeShiftFromLog();
  const protection = summarizeProtection();
  const wheelNotes = summarizeWheelSpeeds();
  const durationStr = duration > 0 ? `${duration.toFixed(2)} s` : "—";
  const rateStr = sampleRate > 0 ? `${sampleRate.toFixed(1)} Hz` : "—";
  const rpmStr = rpmStats ? `${rpmStats.min.toFixed(0)} - ${rpmStats.max.toFixed(0)} rpm` : "Not found";
  const vin = primaryMeta ? (primaryMeta.VIN || primaryMeta["Vehicle Identification Number"] || "—") : "—";
  const ecuSw = primaryMeta ? (primaryMeta["ECU Software Number"] || primaryMeta["Software Number"] || "—") : "—";
  const dongle = primaryMeta ? (primaryMeta["Programming Dongle"] || primaryMeta["Dongle ID"] || "—") : "—";
  const protectionList = [...protection.torque, ...protection.slip, ...wheelNotes];
  const milList = protection.mil.length ? protection.mil : ["No MIL or DTC flags detected."];
  metaSummary.innerHTML = `
    <div class="meta-pair"><span>File</span><strong>${primaryLogName || "—"}</strong></div>
    <div class="meta-pair"><span>Size</span><strong>${primaryLogSize ? fmtBytes(primaryLogSize) : "—"}</strong></div>
    <div class="meta-pair"><span>VIN</span><strong>${vin}</strong></div>
    <div class="meta-pair"><span>ECU SW</span><strong>${ecuSw}</strong></div>
    <div class="meta-pair"><span>Dongle</span><strong>${dongle}</strong></div>
    <div class="meta-pair"><span>Samples</span><strong>${samples ? samples.toLocaleString() : "—"}</strong></div>
    <div class="meta-pair"><span>Duration</span><strong>${durationStr}</strong></div>
    <div class="meta-pair"><span>Sample Rate</span><strong>${rateStr}</strong></div>
    <div class="meta-pair"><span>RPM Range</span><strong>${rpmStr}</strong></div>
    <div class="meta-pair"><span>Speed Source</span><strong>${speedLabel}</strong></div>
    <div class="meta-block">
      <h5>Shift & Clutch Insights</h5>
      <ul>${shiftNotes.map(note=>`<li>${note}</li>`).join("")}</ul>
    </div>
    <div class="meta-block">
      <h5>Traction / Protection</h5>
      <ul>${(protectionList.length ? protectionList : ["No traction events detected."]).map(note=>`<li>${note}</li>`).join("")}</ul>
    </div>
    <div class="meta-block">
      <h5>MIL / Flags</h5>
      <ul>${milList.map(note=>`<li>${note}</li>`).join("")}</ul>
    </div>
  `;
  if (archiveLogBtn) archiveLogBtn.disabled = !primaryLogRaw;
}

function archiveCurrentLog(){
  if (!primaryLogRaw){
    toastMsg("Load a primary log before archiving.","error");
    return;
  }
  const noteRaw = archiveNoteInput && typeof archiveNoteInput.value === "string" ? archiveNoteInput.value : "";
  const note = noteRaw.trim();
  if (!note) {
    toastMsg("Please enter a Cloud Save Note.", "error");
    return;
  }
  archiveLogBtn.disabled = true;
  uploadLogToSupabase(primaryLogRaw, primaryLogName, primaryLogSize, note, "compare")
    ?.then(()=> {
      toastMsg("Archived to cloud.", "ok");
      closeMetadataModal();
      if (archiveNoteInput) archiveNoteInput.value = "";
    })
    ?.catch(()=> toastMsg("Cloud archive failed.", "error"))
    ?.finally(()=>{ 
      archiveLogBtn.disabled = false; 
    });
}

function findLastFinite(arr, start){
  for (let i=start;i>=0;i--){
    if (Number.isFinite(arr[i])) return arr[i];
  }
  return NaN;
}

function findFirstFinite(arr, start){
  for (let i=start;i<arr.length;i++){
    if (Number.isFinite(arr[i])) return arr[i];
  }
  return NaN;
}

function parseShiftRatiosInput(){
  if (!shiftRatios) return [];
  return shiftRatios.value
    .split(/[\s,]+/)
    .map(r => parseFloat(r))
    .filter(v => Number.isFinite(v) && v > 0.1);
}

function runShiftLab(){
  if (!shiftPlot) return;
  const ratios = parseShiftRatiosInput();
  const redline = Number(shiftRedline?.value) || 7500;
  const finalDrive = Number(shiftFinal?.value) || 3.7;
  const tireDiameter = Number(shiftTire?.value) || 26.5;
  if (!ratios.length){
    Plotly.purge(shiftPlot);
    if (shiftNotes) shiftNotes.textContent = "Enter at least one gear ratio to generate shift guidance.";
    return;
  }
  const rpmAxis = [];
  for (let rpm = 2000; rpm <= redline; rpm += 250) rpmAxis.push(rpm);
  const tireCirc = Math.PI * tireDiameter;
  const mphConstant = 1056; // mph = (rpm * tireCirc) / (gear * final * 1056)
  const traces = ratios.map((ratio, idx) => ({
    type:"scatter",
    mode:"lines",
    name:`G${idx+1}`,
    x: rpmAxis,
    y: rpmAxis.map(rpm => (rpm * tireCirc) / (ratio * finalDrive * mphConstant))
  }));
  Plotly.newPlot(shiftPlot, traces, {
    paper_bgcolor:"transparent",
    plot_bgcolor:"transparent",
    margin:{l:45,r:10,t:10,b:40},
    xaxis:{title:"Engine RPM"},
    yaxis:{title:"Vehicle Speed (mph)", rangemode:"tozero"}
  }, {displaylogo:false, responsive:true, staticPlot:true});

  const dropNotes = [];
  for (let i=0;i<ratios.length-1;i++){
    const dropRpm = redline * (ratios[i+1]/ratios[i]);
    dropNotes.push(`G${i+1}→G${i+2}: shift @ ${redline.toFixed(0)} rpm → lands near ${dropRpm.toFixed(0)} rpm (drop ${(redline-dropRpm).toFixed(0)}).`);
  }
  const clutchFill = Number(shiftClutchFill?.value) || 90;
  const slipThreshold = Number(shiftSlip?.value) || 6;
  const logShiftNotes = summarizeShiftFromLog().slice(0,3);
  const userNotes = [
    `Clutch fill reminder: ${clutchFill} ms; keep torque cuts shorter than this.`,
    `Wheel slip target ≤ ${slipThreshold}% for launch + shifts.`
  ];
  const combined = [...dropNotes, ...logShiftNotes, ...userNotes];
  if (shiftNotes) shiftNotes.innerHTML = `<ul>${combined.map(note=>`<li>${note}</li>`).join("")}</ul>`;
}

function resetShiftLabDefaults(){
  if (shiftRatios) shiftRatios.value = "3.36, 2.10, 1.49, 1.20, 1.00, 0.79";
  if (shiftRedline) shiftRedline.value = "7500";
  if (shiftFinal) shiftFinal.value = "3.70";
  if (shiftTire) shiftTire.value = "26.5";
  if (shiftClutchFill) shiftClutchFill.value = "90";
  if (shiftSlip) shiftSlip.value = "6";
  runShiftLab();
}

function saveCompareState(){
  if (!headers.length || !cols.length || !Number.isFinite(xIdx)){
    sessionStorage.removeItem("compareState");
    return;
  }
  try{
    const state = {
      xIdx: Number.isFinite(xIdx) ? xIdx : -1,
      slots: ySlots.map(s=>({ enabled: s.enabled, colIdx:s.colIdx, color:s.color, scale:s.scale })),
      highlight: {
        enabled: !!highlightSettings.enabled,
        columnIdx: Number.isFinite(highlightSettings.columnIdx) ? highlightSettings.columnIdx : -1,
        threshold: Number(highlightSettings.threshold) || 0,
        mode: highlightSettings.mode || "gt"
      },
      timeRange: {
        min: Number.isFinite(timeRangeMin) ? timeRangeMin : xMin,
        max: Number.isFinite(timeRangeMax) ? timeRangeMax : xMax,
        enabled: !!timeRangeEnabled
      },
      globalLineWidth
    };
    sessionStorage.setItem("compareState", JSON.stringify(state));
  }catch(err){
    console.warn("Failed to persist compare state", err);
  }
}

function restoreCompareState(){
  const raw = sessionStorage.getItem("compareState");
  if (!raw) return;
  try{
    const state = JSON.parse(raw);
    if (Number.isFinite(state.xIdx) && state.xIdx >= 0 && state.xIdx < headers.length){
      xIdx = state.xIdx;
    }
    if (Array.isArray(state.slots)){
      state.slots.slice(0, ySlots.length).forEach((slot, idx)=>{
        if (!slot) return;
        ySlots[idx].enabled = !!slot.enabled;
        ySlots[idx].colIdx = Number.isFinite(slot.colIdx) ? slot.colIdx : -1;
        ySlots[idx].color = slot.color || ySlots[idx].color;
        ySlots[idx].scale = Number.isFinite(slot.scale) ? slot.scale : 0;
      });
    }
    if (state.timeRange){
      if (Number.isFinite(state.timeRange.min)) {
        timeRangeMin = Math.max(xMin, Math.min(state.timeRange.min, xMax));
      }
      if (Number.isFinite(state.timeRange.max)) {
        timeRangeMax = Math.max(xMin, Math.min(state.timeRange.max, xMax));
      }
      if (timeRangeMin >= timeRangeMax){
        timeRangeMin = xMin;
        timeRangeMax = xMax;
      }
      if (typeof state.timeRange.enabled === "boolean") timeRangeEnabled = state.timeRange.enabled;
      refreshTimeRangeState();
    }
    if (state.highlight){
      highlightSettings.enabled = !!state.highlight.enabled;
      highlightSettings.columnIdx = Number.isFinite(state.highlight.columnIdx) ? state.highlight.columnIdx : -1;
      highlightSettings.threshold = Number(state.highlight.threshold) || 0;
      highlightSettings.mode = state.highlight.mode || "gt";
    }
    if (Number.isFinite(state.globalLineWidth)){
      globalLineWidth = state.globalLineWidth;
      if (lineWidthSlider) lineWidthSlider.value = String(globalLineWidth);
      if (lineWidthValue) lineWidthValue.textContent = `${globalLineWidth.toFixed(1)} px`;
    }
  }catch(err){
    console.warn("Failed to restore compare state", err);
  }
}

function renderStatsTable(stats){
  if (!stats) return "<p>No numeric data.</p>";
  return `
    <table>
      <tr><th>Count</th><td>${stats.count}</td><th>Mean</th><td>${stats.mean.toFixed(3)}</td></tr>
      <tr><th>Median</th><td>${stats.median.toFixed(3)}</td><th>Std Dev</th><td>${stats.std.toFixed(3)}</td></tr>
      <tr><th>Min</th><td>${stats.min.toFixed(3)}</td><th>Max</th><td>${stats.max.toFixed(3)}</td></tr>
      <tr><th>P10</th><td>${stats.p10.toFixed(3)}</td><th>P90</th><td>${stats.p90.toFixed(3)}</td></tr>
    </table>`;
}

function computeCorrelationMatrix(indices){
  const series = indices.map(idx => getFilteredSeries(idx));
  if (series.some(s => !s)) return null;
  const data = series.map(s => s.y ?? []);
  const length = Math.min(...data.map(arr => arr.length));
  if (!length) return null;
  const trimmed = data.map(arr => arr.slice(0,length));
  const matrix = [];
  for (let i=0;i<trimmed.length;i++){
    matrix[i] = [];
    for (let j=0;j<trimmed.length;j++){
      matrix[i][j] = pearson(trimmed[i], trimmed[j]);
    }
  }
  return matrix;
}

function pearson(a,b){
  const len = Math.min(a.length, b.length);
  if (!len) return 0;
  let sumA=0,sumB=0,sumAB=0,sumASq=0,sumBSq=0,count=0;
  for (let i=0;i<len;i++){
    const va=a[i], vb=b[i];
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    sumA+=va; sumB+=vb; sumAB+=va*vb; sumASq+=va*va; sumBSq+=vb*vb; count++;
  }
  if (!count) return 0;
  const numerator = (count * sumAB) - (sumA * sumB);
  const denom = Math.sqrt((count*sumASq - sumA**2) * (count*sumBSq - sumB**2));
  return denom === 0 ? 0 : numerator/denom;
}

function computeTimeToSpeed(series, startSpeed, endSpeed){
  if (!series) return null;
  const times = series.x;
  const speeds = series.y;
  let startTime = null;
  for (let i=1;i<speeds.length;i++){
    const v1 = speeds[i-1];
    const v2 = speeds[i];
    const t1 = times[i-1];
    const t2 = times[i];
    if (!Number.isFinite(v1) || !Number.isFinite(v2) || !Number.isFinite(t1) || !Number.isFinite(t2)) continue;
    if (startTime === null){
      if (v1 >= startSpeed) startTime = t1;
      else if (v2 >= startSpeed && v2 !== v1){
        const frac = (startSpeed - v1)/(v2 - v1);
        startTime = t1 + frac * (t2 - t1);
      }
    }
    if (startTime !== null){
      if (v1 >= endSpeed) return t1 - startTime;
      if (v2 >= endSpeed && v2 !== v1){
        const frac = (endSpeed - v1)/(v2 - v1);
        const targetTime = t1 + frac * (t2 - t1);
        return targetTime - startTime;
      }
    }
  }
  return null;
}

function detectGearChanges(rpmSeries){
  if (!rpmSeries) return {count:0, times:[]};
  const rpm = rpmSeries.y;
  const times = rpmSeries.x;
  const events = [];
  for (let i=1;i<rpm.length;i++){
    const delta = rpm[i] - rpm[i-1];
    if (Number.isFinite(delta) && delta < -500) {
      events.push(times[i]);
    }
  }
  return {count:events.length, times:events};
}

function populateColumnSelect(select, opts = {}){
  if (!select) return;
  select.innerHTML = "";
  headers.forEach((header, idx)=>{
    if (opts.enabledOnly && !ySlots.some(s=>s.enabled && s.colIdx===idx)) return;
    const option = document.createElement("option");
    option.value = String(idx);
    option.textContent = header;
    select.appendChild(option);
  });
}

function updateCorrelationChecklist(){
  if (!correlationChecklist) return;
  correlationChecklist.innerHTML = "";
  ySlots.forEach(slot=>{
    if (!slot.enabled || slot.colIdx === -1) return;
    const id = `corr-${slot.colIdx}`;
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = String(slot.colIdx);
    checkbox.id = id;
    label.appendChild(checkbox);
    const span = document.createElement("span");
    span.textContent = headers[slot.colIdx];
    label.appendChild(span);
    correlationChecklist.appendChild(label);
  });
}

function populateStatsControls(){
  populateColumnSelect(statsColumnSelect);
  populateColumnSelect(derivedInputA);
  populateColumnSelect(derivedInputB);
}

function refreshAnalysisControls(){
  populateStatsControls();
  updateCorrelationChecklist();
  if (statsColumnSelect && statsColumnSelect.options.length){
    handleStatsCompute();
  }
}


function handleDerivedCompute(){
  if (!derivedInputA || !derivedInputB) return;
  const idxA = Number(derivedInputA.value);
  const idxB = Number(derivedInputB.value);
  if (!Number.isFinite(idxA) || !Number.isFinite(idxB)){
    derivedResult.textContent = "Select two columns.";
    return;
  }
  const seriesA = getFilteredSeries(idxA);
  const seriesB = getFilteredSeries(idxB);
  if (!seriesA || !seriesB){
    derivedResult.textContent = "Unable to read selected columns.";
    return;
  }
  const len = Math.min(seriesA.y.length, seriesB.y.length);
  const op = derivedOperation?.value || "subtract";
  const output = [];
  for (let i=0;i<len;i++){
    const a = seriesA.y[i];
    const b = seriesB.y[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      output.push(NaN);
      continue;
    }
    switch(op){
      case "add": output.push(a + b); break;
      case "multiply": output.push(a * b); break;
      case "divide": output.push(b === 0 ? NaN : a / b); break;
      default: output.push(a - b); break;
    }
  }
  const stats = computeBasicStats(output);
  const preview = output.filter(Number.isFinite).slice(0,8).map(v=>v.toFixed(3)).join(", ");
  const label = derivedNameInput?.value?.trim() || `${headers[idxA]} ${op} ${headers[idxB]}`;
  derivedResult.innerHTML = `<strong>${label}</strong>${renderStatsTable(stats)}<p>Preview: ${preview || "No numeric samples"}.</p><p class="muted">Derived channels preview only for now—add to Correlation Lab manually if desired.</p>`;
}

function setSmoothingPresetActive(val){
  if (!smoothingPresetGroup) return;
  smoothingPresetGroup.querySelectorAll("button").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.smooth === String(val));
  });
}

function applyAnomalyDetection(){
  if (!autoAnomaly.enabled){
    anomalySummary.textContent = "Auto detection off.";
    return;
  }
  if (highlightSettings.columnIdx === -1){
    anomalySummary.textContent = "Enable a highlight column first.";
    return;
  }
  const series = getFilteredSeries(highlightSettings.columnIdx);
  if (!series){
    anomalySummary.textContent = "No data for highlight column.";
    return;
  }
  const stats = computeBasicStats(series.y || []);
  if (!stats){
    anomalySummary.textContent = "Insufficient numeric data.";
    return;
  }
  const threshold = stats.mean + autoAnomaly.zScore * stats.std;
  highlightSettings.threshold = threshold;
  highlightSettings.mode = "gt";
  highlightSettings.enabled = true;
  if (highlightToggle) highlightToggle.checked = true;
  if (highlightThresholdInput) highlightThresholdInput.value = threshold.toFixed(3);
  if (highlightModeSel) highlightModeSel.value = "gt";
  anomalySummary.textContent = `Highlighting values greater than ${threshold.toFixed(3)} (${stats.mean.toFixed(3)} + ${autoAnomaly.zScore}σ).`;
  plot(false,true);
}

function handleCorrelationRun(){
  if (!correlationChecklist){
    correlationResult.textContent = "No enabled traces.";
    return;
  }
  const selected = Array.from(correlationChecklist.querySelectorAll("input:checked")).map(cb=>Number(cb.value));
  if (selected.length < 2){
    correlationResult.textContent = "Select at least two traces.";
    return;
  }
  const limited = selected.slice(0,4);
  const matrix = computeCorrelationMatrix(limited);
  if (!matrix){
    correlationResult.textContent = "Not enough numeric data.";
    return;
  }
  let html = "<table><tr><th></th>";
  limited.forEach(idx => html += `<th>${headers[idx]}</th>`);
  html += "</tr>";
  matrix.forEach((row,i)=>{
    html += `<tr><th>${headers[limited[i]]}</th>`;
    row.forEach(val=>{
      html += `<td>${val.toFixed(3)}</td>`;
    });
    html += "</tr>";
  });
  html += "</table>";
  correlationResult.innerHTML = html;
}

function handleStatsCompute(){
  if (!statsColumnSelect){
    statsSummary.textContent = "No columns available.";
    return;
  }
  const idx = Number(statsColumnSelect.value);
  const series = getFilteredSeries(idx);
  if (!series){
    statsSummary.textContent = "Select a parameter.";
    return;
  }
  const stats = computeBasicStats(series.y || []);
  statsSummary.innerHTML = renderStatsTable(stats);
  updateSessionComparison(idx);
}

function handleRangeCompute(){
  if (!statsColumnSelect){
    rangeSummary.textContent = "Select a parameter first.";
    return;
  }
  const idx = Number(statsColumnSelect.value);
  const series = getFilteredSeries(idx);
  if (!series){
    rangeSummary.textContent = "No data for selected parameter.";
    return;
  }
  const min = parseFloat(rangeMinInput.value);
  const max = parseFloat(rangeMaxInput.value);
  if (!Number.isFinite(min) || !Number.isFinite(max)){
    rangeSummary.textContent = "Enter min/max bounds.";
    return;
  }
  const values = (series.y || []).filter(Number.isFinite);
  if (!values.length){
    rangeSummary.textContent = "No numeric samples.";
    return;
  }
  const inside = values.filter(v => v >= Math.min(min,max) && v <= Math.max(min,max)).length;
  const pct = (inside / values.length) * 100;
  rangeSummary.textContent = `${pct.toFixed(2)}% of samples between ${min} and ${max}.`;
}

function getComparisonSeriesByHeader(header){
  if (!compareLog || !header) return null;
  const idx = compareLog.headers.indexOf(header);
  if (idx === -1) return null;
  const time = compareLog.cols[compareLog.timeIdx];
  const series = compareLog.cols[idx];
  if (!time || !series) return null;
  if (!timeRangeEnabled) return {x:time.slice(), y:series.slice()};
  const filtered = {x:[], y:[]};
  for (let i=0;i<time.length;i++){
    const t = time[i];
    if (!Number.isFinite(t)) continue;
    if (t < timeRangeMin || t > timeRangeMax) continue;
    filtered.x.push(t);
    filtered.y.push(series[i]);
  }
  return filtered;
}

function updateSessionComparison(primaryIdx){
  if (!sessionComparison) return;
  if (!compareLog){
    sessionComparison.textContent = "Load a comparison log to see session deltas.";
    return;
  }
  const header = headers[primaryIdx];
  const refSeries = getComparisonSeriesByHeader(header);
  const series = getFilteredSeries(primaryIdx);
  if (!refSeries || !series){
    sessionComparison.textContent = "Selected parameter not available in comparison log.";
    return;
  }
  const statsA = computeBasicStats(series.y || []);
  const statsB = computeBasicStats(refSeries.y || []);
  if (!statsA || !statsB){
    sessionComparison.textContent = "Not enough numeric samples.";
    return;
  }
  sessionComparison.innerHTML = `
    <table>
      <tr><th></th><th>Primary</th><th>Comparison</th><th>Delta</th></tr>
      <tr><td>Mean</td><td>${statsA.mean.toFixed(3)}</td><td>${statsB.mean.toFixed(3)}</td><td>${(statsA.mean-statsB.mean).toFixed(3)}</td></tr>
      <tr><td>Peak</td><td>${statsA.max.toFixed(3)}</td><td>${statsB.max.toFixed(3)}</td><td>${(statsA.max-statsB.max).toFixed(3)}</td></tr>
      <tr><td>Std Dev</td><td>${statsA.std.toFixed(3)}</td><td>${statsB.std.toFixed(3)}</td><td>${(statsA.std-statsB.std).toFixed(3)}</td></tr>
    </table>`;
}



function updateTimeRangeDisplays() {
  if (timeMinDisplay) timeMinDisplay.textContent = `${timeRangeMin.toFixed(1)}s`;
  if (timeMaxDisplay) timeMaxDisplay.textContent = `${timeRangeMax.toFixed(1)}s`;
}

function refreshTimeRangeState(){
  const full = Math.abs(timeRangeMin - xMin) < EPS && Math.abs(timeRangeMax - xMax) < EPS;
  timeRangeEnabled = !full;
}

function applyTimeRangeChange(){
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax)) return;
  if (timeRangeMin > timeRangeMax) {
    const mid = (timeRangeMin + timeRangeMax)/2;
    timeRangeMin = mid - EPS;
    timeRangeMax = mid + EPS;
  }
  timeRangeMin = Math.max(xMin, Math.min(timeRangeMin, xMax));
  timeRangeMax = Math.max(xMin, Math.min(timeRangeMax, xMax));
  refreshTimeRangeState();
  syncTimeRangeControls();
  plot(false, false);
  rescaleYToWindow();
  setChartDragMode();
}

function syncTimeRangeControls(){
  if (timeMinSlider && Number.isFinite(timeRangeMin)) {
    timeMinSlider.value = timeRangeMin;
  }
  if (timeMaxSlider && Number.isFinite(timeRangeMax)) {
    timeMaxSlider.value = timeRangeMax;
  }
  if (timeMinInput && Number.isFinite(timeRangeMin)) {
    timeMinInput.value = timeRangeMin.toFixed(1);
  }
  if (timeMaxInput && Number.isFinite(timeRangeMax)) {
    timeMaxInput.value = timeRangeMax.toFixed(1);
  }
  updateTimeRangeDisplays();
}

function initializeTimeRange() {
  // Set initial values based on data
  updateTimeRangeFromData();

  // Set up slider ranges
  if (timeMinSlider) {
    timeMinSlider.min = xMin;
    timeMinSlider.max = xMax;
    timeMinSlider.value = timeRangeMin;
  }
  if (timeMaxSlider) {
    timeMaxSlider.min = xMin;
    timeMaxSlider.max = xMax;
    timeMaxSlider.value = timeRangeMax;
  }

  // Set up input values
  if (timeMinInput) timeMinInput.value = timeRangeMin.toFixed(1);
  if (timeMaxInput) timeMaxInput.value = timeRangeMax.toFixed(1);

  updateTimeRangeDisplays();
}

function updateTimeRangeFromData() {
  if (cols.length === 0 || !Number.isFinite(xIdx)) return;

  const xData = cols[xIdx].filter(Number.isFinite);
  if (xData.length === 0) return;

  xMin = Math.min(...xData);
  xMax = Math.max(...xData);

  // Initialize time range to full range if not already set or if data changed
  if (!timeRangeEnabled || timeRangeMin >= timeRangeMax) {
    timeRangeMin = xMin;
    timeRangeMax = xMax;
    timeRangeEnabled = true;
  }

  // Ensure time range stays within data bounds
  timeRangeMin = Math.max(xMin, Math.min(timeRangeMin, xMax));
  timeRangeMax = Math.max(xMin, Math.min(timeRangeMax, xMax));
  refreshTimeRangeState();
}

// Loading screen functions
let loadingTimeout = null;

function showLoading() {
  if (loadingScreen) {
    loadingScreen.classList.remove("hidden");
  }
  startClassicLoader();
  
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
  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
  }
  stopClassicLoader();
}

function rescaleYToWindow(){
  const xs = activeTimeSeries.length ? activeTimeSeries : cols[xIdx];
  if (!xs || !xs.length) return;
  let mn = +Infinity, mx = -Infinity;

  for (let s of ySlots){
    if (!s.enabled || s.colIdx === -1) continue;
    const ys = cols[s.colIdx];
    const exponent = s.scale ?? 0;
    for (let i = 0; i < xs.length; i++){
      // Always respect the current time window if enabled
      if (timeRangeEnabled && (xs[i] < timeRangeMin || xs[i] > timeRangeMax)) continue;
      const v = ys[i]; if (!Number.isFinite(v)) continue;
      const y = applyPowerScaling(v, exponent);
      if (Number.isFinite(y)) {
        if (y < mn) mn = y; if (y > mx) mx = y;
      }
    }
  }

  if (mn === +Infinity || mx === -Infinity) return;
  const pad = Math.max((mx - mn) * 0.05, 1e-6);
  const targetRange = [mn - pad, mx + pad];
  if (!lastYRange){
    lastYRange = targetRange;
  } else {
    const blend = 0.25;
    lastYRange = [
      targetRange[0] * blend + lastYRange[0] * (1 - blend),
      targetRange[1] * blend + lastYRange[1] * (1 - blend)
    ];
    lastYRange[0] = Math.min(lastYRange[0], targetRange[0]);
    lastYRange[1] = Math.max(lastYRange[1], targetRange[1]);
  }

  const rangeX = timeRangeEnabled ? [timeRangeMin, timeRangeMax] : [xMin, xMax];

  Plotly.relayout(chart, {
    "yaxis.autorange": false,
    "yaxis.range": lastYRange,
    "xaxis.autorange": false,
    "xaxis.range": rangeX
  });
}

function updateScaleBox(i){
  const s = ySlots[i];
  if (s?.ui?.val) {
    const exponent = s.scale ?? 0;
    if (s.ui.val.tagName === 'INPUT') {
      s.ui.val.value = formatExponent(exponent);
    } else {
      s.ui.val.textContent = formatExponent(exponent);
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
      // customdata uses the same filtered index space as x
      const raw = tr.customdata?.[idx];
      const yRaw = Number.isFinite(raw) ? Number(raw).toFixed(3) : "—";
      return `${tr.name}<br>${yRaw}`;   // RAW displayed
    }).join("<br><br>");
  Plotly.relayout(chart, {
    shapes:[{type:"line", x0:t, x1:t, y0:0, y1:1, xref:"x", yref:"paper",
             line:{color:accent2Color, width:1, dash:"dot"}}],
    annotations:[{
      xref:"paper", yref:"paper", x:1, y:1, xanchor:"right", yanchor:"top",
      text:`Time<br>${t.toFixed(3)} s<br><br>${rows}`,
      bgcolor:cardBg, bordercolor:lineColor, borderwidth:1, borderpad:8,
      font:{color:fgColor, size:11}, align:"left", showarrow:false, captureevents:false,
      opacity:0.85
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
    let targetIdx = null;
    
    // If click is on a data point, use that index
    if (ev?.points?.length > 0) {
      targetIdx = ev.points[0].pointIndex;
    }
    // If click is anywhere else on the plot, find nearest point
    else if (ev?.xval !== undefined) {
      const x = chart.data?.[0]?.x; if (x?.length){
        const bb = chart.getBoundingClientRect();
        const fl = chart && chart._fullLayout; if (!fl || !fl.xaxis || !fl.margin) return;
        const xpx = ev.event?.clientX ? (ev.event.clientX - bb.left - fl.margin.l) : 0;
        const targetX = Number.isFinite(xpx) ? fl.xaxis.p2d(xpx) : ev.xval;
        let bestIdx = 0, bestDist = Infinity;
        for (let i = 0; i < x.length; i++) {
          const dist = Math.abs(x[i] - targetX);
          if (dist < bestDist) { bestDist = dist; bestIdx = i; }
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

    // col4: scale value display (exponent/power)
    const scaleVal = document.createElement("input");
    scaleVal.type = "number";
    scaleVal.className = "scale-val";
    scaleVal.value = formatExponent(ySlots[i].scale ?? 0);
    scaleVal.step = "0.001";
    scaleVal.min = "-10";
    scaleVal.max = "10";
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
    tick.addEventListener("change", ()=>{
      ySlots[i].enabled=tick.checked;
      // Refresh highlight options when enabled Y columns change
      refreshHighlightOptions();
      syncHighlightControls();
      plot(false,true);
      if (Number.isFinite(lastIdx)) showPointInfoAt(lastIdx);
    });
    color.addEventListener("input", ()=>{
      ySlots[i].color=color.value;
      plot(false,true);
      if (Number.isFinite(lastIdx)) showPointInfoAt(lastIdx);
    });
    sel.addEventListener("change", ()=>{
      ySlots[i].colIdx=Number(sel.value);
      ySlots[i].scale=0;
      updateScaleBox(i);
      // Column selection also affects which series are eligible for event highlighting
      refreshHighlightOptions();
      syncHighlightControls();
      plot(false,true);
      if (Number.isFinite(lastIdx)) showPointInfoAt(lastIdx);
    });
    scaleVal.addEventListener("input", ()=>{ 
      const newExponent = parseFloat(scaleVal.value);
      if (Number.isFinite(newExponent) && newExponent >= -10 && newExponent <= 10) {
        ySlots[i].scale = newExponent;
        plot(false,true);
        if (Number.isFinite(lastIdx)) showPointInfoAt(lastIdx);
      } else {
        scaleVal.value = formatExponent(ySlots[i].scale ?? 0);
      }
    });
    up.addEventListener("click", (evt)=>{ 
      const ix=ySlots[i].colIdx; if(ix<0) return; 
      const currentExponent = ySlots[i].scale ?? 0;
      const step = getScaleStep(evt);
      ySlots[i].scale = Math.min(10, +(currentExponent + step).toFixed(3)); 
      updateScaleBox(i); 
      plot(false,true); 
      if (Number.isFinite(lastIdx)) showPointInfoAt(lastIdx);
    });
    dn.addEventListener("click", (evt)=>{ 
      const ix=ySlots[i].colIdx; if(ix<0) return; 
      const currentExponent = ySlots[i].scale ?? 0;
      const step = getScaleStep(evt);
      ySlots[i].scale = Math.max(-10, +(currentExponent - step).toFixed(3)); 
      updateScaleBox(i); 
      plot(false,true); 
      if (Number.isFinite(lastIdx)) showPointInfoAt(lastIdx);
    });
    reset.addEventListener("click", ()=>{ 
      ySlots[i].scale = 0; 
      updateScaleBox(i); 
      plot(false,true); 
      if (Number.isFinite(lastIdx)) showPointInfoAt(lastIdx);
    });

    row.append(left,color,sel,scaleVal,valwrap,btns);
    axisPanel.appendChild(row);
  }
  refreshAnalysisControls();
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
  
  let currentTimeSeries = [];
  let currentIndexMap = [];

  const highlightTraces = [];

  for(let i=0;i<ySlots.length;i++){
    const s = ySlots[i];
    if(!s.enabled || s.colIdx===-1) continue;
    const rawY    = cols[s.colIdx];
    const exponent = s.scale ?? 0;
    const scaledY = prepareSeries(rawY, exponent);
    const lineWidth = globalLineWidth;
    const label = headers[s.colIdx];

    // Apply time range filtering
    const filteredData = filterDataByTimeRange(cols[xIdx], scaledY, rawY);
    if (!currentTimeSeries.length) {
      currentTimeSeries = filteredData.x;
      currentIndexMap = filteredData.indices || [];
    }

    // Use scattergl for large datasets (>10k points) for better performance
    const dataLength = filteredData.x.length;
    const useScatterGL = !timeWindowSelectEnabled && dataLength > 10000;
    const typ = useScatterGL ? "scattergl" : "scatter";
    
    // Downsample if needed (for datasets between 5k-10k points)
    let plotX = filteredData.x;
    let plotY = filteredData.y ?? scaledY;
    if (!useScatterGL && shouldDownsample(dataLength, 5000)){
      const viewportWidth = window.innerWidth || 1920;
      const optimalSize = calculateOptimalSampleSize(dataLength, viewportWidth, 2000);
      const downsampled = downsampleLTTB(plotX, plotY, optimalSize);
      plotX = downsampled.x;
      plotY = downsampled.y;
    }
    traces.push({
      type: typ,
      mode: "lines",
      x: plotX,
      y: plotY,
      customdata: filteredData.customdata,
      name: label,
      line: { width: lineWidth, color: s.color },
      hoverinfo: "skip"
    });

    if (compareLog && compareLog.headers?.includes(label) && compareLog.timeIdx >= 0){
      const refIdx = compareLog.headers.indexOf(label);
      const refYRaw = compareLog.cols?.[refIdx];
      const refTime = compareLog.cols?.[compareLog.timeIdx];
      if (refYRaw && refTime){
        const refScaled = prepareSeries(refYRaw, exponent);
        const refFiltered = filterDataByTimeRange(refTime, refScaled, refYRaw);
        // Downsample reference data if needed
        let refPlotX = refFiltered.x;
        let refPlotY = refFiltered.y ?? refScaled;
        const refDataLength = refFiltered.x.length;
        const refUseScatterGL = !timeWindowSelectEnabled && refDataLength > 10000;
        const refTyp = refUseScatterGL ? "scattergl" : "scatter";
        
        if (!refUseScatterGL && shouldDownsample(refDataLength, 5000)){
          const viewportWidth = window.innerWidth || 1920;
          const optimalSize = calculateOptimalSampleSize(refDataLength, viewportWidth, 2000);
          const downsampled = downsampleLTTB(refPlotX, refPlotY, optimalSize);
          refPlotX = downsampled.x;
          refPlotY = downsampled.y;
        }
        traces.push({
          type: refTyp,
          mode: "lines",
          x: refPlotX,
          y: refPlotY,
          customdata: refFiltered.customdata,
          name: `${label} (Ref)`,
          line: { width: Math.max(0.8, lineWidth - 0.4), dash: "dot", color: s.color },
          hoverinfo: "skip",
          opacity: 0.85
        });
      }
    }
  }
  if (highlightSettings.enabled && Number.isFinite(highlightSettings.threshold) && highlightSettings.columnIdx >=0){
    const rawCol = cols[highlightSettings.columnIdx];
    if (rawCol){
      const slot = ySlots.find(s=>s.colIdx === highlightSettings.columnIdx);
      const exponent = slot ? (slot.scale ?? 0) : 0;
      const prepared = prepareSeries(rawCol, exponent);
      const filtered = filterDataByTimeRange(cols[xIdx], prepared, rawCol);
      const ptsX = [], ptsY = [], rawVals = [];
      const predicate = HIGHLIGHT_TESTS[highlightSettings.mode] || HIGHLIGHT_TESTS.gt;
      filtered.x.forEach((x, idx) => {
        const rawVal = filtered.customdata ? filtered.customdata[idx] : prepared[idx];
        if (!Number.isFinite(rawVal)) return;
        if (predicate(rawVal, highlightSettings.threshold)){
          ptsX.push(x);
          const yVal = filtered.y ? filtered.y[idx] : prepared[idx];
          ptsY.push(yVal);
          rawVals.push(rawVal);
        }
      });
      updateHighlightSummary(ptsX.length);
      if (ptsX.length){
        traces.push({
          type: "scatter",
          mode: "markers",
          x: ptsX,
          y: ptsY,
          name: `${headers[highlightSettings.columnIdx]} Highlight`,
          marker: { size: 8, color: "#ff944d", symbol: "diamond-open" },
          customdata: rawVals,
          hovertemplate: `${headers[highlightSettings.columnIdx]}<br>raw:%{customdata:.3f}<extra>Highlight</extra>`
        });
      }
    }
  } else {
    updateHighlightSummary(0);
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

  const layout = {
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
  };
  if (!currentTimeSeries.length) {
    currentTimeSeries = cols[xIdx] ? [...cols[xIdx]] : [];
    currentIndexMap = currentTimeSeries.map((_, idx) => idx);
  }

  Plotly.newPlot(chart,traces,layout,{
    displaylogo:false,
    responsive:true,
    scrollZoom:false,
    doubleClick:'reset',
    staticPlot:false,
    modeBarButtonsToRemove:[
      "zoom2d","pan2d","select2d","lasso2d","zoomIn2d","zoomOut2d","autoScale2d","resetScale2d"
    ]
  }).then(()=>{
    chartReady = true;
    activeTimeSeries = currentTimeSeries;
    activeIndexMap = currentIndexMap;
    wirePlotSelectionHandlers();
    bindChartHandlers();
    const x = traces[0]?.x || [];
    const mid = Math.floor(x.length/2);
    const targetIdx = lastIdx ?? mid;
    showPointInfoAt(targetIdx);
    updateReadoutsAt(targetIdx);
    syncAllScaleBoxes();
    
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
      
      // Do not re-add container click; snapping is handled by wireCursor
    }

    // Add cursor after plot & enable snapping
    addCursor(chart);
    wireCursor(chart, { time: activeTimeSeries });

    // Follow finger/mouse: continuous snap while dragging
    const dragRect = chart.querySelector('.plotly .nsewdrag') || chart;
    const fl = chart && chart._fullLayout;
    let dragging = false;
    function xDataFromEvent(ev){
      if (!fl || !fl.xaxis || !fl.margin) return null;
      const p = ev.touches ? ev.touches[0] : ev;
      const bb = chart.getBoundingClientRect();
      const xpx = p.clientX - bb.left - fl.margin.l; // px in plot area
      return fl.xaxis.p2d(xpx);
    }
    function snapAt(ev){
      const xd = xDataFromEvent(ev);
      if (xd==null) return;
      const idx = nearestIndexByX(xd);
      if (Number.isFinite(idx)) showPointInfoAt(idx);
    }
    dragRect.addEventListener('pointerdown', e=>{ dragging=true; dragRect.setPointerCapture?.(e.pointerId); snapAt(e); });
    dragRect.addEventListener('pointermove', e=>{ if (dragging) snapAt(e); });
    dragRect.addEventListener('pointerup',   ()=>{ dragging=false; });
    dragRect.addEventListener('pointercancel', ()=>{ dragging=false; });
  });

  updateReadouts();
  if (autoY) rescaleYToWindow();
  else if (timeRangeEnabled) {
    Plotly.relayout(chart, { "xaxis.autorange": false, "xaxis.range": [timeRangeMin, timeRangeMax] });
  }
}

// Container click handler function
function handleContainerClick(event) {
  // Only handle clicks on the chart area, not on controls
  if (event.target.closest('.plot-frame') || event.target.closest('.plot')) {
    const bb = chart.getBoundingClientRect();
    const fl = chart && chart._fullLayout;
    if (!fl || !fl.xaxis || !fl.margin) return;
    // Convert clientX to plot-area pixels (exclude left margin), then to data
    const xpx = event.clientX - bb.left - fl.margin.l;
    const xData = fl.xaxis.p2d(xpx);
    
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
  const xs=activeTimeSeries; if(!xs?.length) return null;
  let bestI=0,bestD=Infinity; for(let i=0;i<xs.length;i++){ const d=Math.abs(xs[i]-xTarget); if(d<bestD){bestD=d; bestI=i;} }
  return bestI;
}

function updateReadouts(){
  if(!Number.isFinite(xIdx)) return;
  const xs=activeTimeSeries; if(!xs?.length) return;
  let idx=snapIndex??(xs.length-1);
  const r=chart.layout?.xaxis?.range; if(r){ const [lo,hi]=r; if(xs[idx]<lo) idx=nearestIndexByX(lo); else if(xs[idx]>hi) idx=nearestIndexByX(hi); }
  snapIndex=idx;
  updateReadoutsAt(idx);
}

function updateReadoutsAt(idx){
  if(!Number.isFinite(xIdx) || !Number.isFinite(idx)) return;
  const xs=activeTimeSeries; if(!xs?.length) return;
  const origIdx = activeIndexMap[idx] ?? idx;

  // X value
  const xVal=axisPanel.querySelector(".slot .valbox"); if(xVal) xVal.textContent = Number(xs[idx]).toFixed(3);

  // Y values
  for(let i=0;i<ySlots.length;i++){
    const s=ySlots[i]; if(!s.valEl) continue;
    if(!s.enabled || s.colIdx===-1){ s.valEl.textContent=""; continue; }
    const raw=cols[s.colIdx][origIdx];
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
    const parsed=parseCSV(text); headers=parsed.headers; cols=parsed.cols;
    timeIdx=parsed.timeIdx; rpmIdx=findRpmIndex(headers);
    xIdx=Number.isFinite(timeIdx)?timeIdx:NaN;

    primaryLogRaw = text;
    primaryLogName = name;
    primaryLogSize = size;
    primaryMeta = extractHeaderMeta(text);

    if (Number.isFinite(xIdx)){
      const x = cols[xIdx].filter(Number.isFinite);
      xMin = x.length ? x[0] : 0;
      xMax = x.length ? x[x.length-1] : 100;
    }
    ySlots.forEach(s=>{ s.enabled=false; s.colIdx=-1; s.scale=0; s.color="#00aaff"; s.ui={}; });

    // Initialize time range controls
    initializeTimeRange();

    autoSelectYs();
    restoreCompareState();
    syncTimeRangeControls();
    buildUI();
    refreshHighlightOptions();
    syncHighlightControls();
    chart.innerHTML="";
    toastMsg("Loaded cached CSV. Configure axes, then Generate Plot.","ok");
    if (highlightSummary) updateHighlightSummary(0);
    updateMetaSummary();
    return true;
  }catch(e){ console.warn("cache parse fail",e); return false; }
}

/* file flow */
function wireInitialEventListeners(){
  if (!csvFile) {
    console.error("csvFile element not found");
    return;
  }
  csvFile.addEventListener("change",(e)=>{
    const f=e.target.files[0]||null; if(!f){ fileInfo.classList.add("hidden"); return; }
    const rd=new FileReader();
    rd.onerror=()=>toastMsg("Failed to read file.");
    rd.onload=(ev)=>{
      const text=String(ev.target.result||""); cacheCSV(text,f.name,f.size);
      
      showLoading();
      
      setTimeout(() => {
        try{
          const parsed=parseCSV(text); headers=parsed.headers; cols=parsed.cols;
          timeIdx=parsed.timeIdx; rpmIdx=findRpmIndex(headers);
          xIdx=Number.isFinite(timeIdx)?timeIdx:NaN;
          if (Number.isFinite(xIdx)){
            const x = cols[xIdx].filter(Number.isFinite);
            xMin = x.length ? x[0] : 0;
            xMax = x.length ? x[x.length-1] : 100;
          }
          ySlots.forEach(s=>{ s.enabled=false; s.colIdx=-1; s.scale=0; s.color="#00aaff"; s.ui={}; });

          // Initialize time range controls
          initializeTimeRange();

          hideLoading();

          fileInfo.classList.remove("hidden"); fileInfo.textContent=`Selected: ${f.name} · ${fmtBytes(f.size)}`;
          primaryLogRaw = text;
          primaryLogName = f.name;
          primaryLogSize = f.size;
          primaryMeta = extractHeaderMeta(text);
          autoSelectYs(); restoreCompareState(); syncTimeRangeControls(); buildUI(); refreshHighlightOptions(); syncHighlightControls(); chart.innerHTML=""; toastMsg("Parsed. Configure axes, then Generate Plot.","ok");
          updateMetaSummary();
          
        }catch(err){ 
          hideLoading();
          toastMsg(err.message||"Parse error."); 
        }
      }, 500);
    };
    rd.readAsText(f);
  });

  genBtn.addEventListener("click", ()=>{ plot(true,false); updateReadouts(); });

  // Time window selection via sliders only (no toggle)
  setChartDragMode();


  // Time window sliders/inputs
  if (timeMinSlider){
    timeMinSlider.addEventListener("input", (e)=>{
      const v = Number(e.target.value);
      if (Number.isFinite(v)){
        timeRangeMin = Math.min(v, timeRangeMax - EPS);
        applyTimeRangeChange();
      }
    });
  }
  if (timeMaxSlider){
    timeMaxSlider.addEventListener("input", (e)=>{
      const v = Number(e.target.value);
      if (Number.isFinite(v)){
        timeRangeMax = Math.max(v, timeRangeMin + EPS);
        applyTimeRangeChange();
      }
    });
  }
  if (timeMinInput){
    timeMinInput.addEventListener("change", (e)=>{
      const v = Number(e.target.value);
      if (Number.isFinite(v)){
        timeRangeMin = Math.min(v, timeRangeMax - EPS);
        applyTimeRangeChange();
      }
    });
  }
  if (timeMaxInput){
    timeMaxInput.addEventListener("change", (e)=>{
      const v = Number(e.target.value);
      if (Number.isFinite(v)){
        timeRangeMax = Math.max(v, timeRangeMin + EPS);
        applyTimeRangeChange();
      }
    });
  }
  if (resetTimeRange){
    resetTimeRange.addEventListener("click", ()=>{
      timeRangeMin = xMin;
      timeRangeMax = xMax;
      timeRangeEnabled = false;
      applyTimeRangeChange();
    });
  }

  if (smoothSelect) {
    smoothSelect.addEventListener("change", () => {
      smoothingWindow = Number(smoothSelect.value) || 0;
      setSmoothingPresetActive(smoothSelect.value);
      plot(false, true);
    });
  }
  if (highlightToggle) {
    highlightToggle.addEventListener("change", (e) => {
      highlightSettings.enabled = e.target.checked;
      syncHighlightControls();
      plot(false, true);
      if (!highlightSettings.enabled && anomalySummary) {
        anomalySummary.textContent = "Auto detection off.";
      }
      if (!highlightSettings.enabled) updateHighlightSummary(0);
    });
  }
  if (highlightColumn) {
    highlightColumn.addEventListener("change", (e) => {
      highlightSettings.columnIdx = Number(e.target.value);
      syncHighlightControls();
      plot(false, true);
      if (autoAnomaly.enabled) applyAnomalyDetection();
    });
  }
  if (highlightModeSel) {
    highlightModeSel.addEventListener("change", (e) => {
      highlightSettings.mode = e.target.value || "gt";
      syncHighlightControls();
      plot(false, true);
    });
  }
  if (highlightThresholdInput) {
    highlightThresholdInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (Number.isFinite(val)) {
        highlightSettings.threshold = val;
        syncHighlightControls();
        if (highlightSettings.enabled) plot(false, true);
      }
    });
  }
  if (derivedComputeBtn) {
    derivedComputeBtn.addEventListener("click", handleDerivedCompute);
  }
  if (smoothingPresetGroup) {
    smoothingPresetGroup.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const val = btn.dataset.smooth;
      if (smoothSelect) smoothSelect.value = val;
      smoothingWindow = Number(val) || 0;
      setSmoothingPresetActive(val);
      plot(false, true);
    });
  }
  if (anomalyAutoToggle) {
    anomalyAutoToggle.addEventListener("change", (e) => {
      autoAnomaly.enabled = e.target.checked;
      applyAnomalyDetection();
    });
  }
  if (correlationRunBtn) {
    correlationRunBtn.addEventListener("click", handleCorrelationRun);
  }
  if (statsComputeBtn) {
    statsComputeBtn.addEventListener("click", handleStatsCompute);
  }
  if (statsColumnSelect) {
    statsColumnSelect.addEventListener("change", handleStatsCompute);
  }
  if (rangeComputeBtn) {
    rangeComputeBtn.addEventListener("click", handleRangeCompute);
  }
  if (lineWidthSlider) {
    const updateLineWidthLabel = (val)=>{ if (lineWidthValue) lineWidthValue.textContent = `${val.toFixed(1)} px`; };
    lineWidthSlider.addEventListener("input", (e)=>{
      const val = parseFloat(e.target.value) || DEFAULT_LINE_WIDTH;
      globalLineWidth = val;
      updateLineWidthLabel(val);
      if (headers.length) plot(false,true);
    });
    updateLineWidthLabel(parseFloat(lineWidthSlider.value) || DEFAULT_LINE_WIDTH);
  }
  if (archiveLogBtn) {
    archiveLogBtn.addEventListener("click", archiveCurrentLog);
  }
  if (metadataMenuCompare){
    metadataMenuCompare.addEventListener("click", (e)=>{
      e.preventDefault();
      openMetadataModal();
    });
  }
  if (resetYRangeBtn) {
    resetYRangeBtn.addEventListener("click", ()=>{
      lastYRange = null;
      rescaleYToWindow();
    });
  }
  if (performanceTabs) {
    performanceTabs.addEventListener("click", (e)=>{
      const btn = e.target.closest("button");
      if (!btn) return;
      e.preventDefault();
      setPerformanceTab(btn.dataset.tab);
    });
  }
  if (metadataLink) {
    metadataLink.addEventListener("click", (e)=>{ e.preventDefault(); openMetadataModal(); });
  }
  if (metadataClose) {
    metadataClose.addEventListener("click", closeMetadataModal);
  }
  if (metadataModal) {
    metadataModal.addEventListener("click", (e)=>{ if (e.target === metadataModal) closeMetadataModal(); });
  }
  if (metadataMenuCompare){
    metadataMenuCompare.addEventListener("click", (e)=>{
      e.preventDefault();
      openMetadataModal();
    });
  }
  if (shiftLabLink) {
    shiftLabLink.addEventListener("click", (e)=>{ e.preventDefault(); openShiftLabModal(); });
  }
  if (shiftLabClose) shiftLabClose.addEventListener("click", closeShiftLabModal);
  if (shiftLabModal) {
    shiftLabModal.addEventListener("click", (e)=>{ if (e.target === shiftLabModal) closeShiftLabModal(); });
  }
  if (shiftAnalyzeBtn) {
    shiftAnalyzeBtn.addEventListener("click", runShiftLab);
  }
  if (shiftResetBtn) {
    shiftResetBtn.addEventListener("click", resetShiftLabDefaults);
  }
  runShiftLab();
  if (csvCompareFile){
    if (csvCompareFile) {
      csvCompareFile.addEventListener("change", (e) => {
        const file = e.target.files[0] || null;
        if (!file){
          compareLog = null;
          updateCompareInfo();
          plot(false, true);
          return;
        }
        loadComparisonFile(file);
      });
    }
  }

  if (scaleHelpBtn) {
    scaleHelpBtn.addEventListener("click", () => openScaleHelp());
  }
  if (scaleHelpClose) {
    scaleHelpClose.addEventListener("click", () => closeScaleHelp());
  }
  if (scaleHelpModal) {
    scaleHelpModal.addEventListener("click", (e) => {
      if (e.target === scaleHelpModal) closeScaleHelp();
    });
  }
  if (autoScaleBtn) {
    autoScaleBtn.addEventListener("click", autoScaleTraces);
  }
  if (dataAnalysisLink) {
    dataAnalysisLink.addEventListener("click", (e)=>{ e.preventDefault(); openDataAnalysisModal(); });
  }
  if (statsLink) {
    statsLink.addEventListener("click", (e)=>{ e.preventDefault(); openStatsModal(); });
  }
  if (performanceLink) {
    performanceLink.addEventListener("click", (e)=>{ e.preventDefault(); openPerformanceModal(); });
  }
  if (changelogBtn) {
    changelogBtn.addEventListener("click", openChangelog);
  }
  if (changelogClose) {
    changelogClose.addEventListener("click", closeChangelog);
  }
  if (changelogModal) {
    changelogModal.addEventListener("click", (e) => {
      if (e.target === changelogModal) closeChangelog();
    });
  }
  if (dataAnalysisClose) dataAnalysisClose.addEventListener("click", () => closeModal(dataAnalysisModal));
  if (dataAnalysisModal) {
    dataAnalysisModal.addEventListener("click", (e) => {
      if (e.target === dataAnalysisModal) closeModal(dataAnalysisModal);
    });
  }
  if (statsClose) statsClose.addEventListener("click", () => closeModal(statsModal));
  if (statsModal) {
    statsModal.addEventListener("click", (e) => {
      if (e.target === statsModal) closeModal(statsModal);
    });
  }
  if (performanceClose) performanceClose.addEventListener("click", () => closeModal(performanceModal));
  if (performanceModal) {
    performanceModal.addEventListener("click", (e) => {
      if (e.target === performanceModal) closeModal(performanceModal);
    });
  }
  if (hintsBtn) {
    hintsBtn.addEventListener("click", openHints);
  }
  if (hintsClose) {
    hintsClose.addEventListener("click", closeHints);
  }
  if (hintsModal) {
    hintsModal.addEventListener("click", (e) => {
      if (e.target === hintsModal) closeHints();
    });
  }

  // Back to top button
  const toTopBtn = document.getElementById("toTop");
  if (toTopBtn) toTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  
  clearBtn.addEventListener("click", ()=>{
    ySlots.forEach(s=>{ s.enabled=false; s.colIdx=-1; s.scale=0; s.color="#00aaff"; s.ui={}; });
    axisPanel.innerHTML=""; chart.innerHTML=""; fileInfo.classList.add("hidden");
    headers=[]; cols=[]; timeIdx=rpmIdx=-1; xIdx=NaN; snapIndex=null;
    timeRangeMin = 0; timeRangeMax = 0; timeRangeEnabled = false;
    activeTimeSeries = [];
    activeIndexMap = [];
    compareLog = null;
    updateCompareInfo();
    if (csvFile) csvFile.value = "";
    if (csvCompareFile) csvCompareFile.value = "";
    refreshHighlightOptions();
    toastMsg("Cleared page state. Cached CSV retained.","ok");
    primaryLogRaw = "";
    primaryLogName = "";
    primaryLogSize = 0;
    primaryMeta = null;
    lastYRange = null;
    if (archiveLogBtn) archiveLogBtn.disabled = true;
    if (archiveNoteInput) archiveNoteInput.value = "";
    sessionStorage.removeItem("compareState");
    updateMetaSummary();
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
      const href = item.getAttribute("href");
      const text = item.textContent.trim();
      
      // Handle external links (target="_blank") - allow default or open programmatically
      if (item.hasAttribute("target") && item.getAttribute("target") === "_blank") {
        // Check if it's a handled external link
        if (href && href.includes("github.com/Everlasting-dev/ecutek-log-viewer")) {
          e.preventDefault();
          window.open("https://github.com/Everlasting-dev/ecutek-log-viewer", "_blank");
          return;
        }
        if (href && href.includes("ecutek.atlassian.net")) {
          e.preventDefault();
          window.open("https://ecutek.atlassian.net/wiki/spaces/SUPPORT/pages/327698/EcuTek+Knowledge+Base", "_blank");
          return;
        }
        // For other external links, allow default behavior
        return;
      }
      
      e.preventDefault();
      
      // Handle different menu actions
      switch(text) {
        case "Open CSV File":
          document.getElementById("csvFile").click();
          break;
        case "Export Data":
          toastMsg("Export functionality coming soon!", "ok");
          break;
        case "Correlation Lab":
          // Already on correlation lab
          break;
        case "Signal Matrix":
          window.location.href = "index.html";
          break;
        case "GR6 Gear Scope":
          window.location.href = "gear.html";
          break;
        case "About":
          window.location.href = "about.html";
          break;
        case "Data Analysis Suite":
          window.location.href = "analysis.html";
          break;
        case "Documentation":
          window.open("https://github.com/Everlasting-dev/ecutek-log-viewer", "_blank");
          break;
        case "EcuTek Knowledge Base":
          window.open("https://ecutek.atlassian.net/wiki/spaces/SUPPORT/pages/327698/EcuTek+Knowledge+Base", "_blank");
          break;
        default:
          console.log("Menu item clicked:", text, "href:", href);
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
    startClassicLoader();
  }
}

function hideStartupLoading() {
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
    stopClassicLoader();
  }
}

function handleStartupSplash(){
  try {
    const navEntry = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    const shouldShow = !sessionStorage.getItem("splashShown") || (navEntry && navEntry.type === "reload");
    if (shouldShow){
      showStartupLoading();
      sessionStorage.setItem("splashShown","1");
      setTimeout(()=> {
        hideStartupLoading();
        // Extra safety: ensure it's hidden
        const ls = document.getElementById("loadingScreen");
        if (ls) ls.classList.add("hidden");
      }, 1200);
    } else {
      hideStartupLoading();
    }
  } catch(e) {
    console.error("Splash error:", e);
    // Always hide on error
    const ls = document.getElementById("loadingScreen");
    if (ls) ls.classList.add("hidden");
    stopClassicLoader();
  }
}

document.addEventListener("DOMContentLoaded", ()=>{ 
  // Ensure loading screen is hidden on startup (safety check)
  try {
    const ls = document.getElementById("loadingScreen");
    if (ls && !ls.classList.contains("hidden")) {
      ls.classList.add("hidden");
      try { stopClassicLoader(); } catch(e) { console.warn("stopClassicLoader error:", e); }
    }
  } catch(e) {
    console.warn("Loading screen hide error:", e);
  }
  
  try {
    handleStartupSplash();
  } catch(e) {
    console.error("Startup splash error:", e);
    // Ensure loading screen is hidden even if splash fails
    const ls = document.getElementById("loadingScreen");
    if (ls) ls.classList.add("hidden");
  }
  
  // Initialize theme system
  try {
    initTheme();
  } catch(e) {
    console.error("Theme init error:", e);
  }
  
  // Initialize dropdown interactions
  try {
    initDropdowns();
  } catch(e) {
    console.error("Dropdowns init error:", e);
  }
  
  // Add click handler to hide loading screen if stuck
  if (loadingScreen) {
    loadingScreen.addEventListener("click", () => {
      hideLoading();
      toastMsg("Loading cancelled.", "error");
    });
  }
  
  // Add keyboard escape handler
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (loadingScreen && !loadingScreen.classList.contains("hidden")) {
        hideLoading();
        toastMsg("Loading cancelled.", "error");
      } else if (scaleHelpModal && !scaleHelpModal.classList.contains("hidden")) {
        closeScaleHelp();
      } else if (changelogModal && !changelogModal.classList.contains("hidden")) {
        closeChangelog();
      } else if (hintsModal && !hintsModal.classList.contains("hidden")) {
        closeHints();
      } else if (dataAnalysisModal && !dataAnalysisModal.classList.contains("hidden")) {
        closeModal(dataAnalysisModal);
      } else if (statsModal && !statsModal.classList.contains("hidden")) {
        closeModal(statsModal);
      } else if (performanceModal && !performanceModal.classList.contains("hidden")) {
        closeModal(performanceModal);
      }
    }
    saveCompareState();
  });
  updateMetaSummary();
  tryLoadCached(); 
  wireInitialEventListeners(); 
  if (location.hash === "#shift-lab") {
    setTimeout(()=> openShiftLabModal(), 400);
  }
  updateHighlightSummary(0);
  
  // Final safety check: ensure loading screen is hidden after all initialization
  setTimeout(() => {
    const ls = document.getElementById("loadingScreen");
    if (ls && !ls.classList.contains("hidden")) {
      ls.classList.add("hidden");
      stopClassicLoader();
      console.log("Loading screen force-hidden after initialization");
    }
  }, 1500);
});



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
