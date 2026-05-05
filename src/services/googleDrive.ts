/**
 * Google Drive Service — OAuth + Datei-Upload für Family Hub Backups
 *
 * Benötigt: Google Cloud Console → OAuth 2.0 Client ID (Web Application)
 * Scopes: drive.file (nur von der App erstellte Dateien)
 */

const DRIVE_API_BASE = 'https://www.googleapis.com';
const BACKUP_FOLDER_NAME = 'Backup_App';
const TOKEN_STORAGE_KEY = 'family_hub_google_token';

// Muss in der Google Cloud Console erstellt werden — hier eintragen:
let GOOGLE_CLIENT_ID = '';


export function setGoogleClientId(id: string) {
  GOOGLE_CLIENT_ID = id;
  localStorage.setItem('family_hub_google_client_id', id);
}

export function getGoogleClientId(): string {
  if (!GOOGLE_CLIENT_ID) {
    GOOGLE_CLIENT_ID = localStorage.getItem('family_hub_google_client_id') || '';
  }
  return GOOGLE_CLIENT_ID;
}

// ---- Token Management ----

interface TokenInfo {
  access_token: string;
  expires_at: number; // epoch ms
}

function getStoredToken(): TokenInfo | null {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const token = JSON.parse(raw) as TokenInfo;
    if (Date.now() > token.expires_at - 60000) return null; // expired with 1min buffer
    return token;
  } catch {
    return null;
  }
}

function storeToken(token: TokenInfo) {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
}

function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

// ---- OAuth Flow ----

/**
 * Fordert ein Access Token via Google Identity Services an.
 * Öffnet ein Popup, falls der User noch nicht authorisiert hat.
 */
// Wartet bis das Google GIS Script geladen ist (max 5s)
async function waitForGis(): Promise<any> {
  const maxWait = 5000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const gis = (window as any).google?.accounts?.oauth2;
    if (gis) return gis;
    await new Promise(r => setTimeout(r, 200));
  }
  return null;
}

export async function requestAccessToken(): Promise<string> {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error('Google Client ID nicht konfiguriert.');

  // Prüfe vorhandenes Token
  const stored = getStoredToken();
  if (stored) return stored.access_token;

  // Warte auf Google GIS Script
  const gis = await waitForGis();
  if (!gis) {
    throw new Error('Google Services konnten nicht geladen werden. Bitte Seite neu laden und sicherstellen, dass du mit dem Internet verbunden bist.');
  }

  // Client ID bereinigen
  const cleanId = clientId.trim();
  if (cleanId !== clientId) {
    setGoogleClientId(cleanId);
  }

  return new Promise((resolve, reject) => {

    const client = gis.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(`Google Auth fehlgeschlagen: ${response.error}`));
        } else {
          const token: TokenInfo = {
            access_token: response.access_token,
            expires_at: Date.now() + (response.expires_in || 3600) * 1000,
          };
          storeToken(token);
          resolve(token.access_token);
        }
      },
    });

    client.requestAccessToken();
  });
}

/**
 * Trennt die Google Drive Verbindung (löscht gespeichertes Token).
 */
export function disconnectDrive() {
  clearToken();
  const token = getStoredToken();
  if (token) {
    // Revoke bei Google
    fetch(`https://oauth2.googleapis.com/revoke?token=${token.access_token}`, { method: 'POST' })
      .catch(() => {});
  }
}

/**
 * Prüft ob der User aktuell mit Google Drive verbunden ist.
 */
export function isDriveConnected(): boolean {
  return getStoredToken() !== null && getGoogleClientId() !== '';
}

// ---- Drive API ----

/**
 * Findet oder erstellt den Backup_App-Ordner.
 */
async function findOrCreateFolder(accessToken: string): Promise<string> {
  // Suche vorhandenen Ordner
  const searchRes = await fetch(
    `${DRIVE_API_BASE}/drive/v3/files?q=name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!searchRes.ok) throw new Error(`Drive-Suche fehlgeschlagen: ${searchRes.status}`);

  const searchData = await searchRes.json();
  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }

  // Erstelle neuen Ordner
  const createRes = await fetch(`${DRIVE_API_BASE}/drive/v3/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) throw new Error(`Ordner-Erstellung fehlgeschlagen: ${createRes.status}`);

  const createData = await createRes.json();
  return createData.id;
}

/**
 * Lädt eine Datei in den Backup_App-Ordner hoch.
 * @param fileName - Name der Datei (z.B. "family-hub-backup-2026-05-05.json")
 * @param content - Inhalt als String (JSON)
 */
export async function uploadBackup(fileName: string, content: string): Promise<{ fileId: string; fileName: string }> {
  const accessToken = await requestAccessToken();
  const folderId = await findOrCreateFolder(accessToken);

  // Multipart-Upload: Metadaten + Dateiinhalt
  const boundary = 'fh_backup_boundary_' + Date.now();
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json',
  });

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(`${DRIVE_API_BASE}/upload/drive/v3/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Upload fehlgeschlagen (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return { fileId: data.id, fileName: data.name };
}

/**
 * Listet die letzten N Backup-Dateien aus dem Backup_App-Ordner auf.
 */
export async function listBackups(maxResults: number = 5): Promise<{ id: string; name: string; createdTime: string }[]> {
  const accessToken = await requestAccessToken();
  const folderId = await findOrCreateFolder(accessToken);

  const listRes = await fetch(
    `${DRIVE_API_BASE}/drive/v3/files?q='${folderId}' in parents and mimeType='application/json' and trashed=false&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) throw new Error(`Backup-Liste konnte nicht geladen werden: ${listRes.status}`);
  const listData = await listRes.json();
  return listData.files || [];
}

/**
 * Lädt den Inhalt einer Backup-Datei von Google Drive herunter.
 */
export async function getBackupContent(fileId: string): Promise<string> {
  const accessToken = await requestAccessToken();

  const res = await fetch(
    `${DRIVE_API_BASE}/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Backup-Download fehlgeschlagen: ${res.status}`);
  return res.text();
}

/**
 * Löscht alte Backups aus dem Backup_App-Ordner (älter als keepDays Tage).
 */
export async function cleanupOldBackups(keepDays: number = 30): Promise<number> {
  try {
    const accessToken = await requestAccessToken();
    const folderId = await findOrCreateFolder(accessToken);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);
    const cutoffISO = cutoff.toISOString();

    const listRes = await fetch(
      `${DRIVE_API_BASE}/drive/v3/files?q='${folderId}' in parents and mimeType='application/json' and trashed=false&fields=files(id,name,createdTime)&pageSize=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listRes.ok) return 0;
    const listData = await listRes.json();
    const oldFiles = (listData.files || []).filter((f: any) => f.createdTime < cutoffISO);

    let deleted = 0;
    for (const file of oldFiles) {
      const delRes = await fetch(`${DRIVE_API_BASE}/drive/v3/files/${file.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (delRes.ok) deleted++;
    }

    return deleted;
  } catch {
    return 0;
  }
}
