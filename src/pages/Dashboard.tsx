import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { mockDb } from '../services/mockDb';
import type { NoteItem, TaskItem, User, RewardRequest } from '../services/mockDb';
import { AvatarEmoji } from '../components/AvatarEmoji';
import { Filter, Star, X, Save, Trash2, Wallet, TrendingDown } from 'lucide-react';
import { RichTextEditor } from '../components/RichTextEditor';
import { TaskCard } from '../components/TaskCard';
import { getNeonColor, getNeonCardStyle } from '../utils/neon';

const LONG_PRESS_MS = 500;

export const Dashboard = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [recentNotes, setRecentNotes] = useState<NoteItem[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rewardRequests, setRewardRequests] = useState<RewardRequest[]>([]);
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>('');
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [expenseStats, setExpenseStats] = useState({ total: 0, topCategory: '' });

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadData = () => {
      const allNotes = mockDb.getNotes().filter(note => note.isShared);
      setRecentNotes(allNotes.slice(0, 3));

      const fourWeeksFromNow = new Date();
      fourWeeksFromNow.setDate(fourWeeksFromNow.getDate() + 28);
      fourWeeksFromNow.setHours(23, 59, 59, 999);

      const tasks = mockDb.getTasks().filter(t => {
        const hasAccess = t.isShared || t.createdBy === user?.id;
        if (!hasAccess || t.isDone) return false;
        if (!t.dueDate) return true;
        const due = new Date(t.dueDate);
        return due <= fourWeeksFromNow;
      }).sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      setUpcomingTasks(tasks);
      setUsers(mockDb.getUsers().map(u => ({ ...u, avatarColor: settings.designMode === 'neon' ? (u.avatarColorNeon || getNeonColor(u.id).color) : u.avatarColor })));
      setRewardRequests(mockDb.getRewardRequests().filter(r => r.status === 'PENDING'));

      try {
        const currentMonthStr = new Date().toISOString().slice(0, 7);
        const allExpenses = mockDb.getExpenses() || [];
        const monthlyExpenses = allExpenses.filter(e => {
          if (!e || e.type !== 'EXPENSE') return false;
          const eMonth = e.budgetMonth || e.date?.substring(0, 7);
          return eMonth === currentMonthStr;
        });
        const total = monthlyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        const byCat = monthlyExpenses.reduce((acc, e) => {
          if (e.category) {
            acc[e.category] = (acc[e.category] || 0) + (Number(e.amount) || 0);
          }
          return acc;
        }, {} as Record<string, number>);

        const topEntry = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
        setExpenseStats({
          total,
          topCategory: topEntry ? `${topEntry[0]} (${topEntry[1].toFixed(0)}€)` : 'Keine Ausgaben'
        });
      } catch (err) {
        console.error("Error loading expense stats:", err);
      }
    };

    loadData();
    window.addEventListener('db_updated', loadData);
    return () => window.removeEventListener('db_updated', loadData);
  }, [user, settings.designMode]);

  const startPress = (note: NoteItem) => {
    pressTimer.current = setTimeout(() => {
      setEditingNote({ ...note });
      setExpandedNotes(prev => { const n = new Set(prev); n.delete(note.id); return n; });
    }, LONG_PRESS_MS);
  };

  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !editingNote.content.trim()) return;
    mockDb.updateNote(editingNote);
    setEditingNote(null);
  };

  const handleDeleteNote = (id: string) => {
    if (confirm('Notiz wirklich löschen?')) {
      mockDb.deleteNote(id);
      setEditingNote(null);
    }
  };

  const handleToggleTask = (task: TaskItem) => {
    const points = settings.prioPoints[task.priority] || 0;
    mockDb.toggleTask(task.id, points);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Begrüßung */}
      <div style={{ padding: '0.5rem 0' }}>
        {(() => {
          const name = user?.id || '';
          const openers = [
            'Hallo {name},',
            'Hey {name},',
            'Moin {name},',
            'Guten Morgen {name},',
            'Na {name},',
            'Gude {name},',
            'Schön dass du da bist, {name}!',
            'Willkommen zurück, {name}!',
            'Ah, {name} ist da!',
            'Servus {name},',
            'Grüß dich {name},',
            'Tag {name},',
            'Guten Tag {name},',
            'Hi {name},',
            'Hallöchen {name},',
            'Na du, {name}!',
            'Ei guck, {name}!',
            'Willkommen {name},',
            '{name}, schön dich zu sehen!',
            'Hallo liebe/r {name},',
            'Moinsen {name},',
            'Grüß Gott {name},',
            'Tach {name},',
            'Juten Tach {name},',
            'Glück auf {name},',
            'Mahlzeit {name},',
            'Huhu {name},',
            'Na wer ist denn da? {name}!',
            '{name}, du bist ja schon wach!',
            'Da ist ja {name}!',
            '{name}! Schön, dich zu sehen!',
            'Gude Laune, {name}?',
            'Moin Moin {name},',
            '{name}, bereit für heute?',
            'Schau an, {name}!',
            '{name}, willkommen im neuen Tag!',
            'Los geht\'s {name},',
            'Aufgepasst, {name} ist hier!',
            'Ganz entspannt, {name} —',
            'Hau rein {name},',
            'Ahoi {name},',
            'Ey {name},',
            'Na endlich, {name}!',
            '{name}, da bist du ja endlich!',
            'Grias di {name},',
          ];
          const slogans = [
            'wie geht\'s dir heute?',
            'hab einen wundervollen Tag!',
            'auf in einen neuen Tag!',
            'bereit für neue Abenteuer?',
            'gut geschlafen?',
            'lass uns was bewegen heute!',
            'die Welt wartet auf dich!',
            'heute wird ein guter Tag!',
            'schön dich zu sehen!',
            'Zeit für Großes!',
            'wie läuft\'s bei dir?',
            'du rockst das heute!',
            'lass es uns angehen!',
            'jeden Tag ein bisschen besser!',
            'alles im Griff heute?',
            'genieß den Moment!',
            'mach was Schönes heute!',
            'heute ist dein Tag!',
            'viel Energie für heute!',
            'was steht heute an?',
            'immer schön lächeln!',
            'bleib wie du bist!',
            'das schaffst du locker!',
            'kleine Schritte, große Ziele!',
            'auf geht\'s!',
            'wir haben viel vor heute!',
            'einfach mal durchatmen!',
            'Familie ist das Wichtigste!',
            'zusammen sind wir stark!',
            'heute nur das Beste!',
            'bist du startklar?',
            'heute zählt jeder Moment!',
            'schön dass wir zusammen sind!',
            'was gibt\'s Neues?',
            'genug geschlummert?',
            'alles fit im Schritt?',
            'Sonne im Herzen?',
            'Kaffee schon intus?',
            'bereit zum Durchstarten?',
            'heute läuft\'s rund!',
            'Kopf hoch, Brust raus!',
            'gute Vibes nur heute!',
            'ein Tag voller Chancen!',
            'Zeit für deine Ziele!',
            'einfach mal lächeln!',
          ];
          const motivations = [
            'Denk immer daran: Jeder Tag ist eine neue Chance, etwas Großartiges zu erreichen.',
            'Du bist stärker als du denkst und schaffst mehr als du glaubst.',
            'Das Leben ist zu kurz für schlechte Laune — genieße jeden Augenblick.',
            'Was du heute tust, entscheidet darüber, wer du morgen bist.',
            'Erfolg kommt nicht von allein, aber jeder kleine Schritt zählt.',
            'Umgeben von Familie ist man nie allein — gemeinsam schaffen wir alles.',
            'Deine positive Energie heute steckt alle anderen an!',
            'Manchmal sind die kleinsten Dinge die, die am meisten zählen.',
            'Glaube an dich selbst und der Rest ergibt sich von allein.',
            'Jeder Tag bringt neue Möglichkeiten — nutze sie!',
            'Wer lächelt, lebt länger — und schöner!',
            'Du musst nicht perfekt sein, du musst nur du selbst sein.',
            'Der beste Zeitpunkt für einen Neuanfang ist immer jetzt.',
            'Kleine Fortschritte sind besser als gar keine Fortschritte.',
            'Deine Familie liebt dich genau so wie du bist.',
            'Heute ist der erste Tag vom Rest deines Lebens — mach was draus!',
            'Ein Lächeln kostet nichts, aber es gibt so viel zurück.',
            'Lass dich nicht von Kleinigkeiten runterziehen — du bist größer als das.',
            'Am Ende zählt nicht was du hattest, sondern wen du geliebt hast.',
            'Wenn du an dich glaubst, gibt es keine Grenzen.',
            'Träume nicht dein Leben, sondern lebe deine Träume!',
            'Fehler sind keine Niederlagen, sie sind Lektionen auf dem Weg zum Erfolg.',
            'Manchmal musst du loslassen, um zu wachsen.',
            'Wer nie aufgibt, hat schon halb gewonnen.',
            'Das Glück kommt zu denen, die an sich glauben.',
            'Heute kannst du alles schaffen, was du dir vornimmst.',
            'Mut bedeutet nicht keine Angst zu haben, sondern trotz Angst weiterzumachen.',
            'Das Geheimnis des Erfolgs ist, den ersten Schritt zu tun.',
            'Es sind die Begegnungen mit Menschen, die das Leben lebenswert machen.',
            'Dein Lächeln heute könnte genau das sein, was jemand anderes braucht.',
            'Bleib neugierig und lerne jeden Tag etwas Neues.',
            'Der Unterschied zwischen gut und schlecht liegt oft nur in deiner Einstellung.',
            'Geh deinen eigenen Weg — er ist der einzig richtige für dich.',
            'Jeder Tag ist ein leeres Blatt — schreib eine schöne Geschichte.',
            'Nimm dir heute einen Moment Zeit, um dankbar zu sein für das was du hast.',
            'Die besten Dinge im Leben passieren außerhalb deiner Komfortzone.',
            'Du bist genau da wo du sein sollst — vertrau dem Weg.',
            'Das Gute an einem neuen Tag: du kannst ihn gestalten wie du willst.',
            'Mach heute etwas, wofür dir dein zukünftiges Ich danken wird.',
            'Manchmal reicht eine Umarmung mehr als tausend Worte.',
            'Ziele sind Träume mit einer Deadline — also leg los!',
            'Zusammen lachen, zusammen weinen, zusammen leben — das ist Familie.',
            'Denk positiv und positive Dinge werden passieren.',
            'Der Weg ist das Ziel — also genieß die Reise!',
            'Was du heute denkst, bestimmt was du morgen fühlst.',
            'Jeder Sonnenaufgang ist eine Einladung zum Neustart.',
            'Deine beste Zeit ist jetzt — nicht gestern und nicht morgen.',
            'Auch aus Steinen die dir im Weg liegen, kannst du etwas Schönes bauen.',
            'Ein freundliches Wort kann den ganzen Tag eines Menschen verändern.',
            'Wer kämpft kann verlieren, wer nicht kämpft hat schon verloren.',
          ];
          const o = openers[Math.floor(Math.random() * openers.length)].replace('{name}', name);
          const s = slogans[Math.floor(Math.random() * slogans.length)];
          const m = motivations[Math.floor(Math.random() * motivations.length)];
          return (
            <>
              <p style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-primary-dark)', lineHeight: 1.4 }}>
                {o}
              </p>
              <p style={{
                margin: 0,
                fontSize: 'var(--font-base)',
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                lineHeight: 1.4,
                paddingLeft: '2rem',
              }}>
                {s}
              </p>
              <p style={{
                margin: '0.3rem 0 0 0',
                fontSize: 'var(--font-sm)',
                fontWeight: 400,
                color: 'var(--color-text-muted)',
                lineHeight: 1.5,
                paddingLeft: '2rem',
                opacity: 0.85,
                fontStyle: 'italic',
              }}>
                {m}
              </p>
            </>
          );
        })()}
      </div>

      {/* Offene Belohnungs-Anfragen — nur für Eltern */}
      {!user?.isChild && rewardRequests.length > 0 && (
        <div style={{
          background: 'var(--color-primary-transparent)',
          border: '1px solid var(--color-primary-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              backgroundColor: 'var(--color-primary-transparent)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Star size={20} fill="var(--color-primary)" color="var(--color-primary)" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-primary-light)' }}>
                {rewardRequests.length} offene {rewardRequests.length === 1 ? 'Anfrage' : 'Anfragen'}
              </p>
              <p style={{ margin: '0.1rem 0 0 0', fontSize: 'var(--font-xs)', color: '#A16207' }}>
                Belohnungen warten auf Freigabe
              </p>
            </div>
          </div>
          <a
            href="/rewards"
            className="btn btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-xs)', textDecoration: 'none' }}
          >
            Prüfen
          </a>
        </div>
      )}

      {/* Ausgaben diesen Monat — nur für Eltern */}
      {user && !user.isChild && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              backgroundColor: 'var(--color-primary-transparent)',
              borderRadius: 'var(--radius-md)',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Wallet size={24} color="var(--color-primary)" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{
                margin: 0,
                fontSize: 'var(--font-xs)',
                color: 'var(--color-text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                Ausgaben diesen Monat
              </p>
              <p style={{
                margin: '0.15rem 0',
                fontSize: 'var(--font-2xl)',
                fontWeight: 700,
                color: 'var(--color-text)',
              }}>
                {expenseStats.total.toFixed(2)}€
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                <TrendingDown size={12} color="var(--color-danger)" />
                Top: {expenseStats.topCategory}
              </div>
            </div>
            <a
              href="/expenses"
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-xs)', textDecoration: 'none' }}
            >
              Details
            </a>
          </div>
        </div>
      )}

      {/* Aufgaben */}
      {upcomingTasks.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>
              Aufgaben
            </h3>
            <span style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-text-muted)',
              fontWeight: 600,
              background: 'var(--color-surface-muted)',
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-full)',
            }}>
              nächste 4 Wochen
            </span>
          </div>

          {/* Filter Chips */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            <button
              onClick={() => setTaskAssigneeFilter('')}
              className={taskAssigneeFilter === '' ? 'chip chip-active' : 'chip'}
            >
              <Filter size={12} />
              Alle
            </button>
            {users.map(u => {
                const uNeon = getNeonColor(u.id);
                const uIsNeon = settings.designMode === 'neon';
                return (
              <button
                key={u.id}
                onClick={() => setTaskAssigneeFilter(u.id)}
                className={taskAssigneeFilter === u.id ? 'chip chip-active' : 'chip'}
              >
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: u.avatarColor || 'var(--color-primary)',
                  overflow: 'hidden',
                  boxShadow: uIsNeon ? `0 0 6px ${uNeon.color}88, 0 0 14px ${uNeon.color2}44` : 'none',
                }}><AvatarEmoji emoji={u.avatar} size={20} /></span>
                {u.id}
              </button>
                );
            })}
          </div>

          {/* Task Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {upcomingTasks
              .filter(t =>
                !taskAssigneeFilter ||
                t.assignedTo?.includes(taskAssigneeFilter) ||
                (t.isShared && (!t.assignedTo || t.assignedTo.length === 0))
              )
              .map(task => {
                const taskAssignees = task.assignedTo?.length
                  ? users.filter(u => task.assignedTo!.includes(u.id))
                  : [];
                const isNeon = settings.designMode === 'neon';
                const ncs = isNeon ? getNeonCardStyle(task.id) : undefined;
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    assignees={taskAssignees.length > 0 ? taskAssignees : undefined}
                    showToggle
                    canToggle={!user?.isChild}
                    neonCardStyle={ncs}
                    neonBorder={ncs ? ncs.color1 : undefined}
                    onToggle={handleToggleTask}
                  />
                );
              })}
          </div>
        </div>
      )}

      {/* Letzte Notizen */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>
            Letzte Notizen
          </h3>
          {recentNotes.length > 0 && (
            <a
              href="/notes"
              style={{
                fontSize: 'var(--font-xs)',
                color: 'var(--color-primary)',
                fontWeight: 600,
              }}
            >
              Alle ansehen
            </a>
          )}
        </div>

        {recentNotes.length === 0 ? (
          <div className="glass-panel" style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
              Noch keine geteilten Notizen.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {recentNotes.map(note => {
              const author = users.find(u => u.id === note.createdBy);
              const isExpanded = expandedNotes.has(note.id);

              if (editingNote?.id === note.id) {
                return (
                  <form
                    key={note.id}
                    onSubmit={handleSaveEdit}
                    className="glass-panel"
                    style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '2px solid var(--color-primary)' }}
                  >
                    <input
                      type="text"
                      placeholder="Überschrift (optional)"
                      className="input-field"
                      style={{ fontSize: 'var(--font-sm)' }}
                      value={editingNote.title || ''}
                      onChange={e => setEditingNote({ ...editingNote, title: e.target.value || undefined })}
                    />
                    <RichTextEditor
                      placeholder="Notiz bearbeiten..."
                      value={editingNote.content}
                      initialValue={editingNote.content}
                      onChange={val => setEditingNote({ ...editingNote, content: val })}
                    />
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600 }}>{author?.id || note.createdBy}</span>
                      <span>&bull;</span>
                      <span>{new Date(note.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setEditingNote(null)} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-sm)' }}>
                        <X size={16} /> Abbrechen
                      </button>
                      <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-sm)' }}>
                        <Save size={16} /> Speichern
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      style={{
                        color: 'var(--color-danger)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: 'var(--font-sm)',
                        alignSelf: 'flex-start',
                        fontWeight: 500,
                      }}
                    >
                      <Trash2 size={16} /> Löschen
                    </button>
                  </form>
                );
              }

              return (() => {
                const isNeon = settings.designMode === 'neon';
                const ncs = isNeon ? getNeonCardStyle(note.id) : null;
                return (
                <div
                  key={note.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    ...(ncs ? {
                      backgroundImage: ncs.backgroundImage,
                      backgroundOrigin: ncs.backgroundOrigin,
                      backgroundClip: ncs.backgroundClip,
                      border: ncs.border,
                      boxShadow: ncs.boxShadow,
                    } : {
                      background: 'var(--color-surface)',
                      boxShadow: 'var(--shadow-md)',
                      border: '1px solid var(--color-border)',
                    }),
                  }}
                  onMouseDown={() => startPress(note)}
                  onMouseUp={e => {
                    cancelPress();
                    setExpandedNotes(prev => {
                      const next = new Set(prev);
                      if (next.has(note.id)) { next.delete(note.id); } else { next.add(note.id); }
                      return next;
                    });
                  }}
                  onMouseLeave={cancelPress}
                  onTouchStart={() => startPress(note)}
                  onTouchEnd={cancelPress}
                  onTouchMove={cancelPress}
                  onContextMenu={e => e.preventDefault()}
                >
                  {/* Author avatar */}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: author?.avatarColor || 'var(--color-primary)',
                    flexShrink: 0,
                    overflow: 'hidden',
                    boxShadow: ncs ? `0 0 10px ${ncs.color1}88, 0 0 22px ${ncs.color2}44` : 'none',
                  }}>
                    {author?.avatar ? <AvatarEmoji emoji={author.avatar} size={42} /> : '📝'}
                  </span>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {note.title && (
                      <span style={{
                        fontSize: 'var(--font-xs)',
                        fontWeight: 700,
                        color: 'var(--color-text)',
                        lineHeight: 1.3,
                      }}>
                        {note.title}
                      </span>
                    )}
                    <div
                      className="rich-text-content"
                      style={{
                        color: 'var(--color-text-muted)',
                        fontSize: 'var(--font-xs)',
                        lineHeight: 1.4,
                        ...(isExpanded ? {} : {
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical' as const,
                        })
                      }}
                      dangerouslySetInnerHTML={{ __html: note.content }}
                    />
                  </div>
                </div>
                );
              })();
            })}
          </div>
        )}
      </div>
    </div>
  );
};
