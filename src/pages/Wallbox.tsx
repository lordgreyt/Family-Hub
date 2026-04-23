import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import mqtt from 'mqtt';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import { 
  Zap, 
  Battery, 
  Activity, 
  Settings, 
  Power, 
  Gauge, 
  RefreshCw, 
  AlertCircle,
  Clock,
  Car
} from 'lucide-react';

interface VictronState {
  power: number; // Watts
  current: number; // Amps
  maxCurrent: number; // Amps limit
  energySession: number; // kWh
  state: number; // 0: disconnected, 1: connected, 2: charging, 3: waiting, 4: error
  mode: number; // 0: manual, 1: auto, 2: scheduled
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

export const Wallbox = () => {
  const { user } = useAuth();
  const [vrmSettings, setVrmSettings] = useState(mockDb.getVictronSettings());
  const [showSettings, setShowSettings] = useState(!vrmSettings.vrmId);
  const [isSyncing, setIsSyncing] = useState(false);
  
  if (user?.isChild) {
    return <Navigate to="/" replace />;
  }
  
  // Mock State (for UI demonstration until MQTT is wired)
  const [state, setState] = useState<VictronState>({
    power: 0,
    current: 0,
    maxCurrent: 16,
    energySession: 0,
    state: 0,
    mode: 0,
    isConnected: false,
    batterySoc: null,
    batteryPower: null,
    automations: {
      timerActive: false,
      timerEndTime: null,
      timerDuration: 2,
      nightDrainActive: false,
      nightDrainThreshold: 40,
      nightDrainTime: '03:00'
    }
  });

  const [error, setError] = useState<string | null>(null);
  const [lastTopic, setLastTopic] = useState<string>('');

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

  useEffect(() => {
    if (!vrmSettings.vrmId || !vrmSettings.username || !vrmSettings.password) {
      setState(prev => ({ ...prev, isConnected: false, state: 0 }));
      return;
    }

    const brokerUrl = calculateBrokerUrl(vrmSettings.vrmId);
    const options = {
      username: vrmSettings.username,
      password: vrmSettings.password,
      clientId: 'family_hub_' + Math.random().toString(16).slice(2, 10),
      keepalive: 60,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      clean: true
    };

    console.log(`Connecting to Victron MQTT at ${brokerUrl}...`);
    setError(null);

    const client = mqtt.connect(brokerUrl, options);
    clientRef.current = client;

    client.on('connect', () => {
      console.log("MQTT Connected!");
      setState(prev => ({ ...prev, isConnected: true }));
      setError(null);
      
      const vrmId = vrmSettings.vrmId;
      
      // Wir abonnieren mit Wildcards für die Instanzen (+), 
      // damit wir nicht raten müssen, ob es 290, 40 oder 225 ist.
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
      
      client.subscribe(topics, (err) => {
        if (err) console.error("Subscription error:", err);
      });
      
      // Keep alive: Request system serial every 30s
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (client.connected) {
          client.publish(`R/${vrmSettings.vrmId}/system/0/Serial`, '');
        }
      }, 30000);
    });

    client.on('message', (topic, message) => {
      setLastTopic(topic);
      try {
        const payload = JSON.parse(message.toString());
        const value = payload.value;
        
        // Wallbox (beliebige Instanz)
        if (topic.includes('/evcharger/') && topic.endsWith('/Ac/Power')) setState(prev => ({ ...prev, power: value }));
        if (topic.includes('/evcharger/') && topic.endsWith('/Ac/L1/Current')) setState(prev => ({ ...prev, current: value }));
        if (topic.includes('/evcharger/') && topic.endsWith('/Ac/Energy/Forward')) setState(prev => ({ ...prev, energySession: value }));
        if (topic.includes('/evcharger/') && topic.endsWith('/Status')) setState(prev => ({ ...prev, state: value }));
        if (topic.includes('/evcharger/') && topic.endsWith('/Mode')) setState(prev => ({ ...prev, mode: value }));
        if (topic.includes('/evcharger/') && (topic.endsWith('/SetCurrent') || topic.endsWith('/MaxCurrent'))) setState(prev => ({ ...prev, maxCurrent: value }));
        
        // Battery (beliebige Instanz oder System-SoC)
        if (topic.endsWith('/Soc')) setState(prev => ({ ...prev, batterySoc: value }));
        if (topic.endsWith('/Power') && (topic.includes('/battery/') || topic.includes('/Dc/Battery/'))) {
          setState(prev => ({ ...prev, batteryPower: value }));
        }
        
      } catch (e) {
        console.error("MQTT Parse Error:", e);
      }
    });

    client.on('error', (err) => {
      console.error("MQTT Error:", err);
      setError(err.message || 'Verbindungsfehler');
      setState(prev => ({ ...prev, isConnected: false, state: 4 }));
    });

    client.on('close', () => {
      setState(prev => ({ ...prev, isConnected: false }));
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (client) client.end();
    };
  }, [vrmSettings.vrmId, vrmSettings.username, vrmSettings.password, vrmSettings.instance]);

  // Automation Logic Loop (Every 10 seconds)
  useEffect(() => {
    const automationInterval = setInterval(() => {
      const now = new Date();
      const nowTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      
      let updated = false;
      const newAuto = { ...state.automations };

      // 1. Timer Logic
      if (newAuto.timerActive && newAuto.timerEndTime) {
        if (now.getTime() > newAuto.timerEndTime) {
          console.log("Timer expired. Stopping charge...");
          handleToggleCharge(0); // Stop
          newAuto.timerActive = false;
          newAuto.timerEndTime = null;
          updated = true;
        }
      }

      // 2. Night Drain Logic
      if (newAuto.nightDrainActive && nowTime === newAuto.nightDrainTime) {
        if (state.batterySoc !== null && state.batterySoc > newAuto.nightDrainThreshold && state.state !== 2) {
          console.log("Night Drain triggered! Battery SoC:", state.batterySoc);
          handleToggleMode(0); // Force Manual
          setTimeout(() => handleToggleCharge(1), 5000); // Start charging after mode change
        }
      }
      
      // 3. Night Drain Stop (if SoC falls below threshold or near empty)
      if (newAuto.nightDrainActive && state.state === 2 && state.batterySoc !== null && state.batterySoc < 5) {
         console.log("Battery empty. Stopping night drain...");
         handleToggleCharge(0);
      }

      if (updated) {
        setState(prev => ({ ...prev, automations: newAuto }));
      }
    }, 10000);

    return () => clearInterval(automationInterval);
  }, [state.automations, state.batterySoc, state.state]);

  const handleToggleMode = (forceMode?: number) => {
    if (!clientRef.current || !state.isConnected) return;
    const nextMode = forceMode !== undefined ? forceMode : (state.mode + 1) % 3;
    const topic = `W/${vrmSettings.vrmId}/evcharger/${vrmSettings.instance || '290'}/Mode`;
    clientRef.current.publish(topic, JSON.stringify({ value: nextMode }));
  };

  const handleToggleCharge = (forceState?: number) => {
    if (!clientRef.current || !state.isConnected) return;
    const nextStart = forceState !== undefined ? forceState : (state.state === 2 ? 0 : 1);
    const topic = `W/${vrmSettings.vrmId}/evcharger/${vrmSettings.instance || '290'}/StartStop`;
    clientRef.current.publish(topic, JSON.stringify({ value: nextStart }));
  };

  const handleMaxCurrentChange = (val: number) => {
    if (!clientRef.current || !state.isConnected) return;
    const topic = `W/${vrmSettings.vrmId}/evcharger/${vrmSettings.instance || '290'}/SetCurrent`;
    clientRef.current.publish(topic, JSON.stringify({ value: val }));
    // Optimistic update
    setState(prev => ({ ...prev, maxCurrent: val }));
  };

  const getStatusText = () => {
    switch(state.state) {
      case 0: return { text: 'Nicht verbunden', color: 'var(--color-text-muted)', icon: <AlertCircle size={14} /> };
      case 1: return { text: 'Bereit', color: 'var(--color-success)', icon: <CheckCircle /> };
      case 2: return { text: 'Wird geladen...', color: 'var(--color-primary)', icon: <RefreshCw className="spin" size={14} /> };
      case 3: return { text: 'Wartet auf PV', color: 'var(--color-warning)', icon: <Clock size={14} /> };
      case 4: return { text: 'Fehler', color: 'var(--color-danger)', icon: <AlertCircle size={14} /> };
      default: return { text: 'Unbekannt', color: 'var(--color-text-muted)', icon: null };
    }
  };

  const updateAutomations = (newAuto: any) => {
    setState(prev => {
      const updated = { ...prev, automations: newAuto };
      // Auto-save to DB
      mockDb.saveVictronSettings({
        ...vrmSettings,
        automations: newAuto
      });
      return updated;
    });
  };

  return (
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Header / Status Bar */}
      <div className="glass-panel" style={{ 
        padding: '1rem 1.5rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            width: '40px', height: '40px', borderRadius: '12px', 
            backgroundColor: state.isConnected ? 'var(--color-success-light)' : 'var(--color-surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: state.isConnected ? 'var(--color-success)' : 'var(--color-text-muted)'
          }}>
            <Car size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Victron EVCS</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: status.color, fontWeight: 700, textTransform: 'uppercase' }}>
              {status.icon} {status.text}
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          style={{ padding: '0.5rem', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Battery Status Row */}
      {state.batterySoc !== null && (
        <div className="glass-panel" style={{ 
          padding: '0.75rem 1rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ position: 'relative', width: '32px', height: '18px', border: '2px solid var(--color-text-muted)', borderRadius: '4px', padding: '1px' }}>
              <div style={{ 
                height: '100%', 
                width: `${state.batterySoc}%`, 
                backgroundColor: state.batterySoc > 20 ? 'var(--color-success)' : 'var(--color-danger)',
                borderRadius: '1px',
                transition: 'width 0.5s ease'
              }} />
              <div style={{ position: 'absolute', right: '-4px', top: '4px', width: '3px', height: '6px', backgroundColor: 'var(--color-text-muted)', borderRadius: '0 2px 2px 0' }} />
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Hausakku</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800 }}>{state.batterySoc}%</div>
            {state.batteryPower !== null && (
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: state.batteryPower >= 0 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {state.batteryPower >= 0 ? 'Laden: ' : 'Entladen: '}
                {Math.abs(state.batteryPower).toFixed(0)} W
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Power Display */}
      <div className="glass-panel" style={{ 
        padding: '2rem 1.5rem', 
        textAlign: 'center',
        background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.1 }}>
          <Zap size={160} strokeWidth={1} />
        </div>
        
        <div style={{ fontSize: 'var(--font-xs)', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
          Aktuelle Ladeleistung
        </div>
        <div style={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1 }}>
          {(state.power / 1000).toFixed(1)} <span style={{ fontSize: '1.5rem', opacity: 0.7 }}>kW</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{state.current.toFixed(1)} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>A</span></div>
            <div style={{ fontSize: '0.6rem', opacity: 0.7, textTransform: 'uppercase' }}>Stromstärke</div>
          </div>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{state.energySession.toFixed(1)} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>kWh</span></div>
            <div style={{ fontSize: '0.6rem', opacity: 0.7, textTransform: 'uppercase' }}>Diese Sitzung</div>
          </div>
        </div>
      </div>

      {/* Controls Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Toggle Mode */}
        <button 
          onClick={handleToggleMode}
          className="glass-panel" 
          style={{ 
            padding: '1.25rem', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'var(--color-surface)'
          }}
        >
          <div style={{ color: 'var(--color-primary)', opacity: 0.8 }}><Activity size={24} /></div>
          <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Modus</div>
          <div style={{ fontSize: '1rem', fontWeight: 800 }}>
            {state.mode === 0 ? 'Manuell' : state.mode === 1 ? 'Auto' : 'Zeitplan'}
          </div>
        </button>

        {/* Toggle Charge */}
        <button 
          onClick={handleToggleCharge}
          className="glass-panel" 
          style={{ 
            padding: '1.25rem', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: state.state === 2 ? 'var(--color-primary)' : 'var(--color-surface)',
            color: state.state === 2 ? 'white' : 'var(--color-text)'
          }}
        >
          <div style={{ color: state.state === 2 ? 'white' : 'var(--color-primary)', opacity: 0.8 }}><Power size={24} /></div>
          <div style={{ fontSize: '0.6rem', opacity: 0.7, textTransform: 'uppercase', fontWeight: 700 }}>Ladung</div>
          <div style={{ fontSize: '1rem', fontWeight: 800 }}>
            {state.state === 2 ? 'Stoppen' : 'Starten'}
          </div>
        </button>
      </div>

      {/* Amperage Slider */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Gauge size={20} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Max. Ladestrom</span>
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-primary)' }}>{state.maxCurrent} <span style={{ fontSize: '0.8rem' }}>A</span></span>
        </div>
        
        <input 
          type="range" 
          min="6" 
          max="32" 
          step="1"
          value={state.maxCurrent}
          onChange={(e) => handleMaxCurrentChange(parseInt(e.target.value))}
          style={{ 
            width: '100%', 
            height: '6px', 
            borderRadius: '3px', 
            appearance: 'none', 
            background: 'var(--color-border)',
            outline: 'none'
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
          <span>6 A</span>
          <span>16 A</span>
          <span>32 A</span>
        </div>
      </div>

      {/* Smart Charging Section */}
      <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.05)' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={20} /> Smart Charging
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Timer Automation */}
          <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} style={{ color: state.automations.timerActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Timer-Laden</span>
              </div>
              <button 
                onClick={() => {
                  if (state.automations.timerActive) {
                    updateAutomations({ ...state.automations, timerActive: false, timerEndTime: null });
                  } else {
                    const endTime = Date.now() + state.automations.timerDuration * 60 * 60 * 1000;
                    updateAutomations({ ...state.automations, timerActive: true, timerEndTime: endTime });
                    handleToggleMode(0); // Manual
                    setTimeout(() => handleToggleCharge(1), 2000); // Start
                  }
                }}
                style={{ 
                  padding: '0.4rem 1rem', borderRadius: '20px', border: 'none',
                  backgroundColor: state.automations.timerActive ? 'var(--color-danger)' : 'var(--color-primary)',
                  color: 'white', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer'
                }}
              >
                {state.automations.timerActive ? 'Timer stoppen' : 'Timer starten'}
              </button>
            </div>
            
            {!state.automations.timerActive ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input 
                  type="range" min="1" max="10" step="1" 
                  value={state.automations.timerDuration}
                  onChange={(e) => updateAutomations({ ...state.automations, timerDuration: parseInt(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, minWidth: '3rem' }}>{state.automations.timerDuration} h</span>
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                Aktiv bis {new Date(state.automations.timerEndTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr
              </div>
            )}
          </div>

          {/* Night Drain Automation */}
          <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Power size={18} style={{ color: state.automations.nightDrainActive ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Nacht-Entladung</span>
              </div>
              <button 
                onClick={() => updateAutomations({ ...state.automations, nightDrainActive: !state.automations.nightDrainActive })}
                style={{ 
                  width: '44px', height: '24px', borderRadius: '12px', border: '1px solid var(--color-border)',
                  backgroundColor: state.automations.nightDrainActive ? 'var(--color-success)' : 'rgba(0,0,0,0.2)',
                  position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <div style={{ 
                  width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white',
                  position: 'absolute', top: '2px', left: state.automations.nightDrainActive ? '22px' : '2px',
                  transition: 'all 0.2s'
                }} />
              </button>
            </div>
            
            {state.automations.nightDrainActive && (
              <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Startzeit</label>
                  <input 
                    type="time" value={state.automations.nightDrainTime}
                    onChange={(e) => updateAutomations({ ...state.automations, nightDrainTime: e.target.value })}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.05)', color: 'var(--color-text)', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Min. Akku (%)</label>
                  <input 
                    type="number" min="5" max="100" value={state.automations.nightDrainThreshold}
                    onChange={(e) => updateAutomations({ ...state.automations, nightDrainThreshold: parseInt(e.target.value) })}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.05)', color: 'var(--color-text)', fontSize: '0.8rem' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--color-primary-light)', animation: 'fadeIn 0.3s ease' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 800, color: 'var(--color-primary)' }}>Verbindungs-Einstellungen</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>VRM Portal ID</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="z.B. d0ff... "
                value={vrmSettings.vrmId}
                onChange={(e) => setVrmSettings({ ...vrmSettings, vrmId: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>VRM Username (E-Mail)</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Deine VRM E-Mail"
                value={vrmSettings.username || ''}
                onChange={(e) => setVrmSettings({ ...vrmSettings, username: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>VRM Passwort / Token</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Dein VRM Passwort"
                value={vrmSettings.password || ''}
                onChange={(e) => setVrmSettings({ ...vrmSettings, password: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Device Instance</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Standard: 290"
                value={vrmSettings.instance}
                onChange={(e) => setVrmSettings({ ...vrmSettings, instance: e.target.value })}
              />
            </div>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                mockDb.saveVictronSettings(vrmSettings);
                setShowSettings(false);
              }}
            >
              Speichern & Verbinden
            </button>
            {error && (
              <div style={{ color: 'var(--color-danger)', fontSize: '0.7rem', textAlign: 'center', marginTop: '0.5rem', fontWeight: 600 }}>
                <AlertCircle size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                {error}
              </div>
            )}
            <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '0.6rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Last Topic: {lastTopic || 'None'}
            </div>
          </div>
        </div>
      )}

      {/* Footer / Info */}
      <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>
        Victron Wallbox Integration &bull; VRM MQTT Bridge
      </div>

      <style>{`
        .spin { animation: spin 2s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

const CheckCircle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);
