import { parseCSV, findTimeIndex, findRpmIndex } from "./parser.js";

const el = (id) => document.getElementById(id);

const fileInput = el("analysisFile");
const reloadBtn = el("analysisReload");
const fileInfo = el("analysisFileInfo");
const metaContainer = el("analysisMeta");
const archiveNoteInput = el("analysisArchiveNote");
const archiveBtn = el("analysisArchiveBtn");
const derivedSelectA = el("analysisDerivedA");
const derivedSelectB = el("analysisDerivedB");
const derivedOp = el("analysisDerivedOp");
const derivedName = el("analysisDerivedName");
const derivedBtn = el("analysisDerivedBtn");
const derivedResult = el("analysisDerivedResult");
const statsSelect = el("analysisStatsSelect");
const statsSummary = el("analysisStatsSummary");
const rangeMinInput = el("analysisRangeMin");
const rangeMaxInput = el("analysisRangeMax");
const rangeBtn = el("analysisRangeBtn");
const perfBtn = el("analysisPerfRefresh");
const perfSummary = el("analysisPerfSummary");
const diagSummary = el("analysisDiagSummary");
const toast = el("analysisToast");

let headers = [];
let cols = [];
let timeIdx = -1;
let rpmIdx = -1;

function init(){
  initTheme();
  if (fileInput){
    fileInput.addEventListener("change", (e)=>{
      const file = e.target.files?.[0];
      if (!file) return;
      readFile(file);
    });
  }
  if (reloadBtn){
    reloadBtn.addEventListener("click", ()=>{
      const cached = sessionStorage.getItem("csvText");
      if (!cached){
        showToast("No cached log available.", true);
        return;
      }
      stageLog(cached, sessionStorage.getItem("csvName") || "cached.csv", Number(sessionStorage.getItem("csvSize")||0));
    });
  }
  if (archiveBtn){
    archiveBtn.addEventListener("click", handleArchive);
  }
  if (derivedBtn){
    derivedBtn.addEventListener("click", handleDerived);
  }
  if (statsSelect){
    statsSelect.addEventListener("change", renderStatsSection);
  }
  if (rangeBtn){
    rangeBtn.addEventListener("click", handleRangeCompute);
  }
  if (perfBtn){
    perfBtn.addEventListener("click", renderPerformance);
  }

  const cached = sessionStorage.getItem("csvText");
  if (cached){
    stageLog(cached, sessionStorage.getItem("csvName") || "cached.csv", Number(sessionStorage.getItem("csvSize")||0));
  } else {
    showToast("Load a CSV to begin analysis.", true);
  }
}

function readFile(file){
  const reader = new FileReader();
  reader.onerror = ()=> showToast("Failed to read file.", true);
  reader.onload = (ev)=>{
    const text = String(ev.target.result || "");
    sessionStorage.setItem("csvText", text);
    sessionStorage.setItem("csvName", file.name);
    sessionStorage.setItem("csvSize", String(file.size));
    stageLog(text, file.name, file.size);
  };
  reader.readAsText(file);
}

function stageLog(text, name, size){
  try{
    const parsed = parseCSV(text);
    headers = parsed.headers;
    cols = parsed.cols;
    timeIdx = parsed.timeIdx;
    rpmIdx = findRpmIndex(headers);
    if (fileInfo) fileInfo.textContent = `Cached: ${name} · ${fmtBytes(size)}`;
    populateSelects();
    renderAll();
    showToast("Log ready.", false);
  }catch(err){
    showToast(err.message || "Failed to parse CSV.", true);
  }
}

function renderAll(){
  renderMetadata();
  renderStatsSection();
  renderPerformance();
  renderDiagnostics();
}

function renderMetadata(){
  if (!metaContainer) return;
  if (!headers.length || !cols.length){
    metaContainer.innerHTML = "<span>Load a log to inspect metadata.</span>";
    return;
  }
  const text = sessionStorage.getItem("csvText") || "";
  const meta = extractHeaderMeta(text);
  const time = cols[timeIdx] || [];
  const finiteTime = time.filter(Number.isFinite);
  const samples = finiteTime.length;
  const duration = samples >= 2 ? finiteTime[finiteTime.length-1] - finiteTime[0] : 0;
  const sampleRate = duration > 0 ? samples / duration : 0;
  const rpmStats = rpmIdx >=0 ? computeBasicStats((cols[rpmIdx] || []).filter(Number.isFinite)) : null;
  const detectedSpeedIdx = detectSpeedColumn();
  const speedLabel = detectedSpeedIdx >=0 ? headers[detectedSpeedIdx] : "—";
  const shiftNotes = summarizeShifts();
  const protectionNotes = summarizeProtection();
  const wheelNotes = summarizeWheelSpeeds();

  metaContainer.innerHTML = `
    <div class="meta-pair"><span>VIN</span><strong>${meta.VIN || meta["Vehicle Identification Number"] || "—"}</strong></div>
    <div class="meta-pair"><span>ECU SW</span><strong>${meta["ECU Software Number"] || meta["Software Number"] || "—"}</strong></div>
    <div class="meta-pair"><span>Dongle</span><strong>${meta["Programming Dongle"] || meta["Dongle ID"] || "—"}</strong></div>
    <div class="meta-pair"><span>Samples</span><strong>${samples ? samples.toLocaleString() : "—"}</strong></div>
    <div class="meta-pair"><span>Duration</span><strong>${duration ? duration.toFixed(2)+" s" : "—"}</strong></div>
    <div class="meta-pair"><span>Sample Rate</span><strong>${sampleRate ? sampleRate.toFixed(1)+" Hz" : "—"}</strong></div>
    <div class="meta-pair"><span>RPM Range</span><strong>${rpmStats ? `${rpmStats.min.toFixed(0)} - ${rpmStats.max.toFixed(0)}` : "—"}</strong></div>
    <div class="meta-pair"><span>Speed Source</span><strong>${speedLabel}</strong></div>
    <div class="meta-block">
      <h5>Shift Deltas</h5>
      <ul>${shiftNotes.length ? shiftNotes.map(note=>`<li>${note}</li>`).join("") : "<li>No GR6 shifts detected.</li>"}</ul>
    </div>
    <div class="meta-block">
      <h5>Traction / Protection</h5>
      <ul>${[...protectionNotes, ...wheelNotes].map(note=>`<li>${note}</li>`).join("") || "<li>No slip/torque interventions logged.</li>"}</ul>
    </div>
  `;
}

function populateSelects(){
  const nodes = [statsSelect, derivedSelectA, derivedSelectB];
  nodes.forEach(select=>{
    if (!select) return;
    select.innerHTML = "";
    headers.forEach((header, idx)=>{
      const option = document.createElement("option");
      option.value = String(idx);
      option.textContent = header;
      select.appendChild(option);
    });
  });
}

function renderStatsSection(){
  if (!statsSelect || !statsSummary){
    return;
  }
  const idx = Number(statsSelect.value);
  if (!Number.isFinite(idx) || !cols[idx]){
    statsSummary.textContent = "Select a column to display statistics.";
    return;
  }
  const stats = computeBasicStats(cols[idx]);
  statsSummary.innerHTML = stats
    ? renderStatsTable(stats)
    : "Not enough numeric samples.";
}

function handleDerived(){
  if (!derivedSelectA || !derivedSelectB || !derivedResult){
    return;
  }
  const idxA = Number(derivedSelectA.value);
  const idxB = Number(derivedSelectB.value);
  if (!Number.isFinite(idxA) || !Number.isFinite(idxB)){
    derivedResult.textContent = "Select two valid channels.";
    return;
  }
  const seriesA = cols[idxA];
  const seriesB = cols[idxB];
  const len = Math.min(seriesA?.length || 0, seriesB?.length || 0);
  const op = derivedOp?.value || "subtract";
  const output = [];
  for (let i=0;i<len;i++){
    const a = seriesA[i];
    const b = seriesB[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)){
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
  const preview = output.filter(Number.isFinite).slice(0, 10).map(v=>v.toFixed(3)).join(", ");
  const label = derivedName?.value?.trim() || `${headers[idxA]} ${op} ${headers[idxB]}`;
  derivedResult.innerHTML = `<strong>${label}</strong>${stats ? renderStatsTable(stats) : "<p>No numeric samples.</p>"}<p>Preview: ${preview || "N/A"}</p>`;
}

function handleRangeCompute(){
  if (!statsSelect || !statsSummary){
    return;
  }
  const idx = Number(statsSelect.value);
  if (!Number.isFinite(idx) || !cols[idx]){
    statsSummary.textContent = "Select a column first.";
    return;
  }
  const min = parseFloat(rangeMinInput?.value);
  const max = parseFloat(rangeMaxInput?.value);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max){
    statsSummary.textContent = "Provide a valid min/max range.";
    return;
  }
  const series = cols[idx];
  const inside = series.filter(v => Number.isFinite(v) && v >= min && v <= max).length;
  const pct = series.length ? (inside / series.length) * 100 : 0;
  statsSummary.innerHTML = `${renderStatsTable(computeBasicStats(series))}<p>${inside} samples inside ${min} – ${max} (${pct.toFixed(2)}%).</p>`;
}

function renderPerformance(){
  if (!perfSummary){
    return;
  }
  if (!headers.length){
    perfSummary.textContent = "Load a log to compute benchmarks.";
    return;
  }
  const speedIdx = detectSpeedColumn();
  if (speedIdx < 0){
    perfSummary.textContent = "No speed column detected.";
    return;
  }
  const series = getSeries(speedIdx);
  if (!series){
    perfSummary.textContent = "Speed data missing in current window.";
    return;
  }
  const isKmh = /km/i.test(headers[speedIdx]) && !/mph/i.test(headers[speedIdx]);
  const t0_60 = computeTimeToSpeed(series, 0, isKmh ? 100 : 60);
  const t60_130 = computeTimeToSpeed(series, isKmh ? 100 : 60, isKmh ? 210 : 130);
  const t100_200 = computeTimeToSpeed(series, isKmh ? 100 : 62, isKmh ? 200 : 124);
  const peakG = computePeakG(series, isKmh);
  perfSummary.innerHTML = `
    <div class="perf-grid">
      <div><span>Speed</span><strong>${headers[speedIdx]}</strong></div>
      <div><span>0-${isKmh ? "100 km/h" : "60 mph"}</span><strong>${formatTime(t0_60)}</strong></div>
      <div><span>${isKmh ? "100-210 km/h" : "60-130 mph"}</span><strong>${formatTime(t60_130)}</strong></div>
      <div><span>${isKmh ? "100-200 km/h" : "60-124 mph"}</span><strong>${formatTime(t100_200)}</strong></div>
      <div><span>Peak accel</span><strong>${peakG.toFixed(3)} g</strong></div>
    </div>
  `;
}

function renderDiagnostics(){
  if (!diagSummary){
    return;
  }
  const notes = [
    ...summarizeShifts(),
    ...summarizeProtection(),
    ...summarizeWheelSpeeds()
  ];
  diagSummary.innerHTML = notes.length ? `<ul>${notes.map(n=>`<li>${n}</li>`).join("")}</ul>` : "No GR6 / diagnostic channels detected.";
}

function handleArchive(){
  if (!headers.length || !cols.length){
    showToast("Load a log before archiving.", true);
    return;
  }
  const note = archiveNoteInput?.value?.trim() || "";
  const text = sessionStorage.getItem("csvText") || "";
  const stamp = new Date().toISOString().replace(/[-:]/g,"").replace(/\..+/,"");
  const base = (sessionStorage.getItem("csvName") || "log").replace(/\.[^.]+$/,"");
  const safeBase = base.replace(/[^a-z0-9-_]/gi,"_").slice(0,40) || "log";
  const noteSlug = note ? "_" + note.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,20) : "";
  const payload = note ? `# CloudNote: ${note}\n${text}` : text;
  if (window.showSaveFilePicker){
    window.showSaveFilePicker({
      suggestedName: `logs_${stamp}_${safeBase}${noteSlug}.csv`,
      types:[{description:"CSV Log", accept:{"text/csv":[".csv"]}}]
    }).then(fileHandle=>{
      if (!fileHandle) return;
      return fileHandle.createWritable().then(writable=>{
        writable.write(payload).then(()=>writable.close().then(()=>{
          showToast("Archive saved. Drop it into logs/ and push via logvault/<date>-<rand>.", false);
        }));
      });
    }).catch(err=>{
      if (err && err.name === "AbortError"){
        showToast("Archive cancelled.", true);
      } else {
        showToast("Save failed. Copying content to clipboard instead.", true);
        navigator.clipboard.writeText(payload).then(()=>{
          showToast("CSV copied to clipboard. Create the file in logs/ manually.", false);
        }).catch(()=> showToast("Clipboard copy failed.", true));
      }
    });
    return;
  }
  navigator.clipboard.writeText(payload).then(()=>{
    showToast("CSV copied to clipboard. Create the file under logs/ and commit.", false);
  }).catch(()=>{
    showToast("Clipboard not available. Please copy manually from developer tools.", true);
  });
}

function getSeries(idx){
  if (!Number.isFinite(idx) || idx < 0 || !cols[idx] || !Number.isFinite(timeIdx)) return null;
  return { x: cols[timeIdx], y: cols[idx] };
}

function computeBasicStats(values){
  const cleaned = (values || []).filter(Number.isFinite);
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

function detectSpeedColumn(){
  const patterns = [
    /vehicle\s*speed.*mph/i,
    /vehicle\s*speed/i,
    /\bmph\b/i,
    /km\/?h|kmh|kph/i,
    /\bspeed\b/i
  ];
  for (const pattern of patterns){
    const idx = headers.findIndex(h => pattern.test(h));
    if (idx !== -1) return idx;
  }
  return -1;
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
        return t1 + frac*(t2 - t1) - startTime;
      }
    }
  }
  return null;
}

function computePeakG(series, isKmh){
  const factor = isKmh ? 0.277778 : 0.44704;
  let peak = 0;
  for (let i=1;i<series.y.length;i++){
    const v1 = series.y[i-1];
    const v2 = series.y[i];
    const t1 = series.x[i-1];
    const t2 = series.x[i];
    if (!Number.isFinite(v1) || !Number.isFinite(v2) || !Number.isFinite(t1) || !Number.isFinite(t2)) continue;
    const acc = ((v2 - v1) * factor) / Math.max(0.0001, (t2 - t1));
    peak = Math.max(peak, acc);
  }
  return peak / 9.81;
}

function summarizeShifts(){
  const gearIdx = headers.findIndex(h => /gear.*actual/i.test(h));
  if (gearIdx < 0 || rpmIdx < 0 || !Number.isFinite(timeIdx)) return [];
  const gear = cols[gearIdx];
  const rpm = cols[rpmIdx];
  const time = cols[timeIdx];
  const notes = [];
  for (let i=1;i<gear.length;i++){
    const prev = gear[i-1];
    const curr = gear[i];
    if (!Number.isFinite(prev) || !Number.isFinite(curr)) continue;
    if (Math.round(curr) > Math.round(prev)){
      const before = findLastFinite(rpm, i-1);
      const after = findFirstFinite(rpm, i);
      if (!Number.isFinite(before) || !Number.isFinite(after)) continue;
      notes.push(`G${Math.round(prev)}→G${Math.round(curr)} @ ${before.toFixed(0)} rpm (drops ${(before-after).toFixed(0)} rpm, lands ${after.toFixed(0)} rpm)`);
    }
  }
  return notes;
}

function summarizeProtection(){
  const notes = [];
  const torqueIdx = headers.findIndex(h => /torque/i.test(h) && /(limit|reduc|cut)/i.test(h));
  if (torqueIdx >= 0){
    const series = cols[torqueIdx];
    const triggered = (series || []).filter(v => Number.isFinite(v) && v > 0).length;
    if (triggered) notes.push(`Torque intervention fired ${triggered} samples (${headers[torqueIdx]})`);
  }
  const slipIdx = headers.findIndex(h => /slip|traction/i.test(h));
  if (slipIdx >= 0){
    const series = cols[slipIdx];
    const slipEvents = (series || []).filter(v => Number.isFinite(v) && v >= 5).length;
    if (slipEvents) notes.push(`Wheel slip exceeded target on ${slipEvents} samples (${headers[slipIdx]})`);
  }
  const milIdx = headers.findIndex(h => /mil|dtc|flag|malf/i.test(h));
  if (milIdx >=0){
    const series = cols[milIdx];
    const triggered = (series || []).some(v => Number.isFinite(v) && v !== 0);
    if (triggered) notes.push(`${headers[milIdx]} flagged during the run.`);
  }
  return notes;
}

function summarizeWheelSpeeds(){
  const notes = [];
  const frontIdx = headers.findIndex(h => /(front|f\/?)/i.test(h) && /wheel.*speed/i.test(h));
  const rearIdx = headers.findIndex(h => /(rear|r\/?)/i.test(h) && /wheel.*speed/i.test(h));
  if (frontIdx >=0 && rearIdx >=0){
    const front = cols[frontIdx];
    const rear = cols[rearIdx];
    let maxDiff = 0;
    for (let i=0;i<front.length;i++){
      const f = front[i];
      const r = rear[i];
      if (!Number.isFinite(f) || !Number.isFinite(r)) continue;
      maxDiff = Math.max(maxDiff, Math.abs(f-r));
    }
    notes.push(`Front vs rear wheel speed delta peaks at ${maxDiff.toFixed(2)} (${headers[frontIdx]} vs ${headers[rearIdx]})`);
  }
  return notes;
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

function extractHeaderMeta(text){
  const meta = {};
  const lines = (text || "").split(/\r?\n/);
  for (const line of lines){
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.startsWith("#")) break;
    const payload = trimmed.replace(/^#+/, "").trim();
    if (!payload) continue;
    const split = payload.split(/[:=]/);
    if (split.length >= 2){
      const key = split.shift().trim();
      const value = split.join(":").trim();
      if (key) meta[key] = value;
    }
  }
  return meta;
}

function formatTime(value){
  return Number.isFinite(value) ? `${value.toFixed(3)} s` : "N/A";
}

function fmtBytes(n){
  if (!Number.isFinite(n)) return "—";
  const units = ["B","KB","MB","GB"];
  let idx = 0;
  let value = n;
  while (value >= 1024 && idx < units.length-1){
    value /= 1024;
    idx++;
  }
  return `${value.toFixed(1)} ${units[idx]}`;
}

function initTheme(){
  const toggle = document.getElementById("themeToggle");
  const icon = document.getElementById("themeIcon");
  const text = document.getElementById("themeText");
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeUI(saved, icon, text);
  if (toggle){
    toggle.addEventListener("click", ()=>{
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      updateThemeUI(next, icon, text);
    });
  }
}

function updateThemeUI(theme, icon, label){
  if (!icon || !label) return;
  if (theme === "light"){
    icon.innerHTML = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>';
    label.textContent = "Dark";
  } else {
    icon.innerHTML = '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z"/>';
    label.textContent = "Light";
  }
}

function showToast(message, isError){
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  toast.style.background = isError ? "#3b0b0b" : "#0b3b18";
  toast.style.borderColor = isError ? "#742020" : "#1a6a36";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> toast.classList.add("hidden"), 3200);
}

document.addEventListener("DOMContentLoaded", init);


