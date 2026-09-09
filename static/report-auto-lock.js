(function () {
  const timeoutMs = 10000;
  const logoutPath = document.body.dataset.reportLogout || '/rapor-cikis';
  let locked = false;
  let timer = null;

  function redirectToLogin() {
    if (!locked) return;
    window.location.href = logoutPath;
  }

  function lockReport() {
    if (locked) return;
    locked = true;
    const overlay = document.createElement('div');
    overlay.className = 'report-auto-lock active';
    overlay.setAttribute('role', 'alert');
    document.body.appendChild(overlay);
    document.addEventListener('mousemove', redirectToLogin, { once: true });
  }

  function resetTimer() {
    if (locked) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(lockReport, timeoutMs);
  }

  for (const eventName of ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'pointermove']) {
    document.addEventListener(eventName, resetTimer, { passive: true });
  }

  resetTimer();
})();
