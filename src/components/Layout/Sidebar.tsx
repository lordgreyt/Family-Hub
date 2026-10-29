import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { X, LogOut, Info } from 'lucide-react';
import { AvatarEmoji } from '../AvatarEmoji';
import { getNavItems } from '../../utils/navigation';
import { APP_VERSION, getRecentChangelog } from '../../data/changelog';
import type { ChangelogEntry } from '../../data/changelog';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const [showChangelog, setShowChangelog] = useState(false);

  const navItems = getNavItems(user, settings.showPacklist, settings.showHolidayBudget, settings.showTasks);
  const recentChangelog = getRecentChangelog(2);

  const groupOf = (to: string) =>
    ['/expenses', '/op-finanzen', '/budget', '/n26', '/packliste', '/urlaubsbudget'].includes(to)
      ? 'Geld & Reisen'
      : ['/smart-home', '/setup'].includes(to)
        ? 'Zuhause'
        : 'Alltag';
  const groups = ['Alltag', 'Geld & Reisen', 'Zuhause']
    .map(label => ({ label, items: navItems.filter(i => groupOf(i.to) === label) }))
    .filter(g => g.items.length > 0);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(23,20,58,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 900,
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className="drawer"
        aria-hidden={!isOpen}
        style={{
          left: isOpen ? 0 : '-100%',
          boxShadow: isOpen ? '10px 0 30px rgba(23,20,58,0.18)' : 'none',
          visibility: isOpen ? 'visible' : 'hidden',
          transitionProperty: 'left, visibility',
        }}
      >
        {/* Header */}
        <div className="drawer-head">
          <span style={{
            width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
            background: user?.avatarColor || '#FFD9C2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', border: '2px solid rgba(255,255,255,0.7)',
          }}>
            {user && <AvatarEmoji emoji={user.avatar} size={52} />}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.id}</div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-gradient-muted)' }}>Family Hub</div>
          </div>
          <button className="glass-btn" onClick={onClose} aria-label="Menü schließen">
            <X size={22} />
          </button>
        </div>

        {/* Navigation Links — scrollable */}
        <nav style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.15rem',
          flex: 1,
          overflowY: 'auto',
          padding: '0.25rem 0.75rem 0.5rem',
          WebkitOverflowScrolling: 'touch',
          minHeight: 0,
        }}>
          {groups.map(group => (
            <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <div className="drawer-group-label">{group.label}</div>
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={onClose}
                  className={({ isActive }) => `drawer-link${isActive ? ' drawer-link--on' : ''}`}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="drawer-foot">
          <button className="drawer-logout" onClick={() => { logout(); onClose(); }}>
            <LogOut size={18} /> Abmelden
          </button>
          <button className="drawer-version" onClick={() => setShowChangelog(true)} title="Changelog anzeigen">
            <Info size={13} />
            <span>Family Hub v{APP_VERSION} · Neuigkeiten</span>
          </button>
        </div>
      </aside>

      {/* Changelog Modal */}
      {showChangelog && (
        <div
          onClick={() => setShowChangelog(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '1.5rem',
            paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: 'var(--font-lg)', color: 'var(--color-text)', margin: 0 }}>
                Changelog
              </h3>
              <button
                onClick={() => setShowChangelog(false)}
                style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {recentChangelog.map((entry: ChangelogEntry) => (
                <div key={entry.version}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.5rem',
                    marginBottom: '0.6rem',
                    paddingBottom: '0.4rem',
                    borderBottom: '1px solid var(--color-border)',
                  }}>
                    <span style={{
                      fontSize: 'var(--font-sm)',
                      fontWeight: 700,
                      color: 'var(--color-primary)',
                      whiteSpace: 'nowrap',
                    }}>
                      v{entry.version}
                    </span>
                    <span style={{
                      fontSize: 'var(--font-xs)',
                      color: 'var(--color-text-muted)',
                    }}>
                      {new Date(entry.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    <span style={{
                      fontSize: 'var(--font-sm)',
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      flex: 1,
                      textAlign: 'right' as const,
                    }}>
                      {entry.title}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {entry.changes.map((change, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                          fontSize: 'var(--font-sm)',
                          color: 'var(--color-text)',
                          lineHeight: 1.4,
                        }}
                      >
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--color-primary)',
                          marginTop: '0.5rem',
                          flexShrink: 0,
                        }} />
                        <span>{change}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
