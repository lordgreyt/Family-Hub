import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';

export const NotificationManager = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.id === 'Falko' && !user.isSetupComplete) return;

    const requestPermission = async () => {
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        try {
          await Notification.requestPermission();
        } catch (e) {
          console.error('Fehler bei der Benachrichtigungsanfrage', e);
        }
      }
    };

    const checkAndNotify = async () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      const tasks = mockDb.getTasks();
      const todayString = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
      
      const dueTasks = tasks.filter(t => 
        !t.isDone && 
        t.assignedTo === user.id && 
        t.dueDate === todayString
      );

      if (dueTasks.length === 0) return;

      const lastNotificationStr = localStorage.getItem(`last_task_notification_time_${user.id}`);
      const lastNotificationTime = lastNotificationStr ? parseInt(lastNotificationStr, 10) : 0;
      
      const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
      // for testing purposes or strict timing
      const now = Date.now();

      if (now - lastNotificationTime >= THREE_HOURS_MS) {
        const title = 'Family Hub - Erinnerung!';
        const options = {
          body: `Du hast heute noch ${dueTasks.length} unerledigte Aufgabe(n). Bleib dran!`,
          icon: '/pwa-192x192.png',
          badge: '/masked-icon.svg',
          tag: 'task-reminder',
          renotify: true
        };

        try {
          // Try to show notification via service worker (better support on mobile Android)
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
              await reg.showNotification(title, options);
            } else {
              new Notification(title, options);
            }
          } else {
            new Notification(title, options);
          }
          localStorage.setItem(`last_task_notification_time_${user.id}`, now.toString());
        } catch (error) {
          console.error('Konnte Notification nicht senden.', error);
        }
      }
    };

    // Delay the initial permission request slightly so it's not too aggressive on first load
    setTimeout(requestPermission, 2000);

    // Initial check after 5 seconds
    const initialTimeout = setTimeout(checkAndNotify, 5000);

    // Then check every 5 minutes (in case the browser background tab is throttling)
    const intervalId = setInterval(checkAndNotify, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [user]);

  return null; // Invisible component
};
