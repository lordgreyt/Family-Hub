import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Banknote, CalendarClock, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Gift, HeartPulse, Home,
  Landmark, LockKeyhole, Plus, Receipt, Settings2, Trash2, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PlanForm } from '../components/SurgeryFinance/PlanForm';
import {
  BLUE, CARD, GREEN, GREEN_TEXT, HERO_GRADIENT, ORANGE, PINK, PINK_TEXT, PRIMARY,
  dateLabel, dateShort, fieldLabel, fmtEUR, fmtEURShort, iconChip, monthLabel, parseEuroCents, sectionTitle, shiftMonth, sourceColor,
} from '../components/SurgeryFinance/theme';
import { loadSurgeryFinance, saveSurgeryFinance } from '../services/surgeryFinance';
import type { SurgeryFinancePlan, SurgeryFinanceRepayment, SurgeryFinanceTarget } from '../services/surgeryFinance';

const EMPTY_REPAYMENTS: SurgeryFinanceRepayment[] = [];
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const currentMonth = () => todayIso().slice(0, 7);
const shortMonth = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');

const TARGET_ICON = { nebenkosten: Home, bank: Landmark } as const;

const heroGlassBtn = {
  width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.22)', color: 'white',
  display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0,
} as const;

const Bar = ({ percent, color, height = 8, track = 'var(--color-surface-muted)' }: { percent: number; color: string; height?: number; track?: string }) => (
  <div style={{ height: `${height}px`, borderRadius: '999px', background: track, overflow: 'hidden' }}>
    <div style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: '100%', borderRadius: '999px', background: color, transition: 'width 0.4s ease' }} />
  </div>
);

export const SurgeryFinance = () => {
  const { user } = useAuth();
  const [plan, setPlan] = useState<SurgeryFinancePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [target, setTarget] = useState<SurgeryFinanceTarget>('nebenkosten');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');

  useEffect(() => {
    let active = true;
    loadSurgeryFinance()
      .then(data => {
        if (!active) return;
        setPlan(data);
        if (data && currentMonth() < data.monthlyStartMonth) {
          setSelectedMonth(data.monthlyStartMonth);
          setDate(`${data.monthlyStartMonth}-01`);
        }
      })
      .catch(loadError => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Der private Finanzplan konnte nicht geladen werden.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const sourceById = useMemo(() => new Map((plan?.sources || []).map(source => [source.id, source])), [plan]);
  const repayments = plan?.repayments ?? EMPTY_REPAYMENTS;
  const confirmations = plan?.confirmations || [];
  const paidByTarget = useMemo(() => repayments.reduce((result, entry) => {
    result[entry.target] += entry.amountCents;
    return result;
  }, { nebenkosten: 0, bank: 0 }), [repayments]);
  const balances = {
    nebenkosten: Math.max(0, (sourceById.get('nebenkosten')?.amountCents || 0) - paidByTarget.nebenkosten),
    bank: Math.max(0, (sourceById.get('bank')?.amountCents || 0) - paidByTarget.bank),
  };
  const totalDebt = (sourceById.get('nebenkosten')?.amountCents || 0) + (sourceById.get('bank')?.amountCents || 0);
  const totalOutstanding = balances.nebenkosten + balances.bank;
  const totalPaid = paidByTarget.nebenkosten + paidByTarget.bank;
  const paidPercent = totalDebt > 0 ? Math.min(100, (totalPaid / totalDebt) * 100) : 0;
  const allSources = plan?.sources.reduce((sum, source) => sum + source.amountCents, 0) || 0;
  const fundingDifference = plan ? allSources - plan.surgeryCostCents : 0;
  const selectedRepayments = repayments
    .filter(entry => entry.month === selectedMonth)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const selectedPaid = selectedRepayments.reduce((sum, entry) => sum + entry.amountCents, 0);
  const selectedConfirmation = confirmations.find(item => item.month === selectedMonth);
  const debtSources = plan?.sources.filter(source => source.kind === 'repayable') || [];

  // Verlauf: je Monat ab Startmonat bis heute (max. 12), damit man Monate direkt anspringen kann
  const history = useMemo(() => {
    if (!plan) return [];
    const last = [currentMonth(), selectedMonth, ...repayments.map(entry => entry.month)].sort().pop() as string;
    const months: string[] = [];
    for (let month = plan.monthlyStartMonth; month <= last && months.length < 36; month = shiftMonth(month, 1)) months.push(month);
    return months.slice(-12).map(month => ({
      month,
      paid: repayments.filter(entry => entry.month === month).reduce((sum, entry) => sum + entry.amountCents, 0),
      confirmed: confirmations.some(item => item.month === month),
    }));
  }, [plan, repayments, confirmations, selectedMonth]);

  const persist = async (next: SurgeryFinancePlan) => {
    setSaving(true);
    setError('');
    try {
      await saveSurgeryFinance(next);
      setPlan(next);
      setEditingPlan(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Speichern fehlgeschlagen.');
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  const selectMonth = (month: string) => {
    setSelectedMonth(month);
    setDate(month === currentMonth() ? todayIso() : `${month}-01`);
    setError('');
  };

  const openSheet = () => {
    setError('');
    if (balances[target] <= 0 && balances[target === 'bank' ? 'nebenkosten' : 'bank'] > 0) setTarget(target === 'bank' ? 'nebenkosten' : 'bank');
    setShowSheet(true);
  };

  const addRepayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!plan || !user) return;
    const amountCents = parseEuroCents(amount);
    if (amountCents === null || amountCents <= 0) {
      setError('Bitte einen gültigen Rückzahlungsbetrag größer 0 eingeben.');
      return;
    }
    if (!date || date.slice(0, 7) !== selectedMonth) {
      setError('Das Buchungsdatum muss im ausgewählten Monat liegen.');
      return;
    }
    if (amountCents > balances[target]) {
      setError(`Die offene Summe für dieses Rückzahlungsziel beträgt nur ${fmtEUR(balances[target])}.`);
      return;
    }
    const entry: SurgeryFinanceRepayment = {
      id: crypto.randomUUID(),
      date,
      month: selectedMonth,
      target,
      amountCents,
      note: note.trim() || undefined,
      createdAt: Date.now(),
      createdBy: user.id,
    };
    const next: SurgeryFinancePlan = {
      ...plan,
      repayments: [...plan.repayments, entry],
      confirmations: plan.confirmations.filter(item => item.month !== selectedMonth),
      updatedAt: Date.now(),
    };
    try {
      await persist(next);
      setAmount('');
      setNote('');
      setShowSheet(false);
    } catch { /* Error is displayed by persist. */ }
  };

  const deleteRepayment = async (entry: SurgeryFinanceRepayment) => {
    if (!plan || !window.confirm(`${fmtEUR(entry.amountCents)} Rückzahlung wirklich löschen?`)) return;
    const next: SurgeryFinancePlan = {
      ...plan,
      repayments: plan.repayments.filter(item => item.id !== entry.id),
      confirmations: plan.confirmations.filter(item => item.month !== entry.month),
      updatedAt: Date.now(),
    };
    try { await persist(next); } catch { /* Error is displayed by persist. */ }
  };

  const confirmMonth = async () => {
    if (!plan || !user) return;
    const next: SurgeryFinancePlan = {
      ...plan,
      confirmations: [
        ...plan.confirmations.filter(item => item.month !== selectedMonth),
        { month: selectedMonth, confirmedAt: new Date().toISOString(), confirmedBy: user.id },
      ],
      updatedAt: Date.now(),
    };
    try { await persist(next); } catch { /* Error is displayed by persist. */ }
  };

  if (!user || user.isChild) return null;

  if (loading) {
    return (
      <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
        <span style={iconChip(PRIMARY)}><HeartPulse size={19} /></span>
        Privaten Finanzplan laden…
      </div>
    );
  }

  if (error && !plan && !editingPlan) {
    return (
      <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={iconChip(PINK)}><CircleAlert size={19} /></span>
          <h1 style={{ ...sectionTitle, fontSize: 'var(--font-lg)' }}>OP-Finanzen</h1>
        </div>
        <p role="alert" style={{ margin: 0, padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-md)', background: '#FDE8EF', color: PINK_TEXT, fontSize: 'var(--font-sm)', fontWeight: 700 }}>{error}</p>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', lineHeight: 1.45 }}>Der geschützte Server-Endpunkt muss erreichbar und mit Firebase Admin konfiguriert sein.</p>
        <button
          className="btn btn-primary"
          onClick={() => { setError(''); setLoading(true); loadSurgeryFinance().then(setPlan).catch(e => setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')).finally(() => setLoading(false)); }}
          style={{ borderRadius: '999px', height: '46px', fontWeight: 800 }}
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!plan || editingPlan) {
    return <PlanForm initial={plan} onSave={persist} onCancel={plan ? () => setEditingPlan(false) : undefined} />;
  }

  const bonusContribution = plan.sources.find(source => source.id === 'bonus');
  const debtFree = totalDebt > 0 && totalOutstanding === 0;

  // Fälligkeit der Rechnung in Tagen
  const dueDays = Math.round((new Date(`${plan.billDueDate}T12:00:00`).getTime() - new Date(`${todayIso()}T12:00:00`).getTime()) / 86400000);
  const dueText = Number.isNaN(dueDays) ? '' : dueDays > 1 ? `in ${dueDays} Tagen` : dueDays === 1 ? 'morgen' : dueDays === 0 ? 'heute' : `seit ${-dueDays} Tagen`;

  // Prognose: wie viele Monatsraten fehlen noch, ab wann zählt die Rate
  const startFrom = currentMonth() > plan.monthlyStartMonth ? currentMonth() : plan.monthlyStartMonth;
  const monthsLeft = plan.monthlyTargetCents > 0 && totalOutstanding > 0 ? Math.ceil(totalOutstanding / plan.monthlyTargetCents) : 0;
  const forecast = monthsLeft > 0 ? monthLabel(shiftMonth(startFrom, monthsLeft - 1)) : '';

  const monthStarted = selectedMonth >= plan.monthlyStartMonth;
  const monthTarget = monthStarted ? plan.monthlyTargetCents : 0;
  const monthPercent = monthTarget > 0 ? (selectedPaid / monthTarget) * 100 : selectedPaid > 0 ? 100 : 0;
  const monthRest = Math.max(0, monthTarget - selectedPaid);
  const historyMax = Math.max(plan.monthlyTargetCents, ...history.map(item => item.paid), 1);

  const quickAmount = Math.min(monthRest, balances[target]);

  const glassChip = {
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', borderRadius: '999px',
    background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 'var(--font-xs)', fontWeight: 700, lineHeight: 1.3, maxWidth: '100%',
  } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1rem' }}>
      {/* Hero */}
      <div style={{
        background: HERO_GRADIENT, borderRadius: 'var(--radius-xl)', boxShadow: '0 12px 28px rgba(63,52,196,0.28)',
        padding: '1.3rem 1.25rem', color: 'white', display: 'flex', flexDirection: 'column', gap: '0.9rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ ...heroGlassBtn, width: '38px', height: '38px', cursor: 'default' }}><HeartPulse size={20} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 800, color: 'white' }}>OP-Finanzen</h1>
            <p style={{ margin: '0.1rem 0 0', opacity: 0.85, fontSize: 'var(--font-xs)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <LockKeyhole size={11} /> Privat · verschlüsselt gespeichert
            </p>
          </div>
          <button onClick={() => setEditingPlan(true)} title="Finanzplan bearbeiten" aria-label="Finanzplan bearbeiten" style={heroGlassBtn}>
            <Settings2 size={19} />
          </button>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', opacity: 0.85 }}>
            {debtFree ? 'SCHULDENFREI' : 'NOCH ZURÜCKZUZAHLEN'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1.05, whiteSpace: 'nowrap' }}>{fmtEUR(totalOutstanding)}</div>
            {debtFree && (
              <span style={{ ...glassChip, background: 'rgba(255,255,255,0.92)', color: GREEN_TEXT, fontWeight: 800 }}>
                <CheckCircle2 size={14} /> Geschafft
              </span>
            )}
          </div>
        </div>

        <div>
          <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
            <div style={{ width: `${paidPercent}%`, height: '100%', borderRadius: '999px', background: 'white', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.4rem', fontSize: 'var(--font-xs)', fontWeight: 700, opacity: 0.92 }}>
            <span>{Math.floor(paidPercent)} % getilgt</span>
            <span>{fmtEURShort(totalPaid)} von {fmtEURShort(totalDebt)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          <span style={glassChip}><Receipt size={13} /> Rechnung {fmtEURShort(plan.surgeryCostCents)} · {dateShort(plan.billDueDate)}{dueText ? ` (${dueText})` : ''}</span>
          {forecast && <span style={glassChip}><CalendarClock size={13} /> Prognose: {forecast}</span>}
        </div>
      </div>

      {error && !showSheet && (
        <p role="alert" style={{ margin: 0, padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)', background: '#FDE8EF', color: PINK_TEXT, fontSize: 'var(--font-sm)', fontWeight: 700 }}>{error}</p>
      )}

      {fundingDifference !== 0 && (
        <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)', background: ORANGE + '22' }}>
          <span style={iconChip(ORANGE, 32)}><CircleAlert size={17} /></span>
          <span style={{ fontSize: 'var(--font-sm)', lineHeight: 1.4, fontWeight: 600 }}>
            Finanzierungsplan: {fundingDifference > 0 ? `${fmtEUR(fundingDifference)} mehr als die Rechnung` : `${fmtEUR(Math.abs(fundingDifference))} noch nicht zugeordnet`}. Planwerte bitte bei Bedarf bearbeiten.
          </span>
        </div>
      )}

      {/* Rückzahlungsziele */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
        {(['nebenkosten', 'bank'] as const).map(id => {
          const source = sourceById.get(id);
          if (!source) return null;
          const Icon = TARGET_ICON[id];
          const color = sourceColor(id);
          const paid = paidByTarget[id];
          const balance = balances[id];
          const percent = source.amountCents > 0 ? (paid / source.amountCents) * 100 : 0;
          return (
            <div key={id} style={{ ...CARD, padding: '1rem', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem', minWidth: 0 }}>
                <span style={iconChip(color, 34)}><Icon size={17} /></span>
                <span style={{ maxWidth: '100%', fontSize: '11px', fontWeight: 800, color: 'var(--color-text-muted)', lineHeight: 1.2, overflowWrap: 'break-word' }}>{source.label}</span>
              </div>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.1, color: balance > 0 ? 'var(--color-text)' : GREEN_TEXT, whiteSpace: 'nowrap' }}>{fmtEUR(balance)}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>noch offen</div>
              </div>
              <Bar percent={percent} color={balance > 0 ? color : GREEN} />
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>{fmtEURShort(paid)} von {fmtEURShort(source.amountCents)} getilgt</div>
            </div>
          );
        })}
      </section>

      {/* Monatliche Rückzahlung */}
      <section style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={iconChip(PRIMARY)}><CalendarClock size={19} /></span>
          <h2 style={{ ...sectionTitle, flex: 1 }}>Monatliche Rückzahlung</h2>
        </div>

        {history.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', padding: '2px 2px 0', alignItems: 'flex-end' }}>
            {history.map(item => {
              const active = item.month === selectedMonth;
              const full = plan.monthlyTargetCents > 0 && item.paid >= plan.monthlyTargetCents;
              return (
                <button
                  key={item.month}
                  onClick={() => selectMonth(item.month)}
                  aria-label={monthLabel(item.month)}
                  style={{
                    flex: '1 0 38px', minWidth: '38px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
                    padding: '0.35rem 0.2rem', borderRadius: '14px', cursor: 'pointer', fontFamily: 'inherit',
                    border: active ? `2px solid ${PRIMARY}` : '2px solid transparent', background: active ? '#ECE8FF' : 'transparent',
                  }}
                >
                  <div style={{ height: '46px', width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{
                      width: '16px', height: `${Math.max(item.paid > 0 ? 8 : 4, (item.paid / historyMax) * 46)}px`, borderRadius: '6px',
                      background: item.paid > 0 ? (full ? GREEN : PRIMARY) : 'var(--color-border)',
                    }} />
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: active ? PRIMARY : 'var(--color-text-muted)' }}>{shortMonth(item.month)}</span>
                  <span style={{ height: '12px', display: 'flex', alignItems: 'center', color: GREEN_TEXT }}>{item.confirmed && <Check size={11} strokeWidth={3} />}</span>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <button onClick={() => selectMonth(shiftMonth(selectedMonth, -1))} aria-label="Vorheriger Monat" style={{ ...iconChip(PRIMARY, 36), border: 'none', cursor: 'pointer' }}><ChevronLeft size={20} /></button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-base)', fontWeight: 800 }}>{monthLabel(selectedMonth)}</div>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              {monthStarted ? `Richtwert ${fmtEURShort(plan.monthlyTargetCents)}` : `Rückzahlung startet ${monthLabel(plan.monthlyStartMonth)}`}
            </div>
          </div>
          <button onClick={() => selectMonth(shiftMonth(selectedMonth, 1))} aria-label="Nächster Monat" style={{ ...iconChip(PRIMARY, 36), border: 'none', cursor: 'pointer' }}><ChevronRight size={20} /></button>
        </div>

        <div style={{ padding: '0.9rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-hover)', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1 }}>{fmtEURShort(selectedPaid)}</span>
            {monthTarget > 0 && (
              <span style={{
                padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: 'var(--font-xs)', fontWeight: 800,
                background: monthRest === 0 ? '#E3F6EF' : '#ECE8FF', color: monthRest === 0 ? GREEN_TEXT : PRIMARY,
              }}>
                {monthRest === 0 ? 'Rate erreicht' : `noch ${fmtEURShort(monthRest)}`}
              </span>
            )}
          </div>
          <Bar percent={monthPercent} color={monthRest === 0 && monthTarget > 0 ? GREEN : PRIMARY} height={10} track="var(--color-border)" />
        </div>

        {selectedRepayments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {selectedRepayments.map(entry => {
              const Icon = TARGET_ICON[entry.target];
              const color = sourceColor(entry.target);
              return (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-hover)' }}>
                  <span style={iconChip(color, 36)}><Icon size={17} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 'var(--font-base)' }}>{fmtEUR(entry.amountCents)}</div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dateShort(entry.date).slice(0, 6)} · {sourceById.get(entry.target)?.label || entry.target}{entry.note ? ` · ${entry.note}` : ''}
                    </div>
                  </div>
                  <button
                    type="button" onClick={() => deleteRepayment(entry)} disabled={saving} aria-label="Rückzahlung löschen"
                    style={{ ...iconChip(PINK, 34), border: 'none', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ margin: 0, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', fontWeight: 600 }}>
            Für diesen Monat sind noch keine Rückzahlungen eingetragen.
          </p>
        )}

        <button
          type="button" onClick={openSheet} disabled={totalOutstanding === 0}
          style={{
            width: '100%', height: '50px', border: 'none', borderRadius: '999px', cursor: totalOutstanding === 0 ? 'default' : 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            background: totalOutstanding === 0 ? 'var(--color-surface-muted)' : 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)',
            color: totalOutstanding === 0 ? 'var(--color-text-muted)' : 'white', fontSize: 'var(--font-base)', fontWeight: 800,
            boxShadow: totalOutstanding === 0 ? 'none' : '0 8px 20px rgba(63,52,196,0.3)',
          }}
        >
          <Plus size={18} /> Rückzahlung eintragen
        </button>

        <div>
          <button
            type="button" onClick={confirmMonth} disabled={saving || !!selectedConfirmation}
            style={{
              width: '100%', height: '46px', borderRadius: '999px', cursor: selectedConfirmation ? 'default' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', fontSize: 'var(--font-sm)', fontWeight: 800,
              border: selectedConfirmation ? 'none' : `2px solid ${PRIMARY}`,
              background: selectedConfirmation ? '#E3F6EF' : 'transparent', color: selectedConfirmation ? GREEN_TEXT : PRIMARY,
            }}
          >
            <Check size={17} /> {selectedConfirmation ? 'Monat bestätigt' : selectedPaid ? 'Monat bestätigen' : 'Ohne Rückzahlung bestätigen'}
          </button>
          {selectedConfirmation && (
            <p style={{ margin: '0.4rem 0 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', fontWeight: 600 }}>
              Bestätigt am {dateLabel(selectedConfirmation.confirmedAt.slice(0, 10))}
            </p>
          )}
        </div>
      </section>

      {/* Finanzierung */}
      <section style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={iconChip(BLUE)}><Banknote size={19} /></span>
          <div style={{ flex: 1 }}>
            <h2 style={sectionTitle}>Finanzierung</h2>
            <p style={{ margin: '0.1rem 0 0', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>So wird die Rechnung bezahlt</p>
          </div>
        </div>

        <div style={{ display: 'flex', height: '14px', borderRadius: '999px', overflow: 'hidden', gap: '2px', background: 'var(--color-surface-muted)' }}>
          {plan.sources.filter(source => source.amountCents > 0).map(source => (
            <div key={source.id} style={{ flex: source.amountCents, background: sourceColor(source.id) }} title={`${source.label}: ${fmtEUR(source.amountCents)}`} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {plan.sources.map(source => (
            <div key={source.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: sourceColor(source.id), flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700 }}>{source.label}</div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  {source.kind === 'repayable' ? 'wird zurückgezahlt' : source.availableOn ? `verfügbar ${dateShort(source.availableOn)}` : 'Eigenmittel'}
                </div>
              </div>
              <strong style={{ whiteSpace: 'nowrap', fontSize: 'var(--font-sm)' }}>{fmtEURShort(source.amountCents)}</strong>
            </div>
          ))}
        </div>

        {bonusContribution?.availableOn && bonusContribution.availableOn > plan.billDueDate && (
          <p style={{ margin: 0, padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-md)', background: ORANGE + '22', fontSize: 'var(--font-xs)', lineHeight: 1.45, fontWeight: 600 }}>
            Der Bonus Ende November kommt nach der Rechnungsfälligkeit; er wird deshalb nicht automatisch als bereits verfügbare Zahlung gerechnet.
          </p>
        )}
      </section>

      {/* Erwartete Sondertilgung */}
      {plan.futureBonuses.length > 0 && (
        <section style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={iconChip(GREEN)}><Gift size={19} /></span>
            <h2 style={{ ...sectionTitle, flex: 1 }}>Erwartete Sondertilgung</h2>
          </div>
          {plan.futureBonuses.map(bonus => (
            <div key={bonus.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.7rem 0.8rem', borderRadius: 'var(--radius-md)', background: '#E3F6EF' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800 }}>{bonus.label}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: GREEN_TEXT }}>voraussichtlich {dateShort(bonus.expectedOn)}</div>
              </div>
              <strong style={{ whiteSpace: 'nowrap', color: GREEN_TEXT }}>{fmtEURShort(bonus.amountCents)}</strong>
            </div>
          ))}
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', lineHeight: 1.45, fontWeight: 600 }}>
            Die Beträge reduzieren den offenen Stand erst, wenn ihr die tatsächliche Rückzahlung eintragt.
          </p>
        </section>
      )}

      <p style={{ margin: 0, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', fontWeight: 600 }}>
        {saving ? 'Wird sicher gespeichert…' : 'Speichern nur über den geschützten OP-Finanz-Endpunkt.'}
      </p>

      {/* Rückzahlung eintragen */}
      {showSheet && createPortal(
        <div
          onClick={() => setShowSheet(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(23,20,58,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2000 }}
        >
          <form
            onClick={event => event.stopPropagation()}
            onSubmit={addRepayment}
            style={{
              width: '100%', maxWidth: '500px', maxHeight: '92vh', overflowY: 'auto',
              padding: '0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom))',
              borderRadius: '28px 28px 0 0', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)',
              boxShadow: '0 -12px 40px rgba(63,52,196,0.25)', display: 'flex', flexDirection: 'column', gap: '1rem',
              animation: 'surgerySheetUp 0.28s ease',
            }}
          >
            <div style={{ width: '44px', height: '5px', borderRadius: '999px', background: 'var(--color-border)', alignSelf: 'center', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={iconChip(PRIMARY)}><Plus size={19} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 800 }}>Rückzahlung eintragen</h3>
                <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>{monthLabel(selectedMonth)}</p>
              </div>
              <button
                type="button" onClick={() => setShowSheet(false)} aria-label="Schließen"
                style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0, background: 'var(--color-surface-muted)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <span style={fieldLabel}>Rückzahlungsziel</span>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, debtSources.length)}, minmax(0, 1fr))`, gap: '0.5rem' }}>
                {debtSources.map(source => {
                  const id = source.id as SurgeryFinanceTarget;
                  const Icon = TARGET_ICON[id] || Landmark;
                  const color = sourceColor(source.id);
                  const active = target === id;
                  return (
                    <button
                      key={source.id} type="button" onClick={() => setTarget(id)} aria-label={source.label} aria-pressed={active}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem', padding: '0.75rem', borderRadius: 'var(--radius-lg)',
                        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minWidth: 0,
                        border: active ? `2px solid ${color}` : '2px solid transparent', background: active ? color + '1F' : 'var(--color-surface-hover)',
                      }}
                    >
                      <span style={iconChip(color, 30)}><Icon size={15} /></span>
                      <span style={{ fontSize: 'var(--font-xs)', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.2 }}>{source.label}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>offen {fmtEURShort(balances[id] ?? 0)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={fieldLabel} htmlFor="surgery-amount">Betrag</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="surgery-amount" className="input-field" inputMode="decimal" placeholder="0,00" autoFocus value={amount}
                  onChange={event => setAmount(event.target.value)} aria-label="Rückzahlungsbetrag in Euro"
                  style={{ width: '100%', fontSize: '1.4rem', fontWeight: 800, padding: '0.7rem 2.6rem 0.7rem 1rem' }}
                />
                <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--color-text-muted)' }}>€</span>
              </div>
              {quickAmount > 0 && (
                <button
                  type="button" onClick={() => setAmount((quickAmount / 100).toFixed(2).replace('.', ','))}
                  style={{ marginTop: '0.5rem', padding: '0.35rem 0.8rem', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#ECE8FF', color: PRIMARY, fontSize: 'var(--font-xs)', fontWeight: 800 }}
                >
                  Restrate {fmtEURShort(quickAmount)} einsetzen
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <div style={{ minWidth: 0 }}>
                <label style={fieldLabel} htmlFor="surgery-date">Datum</label>
                <input id="surgery-date" className="input-field" type="date" value={date} onChange={event => setDate(event.target.value)} aria-label="Buchungsdatum" style={{ width: '100%' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={fieldLabel} htmlFor="surgery-note">Notiz</label>
                <input id="surgery-note" className="input-field" placeholder="optional" value={note} onChange={event => setNote(event.target.value)} aria-label="Notiz" style={{ width: '100%' }} />
              </div>
            </div>

            {error && (
              <p role="alert" style={{ margin: 0, padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', background: '#FDE8EF', color: PINK_TEXT, fontSize: 'var(--font-sm)', fontWeight: 700 }}>{error}</p>
            )}

            <button
              type="submit" disabled={saving}
              style={{
                width: '100%', height: '50px', border: 'none', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)', color: 'white',
                fontSize: 'var(--font-base)', fontWeight: 800, boxShadow: '0 8px 20px rgba(63,52,196,0.3)', opacity: saving ? 0.7 : 1,
              }}
            >
              <Check size={18} /> {saving ? 'Speichert…' : 'Eintragen'}
            </button>
          </form>
          <style>{`@keyframes surgerySheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        </div>,
        document.body
      )}
    </div>
  );
};
