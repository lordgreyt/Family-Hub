import { auth } from './firebase';

export type SurgeryFinanceSourceKind = 'repayable' | 'contribution';
export type SurgeryFinanceTarget = 'nebenkosten' | 'bank' | 'sparbuch';

export interface SurgeryFinanceSource {
  id: string;
  label: string;
  kind: SurgeryFinanceSourceKind;
  amountCents: number;
  availableOn?: string;
}

export interface SurgeryFinanceBonus {
  id: string;
  label: string;
  amountCents: number;
  expectedOn: string;
}

export interface SurgeryFinanceRepayment {
  id: string;
  date: string;
  month: string;
  target: SurgeryFinanceTarget;
  amountCents: number;
  note?: string;
  createdAt: number;
  createdBy: string;
}

export interface SurgeryFinanceMonthConfirmation {
  month: string;
  confirmedAt: string;
  confirmedBy: string;
}

export interface SurgeryFinancePlan {
  version: 1;
  surgeryCostCents: number;
  billDueDate: string;
  monthlyTargetCents: number;
  monthlyStartMonth: string;
  sources: SurgeryFinanceSource[];
  futureBonuses: SurgeryFinanceBonus[];
  repayments: SurgeryFinanceRepayment[];
  confirmations: SurgeryFinanceMonthConfirmation[];
  createdAt: number;
  updatedAt: number;
}

interface ApiErrorBody {
  error?: string;
}

async function authHeaders() {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Bitte erneut anmelden.');
  return { Authorization: `Bearer ${await currentUser.getIdToken()}` };
}

async function throwApiError(response: Response) {
  let body: ApiErrorBody = {};
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // A non-JSON server error gets a safe generic message below.
  }
  throw new Error(body.error || 'Der Finanzplan konnte nicht geladen werden.');
}

// Diese Standardquellen sind Schulden und werden zurückgezahlt. Ältere Pläne
// speicherten das Sparbuch noch als Eigenmittel – beim Laden korrigieren wir das
// einmalig und schreiben den Plan zurück, damit die Anzeige nicht am Altstand hängt.
const REPAYABLE_SOURCE_IDS = new Set(['nebenkosten', 'bank', 'sparbuch']);

export const normalizePlan = (plan: SurgeryFinancePlan): { plan: SurgeryFinancePlan; changed: boolean } => {
  let changed = false;
  const sources = plan.sources.map(source => {
    if (REPAYABLE_SOURCE_IDS.has(source.id) && source.kind !== 'repayable') {
      changed = true;
      return { ...source, kind: 'repayable' as const };
    }
    return source;
  });
  if (!changed) return { plan, changed };
  return { plan: { ...plan, sources, updatedAt: Date.now() }, changed };
};

export async function loadSurgeryFinance(): Promise<SurgeryFinancePlan | null> {
  const response = await fetch('/api/private/surgery-finance', {
    headers: await authHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) await throwApiError(response);
  const body = (await response.json()) as { data?: SurgeryFinancePlan | null };
  if (!body.data) return null;
  const { plan, changed } = normalizePlan(body.data);
  if (changed) {
    // Migration best effort: schlägt das Schreiben fehl, zeigt die App den
    // korrigierten Stand trotzdem an (nächster Speichervorgang zieht nach).
    try {
      await saveSurgeryFinance(plan);
    } catch {
      /* absichtlich still */
    }
  }
  return plan;
}

export async function saveSurgeryFinance(plan: SurgeryFinancePlan): Promise<void> {
  const response = await fetch('/api/private/surgery-finance', {
    method: 'PUT',
    headers: {
      ...(await authHeaders()),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ data: plan }),
  });
  if (!response.ok) await throwApiError(response);
}
