// Utility functions for performance optimization

/**
 * Debounce function - delays execution until after wait time has passed
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately on first call
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 150, immediate = false){
  let timeout;
  return function executedFunction(...args){
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(this, args);
  };
}

/**
 * Throttle function - limits execution to at most once per wait time
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 16){
  let inThrottle;
  return function(...args){
    if (!inThrottle){
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Sleep utility for async operations
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
export function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
export function formatBytes(bytes){
  if (!Number.isFinite(bytes) || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1){
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

/**
 * Check if Web Workers are supported
 * @returns {boolean}
 */
export function supportsWebWorkers(){
  return typeof Worker !== 'undefined';
}

/**
 * Check if IndexedDB is supported
 * @returns {boolean}
 */
export function supportsIndexedDB(){
  return typeof indexedDB !== 'undefined';
}

/**
 * Scroll the page back to the top. Handles mobile browser quirks.
 */
export function scrollToTop(){
  const scrollRoot = document.scrollingElement || document.documentElement;

  scrollRoot.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  try {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  } catch {
    window.scrollTo(0, 0);
  }

  if (scrollRoot.scrollTo){
    try {
      scrollRoot.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    } catch { /* ignore */ }
  }

  requestAnimationFrame(() => {
    scrollRoot.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  });
}

/**
 * Bind the scroll-to-top handler to a button element.
 * @param {string} buttonId - Element id (default: "toTop")
 */
export function bindToTopButton(buttonId = "toTop"){
  const btn = document.getElementById(buttonId);
  if (!btn || btn.dataset.scrollBound === "1") return;
  btn.dataset.scrollBound = "1";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    scrollToTop();
  });
}
