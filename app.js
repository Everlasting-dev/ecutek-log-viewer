import { parseCSV, findTimeIndex } from "./parser.js";

const els = {
  file: document.getElementById("csvFile"),
  genBtn: document.getElementById("genBtn"),
  clearBtn: document.getElementById("clearBtn"),
  dropzone: document.getElementById("dropzone"),
  fileInfo: document.getElementById("fileInfo"),
  fileChips: document.getElementById("fileChips"),
  toast: document.getElementById("toast"),
  plots: document.getElementById("plots"),
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

function stageParsed(text, name, size){
  const { headers, cols, timeIdx } = parseCSV(text);
  S.headers=headers; S.cols=cols; S.timeIdx = Number.isFinite(timeIdx) ? timeIdx : findTimeIndex(headers);
  if (S.timeIdx === -1) throw new Error("No 'Time' column found.");
  S.name=name||""; S.size=size||0; S.ready=true;

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
}

function renderPlots(){
  if (!S.ready){ toast("Upload a file first."); return; }
  els.plots.innerHTML = "";
  const x = S.cols[S.timeIdx];

  for (let i=0;i<S.headers.length;i++){
    if (i === S.timeIdx) continue;                 // no Time vs Time
    const valid = S.cols[i].reduce((a,v)=>a+(Number.isFinite(v)?1:0),0);
    if (valid < 5) continue;

    const card=document.createElement("div"); card.className="card plot-card";
    const title=document.createElement("div"); title.className="plot-title"; title.textContent=S.headers[i];
    const frame=document.createElement("div"); frame.className="plot-frame";
    const div=document.createElement("div"); div.className="plot";
    frame.appendChild(div); card.appendChild(title); card.appendChild(frame); els.plots.appendChild(card);

    Plotly.newPlot(div, [{x, y:S.cols[i], mode:"lines", name:S.headers[i], line:{width:1}}],
      { paper_bgcolor:"#0f1318", plot_bgcolor:"#0f1318", font:{color:"#e7ecf2"},
        margin:{l:50,r:10,t:10,b:40}, xaxis:{title:S.headers[S.timeIdx], gridcolor:"#1b1f25"},
        yaxis:{title:S.headers[i], gridcolor:"#1b1f25", automargin:true}, showlegend:false },
      { displaylogo:false, responsive:true, scrollZoom:false });
  }
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
  r.onerror=()=>toast("Failed to read file.");
  r.onload=ev=>{ const text=String(ev.target.result||""); cacheSet(text,f.name,f.size);
    try{ stageParsed(text,f.name,f.size); toast("Upload success. Click Generate.", "ok"); }catch(err){ resetAll(true); toast(err.message||"Parse error"); } };
  r.readAsText(f);
});

els.genBtn.addEventListener("click", renderPlots);
els.clearBtn.addEventListener("click", ()=> resetAll(true));

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
  r.onerror=()=>toast("Failed to read file.");
  r.onload=ev=>{ const text=String(ev.target.result||""); cacheSet(text,f.name,f.size);
    try{ stageParsed(text,f.name,f.size); toast("Upload success. Click Generate.", "ok"); }catch(err){ resetAll(true); toast(err.message||"Parse error"); } };
  r.readAsText(f);
});

document.addEventListener("DOMContentLoaded", ()=>{
  const text=sessionStorage.getItem("csvText");
  if (text){ stageParsed(text, sessionStorage.getItem("csvName")||"cached.csv", Number(sessionStorage.getItem("csvSize")||0)); }
});
