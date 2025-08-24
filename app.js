/* app.js — client-side TXT/CSV log viewer
 * - Supports comma, tab, and whitespace-delimited logs
 * - PapaParse streaming (worker) + optional WS→CSV prepass
 * - Plotly plotting with optional downsampling
 * - iOS-safe: caps rows, avoids giant arrays, minimal DOM churn
 */

const els = {
  file: document.getElementById("file"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  plotBtn: document.getElementById("plotBtn"),
  clearBtn: document.getElementById("clearBtn"),
  xField: document.getElementById("xField"),
  yFields: document.getElementById("yFields"),
  whitespaceMode: document.getElementById("whitespaceMode"),
  transposeMode: document.getElementById("transposeMode"),
  autoscale: document.getElementById("autoscale"),
  downsample: document.getElementById("downsample"),
  chart: document.getElementById("chart"),
  err: document.getElementById("err"),
  debug: document.getElementById("debug"),
  meta: document.getElementById("meta"),
};

let headers = [];
let rows = [];          // array of row objects keyed by header
let rawRowCount = 0;
let detectedDelimiter = ",";

function showErr(msg) {
  els.err.textContent = msg;
  els.err.classList.remove("hidden");
}
function clearErr() {
  els.err.classList.add("hidden");
  els.err.textContent = "";
}
function setDebug(obj) {
  els.debug.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

/* ---------- Parsing helpers ---------- */

function sniffDelimiterFromSample(sample) {
  // Simple heuristic: prefer comma, then tab; fall back to whitespace if many tokens
  const comma = (sample.match(/,/g) || []).length;
  const tab = (sample.match(/\t/g) || []).length;
  const firstLine = sample.split(/\r?\n/)[0] || "";
  const wsCols = firstLine.trim().split(/\s+/).length;

  if (tab > comma && tab > 0) return "\t";
  if (comma > 0) return ",";
  if (wsCols >= 3) return "WS";
  return ",";
}

function csvEscape(s) {
  if (s == null) return "";
  const t = String(s);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

async function preprocessWhitespace(file) {
  // Convert whitespace-delimited text → CSV in-memory
  // For very large files, prefer a worker + incremental Blob/IndexedDB pipeline.
  const reader = file.stream().getReader();
  const td = new TextDecoder();
  let buf = "", out = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += td.decode(value, { stream: true });

    let lastNL = buf.lastIndexOf("\n");
    if (lastNL === -1) continue;

    const chunk = buf.slice(0, lastNL + 1);
    buf = buf.slice(lastNL + 1);

    chunk.split(/\r?\n/).forEach(line => {
      if (!line.trim()) return;
      const parts = line.trim().split(/\s+/);
      out += parts.map(csvEscape).join(",") + "\n";
    });

    // Basic memory guard: flush occasionally by rebuilding the string (kept simple here)
    if (out.length > 32 * 1024 * 1024) {
      // If you hit this, move conversion into a worker + streaming writer.
      showErr("Warning: very large whitespace→CSV conversion in-memory. Consider server-side or worker pipeline.");
    }
  }
  if (buf.trim()) {
    const parts = buf.trim().split(/\s+/);
    out += parts.map(csvEscape).join(",") + "\n";
  }
  return new Blob([out], { type: "text/csv" });
}

async function analyzeFile(file) {
  clearErr();
  headers = [];
  rows = [];
  rawRowCount = 0;

  // Quick size sanity for mobile
  if (file.size > 200 * 1024 * 1024) {
    showErr("File >200MB. Consider server-side parsing or pre-downsampling.");
  }

  // Peek to detect delimiter
  const head = await file.slice(0, 32 * 1024).text();
  detectedDelimiter = sniffDelimiterFromSample(head);
  const forceWS = els.whitespaceMode.checked || detectedDelimiter === "WS";
  const source = forceWS ? await preprocessWhitespace(file) : file;

  return new Promise((resolve, reject) => {
    Papa.parse(source, {
      worker: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      delimiter: forceWS ? "," : undefined, // let Papa autodetect unless we forced WS→CSV
      chunk: (res, parser) => {
        try {
          if (!headers.length) {
            headers = res.meta.fields || [];
            if (!headers || headers.length < 2) {
              parser.abort();
              return reject(new Error("No header row detected or fewer than 2 columns."));
            }
          }
          if (els.transposeMode.checked) {
            // For rare col-major logs; not implemented by default to avoid heavy CPU
            // Implement custom transpose here if your format needs it.
            rows.push(...res.data);
          } else {
            rows.push(...res.data);
          }
          rawRowCount += res.data.length;

          // iOS memory guard
          if (rows.length > 1_000_000) {
            parser.abort();
            return reject(new Error("Row cap (1,000,000) reached to protect mobile memory."));
          }
        } catch (e) {
          parser.abort();
          reject(e);
        }
      },
      complete: () => resolve({ headers, rowCount: rows.length, delimiter: forceWS ? "," : detectedDelimiter }),
      error: (err) => reject(err),
    });
  });
}

function populateSelectors() {
  const xf = els.xField, yf = els.yFields;
  xf.innerHTML = ""; yf.innerHTML = "";

  headers.forEach(h => {
    const o1 = document.createElement("option"); o1.value = h; o1.textContent = h; xf.appendChild(o1);
    const o2 = document.createElement("option"); o2.value = h; o2.textContent = h; yf.appendChild(o2);
  });

  // Prefer common X candidates
  const candidates = ["Time", "Timestamp", "Time(s)", "ms", "Sample", "RPM", "time", "TIME"];
  for (const k of candidates) {
    const i = headers.indexOf(k);
    if (i >= 0) { xf.selectedIndex = i; break; }
  }

  // Auto-select a couple of Y fields (skip X)
  const pick = headers.filter(h => h !== xf.value).slice(0, 3);
  Array.from(yf.options).forEach(o => o.selected = pick.includes(o.value));
}

/* ---------- Series building & plotting ---------- */

function toNum(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return NaN;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function buildSeries(xKey, yKeys) {
  const series = yKeys.map(k => ({ name: k, x: [], y: [] }));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const xv = toNum(r[xKey]);
    if (!Number.isFinite(xv)) continue;

    for (let s = 0; s < yKeys.length; s++) {
      const yv = toNum(r[yKeys[s]]);
      if (Number.isFinite(yv)) {
        series[s].x.push(xv);
        series[s].y.push(yv);
      }
    }
  }
  return series;
}

function strideDownsample(xs, ys, maxPts = 20000) {
  const n = xs.length;
  if (n <= maxPts) return { x: xs, y: ys };
  const step = Math.ceil(n / maxPts);
  const m = Math.floor(n / step);
  const x = new Array(m), y = new Array(m);
  let j = 0;
  for (let i = 0; i < n; i += step) {
    x[j] = xs[i];
    y[j] = ys[i];
    j++;
  }
  return { x, y };
}

function plot(series, autoscale = true, downsample = true) {
  // Prefer scattergl; fallback to scatter if WebGL not available
  const canWebGL = !!window.Plotly?.Registry?.allTypes?.includes("scattergl");
  const traces = [];

  for (const s of series) {
    const data = downsample ? strideDownsample(s.x, s.y, 20000) : { x: s.x, y: s.y };
    traces.push({
      type: canWebGL ? "scattergl" : "scatter",
      mode: "lines",
      name: s.name,
      x: data.x,
      y: data.y,
      line: { width: 1 },
      hovertemplate: "%{\x}, %{\y}<extra>" + s.name + "</extra>",
      connectgaps: false,
    });
  }

  const layout = {
    paper_bgcolor: "#0b0d10",
    plot_bgcolor: "#0b0d10",
    font: { color: "#e7ecf2", size: 12 },
    margin: { l: 60, r: 10, t: 10, b: 40 },
    xaxis: { gridcolor: "#1b1f25", zeroline: false },
    yaxis: { gridcolor: "#1b1f25", zeroline: false, automargin: true, rangemode: autoscale ? "normal" : "nonnegative" },
    showlegend: true,
    legend: { orientation: "h", y: -0.15 },
  };

  const config = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["select2d", "lasso2d"] };
  Plotly.react(els.chart, traces, layout, config);
}

/* ---------- UI wiring ---------- */

function resetUI() {
  headers = [];
  rows = [];
  rawRowCount = 0;
  els.xField.innerHTML = "";
  els.yFields.innerHTML = "";
  els.meta.textContent = "";
  setDebug("");
  clearErr();
  if (window.Plotly) Plotly.purge(els.chart);
}

function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

els.analyzeBtn.addEventListener("click", async () => {
  try {
    const f = els.file.files?.[0];
    if (!f) return showErr("No file selected.");
    const t0 = performance.now();
    const res = await analyzeFile(f);
    populateSelectors();
    const t1 = performance.now();
    els.meta.textContent = `Delimiter: ${res.delimiter} · Rows: ${res.rowCount} · Cols: ${headers.length} · ${(t1 - t0).toFixed(0)} ms`;
    setDebug({ headers: headers.slice(0, 50), preview: rows.slice(0, 3) });
  } catch (e) {
    console.error(e);
    showErr(`Analyze failed: ${e.message || e}`);
  }
});

els.plotBtn.addEventListener("click", () => {
  try {
    clearErr();
    if (!rows.length || !headers.length) return showErr("Nothing parsed. Click Analyze first.");
    const xKey = els.xField.value;
    const yKeys = Array.from(els.yFields.selectedOptions).map(o => o.value);
    if (!xKey) return showErr("Select an X-axis field.");
    if (!yKeys.length) return showErr("Select at least one Y field.");
    const series = buildSeries(xKey, yKeys);
    if (!series.length || !series[0].x.length) return showErr("No numeric data to plot for selection.");
    plot(series, els.autoscale.checked, els.downsample.checked);
  } catch (e) {
    console.error(e);
    showErr(`Plot failed: ${e.message || e}`);
  }
});

els.clearBtn.addEventListener("click", resetUI);

// Auto-analyze on file choose (better mobile UX)
els.file.addEventListener("change", () => { if (els.file.files?.[0]) els.analyzeBtn.click(); });

// Window resize → relayout (debounced)
window.addEventListener("resize", debounce(() => {
  if (els.chart && els.chart.data && els.chart.data.length) {
    Plotly.Plots.resize(els.chart);
  }
}, 150));
