// About page functionality
// Theme management and UI interactions

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

function initTheme() {
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  const themeText = document.getElementById("themeText");
  
  // Load saved theme or default to dark
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeUI(savedTheme);
  
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const newTheme = currentTheme === "light" ? "dark" : "light";
      
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
      updateThemeUI(newTheme);
    });
  }
}

function updateThemeUI(theme) {
  const themeIcon = document.getElementById("themeIcon");
  const themeText = document.getElementById("themeText");
  
  if (theme === "light") {
    // Show moon icon for light mode (click to switch to dark)
    themeIcon.innerHTML = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>';
    themeText.textContent = "Dark";
  } else {
    // Show sun icon for dark mode (click to switch to light)
    themeIcon.innerHTML = '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>';
    themeText.textContent = "Light";
  }
}

// ============================================================================
// DROPDOWN INTERACTIONS
// ============================================================================

function initDropdowns() {
  // Handle dropdown menu interactions
  const dropdownItems = document.querySelectorAll(".dropdown-item");
  
  dropdownItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const text = item.textContent.trim();
      
      // Handle different menu actions
      switch(text) {
        case "Open CSV File":
          // Redirect to main page for file upload
          window.location.href = "index.html";
          break;
        case "Export Data":
          toast("Export functionality coming soon!", "ok");
          break;
        case "Multi Plot":
          window.location.href = "index.html";
          break;
        case "Mega Plot":
          window.location.href = "compare.html";
          break;
        case "About":
          // Already on about page
          break;
        case "Data Analysis":
          toast("Data analysis tools coming soon!", "ok");
          break;
        case "Statistics":
          toast("Statistics panel coming soon!", "ok");
          break;
        case "Performance Metrics":
          toast("Performance metrics coming soon!", "ok");
          break;
        case "Documentation":
          toast("Documentation coming soon!", "ok");
          break;
        default:
          console.log("Menu item clicked:", text);
      }
    });
  });
  
  // Handle navigation menu active states
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      if (!item.parentElement.classList.contains("dropdown")) {
        e.preventDefault();
        navItems.forEach(nav => nav.classList.remove("active"));
        item.classList.add("active");
      }
    });
  });
}

// ============================================================================
// STARTUP LOADING SCREEN
// ============================================================================

function showStartupLoading() {
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.classList.remove("hidden");
  }
}

function hideStartupLoading() {
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
  }
}

// ASCII Dot-Matrix Loading Animation
function createAsciiAnimation() {
  const asciiContainer = document.querySelector('.ascii-loading .matrix');
  if (!asciiContainer) return;
  
  const ROWS = 8, COLS = 8;
  const SCALE = [' ', '.', ':', '*', 'o', 'O', '#', '@'];
  const CELL_W = 2;
  const SPEED = 2.2;
  const FREQ = 1.2;
  const GLOW = 0.85;
  
  function render(t) {
    let out = '';
    const cx = (COLS - 1) / 2, cy = (ROWS - 1) / 2;
    
    for (let y = 0; y < ROWS; y++) {
      let line = '';
      for (let x = 0; x < COLS; x++) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.hypot(dx, dy);
        const phase = dist * FREQ - t * SPEED;
        let b = (Math.sin(phase) * 0.5 + 0.5) ** 1.35;
        b = Math.min(1, Math.max(0, b * GLOW));
        const idx = Math.min(SCALE.length - 1, Math.floor(b * (SCALE.length - 1)));
        const ch = SCALE[idx];
        line += ch + ' '.repeat(CELL_W - 1);
      }
      out += line + '\n';
    }
    return out;
  }
  
  let start = null;
  function tick(now) {
    if (!start) start = now;
    const t = (now - start) / 1000;
    
    if (asciiContainer) {
      asciiContainer.textContent = render(t);
    }
    
    // Continue animation for 3.5 seconds
    if (t < 3.5) {
      requestAnimationFrame(tick);
    }
  }
  
  requestAnimationFrame(tick);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function toast(msg, type = "ok") {
  // Simple toast notification
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === "error" ? "#3b0b0b" : "#0b3b18"};
    color: #e7ecf2;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid ${type === "error" ? "#742020" : "#1a6a36"};
    z-index: 1000;
    font-size: 14px;
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Show startup loading screen
  showStartupLoading();
  
  // Hide loading screen after 3-4 seconds
  setTimeout(() => {
    hideStartupLoading();
  }, 3500);
  
  // Initialize theme system
  initTheme();
  
  // Initialize dropdown interactions
  initDropdowns();
  // Init drawer
  initDrawer();
  
  // Start ASCII animation
  createAsciiAnimation();
  
  // Back to top button
  const toTopBtn = document.getElementById("toTop");
  if (toTopBtn) {
    toTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  }
  
  // Loading screen handlers
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.addEventListener("click", () => {
      hideStartupLoading();
      toast("Loading cancelled.", "error");
    });
  }
  
  // Add keyboard escape handler
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && loadingScreen && !loadingScreen.classList.contains("hidden")) {
      hideStartupLoading();
      toast("Loading cancelled.", "error");
    }
  });
});

// Drawer init (minimal copy)
function initDrawer(){
  const drawer = document.getElementById('drawer');
  const scrim = document.getElementById('drawerScrim');
  const edge = document.getElementById('edgeHint');
  if (!drawer || !scrim || !edge) return;
  const open = ()=>{ drawer.classList.add('open'); scrim.classList.add('show'); drawer.setAttribute('aria-hidden','false'); };
  const close = ()=>{ drawer.classList.remove('open'); scrim.classList.remove('show'); drawer.setAttribute('aria-hidden','true'); };
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') close(); });
  let startX=null, active=false;
  const start=(x)=>{ startX=x; active=true; };
  const move=(x)=>{ if(!active) return; if (x-startX>40) { open(); active=false; } };
  const onTouchStart=e=>{ if (window.matchMedia('(orientation:portrait)').matches) start(e.touches[0].clientX); };
  const onTouchMove =e=>{ if (window.matchMedia('(orientation:portrait)').matches) move(e.touches[0].clientX); };
  const onMouseDown =e=>{ if (window.matchMedia('(orientation:portrait)').matches && e.clientX<14) start(e.clientX); };
  const onMouseMove =e=>{ move(e.clientX); };
  const end=()=>{ active=false; };
  edge.addEventListener('touchstart', onTouchStart, {passive:true});
  edge.addEventListener('touchmove',  onTouchMove,  {passive:true});
  edge.addEventListener('mousedown',  onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', end);
  let dragStartX=null;
  drawer.addEventListener('touchstart', e=>{ dragStartX=e.touches[0].clientX; }, {passive:true});
  drawer.addEventListener('touchmove',  e=>{ const dx=e.touches[0].clientX-dragStartX; if (dx< -40) close(); }, {passive:true});
}
