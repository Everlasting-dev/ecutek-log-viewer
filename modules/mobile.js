// Mobile-specific improvements: touch gestures and bottom sheets.

/**
 * Detect if device is mobile
 * @returns {boolean}
 */
export function isMobile(){
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 900) ||
         (window.innerHeight <= 500 && window.matchMedia("(orientation: landscape)").matches);
}

/**
 * Initialize mobile-specific features
 */
export function initMobile(){
  if (!isMobile()) return;
  
  // Convert modals to bottom sheets on mobile
  convertModalsToBottomSheets();
  
  // Add touch gestures for plots
  initPlotTouchGestures();
}

/**
 * Convert modals to bottom sheets on mobile
 */
function convertModalsToBottomSheets(){
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    if (isMobile()){
      modal.classList.add('modal-bottom-sheet');
    }
  });
  
  // Watch for new modals
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.classList && node.classList.contains('modal')){
          if (isMobile()){
            node.classList.add('modal-bottom-sheet');
          }
        }
      });
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Initialize touch gestures for plots (pinch to zoom, pan)
 */
function initPlotTouchGestures(){
  const plots = document.querySelectorAll('.plot');
  
  plots.forEach(plotDiv => {
    let initialDistance = 0;
    let lastTouchTime = 0;
    
    plotDiv.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2){
        // Two finger touch - prepare for pinch
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
      } else if (e.touches.length === 1){
        // Single touch - prepare for long press
        lastTouchTime = Date.now();
      }
    }, { passive: true });
    
    plotDiv.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialDistance > 0){
        // Pinch zoom
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        
        const scale = currentDistance / initialDistance;
        // Plotly handles zoom internally, but we can trigger it
        // This is a placeholder - Plotly's built-in touch handling is usually sufficient
      }
    }, { passive: false });
    
    plotDiv.addEventListener('touchend', () => {
      initialDistance = 0;
    }, { passive: true });
    
    // Long press for context menu (on mobile)
    let longPressTimer = null;
    plotDiv.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1){
        longPressTimer = setTimeout(() => {
          // Show export options or plot info
          showPlotContextMenu(plotDiv, e.touches[0].clientX, e.touches[0].clientY);
        }, 500);
      }
    }, { passive: true });
    
    plotDiv.addEventListener('touchend', () => {
      if (longPressTimer){
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }, { passive: true });
    
    plotDiv.addEventListener('touchmove', () => {
      if (longPressTimer){
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }, { passive: true });
  });
}

/**
 * Show context menu for plot on long press
 * @param {HTMLElement} plotDiv - Plot element
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
function showPlotContextMenu(plotDiv, x, y){
  // Create a simple context menu for export options
  const menu = document.createElement('div');
  menu.className = 'plot-context-menu';
  menu.style.position = 'fixed';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.zIndex = '10000';
  
  menu.innerHTML = `
    <div class="context-menu-item" data-action="export-png">Export as PNG</div>
    <div class="context-menu-item" data-action="export-svg">Export as SVG</div>
    <div class="context-menu-item" data-action="close">Close</div>
  `;
  
  document.body.appendChild(menu);
  
  // Handle clicks
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      
      if (action === 'export-png'){
        try {
          const { exportPlotPNG } = await import('./export.js');
          const title = plotDiv.closest('.plot-card')?.querySelector('.plot-title span')?.textContent || 'plot';
          await exportPlotPNG(plotDiv, title);
        } catch (error) {
          console.error('Export failed:', error);
        }
      } else if (action === 'export-svg'){
        try {
          const { exportPlotSVG } = await import('./export.js');
          const title = plotDiv.closest('.plot-card')?.querySelector('.plot-title span')?.textContent || 'plot';
          await exportPlotSVG(plotDiv, title);
        } catch (error) {
          console.error('Export failed:', error);
        }
      }
      
      document.body.removeChild(menu);
    });
  });
  
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(){
      if (menu.parentNode){
        document.body.removeChild(menu);
      }
      document.removeEventListener('click', closeMenu);
    }, { once: true });
  }, 100);
}
