import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { findTimeIndex } from "./parser.js";
import { debounce, throttle, formatBytes, supportsWebWorkers } from "./modules/utils.js";
import { storeLog, getRecentLog, storeParsed, getParsed, addToRecent, migrateFromSessionStorage } from "./modules/storage.js";

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

async function logSession({ remark="", fileName="", size=0, page="index" }){
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

async function uploadLogToSupabase(text, name, size, remark){
  if (!supabase) return;
  const safeName = (remark || name || "log").replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = safeName.endsWith(".csv") ? safeName : safeName + ".csv";
  const path = `logs/${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}-${fileName}`;
  const blob = new Blob([text], { type:"text/plain" });
  const { error: storageError } = await supabase.storage.from("logs").upload(path, blob, { upsert:false });
  if (storageError) {
    console.warn("Supabase storage upload failed", storageError);
    toast("Cloud upload failed (storage).", "error");
    return;
  }
  const { error: metaError } = await supabase.from("log_uploads").insert({
    remark: remark || "",
    path,
    name: fileName,
    size: size || text?.length || 0,
    source: "index",
    uploaded_at: new Date().toISOString()
  });
  if (metaError) {
    console.warn("Supabase metadata insert failed", metaError);
    toast("Cloud upload saved file; metadata failed.", "error");
    return;
  }
  logSession({ remark, fileName: fileName, size, page:"index" }).catch(()=>{});
  toast("Uploaded to cloud.", "ok");
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
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeUI(savedTheme);
  
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const newTheme = currentTheme === "light" ? "dark" : "light";
      
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
      updateThemeUI(newTheme);
      
      // Update plots to match theme
      const isLight = newTheme === "light";
      const plotElements = document.querySelectorAll('.plot');
      if (plotElements.length > 0) {
        applyTheme(isLight, Array.from(plotElements));
      }
      
      // Force drop zone and chips to re-evaluate CSS variables
      const dz = document.getElementById('dropzone');
      if (dz){ dz.style.transition = 'background-color .2s ease, border-color .2s ease'; dz.offsetHeight; }
    });
  }
}
// Apply Plotly theme/colors for current tokens (paper/plot)
function applyTheme(isLight, targets){
  const template = isLight ? 'plotly_white' : 'plotly_dark';
  const cs = getComputedStyle(document.documentElement);
  const paper = cs.getPropertyValue('--plot-paper').trim();
  const plot  = cs.getPropertyValue('--plot-bg').trim();
  const text  = cs.getPropertyValue('--text').trim();
  targets.forEach(gd=>{
    if (!gd || !gd._fullLayout) return;
    Plotly.relayout(gd, { template, paper_bgcolor: paper, plot_bgcolor: plot, 'font.color': text, 'xaxis.color': text, 'yaxis.color': text });
  });
}
window.applyTheme = applyTheme;

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
          toast("Export functionality coming soon!", "ok");
          break;
        case "Signal Matrix":
          // Already on multi plot
          break;
        case "Correlation Lab":
          window.location.href = "compare.html";
          break;
        case "GR6 Gear Scope":
          window.location.href = "gear.html";
          break;
        case "Data Analysis Suite":
          window.location.href = "analysis.html";
          break;
        case "Shift Strategy Lab":
          window.location.href = "compare.html#shift-lab";
          break;
        case "Log Metadata & Archive":
          openMetadataModal();
          break;
        case "Documentation":
          window.open("https://github.com/Everlasting-dev/ecutek-log-viewer", "_blank");
          break;
        case "EcuTek Knowledge Base":
          window.open("https://ecutek.atlassian.net/wiki/spaces/SUPPORT/pages/327698/EcuTek+Knowledge+Base", "_blank");
          break;
        case "About":
          window.location.href = "about.html";
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

// Start ASCII animation when page loads
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
  const navEntry = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
  const shouldShow = !sessionStorage.getItem("splashShown") || (navEntry && navEntry.type === "reload");
  if (shouldShow){
    showStartupLoading();
    sessionStorage.setItem("splashShown","1");
    setTimeout(()=> hideStartupLoading(), 1500);
  } else {
    hideStartupLoading();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  handleStartupSplash();
  
  // Initialize IndexedDB and migrate from sessionStorage
  try {
    await migrateFromSessionStorage();
  } catch (error) {
    console.warn("IndexedDB migration failed:", error);
  }
  
  // Initialize parser worker
  parserWorker = initParserWorker();
  
  // Initialize theme system
  initTheme();
  
  // Initialize dropdown interactions
  initDropdowns();

  if (changelogBtn) changelogBtn.addEventListener("click", openChangelog);
  if (changelogClose) changelogClose.addEventListener("click", closeChangelog);
  if (changelogModal){
    changelogModal.addEventListener("click", (e) => {
      if (e.target === changelogModal) closeChangelog();
    });
  }
  if (hintsBtn) hintsBtn.addEventListener("click", openHints);
  if (hintsClose) hintsClose.addEventListener("click", closeHints);
  if (hintsModal){
    hintsModal.addEventListener("click", (e) => {
      if (e.target === hintsModal) closeHints();
    });
  }
  if (metadataClose) metadataClose.addEventListener("click", closeMetadataModal);
  if (metadataModal){
    metadataModal.addEventListener("click", (e) => {
      if (e.target === metadataModal) closeMetadataModal();
    });
  }
  if (archiveLogBtn) archiveLogBtn.addEventListener("click", archiveCurrentLog);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && changelogModal && !changelogModal.classList.contains("hidden")) {
      closeChangelog();
    } else if (e.key === "Escape" && hintsModal && !hintsModal.classList.contains("hidden")) {
      closeHints();
    } else if (e.key === "Escape" && metadataModal && !metadataModal.classList.contains("hidden")) {
      closeMetadataModal();
    }
  });
});

const els = {
  file: document.getElementById("csvFile"),
  genBtn: document.getElementById("genBtn"),
  clearBtn: document.getElementById("clearBtn"),
  dropzone: document.getElementById("dropzone"),
  fileInfo: document.getElementById("fileInfo"),
  fileChips: document.getElementById("fileChips"),
  viewSwitcher: document.getElementById("viewSwitcher"),
  toast: document.getElementById("toast"),
  plots: document.getElementById("plots"),
  loadingScreen: document.getElementById("loadingScreen"),
  timeWindowToggle: document.getElementById("timeWindowToggle"),
  resetWindow: document.getElementById("resetWindow"),
};

const changelogBtn = document.getElementById("changelogBtn");
const changelogModal = document.getElementById("changelogModal");
const changelogClose = document.getElementById("changelogClose");
const hintsBtn = document.getElementById("hintsBtn");
const hintsModal = document.getElementById("hintsModal");
const hintsClose = document.getElementById("hintsClose");
const metadataModal = document.getElementById("metadataModal");
const metadataClose = document.getElementById("metadataClose");
const archiveLogBtn = document.getElementById("archiveLogBtn");
const archiveNoteInput = document.getElementById("archiveNoteInput");
const metaSummary = document.getElementById("metaSummary");



const S = { headers: [], cols: [], timeIdx: -1, name:"", size:0, ready:false };
const plotRegistry = [];
const timeWindow = { enabled:false, range:null };

const toast = (m,t="error")=>{
  els.toast.textContent=m; els.toast.classList.remove("hidden");
  els.toast.style.background = t==="error" ? "#3b0b0b" : "#0b3b18";
  els.toast.style.borderColor = t==="error" ? "#742020" : "#1a6a36";
  clearTimeout(toast._t); toast._t=setTimeout(()=>els.toast.style.display="none",3500);
};
const fmt = formatBytes; // Use utility function

// Cache functions - now use IndexedDB
let currentLogId = null;
async function cacheSet(txt, name, size){
  try {
    const logId = await storeLog(txt, name || "", size || txt.length);
    currentLogId = logId;
    await addToRecent(name || "untitled.csv", size || txt.length, logId);
    // Keep sessionStorage for backward compatibility during migration
    sessionStorage.setItem("csvText", txt);
    sessionStorage.setItem("csvName", name || "");
    sessionStorage.setItem("csvSize", String(size || 0));
  } catch (error) {
    console.warn("IndexedDB storage failed, falling back to sessionStorage:", error);
    sessionStorage.setItem("csvText", txt);
    sessionStorage.setItem("csvName", name || "");
    sessionStorage.setItem("csvSize", String(size || 0));
  }
}
async function cacheClr(){
  currentLogId = null;
  ["csvText", "csvName", "csvSize"].forEach(k => sessionStorage.removeItem(k));
}

function openChangelog(){
  if (changelogModal) changelogModal.classList.remove("hidden");
}

function closeChangelog(){
  if (changelogModal) changelogModal.classList.add("hidden");
}

function openHints(){
  if (hintsModal) hintsModal.classList.remove("hidden");
}

function closeHints(){
  if (hintsModal) hintsModal.classList.add("hidden");
}

function updateMetaSummary(){
  if (!metaSummary) return;
  if (!S.ready || !S.headers.length || !S.cols.length || S.timeIdx < 0){
    metaSummary.innerHTML = "<span>Upload a log to see VIN, ECU SW numbers, dongle IDs, sampling stats, GR6 shifts, and torque interventions.</span>";
    if (archiveLogBtn) archiveLogBtn.disabled = true;
    return;
  }
  const timeSeries = S.cols[S.timeIdx] || [];
  const finiteTime = timeSeries.filter(Number.isFinite);
  const samples = finiteTime.length;
  const duration = samples >= 2 ? finiteTime[finiteTime.length-1] - finiteTime[0] : 0;
  const sampleRate = duration > 0 ? samples / duration : 0;
  const durationStr = duration > 0 ? `${duration.toFixed(2)} s` : "—";
  const rateStr = sampleRate > 0 ? `${sampleRate.toFixed(1)} Hz` : "—";
  metaSummary.innerHTML = `
    <div class="meta-pair"><span>File</span><strong>${S.name || "—"}</strong></div>
    <div class="meta-pair"><span>Size</span><strong>${S.size ? fmt(S.size) : "—"}</strong></div>
    <div class="meta-pair"><span>Samples</span><strong>${samples}</strong></div>
    <div class="meta-pair"><span>Duration</span><strong>${durationStr}</strong></div>
    <div class="meta-pair"><span>Sample Rate</span><strong>${rateStr}</strong></div>
  `;
  if (archiveLogBtn) archiveLogBtn.disabled = false;
}

function openMetadataModal(){
  const modal = document.getElementById("metadataModal");
  if (modal) {
    updateMetaSummary();
    modal.classList.remove("hidden");
  }
}

function closeMetadataModal(){
  const modal = document.getElementById("metadataModal");
  if (modal) modal.classList.add("hidden");
}

async function archiveCurrentLog(){
  if (!S.ready || !S.headers.length || !S.cols.length) {
    toast("No log loaded.", "error");
    return;
  }
  const note = archiveNoteInput ? archiveNoteInput.value.trim() : "";
  if (!note) {
    toast("Please enter a Cloud Save Note.", "error");
    return;
  }
  const csvText = sessionStorage.getItem("csvText");
  if (!csvText) {
    toast("No CSV data available.", "error");
    return;
  }
  const fileName = note.replace(/[^a-zA-Z0-9._-]/g, "_") + ".csv";
  showLoading();
  try {
    await uploadLogToSupabase(csvText, fileName, S.size, note);
    closeMetadataModal();
    if (archiveNoteInput) archiveNoteInput.value = "";
  } catch (err) {
    toast("Upload failed: " + (err.message || "Unknown error"), "error");
  } finally {
    hideLoading();
  }
}

// Loading screen functions
let loadingTimeout = null;

function showLoading() {
  els.loadingScreen.classList.remove("hidden");
  startClassicLoader();
  
  // Safety timeout - hide loading after 10 seconds
  if (loadingTimeout) clearTimeout(loadingTimeout);
  loadingTimeout = setTimeout(() => {
    hideLoading();
    toast("Processing timeout. Please try again.", "error");
  }, 10000);
}

function hideLoading() {
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }
  els.loadingScreen.classList.add("hidden");
  stopClassicLoader();
}



// Web Worker for CSV parsing
let parserWorker = null;
let parseRequestId = 0;

function initParserWorker(){
  if (!supportsWebWorkers()) return null;
  try {
    return new Worker(new URL('./workers/parser-worker.js', import.meta.url));
  } catch (error) {
    console.warn("Failed to create parser worker:", error);
    return null;
  }
}

function updateParseProgress(progress){
  // Update progress indicator if it exists
  const progressBar = document.getElementById('parseProgress');
  const progressContainer = document.getElementById('parseProgressContainer');
  if (progressBar){
    progressBar.style.width = `${progress}%`;
    progressBar.textContent = `${progress}%`;
  }
  if (progressContainer){
    if (progress > 0 && progress < 100){
      progressContainer.classList.remove('hidden');
    } else {
      progressContainer.classList.add('hidden');
    }
  }
}

async function stageParsed(text, name, size){
  showLoading();
  updateParseProgress(0);
  
  try {
    // Try Web Worker first, fallback to synchronous parsing
    const worker = parserWorker || initParserWorker();
    parseRequestId++;
    const requestId = parseRequestId;
    
    if (worker){
      // Use Web Worker for non-blocking parsing
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Parse timeout"));
        }, 60000); // 60 second timeout
        
        worker.onmessage = (e) => {
          const { type, progress, result, error, id } = e.data;
          if (id !== requestId) return; // Ignore messages from other requests
          
          if (type === 'progress'){
            updateParseProgress(progress);
          } else if (type === 'done'){
            clearTimeout(timeout);
            resolve(result);
          } else if (type === 'error'){
            clearTimeout(timeout);
            reject(new Error(error));
          }
        };
        
        worker.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
        
        worker.postMessage({ text, id: requestId });
      });
      
      const { headers, cols, timeIdx } = result;
      S.headers = headers;
      S.cols = cols;
      S.timeIdx = Number.isFinite(timeIdx) ? timeIdx : findTimeIndex(headers);
    } else {
      // Fallback to synchronous parsing (import parseCSV dynamically)
      const { parseCSV } = await import('./parser.js');
      const result = parseCSV(text);
      S.headers = result.headers;
      S.cols = result.cols;
      S.timeIdx = Number.isFinite(result.timeIdx) ? result.timeIdx : findTimeIndex(result.headers);
    }
    
    if (S.timeIdx === -1) throw new Error("No 'Time' column found.");
    S.name = name || "";
    S.size = size || 0;
    S.ready = true;
    
    // Store parsed data in IndexedDB
    if (currentLogId){
      try {
        await storeParsed(currentLogId, { headers: S.headers, cols: S.cols, timeIdx: S.timeIdx });
      } catch (error) {
        console.warn("Failed to store parsed data:", error);
      }
    }
    
    hideLoading();
    updateParseProgress(100);
    
    els.fileInfo.classList.remove("hidden");
    els.fileInfo.textContent = `Selected: ${S.name} · ${formatBytes(S.size)}`;
    els.genBtn.disabled = false;
    
    // file chip
    if (els.fileChips){
      els.fileChips.innerHTML = "";
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.innerHTML = `<span>${S.name} · ${formatBytes(S.size)}</span><button class="close" title="Remove">×</button>`;
      chip.querySelector(".close").addEventListener("click", () => resetAll(true));
      els.fileChips.appendChild(chip);
    }
    
    toast("Upload success. Click Generate.", "ok");
    
  } catch (err) {
    hideLoading();
    updateParseProgress(0);
    resetAll(true);
    toast(err.message || "Parse error");
  }
}

function nearestIndex(arr,val){
  if(!Array.isArray(arr)||!arr.length) return null;
  let lo=0, hi=arr.length-1;
  while(hi-lo>1){
    const mid=(lo+hi)>>1;
    if(arr[mid] < val) lo=mid; else hi=mid;
  }
  return Math.abs(arr[lo]-val) <= Math.abs(arr[hi]-val) ? lo : hi;
}

function getTimeBounds(){
  const t = S.cols[S.timeIdx] || [];
  if (!t.length) return [0,0];
  return [t[0], t[t.length-1]];
}

function applyWindowRange(range){
  timeWindow.range = range;
  plotRegistry.forEach(({div})=> applyWindowRangeToPlot(div));
}

function applyWindowRangeToPlot(div){
  if (!div) return;
  if (timeWindow.range && Number.isFinite(timeWindow.range[0]) && Number.isFinite(timeWindow.range[1])){
    Plotly.relayout(div, {"xaxis.range":[timeWindow.range[0], timeWindow.range[1]]});
  } else {
    Plotly.relayout(div, {"xaxis.autorange": true});
  }
}

function setSelectionMode(enabled){
  timeWindow.enabled = !!enabled;
  plotRegistry.forEach(({div})=>{
    Plotly.relayout(div, { shapes: [] });  // clear snap line when switching modes
    Plotly.relayout(div, { selections: [] }); // clear any selection box
    setPlotDragMode(div);
  });
  updatePlotFooters();
}

function updatePlotFooters(){
  plotRegistry.forEach(({footer})=>{
    if (!footer) return;
    footer.textContent = timeWindow.enabled ? "Drag to set shared Time window" : "Click to inspect";
  });
}

function setPlotDragMode(div){
  const dragmode = timeWindow.enabled ? "select" : false;
  Plotly.relayout(div, { dragmode, selectdirection:"h" });
}

function wirePlotSelection(div){
  div.removeAllListeners?.('plotly_selected');
  div.on('plotly_selected', (ev)=>{
    if (!timeWindow.enabled) return;
    const rx = ev?.range?.x;
    if (!Array.isArray(rx) || rx.length < 2) return;
    let t0 = Math.min(rx[0], rx[1]);
    let t1 = Math.max(rx[0], rx[1]);
    const [minT,maxT] = getTimeBounds();
    t0 = Math.max(t0,minT); t1 = Math.min(t1,maxT);
    if (t1 - t0 <= 0) return;
    applyWindowRange([t0,t1]);
  });
}

function wirePlotSnap(div, xSeries, ySeries, readout, label){
  if (!Array.isArray(xSeries) || !Array.isArray(ySeries)) return;
  const formatReadout = (idx)=>{
    if (idx == null) return;
    const xv = xSeries[idx];
    const yv = ySeries[idx];
    if (Number.isFinite(xv) && Number.isFinite(yv)){
      readout.textContent = `${label}: ${yv.toFixed(2)} @ ${xv.toFixed(2)}s`;
    }
  };
  const update = (clientX)=>{
    const fl = div._fullLayout; if (!fl || !fl.xaxis || !fl.margin) return;
    const bb = div.getBoundingClientRect();
    const xpx = clientX - bb.left - fl.margin.l;
    const xVal = fl.xaxis.p2d(xpx);
    if (!Number.isFinite(xVal)) return;
    const idx = nearestIndex(xSeries, xVal);
    if (idx == null) return;
    const xv = xSeries[idx];
    Plotly.relayout(div, {
      shapes: [{
        type:"line", xref:"x", yref:"paper",
        x0:xv, x1:xv, y0:0, y1:1,
        line:{color:"#43B3FF", width:1, dash:"dot"}
      }]
    });
    formatReadout(idx);
  };
  let dragging=false;
  div.addEventListener("pointerdown", (e)=>{
    if (timeWindow.enabled) return;       // selection mode disables snap
    dragging=true;
    update(e.clientX);
    div.setPointerCapture?.(e.pointerId);
  });
  div.addEventListener("pointermove", (e)=>{
    if (timeWindow.enabled) return;
    if (dragging) update(e.clientX);
  });
  ["pointerup","pointercancel","pointerleave"].forEach(evt=>{
    div.addEventListener(evt, ()=>{ dragging=false; });
  });
}

function createSkeletonPlots(count = 6){
  els.plots.innerHTML = "";
  for (let i = 0; i < count; i++){
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton-plot";
    skeleton.innerHTML = `
      <div class="skeleton-plot-header"></div>
      <div class="skeleton-plot-frame"></div>
      <div class="skeleton-plot-footer"></div>
    `;
    els.plots.appendChild(skeleton);
  }
}

function renderPlots(){
  if (!S.ready){ toast("Upload a file first."); return; }
  
  showLoading();
  
  // Show skeleton screens immediately
  const estimatedPlotCount = Math.min(S.headers.length - 1, 10);
  createSkeletonPlots(estimatedPlotCount);
  
  setTimeout(() => {
    els.plots.innerHTML = "";
    plotRegistry.length = 0;
    const x = S.cols[S.timeIdx];

    const cs = getComputedStyle(document.documentElement);
    const paper = cs.getPropertyValue('--plot-paper').trim() || "#ffffff";
    const plot  = cs.getPropertyValue('--plot-bg').trim() || "#ffffff";
    const text  = cs.getPropertyValue('--text').trim() || "#0f141a";
    const template = (document.documentElement.getAttribute('data-theme') === 'light') ? 'plotly_white' : 'plotly_dark';

    for (let i=0;i<S.headers.length;i++){
      if (i === S.timeIdx) continue;                 // no Time vs Time
      const valid = S.cols[i].reduce((a,v)=>a+(Number.isFinite(v)?1:0),0);
      if (valid < 5) continue;

      const card=document.createElement("div"); card.className="card plot-card";
      const title=document.createElement("div"); title.className="plot-title";
      const titleText=document.createElement("span"); titleText.textContent=S.headers[i];
      const titleReadout=document.createElement("span"); titleReadout.className="plot-readout"; titleReadout.textContent="—";
      title.appendChild(titleText); title.appendChild(titleReadout);
      const frame=document.createElement("div"); frame.className="plot-frame";
      const div=document.createElement("div"); div.className="plot";
      const footer=document.createElement("div"); footer.className="plot-footer"; footer.textContent="Click to inspect";
      frame.appendChild(div); card.appendChild(title); card.appendChild(frame); card.appendChild(footer); els.plots.appendChild(card);

      Plotly.newPlot(div, [{x, y:S.cols[i], mode:"lines", name:S.headers[i], line:{width:1}}],
        { template, paper_bgcolor:paper, plot_bgcolor:plot, font:{color:text},
          margin:{l:50,r:10,t:10,b:40},
          xaxis:{title:S.headers[S.timeIdx]},
          yaxis:{title:S.headers[i], automargin:true},
          showlegend:false, hovermode:false, dragmode: timeWindow.enabled ? "select" : false, selectdirection:"h" },
        { displaylogo:false, responsive:true, scrollZoom:false, staticPlot:false, doubleClick:false, displayModeBar:false })
        .then(()=>{ 
          applyTheme(document.documentElement.getAttribute('data-theme')==='light', [div]);
          wirePlotSnap(div, x, S.cols[i], footer, S.headers[i]);
          wirePlotSelection(div);
          setPlotDragMode(div);
          plotRegistry.push({div, xSeries:x, footer, readout:titleReadout});
          applyWindowRangeToPlot(div);
        });
    }
    
    hideLoading();
    toast("Plots generated successfully!", "ok");
    updatePlotFooters();
  }, 300);
}

function resetAll(clearCache){
  if (window.Plotly) Plotly.purge(els.plots);
  els.plots.innerHTML=""; els.file.value=""; els.fileInfo.textContent="";
  if (els.fileChips) els.fileChips.innerHTML="";
  els.genBtn.disabled = true;
  Object.assign(S,{headers:[],cols:[],timeIdx:-1,name:"",size:0,ready:false});
  if (clearCache) cacheClr();
  toast("Cleared.","ok");
}

/* --- events --- */
els.file.addEventListener("change", e=>{
  const f=e.target.files?.[0]; if(!f){ resetAll(false); return; }
  const r=new FileReader();
  r.onerror=()=>{
    hideLoading();
    toast("Failed to read file.");
  };
  r.onload=ev=>{ 
    const text=String(ev.target.result||""); 
    cacheSet(text,f.name,f.size);
    stageParsed(text,f.name,f.size);
  };
  r.readAsText(f);
});

els.genBtn.addEventListener("click", renderPlots);
els.clearBtn.addEventListener("click", ()=> resetAll(true));

// View switcher
if (els.viewSwitcher) {
  els.viewSwitcher.addEventListener("change", (e) => {
    if (e.target.value === "mega") {
      window.location.href = "compare.html";
    }
  });
}

["dragenter","dragover"].forEach(ev=>{
  els.dropzone.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); els.dropzone.classList.add("dragover"); });
});
["dragleave","drop"].forEach(ev=>{
  els.dropzone.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); els.dropzone.classList.remove("dragover"); });
});
els.dropzone.addEventListener("drop", e=>{
  const f=e.dataTransfer.files?.[0];
  if (!f || !/\.(csv|txt|log)$/i.test(f.name)) return toast("Drop a .csv/.txt/.log file.");
  const r=new FileReader();
  r.onerror=()=>{
    hideLoading();
    toast("Failed to read file.");
  };
  r.onload=ev=>{ 
    const text=String(ev.target.result||""); 
    cacheSet(text,f.name,f.size);
    stageParsed(text,f.name,f.size);
  };
  r.readAsText(f);
});

if (els.timeWindowToggle){
  els.timeWindowToggle.addEventListener("change", debounce((e)=>{
    setSelectionMode(e.target.checked);
  }, 150));
}

if (els.resetWindow){
  els.resetWindow.addEventListener("click", debounce(()=>{
    applyWindowRange(null);
    plotRegistry.forEach(({div})=> Plotly.relayout(div, { shapes: [] }));
  }, 150));
}

document.addEventListener("DOMContentLoaded", ()=>{
  // Add click handler to hide loading screen if stuck
  els.loadingScreen.addEventListener("click", () => {
    hideLoading();
    toast("Loading cancelled.", "error");
  });
  
  // Add keyboard escape handler
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.loadingScreen.classList.contains("hidden")) {
      hideLoading();
      toast("Loading cancelled.", "error");
    }
  });
  
  // Try to load from IndexedDB first, then fallback to sessionStorage
  try {
    const recentLog = await getRecentLog();
    if (recentLog){
      await cacheSet(recentLog.text, recentLog.name, recentLog.size);
      stageParsed(recentLog.text, recentLog.name, recentLog.size);
    } else {
      const text = sessionStorage.getItem("csvText");
      if (text){ 
        await cacheSet(text, sessionStorage.getItem("csvName")||"cached.csv", Number(sessionStorage.getItem("csvSize")||0));
        stageParsed(text, sessionStorage.getItem("csvName")||"cached.csv", Number(sessionStorage.getItem("csvSize")||0)); 
      }
    }
  } catch (error) {
    console.warn("Failed to load from IndexedDB:", error);
    const text = sessionStorage.getItem("csvText");
    if (text){ stageParsed(text, sessionStorage.getItem("csvName")||"cached.csv", Number(sessionStorage.getItem("csvSize")||0)); }
  }

  // Back to top button
  const toTopBtn = document.getElementById("toTop");
  if (toTopBtn) toTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  updatePlotFooters();
});
