import React, { createContext, useContext, useState } from 'react';
import type { User } from '../services/mockDb';

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('family_hub_auth');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (u: User) => {
    setUser(u);
    localStorage.setItem('family_hub_auth', JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('family_hub_auth');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
