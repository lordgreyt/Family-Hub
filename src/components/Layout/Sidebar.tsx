import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { X, LogOut, Info } from 'lucide-react';
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

  const navItems = getNavItems(user, settings.showPacklist, settings.showHolidayBudget, settings.showTasks, settings.showNotes);
  const recentChangelog = getRecentChangelog(2);

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
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 900,
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* Sidebar Panel */}
      <aside style={{
        position: 'fixed',
        top: 0,
        left: isOpen ? 0 : '-100%',
        width: '240px',
        height: '100%',
        backgroundColor: 'var(--color-surface)',
        boxShadow: isOpen ? '10px 0 30px rgba(0,0,0,0.1)' : 'none',
        zIndex: 1000,
        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1rem',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexShrink: 0 }}>
          <h2 style={{ fontSize: 'var(--font-xl)', color: 'var(--color-primary)', margin: 0 }}>Menü</h2>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {/* Navigation Links — scrollable */}
        <nav style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.3rem',
          flex: 1,
          overflowY: 'auto',
          paddingBottom: '0.5rem',
          WebkitOverflowScrolling: 'touch',
          minHeight: 0,
        }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'white' : 'var(--color-text)',
                backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.2s ease',
              })}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer Info */}
        <div style={{
          marginTop: 'auto',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-xs)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          flexShrink: 0,
        }}>
          <div>
            <p style={{ margin: 0 }}>Angemeldet als <strong>{user?.id}</strong></p>
            <button
              onClick={() => { logout(); onClose(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'none',
                border: 'none',
                color: 'var(--color-danger)',
                cursor: 'pointer',
                padding: '0.4rem 0',
                fontSize: '0.75rem',
                opacity: 0.8,
                fontWeight: 500,
                marginTop: '0.25rem'
              }}
            >
              <LogOut size={14} /> Abmelden
            </button>
          </div>
          <button
            onClick={() => setShowChangelog(true)}
            className="sidebar-version-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              margin: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              fontSize: 'inherit',
              padding: '0.15rem 0',
            }}
            title="Changelog anzeigen"
          >
            <Info size={12} />
            <span>Family Hub v{APP_VERSION}</span>
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
