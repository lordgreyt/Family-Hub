import { mockDb, type PaperlessSettings } from './mockDb';

// --- Paperless NGX Document Types ---

export interface PaperlessDocument {
  id: number;
  correspondent: number | null;
  document_type: number | null;
  title: string;
  content: string;
  tags: number[];
  created: string;
  created_date: string;
  modified: string;
  added: string;
  archive_serial_number: number | null;
  original_file_name: string;
  archived_file_name: string | null;
  checksum: string;
  storage_path: string | null;
}

export interface PaperlessSearchResult {
  count: number;
  next: string | null;
  previous: string | null;
  results: PaperlessDocument[];
}

interface PaperlessTag { id: number; name: string; color: string; }
interface PaperlessCorrespondent { id: number; name: string; }
interface PaperlessDocType { id: number; name: string; }

// --- Settings Helper ---

function getSettings(): PaperlessSettings {
  return mockDb.getPaperlessSettings();
}

function isProxyMode(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

/**
 * Unified fetch for Paperless API.
 * On HTTPS (Vercel): routes through /api/paperless/proxy
 * On HTTP (localhost dev): direct connection
 */
async function paperlessFetch(
  apiPath: string,
  options: {
    method?: string;
    body?: BodyInit | null;
    overrides?: PaperlessSettings;
  } = {}
): Promise<Response | null> {
  const settings = options.overrides || getSettings();
  if (!settings.url || !settings.token) return null;
  if (!options.overrides && !settings.enabled) return null;

  const cleanPath = apiPath.replace(/^\//, '');

  if (isProxyMode()) {
    // Vercel HTTPS → proxy to avoid mixed-content block
    return fetch(`/api/paperless/proxy?path=${encodeURIComponent(cleanPath)}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Paperless-Url': settings.url,
        'X-Paperless-Token': settings.token,
      },
      body: options.body || undefined,
    });
  }

  // Localhost dev → direct HTTP connection
  let cleanUrl = settings.url.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'http://' + cleanUrl;

  return fetch(`${cleanUrl}/api/${cleanPath}`, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Token ${settings.token}`,
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body || undefined,
  });
}

// --- API Functions ---

export async function searchDocuments(
  query: string = '',
  page: number = 1,
  pageSize: number = 25
): Promise<{ results: PaperlessDocument[]; count: number } | null> {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));

  try {
    const res = await paperlessFetch(`/documents/?${params}`);
    if (!res || !res.ok) {
      console.error(`Paperless search error ${res?.status}`);
      return null;
    }
    const data: PaperlessSearchResult = await res.json();
    return { results: data.results, count: data.count };
  } catch (err) {
    console.error('Paperless search fetch error:', err);
    return null;
  }
}

export async function getDocument(id: number): Promise<PaperlessDocument | null> {
  try {
    const res = await paperlessFetch(`/documents/${id}/`);
    if (!res || !res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Paperless getDocument error:', err);
    return null;
  }
}

export function getThumbnailUrl(id: number): string | null {
  if (isProxyMode()) {
    return `/api/paperless/proxy?path=${encodeURIComponent(`documents/${id}/thumb/`)}`;
  }
  const settings = getSettings();
  if (!settings.url) return null;
  let cleanUrl = settings.url.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'http://' + cleanUrl;
  return `${cleanUrl}/api/documents/${id}/thumb/`;
}

export function getDownloadUrl(id: number, original: boolean = false): string | null {
  if (isProxyMode()) {
    const path = `documents/${id}/download/${original ? '?original=true' : ''}`;
    return `/api/paperless/proxy?path=${encodeURIComponent(path)}`;
  }
  const settings = getSettings();
  if (!settings.url) return null;
  let cleanUrl = settings.url.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'http://' + cleanUrl;
  let url = `${cleanUrl}/api/documents/${id}/download/`;
  if (original) url += '?original=true';
  return url;
}

export async function getThumbnailDataUrl(id: number): Promise<string | null> {
  try {
    const res = await paperlessFetch(`/documents/${id}/thumb/`);
    if (!res || !res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Paperless getThumbnail error:', err);
    return null;
  }
}

export async function uploadDocument(
  file: File,
  title?: string,
  correspondentId?: number,
  docTypeId?: number,
  tagIds?: number[],
  created?: string
): Promise<boolean> {
  const formData = new FormData();
  formData.append('document', file);
  if (title) formData.append('title', title);
  if (correspondentId !== undefined) formData.append('correspondent', String(correspondentId));
  if (docTypeId !== undefined) formData.append('document_type', String(docTypeId));
  if (tagIds?.length) {
    tagIds.forEach(id => formData.append('tags', String(id)));
  }
  if (created) formData.append('created', created);

  try {
    // Note: multipart upload through Vercel proxy may hit size limits (~4.5MB hobby)
    const res = await paperlessFetch('/documents/post_document/', {
      method: 'POST',
      body: formData,
    });
    if (!res || !res.ok) {
      console.error(`Paperless upload error ${res?.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Paperless upload fetch error:', err);
    return false;
  }
}

// --- Corresponent, Document Type, Tag helpers ---

async function fetchList<T>(endpoint: string): Promise<T[]> {
  try {
    const res = await paperlessFetch(endpoint);
    if (!res || !res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch { return []; }
}

export async function getCorrespondents(): Promise<PaperlessCorrespondent[]> {
  return fetchList<PaperlessCorrespondent>('/correspondents/');
}

export async function getDocumentTypes(): Promise<PaperlessDocType[]> {
  return fetchList<PaperlessDocType>('/document_types/');
}

export async function getTags(): Promise<PaperlessTag[]> {
  return fetchList<PaperlessTag>('/tags/');
}

// --- Connection Test ---

export async function testConnection(settingsOverride?: PaperlessSettings): Promise<{ ok: boolean; error?: string }> {
  const settings = settingsOverride || getSettings();
  if (!settings.url || !settings.token) {
    return { ok: false, error: 'Paperless nicht konfiguriert (URL oder Token fehlt)' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await paperlessFetch('/documents/?page_size=1', { overrides: settingsOverride });
    clearTimeout(timeout);

    if (!res) {
      return { ok: false, error: 'Keine Antwort vom Server' };
    }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: 'Authentifizierung fehlgeschlagen. Token prüfen.' };
      }
      return { ok: false, error: `Server antwortet mit Status ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Verbindung zum Server nicht möglich (Timeout). Bitte prüfe die URL.' };
    }
    return { ok: false, error: `Netzwerkfehler: ${err.message}` };
  }
}
