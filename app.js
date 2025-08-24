// Same behavior as your snippet, just separated into JS.
// Assumes comma-separated CSV with a column containing "time" in its name.

document.getElementById("genBtn").addEventListener("click", handleFile);

function handleFile() {
  const fileInput = document.getElementById("csvFile");
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = String(e.target.result || "");
    // Split into lines, ignore empty lines and comment lines starting with '#'
    const lines = text.split(/\r?\n/).filter((line) => line && !line.startsWith("#"));
    if (lines.length < 2) {
      alert("File seems empty or missing rows.");
      return;
    }

    const headers = lines[0].split(",");
    const timeIndex = headers.findIndex((h) => h.toLowerCase().includes("time"));
    if (timeIndex === -1) {
      alert("No Time column found.");
      return;
    }

    // Initialize column arrays
    const dataColumns = headers.map(() => []);

    // Fill columns (simple comma split to match original behavior)
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      if (values.length !== headers.length) continue;
      for (let j = 0; j < values.length; j++) {
        const v = parseFloat(values[j]);
        dataColumns[j].push(v);
      }
    }

    // Clear and render one plot per Y column (vs Time)
    const plotsDiv = document.getElementById("plots");
    plotsDiv.innerHTML = "";

    for (let i = 0; i < headers.length; i++) {
      if (i === timeIndex) continue;

      const div = document.createElement("div");
      div.className = "plot";
      plotsDiv.appendChild(div);

      Plotly.newPlot(
        div,
        [
          {
            x: dataColumns[timeIndex],
            y: dataColumns[i],
            mode: "lines",
            name: headers[i],
            line: { shape: "linear" },
          },
        ],
        {
          title: headers[i],
          xaxis: { title: "Time (s)" },
          yaxis: { title: headers[i] },
          paper_bgcolor: "#111",
          plot_bgcolor: "#111",
          font: { color: "#eee" },
        },
        { displaylogo: false, responsive: true }
      );
    }
  };

  reader.readAsText(file);
}
