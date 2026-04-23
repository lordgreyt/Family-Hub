import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockDb } from '../services/mockDb';

type ThemeColor = 'indigo' | 'rose' | 'emerald' | 'amber' | 'cyan' | 'violet' | 'slate' | 'teal' | 'pink';
type FontSize = 'small' | 'base' | 'large';

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
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = mockDb.getAppSettings();
    return saved ? { ...defaultSettings, ...saved } : defaultSettings;
  });

  useEffect(() => {
    const handleDbUpdate = () => {
      const remoteSettings = mockDb.getAppSettings();
      if (remoteSettings) {
        setSettings(prev => {
          // Only update if actually different to prevent loops
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

  useEffect(() => {
    mockDb.saveAppSettings(settings);
    // Apply the settings to the DOM
    document.documentElement.setAttribute('data-theme', settings.themeColor);
    document.documentElement.setAttribute('data-font-size', settings.fontSize);
  }, [settings]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
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
