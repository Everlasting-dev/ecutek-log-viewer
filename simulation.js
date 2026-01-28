import { parseCSV, findTimeIndex, numericColumns } from "./parser.js";

const els = {
  file: document.getElementById("simFile"),
  reload: document.getElementById("simReload"),
  fileInfo: document.getElementById("simFileInfo"),
  toast: document.getElementById("simToast"),
  plotA: document.getElementById("simPlotA"),
  plotB: document.getElementById("simPlotB"),
  plotBCard: document.getElementById("simPlotBCard"),
  timeSlider: document.getElementById("simTimeSlider"),
  timeInput: document.getElementById("simTimeInput"),
  timeDisplay: document.getElementById("simTimeDisplay"),
  timeDisplayModal: document.getElementById("simTimeDisplayModal"),
  playToggle: document.getElementById("simPlayToggle"),
  playToggleMain: document.getElementById("simPlayToggleMain"),
  openPlayer: document.getElementById("simOpenPlayer"),
  playerModal: document.getElementById("simPlayerModal"),
  playerClose: document.getElementById("simPlayerClose"),
  speed: document.getElementById("simSpeed"),
  filterA: document.getElementById("simFilterA"),
  filterB: document.getElementById("simFilterB"),
  paramListA: document.getElementById("simParamListA"),
  paramListB: document.getElementById("simParamListB"),
  selectAllA: document.getElementById("simSelectAllA"),
  selectNoneA: document.getElementById("simSelectNoneA"),
  selectAllB: document.getElementById("simSelectAllB"),
  selectNoneB: document.getElementById("simSelectNoneB"),
  graphBToggle: document.getElementById("simGraphBToggle"),
  paramsBCard: document.getElementById("simParamsBCard"),
  readoutA: document.getElementById("simReadoutA"),
  readoutB: document.getElementById("simReadoutB"),
  readoutBCard: document.getElementById("simReadoutBCard"),
  changelogMenu: document.getElementById("changelogMenu"),
  changelogModal: document.getElementById("changelogModal"),
  changelogClose: document.getElementById("changelogClose"),
  shiftLabModal: document.getElementById("shiftLabModal"),
  shiftLabClose: document.getElementById("shiftLabClose"),
  shiftLabLink: document.getElementById("shiftLabLink"),
  shiftRedline: document.getElementById("shiftRedline"),
  shiftFinal: document.getElementById("shiftFinal"),
  shiftTire: document.getElementById("shiftTire"),
  shiftRatios: document.getElementById("shiftRatios"),
  shiftClutchFill: document.getElementById("shiftClutchFill"),
  shiftSlip: document.getElementById("shiftSlip"),
  shiftAnalyzeBtn: document.getElementById("shiftAnalyzeBtn"),
  shiftResetBtn: document.getElementById("shiftResetBtn"),
  shiftPlot: document.getElementById("shiftPlot"),
  shiftNotes: document.getElementById("shiftNotes"),
};

const S = { headers: [], cols: [], timeIdx: -1, name: "", size: 0, ready: false };
const sim = {
  selectedA: [],
  selectedB: [],
  markerTraceA: [],
  markerTraceB: [],
  currentTime: 0,
  playing: false,
  lastTs: 0,
  speed: 1,
  minTime: 0,
  maxTime: 0,
  builtA: false,
  builtB: false,
  graphBEnabled: false,
  openedOnce: false,
};

const toast = (m, t = "error") => {
  if (!els.toast) return;
  els.toast.textContent = m;
  els.toast.classList.remove("hidden");
  els.toast.style.background = t === "error" ? "#3b0b0b" : "#0b3b18";
  els.toast.style.borderColor = t === "error" ? "#742020" : "#1a6a36";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (els.toast.style.display = "none"), 3500);
};

function initTheme() {
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  const themeText = document.getElementById("themeText");
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeUI(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const newTheme = currentTheme === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
      updateThemeUI(newTheme);
      applyTheme(newTheme === "light", [els.plotA, els.plotB].filter(Boolean));
    });
  }
}

function updateThemeUI(theme) {
  const themeIcon = document.getElementById("themeIcon");
  const themeText = document.getElementById("themeText");
  if (!themeIcon || !themeText) return;
  if (theme === "light") {
    themeIcon.innerHTML = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>';
    themeText.textContent = "Dark";
  } else {
    themeIcon.innerHTML = '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>';
    themeText.textContent = "Light";
  }
}

function applyTheme(isLight, targets) {
  const template = isLight ? "plotly_white" : "plotly_dark";
  const cs = getComputedStyle(document.documentElement);
  const paper = cs.getPropertyValue("--plot-paper").trim();
  const plot = cs.getPropertyValue("--plot-bg").trim();
  const text = cs.getPropertyValue("--text").trim();
  targets.forEach((gd) => {
    if (!gd || !gd._fullLayout) return;
    Plotly.relayout(gd, {
      template,
      paper_bgcolor: paper,
      plot_bgcolor: plot,
      "font.color": text,
      "xaxis.color": text,
      "yaxis.color": text,
    });
  });
}

function nearestIndex(arr, val) {
  if (!Array.isArray(arr) || !arr.length) return null;
  let lo = 0;
  let hi = arr.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < val) lo = mid;
    else hi = mid;
  }
  return Math.abs(arr[lo] - val) <= Math.abs(arr[hi] - val) ? lo : hi;
}

function clampTime(val) {
  return Math.min(sim.maxTime, Math.max(sim.minTime, val));
}

function setSliderRange() {
  const timeSeries = S.cols[S.timeIdx] || [];
  sim.minTime = timeSeries[0] ?? 0;
  sim.maxTime = timeSeries[timeSeries.length - 1] ?? 0;
  const span = Math.max(0.01, sim.maxTime - sim.minTime);
  const step = Math.max(0.01, span / 1000);
  if (els.timeSlider) {
    els.timeSlider.min = sim.minTime;
    els.timeSlider.max = sim.maxTime;
    els.timeSlider.step = step;
  }
  if (els.timeInput) {
    els.timeInput.min = sim.minTime;
    els.timeInput.max = sim.maxTime;
    els.timeInput.step = step;
  }
}

function setTime(val) {
  if (!S.ready) return;
  const timeSeries = S.cols[S.timeIdx] || [];
  if (!timeSeries.length) return;
  const clamped = clampTime(val);
  const idx = nearestIndex(timeSeries, clamped);
  if (idx == null) return;
  sim.currentTime = timeSeries[idx];
  if (els.timeSlider) els.timeSlider.value = sim.currentTime;
  if (els.timeInput) els.timeInput.value = sim.currentTime.toFixed(2);
  if (els.timeDisplay) els.timeDisplay.textContent = `${sim.currentTime.toFixed(2)}s`;
  if (els.timeDisplayModal) els.timeDisplayModal.textContent = `${sim.currentTime.toFixed(2)}s`;
  updateReadouts(idx);
  updateCursors(idx);
}

function renderReadout(target, selectedIdx, idx, emptyText) {
  if (!target) return;
  if (!S.ready || selectedIdx.length === 0 || idx == null) {
    target.textContent = emptyText;
    return;
  }
  const items = selectedIdx
    .map((colIdx) => {
      const label = S.headers[colIdx];
      const val = S.cols[colIdx]?.[idx];
      const v = Number.isFinite(val) ? val.toFixed(2) : "—";
      return `<div class="sim-readout-item"><span>${label}</span><strong>${v}</strong></div>`;
    })
    .join("");
  target.innerHTML = items;
}

function updateReadouts(idx) {
  renderReadout(els.readoutA, sim.selectedA, idx, "Load a log and select channels.");
  const bText = sim.graphBEnabled ? "Enable Graph B and select channels." : "Graph B is disabled.";
  renderReadout(els.readoutB, sim.selectedB, idx, bText);
}

function updateCursorForPlot(plotEl, selectedIdx, markerTraces, idx) {
  if (!plotEl || !plotEl.data || markerTraces.length === 0) return;
  const timeSeries = S.cols[S.timeIdx] || [];
  const xv = timeSeries[idx];
  const markerXs = [];
  const markerYs = [];
  selectedIdx.forEach((colIdx) => {
    const yv = S.cols[colIdx]?.[idx];
    markerXs.push([xv]);
    markerYs.push([Number.isFinite(yv) ? yv : NaN]);
  });
  Plotly.restyle(plotEl, { x: markerXs, y: markerYs }, markerTraces);
  Plotly.relayout(plotEl, {
    shapes: [{
      type: "line",
      xref: "x",
      yref: "paper",
      x0: xv,
      x1: xv,
      y0: 0,
      y1: 1,
      line: { color: "#43B3FF", width: 1, dash: "dot" },
    }],
  });
}

function updateCursors(idx) {
  updateCursorForPlot(els.plotA, sim.selectedA, sim.markerTraceA, idx);
  if (sim.graphBEnabled) {
    updateCursorForPlot(els.plotB, sim.selectedB, sim.markerTraceB, idx);
  }
}

function calcRangeForCols(timeSeries, idxs) {
  let min = Infinity;
  let max = -Infinity;
  idxs.forEach((colIdx) => {
    const col = S.cols[colIdx] || [];
    for (let i = 0; i < col.length; i++) {
      const v = col[i];
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  });
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.08;
  return [min - pad, max + pad];
}

function buildPlotFor(plotEl, selectedIdx, markerKey) {
  if (!S.ready || !plotEl) return false;
  const timeSeries = S.cols[S.timeIdx] || [];
  if (!timeSeries.length || selectedIdx.length === 0) {
    Plotly.purge(plotEl);
    plotEl.innerHTML = "";
    return false;
  }
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  const cs = getComputedStyle(document.documentElement);
  const paper = cs.getPropertyValue("--plot-paper").trim() || "#ffffff";
  const plot = cs.getPropertyValue("--plot-bg").trim() || "#ffffff";
  const text = cs.getPropertyValue("--text").trim() || "#0f141a";
  const template = isLight ? "plotly_white" : "plotly_dark";
  const useScatterGL = timeSeries.length > 10000;
  const data = [];
  const markerTraceIdx = [];
  const cursorIdx = nearestIndex(timeSeries, sim.currentTime || timeSeries[0]) ?? 0;
  selectedIdx.forEach((colIdx, i) => {
    const label = S.headers[colIdx];
    data.push({
      x: timeSeries,
      y: S.cols[colIdx],
      mode: "lines",
      type: useScatterGL ? "scattergl" : "scatter",
      name: label,
      line: { width: 1 },
    });
    data.push({
      x: [sim.currentTime || timeSeries[0]],
      y: [S.cols[colIdx]?.[cursorIdx]],
      mode: "markers",
      type: "scatter",
      name: `${label} (cursor)`,
      marker: { size: 6 },
      showlegend: false,
      hoverinfo: "skip",
    });
    markerTraceIdx.push(i * 2 + 1);
  });

  const yRange = calcRangeForCols(timeSeries, selectedIdx);
  const layout = {
    template,
    paper_bgcolor: paper,
    plot_bgcolor: plot,
    font: { color: text },
    margin: { l: 50, r: 10, t: 10, b: 40 },
    xaxis: { title: S.headers[S.timeIdx] || "Time", fixedrange: true },
    yaxis: { automargin: true, fixedrange: true, range: yRange || undefined },
    showlegend: false,
    hovermode: false,
    dragmode: false,
    shapes: [],
  };

  const config = {
    displaylogo: false,
    responsive: true,
    scrollZoom: false,
    staticPlot: false,
    doubleClick: false,
    displayModeBar: false,
  };

  Plotly.newPlot(plotEl, data, layout, config).then(() => {
    applyTheme(isLight, [plotEl]);
    plotEl.removeAllListeners?.("plotly_click");
    plotEl.on?.("plotly_click", (ev) => {
      const x = ev?.points?.[0]?.x;
      if (!Number.isFinite(x)) return;
      stopPlayback();
      setTime(x);
    });
    if (markerKey === "A") sim.markerTraceA = markerTraceIdx;
    if (markerKey === "B") sim.markerTraceB = markerTraceIdx;
    setTime(sim.currentTime || timeSeries[0]);
  });
  return true;
}

function buildParamList(target) {
  if (!target) return;
  target.innerHTML = "";
  if (!S.ready) return;
  const numericIdx = numericColumns(S.headers, S.cols, 5).filter((i) => i !== S.timeIdx);
  const fragment = document.createDocumentFragment();
  numericIdx.forEach((idx) => {
    const item = document.createElement("label");
    item.className = "sim-param-item";
    item.dataset.label = S.headers[idx].toLowerCase();
    item.innerHTML = `<input type="checkbox" data-idx="${idx}" /> <span>${S.headers[idx]}</span>`;
    fragment.appendChild(item);
  });
  target.appendChild(fragment);
}

function updateSelectionA() {
  if (!els.paramListA) return;
  const checked = Array.from(els.paramListA.querySelectorAll("input[type='checkbox']:checked"));
  sim.selectedA = checked.map((cb) => parseInt(cb.dataset.idx, 10));
  updateReadouts(nearestIndex(S.cols[S.timeIdx] || [], sim.currentTime));
  if (sim.builtA) buildPlotFor(els.plotA, sim.selectedA, "A");
}

function updateSelectionB() {
  if (!els.paramListB) return;
  const checked = Array.from(els.paramListB.querySelectorAll("input[type='checkbox']:checked"));
  sim.selectedB = checked.map((cb) => parseInt(cb.dataset.idx, 10));
  updateReadouts(nearestIndex(S.cols[S.timeIdx] || [], sim.currentTime));
  if (sim.graphBEnabled && sim.builtB) buildPlotFor(els.plotB, sim.selectedB, "B");
}

function filterParams(targetInput, targetList) {
  if (!targetInput || !targetList) return;
  const q = targetInput.value.trim().toLowerCase();
  targetList.querySelectorAll(".sim-param-item").forEach((item) => {
    const label = item.dataset.label || "";
    item.style.display = label.includes(q) ? "flex" : "none";
  });
}

function selectAllParams(targetList, updateFn) {
  if (!targetList) return;
  targetList.querySelectorAll("input[type='checkbox']").forEach((cb) => {
    cb.checked = true;
  });
  updateFn();
}

function clearAllParams(targetList, updateFn) {
  if (!targetList) return;
  targetList.querySelectorAll("input[type='checkbox']").forEach((cb) => {
    cb.checked = false;
  });
  updateFn();
}

function setLog(text, name = "", size = 0) {
  try {
    const result = parseCSV(text);
    S.headers = result.headers;
    S.cols = result.cols;
    S.timeIdx = Number.isFinite(result.timeIdx) ? result.timeIdx : findTimeIndex(S.headers);
    S.name = name || "";
    S.size = size || text.length || 0;
    S.ready = true;
    if (els.fileInfo) {
      els.fileInfo.textContent = S.name ? `Loaded: ${S.name}` : "Loaded from cache.";
    }
    setSliderRange();
    sim.selectedA = [];
    sim.selectedB = [];
    sim.builtA = false;
    sim.builtB = false;
    buildParamList(els.paramListA);
    buildParamList(els.paramListB);
    if (els.paramListA) {
      els.paramListA.querySelectorAll("input[type='checkbox']").forEach((cb) => {
        cb.addEventListener("change", updateSelectionA);
      });
    }
    if (els.paramListB) {
      els.paramListB.querySelectorAll("input[type='checkbox']").forEach((cb) => {
        cb.addEventListener("change", updateSelectionB);
      });
    }
    setTime(sim.minTime);
  } catch (err) {
    toast(err.message || "Parse error");
  }
}

function updateGraphBState() {
  const enabled = !!(els.graphBToggle && els.graphBToggle.checked);
  sim.graphBEnabled = enabled;
  if (els.plotBCard) {
    els.plotBCard.classList.toggle("sim-disabled", !enabled);
  }
  if (els.readoutBCard) {
    els.readoutBCard.classList.toggle("sim-disabled", !enabled);
  }
  if (els.paramsBCard) {
    els.paramsBCard.classList.toggle("sim-disabled", !enabled);
  }
  if (els.paramListB) {
    els.paramListB.querySelectorAll("input[type='checkbox']").forEach((cb) => {
      cb.disabled = !enabled;
    });
  }
  if (els.filterB) els.filterB.disabled = !enabled;
  if (els.selectAllB) els.selectAllB.disabled = !enabled;
  if (els.selectNoneB) els.selectNoneB.disabled = !enabled;
  updateReadouts(nearestIndex(S.cols[S.timeIdx] || [], sim.currentTime));
}

function openPlayer() {
  if (!els.playerModal) return;
  els.playerModal.classList.remove("hidden");
  if (window.Plotly) {
    requestAnimationFrame(() => {
      if (els.plotA) Plotly.Plots.resize(els.plotA);
      if (els.plotB) Plotly.Plots.resize(els.plotB);
    });
  }
}

function closePlayer() {
  if (!els.playerModal) return;
  els.playerModal.classList.add("hidden");
}

function openChangelog(){
  if (els.changelogModal) els.changelogModal.classList.remove("hidden");
}

function closeChangelog(){
  if (els.changelogModal) els.changelogModal.classList.add("hidden");
}

function openShiftLabModal(){
  if (els.shiftLabModal) {
    els.shiftLabModal.classList.remove("hidden");
    runShiftLab();
  }
}

function closeShiftLabModal(){
  if (els.shiftLabModal) els.shiftLabModal.classList.add("hidden");
}

function parseShiftRatiosInput(){
  if (!els.shiftRatios) return [];
  return els.shiftRatios.value
    .split(/[\s,]+/)
    .map(r => parseFloat(r))
    .filter(v => Number.isFinite(v) && v > 0.1);
}

function runShiftLab(){
  if (!els.shiftPlot) return;
  const ratios = parseShiftRatiosInput();
  const redline = Number(els.shiftRedline?.value) || 7500;
  const finalDrive = Number(els.shiftFinal?.value) || 3.7;
  const tireDiameter = Number(els.shiftTire?.value) || 26.5;
  if (!ratios.length){
    Plotly.purge(els.shiftPlot);
    if (els.shiftNotes) els.shiftNotes.textContent = "Enter at least one gear ratio to generate shift guidance.";
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
  Plotly.newPlot(els.shiftPlot, traces, {
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
  const clutchFill = Number(els.shiftClutchFill?.value) || 90;
  const slipThreshold = Number(els.shiftSlip?.value) || 6;
  const userNotes = [
    `Clutch fill reminder: ${clutchFill} ms; keep torque cuts shorter than this.`,
    `Wheel slip target ≤ ${slipThreshold}% for launch + shifts.`
  ];
  const combined = [...dropNotes, ...userNotes];
  if (els.shiftNotes) els.shiftNotes.innerHTML = `<ul>${combined.map(note=>`<li>${note}</li>`).join("")}</ul>`;
}

function resetShiftLabDefaults(){
  if (els.shiftRatios) els.shiftRatios.value = "3.36, 2.10, 1.49, 1.20, 1.00, 0.79";
  if (els.shiftRedline) els.shiftRedline.value = "7500";
  if (els.shiftFinal) els.shiftFinal.value = "3.70";
  if (els.shiftTire) els.shiftTire.value = "26.5";
  if (els.shiftClutchFill) els.shiftClutchFill.value = "90";
  if (els.shiftSlip) els.shiftSlip.value = "6";
  runShiftLab();
}

function ensurePlotsBuilt() {
  if (sim.selectedA.length > 0 || sim.builtA) {
    sim.builtA = buildPlotFor(els.plotA, sim.selectedA, "A");
  }
  if (sim.graphBEnabled && (sim.selectedB.length > 0 || sim.builtB)) {
    sim.builtB = buildPlotFor(els.plotB, sim.selectedB, "B");
  }
}

function startPlayback() {
  if (!S.ready) {
    toast("Load a log first.");
    return;
  }
  if (sim.selectedA.length === 0 && (!sim.graphBEnabled || sim.selectedB.length === 0)) {
    toast("Select at least one parameter.");
    return;
  }
  if (!sim.openedOnce) {
    openPlayer();
    sim.openedOnce = true;
  }
  ensurePlotsBuilt();
  sim.playing = true;
  sim.lastTs = 0;
  if (els.playToggle) els.playToggle.textContent = "Pause";
  if (els.playToggleMain) els.playToggleMain.textContent = "Pause";
  requestAnimationFrame(tickPlayback);
}

function stopPlayback() {
  sim.playing = false;
  if (els.playToggle) els.playToggle.textContent = "Play";
  if (els.playToggleMain) els.playToggleMain.textContent = "Play";
}

function tickPlayback(ts) {
  if (!sim.playing) return;
  if (!sim.lastTs) sim.lastTs = ts;
  const dt = (ts - sim.lastTs) / 1000;
  sim.lastTs = ts;
  const nextTime = sim.currentTime + dt * sim.speed;
  if (nextTime >= sim.maxTime) {
    setTime(sim.minTime);
    sim.lastTs = ts;
    requestAnimationFrame(tickPlayback);
    return;
  }
  setTime(nextTime);
  requestAnimationFrame(tickPlayback);
}

if (els.file) {
  els.file.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onerror = () => toast("Failed to read file.");
    r.onload = (ev) => {
      const text = String(ev.target.result || "");
      sessionStorage.setItem("csvText", text);
      sessionStorage.setItem("csvName", f.name || "");
      sessionStorage.setItem("csvSize", String(f.size || 0));
      setLog(text, f.name, f.size);
    };
    r.readAsText(f);
  });
}

if (els.reload) {
  els.reload.addEventListener("click", () => {
    const text = sessionStorage.getItem("csvText");
    if (!text) {
      toast("No cached log found.");
      return;
    }
    setLog(text, sessionStorage.getItem("csvName") || "", Number(sessionStorage.getItem("csvSize") || 0));
  });
}

if (els.filterA) els.filterA.addEventListener("input", () => filterParams(els.filterA, els.paramListA));
if (els.filterB) els.filterB.addEventListener("input", () => filterParams(els.filterB, els.paramListB));
if (els.selectAllA) els.selectAllA.addEventListener("click", () => selectAllParams(els.paramListA, updateSelectionA));
if (els.selectNoneA) els.selectNoneA.addEventListener("click", () => clearAllParams(els.paramListA, updateSelectionA));
if (els.selectAllB) els.selectAllB.addEventListener("click", () => selectAllParams(els.paramListB, updateSelectionB));
if (els.selectNoneB) els.selectNoneB.addEventListener("click", () => clearAllParams(els.paramListB, updateSelectionB));

if (els.timeSlider) {
  els.timeSlider.addEventListener("input", (e) => {
    setTime(Number(e.target.value));
  });
}

if (els.timeInput) {
  els.timeInput.addEventListener("change", (e) => {
    setTime(Number(e.target.value));
  });
}

if (els.speed) {
  els.speed.addEventListener("change", (e) => {
    sim.speed = Number(e.target.value) || 1;
  });
}

if (els.playToggle) {
  els.playToggle.addEventListener("click", () => {
    if (!sim.playing) startPlayback();
    else stopPlayback();
  });
}

if (els.playToggleMain) {
  els.playToggleMain.addEventListener("click", () => {
    if (!sim.playing) startPlayback();
    else stopPlayback();
  });
}

if (els.openPlayer) {
  els.openPlayer.addEventListener("click", () => openPlayer());
}

if (els.playerClose) {
  els.playerClose.addEventListener("click", () => closePlayer());
}

if (els.playerModal) {
  els.playerModal.addEventListener("click", (e) => {
    if (e.target === els.playerModal) closePlayer();
  });
}

if (els.graphBToggle) {
  els.graphBToggle.addEventListener("change", () => {
    updateGraphBState();
    if (sim.graphBEnabled && sim.builtB) buildPlotFor(els.plotB, sim.selectedB, "B");
    if (!sim.graphBEnabled && els.plotB) {
      Plotly.purge(els.plotB);
      sim.builtB = false;
    }
  });
}

if (els.changelogMenu) {
  els.changelogMenu.addEventListener("click", (e)=>{ e.preventDefault(); openChangelog(); });
}
if (els.changelogClose) {
  els.changelogClose.addEventListener("click", closeChangelog);
}
if (els.changelogModal) {
  els.changelogModal.addEventListener("click", (e)=>{ if (e.target === els.changelogModal) closeChangelog(); });
}
if (els.shiftLabLink) {
  els.shiftLabLink.addEventListener("click", (e)=>{ e.preventDefault(); openShiftLabModal(); });
}
if (els.shiftLabClose) {
  els.shiftLabClose.addEventListener("click", closeShiftLabModal);
}
if (els.shiftLabModal) {
  els.shiftLabModal.addEventListener("click", (e)=>{ if (e.target === els.shiftLabModal) closeShiftLabModal(); });
}
if (els.shiftAnalyzeBtn) {
  els.shiftAnalyzeBtn.addEventListener("click", runShiftLab);
}
if (els.shiftResetBtn) {
  els.shiftResetBtn.addEventListener("click", resetShiftLabDefaults);
}

const toTopBtn = document.getElementById("toTop");
if (toTopBtn) toTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });

initTheme();

const cachedText = sessionStorage.getItem("csvText");
if (cachedText) {
  setLog(cachedText, sessionStorage.getItem("csvName") || "", Number(sessionStorage.getItem("csvSize") || 0));
}
updateGraphBState();
