import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';

export const NotificationManager = () => {
  const { user } = useAuth();
  const knownAssignments = useRef<Record<string, string | undefined>>({});
  const knownRequests = useRef<Set<string>>(new Set());
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!user || user.isChild || (user.id === 'Falko' && !user.isSetupComplete)) return;

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

      // 1. Initialisierung beim ersten Laden (keine Benachrichtigungen für Bestehendes)
      if (!isInitialized.current) {
        allTasks.forEach(t => {
          knownAssignments.current[t.id] = t.assignedTo;
        });
        return;
      }

      allTasks.forEach(t => {
        const prevAssignedTo = knownAssignments.current[t.id];
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

      const currentIds = new Set(allTasks.map(t => t.id));
      Object.keys(knownAssignments.current).forEach(id => {
        if (!currentIds.has(id)) delete knownAssignments.current[id];
      });
    };

    const checkNewRequests = () => {
      const mealRequests = mockDb.getMealPlanItems().filter(i => i.status === 'PENDING');
      const starRequests = mockDb.getRewardRequests().filter(r => r.status === 'PENDING');
      const templates = mockDb.getMealTemplates();
      const users = mockDb.getUsers();

      // 1. Initialisierung
      if (!isInitialized.current) {
        mealRequests.forEach(r => knownRequests.current.add(r.id));
        starRequests.forEach(r => knownRequests.current.add(r.id));
        isInitialized.current = true;
        return;
      }

      // 2. Meal Requests
      mealRequests.forEach(r => {
        if (!knownRequests.current.has(r.id)) {
          const reqUser = users.find(u => u.id === r.requestedBy);
          const template = templates.find(t => t.id === r.templateId);
          showNotification('Neue Mahlzeiten-Anfrage!', {
            body: `${reqUser?.avatar || '👤'} ${r.requestedBy} wünscht sich ${template?.emoji || '🍽️'} ${template?.title || 'ein Gericht'}.`,
            icon: '/pwa-192x192.png',
            tag: `meal-req-${r.id}`
          });
          knownRequests.current.add(r.id);
        }
      });

      // 3. Star Requests
      starRequests.forEach(r => {
        if (!knownRequests.current.has(r.id)) {
          const reqUser = users.find(u => u.id === r.childId);
          showNotification('Anfrage für Medienzeit!', {
            body: `${reqUser?.avatar || '👤'} ${r.childId} möchte ${r.stars} Sterne einlösen.`,
            icon: '/pwa-192x192.png',
            tag: `star-req-${r.id}`
          });
          knownRequests.current.add(r.id);
        }
      });

      // 4. Cleanup
      const currentIds = new Set([...mealRequests.map(r => r.id), ...starRequests.map(r => r.id)]);
      knownRequests.current.forEach(id => {
        if (!currentIds.has(id)) knownRequests.current.delete(id);
      });
    };

    setTimeout(requestPermission, 2000);

    const handleDbUpdate = () => {
      checkNewAssignments();
      checkAndNotifyReminders();
      checkNewRequests();
    };

    window.addEventListener('db_updated', handleDbUpdate);
    const initialTimeout = setTimeout(handleDbUpdate, 2000);
    const intervalId = setInterval(handleDbUpdate, 2 * 60 * 1000);

    return () => {
      window.removeEventListener('db_updated', handleDbUpdate);
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [user]);

  return null;
};

