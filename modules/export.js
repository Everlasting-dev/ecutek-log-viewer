// Export functionality for plots and reports

/**
 * Export a single plot as PNG
 * @param {HTMLElement} plotDiv - Plotly plot div element
 * @param {string} filename - Output filename (without extension)
 * @returns {Promise}
 */
export async function exportPlotPNG(plotDiv, filename = 'plot'){
  if (!plotDiv || !window.Plotly){
    throw new Error('Plot element or Plotly not available');
  }
  
  try {
    const imageData = await Plotly.downloadImage(plotDiv, {
      format: 'png',
      width: plotDiv.offsetWidth || 1200,
      height: plotDiv.offsetHeight || 800,
      filename: filename
    });
    return imageData;
  } catch (error) {
    console.error('PNG export failed:', error);
    throw error;
  }
}

/**
 * Export a single plot as SVG
 * @param {HTMLElement} plotDiv - Plotly plot div element
 * @param {string} filename - Output filename (without extension)
 * @returns {Promise}
 */
export async function exportPlotSVG(plotDiv, filename = 'plot'){
  if (!plotDiv || !window.Plotly){
    throw new Error('Plot element or Plotly not available');
  }
  
  try {
    const imageData = await Plotly.downloadImage(plotDiv, {
      format: 'svg',
      width: plotDiv.offsetWidth || 1200,
      height: plotDiv.offsetHeight || 800,
      filename: filename
    });
    return imageData;
  } catch (error) {
    console.error('SVG export failed:', error);
    throw error;
  }
}

/**
 * Export all plots as a ZIP file
 * @param {Array<HTMLElement>} plotDivs - Array of Plotly plot div elements
 * @param {string} baseFilename - Base filename for exported files
 * @returns {Promise}
 */
export async function exportAllPlots(plotDivs, baseFilename = 'ecutek-plots'){
  if (!window.JSZip){
    // Load JSZip dynamically if not available
    await loadJSZip();
  }
  
  const zip = new JSZip();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  
  try {
    // Export each plot as PNG
    for (let i = 0; i < plotDivs.length; i++){
      const div = plotDivs[i];
      const plotTitle = div.closest('.plot-card')?.querySelector('.plot-title span')?.textContent || `plot-${i + 1}`;
      const safeTitle = plotTitle.replace(/[^a-zA-Z0-9]/g, '_');
      
      try {
        const blob = await Plotly.toImage(div, {
          format: 'png',
          width: div.offsetWidth || 1200,
          height: div.offsetHeight || 800
        });
        
        // Convert data URL to blob
        const response = await fetch(blob);
        const blobData = await response.blob();
        zip.file(`${safeTitle}.png`, blobData);
      } catch (error) {
        console.warn(`Failed to export plot ${i + 1}:`, error);
      }
    }
    
    // Generate ZIP file
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseFilename}-${timestamp}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return zipBlob;
  } catch (error) {
    console.error('ZIP export failed:', error);
    throw error;
  }
}

/**
 * Load JSZip library dynamically
 * @returns {Promise}
 */
function loadJSZip(){
  return new Promise((resolve, reject) => {
    if (window.JSZip){
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load JSZip'));
    document.head.appendChild(script);
  });
}

/**
 * Generate PDF report (requires html2canvas and jsPDF)
 * @param {Object} options - Report options
 * @param {Array<HTMLElement>} options.plots - Plot elements to include
 * @param {Object} options.metadata - Metadata to include in report
 * @param {string} options.filename - Output filename
 * @returns {Promise}
 */
export async function exportPDFReport({ plots = [], metadata = {}, filename = 'ecutek-report' }){
  // Check if libraries are available
  if (!window.html2canvas){
    await loadHtml2Canvas();
  }
  if (!window.jspdf){
    await loadJsPDF();
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);
  const contentHeight = pageHeight - (margin * 2);
  
  try {
    // Add title page with metadata
    doc.setFontSize(20);
    doc.text('EcuTek Log Viewer Report', margin, margin + 10);
    
    doc.setFontSize(12);
    let yPos = margin + 20;
    if (metadata.name){
      doc.text(`File: ${metadata.name}`, margin, yPos);
      yPos += 7;
    }
    if (metadata.size){
      doc.text(`Size: ${metadata.size}`, margin, yPos);
      yPos += 7;
    }
    if (metadata.duration){
      doc.text(`Duration: ${metadata.duration}`, margin, yPos);
      yPos += 7;
    }
    if (metadata.samples){
      doc.text(`Samples: ${metadata.samples}`, margin, yPos);
      yPos += 7;
    }
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    
    // Add plots
    for (let i = 0; i < plots.length; i++){
      if (i > 0){
        doc.addPage();
      }
      
      const plotDiv = plots[i];
      const plotTitle = plotDiv.closest('.plot-card')?.querySelector('.plot-title span')?.textContent || `Plot ${i + 1}`;
      
      try {
        // Convert plot to canvas
        const canvas = await html2canvas(plotDiv, {
          backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--plot-paper').trim() || '#ffffff',
          scale: 2,
          logging: false
        });
        
        // Add plot title
        doc.setFontSize(14);
        doc.text(plotTitle, margin, margin + 5);
        
        // Calculate dimensions to fit page
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(
          contentWidth / (imgWidth * 0.264583), // Convert px to mm
          (contentHeight - 10) / (imgHeight * 0.264583)
        );
        
        const finalWidth = imgWidth * 0.264583 * ratio;
        const finalHeight = imgHeight * 0.264583 * ratio;
        const xPos = margin + (contentWidth - finalWidth) / 2;
        const yPos = margin + 10;
        
        // Add image to PDF
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', xPos, yPos, finalWidth, finalHeight);
      } catch (error) {
        console.warn(`Failed to add plot ${i + 1} to PDF:`, error);
        doc.text(`Error rendering plot: ${plotTitle}`, margin, margin + 20);
      }
    }
    
    // Save PDF
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    doc.save(`${filename}-${timestamp}.pdf`);
    
    return doc;
  } catch (error) {
    console.error('PDF export failed:', error);
    throw error;
  }
}

/**
 * Load html2canvas library dynamically
 * @returns {Promise}
 */
function loadHtml2Canvas(){
  return new Promise((resolve, reject) => {
    if (window.html2canvas){
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load html2canvas'));
    document.head.appendChild(script);
  });
}

/**
 * Load jsPDF library dynamically
 * @returns {Promise}
 */
function loadJsPDF(){
  return new Promise((resolve, reject) => {
    if (window.jspdf){
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load jsPDF'));
    document.head.appendChild(script);
  });
}
