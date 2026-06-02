import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb, type PaperlessSettings } from '../services/mockDb';
import {
  searchDocuments,
  getThumbnailDataUrl,
  getDownloadUrl,
  uploadDocument,
  testConnection,
  getCorrespondents,
  getDocumentTypes,
  getTags,
  type PaperlessDocument,
} from '../services/paperless';
import {
  Search, Upload, Download, FileText, Settings, X, Save,
  Check, AlertTriangle, Loader2, Plus, ChevronLeft, ChevronRight, Image, ExternalLink, Wifi, WifiOff,
} from 'lucide-react';

export const Paperless = () => {
  const { user } = useAuth();

  // Settings
  const [settings, setSettings] = useState<PaperlessSettings>({ url: '192.168.178.184:8000', token: '', enabled: false });
  const [showSettings, setShowSettings] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Search
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState<PaperlessDocument[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  // Thumbnails cache
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});

  // Upload
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Preview
  const [previewDoc, setPreviewDoc] = useState<PaperlessDocument | null>(null);

  // Metadata for upload dropdowns
  const [correspondents, setCorrespondents] = useState<{ id: number; name: string }[]>([]);
  const [docTypes, setDocTypes] = useState<{ id: number; name: string }[]>([]);
  const [availableTags, setAvailableTags] = useState<{ id: number; name: string }[]>([]);

  // Load settings on mount
  useEffect(() => {
    const saved = mockDb.getPaperlessSettings();
    // Merge: keep defaults if saved values are empty
    setSettings({
      url: saved.url || '192.168.178.184:8000',
      token: saved.token || '',
      enabled: saved.enabled || false,
    });
  }, []);

  // Load metadata once settings are configured
  useEffect(() => {
    if (!settings.enabled || !settings.url || !settings.token) return;
    Promise.all([
      getCorrespondents(),
      getDocumentTypes(),
      getTags(),
    ]).then(([c, d, t]) => {
      setCorrespondents(c);
      setDocTypes(d);
      setAvailableTags(t);
    }).catch(() => {});
  }, [settings.enabled, settings.url, settings.token]);

  // Search
  const doSearch = useCallback(async (p: number = 1) => {
    if (!settings.enabled || !settings.url || !settings.token) return;
    setLoading(true);
    const result = await searchDocuments(query, p, pageSize);
    if (result) {
      setDocuments(result.results);
      setTotalCount(result.count);
      setPage(p);
    }
    setLoading(false);
  }, [query, settings]);

  useEffect(() => {
    if (settings.enabled) doSearch(1);
  }, [settings.enabled]); // initial load only

  // Load thumbnails for visible docs
  useEffect(() => {
    let cancelled = false;
    const loadThumbs = async () => {
      const newThumbs: Record<number, string> = {};
      for (const doc of documents) {
        if (thumbnails[doc.id]) continue;
        const dataUrl = await getThumbnailDataUrl(doc.id);
        if (!cancelled && dataUrl) newThumbs[doc.id] = dataUrl;
      }
      if (!cancelled) setThumbnails(prev => ({ ...prev, ...newThumbs }));
    };
    if (documents.length > 0) loadThumbs();
    return () => { cancelled = true; };
  }, [documents]);

  // Settings
  const handleSaveSettings = () => {
    mockDb.savePaperlessSettings(settings);
    setShowSettings(false);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    // Use current form values directly, not saved settings
    const result = await testConnection(settings);
    setTestResult(result);
    setTesting(false);
  };

  // Upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      // Auto-fill title from filename without extension
      const name = file.name.replace(/\.[^.]+$/, '');
      setUploadTitle(name);
      setUploadError('');
      setUploadSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);
    const ok = await uploadDocument(uploadFile, uploadTitle || undefined);
    if (ok) {
      setUploadSuccess(true);
      setUploadFile(null);
      setUploadTitle('');
      doSearch(page);
    } else {
      setUploadError('Upload fehlgeschlagen. Bitte prüfe die Verbindung zu Paperless.');
    }
    setUploading(false);
  };

  // Download
  const handleDownload = (doc: PaperlessDocument) => {
    const url = getDownloadUrl(doc.id);
    if (!url) return;
    const headers = settings.token ? { 'Authorization': `Token ${settings.token}` } : {};
    // Open in new tab — browser handles auth via URL (token in header isn't possible for <a>)
    // Instead, fetch and create blob URL
    fetch(url, { headers })
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = doc.original_file_name || `${doc.title}.pdf`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(err => console.error('Download error:', err));
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  if (user?.isChild) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
        <FileText size={48} />
        <p>Paperless ist nur für Eltern verfügbar.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, margin: 0 }}>Paperless</h2>
          <p style={{ margin: '0.15rem 0 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            Dokumenten-Management
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {settings.enabled && (
            <button
              onClick={() => setShowUpload(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: 'var(--font-sm)' }}
            >
              <Upload size={16} /> Hochladen
            </button>
          )}
          <button
            onClick={() => { setShowSettings(!showSettings); setTestResult(null); }}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: 'var(--font-sm)' }}
          >
            <Settings size={16} /> {settings.enabled ? 'Konfiguriert' : 'Einrichten'}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 600 }}>Paperless NGX Verbindung</h3>
          <div>
            <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
              Server URL
            </label>
            <input
              type="text"
              placeholder="z.B. http://192.168.178.100:8000"
              className="input-field"
              value={settings.url}
              onChange={e => setSettings(s => ({ ...s, url: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
              API Token
            </label>
            <input
              type="password"
              placeholder="Token aus Paperless Admin-Oberfläche"
              className="input-field"
              value={settings.token}
              onChange={e => setSettings(s => ({ ...s, token: e.target.value }))}
            />
            <p style={{ margin: '0.2rem 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
              In Paperless unter Administration → API-Token abrufen
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 'var(--font-sm)' }}>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={e => setSettings(s => ({ ...s, enabled: e.target.checked }))}
              />
              Aktiviert
            </label>
          </div>

          {testResult && (
            <div style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: testResult.ok ? 'var(--color-success-bg, #dcfce7)' : 'var(--color-danger-bg, #fee2e2)',
              color: testResult.ok ? 'var(--color-success, #166534)' : 'var(--color-danger, #991b1b)',
            }}>
              {testResult.ok ? <Check size={16} /> : <AlertTriangle size={16} />}
              {testResult.ok ? 'Verbindung erfolgreich!' : testResult.error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              onClick={handleTestConnection}
              disabled={testing || !settings.url || !settings.token}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: 'var(--font-sm)' }}
            >
              {testing ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
              Verbindung testen
            </button>
            <button
              onClick={handleSaveSettings}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: 'var(--font-sm)' }}
            >
              <Save size={16} /> Speichern
            </button>
          </div>
        </div>
      )}

      {/* Not configured state */}
      {!settings.enabled && !showSettings && (
        <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <FileText size={48} color="var(--color-text-muted)" />
          <h3 style={{ margin: '0.75rem 0 0.25rem 0', fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-text)' }}>
            Paperless NGX nicht konfiguriert
          </h3>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            Klicke auf &quot;Einrichten&quot; um die Verbindung zu deinem Paperless-Server herzustellen.
          </p>
        </div>
      )}

      {/* Connected state */}
      {settings.enabled && !showSettings && (
        <>
          {/* Search Bar */}
          <form onSubmit={e => { e.preventDefault(); doSearch(1); }} style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                placeholder="Dokumente durchsuchen..."
                className="input-field"
                style={{ paddingLeft: '2.5rem' }}
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.5rem 1.25rem', fontSize: 'var(--font-sm)' }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Suchen'}
            </button>
          </form>

          {/* Connection indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
            {settings.url ? (
              <><Wifi size={12} color="var(--color-success, #16a34a)" /> {settings.url}</>
            ) : (
              <><WifiOff size={12} color="var(--color-danger)" /> Nicht verbunden</>
            )}
            {totalCount > 0 && <span>&bull; {totalCount} Dokumente</span>}
          </div>

          {/* Document Grid */}
          {loading && documents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Loader2 size={32} className="animate-spin" color="var(--color-text-muted)" />
            </div>
          ) : documents.length === 0 ? (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
              <Search size={36} color="var(--color-text-muted)" />
              <p style={{ margin: '0.5rem 0 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
                {query ? 'Keine Dokumente gefunden.' : 'Beginne mit einer Suche oder lade Dokumente hoch.'}
              </p>
            </div>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '0.75rem',
              }}>
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="glass-panel"
                    style={{
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-lg)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
                  >
                    {/* Thumbnail */}
                    <div
                      onClick={() => setPreviewDoc(doc)}
                      style={{
                        width: '100%',
                        height: '160px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-surface-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {thumbnails[doc.id] ? (
                        <img src={thumbnails[doc.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <FileText size={40} color="var(--color-text-muted)" />
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0,
                        fontSize: 'var(--font-sm)',
                        fontWeight: 600,
                        color: 'var(--color-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {doc.title || doc.original_file_name || 'Unbenannt'}
                      </p>
                      <p style={{
                        margin: '0.15rem 0 0 0',
                        fontSize: 'var(--font-xs)',
                        color: 'var(--color-text-muted)',
                      }}>
                        {new Date(doc.created).toLocaleDateString('de-DE')}
                      </p>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button
                        onClick={e => { e.stopPropagation(); setPreviewDoc(doc); }}
                        className="btn btn-secondary"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', padding: '0.4rem 0.5rem', fontSize: 'var(--font-xs)' }}
                      >
                        <Image size={14} /> Vorschau
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDownload(doc); }}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem 0.6rem', fontSize: 'var(--font-xs)' }}
                        title="Herunterladen"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={() => doSearch(page - 1)}
                    disabled={page <= 1}
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.75rem', fontSize: 'var(--font-sm)' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>
                    Seite {page} von {totalPages}
                  </span>
                  <button
                    onClick={() => doSearch(page + 1)}
                    disabled={page >= totalPages}
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.75rem', fontSize: 'var(--font-sm)' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div
          onClick={() => setShowUpload(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            padding: '1rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="glass-panel"
            style={{ padding: '1.5rem', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 700 }}>Dokument hochladen</h3>
              <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* File picker */}
              <div>
                <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Datei
                </label>
                <input
                  type="file"
                  onChange={handleFileSelect}
                  style={{ fontSize: 'var(--font-sm)' }}
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.tiff,.tif,.doc,.docx,.xls,.xlsx,.ods,.csv,.txt"
                />
                {uploadFile && (
                  <p style={{ margin: '0.3rem 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                    {(uploadFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                )}
              </div>

              {/* Title */}
              <div>
                <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Titel (optional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="Dokumenttitel"
                />
              </div>

              {/* Status */}
              {uploadSuccess && (
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-success-bg, #dcfce7)', color: 'var(--color-success, #166534)', fontSize: 'var(--font-sm)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Check size={16} /> Dokument erfolgreich hochgeladen!
                </div>
              )}
              {uploadError && (
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-danger-bg, #fee2e2)', color: 'var(--color-danger, #991b1b)', fontSize: 'var(--font-sm)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertTriangle size={16} /> {uploadError}
                </div>
              )}

              {/* Submit */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowUpload(false)} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-sm)' }}>
                  Abbrechen
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-sm)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Hochladen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div
          onClick={() => setPreviewDoc(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
            padding: '1rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="glass-panel"
            style={{ padding: '1.5rem', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 700 }}>{previewDoc.title || 'Unbenannt'}</h3>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                  {previewDoc.original_file_name} &bull; {new Date(previewDoc.created).toLocaleDateString('de-DE')}
                </p>
              </div>
              <button onClick={() => setPreviewDoc(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Full-size thumbnail */}
            <div style={{
              width: '100%',
              minHeight: '300px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: '1px solid var(--color-border)',
            }}>
              {thumbnails[previewDoc.id] ? (
                <img src={thumbnails[previewDoc.id]} alt="" style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }} />
              ) : (
                <FileText size={80} color="var(--color-text-muted)" />
              )}
            </div>

            {/* OCR Content snippet */}
            {previewDoc.content && (
              <div>
                <p style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', margin: '0 0 0.25rem 0' }}>OCR-Text (Auszug)</p>
                <div style={{
                  fontSize: 'var(--font-xs)',
                  color: 'var(--color-text-muted)',
                  backgroundColor: 'var(--color-surface-muted)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.4,
                }}>
                  {previewDoc.content.substring(0, 500)}{previewDoc.content.length > 500 ? '...' : ''}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleDownload(previewDoc)}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: 'var(--font-sm)' }}
              >
                <Download size={16} /> Herunterladen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
