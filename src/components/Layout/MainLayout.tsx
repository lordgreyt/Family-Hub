import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { NotificationManager } from '../NotificationManager';

export const MainLayout = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname === '/login') {
    return <Outlet />;
  }

  return (
    <>
      <TopBar />
      <main className="app-content">
        <Outlet />
      </main>
      <BottomNav />
      <NotificationManager />
    </>
  );
};
