import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Zap } from 'lucide-react';
import { getNavItems } from '../../utils/navigation';
import { useAuth } from '../../context/AuthContext';
import { useVictron } from '../../context/VictronContext';
import { AvatarEmoji } from '../AvatarEmoji';
import { ProfileSheet } from '../ProfileSheet';

export const TopBar = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { user } = useAuth();
  const location = useLocation();
  const { state: victron } = useVictron();
  const [showProfile, setShowProfile] = useState(false);

  if (!user) return null;

  const pageTitle = getNavItems(user, true, true).find(i => i.to === location.pathname && i.to !== '/')?.label || 'Family Hub';

  return (
    <>
      <header className="app-header">
        <div className="app-header-row">
          <button className="glass-btn" onClick={onMenuClick} aria-label="Menü öffnen">
            <Menu size={22} />
          </button>
          <h1 className="app-header-title">{pageTitle}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 'none' }}>
            {!user.isChild && (
              <Zap
                size={18}
                color="white"
                fill={victron.state === 2 ? 'white' : 'none'}
                aria-label="Victron-Status"
                style={{
                  transition: 'all 0.3s ease',
                  opacity: victron.isConnected ? 1 : 0.5,
                }}
              />
            )}
            <button
              className="app-avatar-btn"
              onClick={() => setShowProfile(true)}
              aria-label={`Profil von ${user.id} bearbeiten`}
              style={{
                background: user.avatarColor || '#6D5DF0',
              }}
            >
              <AvatarEmoji emoji={user.avatar} size={44} />
            </button>
          </div>
        </div>
      </header>

      <ProfileSheet isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </>
  );
};
