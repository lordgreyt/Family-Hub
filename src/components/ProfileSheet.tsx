import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Check, Shield, Trash2, Upload, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import { mockDb } from '../services/mockDb';
import { AvatarEmoji } from './AvatarEmoji';
import {
  STUDIO_AVATAR_CATEGORIES,
  STUDIO_GRADIENTS,
  compressImageFileToAvatarDataUrl,
  extractInitials,
  getMonogramText,
  isMonogramAvatar,
  isPhotoAvatar,
} from '../data/avatars';

interface ProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

type AvatarTab = 'portraits' | 'animals' | 'art' | 'monogram' | 'photo';

const TAB_ITEMS: { id: AvatarTab; label: string }[] = [
  { id: 'portraits', label: 'Portraits' },
  { id: 'animals', label: 'Tiere' },
  { id: 'art', label: 'Kunst' },
  { id: 'monogram', label: 'Initialen' },
  { id: 'photo', label: 'Foto' },
];

function inferInitialTab(avatar?: string): AvatarTab {
  if (!avatar) return 'portraits';
  if (isPhotoAvatar(avatar)) return 'photo';
  if (isMonogramAvatar(avatar)) return 'monogram';
  if (avatar.startsWith('art:') || avatar === 'avatar:welle') return 'art';
  if (
    avatar === 'avatar:fuchs' ||
    avatar === 'avatar:wolf' ||
    avatar === 'avatar:eule' ||
    avatar === 'avatar:katze' ||
    avatar === 'avatar:loewe'
  ) {
    return 'animals';
  }
  return 'portraits';
}

export const ProfileSheet: React.FC<ProfileSheetProps> = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editAvatarColor, setEditAvatarColor] = useState(STUDIO_GRADIENTS[0].value);
  const [monogramInput, setMonogramInput] = useState('');
  const [activeTab, setActiveTab] = useState<AvatarTab>('portraits');
  const [statusMsg, setStatusMsg] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setEditName(user.id);
      setEditAvatar(user.avatar || 'avatar:papa');
      setEditAvatarColor(user.avatarColor || STUDIO_GRADIENTS[0].value);
      setMonogramInput(isMonogramAvatar(user.avatar) ? getMonogramText(user.avatar) : extractInitials(user.id));
      setActiveTab(inferInitialTab(user.avatar));
      setStatusMsg(null);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const stats = useMemo(() => {
    if (!user) return null;
    const now = new Date();
    const weekStart = new Date(now);
    const day = now.getDay() || 7;
    weekStart.setDate(now.getDate() - day + 1);
    weekStart.setHours(0, 0, 0, 0);

    const tasks = mockDb.getTasks();
    const tasksThisWeek = tasks.filter(t => t.isDone && t.completedAt && t.completedAt >= weekStart.getTime()).length;
    const tasksTotal = tasks.filter(t => t.isDone).length;

    const requests = mockDb.getRewardRequests();
    const starBalance = requests
      .filter(r => r.childId === user.id && r.status !== 'REJECTED')
      .reduce((sum, r) => sum - r.stars, 0);

    return { tasksThisWeek, tasksTotal, stars: Math.max(0, starBalance) };
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const trimmedName = editName.trim();
  const isAdmin = Boolean(user.isAdmin || user.id === 'Falko');
  const roleLabel = isAdmin ? 'Administrator' : user.isChild ? 'Kind' : 'Erwachsener';
  const email = auth.currentUser?.email || '';

  const nameTaken =
    trimmedName.length > 0 &&
    trimmedName !== user.id &&
    mockDb.getUsers().some(u => u.id.toLowerCase() === trimmedName.toLowerCase());

  const hasChanges =
    trimmedName !== user.id ||
    editAvatar !== user.avatar ||
    editAvatarColor !== (user.avatarColor || STUDIO_GRADIENTS[0].value);

  const canSave = trimmedName.length > 0 && !nameTaken && !isUploading;

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatusMsg({ text: 'Bitte wähle eine Bilddatei (JPG, PNG oder WebP).', tone: 'error' });
      return;
    }
    setIsUploading(true);
    setStatusMsg(null);
    try {
      const dataUrl = await compressImageFileToAvatarDataUrl(file, 256);
      setEditAvatar(dataUrl);
      setActiveTab('photo');
    } catch (err: unknown) {
      setStatusMsg({
        text: err instanceof Error ? err.message : 'Foto konnte nicht verarbeitet werden.',
        tone: 'error',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectMonogram = (letters: string) => {
    const clean = letters.replace(/[^a-zA-Z0-9ÄÖÜäöüß]/g, '').slice(0, 2).toUpperCase();
    setMonogramInput(clean);
    setEditAvatar(`monogram:${clean || extractInitials(trimmedName || user.id)}`);
  };

  const handleSave = () => {
    if (!canSave) return;

    const currentDbUser = mockDb.getUsers().find(u => u.id === user.id);
    if (!currentDbUser) return;

    const updatedUser = {
      ...currentDbUser,
      id: trimmedName,
      avatar: editAvatar,
      avatarColor: editAvatarColor,
    };

    if (trimmedName !== user.id) {
      mockDb.deleteUser(user.id);
      mockDb.addUser(updatedUser);
    } else {
      mockDb.updateUser(updatedUser);
    }

    updateUser(updatedUser);
    setStatusMsg({ text: 'Profil gespeichert', tone: 'success' });
    setTimeout(() => {
      onClose();
    }, 650);
  };

  const activeCategory = STUDIO_AVATAR_CATEGORIES.find(c => c.id === activeTab);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18, 15, 48, 0.56)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 2000,
        animation: 'psFade 0.18s ease',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Profil bearbeiten"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '500px',
          maxHeight: '94dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '28px 28px 0 0',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
          boxShadow: '0 -16px 48px rgba(23, 20, 58, 0.34)',
          animation: 'psSlideUp 0.26s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelected}
          style={{ display: 'none' }}
        />

        {/* Studio Header */}
        <div
          style={{
            flex: 'none',
            position: 'relative',
            overflow: 'hidden',
            padding: '0.85rem 1.25rem 1.35rem',
            color: '#FFFFFF',
            background: 'linear-gradient(150deg, #27208C 0%, #4E3FD6 54%, #8E78F2 88%, #E7A1BE 122%)',
          }}
        >
          {/* Subtle ambient light orbs */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '-42px',
              left: '-28px',
              width: '160px',
              height: '160px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: '-55px',
              right: '-20px',
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(249,201,168,0.28) 0%, rgba(249,201,168,0) 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Grab handle */}
          <div
            style={{
              width: '40px',
              height: '4px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.4)',
              margin: '0 auto 0.7rem',
            }}
          />

          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', opacity: 0.82 }}>
              Profil-Studio
            </span>
            <button
              type="button"
              className="glass-btn"
              onClick={onClose}
              aria-label="Schließen"
              style={{ width: '36px', height: '36px' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Identity row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.65rem', position: 'relative', zIndex: 1 }}>
            <div style={{ position: 'relative', width: '82px', height: '82px', flexShrink: 0 }}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: editAvatarColor,
                  overflow: 'hidden',
                  border: '3px solid rgba(255,255,255,0.92)',
                  boxShadow: '0 10px 26px rgba(17, 13, 56, 0.36)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AvatarEmoji emoji={editAvatar} size={82} />
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Eigenes Foto hochladen"
                aria-label="Eigenes Foto hochladen"
                style={{
                  position: 'absolute',
                  right: '-2px',
                  bottom: '-2px',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  color: '#3F34C4',
                  border: '2px solid #4E3FD6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 3px 10px rgba(17, 13, 56, 0.3)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <Camera size={13} strokeWidth={2.4} />
              </button>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#FFFFFF',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {trimmedName || 'Dein Name'}
              </h2>
              {email && (
                <div
                  style={{
                    marginTop: '0.15rem',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.82)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {email}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(6px)',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                  }}
                >
                  {isAdmin ? <Shield size={11} /> : <UserIcon size={11} />}
                  {roleLabel}
                </span>
                {hasChanges && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      background: 'rgba(255, 224, 130, 0.25)',
                      color: '#FFF4CC',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    Ungespeichert
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '1rem 1.25rem 1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.15rem',
          }}
        >
          {/* Compact Pro KPI Strip */}
          {stats && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                background: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                borderRadius: '16px',
                padding: '0.7rem 0.25rem',
              }}
            >
              {[
                { value: stats.tasksThisWeek, label: 'Diese Woche' },
                { value: stats.tasksTotal, label: 'Erledigt' },
                { value: stats.stars, label: 'Sterne' },
              ].map((item, idx) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.12rem',
                    borderLeft: idx > 0 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      letterSpacing: '-0.02em',
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--color-text)',
                      lineHeight: 1.1,
                    }}
                  >
                    {item.value}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Anzeigename */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
              <label
                htmlFor="profile-display-name"
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                }}
              >
                Anzeigename
              </label>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                {trimmedName.length}/24
              </span>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <UserIcon
                size={16}
                style={{
                  position: 'absolute',
                  left: '14px',
                  color: 'var(--color-text-tertiary)',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="profile-display-name"
                type="text"
                maxLength={24}
                value={editName}
                onChange={e => {
                  setEditName(e.target.value);
                  setStatusMsg(null);
                }}
                placeholder="Dein Anzeigename"
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '0 2.4rem 0 2.5rem',
                  borderRadius: '14px',
                  border: nameTaken ? '1.5px solid #D4416E' : '1.5px solid var(--color-border)',
                  background: 'var(--color-surface-hover)',
                  color: 'var(--color-text)',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
              />
              {editName.length > 0 && (
                <button
                  type="button"
                  onClick={() => setEditName('')}
                  aria-label="Namen leeren"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'var(--color-surface-muted)',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
            {nameTaken && (
              <p style={{ margin: '0.35rem 0 0', fontSize: '12px', fontWeight: 700, color: '#D4416E' }}>
                Dieser Anzeigename wird bereits verwendet.
              </p>
            )}
          </div>

          {/* Profilbild-Studio */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                }}
              >
                Profilbild
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
                Studio-Kollektion
              </span>
            </div>

            {/* Segmented Tab Bar */}
            <div
              role="tablist"
              aria-label="Profilbild-Kategorien"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '3px',
                padding: '4px',
                borderRadius: '14px',
                background: 'var(--color-surface-muted)',
                marginBottom: '0.85rem',
              }}
            >
              {TAB_ITEMS.map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id === 'monogram' && !isMonogramAvatar(editAvatar)) {
                        const init = monogramInput || extractInitials(trimmedName || user.id);
                        setMonogramInput(init);
                        setEditAvatar(`monogram:${init}`);
                      }
                    }}
                    style={{
                      height: '34px',
                      borderRadius: '10px',
                      border: 'none',
                      padding: '0 4px',
                      fontFamily: 'inherit',
                      fontSize: '12px',
                      fontWeight: active ? 800 : 600,
                      cursor: 'pointer',
                      background: active ? 'var(--color-surface)' : 'transparent',
                      color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: active ? '0 2px 8px rgba(23, 20, 58, 0.1)' : 'none',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Curated Studio Gallery (Portraits / Tiere / Kunst) */}
            {activeCategory && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.65rem',
                }}
              >
                {activeCategory.items.map(item => {
                  const selected = editAvatar === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setEditAvatar(item.id);
                        setEditAvatarColor(item.accent);
                      }}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.45rem',
                        padding: '0.65rem 0.4rem 0.55rem',
                        borderRadius: '18px',
                        border: selected ? '2px solid #5A4BE0' : '1.5px solid var(--color-border)',
                        background: selected ? 'rgba(90, 75, 224, 0.08)' : 'var(--color-surface-hover)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'transform 0.14s ease, border-color 0.14s ease, background 0.14s ease',
                        boxShadow: selected ? '0 6px 16px rgba(63, 52, 196, 0.16)' : 'none',
                      }}
                    >
                      <div style={{ position: 'relative', width: '74px', height: '74px' }}>
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            background: item.accent,
                            boxShadow: '0 4px 12px rgba(23, 20, 58, 0.12)',
                          }}
                        >
                          <AvatarEmoji emoji={item.id} size={74} />
                        </div>
                        {selected && (
                          <span
                            style={{
                              position: 'absolute',
                              right: '-2px',
                              bottom: '-2px',
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #3F34C4, #6D5DF0)',
                              color: '#FFFFFF',
                              border: '2px solid var(--color-surface)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(63, 52, 196, 0.35)',
                            }}
                          >
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: selected ? 800 : 600,
                          color: selected ? 'var(--color-primary)' : 'var(--color-text)',
                          lineHeight: 1.1,
                        }}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Monogram / Initials Studio */}
            {activeTab === 'monogram' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.9rem',
                  padding: '0.95rem',
                  borderRadius: '18px',
                  background: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div
                    style={{
                      width: '58px',
                      height: '58px',
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: editAvatarColor,
                      overflow: 'hidden',
                      boxShadow: '0 6px 16px rgba(23, 20, 58, 0.18)',
                    }}
                  >
                    <AvatarEmoji emoji={`monogram:${monogramInput || extractInitials(trimmedName || user.id)}`} size={58} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label
                      htmlFor="profile-monogram-input"
                      style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}
                    >
                      Initialen (1–2 Zeichen)
                    </label>
                    <div style={{ display: 'flex', gap: '0.45rem' }}>
                      <input
                        id="profile-monogram-input"
                        type="text"
                        maxLength={2}
                        value={monogramInput}
                        onChange={e => handleSelectMonogram(e.target.value)}
                        placeholder={extractInitials(trimmedName || user.id)}
                        style={{
                          width: '74px',
                          height: '40px',
                          textAlign: 'center',
                          borderRadius: '12px',
                          border: '1.5px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          color: 'var(--color-text)',
                          fontSize: '1rem',
                          fontWeight: 800,
                          fontFamily: 'inherit',
                          textTransform: 'uppercase',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSelectMonogram(extractInitials(trimmedName || user.id))}
                        style={{
                          flex: 1,
                          height: '40px',
                          borderRadius: '12px',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          color: 'var(--color-primary)',
                          fontSize: '12px',
                          fontWeight: 700,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        Aus Namen übernehmen
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                    Verlauf & Farbton
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.55rem' }}>
                    {STUDIO_GRADIENTS.map(grad => {
                      const active = editAvatarColor === grad.value || editAvatarColor === grad.solid;
                      return (
                        <button
                          key={grad.id}
                          type="button"
                          onClick={() => {
                            setEditAvatarColor(grad.value);
                            setEditAvatar(`monogram:${monogramInput || extractInitials(trimmedName || user.id)}`);
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.45rem 0.25rem',
                            borderRadius: '14px',
                            border: active ? '1.5px solid #5A4BE0' : '1px solid transparent',
                            background: active ? 'rgba(90, 75, 224, 0.08)' : 'var(--color-surface)',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          <span
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: grad.value,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#FFFFFF',
                              boxShadow: '0 3px 8px rgba(23, 20, 58, 0.16)',
                            }}
                          >
                            {active && <Check size={15} strokeWidth={3} />}
                          </span>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                            {grad.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Photo Upload Studio */}
            {activeTab === 'photo' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.8rem',
                  padding: '1.25rem 1rem',
                  borderRadius: '18px',
                  border: '1.5px dashed var(--color-border)',
                  background: 'var(--color-surface-hover)',
                  textAlign: 'center',
                }}
              >
                {isPhotoAvatar(editAvatar) ? (
                  <>
                    <div
                      style={{
                        width: '96px',
                        height: '96px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '3px solid #5A4BE0',
                        boxShadow: '0 8px 22px rgba(63, 52, 196, 0.2)',
                      }}
                    >
                      <AvatarEmoji emoji={editAvatar} size={96} />
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
                      Eigenes Profilfoto aktiv
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '280px' }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        style={{
                          flex: 1,
                          height: '40px',
                          borderRadius: '999px',
                          border: 'none',
                          background: '#ECE8FF',
                          color: '#3F34C4',
                          fontSize: '12.5px',
                          fontWeight: 800,
                          fontFamily: 'inherit',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                        }}
                      >
                        <Camera size={14} /> Ändern
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditAvatar('avatar:papa');
                          setActiveTab('portraits');
                        }}
                        style={{
                          height: '40px',
                          padding: '0 0.9rem',
                          borderRadius: '999px',
                          border: 'none',
                          background: '#FDE8EF',
                          color: '#D4416E',
                          fontSize: '12.5px',
                          fontWeight: 800,
                          fontFamily: 'inherit',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.3rem',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={14} /> Entfernen
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '16px',
                        background: 'rgba(90, 75, 224, 0.12)',
                        color: '#4E3FD6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Upload size={22} />
                    </span>
                    <div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text)' }}>
                        Eigenes Foto verwenden
                      </div>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                        Wird automatisch zentriert, quadratisch zugeschnitten und optimiert gespeichert.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      style={{
                        height: '42px',
                        padding: '0 1.25rem',
                        borderRadius: '999px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)',
                        color: '#FFFFFF',
                        fontSize: '13px',
                        fontWeight: 800,
                        fontFamily: 'inherit',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        cursor: 'pointer',
                        boxShadow: '0 6px 16px rgba(63, 52, 196, 0.25)',
                      }}
                    >
                      <Camera size={15} /> {isUploading ? 'Wird optimiert…' : 'Foto auswählen'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {statusMsg && (
            <div
              style={{
                padding: '0.65rem 0.9rem',
                borderRadius: '14px',
                fontSize: 'var(--font-sm)',
                fontWeight: 700,
                textAlign: 'center',
                color: statusMsg.tone === 'error' ? '#D4416E' : '#1E9A78',
                background: statusMsg.tone === 'error' ? '#FDE8EF' : '#E3F6EF',
              }}
            >
              {statusMsg.text}
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div
          style={{
            flex: 'none',
            display: 'flex',
            gap: '0.6rem',
            padding: '0.8rem 1.25rem calc(1rem + env(safe-area-inset-bottom))',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: '48px',
              padding: '0 1.15rem',
              borderRadius: '999px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-hover)',
              color: 'var(--color-text-muted)',
              fontSize: '0.9rem',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            style={{
              flex: 1,
              height: '48px',
              border: 'none',
              borderRadius: '999px',
              cursor: canSave ? 'pointer' : 'default',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              background:
                statusMsg?.tone === 'success'
                  ? 'linear-gradient(135deg, #1E9A78 0%, #4FC3A1 100%)'
                  : 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)',
              color: '#FFFFFF',
              fontSize: '0.92rem',
              fontWeight: 800,
              opacity: canSave ? 1 : 0.45,
              boxShadow: canSave ? '0 8px 20px rgba(63, 52, 196, 0.28)' : 'none',
              transition: 'opacity 0.15s, background 0.2s',
            }}
          >
            <Check size={17} strokeWidth={2.8} />
            {statusMsg?.tone === 'success' ? 'Gespeichert' : 'Änderungen speichern'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes psFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes psSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>,
    document.body
  );
};
