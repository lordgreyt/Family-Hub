import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';

export const NotificationManager = () => {
  const { user } = useAuth();
  const knownAssignments = useRef<Record<string, string | undefined>>({});
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!user || (user.id === 'Falko' && !user.isSetupComplete)) return;

    const requestPermission = async () => {
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        try {
          await Notification.requestPermission();
        } catch (e) {
          console.error('Fehler bei der Benachrichtigungsanfrage', e);
        }
      }
    };

    const showNotification = async (title: string, options: NotificationOptions) => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      try {
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
      } catch (error) {
        console.error('Konnte Notification nicht senden.', error);
      }
    };

    const checkAndNotifyReminders = async () => {
      const tasks = mockDb.getTasks();
      const todayString = new Date().toISOString().split('T')[0];
      
      const dueTasks = tasks.filter(t => 
        !t.isDone && 
        t.assignedTo === user.id && 
        t.dueDate === todayString
      );

      if (dueTasks.length === 0) return;

      const lastNotificationStr = localStorage.getItem(`last_task_notification_time_${user.id}`);
      const lastNotificationTime = lastNotificationStr ? parseInt(lastNotificationStr, 10) : 0;
      const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
      const now = Date.now();

      if (now - lastNotificationTime >= THREE_HOURS_MS) {
        await showNotification('Family Hub - Erinnerung!', {
          body: `Du hast heute noch ${dueTasks.length} unerledigte Aufgabe(n). Bleib dran!`,
          icon: '/pwa-192x192.png',
          badge: '/masked-icon.svg',
          tag: 'task-reminder',
          renotify: true
        });
        localStorage.setItem(`last_task_notification_time_${user.id}`, now.toString());
      }
    };

    const checkNewAssignments = () => {
      const allTasks = mockDb.getTasks();
      const users = mockDb.getUsers();
      const currentUserId = user.id;

      // 1. Initialisierung beim ersten Laden der Komponente (keine Benachrichtigungen für bestehende Aufgaben)
      if (!isInitialized.current) {
        allTasks.forEach(t => {
          knownAssignments.current[t.id] = t.assignedTo;
        });
        isInitialized.current = true;
        return;
      }

      // 2. Neue oder geänderte Zuweisungen prüfen
      allTasks.forEach(t => {
        const prevAssignedTo = knownAssignments.current[t.id];
        
        // Benachrichtigen wenn:
        // - Die Aufgabe dem aktuellen Nutzer zugewiesen ist
        // - UND sie vorher nicht dem aktuellen Nutzer zugewiesen war (neu oder geändert)
        // - UND der Ersteller nicht der aktuelle Nutzer ist
        // - UND die Aufgabe nicht erledigt ist
        if (
          t.assignedTo === currentUserId && 
          prevAssignedTo !== currentUserId && 
          t.createdBy !== currentUserId &&
          !t.isDone
        ) {
          const author = users.find(u => u.id === t.createdBy);
          showNotification('Neue Aufgabe für dich!', {
            body: `${author?.avatar || '👤'} ${t.createdBy} hat dir eine Aufgabe zugewiesen: "${t.content}"`,
            icon: '/pwa-192x192.png',
            badge: '/masked-icon.svg',
            tag: `new-task-${t.id}`,
            renotify: true
          });
        }
        
        knownAssignments.current[t.id] = t.assignedTo;
      });

      // 3. Cleanup: IDs von gelöschten Aufgaben aus dem Speicher entfernen
      const currentIds = new Set(allTasks.map(t => t.id));
      Object.keys(knownAssignments.current).forEach(id => {
        if (!currentIds.has(id)) {
          delete knownAssignments.current[id];
        }
      });
    };

    setTimeout(requestPermission, 2000);

    // Listener für Datenbank-Updates
    const handleDbUpdate = () => {
      checkNewAssignments();
      checkAndNotifyReminders();
    };

    window.addEventListener('db_updated', handleDbUpdate);
    
    // Initialer Check
    const initialTimeout = setTimeout(handleDbUpdate, 5000);

    // Periodischer Check (als Fallback)
    const intervalId = setInterval(handleDbUpdate, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('db_updated', handleDbUpdate);
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [user]);

  return null;
};
