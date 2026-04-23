import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockDb, ThemeColor, FontSize } from '../services/mockDb';
import { useAuth } from './AuthContext';

interface AppSettings {
  themeColor: ThemeColor;
  fontSize: FontSize;
  prioPoints: Record<number, number>;
  videoCostPerMinute: number;
  youtubeApiKey?: string;
}

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  themeColor: 'indigo',
  fontSize: 'base',
  prioPoints: { 1: 5, 2: 10, 3: 15 },
  videoCostPerMinute: 2,
  youtubeApiKey: '',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = mockDb.getAppSettings();
    return saved ? { ...defaultSettings, ...saved } : defaultSettings;
  });

  useEffect(() => {
    const handleDbUpdate = () => {
      const remoteSettings = mockDb.getAppSettings();
      if (remoteSettings) {
        setSettings(prev => {
          if (JSON.stringify(prev) !== JSON.stringify({ ...defaultSettings, ...remoteSettings })) {
            return { ...defaultSettings, ...remoteSettings };
          }
          return prev;
        });
      }
    };

    window.addEventListener('db_updated', handleDbUpdate);
    return () => window.removeEventListener('db_updated', handleDbUpdate);
  }, []);

  // Determine active display settings
  const activeTheme = user?.themeColor || settings.themeColor;
  const activeFontSize = user?.fontSize || settings.fontSize;

  useEffect(() => {
    mockDb.saveAppSettings(settings);
  }, [settings]);

  useEffect(() => {
    // Apply the active settings to the DOM
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.documentElement.setAttribute('data-font-size', activeFontSize);
  }, [activeTheme, activeFontSize]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    // If we are updating theme or font size AND a user is logged in, 
    // we save it to the user profile instead of global settings.
    if (user && (newSettings.themeColor || newSettings.fontSize)) {
      mockDb.updateUser({
        ...user,
        themeColor: newSettings.themeColor || user.themeColor,
        fontSize: newSettings.fontSize || user.fontSize,
      });
    } else {
      setSettings((prev) => ({ ...prev, ...newSettings }));
    }
  };

  return (
    <SettingsContext.Provider value={{ 
      settings: { 
        ...settings, 
        themeColor: activeTheme, 
        fontSize: activeFontSize 
      }, 
      updateSettings 
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
