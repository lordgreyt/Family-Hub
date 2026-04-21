import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { NotificationManager } from '../NotificationManager';

export const MainLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!user && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname === '/login') {
    return <Outlet />;
  }

  // Children cannot access the budget page
  if (user?.isChild && location.pathname === '/budget') {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <TopBar onMenuClick={() => setIsSidebarOpen(true)} />
      <main className="app-content">
        <Outlet />
      </main>
      <NotificationManager />
    </>
  );
};
