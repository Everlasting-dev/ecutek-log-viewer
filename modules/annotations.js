// Annotations system for marking events and adding notes to timestamps

let annotations = [];
let annotationIdCounter = 0;

/**
 * Annotation data structure
 * @typedef {Object} Annotation
 * @property {number} id - Unique annotation ID
 * @property {number} timestamp - Time value for the annotation
 * @property {string} type - Annotation type (knock, shift, boost, custom, etc.)
 * @property {string} note - User note text
 * @property {string} parameter - Associated parameter name (optional)
 * @property {number} value - Parameter value at timestamp (optional)
 * @property {string} color - Display color
 */

/**
 * Initialize annotations system
 */
export function initAnnotations(){
  // Load annotations from IndexedDB
  loadAnnotations();
  
  // Setup event listeners for adding annotations
  setupAnnotationListeners();
}

/**
 * Add annotation at a specific timestamp
 * @param {number} timestamp - Time value
 * @param {string} type - Annotation type
 * @param {string} note - User note
 * @param {string} parameter - Parameter name (optional)
 * @param {number} value - Parameter value (optional)
 * @returns {Annotation} Created annotation
 */
export function addAnnotation(timestamp, type = 'custom', note = '', parameter = '', value = null){
  const annotation = {
    id: annotationIdCounter++,
    timestamp,
    type,
    note,
    parameter,
    value,
    color: getColorForType(type),
    createdAt: Date.now()
  };
  
  annotations.push(annotation);
  annotations.sort((a, b) => a.timestamp - b.timestamp);
  
  // Save to IndexedDB
  saveAnnotations();
  
  // Update UI
  updateAnnotationMarkers();
  
  return annotation;
}

/**
 * Remove annotation by ID
 * @param {number} id - Annotation ID
 */
export function removeAnnotation(id){
  annotations = annotations.filter(ann => ann.id !== id);
  saveAnnotations();
  updateAnnotationMarkers();
}

/**
 * Get annotations for a time range
 * @param {number} startTime - Start time
 * @param {number} endTime - End time
 * @returns {Array<Annotation>} Filtered annotations
 */
export function getAnnotationsInRange(startTime, endTime){
  return annotations.filter(ann => 
    ann.timestamp >= startTime && ann.timestamp <= endTime
  );
}

/**
 * Get all annotations
 * @returns {Array<Annotation>}
 */
export function getAllAnnotations(){
  return [...annotations];
}

/**
 * Get color for annotation type
 * @param {string} type - Annotation type
 * @returns {string} Color hex code
 */
function getColorForType(type){
  const colors = {
    knock: '#ff3b30',
    shift: '#34a0ff',
    boost: '#00ff66',
    afr: '#ffaa2a',
    custom: '#a98bff',
    event: '#ff5aa2'
  };
  return colors[type] || colors.custom;
}

/**
 * Setup event listeners for adding annotations
 */
function setupAnnotationListeners(){
  // Listen for plot clicks to add annotations
  document.addEventListener('click', (e) => {
    const plotCard = e.target.closest('.plot-card');
    if (plotCard && e.ctrlKey || e.metaKey){
      // Ctrl/Cmd + Click to add annotation
      const plot = plotCard.querySelector('.plot');
      if (plot && plot._fullData){
        // Get timestamp from click position
        const rect = plot.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const layout = plot._fullLayout;
        if (layout && layout.xaxis){
          const timestamp = layout.xaxis.p2d(x);
          if (Number.isFinite(timestamp)){
            showAnnotationDialog(timestamp, plotCard);
          }
        }
      }
    }
  });
}

/**
 * Show annotation dialog
 * @param {number} timestamp - Timestamp for annotation
 * @param {HTMLElement} plotCard - Plot card element
 */
function showAnnotationDialog(timestamp, plotCard){
  const parameter = plotCard.querySelector('.plot-title span')?.textContent || '';
  
  const dialog = document.createElement('div');
  dialog.className = 'modal';
  dialog.id = 'annotationDialog';
  dialog.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" id="annotationDialogClose">×</button>
      <h3>Add Annotation</h3>
      <div class="form-group">
        <label>Time</label>
        <input type="number" id="annotationTime" value="${timestamp.toFixed(3)}" step="0.001" readonly />
      </div>
      <div class="form-group">
        <label>Parameter</label>
        <input type="text" id="annotationParameter" value="${parameter}" readonly />
      </div>
      <div class="form-group">
        <label>Type</label>
        <select id="annotationType">
          <option value="custom">Custom</option>
          <option value="knock">Knock</option>
          <option value="shift">Shift Point</option>
          <option value="boost">Boost Spike</option>
          <option value="afr">AFR Event</option>
          <option value="event">General Event</option>
        </select>
      </div>
      <div class="form-group">
        <label>Note</label>
        <textarea id="annotationNote" rows="3" placeholder="Add a note about this event..."></textarea>
      </div>
      <div class="form-actions">
        <button id="annotationSave" class="btn primary">Save</button>
        <button id="annotationCancel" class="btn ghost">Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  dialog.classList.remove('hidden');
  
  const close = () => {
    dialog.classList.add('hidden');
    setTimeout(() => document.body.removeChild(dialog), 300);
  };
  
  document.getElementById('annotationDialogClose').onclick = close;
  document.getElementById('annotationCancel').onclick = close;
  document.getElementById('annotationSave').onclick = () => {
    const type = document.getElementById('annotationType').value;
    const note = document.getElementById('annotationNote').value.trim();
    const param = document.getElementById('annotationParameter').value;
    
    addAnnotation(timestamp, type, note, param);
    close();
  };
  
  document.getElementById('annotationNote').focus();
}

/**
 * Update annotation markers on plots
 */
function updateAnnotationMarkers(){
  // Remove existing markers
  document.querySelectorAll('.annotation-marker').forEach(marker => marker.remove());
  
  // Add markers to all plots
  const plotCards = document.querySelectorAll('.plot-card');
  plotCards.forEach(card => {
    const plot = card.querySelector('.plot');
    if (!plot || !plot._fullData) return;
    
    const parameter = card.querySelector('.plot-title span')?.textContent || '';
    const relevantAnnotations = annotations.filter(ann => 
      !ann.parameter || ann.parameter === parameter
    );
    
    relevantAnnotations.forEach(ann => {
      addAnnotationMarker(plot, ann);
    });
  });
}

/**
 * Add annotation marker to a plot
 * @param {HTMLElement} plotDiv - Plotly plot div
 * @param {Annotation} annotation - Annotation data
 */
function addAnnotationMarker(plotDiv, annotation){
  if (!plotDiv._fullLayout || !plotDiv._fullLayout.xaxis) return;
  
  const xPos = plotDiv._fullLayout.xaxis.d2p(annotation.timestamp);
  if (!Number.isFinite(xPos)) return;
  
  const rect = plotDiv.getBoundingClientRect();
  const plotRect = plotDiv.getBoundingClientRect();
  
  const marker = document.createElement('div');
  marker.className = 'annotation-marker';
  marker.style.position = 'absolute';
  marker.style.left = `${rect.left + xPos}px`;
  marker.style.top = `${rect.top}px`;
  marker.style.width = '2px';
  marker.style.height = `${rect.height}px`;
  marker.style.background = annotation.color;
  marker.style.zIndex = '100';
  marker.style.pointerEvents = 'none';
  marker.title = `${annotation.type}: ${annotation.note || 'No note'}`;
  
  // Add pin icon at top
  const pin = document.createElement('div');
  pin.className = 'annotation-pin';
  pin.style.position = 'absolute';
  pin.style.top = '0';
  pin.style.left = '-6px';
  pin.style.width = '14px';
  pin.style.height = '14px';
  pin.style.background = annotation.color;
  pin.style.borderRadius = '50%';
  pin.style.border = '2px solid var(--card-bg)';
  pin.style.cursor = 'pointer';
  pin.style.pointerEvents = 'auto';
  pin.title = `${annotation.type}: ${annotation.note || 'No note'}`;
  
  pin.addEventListener('click', () => {
    showAnnotationDetails(annotation);
  });
  
  marker.appendChild(pin);
  document.body.appendChild(marker);
  
  // Update position on scroll/resize
  const updatePosition = () => {
    const newRect = plotDiv.getBoundingClientRect();
    const newXPos = plotDiv._fullLayout.xaxis.d2p(annotation.timestamp);
    marker.style.left = `${newRect.left + newXPos}px`;
    marker.style.top = `${newRect.top}px`;
  };
  
  window.addEventListener('scroll', updatePosition, { passive: true });
  window.addEventListener('resize', updatePosition);
}

/**
 * Show annotation details
 * @param {Annotation} annotation - Annotation to show
 */
function showAnnotationDetails(annotation){
  const details = document.createElement('div');
  details.className = 'modal';
  details.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" id="annotationDetailsClose">×</button>
      <h3>Annotation Details</h3>
      <div class="annotation-details">
        <div class="detail-item">
          <label>Time</label>
          <span>${annotation.timestamp.toFixed(3)}s</span>
        </div>
        <div class="detail-item">
          <label>Type</label>
          <span style="color: ${annotation.color}">${annotation.type}</span>
        </div>
        ${annotation.parameter ? `
        <div class="detail-item">
          <label>Parameter</label>
          <span>${annotation.parameter}</span>
        </div>
        ` : ''}
        ${annotation.note ? `
        <div class="detail-item">
          <label>Note</label>
          <span>${annotation.note}</span>
        </div>
        ` : ''}
      </div>
      <div class="form-actions">
        <button id="annotationDelete" class="btn danger">Delete</button>
        <button id="annotationDetailsCloseBtn" class="btn ghost">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(details);
  details.classList.remove('hidden');
  
  const close = () => {
    details.classList.add('hidden');
    setTimeout(() => document.body.removeChild(details), 300);
  };
  
  document.getElementById('annotationDetailsClose').onclick = close;
  document.getElementById('annotationDetailsCloseBtn').onclick = close;
  document.getElementById('annotationDelete').onclick = () => {
    removeAnnotation(annotation.id);
    close();
  };
}

/**
 * Save annotations to IndexedDB
 */
async function saveAnnotations(){
  try {
    const { setSetting } = await import('./storage.js');
    await setSetting('annotations', annotations);
  } catch (error) {
    console.warn('Failed to save annotations:', error);
    // Fallback to localStorage
    localStorage.setItem('annotations', JSON.stringify(annotations));
  }
}

/**
 * Load annotations from IndexedDB
 */
async function loadAnnotations(){
  try {
    const { getSetting } = await import('./storage.js');
    const saved = await getSetting('annotations', []);
    if (Array.isArray(saved) && saved.length > 0){
      annotations = saved;
      annotationIdCounter = Math.max(...annotations.map(a => a.id || 0), 0) + 1;
      updateAnnotationMarkers();
    }
  } catch (error) {
    console.warn('Failed to load annotations:', error);
    // Fallback to localStorage
    const saved = localStorage.getItem('annotations');
    if (saved){
      try {
        annotations = JSON.parse(saved);
        annotationIdCounter = Math.max(...annotations.map(a => a.id || 0), 0) + 1;
        updateAnnotationMarkers();
      } catch (e) {
        console.warn('Failed to parse annotations from localStorage:', e);
      }
    }
  }
}

/**
 * Export annotations as JSON
 * @returns {string} JSON string
 */
export function exportAnnotations(){
  return JSON.stringify(annotations, null, 2);
}

/**
 * Import annotations from JSON
 * @param {string} json - JSON string
 */
export function importAnnotations(json){
  try {
    const imported = JSON.parse(json);
    if (Array.isArray(imported)){
      annotations = imported;
      annotationIdCounter = Math.max(...annotations.map(a => a.id || 0), 0) + 1;
      saveAnnotations();
      updateAnnotationMarkers();
    }
  } catch (error) {
    console.error('Failed to import annotations:', error);
    throw error;
  }
}
