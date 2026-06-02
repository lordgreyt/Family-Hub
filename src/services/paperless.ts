import { mockDb, type PaperlessSettings } from './mockDb';

// --- Paperless NGX Document Types ---

export interface PaperlessDocument {
  id: number;
  correspondent: number | null;
  document_type: number | null;
  title: string;
  content: string;        // OCR text
  tags: number[];
  created: string;        // ISO date
  created_date: string;   // ISO date
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

function buildUrl(path: string, overrides?: PaperlessSettings): string | null {
  const settings = overrides || getSettings();
  if (!settings.url || !settings.token) return null;
  if (!overrides && !settings.enabled) return null;
  let cleanUrl = settings.url.replace(/\/+$/, '');
  // Ensure protocol is present, default to http://
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = 'http://' + cleanUrl;
  }
  return `${cleanUrl}${path}`;
}

function authHeaders(overrides?: PaperlessSettings): Record<string, string> | null {
  const settings = overrides || getSettings();
  if (!settings.token) return null;
  return { 'Authorization': `Token ${settings.token}` };
}

// --- API Functions ---

export async function searchDocuments(
  query: string = '',
  page: number = 1,
  pageSize: number = 25
): Promise<{ results: PaperlessDocument[]; count: number } | null> {
  const url = buildUrl('/api/documents/');
  const headers = authHeaders();
  if (!url || !headers) return null;

  const params = new URLSearchParams();
  if (query) params.set('query', query);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));

  try {
    const res = await fetch(`${url}?${params}`, { headers });
    if (!res.ok) {
      console.error(`Paperless search error ${res.status}: ${res.statusText}`);
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
  const url = buildUrl(`/api/documents/${id}/`);
  const headers = authHeaders();
  if (!url || !headers) return null;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Paperless getDocument error:', err);
    return null;
  }
}

export function getThumbnailUrl(id: number): string | null {
  const url = buildUrl(`/api/documents/${id}/thumb/`);
  return url;
}

export function getDownloadUrl(id: number, original: boolean = false): string | null {
  const url = buildUrl(`/api/documents/${id}/download/`);
  if (url && original) return `${url}?original=true`;
  return url;
}

export async function getThumbnailDataUrl(id: number): Promise<string | null> {
  const url = getThumbnailUrl(id);
  const headers = authHeaders();
  if (!url || !headers) return null;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
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
  created?: string  // ISO date string
): Promise<boolean> {
  const url = buildUrl('/api/documents/post_document/');
  const headers = authHeaders();
  if (!url || !headers) return false;

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
    const res = await fetch(url, {
      method: 'POST',
      headers,  // FormData sets its own Content-Type; don't override
      body: formData,
    });
    if (!res.ok) {
      console.error(`Paperless upload error ${res.status}: ${res.statusText}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Paperless upload fetch error:', err);
    return false;
  }
}

// --- Corresponent, Document Type, Tag helpers (for upload form dropdowns) ---

async function fetchList<T>(endpoint: string): Promise<T[]> {
  const url = buildUrl(endpoint);
  const headers = authHeaders();
  if (!url || !headers) return [];
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch { return []; }
}

export async function getCorrespondents(): Promise<PaperlessCorrespondent[]> {
  return fetchList<PaperlessCorrespondent>('/api/correspondents/');
}

export async function getDocumentTypes(): Promise<PaperlessDocType[]> {
  return fetchList<PaperlessDocType>('/api/document_types/');
}

export async function getTags(): Promise<PaperlessTag[]> {
  return fetchList<PaperlessTag>('/api/tags/');
}

// --- Connection Test ---

export async function testConnection(settingsOverride?: PaperlessSettings): Promise<{ ok: boolean; error?: string }> {
  const url = buildUrl('/api/documents/?page_size=1', settingsOverride);
  const headers = authHeaders(settingsOverride);
  if (!url || !headers) return { ok: false, error: 'Paperless nicht konfiguriert (URL oder Token fehlt)' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: `Authentifizierung fehlgeschlagen. Token prüfen. (URL: ${url})` };
      }
      return { ok: false, error: `Server antwortet mit Status ${res.status} (URL: ${url})` };
    }
    return { ok: true };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Verbindung zum Server nicht möglich (Timeout). Bitte prüfe die URL.' };
    }
    return { ok: false, error: `Netzwerkfehler: ${err.message}` };
  }
}
