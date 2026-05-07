export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const APP_VERSION = '1.3.0';

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.3.0',
    date: '2026-05-07',
    title: 'Design Refresh & UX',
    changes: [
      'Neues Design-System: Warme Farbpalette, weiße Karten, weiche Schatten',
      'TaskCards: Avatar-Kreis, Datum (Tag+Monat), Status-Kreis, Long-Press-Menü',
      'Notizen im TaskCard-Stil (Dashboard & Notizen-Seite)',
      'TopBar mit Systemfarbe als Hintergrund, weiße Schrift',
      'Mahlzeiten „Nächste 7 Tage" im TaskCard-Stil',
      'Sidebar: Kompaktere Abstände, schmaler, aktiver Punkt weiß auf Systemfarbe',
      'Seiten nutzen jetzt volle Breite (Padding vereinheitlicht)',
      'Einstellungen: Kleinere Eingabefelder & Dropdowns',
      'Schriftgrößen in Editor & Eingabefeldern reduziert',
      'Fehlende Themenfarben ergänzt: Slate, Teal, Pink',
      'N26 Depots & Historie: Mülleimer ersetzt durch Long-Press-Menü',
      'Bugfix: Aufgaben wurden automatisch als erledigt markiert (Race Condition)',
      'Bugfix: Doppel-Tap auf Status-Kreis öffnete Bearbeiten-Menü',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-05-06',
    title: 'Profil & Tagebuch Update',
    changes: [
      'Profil: Avatar-Farbauswahl mit 12 Farben',
      'Profil: Über 90 neue Emojis in 5 Kategorien',
      'Profil: Statistiken (Tasks, Sterne, Tagebuch-Serie)',
      'Profil: Account-Info mit E-Mail-Anzeige',
      'Stimmungstagebuch: Kontext-Tags (anpassbar, eigene Emojis & Namen)',
      'Stimmungstagebuch: Analyse-Bereich (Trends, Durchschnitt, Serien)',
      'Stimmungstagebuch: Tägliche Erinnerung um 19:00 Uhr',
      'Stimmungstagebuch: Kalender-Ansicht mit Farbbalken',
      'Stimmungstagebuch: Export als PNG-Bild',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-04-15',
    title: 'Stabilitäts-Update',
    changes: [
      'Google Drive Backup & Wiederherstellung',
      'Firebase-Datenbank-Synchronisation verbessert',
      'N26 & Victron Integration optimiert',
      'Wallbox-Steuerung erweitert',
      'Allgemeine Fehlerbehebungen und Performance-Verbesserungen',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-03-20',
    title: 'Familien-Finanzen & E-Diary',
    changes: [
      'Budget-Übersicht mit monatlichem Überschuss',
      'Ausgaben-Tracker mit Kategorien',
      'N26 Bank-Integration',
      'Stimmungstagebuch (E-Diary) eingeführt',
      'Wallbox-Monitoring & Steuerung',
      'Mahlzeiten-Planung mit Anfrage-System',
    ],
  },
];

export function getLastSeenVersion(): string {
  return localStorage.getItem('family_hub_last_seen_version') || '0.0.0';
}

export function setLastSeenVersion(version: string): void {
  localStorage.setItem('family_hub_last_seen_version', version);
}

export function isNewVersion(): boolean {
  return getLastSeenVersion() !== APP_VERSION;
}

export function getCurrentChangelog(): ChangelogEntry | undefined {
  return CHANGELOG.find(e => e.version === APP_VERSION);
}

export function getRecentChangelog(count: number = 2): ChangelogEntry[] {
  return CHANGELOG.slice(0, count);
}
