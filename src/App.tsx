import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';

import { MainLayout } from './components/Layout/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Budget } from './pages/Budget';
import { Tasks } from './pages/Tasks';
import { Rewards } from './pages/Rewards';
import { Setup } from './pages/Setup';
import { Expenses } from './pages/Expenses';
import { N26 } from './pages/N26';
import { PackingList } from './pages/PackingList';
import { HolidayBudget } from './pages/HolidayBudget';
import { SmartHome } from './pages/SmartHome';
import { SurgeryFinance } from './pages/SurgeryFinance';
import { Grades } from './pages/Grades';
import { Vocabulary } from './pages/Vocabulary';
import { VictronProvider } from './context/VictronContext';
import { initBackupService } from './services/backupService';



import './index.css';
import './styles/gradient.css';

function App() {

  useEffect(() => {
    const cleanupBackup = initBackupService();
    return () => { cleanupBackup(); };
  }, []);

  return (
    <AuthProvider>
      <SettingsProvider>
        <VictronProvider>
          <BrowserRouter>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/budget" element={<Budget />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/n26" element={<N26 />} />
              <Route path="/smart-home" element={<SmartHome />} />
              <Route path="/grades" element={<Grades />} />
              <Route path="/vokabeln" element={<Vocabulary />} />
              <Route path="/packliste" element={<PackingList />} />
              <Route path="/urlaubsbudget" element={<HolidayBudget />} />
              <Route path="/op-finanzen" element={<SurgeryFinance />} />
            </Route>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </VictronProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
