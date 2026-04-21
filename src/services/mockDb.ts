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
  assignedTo?: string;
  createdAt: number;
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
  stars: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: number;
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

// Initial Data
const INITIAL_USERS: User[] = [
  { id: 'Falko', uid: 'thOJVf4L9cd2BysM2bFOeuC14yV2', avatar: '👨', isAdmin: true, isSetupComplete: true },
  { id: 'Anja', uid: 'zaKMNvN3UFTnFRE2VT8EmioWfGk1', avatar: '👩', isSetupComplete: true },
  { id: 'Lennart', uid: 'kyWmQqGiwuRLXc0B0ZJtfWFITNB3', avatar: '👦', isSetupComplete: true, isChild: true },
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
  firebaseSet(ref(db, key), data).catch(e => console.error("Firebase write error:", e));
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
        [DB_KEYS.EXPENSE_BUDGETS]: get(DB_KEYS.EXPENSE_BUDGETS, [])
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
  getTasks: (): TaskItem[] => get(DB_KEYS.TASKS, []),
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
  toggleTask: (id: string) => {
    const tasks = mockDb.getTasks();
    const updated = tasks.map(t => t.id === id ? { ...t, isDone: !t.isDone } : t);
    set(DB_KEYS.TASKS, updated);
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
    set(DB_KEYS.REWARDS, [...rewards, { id: uuidv4(), ...req, createdAt: Date.now() }]);
  },
  updateRewardRequest: (updatedReq: RewardRequest) => {
    const rewards = mockDb.getRewardRequests();
    set(DB_KEYS.REWARDS, rewards.map(r => r.id === updatedReq.id ? updatedReq : r));
  },

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
};
