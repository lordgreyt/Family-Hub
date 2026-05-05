/**
 * Backup Service — täglicher automatischer Backup-Job für Family Hub
 *
 * Wird beim App-Start initialisiert. Prüft ob seit dem letzten Backup
 * mehr als 24h vergangen sind und führt ggf. ein neues durch.
 */

import { mockDb } from './mockDb';
import { isDriveConnected, uploadBackup, cleanupOldBackups, listBackups, getBackupContent } from './googleDrive';

const LAST_BACKUP_KEY = 'family_hub_last_backup';
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Stunden

let isRunning = false;

export interface BackupResult {
  success: boolean;
  fileName?: string;
  fileId?: string;
  error?: string;
  timestamp: string;
}

/**
 * Prüft ob ein Backup fällig ist (mehr als 24h seit letztem Erfolg).
 */
export function isBackupDue(): boolean {
  const lastRaw = localStorage.getItem(LAST_BACKUP_KEY);
  if (!lastRaw) return true;
  try {
    const last = JSON.parse(lastRaw);
    return Date.now() - last.timestamp > BACKUP_INTERVAL_MS;
  } catch {
    return true;
  }
}

/**
 * Letztes erfolgreiches Backup (Zeitstempel und Dateiname).
 */
export function getLastBackupInfo(): { timestamp: number; fileName: string } | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Führt ein vollständiges Backup durch:
 * 1. Exportiert alle Daten via mockDb.exportAllData()
 * 2. Lädt sie nach Google Drive hoch (Backup_App-Ordner)
 * 3. Räumt Backups älter als 30 Tage auf
 */
export async function runBackup(): Promise<BackupResult> {
  if (isRunning) {
    return { success: false, error: 'Backup läuft bereits.', timestamp: new Date().toISOString() };
  }

  isRunning = true;

  try {
    if (!isDriveConnected()) {
      return { success: false, error: 'Google Drive nicht verbunden.', timestamp: new Date().toISOString() };
    }

    // 1. Export
    const data = mockDb.exportAllData();
    const jsonContent = JSON.stringify(data, null, 2);

    // 2. Dateiname
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `family-hub-backup-${today}.json`;

    // 3. Upload
    const result = await uploadBackup(fileName, jsonContent);

    // 4. Backup-Zeitstempel speichern
    const backupInfo = { timestamp: Date.now(), fileName };
    localStorage.setItem(LAST_BACKUP_KEY, JSON.stringify(backupInfo));

    // 5. Alte Backups aufräumen (Fire & Forget)
    cleanupOldBackups(30).catch(() => {});

    console.log(`Backup erfolgreich: ${fileName} (Drive ID: ${result.fileId})`);

    return {
      success: true,
      fileName: result.fileName,
      fileId: result.fileId,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('Backup fehlgeschlagen:', err);
    return { success: false, error: err.message, timestamp: new Date().toISOString() };
  } finally {
    isRunning = false;
  }
}

export interface DriveBackupEntry {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

/**
 * Ruft die letzten N Backups von Google Drive ab.
 */
export async function fetchDriveBackups(maxResults: number = 5): Promise<DriveBackupEntry[]> {
  if (!isDriveConnected()) {
    throw new Error('Google Drive nicht verbunden.');
  }
  return listBackups(maxResults);
}

export interface RestoreResult {
  success: boolean;
  restoredCount?: number;
  error?: string;
  fileName?: string;
}

/**
 * Stellt ein Backup von Google Drive wieder her.
 * Lädt den Inhalt der Datei herunter und importiert alle Daten.
 */
export async function restoreFromDrive(fileId: string, fileName: string): Promise<RestoreResult> {
  try {
    const content = await getBackupContent(fileId);
    const data = JSON.parse(content);
    const count = mockDb.importAllData(data);
    return { success: true, restoredCount: count, fileName };
  } catch (err: any) {
    return { success: false, error: err.message || 'Restore fehlgeschlagen', fileName };
  }
}

/**
 * Initialisiert den Backup-Service.
 * Prüft sofort und startet dann einen stündlichen Check.
 * Gibt eine Cleanup-Funktion zurück.
 */
export function initBackupService(): () => void {
  // Sofort prüfen (mit 5s Verzögerung, damit die App zuerst geladen ist)
  setTimeout(() => {
    if (isBackupDue() && isDriveConnected()) {
      runBackup().catch(() => {});
    }
  }, 5000);

  // Stündlich prüfen
  const interval = setInterval(() => {
    if (isBackupDue() && isDriveConnected()) {
      runBackup().catch(() => {});
    }
  }, 60 * 60 * 1000);

  return () => clearInterval(interval);
}
