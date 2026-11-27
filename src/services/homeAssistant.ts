import { auth } from './firebase';

export type CoverState = 'open' | 'closed' | 'opening' | 'closing' | 'unavailable';
export type CoverAction = 'open' | 'close' | 'stop' | 'set_position';
export type LightState = 'on' | 'off' | 'unavailable';
export type LightAction = 'turn_on' | 'turn_off' | 'toggle';

export interface HomeAssistantCover {
  entity_id: string;
  domain?: 'cover';
  name: string;
  area?: string | null;
  device_class?: string | null;
  state: CoverState;
  position: number | null;
  supports_position?: boolean;
  is_group?: boolean;
  updated_at: string | null;
}

export interface HomeAssistantCoverDevice extends HomeAssistantCover {
  domain: 'cover';
  area: string | null;
  device_class: string | null;
  supports_position: boolean;
  is_group: boolean;
}

export interface HomeAssistantLight {
  entity_id: string;
  domain: 'light';
  name: string;
  area: string | null;
  state: LightState;
  brightness_pct: number | null;
  supports_brightness: boolean;
  supports_color_temp: boolean;
  color_temp_kelvin: number | null;
  min_color_temp_kelvin: number;
  max_color_temp_kelvin: number;
  supports_color: boolean;
  rgb_color: [number, number, number] | null;
  is_group: boolean;
  updated_at: string | null;
}

export type HomeAssistantDevice = HomeAssistantCoverDevice | HomeAssistantLight;

export interface CoversResponse {
  updated_at: string;
  covers: HomeAssistantCover[];
}

export interface SmartHomeDevicesResponse {
  updated_at: string;
  covers: HomeAssistantCoverDevice[];
  lights: HomeAssistantLight[];
  areas: string[];
}

export type SmartHomeDeviceActionPayload =
  | {
      entity_id: string;
      action: CoverAction;
      position?: number;
    }
  | {
      entity_id: string;
      action: LightAction;
      brightness_pct?: number;
      color_temp_kelvin?: number;
      rgb_color?: [number, number, number];
    };

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

export async function fetchSmartHomeDevices(): Promise<SmartHomeDevicesResponse> {
  const response = await fetch('/api/home-assistant/devices', {
    headers: await authHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  return response.json() as Promise<SmartHomeDevicesResponse>;
}

export async function sendSmartHomeDeviceAction(input: SmartHomeDeviceActionPayload) {
  const response = await fetch('/api/home-assistant/devices', {
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
