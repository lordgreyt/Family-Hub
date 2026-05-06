import { useState, useEffect, useRef } from 'react';
import { APP_VERSION, isNewVersion, getCurrentChangelog, setLastSeenVersion } from '../data/changelog';
import { Sparkles, X } from 'lucide-react';

// Check at module load time so it's consistent across re-renders
const shouldShow = isNewVersion();

export const UpdateNotification = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [animate, setAnimate] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!shouldShow) return;

    // Mark version as seen immediately so we don't re-show on remounts
    setLastSeenVersion(APP_VERSION);

    timerRef.current = setTimeout(() => {
      setIsVisible(true);
      // Trigger animation slightly after mount for CSS transition
      requestAnimationFrame(() => {
        setAnimate(true);
      });
    }, 600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleDismiss = () => {
    setAnimate(false);
    setTimeout(() => {
      setIsVisible(false);
    }, 250);
  };

  if (!isVisible) return null;

  const changelog = getCurrentChangelog();

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: animate ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: animate ? 'blur(4px)' : 'blur(0px)',
        transition: 'background-color 0.25s ease, backdrop-filter 0.25s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="glass-panel"
        style={{
          maxWidth: '420px',
          width: '100%',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
          transform: animate ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          opacity: animate ? 1 : 0,
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem 1.5rem 1rem 1.5rem',
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
          color: 'white',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                Update verfügbar
              </h3>
              <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.8rem', opacity: 0.85 }}>
                Version {changelog?.version || APP_VERSION} &mdash; {changelog?.title || 'Neue Funktionen'}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              opacity: 0.7,
              padding: '0.25rem',
              display: 'flex',
              flexShrink: 0,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Changes */}
        <div style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{
            margin: '0 0 0.75rem 0',
            fontSize: 'var(--font-sm)',
            color: 'var(--color-text-muted)',
            fontWeight: 600,
          }}>
            Was ist neu?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {changelog?.changes.map((change, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  fontSize: 'var(--font-sm)',
                  color: 'var(--color-text)',
                  lineHeight: 1.4,
                }}
              >
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '6px',
                  height: '6px',
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

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={handleDismiss}
            className="btn btn-primary"
            style={{
              padding: '0.6rem 1.5rem',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
            }}
          >
            Verstanden
          </button>
        </div>
      </div>
    </div>
  );
};
