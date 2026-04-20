import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeColor = 'indigo' | 'rose' | 'emerald' | 'amber' | 'cyan' | 'violet' | 'slate' | 'teal' | 'pink';
type FontSize = 'small' | 'base' | 'large';

interface AppSettings {
  themeColor: ThemeColor;
  fontSize: FontSize;
}

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  themeColor: 'indigo',
  fontSize: 'base',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('family_hub_settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('family_hub_settings', JSON.stringify(settings));
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
