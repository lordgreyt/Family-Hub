import { useState } from 'react';
import type { SurgeryFinanceBonus, SurgeryFinancePlan, SurgeryFinanceSource } from '../../services/surgeryFinance';
import { Save, X } from 'lucide-react';

interface PlanDraft {
  surgeryCost: string;
  billDueDate: string;
  monthlyTarget: string;
  monthlyStartMonth: string;
  sources: Array<Omit<SurgeryFinanceSource, 'amountCents'> & { amount: string }>;
  futureBonuses: Array<Omit<SurgeryFinanceBonus, 'amountCents'> & { amount: string }>;
}

interface PlanFormProps {
  initial: SurgeryFinancePlan | null;
  onSave: (plan: SurgeryFinancePlan) => Promise<void>;
  onCancel?: () => void;
}

const euroInput = (cents: number) => cents ? (cents / 100).toFixed(2).replace('.', ',') : '';
const parseCents = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [euros, cents = ''] = normalized.split('.');
  const total = Number(euros) * 100 + Number(cents.padEnd(2, '0'));
  return Number.isSafeInteger(total) ? total : null;
};

const createDraft = (initial: SurgeryFinancePlan | null): PlanDraft => ({
  surgeryCost: euroInput(initial?.surgeryCostCents || 0),
  billDueDate: initial?.billDueDate || '',
  monthlyTarget: euroInput(initial?.monthlyTargetCents || 0),
  monthlyStartMonth: initial?.monthlyStartMonth || '',
  sources: initial?.sources.map(source => ({ ...source, amount: euroInput(source.amountCents) })) || [
    { id: 'nebenkosten', label: 'Nebenkostenkonto', kind: 'repayable', amount: '' },
    { id: 'bonus', label: 'Bonuszahlung für die Rechnung', kind: 'contribution', amount: '', availableOn: '' },
    { id: 'sparbuch', label: 'Sparbuch', kind: 'contribution', amount: '' },
    { id: 'bank', label: 'Bankkredit', kind: 'repayable', amount: '' },
  ],
  futureBonuses: initial?.futureBonuses.map(bonus => ({ ...bonus, amount: euroInput(bonus.amountCents) })) || [
    { id: 'future-bonus', label: 'Weitere erwartete Bonuszahlung', amount: '', expectedOn: '' },
  ],
});

export const PlanForm = ({ initial, onSave, onCancel }: PlanFormProps) => {
  const [draft, setDraft] = useState<PlanDraft>(() => createDraft(initial));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const updateSource = (id: string, amount: string) => setDraft(current => ({
    ...current,
    sources: current.sources.map(source => source.id === id ? { ...source, amount } : source),
  }));
  const updateSourceDate = (id: string, availableOn: string) => setDraft(current => ({
    ...current,
    sources: current.sources.map(source => source.id === id ? { ...source, availableOn } : source),
  }));
  const updateBonus = (id: string, amount: string) => setDraft(current => ({
    ...current,
    futureBonuses: current.futureBonuses.map(bonus => bonus.id === id ? { ...bonus, amount } : bonus),
  }));
  const updateBonusDate = (id: string, expectedOn: string) => setDraft(current => ({
    ...current,
    futureBonuses: current.futureBonuses.map(bonus => bonus.id === id ? { ...bonus, expectedOn } : bonus),
  }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const surgeryCostCents = parseCents(draft.surgeryCost);
    const monthlyTargetCents = parseCents(draft.monthlyTarget);
    const sourceValues = draft.sources.map(source => ({ ...source, amountCents: parseCents(source.amount) }));
    const bonusValues = draft.futureBonuses.map(bonus => ({ ...bonus, amountCents: parseCents(bonus.amount) }));
    if (!draft.billDueDate || !draft.monthlyStartMonth || surgeryCostCents === null || surgeryCostCents <= 0 || monthlyTargetCents === null || monthlyTargetCents < 0) {
      setError('Bitte OP-Betrag, Fälligkeit, Monatsrate und Startmonat gültig ausfüllen.');
      return;
    }
    if (sourceValues.some(source => source.amountCents === null) || bonusValues.some(bonus => bonus.amountCents === null)) {
      setError('Bitte alle Beträge gültig eingeben (z. B. 5.270,00).');
      return;
    }
    if (sourceValues.some(source => source.id === 'bonus' && !source.availableOn) || bonusValues.some(bonus => !bonus.expectedOn)) {
      setError('Bitte die Verfügbarkeitstermine der Bonuszahlungen eintragen.');
      return;
    }
    if (sourceValues.some(source => source.kind === 'repayable' && (source.amountCents || 0) <= 0)) {
      setError('Für beide Rückzahlungsziele bitte einen Betrag größer 0 eintragen.');
      return;
    }

    const now = Date.now();
    const plan: SurgeryFinancePlan = {
      version: 1,
      surgeryCostCents,
      billDueDate: draft.billDueDate,
      monthlyTargetCents,
      monthlyStartMonth: draft.monthlyStartMonth,
      sources: sourceValues.map(({ amountCents, ...source }) => ({ ...source, amountCents: amountCents as number })),
      futureBonuses: bonusValues.map(({ amountCents, ...bonus }) => ({ ...bonus, amountCents: amountCents as number })),
      repayments: initial?.repayments || [],
      confirmations: initial?.confirmations || [],
      createdAt: initial?.createdAt || now,
      updatedAt: now,
    };

    setSaving(true);
    setError('');
    try {
      await onSave(plan);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--color-primary)' }}>{initial ? 'Finanzplan bearbeiten' : 'OP-Finanzplan einrichten'}</h2>
        <p style={{ marginTop: '0.25rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>
          Die Beträge werden nur verschlüsselt gespeichert und nicht im App-Code hinterlegt.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.65rem' }}>
        <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>OP-Rechnung (€)
          <input className="input-field" inputMode="decimal" placeholder="Betrag" value={draft.surgeryCost} onChange={e => setDraft(v => ({ ...v, surgeryCost: e.target.value }))} required />
        </label>
        <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Fällig am
          <input className="input-field" type="date" value={draft.billDueDate} onChange={e => setDraft(v => ({ ...v, billDueDate: e.target.value }))} required />
        </label>
        <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Monatsrate gesamt (€)
          <input className="input-field" inputMode="decimal" placeholder="Betrag" value={draft.monthlyTarget} onChange={e => setDraft(v => ({ ...v, monthlyTarget: e.target.value }))} required />
        </label>
        <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Rückzahlung ab
          <input className="input-field" type="month" value={draft.monthlyStartMonth} onChange={e => setDraft(v => ({ ...v, monthlyStartMonth: e.target.value }))} required />
        </label>
      </div>

      <section>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '0.45rem' }}>Finanzierung</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {draft.sources.map(source => (
            <div key={source.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(105px, 0.55fr)', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-sm)' }}>
                <span>{source.label}</span>
                <input className="input-field" inputMode="decimal" placeholder="€" value={source.amount} onChange={e => updateSource(source.id, e.target.value)} required aria-label={`${source.label}, Betrag in Euro`} />
              </label>
              {source.id === 'bonus' && <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Bonus verfügbar am
                <input className="input-field" type="date" value={source.availableOn || ''} onChange={e => updateSourceDate(source.id, e.target.value)} required />
              </label>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '0.45rem' }}>Erwarteter Bonus zur späteren Tilgung</h3>
        {draft.futureBonuses.map(bonus => (
          <div key={bonus.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(100px, 0.55fr)', gap: '0.45rem', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-sm)' }}>{bonus.label}</span>
            <input className="input-field" inputMode="decimal" placeholder="€" value={bonus.amount} onChange={e => updateBonus(bonus.id, e.target.value)} required aria-label={`${bonus.label}, Betrag in Euro`} />
            <label style={{ gridColumn: '1 / -1', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Voraussichtlich am
              <input className="input-field" type="date" value={bonus.expectedOn} onChange={e => updateBonusDate(bonus.id, e.target.value)} required />
            </label>
          </div>
        ))}
        <p style={{ marginTop: '0.35rem', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Bonuszahlungen werden erst nach tatsächlicher Buchung als Rückzahlung angerechnet.</p>
      </section>

      {error && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-sm)' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving} style={{ flex: 1, padding: '0.6rem' }}><X size={16} /> Abbrechen</button>}
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, padding: '0.6rem' }}><Save size={16} /> {saving ? 'Speichert…' : 'Plan speichern'}</button>
      </div>
    </form>
  );
};
