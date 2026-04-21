import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { NotificationManager } from '../NotificationManager';

export const MainLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const redirectionPerformed = useRef(false);

  useEffect(() => {
    if (!loading && user?.defaultPath && location.pathname === '/' && !redirectionPerformed.current) {
      redirectionPerformed.current = true;
      if (user.defaultPath !== '/') {
        navigate(user.defaultPath, { replace: true });
      }
    }
  }, [user, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p>Lädt...</p>
      </div>
    );
  }

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
