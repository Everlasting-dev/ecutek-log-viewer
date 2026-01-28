// Keyboard shortcuts handler for improved UX

const shortcuts = new Map();
let shortcutsModal = null;

/**
 * Register a keyboard shortcut
 * @param {string} key - Key to listen for (e.g., 'o', 's', 'Escape')
 * @param {Object} options - Shortcut options
 * @param {Function} options.handler - Function to call when shortcut is pressed
 * @param {boolean} options.ctrl - Require Ctrl key (or Cmd on Mac)
 * @param {boolean} options.shift - Require Shift key
 * @param {boolean} options.alt - Require Alt key
 * @param {string} options.description - Description for shortcuts modal
 * @param {boolean} options.preventDefault - Prevent default browser behavior (default: true)
 */
export function registerShortcut(key, { handler, ctrl = false, shift = false, alt = false, description = '', preventDefault = true }){
  const id = `${key}-${ctrl}-${shift}-${alt}`;
  shortcuts.set(id, { key, ctrl, shift, alt, handler, description, preventDefault });
}

/**
 * Unregister a keyboard shortcut
 * @param {string} key - Key to unregister
 * @param {Object} options - Options matching registration
 */
export function unregisterShortcut(key, { ctrl = false, shift = false, alt = false }){
  const id = `${key}-${ctrl}-${shift}-${alt}`;
  shortcuts.delete(id);
}

/**
 * Initialize keyboard shortcuts system
 */
export function initShortcuts(){
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in inputs/textarea
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable){
      // Allow Escape to close modals even when typing
      if (e.key === 'Escape') {
        // Let it bubble up for modal closing
        return;
      }
      return;
    }
    
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
    
    // Find matching shortcut
    for (const [id, shortcut] of shortcuts.entries()){
      if (shortcut.key.toLowerCase() === e.key.toLowerCase() &&
          shortcut.ctrl === ctrlKey &&
          shortcut.shift === e.shiftKey &&
          shortcut.alt === e.altKey){
        
        if (shortcut.preventDefault){
          e.preventDefault();
        }
        
        shortcut.handler(e);
        break;
      }
    }
  });
  
  // Register ? key to show shortcuts modal
  registerShortcut('?', {
    handler: () => showShortcutsModal(),
    description: 'Show keyboard shortcuts',
    preventDefault: true
  });
}

/**
 * Show shortcuts modal
 */
function showShortcutsModal(){
  if (!shortcutsModal){
    createShortcutsModal();
  }
  shortcutsModal.classList.remove('hidden');
}

/**
 * Hide shortcuts modal
 */
function hideShortcutsModal(){
  if (shortcutsModal){
    shortcutsModal.classList.add('hidden');
  }
}

/**
 * Create shortcuts modal
 */
function createShortcutsModal(){
  shortcutsModal = document.createElement('div');
  shortcutsModal.className = 'modal hidden';
  shortcutsModal.id = 'shortcutsModal';
  
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifierKey = isMac ? '⌘' : 'Ctrl';
  
  const shortcutsList = Array.from(shortcuts.values())
    .filter(s => s.description) // Only show shortcuts with descriptions
    .map(s => {
      const modifiers = [];
      if (s.ctrl) modifiers.push(isMac ? '⌘' : 'Ctrl');
      if (s.shift) modifiers.push('Shift');
      if (s.alt) modifiers.push('Alt');
      const keyCombo = modifiers.length > 0 
        ? `${modifiers.join(' + ')} + ${s.key.toUpperCase()}`
        : s.key.toUpperCase();
      return `<div class="shortcut-item">
        <kbd>${keyCombo}</kbd>
        <span>${s.description}</span>
      </div>`;
    })
    .join('');
  
  shortcutsModal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" id="shortcutsClose" aria-label="Close shortcuts">×</button>
      <h3>Keyboard Shortcuts</h3>
      <div class="shortcuts-list">
        ${shortcutsList || '<p class="muted">No shortcuts registered yet.</p>'}
      </div>
      <p class="muted" style="margin-top: 16px; font-size: 12px;">
        Press <kbd>?</kbd> to toggle this help.
      </p>
    </div>
  `;
  
  document.body.appendChild(shortcutsModal);
  
  const closeBtn = shortcutsModal.querySelector('#shortcutsClose');
  if (closeBtn){
    closeBtn.addEventListener('click', hideShortcutsModal);
  }
  
  shortcutsModal.addEventListener('click', (e) => {
    if (e.target === shortcutsModal){
      hideShortcutsModal();
    }
  });
  
  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && shortcutsModal && !shortcutsModal.classList.contains('hidden')){
      hideShortcutsModal();
    }
  });
}

/**
 * Get modifier key symbol for display
 * @returns {string} Modifier key symbol
 */
export function getModifierKey(){
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return isMac ? '⌘' : 'Ctrl';
}
