// One Plotly chart per numeric column vs Time. Caches CSV for compare page.
const isMobile = matchMedia("(max-width: 900px), (pointer: coarse)").matches;
document.documentElement.classList.toggle("mobile", isMobile);

import { parseCSV, findTimeIndex } from "./parser.js";

const els = {
  file: document.getElementById("csvFile"),
  analyzeBtn: document.getElementById("genBtn"),
  clearBtn: document.getElementById("clearBtn"),
  dropzone: document.getElementById("dropzone"),
  fileInfo: document.getElementById("fileInfo"),
  toast: document.getElementById("toast"),
  plots: document.getElementById("plots"),
};

let headers = [], cols = [], lastFile = null;

function showToast(msg, type="error"){
  els.toast.textContent = msg;
  els.toast.classList.remove("hidden");
  els.toast.style.background = (type==="error") ? "#3b0b0b" : "#0b3b18";
  els.toast.style.borderColor = (type==="error") ? "#742020" : "#1a6a36";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> els.toast.style.display = "none", 3500);
}
const fmtBytes = n => { const u=["B","KB","MB","GB"]; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++;} return `${n.toFixed(1)} ${u[i]}`; };

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
  els.fileInfo.classList.remove("hidden");
  els.fileInfo.textContent = `Selected (cached): ${name} · ${fmtBytes(size)}`;

  try{
    const parsed = parseCSV(text);
    headers = parsed.headers; cols = parsed.cols;
    renderPlots();
    showToast("Loaded cached CSV.", "ok");
    return true;
  }catch(err){
    showToast(err.message || "Parse error", "error");
    return false;
  }
}

function renderPlots(){
  els.plots.innerHTML = "";
  const tIdx = findTimeIndex(headers);
  const MOBILE = document.documentElement.classList.contains("mobile");

const layout = {
  paper_bgcolor:"#0f1318", plot_bgcolor:"#0f1318", font:{color:"#e7ecf2", size: MOBILE ? 14 : 12},
  margin:{l: MOBILE ? 68 : 50, r:12, t:10, b: MOBILE ? 56 : 40},
  xaxis:{ title: headers[timeIdx] || headers[xIdx], gridcolor:"#1b1f25", tickfont:{size:MOBILE?13:12} },
  yaxis:{ gridcolor:"#1b1f25", automargin:true, tickfont:{size:MOBILE?13:12} },
  hovermode: MOBILE ? "closest" : "x unified",
  dragmode: MOBILE ? false : "pan",
  showlegend:true, legend:{orientation:"h", y:-0.2}
};
const config = { responsive:true, displaylogo:false, doubleClick:false, displayModeBar: !MOBILE };

  if (tIdx === -1){ showToast("No 'Time' column found.", "error"); return; }
  const x = cols[tIdx];

  for (let i=0; i<headers.length; i++){
    if (i === tIdx) continue;
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
    els.plots.appendChild(card);

    Plotly.newPlot(div, [{
      x, y: cols[i], mode:"lines", name:headers[i], line:{width:1}
    }], {
      paper_bgcolor:"#0f1318", plot_bgcolor:"#0f1318", font:{color:"#e7ecf2"},
      margin:{l:50,r:10,t:10,b:40},
      xaxis:{title:headers[tIdx], gridcolor:"#1b1f25"},
      yaxis:{title:headers[i], gridcolor:"#1b1f25", automargin:true},
      showlegend:false
    }, {displaylogo:false, responsive:true});
  }
}

function handleFile(file){
  if (!file){ showToast("No file selected."); return; }
  const reader = new FileReader();
  reader.onerror = () => showToast("Failed to read file.");
  reader.onload = (e) => {
    try{
      const text = String(e.target.result || "");
      cacheCSV(text, file.name, file.size);
      const parsed = parseCSV(text);
      headers = parsed.headers; cols = parsed.cols;
      els.fileInfo.textContent = `Selected: ${file.name} · ${fmtBytes(file.size)}`;
      renderPlots();
      showToast("Plots generated.", "ok");
    }catch(err){
      els.plots.innerHTML = "";
      showToast(err.message || "Parse error", "error");
    }
  };
  reader.readAsText(file);
}

/* events */
els.analyzeBtn.addEventListener("click", () => handleFile(lastFile));
els.clearBtn.addEventListener("click", () => {
  headers=[]; cols=[]; els.plots.innerHTML=""; els.file.value=""; els.fileInfo.textContent="";
  showToast("Cleared.","ok");
});
els.file.addEventListener("change", (e) => { lastFile = e.target.files[0]; if (lastFile) handleFile(lastFile); });
["dragenter","dragover"].forEach(ev=>{
  document.getElementById("dropzone").addEventListener(ev, (e)=>{e.preventDefault();e.stopPropagation();e.currentTarget.classList.add("dragover");});
});
["dragleave","drop"].forEach(ev=>{
  document.getElementById("dropzone").addEventListener(ev, (e)=>{e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove("dragover");});
});
document.getElementById("dropzone").addEventListener("drop",(e)=>{
  const f = e.dataTransfer.files?.[0];
  if (f) { lastFile = f; handleFile(f); } else { showToast("Drop a .csv file."); }
});
document.addEventListener("DOMContentLoaded", tryLoadCached);
