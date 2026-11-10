export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const APP_VERSION = '1.5.2';

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.5.2',
    date: '2026-11-10',
    title: 'Wochen-Sterne',
    changes: [
      'Neue Wochenaufgaben je Kind: Aufgabe eintragen, Sternezahl festlegen, mit dem Schalter ein- und ausschalten',
      'Jeden Sonntag um 18:00 Uhr werden alle aktiven Aufgaben automatisch als Sterne gebucht – zusätzlich zu allen anderen Sternen',
      'Kinder sehen ihre Wochenaufgaben samt Summe und dem nächsten Buchungstermin',
      'Gebuchte Wochenaufgaben erscheinen als eine Sammelbuchung in der Sterne-Historie und lösen eine Gutschrift-Meldung aus',
      'Verpasste Buchungen werden beim nächsten Öffnen der App nachgeholt – pro Woche und Kind genau einmal',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-11-09',
    title: 'Einkaufsliste als Kacheln',
    changes: [
      'Artikel erscheinen als quadratische Kacheln mit Icon und Namen, nach Kategorien gruppiert',
      'Menge und Einheit stehen als kleine Marke in der Ecke der Kachel',
      'Tippen auf eine Kachel fragt die Menge ab und bucht in den Vorrat; Bearbeiten und Entfernen im selben Fenster',
      'Erledigte Artikel erscheinen ebenfalls als Kacheln, Tippen macht das Abhaken rückgängig',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-11-09',
    title: 'Vorrat & Einkaufslisten',
    changes: [
      'Neuer Vorrat: Bestand an Lebensmitteln und Haushaltsartikeln mit Lagerort, Mindestbestand, MHD und Barcode',
      'Katalog mit knapp 200 vorbefüllten Artikeln samt Icons zum schnellen Anlegen',
      'Mehrere Einkaufslisten, z. B. eine pro Laden, nach Kategorien sortiert',
      'Beim Abhaken wird die gekaufte Menge abgefragt und der Vorrat automatisch aufgefüllt – inklusive Rückgängig',
      'Artikel mit niedrigem Vorrat lassen sich mit einem Tipp auf die Einkaufsliste setzen',
      'Unterschreitet ein Artikel den Mindestbestand, landet er automatisch auf der Einkaufsliste (Liste pro Artikel wählbar)',
      'Verlauf im Vorrat: wer wann was eingelagert oder entnommen hat – aus der App, vom Einkauf und vom Scanner',
      'Neu gescannt: unbekannte Barcodes vom Küchenscanner landen in einem Eingang und lassen sich anlegen oder zuordnen',
      'Schnittstelle für den Küchenscanner (ESP32) mit Geräte-Token und doppelsicherer Buchung',
      'Startseite zeigt knappe und bald ablaufende Artikel sowie Vorrats-Buchungen bei den letzten Ereignissen',
    ],
  },
  {
    version: '1.4.4',
    date: '2026-11-04',
    title: 'N26: Monatsbuchung komplett zurücknehmen',
    changes: [
      'Einstellungen zeigen die letzte Monatsbuchung mit Datum, Anzahl Depots und Gesamtbetrag',
      'Mit „Komplett zurücknehmen“ wird der ganze Lauf über alle Depots auf einen Schlag entfernt',
      'Einzeln gebuchte Beträge bleiben dabei erhalten',
    ],
  },
  {
    version: '1.4.3',
    date: '2026-11-04',
    title: 'N26: Buchungen zurücknehmen',
    changes: [
      'Neue Karte „Letzte manuelle Buchung“ auf dem Dashboard nimmt die letzte manuelle Buchung mit einem Tipp zurück',
      'Bei Umbuchungen werden beide Zeilen (Quelle und Ziel) gemeinsam entfernt',
      'Automatische Sparraten bleiben bei der Rücknahme unangetastet',
      'Ist die Auto-Buchung aktiv, weist das Buchungsfenster darauf hin und fragt vor dem Speichern nach',
    ],
  },
  {
    version: '1.4.2',
    date: '2026-11-04',
    title: 'N26: Buchung wieder möglich',
    changes: [
      'Der Weiter-Button beim Buchen liegt nicht mehr unter der unteren Leiste',
      'Auf kleinen Displays lässt sich das Buchungsfenster scrollen, statt Inhalte abzuschneiden',
      'Gleiches gilt für das Anlegen und Bearbeiten von Depots',
    ],
  },
  {
    version: '1.4.1',
    date: '2026-10-31',
    title: 'Vokabeln: Lernleiter',
    changes: [
      'Drei Lernmethoden statt nur Umblättern: Auswahl aus drei Antworten, selbst schreiben, Hören und Diktat',
      'Die Methode richtet sich nach dem Lernstand: neue Wörter erkennen, gefestigte Wörter schreiben und hören',
      'Nie zweimal dieselbe Methode hintereinander, damit kein Wort wie Papier wirkt',
      'Beim Schreiben zählen kleine Tippfehler nicht, Umlaute und Akzente werden verziehen',
      'Wörter werden auf Wunsch vorgelesen (Sprachausgabe des Geräts)',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-05-07',
    title: 'Gamification & Ausgaben-Insights',
    changes: [
      'Erfolgs-Banner auf der Ausgabenseite mit kontextabhängigen Motivations-Nachrichten',
      'Budget-Ring ersetzt den „Verfügbar"-Betrag — mit Meilenstein-Punkten bei 25/50/75/100%',
      'Kategorie-Trendpfeile: Top-5-Veränderungen zum 3-Monats-Schnitt',
      'Spar-Streak: Anzeige, wie viele Monate in Folge im Plus',
      'N26 Depots: Aufklappen per Tap zeigt die letzten 10 Buchungen',
      'Design-Farbauswahl: Eigenes Dropdown mit farbigen Optionen (statt nativem Select)',
      '9 neue Themenfarben: Blau, Koralle, Limette, Traube, Ozean, Sonnenuntergang, Minze, Karminrot, Gold',
      'Budget-Seite: Systemfarben für Unterstreichungen und Mülleimer, Avatar entfernt',
      'Scrollbars global ausgeblendet, blauer Tap-Highlight auf Mobilgeräten entfernt',
    ],
  },
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
