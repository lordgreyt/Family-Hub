import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockDb } from '../services/mockDb';
import type { ThemeColor, FontSize, DesignMode } from '../services/mockDb';
import { useAuth } from './AuthContext';

interface AppSettings {
  themeColor: ThemeColor;
  fontSize: FontSize;
  designMode: DesignMode;
  prioPoints: Record<number, number>;
}

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  themeColor: 'indigo',
  fontSize: 'base',
  designMode: 'classic',
  prioPoints: { 1: 5, 2: 10, 3: 15 },
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

  const [localUserConfig, setLocalUserConfig] = useState<{themeColor?: ThemeColor, fontSize?: FontSize, designMode?: DesignMode}>({});

  useEffect(() => {
    if (user) {
      const savedTheme = localStorage.getItem(`local_theme_${user.id}`) as ThemeColor;
      const savedFont = localStorage.getItem(`local_font_${user.id}`) as FontSize;
      const savedDesign = localStorage.getItem(`local_design_${user.id}`) as DesignMode;
      setLocalUserConfig({
        themeColor: savedTheme || undefined,
        fontSize: savedFont || undefined,
        designMode: savedDesign || undefined,
      });
    } else {
      setLocalUserConfig({});
    }
  }, [user]);

  // Determine active display settings
  const activeTheme = localUserConfig.themeColor || user?.themeColor || settings.themeColor;
  const activeFontSize = localUserConfig.fontSize || user?.fontSize || settings.fontSize;
  const activeDesignMode = localUserConfig.designMode || settings.designMode;

  useEffect(() => {
    mockDb.saveAppSettings(settings);
  }, [settings]);

  useEffect(() => {
    // Apply the active settings to the DOM
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.documentElement.setAttribute('data-font-size', activeFontSize);
    document.documentElement.setAttribute('data-design', activeDesignMode);
  }, [activeTheme, activeFontSize, activeDesignMode]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    // If we are updating theme, font size, or design mode AND a user is logged in,
    // we save it LOCALLY to the device, not to Firebase, to prevent sync overrides.
    if (user && (newSettings.themeColor || newSettings.fontSize || newSettings.designMode)) {
      setLocalUserConfig(prev => {
        const next = { ...prev };
        if (newSettings.themeColor) {
          localStorage.setItem(`local_theme_${user.id}`, newSettings.themeColor);
          next.themeColor = newSettings.themeColor;
        }
        if (newSettings.fontSize) {
          localStorage.setItem(`local_font_${user.id}`, newSettings.fontSize);
          next.fontSize = newSettings.fontSize;
        }
        if (newSettings.designMode) {
          localStorage.setItem(`local_design_${user.id}`, newSettings.designMode);
          next.designMode = newSettings.designMode;
        }
        return next;
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
        fontSize: activeFontSize,
        designMode: activeDesignMode,
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
