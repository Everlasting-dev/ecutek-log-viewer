// Mobile-specific improvements: touch gestures, bottom sheets, swipe navigation

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

/**
 * Detect if device is mobile
 * @returns {boolean}
 */
export function isMobile(){
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 1280);
}

/**
 * Initialize mobile-specific features
 */
export function initMobile(){
  if (!isMobile()) return;
  
  // Convert modals to bottom sheets on mobile
  convertModalsToBottomSheets();
  
  // Add swipe gestures for navigation
  initSwipeGestures();
  
  // Add touch gestures for plots (3s long-hold for window mode, double-tap reset)
  initPlotTouchGestures();
  
  // Flightradar24-style bottom bar with scroll hide/show
  initMobileBottomBar();
}

/**
 * Initialize mobile bottom bar: scroll hide/show, settings, theme, reset
 */
function initMobileBottomBar(){
  const bar = document.getElementById('mobileBottomBar');
  if (!bar) return;

  // Scroll hide/show
  let lastScrollY = window.scrollY;
  const scrollThreshold = 50;

  const handleScroll = () => {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;
    if (Math.abs(delta) >= scrollThreshold) {
      if (delta > 0) {
        bar.classList.add('mobile-bottom-bar-hidden');
      } else {
        bar.classList.remove('mobile-bottom-bar-hidden');
      }
    }
    lastScrollY = currentScrollY;
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  // Settings button
  const settingsBtn = document.getElementById('mobileSettingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const settingsClose = document.getElementById('settingsClose');

  if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
      settingsModal.classList.remove('hidden');
      syncSettingsModal();
    });
  }
  if (settingsClose && settingsModal) {
    settingsClose.addEventListener('click', () => settingsModal.classList.add('hidden'));
  }
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });
  }

  // Theme button: sun/moon toggle in bar
  const themeBtn = document.getElementById('mobileThemeBtn');
  const themeIcon = themeBtn?.querySelector('.mobile-theme-icon');
  const mainThemeToggle = document.getElementById('themeToggle');

  function updateMobileThemeIcon() {
    if (!themeIcon) return;
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    themeIcon.innerHTML = isLight
      ? '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>'
      : '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>';
    const label = themeBtn?.querySelector('span:last-child');
    if (label) label.textContent = isLight ? 'Dark' : 'Light';
  }

  if (themeBtn) {
    updateMobileThemeIcon();
    themeBtn.addEventListener('click', () => {
      mainThemeToggle?.click();
      setTimeout(updateMobileThemeIcon, 50);
    });
    const themeObs = new MutationObserver(updateMobileThemeIcon);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // Signals button (index only): dismiss rotate overlay when visible
  const signalsBtn = document.getElementById('mobileSignalsBtn');
  if (signalsBtn) {
    signalsBtn.addEventListener('click', () => {
      const overlay = document.getElementById('rotatePromptOverlay');
      if (overlay && !overlay.classList.contains('hidden')) {
        overlay.classList.add('hidden');
      }
    });
  }

  // Reset button
  const resetBtn = document.getElementById('mobileResetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const resetWindowBtn = document.getElementById('resetWindow');
      const resetTimeRangeBtn = document.getElementById('resetTimeRange');
      if (resetWindowBtn) resetWindowBtn.click();
      else if (resetTimeRangeBtn) resetTimeRangeBtn.click();
      else window.clearCompareTimeWindow?.();
    });
  }

  // Correlation: orientation gate - portrait shows rotate prompt, landscape navigates
  const correlationBtn = document.getElementById('mobileCorrelationBtn');
  const correlationLink = document.querySelector('a[href="compare.html"].mobile-bar-item');
  const target = correlationBtn || correlationLink;
  if (target) {
    target.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.innerWidth >= window.innerHeight) {
        window.location.href = 'compare.html';
      } else {
        showRotatePrompt();
      }
    });
  }

  setupSettingsModalHandlers();
}

function showRotatePrompt(){
  let overlay = document.getElementById('rotatePromptOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'rotatePromptOverlay';
    overlay.className = 'rotate-prompt-overlay';
    overlay.innerHTML = `<div class="rotate-prompt-content">
      <svg class="rotate-prompt-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
      <p>Please rotate your device to landscape to use Correlation Lab</p>
      <p style="font-size: 14px; font-weight: 400; margin-top: 8px; color: var(--muted);">Use the menu below to go back</p>
    </div>`;
    document.body.appendChild(overlay);
  }
  overlay.classList.remove('hidden');
  const onResize = () => {
    if (window.innerWidth >= window.innerHeight) {
      overlay.classList.add('hidden');
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.location.href = 'compare.html';
    }
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

function setupSettingsModalHandlers(){
  // Settings modal: sync toggle (index only), hints, changelog
  const settingsModal = document.getElementById('settingsModal');
  const settingsSyncToggle = document.getElementById('settingsSyncToggle');
  const settingsHintsBtn = document.getElementById('settingsHintsBtn');
  const settingsChangelogBtn = document.getElementById('settingsChangelogBtn');

  if (settingsSyncToggle) {
    const syncSnapToggle = document.getElementById('syncSnapToggle');
    settingsSyncToggle.addEventListener('change', () => {
      if (syncSnapToggle) {
        syncSnapToggle.checked = settingsSyncToggle.checked;
        syncSnapToggle.dispatchEvent(new Event('change'));
      }
    });
  }

  if (settingsHintsBtn) {
    const hintsBtn = document.getElementById('hintsBtn');
    settingsHintsBtn.addEventListener('click', () => {
      settingsModal?.classList.add('hidden');
      hintsBtn?.click();
    });
  }

  if (settingsChangelogBtn) {
    settingsChangelogBtn.addEventListener('click', () => {
      settingsModal?.classList.add('hidden');
      window.openChangelog?.();
    });
  }
}

function syncSettingsModal(){
  const settingsSyncToggle = document.getElementById('settingsSyncToggle');
  const syncSnapToggle = document.getElementById('syncSnapToggle');
  if (settingsSyncToggle && syncSnapToggle) settingsSyncToggle.checked = syncSnapToggle.checked;
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
 * Initialize swipe gestures for navigation
 */
function initSwipeGestures(){
  let touchStart = null;
  let touchEnd = null;
  
  const minSwipeDistance = 50;
  
  document.addEventListener('touchstart', (e) => {
    touchStart = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
  }, { passive: true });
  
  document.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    
    touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      time: Date.now()
    };
    
    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;
    const deltaTime = touchEnd.time - touchStart.time;
    
    // Ignore if too slow (not a swipe)
    if (deltaTime > 300) {
      touchStart = null;
      touchEnd = null;
      return;
    }
    
    // Ignore if scrolling
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      touchStart = null;
      touchEnd = null;
      return;
    }
    
    // Ignore swipe when rotate prompt is visible (user may be rotating device)
    const rotateOverlay = document.getElementById('rotatePromptOverlay');
    if (rotateOverlay && !rotateOverlay.classList.contains('hidden')) {
      touchStart = null;
      touchEnd = null;
      return;
    }

    // Horizontal swipe
    if (Math.abs(deltaX) > minSwipeDistance){
      if (deltaX > 0){
        // Swipe right - go to previous page/view
        handleSwipeRight();
      } else {
        // Swipe left - go to next page/view
        handleSwipeLeft();
      }
    }
    
    touchStart = null;
    touchEnd = null;
  }, { passive: true });
}

/**
 * Handle swipe right gesture
 */
function handleSwipeRight(){
  // Navigate to previous plot or previous page
  const currentPath = window.location.pathname;
  if (currentPath.includes('compare.html')){
    window.location.href = 'index.html';
  } else if (currentPath.includes('gear.html')){
    window.location.href = 'compare.html';
  } else if (currentPath.includes('analysis.html')){
    window.location.href = 'gear.html';
  }
}

/**
 * Handle swipe left gesture
 */
function handleSwipeLeft(){
  // Navigate to next plot or next page
  const currentPath = window.location.pathname;
  if (currentPath.includes('index.html') || currentPath === '/' || currentPath.endsWith('/')){
    window.location.href = 'compare.html';
  } else if (currentPath.includes('compare.html')){
    window.location.href = 'gear.html';
  } else if (currentPath.includes('gear.html')){
    window.location.href = 'analysis.html';
  }
}

/**
 * Initialize touch gestures for plots: 2s long-hold for window mode, triple-tap for reset.
 * Uses event delegation for dynamically added plots.
 */
function initPlotTouchGestures(){
  let longPressTimer = null;
  let tapCount = 0;
  let lastTapTime = 0;
  const LONG_PRESS_MS = 2000;
  const TRIPLE_TAP_MS = 500;

  function clearLongPress(){
    if (longPressTimer){
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleReset(){
    const resetWindowBtn = document.getElementById('resetWindow');
    const resetTimeRangeBtn = document.getElementById('resetTimeRange');
    if (resetWindowBtn) resetWindowBtn.click();
    else if (resetTimeRangeBtn) resetTimeRangeBtn.click();
    else window.clearCompareTimeWindow?.();
  }

  document.addEventListener('touchstart', (e) => {
    const plot = e.target.closest('.plot');
    if (!plot || e.touches.length !== 1) {
      clearLongPress();
      return;
    }
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      if (window.location.pathname.includes('compare')) {
        window.setCompareTimeWindowSelectEnabled?.(true);
      } else {
        window.setSelectionMode?.(true);
      }
      window.showWindowModeToast?.();
    }, LONG_PRESS_MS);
  }, { passive: true });

  document.addEventListener('touchmove', clearLongPress, { passive: true });
  document.addEventListener('touchend', clearLongPress, { passive: true });
  document.addEventListener('touchcancel', clearLongPress, { passive: true });

  document.addEventListener('touchend', (e) => {
    const plot = e.target.closest('.plot');
    if (!plot) return;
    const now = Date.now();
    if (now - lastTapTime <= TRIPLE_TAP_MS) {
      tapCount++;
    } else {
      tapCount = 1;
    }
    lastTapTime = now;
    if (tapCount === 3) {
      tapCount = 0;
      handleReset();
    }
  }, { passive: true });

  document.addEventListener('dblclick', (e) => {
    if (e.target.closest('.plot')) handleReset();
  });
}
