import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { mockDb } from '../services/mockDb';
import { useAuth } from './AuthContext';

interface VictronState {
  power: number;
  current: number;
  maxCurrent: number;
  energySession: number;
  state: number;
  mode: number;
  isConnected: boolean;
  batterySoc: number | null;
  batteryPower: number | null;
  automations: {
    timerActive: boolean;
    timerEndTime: number | null;
    timerDuration: number;
    nightDrainActive: boolean;
    nightDrainThreshold: number;
    nightDrainTime: string;
  };
}

interface VictronContextType {
  state: VictronState;
  error: string | null;
  lastTopic: string;
  handleToggleMode: (forceMode?: number) => void;
  handleToggleCharge: (forceState?: number) => void;
  handleMaxCurrentChange: (val: number) => void;
  updateAutomations: (newAuto: any) => void;
}

const VictronContext = createContext<VictronContextType | undefined>(undefined);

export const VictronProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [vrmSettings, setVrmSettings] = useState(mockDb.getVictronSettings());
  const [error, setError] = useState<string | null>(null);
  const [lastTopic, setLastTopic] = useState<string>('');
  
  // Load initial state from localStorage if available
  const savedState = localStorage.getItem('victron_cache');
  const initialState = savedState ? JSON.parse(savedState) : {
    power: 0,
    current: 0,
    maxCurrent: 16,
    energySession: 0,
    state: 0,
    mode: 0,
    isConnected: false,
    batterySoc: null,
    batteryPower: null,
    automations: vrmSettings.automations || {
      timerActive: false,
      timerEndTime: null,
      timerDuration: 2,
      nightDrainActive: false,
      nightDrainThreshold: 40,
      nightDrainTime: '03:00'
    }
  };

  const [state, setState] = useState<VictronState>(initialState);

  // Cache state changes
  useEffect(() => {
    localStorage.setItem('victron_cache', JSON.stringify(state));
  }, [state]);

  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const calculateBrokerUrl = (vrmId: string) => {
    if (!vrmId) return 'wss://mqtt.victronenergy.com:443/mqtt';
    let sum = 0;
    for (let i = 0; i < vrmId.length; i++) {
      sum += vrmId.charCodeAt(i);
    }
    const index = sum % 128;
    return `wss://webmqtt${index}.victronenergy.com:443/mqtt`;
  };

  // MQTT Connection Logic
  useEffect(() => {
    if (user?.isChild || !vrmSettings.vrmId || !vrmSettings.username || !vrmSettings.password) {
      if (clientRef.current) clientRef.current.end();
      setState(prev => ({ ...prev, isConnected: false }));
      return;
    }

    const brokerUrl = calculateBrokerUrl(vrmSettings.vrmId);
    const options = {
      username: vrmSettings.username,
      password: vrmSettings.password,
      clientId: 'family_hub_bg_' + Math.random().toString(16).slice(2, 10),
      keepalive: 60,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      clean: true
    };

    const client = mqtt.connect(brokerUrl, options);
    clientRef.current = client;

    client.on('connect', () => {
      setState(prev => ({ ...prev, isConnected: true }));
      setError(null);
      const vrmId = vrmSettings.vrmId;
      const topics = [
        `N/${vrmId}/evcharger/+/Ac/Power`,
        `N/${vrmId}/evcharger/+/Ac/L1/Current`,
        `N/${vrmId}/evcharger/+/Ac/Energy/Forward`,
        `N/${vrmId}/evcharger/+/Status`,
        `N/${vrmId}/evcharger/+/Mode`,
        `N/${vrmId}/evcharger/+/MaxCurrent`,
        `N/${vrmId}/evcharger/+/SetCurrent`,
        `N/${vrmId}/battery/+/Soc`,
        `N/${vrmId}/battery/+/Dc/0/Power`,
        `N/${vrmId}/system/0/Dc/Battery/Soc`,
        `N/${vrmId}/system/0/Dc/Battery/Power`
      ];
      client.subscribe(topics);
      
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (client.connected) {
          client.publish(`R/${vrmId}/system/0/Serial`, '');
        }
      }, 30000);
    });

    client.on('message', (topic, message) => {
      setLastTopic(topic);
      try {
        const payload = JSON.parse(message.toString());
        const value = payload.value;
        
        if (topic.includes('/evcharger/') && topic.endsWith('/Ac/Power')) setState(prev => ({ ...prev, power: value }));
        if (topic.includes('/evcharger/') && topic.endsWith('/Ac/L1/Current')) setState(prev => ({ ...prev, current: value }));
        if (topic.includes('/evcharger/') && topic.endsWith('/Ac/Energy/Forward')) setState(prev => ({ ...prev, energySession: value }));
        if (topic.includes('/evcharger/') && topic.endsWith('/Status')) setState(prev => ({ ...prev, state: value }));
        if (topic.includes('/evcharger/') && topic.endsWith('/Mode')) setState(prev => ({ ...prev, mode: value }));
        if (topic.includes('/evcharger/') && (topic.endsWith('/SetCurrent') || topic.endsWith('/MaxCurrent'))) setState(prev => ({ ...prev, maxCurrent: value }));
        if (topic.endsWith('/Soc')) setState(prev => ({ ...prev, batterySoc: value }));
        if (topic.endsWith('/Power') && (topic.includes('/battery/') || topic.includes('/Dc/Battery/'))) {
          setState(prev => ({ ...prev, batteryPower: value }));
        }
      } catch (e) {}
    });

    client.on('error', (err) => {
      setError(err.message || 'Verbindungsfehler');
      setState(prev => ({ ...prev, isConnected: false }));
    });

    client.on('close', () => setState(prev => ({ ...prev, isConnected: false })));

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      client.end();
    };
  }, [vrmSettings.vrmId, vrmSettings.username, vrmSettings.password, user?.id]);

  // Automation Loop
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const nowTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      
      if (state.automations.timerActive && state.automations.timerEndTime) {
        if (now.getTime() > state.automations.timerEndTime) {
          handleToggleCharge(0);
          updateAutomations({ ...state.automations, timerActive: false, timerEndTime: null });
        }
      }

      if (state.automations.nightDrainActive && nowTime === state.automations.nightDrainTime) {
        if (state.batterySoc !== null && state.batterySoc > state.automations.nightDrainThreshold && state.state !== 2) {
          handleToggleMode(0);
          setTimeout(() => handleToggleCharge(1), 5000);
        }
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [state.automations, state.batterySoc, state.state]);

  const handleToggleMode = (forceMode?: number) => {
    if (!clientRef.current || !state.isConnected) return;
    const nextMode = forceMode !== undefined ? forceMode : (state.mode + 1) % 3;
    clientRef.current.publish(`W/${vrmSettings.vrmId}/evcharger/${vrmSettings.instance || '40'}/Mode`, JSON.stringify({ value: nextMode }));
  };

  const handleToggleCharge = (forceState?: number) => {
    if (!clientRef.current || !state.isConnected) return;
    const nextStart = forceState !== undefined ? forceState : (state.state === 2 ? 0 : 1);
    clientRef.current.publish(`W/${vrmSettings.vrmId}/evcharger/${vrmSettings.instance || '40'}/StartStop`, JSON.stringify({ value: nextStart }));
  };

  const handleMaxCurrentChange = (val: number) => {
    if (!clientRef.current || !state.isConnected) return;
    clientRef.current.publish(`W/${vrmSettings.vrmId}/evcharger/${vrmSettings.instance || '40'}/SetCurrent`, JSON.stringify({ value: val }));
    setState(prev => ({ ...prev, maxCurrent: val }));
  };

  const updateAutomations = (newAuto: any) => {
    setState(prev => ({ ...prev, automations: newAuto }));
    mockDb.saveVictronSettings({ ...vrmSettings, automations: newAuto });
  };

  return (
    <VictronContext.Provider value={{ state, error, lastTopic, handleToggleMode, handleToggleCharge, handleMaxCurrentChange, updateAutomations }}>
      {children}
    </VictronContext.Provider>
  );
};

export const useVictron = () => {
  const context = useContext(VictronContext);
  if (!context) throw new Error('useVictron must be used within a VictronProvider');
  return context;
};
