export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`/sw.js?v=${Date.now()}`);
      await registration.update();
    } catch (error) {
      console.warn('Service worker não registrado:', error);
    }
  });
}
