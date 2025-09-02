import { parseCSV, findTimeIndex } from "./parser.js";

// ASCII Dot-Matrix Loading Animation
function createAsciiAnimation() {
  const asciiContainer = document.querySelector('.ascii-loading .matrix');
  if (!asciiContainer) return;
  
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
  
  let start = null;
  function tick(now) {
    if (!start) start = now;
    const t = (now - start) / 1000;
    
    if (asciiContainer) {
      asciiContainer.textContent = render(t);
    }
    
    // Continue animation for 3.5 seconds
    if (t < 3.5) {
      requestAnimationFrame(tick);
    }
  }
  
  requestAnimationFrame(tick);
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
      e.preventDefault();
      const text = item.textContent.trim();
      
      // Handle different menu actions
      switch(text) {
        case "Open CSV File":
          document.getElementById("csvFile").click();
          break;
        case "Export Data":
          toast("Export functionality coming soon!", "ok");
          break;
        case "Time Plot":
          // Already on time plot
          break;
        case "Analysis":
          try { sessionStorage.setItem('suppressStartupLoading','1'); } catch(_){}
          window.location.href = "compare.html";
          break;
        case "Compare Mode":
          window.location.href = "compare.html";
          break;
        case "Data Analysis":
          toast("Data analysis tools coming soon!", "ok");
          break;
        case "Statistics":
          toast("Statistics panel coming soon!", "ok");
          break;
        case "Performance Metrics":
          toast("Performance metrics coming soon!", "ok");
          break;
        case "Documentation":
          toast("Documentation coming soon!", "ok");
          break;
        case "About":
          window.location.href = "about.html";
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

// Start ASCII animation when page loads
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

document.addEventListener('DOMContentLoaded', () => {
  // Show startup loading screen unless suppressed for intra-app navigation
  const suppress = sessionStorage.getItem('suppressStartupLoading') === '1';
  if (!suppress) {
    showStartupLoading();
    setTimeout(() => { hideStartupLoading(); }, 3500);
  } else {
    hideStartupLoading();
    try { sessionStorage.removeItem('suppressStartupLoading'); } catch(_){}
  }
  
  // Initialize theme system
  initTheme();
  
  // Initialize dropdown interactions
  initDropdowns();
  
  // Start ASCII animation
  createAsciiAnimation();
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
};



const S = { headers: [], cols: [], timeIdx: -1, name:"", size:0, ready:false };

const toast = (m,t="error")=>{
  els.toast.textContent=m; els.toast.classList.remove("hidden");
  els.toast.style.background = t==="error" ? "#3b0b0b" : "#0b3b18";
  els.toast.style.borderColor = t==="error" ? "#742020" : "#1a6a36";
  clearTimeout(toast._t); toast._t=setTimeout(()=>els.toast.style.display="none",3500);
};
const fmt = n=>{ if(!Number.isFinite(n))return""; const u=["B","KB","MB","GB"];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++;}return`${n.toFixed(1)} ${u[i]}`;};

const cacheSet=(txt,name,size)=>{ sessionStorage.setItem("csvText",txt); sessionStorage.setItem("csvName",name||""); sessionStorage.setItem("csvSize",String(size||0)); };
const cacheClr=()=>{ ["csvText","csvName","csvSize"].forEach(k=>sessionStorage.removeItem(k)); };

// Loading screen functions
let loadingTimeout = null;

function showLoading() {
  els.loadingScreen.classList.remove("hidden");
  
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
}



function stageParsed(text, name, size){
  showLoading();
  
  setTimeout(() => {
    try {
      const { headers, cols, timeIdx } = parseCSV(text);
      S.headers=headers; S.cols=cols; S.timeIdx = Number.isFinite(timeIdx) ? timeIdx : findTimeIndex(headers);
      if (S.timeIdx === -1) throw new Error("No 'Time' column found.");
      S.name=name||""; S.size=size||0; S.ready=true;

      hideLoading();
      
      els.fileInfo.classList.remove("hidden");
      els.fileInfo.textContent = `Selected: ${S.name} · ${fmt(S.size)}`;
      els.genBtn.disabled = false;
      
      // file chip
      if (els.fileChips){
        els.fileChips.innerHTML = "";
        const chip = document.createElement("div");
        chip.className = "chip";
        chip.innerHTML = `<span>${S.name} · ${fmt(S.size)}</span><button class="close" title="Remove">×</button>`;
        chip.querySelector(".close").addEventListener("click", ()=> resetAll(true));
        els.fileChips.appendChild(chip);
      }
      
      toast("Upload success. Click Generate.", "ok");
      
    } catch (err) {
      hideLoading();
      resetAll(true);
      toast(err.message || "Parse error");
    }
  }, 700);
}

// Extract units in parentheses from a header label
function extractUnits(label){
  const m = /\(([^)]+)\)/.exec(String(label||""));
  return m ? m[1] : "";
}

// Simple stride downsample to limit DOM point count for SVG plots
function strideDownsample(xArr, yArr, maxPoints){
  const xs = Array.isArray(xArr) ? xArr : [];
  const ys = Array.isArray(yArr) ? yArr : [];
  const n = Math.min(xs.length, ys.length);
  if (n <= 0) return { x: [], y: [] };
  if (!Number.isFinite(maxPoints) || maxPoints <= 0 || n <= maxPoints) return { x: xs.slice(0, n), y: ys.slice(0, n) };
  const step = Math.ceil(n / maxPoints);
  const xd = []; const yd = [];
  for (let i = 0; i < n; i += step){ xd.push(xs[i]); yd.push(ys[i]); }
  return { x: xd, y: yd };
}

// Find nearest index in xs to target x
function nearestIndexByX(xs, target){
  if (!Array.isArray(xs) || !xs.length) return 0;
  let bestI = 0, bestD = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const d = Math.abs(xs[i] - target);
    if (d < bestD) { bestD = d; bestI = i; }
  }
  return bestI;
}

// Enable touch/mouse tap-and-drag cursor with dotted vertical line and fixed annotation
function enableTapCursor(plotDiv, traceName, xTitle){
  function draw(x, y){
    Plotly.relayout(plotDiv, {
      shapes: [{
        type: 'line',
        xref: 'x', yref: 'paper',
        x0: x, x1: x, y0: 0, y1: 1,
        line: { color: '#34a0ff', width: 1, dash: 'dot' }
      }],
      annotations: [{
        xref: 'x', yref: 'paper',
        x: x, y: 1.12,
        showarrow: false,
        bgcolor: '#10161e',
        bordercolor: '#1b1f25',
        borderwidth: 1,
        font: { size: 12, color: '#e7ecf2' },
        text: `${traceName}: ${Number.isFinite(y)?y.toFixed(3):'—'}<br>${xTitle||'X'}=${Number.isFinite(x)?x.toFixed(3):'—'}`
      }]
    });
  }

  // Follow finger/mouse while moving
  plotDiv.on('plotly_hover', (ev) => {
    const p = ev.points && ev.points[0];
    if (p) draw(p.x, p.y);
  });

  // Tap/click to set and keep position
  plotDiv.on('plotly_click', (ev) => {
    const p = ev.points && ev.points[0];
    if (p) draw(p.x, p.y);
  });

  // Do NOT clear on unhover; persist last position (prevents snap-to-0)
}

function renderPlots(){
  if (!S.ready){ toast("Upload a file first."); return; }
  
  showLoading();
  
  setTimeout(() => {
    els.plots.innerHTML = "";
    const x = S.cols[S.timeIdx];

    const cs = getComputedStyle(document.documentElement);
    const paper = cs.getPropertyValue('--plot-paper').trim() || "#ffffff";
    const plot  = cs.getPropertyValue('--plot-bg').trim() || "#ffffff";
    const text  = cs.getPropertyValue('--text').trim() || "#0f141a";
    const template = (document.documentElement.getAttribute('data-theme') === 'light') ? 'plotly_white' : 'plotly_dark';

    const miniPlots = [];
    function broadcastAtIndex(idx){
      if (!Number.isFinite(idx)) return;
      for (const mp of miniPlots){
        const yv = S.cols[mp.i][idx];
        // update probe marker position (trace index 1)
        Plotly.restyle(mp.div, { x: [[x[idx]]], y: [[Number.isFinite(yv)?yv:null]] }, [1]);
        mp.readout.textContent = `${S.headers[mp.i]}: ${Number.isFinite(yv)?yv.toFixed(3):"—"}`;
      }
    }
    for (let i=0;i<S.headers.length;i++){
      if (i === S.timeIdx) continue;                 // no Time vs Time
      const valid = S.cols[i].reduce((a,v)=>a+(Number.isFinite(v)?1:0),0);
      if (valid < 5) continue;

      const card=document.createElement("div"); card.className="card plot-card";
      const title=document.createElement("div"); title.className="plot-title"; title.textContent=S.headers[i];
      const frame=document.createElement("div"); frame.className="plot-frame";
      const div=document.createElement("div"); div.className="plot";
      frame.appendChild(div); card.appendChild(title); card.appendChild(frame);

      // Readout line below plot
      const readout = document.createElement("div");
      readout.className = "plot-readout";
      readout.style.color = "#9aa7b2";
      readout.style.marginTop = "6px";
      readout.textContent = `${S.headers[i]}: —`;
      card.appendChild(readout);
      els.plots.appendChild(card);

      // Optional small downsample to keep DOM light (SVG lines)
      const containerWidth = Math.max(320, frame.clientWidth || 640);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const maxPts = Math.floor(containerWidth * dpr * 0.8); // ~1 point per px
      const ds = strideDownsample(x, S.cols[i], Math.max(2000, maxPts));
      const xData = ds.x, yData = ds.y;

      Plotly.newPlot(
        div,
        [{
          x: xData,
          y: yData,
          type: "scatter",
          mode: "lines",
          name: S.headers[i],
          line: { width: 1, color: "#00ff66" },
          hoverinfo: "skip"
        },
        {
          x: [],
          y: [],
          type: "scatter",
          mode: "markers",
          name: "probe",
          marker: { size: 5, symbol: "circle", color: "#00ff66" },
          hoverinfo: "skip",
          showlegend: false
        }],
        {
          paper_bgcolor: "#0f1318",
          plot_bgcolor: "#0f1318",
          font: { color: "#e7ecf2" },
          margin: { l: 50, r: 10, t: 10, b: 40 },
          xaxis: { title: S.headers[S.timeIdx] || "X", gridcolor: "#1b1f25" },
          yaxis: { title: S.headers[i], gridcolor: "#1b1f25", automargin: true },
          showlegend: false,
          hovermode: false,
          dragmode: false
        },
        { displaylogo: false, displayModeBar: false, responsive: true, scrollZoom: false, doubleClick: false }
      ).then(() => {
        // Store refs for cross-plot updates
        miniPlots.push({ div, readout, i });
        // Local click forwards to global update (tolerant to clicking anywhere on plot area)
        div.on("plotly_click", (ev) => {
          const p = ev.points && ev.points[0];
          if (p && Number.isFinite(p.x)) {
            const idx = nearestIndexByX(x, Number(p.x));
            broadcastAtIndex(idx);
          }
        });

        // Fallback: pointer events on drag layer so background clicks work
        const layer = div.querySelector('.plotly .nsewdrag') || div;
        const onPoint = (e) => {
          const fl = div && div._fullLayout; if (!fl || !fl.xaxis || !fl.margin) return;
          const bb = div.getBoundingClientRect();
          const clientX = (e.touches? e.touches[0].clientX : e.clientX);
          const xpx = clientX - bb.left - fl.margin.l;
          const xVal = fl.xaxis.p2d(xpx);
          const idx = nearestIndexByX(x, xVal);
          broadcastAtIndex(idx);
        };
        layer.addEventListener('pointerdown', onPoint, { passive:true });
        layer.addEventListener('touchstart', onPoint, { passive:true });
      });
    }
    
    hideLoading();
    toast("Plots generated successfully!", "ok");
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

if (els.dropzone) {
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
  
  const text=sessionStorage.getItem("csvText");
  if (text){ stageParsed(text, sessionStorage.getItem("csvName")||"cached.csv", Number(sessionStorage.getItem("csvSize")||0)); }

  // Back to top button
  const toTopBtn = document.getElementById("toTop");
  if (toTopBtn) toTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
});
