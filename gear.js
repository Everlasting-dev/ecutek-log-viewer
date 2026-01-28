import { parseCSV, findRpmIndex } from "./parser.js";

const gearFile = document.getElementById("gearFile");
const gearReload = document.getElementById("gearReload");
const gearFileInfo = document.getElementById("gearFileInfo");
const gearPlot = document.getElementById("gearPlot");
const gearStatus = document.getElementById("gearStatus");
const gearModeToggle = document.getElementById("gearModeToggle");
const changelogMenu = document.getElementById("changelogMenu");
const changelogModal = document.getElementById("changelogModal");
const changelogClose = document.getElementById("changelogClose");
const shiftLabModal = document.getElementById("shiftLabModal");
const shiftLabClose = document.getElementById("shiftLabClose");
const shiftLabLink = document.getElementById("shiftLabLink");
const shiftRedline = document.getElementById("shiftRedline");
const shiftFinal = document.getElementById("shiftFinal");
const shiftTire = document.getElementById("shiftTire");
const shiftRatios = document.getElementById("shiftRatios");
const shiftClutchFill = document.getElementById("shiftClutchFill");
const shiftSlip = document.getElementById("shiftSlip");
const shiftAnalyzeBtn = document.getElementById("shiftAnalyzeBtn");
const shiftResetBtn = document.getElementById("shiftResetBtn");
const shiftPlot = document.getElementById("shiftPlot");
const shiftNotes = document.getElementById("shiftNotes");

let headers = [];
let cols = [];
let timeIdx = -1;
let rpmIdx = -1;
let currentMode = "rpm-speed";

function init(){
  initTheme();
  initDropdowns();
  if (gearModeToggle){
    gearModeToggle.addEventListener("click", (e)=>{
      const btn = e.target.closest("button");
      if (!btn) return;
      const mode = btn.dataset.mode;
      if (!mode || mode === currentMode) return;
      currentMode = mode;
      gearModeToggle.querySelectorAll("button").forEach(b=>b.classList.toggle("active", b.dataset.mode === mode));
      renderGearPlot();
    });
  }

  if (gearFile){
    gearFile.addEventListener("change", (e)=>{
      const file = e.target.files?.[0];
      if (!file) return;
      readFile(file);
    });
  }

  if (gearReload){
    gearReload.addEventListener("click", ()=>{
      const cached = sessionStorage.getItem("csvText");
      if (!cached){
        updateStatus("No cached log available. Upload a CSV first.");
        return;
      }
      stageLog(cached, sessionStorage.getItem("csvName") || "cached.csv", Number(sessionStorage.getItem("csvSize")||0));
    });
  }

  if (changelogMenu) changelogMenu.addEventListener("click", (e)=>{ e.preventDefault(); openChangelog(); });
  if (changelogClose) changelogClose.addEventListener("click", closeChangelog);
  if (changelogModal) changelogModal.addEventListener("click", (e)=>{ if (e.target === changelogModal) closeChangelog(); });
  if (shiftLabLink) shiftLabLink.addEventListener("click", (e)=>{ e.preventDefault(); openShiftLabModal(); });
  if (shiftLabClose) shiftLabClose.addEventListener("click", closeShiftLabModal);
  if (shiftLabModal) shiftLabModal.addEventListener("click", (e)=>{ if (e.target === shiftLabModal) closeShiftLabModal(); });
  if (shiftAnalyzeBtn) shiftAnalyzeBtn.addEventListener("click", runShiftLab);
  if (shiftResetBtn) shiftResetBtn.addEventListener("click", resetShiftLabDefaults);

  const cached = sessionStorage.getItem("csvText");
  if (cached){
    stageLog(cached, sessionStorage.getItem("csvName") || "cached.csv", Number(sessionStorage.getItem("csvSize")||0));
  } else {
    updateStatus("Load a log to visualize GR6 data.");
  }
}

function initDropdowns(){
  const items = document.querySelectorAll(".dropdown-item");
  items.forEach(item=>{
    item.addEventListener("click",(e)=>{
      const label = item.textContent.trim();
      if (label === "Open CSV File"){
        e.preventDefault();
        gearFile?.click();
      } else if (label === "Export Data"){
        e.preventDefault();
        updateStatus("Export coming soon.");
      } else if (label === "Recent Files"){
        e.preventDefault();
        updateStatus("Recent file list coming soon.");
      }
    });
  });
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
    icon.innerHTML = '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>';
    label.textContent = "Light";
  }
}

function openChangelog(){
  if (changelogModal) changelogModal.classList.remove("hidden");
}

function closeChangelog(){
  if (changelogModal) changelogModal.classList.add("hidden");
}

function openShiftLabModal(){
  if (shiftLabModal) {
    shiftLabModal.classList.remove("hidden");
    runShiftLab();
  }
}

function closeShiftLabModal(){
  if (shiftLabModal) shiftLabModal.classList.add("hidden");
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
  const mphConstant = 1056;
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
    dropNotes.push(`G${i+1}→G${i+2}: shift @ ${redline.toFixed(0)} rpm → lands near ${dropRpm.toFixed(0)} rpm.`);
  }
  const clutchFill = Number(shiftClutchFill?.value) || 90;
  const slipThreshold = Number(shiftSlip?.value) || 6;
  const userNotes = [
    `Clutch fill reminder: ${clutchFill} ms; keep torque cuts shorter than this.`,
    `Wheel slip target ≤ ${slipThreshold}% for launch + shifts.`
  ];
  const combined = [...dropNotes, ...userNotes];
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

function readFile(file){
  const reader = new FileReader();
  reader.onerror = ()=> updateStatus("Failed to read file.");
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
    if (gearFileInfo) gearFileInfo.textContent = `Cached: ${name} · ${fmtBytes(size)}`;
    renderGearPlot();
  }catch(err){
    updateStatus(err.message || "Failed to parse CSV.");
  }
}

function renderGearPlot(){
  if (!gearPlot){
    updateStatus("Plot container missing.");
    return;
  }
  if (!headers.length){
    updateStatus("Load a log to visualize GR6 data.");
    return;
  }
  if (currentMode === "rpm-speed"){
    renderRpmSpeedPlot();
  } else if (currentMode === "timeline") {
    renderTimelinePlot();
  } else if (currentMode === "shift-points") {
    renderShiftPointsPlot();
  } else {
    renderTorqueSlipPlot();
  }
}

function renderRpmSpeedPlot(){
  const rpmColumn = rpmIdx >=0 ? cols[rpmIdx] : null;
  const speedIdx = detectSpeedColumn();
  const speedColumn = speedIdx >=0 ? cols[speedIdx] : null;
  if (!rpmColumn || !speedColumn){
    updateStatus("Need Engine RPM and Vehicle Speed columns for the RPM vs Speed plot.");
    Plotly.purge(gearPlot);
    return;
  }
  const points = [];
  for (let i=0;i<rpmColumn.length;i++){
    const r = rpmColumn[i];
    const s = speedColumn[i];
    if (Number.isFinite(r) && Number.isFinite(s)){
      points.push({ x:s, y:r });
    }
  }
  if (!points.length){
    updateStatus("No overlapping RPM/Speed data.");
    Plotly.purge(gearPlot);
    return;
  }
  Plotly.newPlot(gearPlot, [{
    type:"scatter",
    mode:"lines",
    x: points.map(p=>p.x),
    y: points.map(p=>p.y),
    line:{ width:1.5, color:"#34a0ff" },
    name:"RPM vs Speed"
  }], {
    paper_bgcolor:"rgba(0,0,0,0)",
    plot_bgcolor:"rgba(0,0,0,0)",
    margin:{l:60,r:20,t:30,b:60},
    xaxis:{title:`Speed (${headers[speedIdx]})`, rangemode:"tozero"},
    yaxis:{title: headers[rpmIdx] || "RPM"},
    showlegend:false,
    dragmode:false,
    hovermode:false
  }, plotConfig());
  updateStatus(`Points plotted: ${points.length}. Use Timeline mode to inspect shift deltas.`);
}

function renderTimelinePlot(){
  if (!Number.isFinite(timeIdx)){
    updateStatus("No Time axis detected in this log.");
    Plotly.purge(gearPlot);
    return;
  }
  const time = cols[timeIdx];
  const rpmColumn = rpmIdx >=0 ? cols[rpmIdx] : null;
  const speedIdx = detectSpeedColumn();
  const speedColumn = speedIdx >=0 ? cols[speedIdx] : null;
  const gearActualIdx = detectGearColumn("actual");
  const gearDesiredIdx = detectGearColumn("desired");
  const traces = [];

  if (rpmColumn){
    traces.push({
      type:"scatter",
      mode:"lines",
      x: time,
      y: rpmColumn,
      name: headers[rpmIdx] || "RPM",
      line:{width:1.4,color:"#2aa6ff"}
    });
  }
  if (speedColumn){
    traces.push({
      type:"scatter",
      mode:"lines",
      x: time,
      y: speedColumn,
      name: headers[speedIdx],
      line:{width:1,color:"#ffaa2a",dash:"dot"}
    });
  }
  if (gearActualIdx >=0){
    traces.push({
      type:"scatter",
      mode:"lines",
      x: time,
      y: cols[gearActualIdx],
      name: headers[gearActualIdx] || "Gear Actual",
      yaxis:"y2",
      line:{width:1.4,color:"#7bdc7b"}
    });
  }
  if (gearDesiredIdx >=0){
    traces.push({
      type:"scatter",
      mode:"lines",
      x: time,
      y: cols[gearDesiredIdx],
      name: headers[gearDesiredIdx] || "Gear Desired",
      yaxis:"y2",
      line:{width:1.4,color:"#ff5aa2",dash:"dash"}
    });
  }

  if (!traces.length){
    updateStatus("Need RPM or Gear columns for the timeline plot.");
    Plotly.purge(gearPlot);
    return;
  }

  Plotly.newPlot(gearPlot, traces, {
    paper_bgcolor:"rgba(0,0,0,0)",
    plot_bgcolor:"rgba(0,0,0,0)",
    margin:{l:60,r:60,t:30,b:60},
    xaxis:{title:"Time (s)"},
    yaxis:{title:"RPM / Speed", rangemode:"tozero"},
    yaxis2:{
      title:"Gear",
      overlaying:"y",
      side:"right",
      rangemode:"tozero",
      tick0:0,
      dtick:1,
      showgrid:false
    },
    dragmode:false,
    hovermode:false
  }, plotConfig());
  updateStatus("Timeline plotted. Gear traces use the right axis.");
}

function renderShiftPointsPlot(){
  if (!Number.isFinite(timeIdx)){
    updateStatus("No Time axis detected for shift points.");
    Plotly.purge(gearPlot);
    return;
  }
  const time = cols[timeIdx];
  const rpmColumn = rpmIdx >=0 ? cols[rpmIdx] : null;
  const gearActualIdx = detectGearColumn("actual");
  const targetIdx = detectTargetRpmColumn();
  if (!rpmColumn || gearActualIdx < 0){
    updateStatus("Need RPM and Gear Actual columns for shift points.");
    Plotly.purge(gearPlot);
    return;
  }
  const shiftTimes = [];
  const shiftRpms = [];
  const shiftLabels = [];
  for (let i = 1; i < time.length; i++){
    const g0 = cols[gearActualIdx]?.[i-1];
    const g1 = cols[gearActualIdx]?.[i];
    const r1 = rpmColumn[i];
    const t1 = time[i];
    if (!Number.isFinite(g0) || !Number.isFinite(g1) || !Number.isFinite(r1) || !Number.isFinite(t1)) continue;
    if (g1 > g0){
      shiftTimes.push(t1);
      shiftRpms.push(r1);
      shiftLabels.push(`${g0}→${g1}`);
    }
  }
  if (!shiftTimes.length){
    updateStatus("No gear upshifts detected for shift points.");
    Plotly.purge(gearPlot);
    return;
  }
  const traces = [{
    type:"scatter",
    mode:"lines",
    x: time,
    y: rpmColumn,
    name: headers[rpmIdx] || "RPM",
    line:{ width:1.2, color:"#2aa6ff" }
  },{
    type:"scatter",
    mode:"markers+text",
    x: shiftTimes,
    y: shiftRpms,
    text: shiftLabels,
    textposition:"top center",
    name:"Shift Points",
    marker:{ size:7, color:"#18e06f" }
  }];
  if (targetIdx >= 0){
    traces.push({
      type:"scatter",
      mode:"lines",
      x: time,
      y: cols[targetIdx],
      name: headers[targetIdx],
      line:{ width:1, color:"#ffb347", dash:"dash" }
    });
  } else {
    const sorted = [...shiftRpms].sort((a,b)=>a-b);
    const median = sorted[Math.floor(sorted.length/2)];
    traces.push({
      type:"scatter",
      mode:"lines",
      x: [time[0], time[time.length-1]],
      y: [median, median],
      name:"Target RPM (est.)",
      line:{ width:1, color:"#ffb347", dash:"dash" }
    });
  }
  Plotly.newPlot(gearPlot, traces, {
    paper_bgcolor:"rgba(0,0,0,0)",
    plot_bgcolor:"rgba(0,0,0,0)",
    margin:{l:60,r:20,t:30,b:60},
    xaxis:{title:"Time (s)", fixedrange:true},
    yaxis:{title: headers[rpmIdx] || "RPM", fixedrange:true},
    showlegend:true,
    dragmode:false,
    hovermode:false
  }, plotConfig());
  updateStatus(`Shift points detected: ${shiftTimes.length}.`);
}

function renderTorqueSlipPlot(){
  if (!Number.isFinite(timeIdx)){
    updateStatus("No Time axis detected for torque/slip.");
    Plotly.purge(gearPlot);
    return;
  }
  const time = cols[timeIdx];
  const torqueIdx = detectTorqueColumn();
  const slipIdx = detectSlipColumn();
  if (torqueIdx < 0 && slipIdx < 0){
    updateStatus("No Torque Intervention or Slip columns detected.");
    Plotly.purge(gearPlot);
    return;
  }
  const traces = [];
  if (torqueIdx >= 0){
    traces.push({
      type:"scatter",
      mode:"lines",
      x: time,
      y: cols[torqueIdx],
      name: headers[torqueIdx],
      line:{ width:1.3, color:"#ff6b6b" }
    });
  }
  if (slipIdx >= 0){
    traces.push({
      type:"scatter",
      mode:"lines",
      x: time,
      y: cols[slipIdx],
      name: headers[slipIdx],
      yaxis: torqueIdx >= 0 ? "y2" : "y",
      line:{ width:1.2, color:"#8bd8ff", dash:"dot" }
    });
  }
  Plotly.newPlot(gearPlot, traces, {
    paper_bgcolor:"rgba(0,0,0,0)",
    plot_bgcolor:"rgba(0,0,0,0)",
    margin:{l:60,r:60,t:30,b:60},
    xaxis:{title:"Time (s)", fixedrange:true},
    yaxis:{title: torqueIdx >= 0 ? headers[torqueIdx] : "Slip", fixedrange:true},
    yaxis2: torqueIdx >= 0 && slipIdx >= 0 ? {
      title: headers[slipIdx],
      overlaying:"y",
      side:"right",
      showgrid:false
    } : undefined,
    showlegend:true,
    dragmode:false,
    hovermode:false
  }, plotConfig());
  updateStatus("Torque intervention and slip timeline rendered.");
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

function detectGearColumn(kind){
  if (!headers.length) return -1;
  const regex = kind === "desired"
    ? /(gear|gr6).*(desired|target|command)/i
    : /(gear|gr6).*(actual|state|current)/i;
  return headers.findIndex(h => regex.test(h));
}

function detectTargetRpmColumn(){
  const patterns = [/target.*rpm/i, /shift.*target/i, /upshift.*rpm/i];
  return detectColumnByPatterns(patterns);
}

function detectTorqueColumn(){
  const patterns = [
    /torque.*(reduction|intervention|limit|cut)/i,
    /(torque).*(request|cmd|command)/i
  ];
  return detectColumnByPatterns(patterns);
}

function detectSlipColumn(){
  const patterns = [
    /wheel.*slip/i,
    /traction.*slip/i,
    /clutch.*slip/i,
    /\bslip\b/i
  ];
  return detectColumnByPatterns(patterns);
}

function detectColumnByPatterns(patterns){
  for (const pattern of patterns){
    const idx = headers.findIndex(h => pattern.test(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

function plotConfig(){
  return {
    displaylogo:false,
    responsive:true,
    scrollZoom:false,
    staticPlot:false,
    doubleClick:false,
    displayModeBar:false
  };
}

function updateStatus(msg){
  if (gearStatus) gearStatus.textContent = msg;
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

document.addEventListener("DOMContentLoaded", init);


