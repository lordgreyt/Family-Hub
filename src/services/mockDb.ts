import { v4 as uuidv4 } from 'uuid';
import { db } from './firebase';
import { ref, set as firebaseSet, onValue, get as firebaseGet } from 'firebase/database';

// Types
export interface User {
  id: string; // The user's typed alias (e.g. "Markus")
  uid?: string; // Firebase Authentication UID
  avatar: string; // Emoji
  isAdmin?: boolean;
  isSetupComplete?: boolean;
  isChild?: boolean;
  unlockedGames?: string[];
  defaultPath?: string;
}

export interface BudgetItem {
  id: string;
  title: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  createdAt: number;
  createdBy: string; // User ID
}

export interface NoteItem {
  id: string;
  title?: string;
  content: string;
  isShared: boolean;
  createdAt: number;
  createdBy: string; // User ID
}

export interface TaskItem {
  id: string;
  content: string;
  isShared: boolean;
  isDone: boolean;
  priority: 1 | 2 | 3;
  dueDate?: string;
  assignedTo?: string[];
  createdAt: number;
  completedAt?: number;
  createdBy: string; // User ID
}

export interface MealTemplate {
  id: string;
  title: string;
  emoji: string;
  createdBy: string;
}

export interface MealPlanItem {
  id: string;
  templateId: string;
  date: string; // YYYY-MM-DD
  status: 'PENDING' | 'APPROVED';
  requestedBy: string; // User ID
  createdAt: number;
}

export interface RewardRequest {
  id: string;
  childId: string;
  stars: number; // Positive = spending, Negative = earning/bonus
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: number;
  acknowledged?: boolean;
  taskId?: string; // If this comes from a completed task
  description?: string; // Optional description
}

export interface ScoreEntry {
  gameId: string;
  childId: string;
  score: number;
}

export interface ExpenseItem {
  id: string;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  type: 'INCOME' | 'EXPENSE';
  description?: string;
  createdAt: number;
  createdBy: string;
}

export interface ExpenseBudget {
  month: string; // YYYY-MM
  amount: number;
}

export interface Depot {
  id: string;
  name: string;
  monthlyAmount: number;
  startBalance: number;
  createdAt: number;
}

export interface DepotTransaction {
  id: string;
  depotId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: number;
  isAutomated?: boolean;
}

export interface N26Settings {
  autoBookingEnabled: boolean;
  bookingDay: number; // 1-28
  lastAutoBookingMonth?: string; // YYYY-MM
  closedYears?: number[];
}

// Initial Data
const INITIAL_USERS: User[] = [
  { id: 'Falko', uid: 'thOJVf4L9cd2BysM2bFOeuC14yV2', avatar: '👨', isAdmin: true, isSetupComplete: true },
  { id: 'Anja', uid: 'zaKMNvN3UFTnFRE2VT8EmioWfGk1', avatar: '👩', isSetupComplete: true },
  { id: 'Lennart', uid: 'kyWmQqGiwuRLXc0B0ZJtfWFITNB3', avatar: '👦', isSetupComplete: true, isChild: true },
];

const INITIAL_DEPOTS: Depot[] = [
  { id: '1', name: 'GEZ', startBalance: 0, monthlyAmount: 11, createdAt: Date.now() },
  { id: '2', name: 'Arag Zahn + Hund', startBalance: 308.40, monthlyAmount: 57, createdAt: Date.now() },
  { id: '3', name: 'Diverses', startBalance: -169.67, monthlyAmount: 93.5, createdAt: Date.now() },
  { id: '4', name: 'GEZ (Steuer)', startBalance: -4.96, monthlyAmount: 18.36, createdAt: Date.now() },
  { id: '5', name: 'Grundsteuer + Finanzamt', startBalance: 39.85, monthlyAmount: 129, createdAt: Date.now() },
  { id: '6', name: 'Haftpflicht', startBalance: 26.83, monthlyAmount: 6, createdAt: Date.now() },
  { id: '7', name: 'Heizkosten', startBalance: 1429.38, monthlyAmount: 150, createdAt: Date.now() },
  { id: '8', name: 'Instandhaltung', startBalance: 0, monthlyAmount: 60, createdAt: Date.now() },
  { id: '9', name: 'Internet', startBalance: 10.23, monthlyAmount: 50, createdAt: Date.now() },
  { id: '10', name: 'KFZ-Versicherungen', startBalance: 230, monthlyAmount: 75, createdAt: Date.now() },
  { id: '11', name: 'Müll', startBalance: 2, monthlyAmount: 27, createdAt: Date.now() },
  { id: '12', name: 'Rücklagen Auto', startBalance: 150, monthlyAmount: 150, createdAt: Date.now() },
  { id: '13', name: 'Schornsteinfeger', startBalance: 11.22, monthlyAmount: 20, createdAt: Date.now() },
  { id: '14', name: 'Strom', startBalance: 91.36, monthlyAmount: 120, createdAt: Date.now() },
  { id: '15', name: 'Waki + Aufbereitung', startBalance: 28, monthlyAmount: 123, createdAt: Date.now() },
  { id: '16', name: 'Wartung Heizung', startBalance: 66, monthlyAmount: 27, createdAt: Date.now() },
  { id: '17', name: 'Wasser', startBalance: 3, monthlyAmount: 95, createdAt: Date.now() },
  { id: '18', name: 'Wohngebäude/Hausrat', startBalance: 155.2, monthlyAmount: 47, createdAt: Date.now() },
];

export const DB_KEYS = {
  USERS: 'family_hub_users',
  PROFILES: 'profiles',
  BUDGET: 'family_hub_budget',
  NOTES: 'family_hub_notes',
  TASKS: 'family_hub_tasks',
  MEAL_TEMPLATES: 'family_hub_meal_templates',
  MEAL_PLAN: 'family_hub_meal_plan',
  REWARDS: 'family_hub_rewards',
  LEADERBOARD: 'family_hub_leaderboard',
  EXPENSES: 'family_hub_expenses',
  EXPENSE_BUDGETS: 'family_hub_expense_budgets',
  DEPOTS: 'family_hub_depots',
  DEPOT_TRANSACTIONS: 'family_hub_depot_transactions',
  N26_SETTINGS: 'family_hub_n26_settings',
  UNLOCKED_VIDEOS: 'family_hub_unlocked_videos',
  APP_SETTINGS: 'family_hub_settings',
  VICTRON_SETTINGS: 'family_hub_victron_settings',
};

function get<T>(key: string, initialValue: T): T {
  const data = localStorage.getItem(key);
  if (!data) return initialValue;
  try {
    return JSON.parse(data) as T;
  } catch (e) {
    return initialValue;
  }
}

// Generic set helper: Updates local immediately (optimistic UI) AND pushes to Firebase cloud
function set<T>(key: string, data: T): void {
  // 1. Optimistic Local Update
  localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(new Event('db_updated'));
  
  // 2. Push to Cloud
  console.log(`Syncing ${key} to Cloud...`, data);
  firebaseSet(ref(db, key), data)
    .then(() => console.log(`Cloud sync success for ${key}`))
    .catch(e => {
      console.error(`Firebase write error for ${key}:`, e);
      // Optional: notify user of sync error
    });
}

// Global initialization function to wire up Firebase Cloud Sync
export const initFirebase = async () => {
  const rootRef = ref(db, '/');
  
  // 1. Check if Firebase is empty. If yes, upload local data!
  try {
    const snapshot = await firebaseGet(rootRef);
    if (!snapshot.exists()) {
      console.log("Cloud DB is empty. Executing initial sync of local data to Cloud...");
      const dump = {
        [DB_KEYS.USERS]: get(DB_KEYS.USERS, INITIAL_USERS),
        [DB_KEYS.BUDGET]: get(DB_KEYS.BUDGET, []),
        [DB_KEYS.NOTES]: get(DB_KEYS.NOTES, []),
        [DB_KEYS.TASKS]: get(DB_KEYS.TASKS, []),
        [DB_KEYS.MEAL_TEMPLATES]: get(DB_KEYS.MEAL_TEMPLATES, [
          { id: '1', title: 'Pizza', emoji: '🍕', createdBy: 'Falko' },
          { id: '2', title: 'Nudeln', emoji: '🍝', createdBy: 'Falko' },
          { id: '3', title: 'Pfannkuchen', emoji: '🥞', createdBy: 'Falko' },
        ]),
        [DB_KEYS.MEAL_PLAN]: get(DB_KEYS.MEAL_PLAN, []),
        [DB_KEYS.REWARDS]: get(DB_KEYS.REWARDS, []),
        [DB_KEYS.LEADERBOARD]: get(DB_KEYS.LEADERBOARD, []),
        [DB_KEYS.EXPENSES]: get(DB_KEYS.EXPENSES, []),
        [DB_KEYS.EXPENSE_BUDGETS]: get(DB_KEYS.EXPENSE_BUDGETS, []),
        [DB_KEYS.DEPOTS]: get(DB_KEYS.DEPOTS, INITIAL_DEPOTS),
        [DB_KEYS.DEPOT_TRANSACTIONS]: get(DB_KEYS.DEPOT_TRANSACTIONS, []),
        [DB_KEYS.N26_SETTINGS]: get(DB_KEYS.N26_SETTINGS, { autoBookingEnabled: false, bookingDay: 1, closedYears: [] }),
        [DB_KEYS.UNLOCKED_VIDEOS]: get(DB_KEYS.UNLOCKED_VIDEOS, []),
        [DB_KEYS.APP_SETTINGS]: get(DB_KEYS.APP_SETTINGS, null),
      };
      await firebaseSet(rootRef, dump);
      console.log("Initial Cloud sync complete!");
    } else {
      console.log("Cloud DB exists. Connected to real-time streams.");
    }
  } catch (error) {
    console.error("Error during initial Firebase sync Check:", error);
  }

  // 2. Attach global real-time listener to sync remote changes to local cache
  onValue(rootRef, (snap) => {
    const remoteData = snap.val();
    if (remoteData) {
      let changed = false;
      Object.keys(DB_KEYS).forEach(k => {
        const key = DB_KEYS[k as keyof typeof DB_KEYS];
        if (remoteData[key] !== undefined) {
          const currentLocal = localStorage.getItem(key);
          const newLocal = JSON.stringify(remoteData[key]);
          if (currentLocal !== newLocal) {
            localStorage.setItem(key, newLocal);
            changed = true;
          }
        }
      });
      // Give React a heads up that data has changed underneath it
      if (changed) {
        window.dispatchEvent(new Event('db_updated'));
      }
    }
  });
  
  // 3. One-time migration: Convert completed tasks to RewardRequests
  const migrationKey = 'migration_tasks_to_rewards_v2';
  if (!localStorage.getItem(migrationKey)) {
    console.log("Running migration: Tasks to RewardRequests...");
    const tasks = mockDb.getTasks();
    const rewards = mockDb.getRewardRequests();
    let newRewards = [...rewards];
    let changed = false;

    // We need prio points. Since we don't have settings context here, 
    // we try to get them from localStorage or use defaults.
    const settingsRaw = localStorage.getItem('family_hub_settings');
    const settings = settingsRaw ? JSON.parse(settingsRaw) : { prioPoints: { 1: 5, 2: 10, 3: 20 } };
    const prioPoints = settings.prioPoints || { 1: 5, 2: 10, 3: 20 };
    const users = mockDb.getUsers();

    tasks.filter(t => t.isDone).forEach(task => {
      // Find children who should get points for this task
      const eligibleChildren = users.filter(u => 
        u.isChild && (task.assignedTo?.includes(u.id) || (task.isShared && (!task.assignedTo || task.assignedTo.length === 0)))
      );

      eligibleChildren.forEach(child => {
        const rewardId = `task-stars-${task.id}-${child.id}`;
        if (!newRewards.some(r => r.id === rewardId)) {
          newRewards.push({
            id: rewardId,
            childId: child.id,
            stars: -(prioPoints[task.priority] || 0),
            status: 'APPROVED',
            createdAt: task.completedAt || task.createdAt,
            taskId: task.id,
            description: `Erledigt: ${task.content}`
          } as RewardRequest);
          changed = true;
        }
      });
    });

    if (changed) {
      set(DB_KEYS.REWARDS, newRewards);
      console.log(`Migration complete: Created ${newRewards.length - rewards.length} reward entries.`);
    }
    localStorage.setItem(migrationKey, 'true');
  }
};


export const mockDb = {
  // Profiles (profiles/[uid])
  saveProfile: async (uid: string, profileData: Partial<User>) => {
    // 1. Save to the specific profiles/[uid] path
    const profileRef = ref(db, `${DB_KEYS.PROFILES}/${uid}`);
    await firebaseSet(profileRef, profileData);
    
    // 2. Also ensure it's in our main users list for legacy compatibility and easy listing
    const users = mockDb.getUsers();
    const existing = users.find(u => u.uid === uid || u.id === profileData.id);
    
    if (existing) {
      mockDb.updateUser({ ...existing, ...profileData, uid });
    } else {
      mockDb.addUser({ 
        id: profileData.id || 'Unknown', 
        avatar: profileData.avatar || '❓', 
        ...profileData, 
        uid 
      } as User);
    }
  },

  // Users (Always Shared)
  getUsers: (): User[] => {
    const data = get<User[]>(DB_KEYS.USERS, INITIAL_USERS) || [];
    // Migration: ensure UIDs are present if cloud/local state was already populated
    const needsMigration = data.some(u => u && ((u.id === 'Falko' && !u.uid) || u.id === 'Markus' || u.id === 'Sarah'));
    
    if (needsMigration) {
       console.log("Applying user migration to link UIDs...");
       const migrated = data.map(u => {
         if (!u) return null;
         if (u.id === 'Falko') return { ...u, uid: 'thOJVf4L9cd2BysM2bFOeuC14yV2', isAdmin: true };
         if (u.id === 'Anja' || u.id === 'Sarah') return { id: 'Anja', uid: 'zaKMNvN3UFTnFRE2VT8EmioWfGk1', avatar: u.avatar || '👩', isSetupComplete: true };
         if (u.id === 'Lennart' || u.id === 'Markus') return { id: 'Lennart', uid: 'kyWmQqGiwuRLXc0B0ZJtfWFITNB3', avatar: u.avatar || '👦', isSetupComplete: true, isChild: true };
         return u;
       }).filter(u => u && u.id !== 'Markus' && u.id !== 'Sarah' && u.id !== 'Anja' && u.id !== 'Lennart');
       
       // Re-add precisely mapped users to avoid duplicates during migration
       const finalUsers = [
         migrated.find(u => u && u.id === 'Falko') || INITIAL_USERS[0],
         { id: 'Anja', uid: 'zaKMNvN3UFTnFRE2VT8EmioWfGk1', avatar: '👩', isSetupComplete: true },
         { id: 'Lennart', uid: 'kyWmQqGiwuRLXc0B0ZJtfWFITNB3', avatar: '👦', isSetupComplete: true, isChild: true },
       ];
       
       return finalUsers;
    }
    
    return data;
  },
  addUser: (user: User) => {
    const users = mockDb.getUsers();
    if (!users.find((u) => u.id === user.id)) {
      set(DB_KEYS.USERS, [...users, user]);
    }
  },
  updateUser: (updatedUser: User) => {
    const users = mockDb.getUsers();
    set(DB_KEYS.USERS, users.map(u => u.id === updatedUser.id ? updatedUser : u));
  },
  deleteUser: (id: string) => {
    const users = mockDb.getUsers();
    set(DB_KEYS.USERS, users.filter(u => u.id !== id));
  },

  // Budget (Always Shared)
  getBudgetItems: (): BudgetItem[] => get(DB_KEYS.BUDGET, []),
  addBudgetItem: (item: Omit<BudgetItem, 'id' | 'createdAt'>) => {
    const items = mockDb.getBudgetItems();
    const newItem: BudgetItem = {
      ...item,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    set(DB_KEYS.BUDGET, [newItem, ...items]);
  },
  deleteBudgetItem: (id: string) => {
    const items = mockDb.getBudgetItems();
    set(DB_KEYS.BUDGET, items.filter(item => item.id !== id));
  },
  updateBudgetItem: (updatedItem: BudgetItem) => {
    const items = mockDb.getBudgetItems();
    set(DB_KEYS.BUDGET, items.map(i => i.id === updatedItem.id ? updatedItem : i));
  },

  // Notes (Shared & Private)
  getNotes: (): NoteItem[] => get(DB_KEYS.NOTES, []),
  addNote: (note: Omit<NoteItem, 'id' | 'createdAt'>) => {
    const notes = mockDb.getNotes();
    const newNote: NoteItem = {
      ...note,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    set(DB_KEYS.NOTES, [newNote, ...notes]);
  },
  deleteNote: (id: string) => {
    const notes = mockDb.getNotes();
    set(DB_KEYS.NOTES, notes.filter(note => note.id !== id));
  },
  updateNote: (updatedNote: NoteItem) => {
    const notes = mockDb.getNotes();
    set(DB_KEYS.NOTES, notes.map(n => n.id === updatedNote.id ? updatedNote : n));
  },

  // Tasks (Shared & Private)
  getTasks: (): TaskItem[] => {
    const tasks = get<TaskItem[]>(DB_KEYS.TASKS, []);
    const now = Date.now();
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    let changed = false;

    // Filter and Migrate
    const processed = tasks.filter(t => {
      // Auto-delete after 5 days
      if (t.isDone && t.completedAt && (now - t.completedAt) > fiveDaysMs) {
        changed = true;
        return false;
      }
      return true;
    }).map(t => {
      let updated = { ...t };
      let itemChanged = false;

      // Migration: single string assignedTo -> array
      if (t.assignedTo && typeof t.assignedTo === 'string') {
        updated.assignedTo = [t.assignedTo as any];
        itemChanged = true;
      }

      // Migration: Add completedAt to legacy done tasks
      if (t.isDone && !t.completedAt) {
        updated.completedAt = t.createdAt; // fallback to creation time
        itemChanged = true;
      }

      if (itemChanged) changed = true;
      return updated;
    });

    if (changed) {
      set(DB_KEYS.TASKS, processed);
    }
    return processed;
  },
  addTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'isDone'>) => {
    const tasks = mockDb.getTasks();
    const newTask: TaskItem = {
      ...task,
      id: uuidv4(),
      createdAt: Date.now(),
      isDone: false,
    };
    set(DB_KEYS.TASKS, [newTask, ...tasks]);
  },
  toggleTask: (id: string, starPoints?: number) => {
    const tasks = mockDb.getTasks();
    const users = mockDb.getUsers();
    let taskToUpdate: TaskItem | undefined;

    const updated = tasks.map(t => {
      if (t.id === id) {
        const newIsDone = !t.isDone;
        taskToUpdate = { 
          ...t, 
          isDone: newIsDone,
          completedAt: newIsDone ? Date.now() : undefined 
        };
        return taskToUpdate;
      }
      return t;
    });

    if (taskToUpdate) {
      set(DB_KEYS.TASKS, updated);

      // Handle Stars
      if (taskToUpdate.isDone && starPoints !== undefined) {
        const eligibleChildren = users.filter(u => 
          u.isChild && (taskToUpdate!.assignedTo?.includes(u.id) || (taskToUpdate!.isShared && (!taskToUpdate!.assignedTo || taskToUpdate!.assignedTo.length === 0)))
        );

        eligibleChildren.forEach(child => {
          mockDb.addRewardRequest({
            id: `task-stars-${taskToUpdate!.id}-${child.id}`,
            childId: child.id,
            stars: -starPoints,
            status: 'APPROVED',
            taskId: taskToUpdate!.id,
            description: `Erledigt: ${taskToUpdate!.content}`
          });
        });
      } else if (!taskToUpdate.isDone) {
        // Remove stars if task is un-completed
        const rewards = mockDb.getRewardRequests();
        const filtered = rewards.filter(r => r.taskId !== id);
        if (filtered.length !== rewards.length) {
          set(DB_KEYS.REWARDS, filtered);
        }
      }
    }
  },
  updateTask: (updatedTask: TaskItem) => {
    const tasks = mockDb.getTasks();
    set(DB_KEYS.TASKS, tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
  },
  deleteTask: (id: string) => {
    const tasks = mockDb.getTasks();
    set(DB_KEYS.TASKS, tasks.filter(task => task.id !== id));
  },

  // Meals
  getMealTemplates: (): MealTemplate[] => get(DB_KEYS.MEAL_TEMPLATES, [
    { id: '1', title: 'Pizza', emoji: '🍕', createdBy: 'Falko' },
    { id: '2', title: 'Nudeln', emoji: '🍝', createdBy: 'Falko' },
    { id: '3', title: 'Pfannkuchen', emoji: '🥞', createdBy: 'Falko' },
  ]),
  addMealTemplate: (template: Omit<MealTemplate, 'id'>) => {
    const templates = mockDb.getMealTemplates();
    set(DB_KEYS.MEAL_TEMPLATES, [...templates, { ...template, id: uuidv4() }]);
  },
  deleteMealTemplate: (id: string) => {
    set(DB_KEYS.MEAL_TEMPLATES, mockDb.getMealTemplates().filter(t => t.id !== id));
  },
  updateMealTemplate: (updatedTemplate: MealTemplate) => {
    const templates = mockDb.getMealTemplates();
    set(DB_KEYS.MEAL_TEMPLATES, templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
  },

  getMealPlanItems: (): MealPlanItem[] => get(DB_KEYS.MEAL_PLAN, []),
  addMealPlanItem: (item: Omit<MealPlanItem, 'id' | 'createdAt'>) => {
    const items = mockDb.getMealPlanItems();
    set(DB_KEYS.MEAL_PLAN, [...items, { ...item, id: uuidv4(), createdAt: Date.now() }]);
  },
  updateMealPlanItem: (updatedItem: MealPlanItem) => {
    const items = mockDb.getMealPlanItems();
    set(DB_KEYS.MEAL_PLAN, items.map(i => i.id === updatedItem.id ? updatedItem : i));
  },
  deleteMealPlanItem: (id: string) => {
    set(DB_KEYS.MEAL_PLAN, mockDb.getMealPlanItems().filter(i => i.id !== id));
  },

  // Rewards
  getRewardRequests: (): RewardRequest[] => {
    const reqs = get<RewardRequest[]>(DB_KEYS.REWARDS, []);
    // Temporärer Bonus für Lennart (100 Punkte geschenkt)
    if (!reqs.some((r: RewardRequest) => r.id === 'bonus-lennart')) {
      const withBonus: RewardRequest[] = [...reqs, { id: 'bonus-lennart', childId: 'Lennart', stars: -100, status: 'APPROVED', createdAt: 0 } as RewardRequest];
      // Note: we can't use our `set` wrapper here during read, it would cause infinite loop.
      // We just return it. The initial sync will push it up if cloud is empty anyway.
      return withBonus;
    }
    return reqs;
  },
  addRewardRequest: (req: Omit<RewardRequest, 'id' | 'createdAt'> & { id?: string }) => {
    const rewards = mockDb.getRewardRequests();
    // Don't add duplicate IDs (important for task-stars migration)
    if (req.id && rewards.some(r => r.id === req.id)) return;
    
    set(DB_KEYS.REWARDS, [...rewards, { 
      id: req.id || uuidv4(), 
      ...req, 
      createdAt: Date.now() 
    } as RewardRequest]);
  },
  updateRewardRequest: (updatedReq: RewardRequest) => {
    const rewards = mockDb.getRewardRequests();
    set(DB_KEYS.REWARDS, rewards.map(r => r.id === updatedReq.id ? updatedReq : r));
  },

  // Videos
  getUnlockedVideos: (): string[] => get(DB_KEYS.UNLOCKED_VIDEOS, []),
  unlockVideo: (videoId: string) => {
    const current = mockDb.getUnlockedVideos();
    if (!current.includes(videoId)) {
      set(DB_KEYS.UNLOCKED_VIDEOS, [...current, videoId]);
    }
  },
  getCustomVideos: (): any[] => get('family_hub_custom_videos', []),
  setCustomVideos: (videos: any[]) => set('family_hub_custom_videos', videos),

  // Leaderboard
  getLeaderboard: (): ScoreEntry[] => get(DB_KEYS.LEADERBOARD, []),
  updateHighScore: (entry: ScoreEntry, lowerIsBetter: boolean = false) => {
    const board = mockDb.getLeaderboard();
    const existing = board.find(e => e.gameId === entry.gameId && e.childId === entry.childId);
    if (!existing) {
      set(DB_KEYS.LEADERBOARD, [...board, entry]);
    } else {
      const isNewHigh = lowerIsBetter ? entry.score < existing.score : entry.score > existing.score;
      if (isNewHigh) {
        set(DB_KEYS.LEADERBOARD, board.map(e => e.gameId === entry.gameId && e.childId === entry.childId ? entry : e));
      }
    }
  },

  // Expenses
  getExpenses: (): ExpenseItem[] => get(DB_KEYS.EXPENSES, []),
  addExpense: (expense: Omit<ExpenseItem, 'id' | 'createdAt'>) => {
    const expenses = mockDb.getExpenses();
    const newExpense: ExpenseItem = {
      ...expense,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    set(DB_KEYS.EXPENSES, [...expenses, newExpense]);
  },
  deleteExpense: (id: string) => {
    const expenses = mockDb.getExpenses();
    set(DB_KEYS.EXPENSES, expenses.filter(e => e.id !== id));
  },
  getExpenseBudgets: (): ExpenseBudget[] => get(DB_KEYS.EXPENSE_BUDGETS, []),
  setExpenseBudget: (budget: ExpenseBudget) => {
    const budgets = mockDb.getExpenseBudgets();
    const existingIndex = budgets.findIndex(b => b.month === budget.month);
    if (existingIndex > -1) {
      budgets[existingIndex] = budget;
      set(DB_KEYS.EXPENSE_BUDGETS, [...budgets]);
    } else {
      set(DB_KEYS.EXPENSE_BUDGETS, [...budgets, budget]);
    }
  },

  // Depots
  getDepots: (): Depot[] => {
    const data = get<Depot[]>(DB_KEYS.DEPOTS, INITIAL_DEPOTS) || [];
    // Safety filtering: only return valid depot objects to prevent rendering crashes
    return data.filter(d => d && typeof d === 'object' && d.name);
  },
  addDepot: (depot: Omit<Depot, 'id' | 'createdAt'>) => {
    const depots = mockDb.getDepots();
    const newDepot: Depot = {
      ...depot,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    set(DB_KEYS.DEPOTS, [...depots, newDepot]);
  },
  deleteDepot: (id: string) => {
    const depots = mockDb.getDepots();
    set(DB_KEYS.DEPOTS, depots.filter(d => d.id !== id));
    // Also cleanup transactions
    const transactions = mockDb.getDepotTransactions();
    set(DB_KEYS.DEPOT_TRANSACTIONS, transactions.filter(t => t.depotId !== id));
  },
  updateDepot: (updatedDepot: Depot) => {
    const depots = mockDb.getDepots();
    set(DB_KEYS.DEPOTS, depots.map(d => d.id === updatedDepot.id ? updatedDepot : d));
  },
  getDepotTransactions: (depotId?: string): DepotTransaction[] => {
    const txs = get<DepotTransaction[]>(DB_KEYS.DEPOT_TRANSACTIONS, []);
    // Migration: ensure all transactions with "Sparrate" in note are treated as automated/routine
    const migratedTxs = txs.map(tx => {
      if (!tx.isAutomated && tx.note?.includes('Sparrate')) {
        return { ...tx, isAutomated: true };
      }
      return tx;
    });
    return depotId ? migratedTxs.filter(t => t.depotId === depotId) : migratedTxs;
  },
  addDepotTransaction: (tx: Omit<DepotTransaction, 'id' | 'createdAt'>) => {
    const txs = get<DepotTransaction[]>(DB_KEYS.DEPOT_TRANSACTIONS, []);
    const newTx: DepotTransaction = {
      ...tx,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    set(DB_KEYS.DEPOT_TRANSACTIONS, [newTx, ...txs]);
  },
  deleteDepotTransaction: (id: string) => {
    const txs = get<DepotTransaction[]>(DB_KEYS.DEPOT_TRANSACTIONS, []);
    set(DB_KEYS.DEPOT_TRANSACTIONS, txs.filter(t => t.id !== id));
  },
  getN26Settings: (): N26Settings => {
    const defaults: N26Settings = { autoBookingEnabled: false, bookingDay: 1, closedYears: [] };
    return get<N26Settings>(DB_KEYS.N26_SETTINGS, defaults) || defaults;
  },
  saveN26Settings: (settings: N26Settings) => {
    set(DB_KEYS.N26_SETTINGS, settings);
  },
  executeMonthlyBookings: (date: string, isAutomated: boolean = false) => {
    const depots = mockDb.getDepots();
    const txs = get<DepotTransaction[]>(DB_KEYS.DEPOT_TRANSACTIONS, []);
    
    const newTxs: DepotTransaction[] = depots.map(depot => ({
      id: uuidv4(),
      depotId: depot.id,
      amount: depot.monthlyAmount || 0,
      date,
      note: isAutomated ? 'Monatliche Sparrate (Auto)' : 'Monatliche Sparrate (Manuell)',
      createdAt: Date.now(),
      isAutomated: true
    })).filter(t => t.amount !== 0);

    set(DB_KEYS.DEPOT_TRANSACTIONS, [...newTxs, ...txs]);
    
    if (isAutomated) {
      const settings = mockDb.getN26Settings();
      mockDb.saveN26Settings({
        ...settings,
        lastAutoBookingMonth: date.substring(0, 7) // YYYY-MM
      });
    }
  },
  closeYear: (year: number) => {
    const settings = mockDb.getN26Settings();
    const closedYears = settings.closedYears || [];
    if (!closedYears.includes(year)) {
      mockDb.saveN26Settings({
        ...settings,
        closedYears: [...closedYears, year].sort((a, b) => b - a)
      });
    }
  },
  importFinancialData: (data: any) => {
    if (data[DB_KEYS.DEPOTS]) set(DB_KEYS.DEPOTS, data[DB_KEYS.DEPOTS]);
    if (data[DB_KEYS.DEPOT_TRANSACTIONS]) set(DB_KEYS.DEPOT_TRANSACTIONS, data[DB_KEYS.DEPOT_TRANSACTIONS]);
    if (data[DB_KEYS.N26_SETTINGS]) set(DB_KEYS.N26_SETTINGS, data[DB_KEYS.N26_SETTINGS]);
    if (data[DB_KEYS.BUDGET]) set(DB_KEYS.BUDGET, data[DB_KEYS.BUDGET]);
    if (data[DB_KEYS.EXPENSE_BUDGETS]) set(DB_KEYS.EXPENSE_BUDGETS, data[DB_KEYS.EXPENSE_BUDGETS]);
    if (data[DB_KEYS.EXPENSES]) set(DB_KEYS.EXPENSES, data[DB_KEYS.EXPENSES]);
    if (data[DB_KEYS.APP_SETTINGS]) set(DB_KEYS.APP_SETTINGS, data[DB_KEYS.APP_SETTINGS]);
  },
  getAppSettings: (): any => {
    return get(DB_KEYS.APP_SETTINGS, null);
  },
  saveAppSettings: (settings: any) => {
    set(DB_KEYS.APP_SETTINGS, settings);
  },
  getVictronSettings: (): any => {
    return get(DB_KEYS.VICTRON_SETTINGS, { vrmId: '', instance: '290', portalId: '' });
  },
  saveVictronSettings: (settings: any) => {
    set(DB_KEYS.VICTRON_SETTINGS, settings);
  }
};
