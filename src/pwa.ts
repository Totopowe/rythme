import { registerSW } from 'virtual:pwa-register';

/** Enregistre le service worker : l'app fonctionne hors ligne et se met à jour seule. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });
}
