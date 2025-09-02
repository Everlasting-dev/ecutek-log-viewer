// display-mode detection
const isStandalone = window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

function showView(id){
  document.querySelectorAll('section[id^="view-"]').forEach(s => s.hidden = true);
  const el = document.querySelector('#view-' + id);
  if (el) el.hidden = false;
}
function goto(id){
  showView(id);
  history.pushState({v:id}, '', '#' + id);
}
window.addEventListener('popstate', e => showView((e.state && e.state.v) || 'home'));

// intercept internal links when standalone
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const url = new URL(a.href, location.href);
  const sameOrigin = url.origin === location.origin;
  if (isStandalone && sameOrigin) {
    e.preventDefault();
    const view = (url.hash.replace('#','') || (url.pathname.endsWith('compare.html') ? 'mega':'home'));
    goto(view);
  }
}, {capture:true});

document.getElementById('btn-mega')?.addEventListener('click', (e)=>{ e.preventDefault(); goto('mega'); });
document.getElementById('btn-home')?.addEventListener('click', (e)=>{ e.preventDefault(); goto('home'); });

// theme toggle via CSS vars on <html>
(function themeInit(){
  const KEY = 'ak-theme';
  const root = document.documentElement;
  const saved = localStorage.getItem(KEY);
  if (saved) root.dataset.theme = saved;
  else if (window.matchMedia('(prefers-color-scheme: light)').matches) root.dataset.theme = 'light';
  document.querySelectorAll('#btn-theme').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      root.dataset.theme = (root.dataset.theme === 'light') ? 'dark' : 'light';
      localStorage.setItem(KEY, root.dataset.theme);
    });
  });
})();

// guard window.open in standalone
const _open = window.open;
window.open = function(url, target, features){
  if (isStandalone && typeof url === 'string') { location.href = url; return null; }
  return _open.apply(window, arguments);
};

// expose goto for modules
window.goto = goto;

