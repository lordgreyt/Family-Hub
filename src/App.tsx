import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';

import { MainLayout } from './components/Layout/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Budget } from './pages/Budget';
import { Notes } from './pages/Notes';
import { Tasks } from './pages/Tasks';
import { Meals } from './pages/Meals';
import { Rewards } from './pages/Rewards';
import { Setup } from './pages/Setup';

import React, { useEffect } from 'react';
import { initFirebase } from './services/mockDb';

import './index.css';

function App() {
  useEffect(() => {
    initFirebase();
  }, []);

  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/budget" element={<Budget />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/meals" element={<Meals />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/setup" element={<Setup />} />
            </Route>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
