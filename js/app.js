'use strict';

// ── Router ────────────────────────────────────────
function route() {
  const hash = window.location.hash || '#dashboard';
  const view = hash.replace('#', '');
  State.currentView = view;
  setActiveNav(view);

  if (view === 'settings') {
    renderSettings();
  } else {
    renderDashboard();
  }
}

// ── Boot ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  loadNames();
  loadMockState(); // restore any saved mock config/status from localStorage
  initModal();

  // Small artificial delay so the loader animation looks intentional
  await new Promise(r => setTimeout(r, 900));
  hideLoader();

  window.addEventListener('hashchange', route);
  route();
});
