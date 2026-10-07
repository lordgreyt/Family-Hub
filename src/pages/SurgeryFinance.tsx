import { useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarDays, Check, CircleAlert, Euro, LockKeyhole, Plus, Settings2, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PlanForm } from '../components/SurgeryFinance/PlanForm';
import { loadSurgeryFinance, saveSurgeryFinance } from '../services/surgeryFinance';
import type { SurgeryFinancePlan, SurgeryFinanceRepayment, SurgeryFinanceTarget } from '../services/surgeryFinance';

const fmtEUR = (cents: number) => `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0€`;
const EMPTY_REPAYMENTS: SurgeryFinanceRepayment[] = [];
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const currentMonth = () => todayIso().slice(0, 7);
const parseEuroCents = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [euros, cents = ''] = normalized.split('.');
  const total = Number(euros) * 100 + Number(cents.padEnd(2, '0'));
  return Number.isSafeInteger(total) ? total : null;
};
const dateLabel = (iso: string) => {
  if (!iso) return '—';
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
};
const monthLabel = (month: string) => {
  const date = new Date(`${month}-01T12:00:00`);
  return Number.isNaN(date.getTime()) ? month : date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
};

export const SurgeryFinance = () => {
  const { user } = useAuth();
  const [plan, setPlan] = useState<SurgeryFinancePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
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
  const allSources = plan?.sources.reduce((sum, source) => sum + source.amountCents, 0) || 0;
  const fundingDifference = plan ? allSources - plan.surgeryCostCents : 0;
  const selectedRepayments = repayments
    .filter(entry => entry.month === selectedMonth)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const selectedPaid = selectedRepayments.reduce((sum, entry) => sum + entry.amountCents, 0);
  const selectedConfirmation = confirmations.find(item => item.month === selectedMonth);
  const debtSources = plan?.sources.filter(source => source.kind === 'repayable') || [];

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

  if (loading) return <div className="glass-panel" style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Privaten Finanzplan laden…</div>;

  if (error && !plan && !editingPlan) {
    return (
      <div className="glass-panel" style={{ padding: '1rem' }}>
        <h1 style={{ color: 'var(--color-primary)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>OP-Finanzen</h1>
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-sm)' }}>{error}</p>
        <p style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>Der geschützte Server-Endpunkt muss erreichbar und mit Firebase Admin konfiguriert sein.</p>
        <button className="btn btn-secondary" onClick={() => { setError(''); setLoading(true); loadSurgeryFinance().then(setPlan).catch(e => setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')).finally(() => setLoading(false)); }} style={{ marginTop: '0.75rem' }}>Erneut versuchen</button>
      </div>
    );
  }

  if (!plan || editingPlan) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
          <Euro size={22} /><h1 style={{ fontSize: '1.25rem' }}>OP-Finanzen</h1>
        </div>
        <PlanForm initial={plan} onSave={persist} onCancel={plan ? () => setEditingPlan(false) : undefined} />
      </div>
    );
  }

  const bonusContribution = plan.sources.find(source => source.id === 'bonus');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '1rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <h1 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Euro size={22} /> OP-Finanzen</h1>
        <button className="btn btn-secondary" onClick={() => setEditingPlan(true)} style={{ padding: '0.45rem 0.65rem', fontSize: 'var(--font-xs)' }} aria-label="Finanzplan bearbeiten"><Settings2 size={15} /> Plan</button>
      </header>

      <div className="glass-panel" style={{ padding: '0.65rem 0.8rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <LockKeyhole size={16} color="var(--color-success)" style={{ flexShrink: 0, marginTop: '1px' }} />
        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', lineHeight: 1.35 }}>Privat gespeichert: verschlüsselt in Firebase; lesbar nur über den Serverzugriff für erwachsene Konten.</p>
      </div>

      {error && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-sm)' }}>{error}</p>}

      <section className="glass-panel" style={{ padding: '0.85rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
          <div><p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>OP-Rechnung</p><strong style={{ fontSize: '1.05rem' }}>{fmtEUR(plan.surgeryCostCents)}</strong><p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Fällig {dateLabel(plan.billDueDate)}</p></div>
          <div><p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Noch zurückzuzahlen</p><strong style={{ fontSize: '1.05rem', color: totalOutstanding > 0 ? 'var(--color-primary)' : 'var(--color-success)' }}>{fmtEUR(totalOutstanding)}</strong><p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Bisher {fmtEUR(totalPaid)} von {fmtEUR(totalDebt)}</p></div>
        </div>
      </section>

      {fundingDifference !== 0 && (
        <div role="status" className="glass-panel" style={{ padding: '0.7rem 0.8rem', borderColor: 'var(--color-orange)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <CircleAlert size={17} color="var(--color-orange)" style={{ flexShrink: 0, marginTop: '1px' }} />
          <span style={{ fontSize: 'var(--font-xs)', lineHeight: 1.4 }}>
            Finanzierungsplan: {fundingDifference > 0 ? `${fmtEUR(fundingDifference)} mehr als die Rechnung` : `${fmtEUR(Math.abs(fundingDifference))} noch nicht zugeordnet`}. Planwerte bitte bei Bedarf bearbeiten.
          </span>
        </div>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' }}>
        {(['nebenkosten', 'bank'] as const).map(id => {
          const source = sourceById.get(id);
          if (!source) return null;
          const paid = paidByTarget[id];
          const balance = balances[id];
          return (
            <div key={id} className="glass-panel" style={{ padding: '0.75rem', minWidth: 0 }}>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', minHeight: '2em' }}>{source.label}</p>
              <strong style={{ fontSize: '1rem', color: balance > 0 ? 'var(--color-text)' : 'var(--color-success)' }}>{fmtEUR(balance)}</strong>
              <p style={{ marginTop: '0.2rem', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Offen · {fmtEUR(paid)} getilgt</p>
            </div>
          );
        })}
      </section>

      <section className="glass-panel" style={{ padding: '0.8rem' }}>
        <h2 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Banknote size={17} /> Finanzierung</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {plan.sources.map(source => (
            <div key={source.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: 'var(--font-xs)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>{source.label}{source.availableOn ? ` · ${dateLabel(source.availableOn)}` : ''}</span>
              <strong style={{ whiteSpace: 'nowrap' }}>{fmtEUR(source.amountCents)}</strong>
            </div>
          ))}
        </div>
        {bonusContribution?.availableOn && bonusContribution.availableOn > plan.billDueDate && (
          <p style={{ marginTop: '0.55rem', color: 'var(--color-orange)', fontSize: 'var(--font-xs)', lineHeight: 1.4 }}>Der Bonus Ende November kommt nach der Rechnungsfälligkeit; er wird deshalb nicht automatisch als bereits verfügbare Zahlung gerechnet.</p>
        )}
      </section>

      {plan.futureBonuses.length > 0 && (
        <section className="glass-panel" style={{ padding: '0.8rem' }}>
          <h2 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CalendarDays size={17} /> Erwartete Sondertilgung</h2>
          {plan.futureBonuses.map(bonus => (
            <div key={bonus.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: 'var(--font-xs)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>{bonus.label} · {dateLabel(bonus.expectedOn)}</span>
              <strong style={{ whiteSpace: 'nowrap' }}>{fmtEUR(bonus.amountCents)}</strong>
            </div>
          ))}
          <p style={{ marginTop: '0.4rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>Die Beträge reduzieren den offenen Stand erst, wenn ihr die tatsächliche Rückzahlung eintragt.</p>
        </section>
      )}

      <section className="glass-panel" style={{ padding: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.55rem' }}>
          <h2 style={{ margin: 0, fontSize: '0.95rem' }}>Monatliche Rückzahlung</h2>
          <input aria-label="Monat auswählen" type="month" value={selectedMonth} onChange={event => { setSelectedMonth(event.target.value); setDate(`${event.target.value}-01`); setError(''); }} className="input-field" style={{ width: 'auto', maxWidth: '155px', padding: '0.35rem' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: 'var(--font-xs)', marginBottom: '0.6rem' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Richtwert für {monthLabel(selectedMonth)}</span>
          <strong>{fmtEUR(plan.monthlyTargetCents)} · eingetragen {fmtEUR(selectedPaid)}</strong>
        </div>

        <form onSubmit={addRepayment} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(105px, 0.65fr)', gap: '0.45rem' }}>
          <select className="input-field" value={target} onChange={event => setTarget(event.target.value as SurgeryFinanceTarget)} aria-label="Rückzahlungsziel">
            {debtSources.map(source => <option key={source.id} value={source.id}>{source.label}</option>)}
          </select>
          <input className="input-field" inputMode="decimal" placeholder="Betrag in €" value={amount} onChange={event => setAmount(event.target.value)} aria-label="Rückzahlungsbetrag in Euro" />
          <input className="input-field" type="date" value={date} onChange={event => setDate(event.target.value)} aria-label="Buchungsdatum" />
          <input className="input-field" placeholder="Notiz (optional)" value={note} onChange={event => setNote(event.target.value)} aria-label="Notiz" />
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ gridColumn: '1 / -1', padding: '0.55rem' }}><Plus size={16} /> Rückzahlung eintragen</button>
        </form>

        {selectedRepayments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.7rem' }}>
            {selectedRepayments.map(entry => (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.4rem', fontSize: 'var(--font-xs)' }}>
                <div style={{ flex: 1, minWidth: 0 }}><strong>{fmtEUR(entry.amountCents)}</strong> → {sourceById.get(entry.target)?.label || entry.target}<div style={{ color: 'var(--color-text-muted)' }}>{dateLabel(entry.date)}{entry.note ? ` · ${entry.note}` : ''}</div></div>
                <button type="button" onClick={() => deleteRepayment(entry)} disabled={saving} aria-label="Rückzahlung löschen" style={{ padding: '0.4rem', color: 'var(--color-danger)' }}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ marginTop: '0.55rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>Für diesen Monat sind noch keine Rückzahlungen eingetragen.</p>
        )}

        <button type="button" className={selectedConfirmation ? 'btn btn-secondary' : 'btn btn-primary'} onClick={confirmMonth} disabled={saving} style={{ width: '100%', marginTop: '0.65rem', padding: '0.55rem' }}>
          <Check size={16} /> {selectedConfirmation ? 'Monat bestätigt' : selectedPaid ? 'Rückzahlung für Monat bestätigen' : 'Monat ohne Rückzahlung bestätigen'}
        </button>
        {selectedConfirmation && <p style={{ marginTop: '0.35rem', textAlign: 'center', color: 'var(--color-success)', fontSize: 'var(--font-xs)' }}>Bestätigt von {selectedConfirmation.confirmedBy} · {dateLabel(selectedConfirmation.confirmedAt.slice(0, 10))}</p>}
      </section>

      <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>{saving ? 'Wird sicher gespeichert…' : 'Speichern nur über den geschützten OP-Finanz-Endpunkt.'}</p>
    </div>
  );
};
