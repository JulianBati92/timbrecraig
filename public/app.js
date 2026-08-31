(() => {
  const form = document.querySelector('#visitorForm');
  const quick = document.querySelector('#quickRing');
  const status = document.querySelector('#status');
  const homeId = location.pathname.startsWith('/r/') ? decodeURIComponent(location.pathname.split('/')[2] || '') : 'casa';
  let busy = false;

  function show(message, type) { status.textContent = message; status.className = `status ${type}`; }
  async function ring(payload = {}) {
    if (busy) return;
    busy = true; quick.disabled = true; form.querySelector('button').disabled = true; show('Enviando aviso…', 'ok');
    try {
      const response = await fetch(`/api/homes/${encodeURIComponent(homeId)}/ring`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pudimos enviar el aviso.');
      show('🔔 ¡Listo! Ya avisamos que estás en la puerta.', 'ok');
      if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
      form.reset();
    } catch (error) { show(error.message || 'Ocurrió un error. Intentá nuevamente.', 'error'); }
    finally { busy = false; quick.disabled = false; form.querySelector('button').disabled = false; }
  }
  quick.addEventListener('click', () => ring({ reason: 'Visita' }));
  form.addEventListener('submit', event => { event.preventDefault(); const data = new FormData(form); ring(Object.fromEntries(data.entries())); });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
})();