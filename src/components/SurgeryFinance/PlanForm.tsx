import { useState } from 'react';
import type { ReactNode } from 'react';
import type { SurgeryFinanceBonus, SurgeryFinancePlan, SurgeryFinanceSource } from '../../services/surgeryFinance';
import { Banknote, CalendarClock, Gift, HeartPulse, LockKeyhole, Receipt, Save, X } from 'lucide-react';
import { CARD, GREEN, HERO_GRADIENT, PINK_TEXT, PRIMARY, BLUE, fieldLabel, fmtEUR, iconChip, parseEuroCents as parseCents, sectionTitle, sourceColor } from './theme';

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

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label style={{ display: 'block', minWidth: 0 }}>
    <span style={fieldLabel}>{label}</span>
    {children}
  </label>
);

const EuroInput = ({ value, onChange, label, placeholder = '0,00' }: { value: string; onChange: (value: string) => void; label: string; placeholder?: string }) => (
  <div style={{ position: 'relative' }}>
    <input
      className="input-field" inputMode="decimal" placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)}
      required aria-label={label} style={{ width: '100%', paddingRight: '2rem', fontWeight: 700 }}
    />
    <span style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>€</span>
  </div>
);

const SectionHead = ({ icon, color, title, hint }: { icon: ReactNode; color: string; title: string; hint?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
    <span style={iconChip(color)}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <h3 style={sectionTitle}>{title}</h3>
      {hint && <p style={{ margin: '0.1rem 0 0', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>{hint}</p>}
    </div>
  </div>
);

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

  // Live-Abgleich: Summe aller Quellen gegen die OP-Rechnung
  const costCents = parseCents(draft.surgeryCost);
  const sourcesCents = draft.sources.reduce((sum, source) => sum + (parseCents(source.amount) || 0), 0);
  const diff = costCents !== null && costCents > 0 ? sourcesCents - costCents : null;

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1rem' }}>
      <div style={{
        background: HERO_GRADIENT, borderRadius: 'var(--radius-xl)', boxShadow: '0 12px 28px rgba(63,52,196,0.28)',
        padding: '1.3rem 1.25rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <HeartPulse size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 800, color: 'white' }}>{initial ? 'Finanzplan bearbeiten' : 'OP-Finanzplan einrichten'}</h1>
          <p style={{ margin: '0.15rem 0 0', opacity: 0.88, fontSize: 'var(--font-xs)', display: 'flex', alignItems: 'flex-start', gap: '0.3rem', lineHeight: 1.35 }}>
            <LockKeyhole size={12} style={{ flexShrink: 0, marginTop: '1px' }} /> Beträge werden nur verschlüsselt gespeichert, nicht im App-Code.
          </p>
        </div>
      </div>

      <section style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SectionHead icon={<Receipt size={19} />} color={PRIMARY} title="Die Rechnung" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem' }}>
          <Field label="OP-Rechnung">
            <EuroInput value={draft.surgeryCost} onChange={surgeryCost => setDraft(v => ({ ...v, surgeryCost }))} label="OP-Rechnung in Euro" />
          </Field>
          <Field label="Fällig am">
            <input className="input-field" type="date" value={draft.billDueDate} onChange={e => setDraft(v => ({ ...v, billDueDate: e.target.value }))} required style={{ width: '100%' }} />
          </Field>
        </div>
      </section>

      <section style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SectionHead icon={<CalendarClock size={19} />} color={BLUE} title="Rückzahlung" hint="Richtwert pro Monat" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem' }}>
          <Field label="Monatsrate gesamt">
            <EuroInput value={draft.monthlyTarget} onChange={monthlyTarget => setDraft(v => ({ ...v, monthlyTarget }))} label="Monatsrate gesamt in Euro" />
          </Field>
          <Field label="Rückzahlung ab">
            <input className="input-field" type="month" value={draft.monthlyStartMonth} onChange={e => setDraft(v => ({ ...v, monthlyStartMonth: e.target.value }))} required style={{ width: '100%' }} />
          </Field>
        </div>
      </section>

      <section style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SectionHead icon={<Banknote size={19} />} color={GREEN} title="Finanzierung" hint="Woher kommt das Geld für die Rechnung?" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {draft.sources.map(source => (
            <div key={source.id} style={{ padding: '0.8rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-hover)', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem 0.6rem', flexWrap: 'wrap' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: sourceColor(source.id), flexShrink: 0 }} />
                <span style={{ flex: '1 1 150px', minWidth: 0, fontSize: 'var(--font-sm)', fontWeight: 800 }}>{source.label}</span>
                <span style={{ fontSize: '10px', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '999px', background: source.kind === 'repayable' ? '#FDE8EF' : '#E3F6EF', color: source.kind === 'repayable' ? PINK_TEXT : '#1E9A78', whiteSpace: 'nowrap' }}>
                  {source.kind === 'repayable' ? 'Rückzahlung' : 'Eigenmittel'}
                </span>
              </div>
              <EuroInput value={source.amount} onChange={value => updateSource(source.id, value)} label={`${source.label}, Betrag in Euro`} />
              {source.id === 'bonus' && (
                <Field label="Bonus verfügbar am">
                  <input className="input-field" type="date" value={source.availableOn || ''} onChange={e => updateSourceDate(source.id, e.target.value)} required style={{ width: '100%' }} />
                </Field>
              )}
            </div>
          ))}
        </div>
        {diff !== null && (
          <div role="status" style={{
            padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', fontWeight: 800, lineHeight: 1.4,
            background: diff === 0 ? '#E3F6EF' : '#FFF0E4', color: diff === 0 ? '#1E9A78' : '#B8651F',
          }}>
            {diff === 0 ? 'Finanzierung deckt die Rechnung genau.' : diff > 0 ? `${fmtEUR(diff)} mehr als die Rechnung.` : `${fmtEUR(-diff)} noch nicht zugeordnet.`}
          </div>
        )}
      </section>

      <section style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SectionHead icon={<Gift size={19} />} color="#F5A06B" title="Erwarteter Bonus" hint="Für die spätere Tilgung" />
        {draft.futureBonuses.map(bonus => (
          <div key={bonus.id} style={{ padding: '0.8rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-hover)', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 800 }}>{bonus.label}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem' }}>
              <Field label="Betrag">
                <EuroInput value={bonus.amount} onChange={value => updateBonus(bonus.id, value)} label={`${bonus.label}, Betrag in Euro`} />
              </Field>
              <Field label="Voraussichtlich am">
                <input className="input-field" type="date" value={bonus.expectedOn} onChange={e => updateBonusDate(bonus.id, e.target.value)} required style={{ width: '100%' }} />
              </Field>
            </div>
          </div>
        ))}
        <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', lineHeight: 1.45, fontWeight: 600 }}>
          Bonuszahlungen werden erst nach tatsächlicher Buchung als Rückzahlung angerechnet.
        </p>
      </section>

      {error && <p role="alert" style={{ margin: 0, padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)', background: '#FDE8EF', color: PINK_TEXT, fontSize: 'var(--font-sm)', fontWeight: 700 }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.6rem' }}>
        {onCancel && (
          <button
            type="button" onClick={onCancel} disabled={saving}
            style={{ flex: 1, height: '50px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--color-surface-muted)', color: 'var(--color-text-muted)', fontSize: 'var(--font-base)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          >
            <X size={18} /> Abbrechen
          </button>
        )}
        <button
          type="submit" disabled={saving}
          style={{
            flex: 1.4, height: '50px', border: 'none', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)', color: 'white',
            fontSize: 'var(--font-base)', fontWeight: 800, boxShadow: '0 8px 20px rgba(63,52,196,0.3)', opacity: saving ? 0.7 : 1,
          }}
        >
          <Save size={18} /> {saving ? 'Speichert…' : 'Plan speichern'}
        </button>
      </div>
    </form>
  );
};
