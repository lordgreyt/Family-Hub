import { auth } from './firebase';

export type CoverState = 'open' | 'closed' | 'opening' | 'closing' | 'unavailable';
export type CoverAction = 'open' | 'close' | 'stop' | 'set_position';

export interface HomeAssistantCover {
  entity_id: string;
  name: string;
  state: CoverState;
  position: number | null;
  updated_at: string | null;
}

export interface CoversResponse {
  updated_at: string;
  covers: HomeAssistantCover[];
}

interface ApiErrorBody {
  error?: string;
}

async function authHeaders() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Bitte erneut anmelden.');
  }

  const token = await currentUser.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function errorMessage(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.error || 'Die Anfrage konnte nicht verarbeitet werden.';
  } catch {
    return 'Die Anfrage konnte nicht verarbeitet werden.';
  }
}

export async function fetchHomeAssistantCovers(): Promise<CoversResponse> {
  const response = await fetch('/api/home-assistant/covers', {
    headers: await authHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  return response.json() as Promise<CoversResponse>;
}

export async function sendHomeAssistantCoverAction(input: {
  entity_id: string;
  action: CoverAction;
  position?: number;
}) {
  const response = await fetch('/api/home-assistant/covers/action', {
    method: 'POST',
    headers: {
      ...(await authHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
}
