// Multi-plot page: one chart per numeric column vs Time, caching for compare view
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
  showToast._t = setTimeout(()=> (els.toast.style.display="none"), 3200);
}
const fmtBytes = n => { const u=["B","KB","MB","GB"]; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++;} return `${n.toFixed(1)} ${u[i]}`; };

function cacheCSV(text, name, size){
  sessionStorage.setItem("csvText", text);
  sessionStorage.setItem("csvName", name||"");
  sessionStorage.setItem("csvSize", String(size||0));
}
function tryLoadCached(){
  const text = sessionStorage.getItem("csvText");
  if (!text) return false;
  const nam
