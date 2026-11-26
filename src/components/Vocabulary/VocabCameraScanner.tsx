import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Aperture,
  Camera,
  Check,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import type { VocabularySet } from '../../services/mockDb';
import {
  PROVIDER_LABELS,
  extractVocabularyFromPhotos,
  loadVocabAiStatus,
  mergeVocabEntries,
  prepareVocabPhoto,
} from '../../services/vocabOcr';
import type { ExtractedVocabPair, PreparedPhoto, VocabAiStatus } from '../../services/vocabOcr';

interface VocabCameraScannerProps {
  isOpen: boolean;
  existingSets: VocabularySet[];
  userId: string;
  onClose: () => void;
  onSaved: (set: VocabularySet, summary: string) => void;
}

type Step = 'capture' | 'review';

const MAX_PHOTOS = 4;
const LANGUAGE_PRESETS = ['Englisch', 'Französisch', 'Spanisch', 'Latein', 'Italienisch'];

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const VocabCameraScanner: React.FC<VocabCameraScannerProps> = ({
  isOpen,
  existingSets,
  userId,
  onClose,
  onSaved,
}) => {
  const navigate = useNavigate();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<Step>('capture');
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [languageFrom, setLanguageFrom] = useState('Englisch');
  const [languageTo, setLanguageTo] = useState('Deutsch');
  const [title, setTitle] = useState('');
  const [targetSetId, setTargetSetId] = useState<string>('__new__');

  // Remote/local API key status (key is configured strictly in Setup for adults)
  const [aiStatus, setAiStatus] = useState<VocabAiStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Live viewfinder state
  const [liveCameraOpen, setLiveCameraOpen] = useState(false);
  const [liveCameraError, setLiveCameraError] = useState('');

  // OCR & review state
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState<ExtractedVocabPair[]>([]);

  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setLiveCameraOpen(false);
    setLiveCameraError('');
  };

  useEffect(() => {
    if (!isOpen) {
      stopLiveCamera();
      return;
    }
    setStep('capture');
    setPhotos([]);
    setEntries([]);
    setTitle('');
    setTargetSetId('__new__');
    setError('');
    setLiveCameraError('');

    let active = true;
    setLoadingStatus(true);
    loadVocabAiStatus()
      .then(status => {
        if (active) setAiStatus(status);
      })
      .finally(() => {
        if (active) setLoadingStatus(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => () => stopLiveCamera(), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (liveCameraOpen) stopLiveCamera();
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, liveCameraOpen, onClose]);

  const startLiveCamera = async () => {
    setError('');
    setLiveCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Live-Kamera wird von diesem Browser nicht unterstützt. Nutze bitte „Handykamera öffnen“.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setLiveCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setLiveCameraError('Kamera-Zugriff wurde blockiert oder keine Kamera gefunden.');
    }
  };

  const captureFromLiveCamera = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    setIsPreparing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas nicht verfügbar.');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Foto konnte nicht aufgenommen werden.');
      const prepared = await prepareVocabPhoto(blob);
      setPhotos(prev => [...prev, prepared].slice(0, MAX_PHOTOS));
      stopLiveCamera();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fotoaufnahme fehlgeschlagen.');
    } finally {
      setIsPreparing(false);
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setIsPreparing(true);
    try {
      const remaining = Math.max(0, MAX_PHOTOS - photos.length);
      const batch = files.slice(0, remaining);
      const prepared = await Promise.all(batch.map(file => prepareVocabPhoto(file)));
      setPhotos(prev => [...prev, ...prepared].slice(0, MAX_PHOTOS));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Foto konnte nicht geladen werden.');
    } finally {
      setIsPreparing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!aiStatus?.configured) {
      setError('Bitte hinterlege zuerst deinen DeepSeek (oder Gemini/OpenAI) API-Key unter Setup → KI-Vokabelscanner.');
      return;
    }
    if (photos.length === 0) {
      setError('Bitte fotografiere zuerst eine Vokabelseite.');
      return;
    }

    setError('');
    setIsExtracting(true);
    try {
      const selectedExisting = targetSetId !== '__new__' ? existingSets.find(s => s.id === targetSetId) : undefined;
      const result = await extractVocabularyFromPhotos(photos, {
        title: selectedExisting?.title || title,
        languageFrom: selectedExisting?.languageFrom || languageFrom,
        languageTo: selectedExisting?.languageTo || languageTo,
      });

      setTitle(selectedExisting?.title || result.title);
      setLanguageFrom(selectedExisting?.languageFrom || result.languageFrom);
      setLanguageTo(selectedExisting?.languageTo || result.languageTo);
      setEntries(result.entries);
      setStep('review');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Vokabeln konnten nicht ausgelesen werden.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleEntryChange = (id: string, field: 'front' | 'back', value: string) => {
    setEntries(prev =>
      prev.map(row => (row.id === id ? { ...row, [field]: value, uncertain: false } : row))
    );
  };

  const handleRemoveEntry = (id: string) => {
    setEntries(prev => prev.filter(row => row.id !== id));
  };

  const handleAddEmptyEntry = () => {
    setEntries(prev => [...prev, { id: createId(), front: '', back: '' }]);
  };

  const handleCommitToDb = () => {
    const validEntries = entries
      .map(e => ({ id: e.id || createId(), front: e.front.trim(), back: e.back.trim() }))
      .filter(e => e.front && e.back);

    if (validEntries.length === 0) {
      setError('Mindestens ein vollständiges Vokabelpaar wird benötigt.');
      return;
    }

    const cleanTitle = title.trim() || 'Gescannte Vokabeln';
    const cleanFrom = languageFrom.trim() || 'Englisch';
    const cleanTo = languageTo.trim() || 'Deutsch';
    const now = Date.now();

    const targetExisting =
      targetSetId !== '__new__'
        ? existingSets.find(s => s.id === targetSetId)
        : existingSets.find(
            s =>
              s.title.trim().toLocaleLowerCase() === cleanTitle.toLocaleLowerCase() &&
              s.languageFrom.trim().toLocaleLowerCase() === cleanFrom.toLocaleLowerCase() &&
              s.languageTo.trim().toLocaleLowerCase() === cleanTo.toLocaleLowerCase()
          );

    if (targetExisting) {
      const merged = mergeVocabEntries(targetExisting.entries, validEntries);
      const updatedSet: VocabularySet = {
        ...targetExisting,
        entries: merged.entries,
        updatedAt: now,
      };
      onSaved(
        updatedSet,
        merged.addedCount > 0
          ? `${merged.addedCount} neue Vokabeln zu „${updatedSet.title}“ hinzugefügt (gesamt ${merged.entries.length}).`
          : `Alle ${validEntries.length} erkannten Vokabeln waren bereits in „${updatedSet.title}“ vorhanden.`
      );
    } else {
      const merged = mergeVocabEntries([], validEntries);
      const newSet: VocabularySet = {
        id: createId(),
        title: cleanTitle,
        languageFrom: cleanFrom,
        languageTo: cleanTo,
        entries: merged.entries,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        source: 'Kamera-Scan',
        progressByUser: {},
      };
      onSaved(newSet, `${merged.entries.length} Vokabeln in „${newSet.title}“ gespeichert.`);
    }

    setPhotos([]);
    onClose();
  };

  if (!isOpen) return null;

  const uncertainCount = entries.filter(e => e.uncertain).length;
  const validCount = entries.filter(e => e.front.trim() && e.back.trim()).length;
  const isConfigured = Boolean(aiStatus?.configured);

  return createPortal(
    <div
      onClick={() => {
        if (!isExtracting) {
          stopLiveCamera();
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18, 15, 48, 0.58)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 2100,
        animation: 'vcFade 0.18s ease',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Vokabelseite scannen"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '94dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '28px 28px 0 0',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
          boxShadow: '0 -16px 48px rgba(23, 20, 58, 0.34)',
          animation: 'vcSlideUp 0.26s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFilesSelected}
          style={{ display: 'none' }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          style={{ display: 'none' }}
        />

        {/* Header */}
        <div
          style={{
            flex: 'none',
            padding: '0.85rem 1.25rem 1.1rem',
            color: '#FFFFFF',
            background: 'linear-gradient(150deg, #27208C 0%, #4E3FD6 55%, #8E78F2 95%, #E7A1BE 128%)',
          }}
        >
          <div style={{ width: '40px', height: '4px', borderRadius: '999px', background: 'rgba(255,255,255,0.4)', margin: '0 auto 0.65rem' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
              <span
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Camera size={19} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                  {step === 'capture' ? 'Vokabelseite scannen' : 'Erkannte Vokabeln prüfen'}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.85, fontWeight: 600 }}>
                  {step === 'capture'
                    ? isConfigured && aiStatus
                      ? `${PROVIDER_LABELS[aiStatus.provider]} (${aiStatus.model}) bereit`
                      : 'Abfotografieren → KI liest aus → direkt speichern'
                    : `${validCount} Wortpaare bereit · vor dem Speichern anpassbar`}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="glass-btn"
              onClick={() => {
                stopLiveCamera();
                onClose();
              }}
              disabled={isExtracting}
              aria-label="Schließen"
              style={{ width: '36px', height: '36px', flexShrink: 0 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '1rem 1.25rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Missing API Key Prompt -> links cleanly to adult-only Setup */}
          {!loadingStatus && !isConfigured && step === 'capture' && (
            <div
              style={{
                padding: '0.95rem 1rem',
                borderRadius: '18px',
                background: '#F4F1FF',
                border: '1.5px solid #C7B6F7',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: '#ECE8FF',
                  color: '#3F34C4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <KeyRound size={18} />
              </span>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#17143A' }}>
                  KI API-Key noch nicht hinterlegt
                </div>
                <div style={{ fontSize: '12px', color: '#5D5880', lineHeight: 1.4, marginTop: '2px' }}>
                  Hinterlege deinen DeepSeek-Key sicher unter <strong>Setup → KI-Vokabelscanner</strong> (für Kinder gesperrt).
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopLiveCamera();
                  onClose();
                  navigate('/setup');
                }}
                style={{
                  height: '38px',
                  padding: '0 0.9rem',
                  borderRadius: '999px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #3F34C4, #6D5DF0)',
                  color: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Settings size={14} /> Zu Setup
              </button>
            </div>
          )}

          {step === 'capture' ? (
            <>
              {/* Live Camera Viewfinder */}
              {liveCameraOpen ? (
                <div
                  style={{
                    position: 'relative',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    background: '#0F0D24',
                    aspectRatio: '3 / 4',
                    maxHeight: '360px',
                    width: '100%',
                  }}
                >
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: '14px',
                      border: '2px dashed rgba(255,255,255,0.45)',
                      borderRadius: '14px',
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: '14px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '1rem',
                    }}
                  >
                    <button
                      type="button"
                      onClick={stopLiveCamera}
                      style={{
                        height: '40px',
                        padding: '0 0.95rem',
                        borderRadius: '999px',
                        border: 'none',
                        background: 'rgba(15, 13, 36, 0.72)',
                        color: '#FFFFFF',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={captureFromLiveCamera}
                      disabled={isPreparing}
                      aria-label="Foto aufnehmen"
                      style={{
                        width: '62px',
                        height: '62px',
                        borderRadius: '50%',
                        border: '4px solid rgba(255,255,255,0.9)',
                        background: 'linear-gradient(135deg, #3F34C4, #6D5DF0)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        cursor: 'pointer',
                      }}
                    >
                      <Aperture size={26} />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={photos.length >= MAX_PHOTOS || isPreparing}
                    style={{
                      width: '100%',
                      padding: '1.05rem 1rem',
                      borderRadius: '18px',
                      border: 'none',
                      cursor: photos.length >= MAX_PHOTOS ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.65rem',
                      background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)',
                      color: '#FFFFFF',
                      fontSize: '0.98rem',
                      fontWeight: 800,
                      boxShadow: '0 10px 24px rgba(63, 52, 196, 0.26)',
                      opacity: photos.length >= MAX_PHOTOS ? 0.5 : 1,
                    }}
                  >
                    <Camera size={20} />
                    {photos.length === 0 ? 'Handykamera öffnen & Foto machen' : `Weitere Seite fotografieren (${photos.length}/${MAX_PHOTOS})`}
                  </button>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={photos.length >= MAX_PHOTOS || isPreparing}
                      style={{
                        height: '44px',
                        borderRadius: '14px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface-hover)',
                        color: 'var(--color-text)',
                        fontSize: '13px',
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        cursor: 'pointer',
                      }}
                    >
                      <ImageIcon size={16} color="#5A4BE0" /> Galerie
                    </button>
                    <button
                      type="button"
                      onClick={startLiveCamera}
                      disabled={photos.length >= MAX_PHOTOS || isPreparing}
                      style={{
                        height: '44px',
                        borderRadius: '14px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface-hover)',
                        color: 'var(--color-text)',
                        fontSize: '13px',
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        cursor: 'pointer',
                      }}
                    >
                      <Video size={16} color="#5A4BE0" /> Live-Sucher
                    </button>
                  </div>
                </div>
              )}

              {liveCameraError && (
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: '12px', background: '#FDE8EF', color: '#D4416E', fontSize: '12.5px', fontWeight: 700 }}>
                  {liveCameraError}
                </div>
              )}

              {/* Captured Thumbnails */}
              {photos.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.45rem' }}>
                    Aufgenommene Seiten ({photos.length}/{MAX_PHOTOS})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.55rem' }}>
                    {photos.map((photo, index) => (
                      <div
                        key={photo.id}
                        style={{
                          position: 'relative',
                          aspectRatio: '3 / 4',
                          borderRadius: '14px',
                          overflow: 'hidden',
                          border: '1.5px solid var(--color-border)',
                          background: '#17143A',
                        }}
                      >
                        <img
                          src={photo.dataUrl}
                          alt={`Seite ${index + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            left: '5px',
                            bottom: '5px',
                            padding: '2px 6px',
                            borderRadius: '999px',
                            background: 'rgba(23, 20, 58, 0.78)',
                            color: '#FFFFFF',
                            fontSize: '10px',
                            fontWeight: 800,
                          }}
                        >
                          S. {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))}
                          aria-label={`Seite ${index + 1} entfernen`}
                          style={{
                            position: 'absolute',
                            top: '5px',
                            right: '5px',
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            border: 'none',
                            background: 'rgba(23, 20, 58, 0.78)',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Target Set & Language Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                {existingSets.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>
                      Ziel-Lernset
                    </label>
                    <select
                      value={targetSetId}
                      onChange={e => {
                        const val = e.target.value;
                        setTargetSetId(val);
                        const found = existingSets.find(s => s.id === val);
                        if (found) {
                          setTitle(found.title);
                          setLanguageFrom(found.languageFrom);
                          setLanguageTo(found.languageTo);
                        } else {
                          setTitle('');
                        }
                      }}
                      className="input-field"
                      style={{ width: '100%', height: '44px', fontSize: '13.5px', fontWeight: 700 }}
                    >
                      <option value="__new__">Neues Lernset anlegen (Titel automatisch erkennen)</option>
                      {existingSets.map(set => (
                        <option key={set.id} value={set.id}>
                          Ergänzen: {set.title} ({set.entries.length} Vokabeln)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {targetSetId === '__new__' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>
                        Titel (optional – sonst aus Überschrift erkannt)
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="z. B. Englisch – Unit 4"
                        maxLength={120}
                        className="input-field"
                        style={{ width: '100%', height: '44px', fontSize: '14px', fontWeight: 600 }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>
                          Fremdsprache
                        </label>
                        <input
                          type="text"
                          list="vocab-lang-presets"
                          value={languageFrom}
                          onChange={e => setLanguageFrom(e.target.value)}
                          maxLength={40}
                          className="input-field"
                          style={{ width: '100%', height: '42px', fontSize: '13.5px', fontWeight: 600 }}
                        />
                        <datalist id="vocab-lang-presets">
                          {LANGUAGE_PRESETS.map(lang => (
                            <option key={lang} value={lang} />
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>
                          Übersetzung
                        </label>
                        <input
                          type="text"
                          value={languageTo}
                          onChange={e => setLanguageTo(e.target.value)}
                          maxLength={40}
                          className="input-field"
                          style={{ width: '100%', height: '42px', fontSize: '13.5px', fontWeight: 600 }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            /* Step 2: Review & Edit Extracted Pairs */
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.55rem' }}>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Titel des Lernsets"
                  maxLength={120}
                  className="input-field"
                  style={{ width: '100%', height: '44px', fontSize: '14.5px', fontWeight: 800 }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={languageFrom}
                    onChange={e => setLanguageFrom(e.target.value)}
                    aria-label="Ausgangssprache"
                    className="input-field"
                    style={{ width: '100%', height: '38px', fontSize: '13px', fontWeight: 700 }}
                  />
                  <input
                    type="text"
                    value={languageTo}
                    onChange={e => setLanguageTo(e.target.value)}
                    aria-label="Zielsprache"
                    className="input-field"
                    style={{ width: '100%', height: '38px', fontSize: '13px', fontWeight: 700 }}
                  />
                </div>
              </div>

              {uncertainCount > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '14px',
                    background: '#FFF4E0',
                    color: '#A85F12',
                    fontSize: '12.5px',
                    fontWeight: 700,
                  }}
                >
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>
                    {uncertainCount} {uncertainCount === 1 ? 'Eintrag ist' : 'Einträge sind'} markiert – bitte kurz prüfen.
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {entries.map((row, idx) => (
                  <div
                    key={row.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 32px',
                      gap: '0.4rem',
                      alignItems: 'center',
                      padding: '0.45rem',
                      borderRadius: '14px',
                      background: row.uncertain ? '#FFF8EB' : 'var(--color-surface-hover)',
                      border: row.uncertain ? '1.5px solid #F5A06B' : '1px solid var(--color-border)',
                    }}
                  >
                    <input
                      type="text"
                      value={row.front}
                      onChange={e => handleEntryChange(row.id, 'front', e.target.value)}
                      placeholder={`${languageFrom} #${idx + 1}`}
                      style={{
                        width: '100%',
                        minWidth: 0,
                        height: '36px',
                        padding: '0 0.6rem',
                        borderRadius: '10px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        fontSize: '13px',
                        fontWeight: 700,
                        fontFamily: 'inherit',
                      }}
                    />
                    <input
                      type="text"
                      value={row.back}
                      onChange={e => handleEntryChange(row.id, 'back', e.target.value)}
                      placeholder={`${languageTo} #${idx + 1}`}
                      style={{
                        width: '100%',
                        minWidth: 0,
                        height: '36px',
                        padding: '0 0.6rem',
                        borderRadius: '10px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        fontSize: '13px',
                        fontWeight: 600,
                        fontFamily: 'inherit',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveEntry(row.id)}
                      aria-label="Zeile löschen"
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddEmptyEntry}
                style={{
                  height: '40px',
                  borderRadius: '12px',
                  border: '1.5px dashed var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-primary)',
                  fontSize: '13px',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                }}
              >
                <Plus size={15} /> Weitere Vokabel hinzufügen
              </button>
            </>
          )}

          {error && (
            <div
              role="alert"
              style={{
                padding: '0.7rem 0.9rem',
                borderRadius: '14px',
                background: '#FDE8EF',
                color: '#D4416E',
                fontSize: '13px',
                fontWeight: 700,
                lineHeight: 1.4,
              }}
            >
              {error}
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
          {step === 'capture' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  stopLiveCamera();
                  onClose();
                }}
                disabled={isExtracting}
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
                onClick={handleAnalyze}
                disabled={photos.length === 0 || !isConfigured || isExtracting || isPreparing}
                style={{
                  flex: 1,
                  height: '48px',
                  border: 'none',
                  borderRadius: '999px',
                  cursor: photos.length > 0 && isConfigured && !isExtracting ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)',
                  color: '#FFFFFF',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  opacity: photos.length > 0 && isConfigured && !isExtracting ? 1 : 0.45,
                  boxShadow: photos.length > 0 && isConfigured && !isExtracting ? '0 8px 20px rgba(63, 52, 196, 0.28)' : 'none',
                }}
              >
                {isExtracting ? (
                  <>
                    <Loader2 size={17} style={{ animation: 'vcSpin 0.9s linear infinite' }} />
                    KI liest Vokabeln aus…
                  </>
                ) : (
                  <>
                    <Sparkles size={17} />
                    Vokabeln auslesen
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep('capture');
                  setError('');
                }}
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
                Zurück
              </button>
              <button
                type="button"
                onClick={handleCommitToDb}
                disabled={validCount === 0}
                style={{
                  flex: 1,
                  height: '48px',
                  border: 'none',
                  borderRadius: '999px',
                  cursor: validCount > 0 ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  background: 'linear-gradient(135deg, #1E9A78 0%, #4FC3A1 100%)',
                  color: '#FFFFFF',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  opacity: validCount > 0 ? 1 : 0.45,
                  boxShadow: validCount > 0 ? '0 8px 20px rgba(30, 154, 120, 0.28)' : 'none',
                }}
              >
                <Check size={17} strokeWidth={2.8} />
                {validCount} Vokabeln speichern
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes vcFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes vcSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes vcSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>,
    document.body
  );
};
