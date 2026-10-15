export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

// Через service worker уведомления работают и в установленном на телефон приложении
export async function notify(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, icon: './icon.svg', badge: './icon.svg', tag: 'focus-timer' });
      return;
    }
  } catch {
    /* падаем на обычное уведомление */
  }
  try {
    new Notification(title, { body, icon: './icon.svg', tag: 'focus-timer' });
  } catch {
    /* на некоторых мобильных браузерах конструктор запрещён */
  }
}
