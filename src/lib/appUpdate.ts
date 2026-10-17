import { registerSW } from 'virtual:pwa-register';

// Приложение работает офлайн: service worker хранит копию всех файлов. Чтобы не застревать на
// старой версии, проверяем обновления при запуске, при возвращении в приложение и раз в полчаса.
// В режиме autoUpdate новая версия ставится сама и страница перезагружается.
let registration: ServiceWorkerRegistration | undefined;

export function setupAppUpdates() {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, r) {
      registration = r;
      if (!r) return;
      const check = () => {
        if (navigator.onLine) r.update().catch(() => {});
      };
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
}

// Ручная проверка из настроек: true — нашлась новая версия (страница перезагрузится сама)
export async function checkForUpdate(): Promise<boolean> {
  if (!registration) return false;
  await registration.update();
  return !!(registration.installing || registration.waiting);
}

export const BUILD_TIME: string = __BUILD_TIME__;
