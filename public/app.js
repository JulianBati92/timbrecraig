(() => {
  const form = document.querySelector('#visitorForm');
  const quick = document.querySelector('#quickRing');
  const submit = form.querySelector('.send');
  const status = document.querySelector('#status');
  const bell = document.querySelector('#bellIcon');
  const toast = document.querySelector('#toast');
  const toastIcon = document.querySelector('#toastIcon');
  const toastTitle = document.querySelector('#toastTitle');
  const toastMessage = document.querySelector('#toastMessage');
  const homeId = location.pathname.startsWith('/r/') ? decodeURIComponent(location.pathname.split('/')[2] || '') : 'casa';
  let busy = false;
  let toastTimer;

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
  }

  function showToast(title, message, type = 'success') {
    clearTimeout(toastTimer);
    toast.className = `toast ${type === 'error' ? 'error' : ''} show`;
    toastIcon.textContent = type === 'error' ? '!' : '✓';
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4800);
  }

  function animateBell() {
    bell.classList.remove('ringing');
    void bell.offsetWidth;
    bell.classList.add('ringing');
    setTimeout(() => bell.classList.remove('ringing'), 800);
  }

  function setBusy(value) {
    busy = value;
    quick.disabled = value;
    submit.disabled = value;
    quick.classList.toggle('is-loading', value);
  }

  async function ring(payload = {}) {
    if (busy) return;
    setBusy(true);
    animateBell();
    showStatus('🔔 Tocando el timbre… estamos enviando tu aviso.', 'sending');
    if (navigator.vibrate) navigator.vibrate(45);

    try {
      const response = await fetch(`/api/homes/${encodeURIComponent(homeId)}/ring`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pudimos enviar el aviso.');

      quick.classList.add('success');
      showStatus('✓ ¡Aviso enviado! Ya saben que estás en la puerta.', 'ok');
      showToast('¡Timbre enviado!', 'El aviso llegó correctamente. Esperá unos instantes, ya saben que estás acá.');
      animateBell();
      if (navigator.vibrate) navigator.vibrate([80, 45, 120]);
      form.reset();
      setTimeout(() => quick.classList.remove('success'), 1800);
    } catch (error) {
      const message = error.message || 'Ocurrió un error. Intentá nuevamente.';
      showStatus(`⚠ ${message}`, 'error');
      showToast('No pudimos avisar', message, 'error');
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    } finally {
      setBusy(false);
    }
  }

  quick.addEventListener('click', () => ring({ reason: 'Visita' }));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    ring(Object.fromEntries(data.entries()));
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
})();