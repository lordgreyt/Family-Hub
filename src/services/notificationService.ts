/**
 * Notification Service — tägliche Erinnerung für das Stimmungstagebuch
 *
 * Prüft minütlich, ob es 19:00 Uhr ist und zeigt eine Benachrichtigung an.
 * Wird nur aktiv, wenn der Nutzer Benachrichtigungen erlaubt hat
 * (localStorage 'ediary_notifications' === 'true').
 */

const NOTIFICATION_TIME_HOUR = 19; // 19:00 Uhr
let intervalId: ReturnType<typeof setInterval> | null = null;
let firedToday = false;

/**
 * Prüft, ob Benachrichtigungen aktiviert sind.
 */
export function areNotificationsEnabled(): boolean {
  return localStorage.getItem('ediary_notifications') === 'true' && Notification.permission === 'granted';
}

/**
 * Zeigt die tägliche Erinnerung an.
 */
function showReminder() {
  if (!areNotificationsEnabled()) return;

  const now = new Date();
  // Prüfe ob es ~19:00 ist und heute noch nicht gefeuert wurde
  if (now.getHours() === NOTIFICATION_TIME_HOUR && now.getMinutes() === 0 && !firedToday) {
    firedToday = true;
    try {
      new Notification('Family Hub — Stimmungstagebuch', {
        body: 'Wie war dein Tag heute? Trage schnell deine Stimmung ein! 🧠💪',
        icon: '/pwa-192x192.png',
        tag: 'ediary-reminder',
      });
    } catch {
      // Notification API nicht verfügbar
    }
  }

  // Reset um Mitternacht
  if (now.getHours() === 0 && now.getMinutes() === 0 && firedToday) {
    firedToday = false;
  }
}

/**
 * Initialisiert den minütlichen Check.
 * Gibt eine Cleanup-Funktion zurück.
 */
export function initNotificationService(): () => void {
  // Sofort prüfen (falls die App genau um 19:00 gestartet wird)
  showReminder();

  // Minütlich prüfen
  intervalId = setInterval(showReminder, 60 * 1000);

  return () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}
