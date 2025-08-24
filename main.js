// Single upload → two views (multi-plots + compare)
// Comma CSV, comment lines start with '#'

const $ = (id) => document.getElementById(id);
const csvFile = $("csvFile");
const plotsEl = $("plots");
const summary = $("summary");
const toast   = $("toast");
const fileInfo= $("fileInfo");
const clearAll= $("clearAll");

// compare controls
const xSelect = $("xSelect");
const yList   = $("yList");
const yCount  = $("yCount");
const plotCompare = $("plotCompare");
const chart   = $("chart");

const MAX_Y = 5;

// state
let lastFile = null;
let headers = [];
let cols = [];
let timeIdx = -1;
let rpmIdx  = -1;

function showToast(msg, type="error"){
  toast.textContent = msg;
  toast.style.display = "block";
  toast.style.background = (type==="error") ? "#3b0b0b" : "#0b3b18";
  toast.style.borderColor = (type==="error") ? "#742020" : "#1a6a36";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> toast.style.display = "none", 3500);
}

function fmtBytes(n){ const u=["B","KB","MB","GB"]; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++;} return `${n.toFixed(1)} ${u[i]}`; }

// --- parsing ---
function splitLines(text){ return text.split(/\r?\n/).filter(l => l && !l.startsWith("#")); }
function parseCSV(text){
  const lines = splitLines(text);
  if (lines.length < 2) throw new Error("Empty CSV or missing rows.");
  const hdrs = lines[0].split(",");
  const c = hdrs.map(()=>[]);
  for (let i=1;i<lines.length;i++){
    const parts = lines[i].split(",");
    if (parts.length !== hdrs.length) continue;
    for (let j=0;j<parts.length;j++){
      const v = Number(parts[j].replace(/,/g,""));
      c[j].push(Number.isFinite(v)?v:NaN);
    }
  }
  return { headers: hdrs, cols: c, rows: c[0]?.length ?? 0 };
}
function findTimeIndex(h){ return h.findIndex(x => /time|timestamp/i.test(x)); }
function findRpmIndex(h){ const i=h.findIndex(x=>/\bRPM\b/i.test(x)); return i!==-1?i:h.findIndex(x=>/engine\s*speed/i.test(x)); }
function numericColumns(h, c, min=5){
  const out=[];
  for (let k=0;k<h.length;k++){
    let cnt=0; const v=c[k];
    for (let i=0;i<v.length;i++) if (Number.isFinite(v[i])) cnt++;
    if (cnt >= min) out.push(k);
  }
  return out;
}

// --- multi-plots ---
function renderMultiPlots(){
  plotsEl.innerHTML = "";
  if (timeIdx === -1){ showToast("No 'time' column found for multi-plots."); return; }
  const x = cols[timeIdx];
  for (let i=0;i<headers.length;i++){
    if (i === timeIdx) continue;
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
    plotsEl.appendChild(card);

    Plotly.newPlot(div, [{ x, y: cols[i], mode:"lines", name:headers[i], line:{width:1} }], {
      paper_bgcolor:"#0f1318", plot_bgcolor:"#0f1318", font:{color:"#e7ecf2"},
      margin:{l:50,r:10,t:10,b:40}, xaxis:{title:headers[timeIdx], gridcolor:"#1b1f25"},
      yaxis:{title:headers[i], gridcolor:"#1b1f25", automargin:true}, showlegend:false
    }, {displaylogo:false, responsive:true});
  }
}

// --- compare view ---
function buildXOptions(){
  xSelect.innerHTML = "";
  if (timeIdx !== -1){ const o=document.createElement("option"); o.value=String(timeIdx); o.textContent=headers[timeIdx]+" (Time)"; xSelect.appendChild(o); }
  if (rpmIdx  !== -1){ const o=document.createElement("option"); o.value=String(rpmIdx);  o.textContent=headers[rpmIdx]+" (Engine RPM)"; xSelect.appendChild(o); }
  const ok = xSelect.options.length>0; xSelect.disabled = !ok; plotCompare.disabled=!ok;
  if (!ok){ const o=document.createElement("option"); o.textContent="No Time or RPM column found"; o.disabled=true; xSelect.appendChild(o); }
}
function populateYList(){
  yList.innerHTML = "";
  const idxs = numericColumns(headers, cols, 5);
  idxs.forEach(idx=>{
    const row=document.createElement("label");
    const cb=document.createElement("input"); cb.type="checkbox"; cb.value=String(idx);
    cb.addEventListener("change", enforceMaxY);
    const t=document.createElement("span"); t.textContent=headers[idx];
    row.appendChild(cb); row.appendChild(t); yList.appendChild(row);
  });
  updateYCounter();
}
function getSelectedY(){ return Array.from(yList.querySelectorAll('input[type=checkbox]:checked')).map(cb=>Number(cb.value)); }
function updateYCounter(){ yCount.textContent = `(${getSelectedY().length}/${MAX_Y})`; }
function enforceMaxY(e){ if (getSelectedY().length > MAX_Y){ e.target.checked=false; showToast(`Max ${MAX_Y} Y series`); } updateYCounter(); }
function plotCompareNow(){
  const xIdx = Number(xSelect.value);
  const yIdxs = getSelectedY().filter(i => i !== xIdx).slice(0, MAX_Y);
  if (!Number.isFinite(xIdx)) return showToast("Pick an X axis.");
  if (!yIdxs.length) return showToast("Pick at least one Y series.");
  const traces = yIdxs.map(i=>({ type:"scattergl", mode:"lines", name:headers[i], x:cols[xIdx], y:cols[i], line:{width:1} }));
  Plotly.react(chart, traces, {
    paper_bgcolor:"#0f1318", plot_bgcolor:"#0f1318", font:{color:"#e7ecf2"},
    margin:{l:60,r:10,t:10,b:40}, xaxis:{title:headers[xIdx], gridcolor:"#1b1f25"},
    yaxis:{gridcolor:"#1b1f25", automargin:true}, showlegend:true, legend:{orientation:"h", y:-0.2}
  }, {displaylogo:false, responsive:true});
}

// --- file flow ---
csvFile.addEventListener("change", (e)=>{
  lastFile = e.target.files[0] || null;
  if (!lastFile){ fileInfo.classList.add("hidden"); return; }
  fileInfo.classList.remove("hidden");
  fileInfo.textContent = `Selected: ${lastFile.name} · ${fmtBytes(lastFile.size)}`;

  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const text = String(ev.target.result || "");
      const parsed = parseCSV(text);
      headers = parsed.headers;
      cols    = parsed.cols;
      timeIdx = findTimeIndex(headers);
      rpmIdx  = findRpmIndex(headers);

      // summary
      summary.innerHTML = `<strong>File:</strong> ${lastFile.name}<br/><strong>Columns:</strong> ${headers.length} · <strong>Rows:</strong> ${parsed.rows}`;

      // Render both views (user can switch tabs)
      renderMultiPlots();
      buildXOptions();
      populateYList();
      chart.innerHTML = ""; // wait for user to select Y and press Generate
      showToast("Parsed. You can switch tabs.", "ok");
    }catch(err){
      showToast(err.message || "Parse error.");
      plotsEl.innerHTML = ""; chart.innerHTML = "";
      summary.textContent = "No file loaded.";
    }
  };
  reader.readAsText(lastFile);
});

// compare plot action
plotCompare.addEventListener("click", plotCompareNow);

// clear
clearAll.addEventListener("click", ()=>{
  csvFile.value = ""; lastFile = null;
  headers = []; cols = []; timeIdx = rpmIdx = -1;
  plotsEl.innerHTML = ""; chart.innerHTML = "";
  yList.innerHTML = ""; xSelect.innerHTML = "";
  summary.textContent = "No file loaded.";
  fileInfo.classList.add("hidden");
  showToast("Cleared.","ok");
});

// tabs
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".tabpanes > section").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("pane-"+btn.dataset.tab).classList.add("active");
  });
});
