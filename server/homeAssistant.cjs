const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');
const { getDatabase } = require('firebase-admin/database');

const FIREBASE_DATABASE_URL = 'https://familyhub-a588b-default-rtdb.europe-west1.firebasedatabase.app';

const COVERS = [
  { entity_id: 'cover.anja_dachfenster', name: 'Anja Dachfenster' },
  { entity_id: 'cover.anja', name: 'Anja' },
  { entity_id: 'cover.wohnzimmer_rechts', name: 'Wohnzimmer rechts' },
  { entity_id: 'cover.oskar_links', name: 'Oskar links' },
  { entity_id: 'cover.essbereich', name: 'Essbereich' },
  { entity_id: 'cover.oskar_rechts', name: 'Oskar rechts' },
  { entity_id: 'cover.lotta', name: 'Lotta' },
  { entity_id: 'cover.wohnzimmer_links', name: 'Wohnzimmer Links' },
  { entity_id: 'cover.bad_og', name: 'Bad OG' },
  { entity_id: 'cover.kuche_fenster', name: 'K\u00fcche Fenster' },
  { entity_id: 'cover.falko_schlafzimmer', name: 'Falko Schlafzimmer' },
];

const COVER_STATES = new Set(['open', 'closed', 'opening', 'closing', 'unavailable']);
const LIGHT_STATES = new Set(['on', 'off', 'unavailable']);
const ALLOWED_DEVICE_ID = /^(cover|light)\.[a-z0-9_]+$/;
const COVER_ACTIONS = {
  open: 'open_cover',
  close: 'close_cover',
  stop: 'stop_cover',
  set_position: 'set_cover_position',
};
const LIGHT_ACTIONS = {
  turn_on: 'turn_on',
  turn_off: 'turn_off',
  toggle: 'toggle',
};
const COLOR_MODES_WITH_BRIGHTNESS = new Set(['brightness', 'color_temp', 'hs', 'xy', 'rgb', 'rgbw', 'rgbww', 'white']);
const COLOR_MODES_WITH_COLOR = new Set(['hs', 'xy', 'rgb', 'rgbw', 'rgbww']);

function loadLocalEnvFallback() {
  const envFile = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envFile)) return;

  const raw = fs.readFileSync(envFile, 'utf8');
  const matches = raw.matchAll(/^([A-Z0-9_]+)=(.*?)(?=^[A-Z0-9_]+=|\s*$)/gms);

  for (const match of matches) {
    const key = match[1];
    if (process.env[key]) continue;

    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadLocalEnvFallback();

class PublicError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function setApiHeaders(res, methods) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', `${methods.join(', ')}, OPTIONS`);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function credentialFromEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      return admin.credential.cert(serviceAccount);
    } catch (err) {
      console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', err);
      throw new PublicError(500, 'Firebase Admin ist serverseitig nicht konfiguriert.', 'firebase_not_configured');
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new PublicError(500, 'Firebase Admin ist serverseitig nicht konfiguriert.', 'firebase_not_configured');
  }

  return admin.credential.cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  });
}

function initFirebase() {
  if (admin.apps.length) return;
  admin.initializeApp({
    credential: credentialFromEnv(),
    databaseURL: process.env.FIREBASE_DATABASE_URL || FIREBASE_DATABASE_URL,
  });
}

function asList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, item]) => Boolean(item))
      .map(([key, item]) => (
        item && typeof item === 'object' && !Array.isArray(item) && !item.id
          ? { id: key, ...item }
          : item
      ));
  }
  return [];
}

function bearerToken(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

async function verifyAdultUser(req) {
  const token = bearerToken(req);
  if (!token) throw new PublicError(401, 'Bitte erneut anmelden.', 'missing_auth');

  initFirebase();

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch (err) {
    console.error('Firebase ID token verification failed:', err);
    throw new PublicError(401, 'Bitte erneut anmelden.', 'invalid_auth');
  }

  const usersSnap = await getDatabase().ref('family_hub_users').get();
  const hubUser = asList(usersSnap.val()).find((user) => user && user.uid === decoded.uid);

  if (!hubUser) {
    throw new PublicError(403, 'Nutzer ist in Family Hub nicht freigeschaltet.', 'user_not_allowed');
  }

  if (hubUser.isChild || hubUser.is_child || hubUser.role === 'child') {
    throw new PublicError(403, 'Nur erwachsene Nutzer d\u00fcrfen diese Funktion verwenden.', 'adult_required');
  }

  return { uid: decoded.uid, id: hubUser.id || decoded.uid };
}

function homeAssistantConfig() {
  const url = process.env.HOME_ASSISTANT_URL;
  const token = process.env.HOME_ASSISTANT_TOKEN;

  if (!url || !token) {
    throw new PublicError(500, 'Home Assistant ist serverseitig nicht konfiguriert.', 'home_assistant_not_configured');
  }

  return {
    url: url.replace(/\/+$/, ''),
    token,
  };
}

function formatFetchErrorCode(err) {
  const code = err && err.cause && err.cause.code ? String(err.cause.code) : '';
  if (code) return code;
  const causeMsg = err && err.cause && err.cause.message ? String(err.cause.message) : '';
  if (causeMsg) return causeMsg.slice(0, 60);
  if (err && err.message && err.message !== 'fetch failed') return String(err.message).slice(0, 60);
  return '';
}

async function requestHomeAssistant(path, options = {}) {
  const { url, token } = homeAssistantConfig();
  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 11000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${url}${path}`, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();

    if (response.status === 404 && options.allowNotFound) return null;

    if (!response.ok) {
      console.error('Home Assistant request failed:', {
        path,
        status: response.status,
        response: text.slice(0, 500),
      });
      throw new PublicError(502, `Home Assistant hat die Anfrage abgelehnt (HTTP ${response.status}).`, 'home_assistant_error');
    }

    if (!text) return null;

    if (options.rawText) return text;

    try {
      return JSON.parse(text);
    } catch (err) {
      console.error('Invalid Home Assistant JSON:', { path, err });
      throw new PublicError(502, 'Home Assistant hat eine ung\u00fcltige Antwort gesendet.', 'home_assistant_invalid_json');
    }
  } catch (err) {
    if (err instanceof PublicError) throw err;
    if (err && err.name === 'AbortError') {
      throw new PublicError(504, 'Home Assistant antwortet nicht rechtzeitig.', 'home_assistant_timeout');
    }
    const detail = formatFetchErrorCode(err);
    console.error('Home Assistant request error:', { path, detail, err });
    throw new PublicError(
      502,
      detail ? `Home Assistant ist nicht erreichbar (${detail}).` : 'Home Assistant ist nicht erreichbar.',
      'home_assistant_unreachable'
    );
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePosition(value) {
  if (value === null || value === undefined || value === '') return null;
  const position = Number(value);
  if (!Number.isFinite(position)) return null;
  return Math.max(0, Math.min(100, Math.round(position)));
}

function humanizeEntityId(entityId) {
  const slug = String(entityId || '').replace(/^(cover|light)\./, '');
  return slug
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeCoverEntity(state, areaMap = {}) {
  const entityId = String(state && state.entity_id ? state.entity_id : '');
  const attrs = (state && state.attributes && typeof state.attributes === 'object') ? state.attributes : {};
  const rawState = String((state && state.state) || 'unavailable');
  const position = normalizePosition(attrs.current_position);
  const supportedFeatures = Number(attrs.supported_features) || 0;
  const supportsPosition = position !== null || Boolean(supportedFeatures & 4);
  const friendlyName = typeof attrs.friendly_name === 'string' && attrs.friendly_name.trim()
    ? attrs.friendly_name.trim()
    : humanizeEntityId(entityId);

  return {
    entity_id: entityId,
    domain: 'cover',
    name: friendlyName,
    area: (state && typeof state.area === 'string' && state.area.trim()) || areaMap[entityId] || null,
    device_class: typeof attrs.device_class === 'string' ? attrs.device_class : null,
    state: COVER_STATES.has(rawState) ? rawState : 'unavailable',
    position,
    supports_position: supportsPosition,
    is_group: Boolean(attrs.is_group) || (Array.isArray(attrs.entity_id) && attrs.entity_id.length > 0),
    updated_at: (state && (state.last_updated || state.last_changed)) || null,
  };
}

function normalizeLightEntity(state, areaMap = {}) {
  const entityId = String(state && state.entity_id ? state.entity_id : '');
  const attrs = (state && state.attributes && typeof state.attributes === 'object') ? state.attributes : {};
  const rawState = String((state && state.state) || 'unavailable');
  const modes = Array.isArray(attrs.supported_color_modes) ? attrs.supported_color_modes.map(String) : [];

  const rawBrightness = attrs.brightness !== null && attrs.brightness !== undefined ? Number(attrs.brightness) : NaN;
  const brightnessPct = Number.isFinite(rawBrightness)
    ? Math.max(1, Math.min(100, Math.round((rawBrightness / 255) * 100)))
    : null;

  const supportsBrightness = brightnessPct !== null || modes.some((mode) => COLOR_MODES_WITH_BRIGHTNESS.has(mode));
  const supportsColorTemp = modes.includes('color_temp') || Number.isFinite(Number(attrs.color_temp_kelvin));
  const supportsColor = modes.some((mode) => COLOR_MODES_WITH_COLOR.has(mode)) || Array.isArray(attrs.rgb_color);

  const colorTempKelvin = Number.isFinite(Number(attrs.color_temp_kelvin)) ? Math.round(Number(attrs.color_temp_kelvin)) : null;
  const minKelvin = Number.isFinite(Number(attrs.min_color_temp_kelvin)) ? Math.round(Number(attrs.min_color_temp_kelvin)) : 2200;
  const maxKelvin = Number.isFinite(Number(attrs.max_color_temp_kelvin)) ? Math.round(Number(attrs.max_color_temp_kelvin)) : 6500;

  let rgbColor = null;
  if (Array.isArray(attrs.rgb_color) && attrs.rgb_color.length === 3) {
    const nums = attrs.rgb_color.map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))));
    if (nums.every((n) => Number.isFinite(n))) rgbColor = nums;
  }

  const friendlyName = typeof attrs.friendly_name === 'string' && attrs.friendly_name.trim()
    ? attrs.friendly_name.trim()
    : humanizeEntityId(entityId);

  return {
    entity_id: entityId,
    domain: 'light',
    name: friendlyName,
    area: (state && typeof state.area === 'string' && state.area.trim()) || areaMap[entityId] || null,
    state: LIGHT_STATES.has(rawState) ? rawState : 'unavailable',
    brightness_pct: rawState === 'on' ? brightnessPct : null,
    supports_brightness: supportsBrightness,
    supports_color_temp: supportsColorTemp,
    color_temp_kelvin: rawState === 'on' ? colorTempKelvin : null,
    min_color_temp_kelvin: minKelvin,
    max_color_temp_kelvin: maxKelvin,
    supports_color: supportsColor,
    rgb_color: rawState === 'on' ? rgbColor : null,
    is_group: Boolean(attrs.is_group) || (Array.isArray(attrs.entity_id) && attrs.entity_id.length > 0),
    updated_at: (state && (state.last_updated || state.last_changed)) || null,
  };
}

/**
 * Ruft gezielt nur Rollläden & Lampen inkl. HA-Raumnamen über `/api/template` ab (~5–15 KB statt mehrerer MB
 * beim kompletten `/api/states`). Vermeidet Proxy-/Socket-Abbrüche bei großen HA-Installationen.
 */
async function fetchDevicesViaTemplate() {
  const template = [
    '{% set ns = namespace(covers=[], lights=[]) %}',
    '{% for s in states.cover %}',
    '{% set eids = s.attributes.get("entity_id") %}',
    '{% set ns.covers = ns.covers + [{',
    '"entity_id": s.entity_id,',
    '"state": s.state,',
    '"last_updated": s.last_updated.isoformat() if s.last_updated else none,',
    '"area": area_name(s.entity_id),',
    '"attributes": {',
    '"friendly_name": s.attributes.get("friendly_name"),',
    '"current_position": s.attributes.get("current_position"),',
    '"supported_features": s.attributes.get("supported_features"),',
    '"device_class": s.attributes.get("device_class"),',
    '"is_group": (eids is sequence and eids is not string and (eids | length) > 0)',
    '}}] %}',
    '{% endfor %}',
    '{% for s in states.light %}',
    '{% set eids = s.attributes.get("entity_id") %}',
    '{% set modes = s.attributes.get("supported_color_modes") %}',
    '{% set rgb = s.attributes.get("rgb_color") %}',
    '{% set ns.lights = ns.lights + [{',
    '"entity_id": s.entity_id,',
    '"state": s.state,',
    '"last_updated": s.last_updated.isoformat() if s.last_updated else none,',
    '"area": area_name(s.entity_id),',
    '"attributes": {',
    '"friendly_name": s.attributes.get("friendly_name"),',
    '"brightness": s.attributes.get("brightness"),',
    '"supported_color_modes": (modes | list) if modes else [],',
    '"color_temp_kelvin": s.attributes.get("color_temp_kelvin"),',
    '"min_color_temp_kelvin": s.attributes.get("min_color_temp_kelvin"),',
    '"max_color_temp_kelvin": s.attributes.get("max_color_temp_kelvin"),',
    '"rgb_color": (rgb | list) if rgb else none,',
    '"is_group": (eids is sequence and eids is not string and (eids | length) > 0)',
    '}}] %}',
    '{% endfor %}',
    '{{ {"covers": ns.covers, "lights": ns.lights} | to_json }}',
  ].join('');

  const raw = await requestHomeAssistant('/api/template', {
    method: 'POST',
    body: { template },
    rawText: true,
    timeoutMs: 11000,
  });
  if (!raw || typeof raw !== 'string') return null;
  const parsed = JSON.parse(raw.trim());
  if (!parsed || typeof parsed !== 'object' || (!Array.isArray(parsed.covers) && !Array.isArray(parsed.lights))) {
    return null;
  }
  return {
    covers: Array.isArray(parsed.covers) ? parsed.covers : [],
    lights: Array.isArray(parsed.lights) ? parsed.lights : [],
  };
}

function buildDevicesResponse(rawCovers, rawLights, areaMap = {}) {
  const covers = rawCovers.map((state) => normalizeCoverEntity(state, areaMap));
  const lights = rawLights.map((state) => normalizeLightEntity(state, areaMap));

  const byName = (a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
  covers.sort(byName);
  lights.sort(byName);

  const areaSet = new Set();
  for (const item of [...covers, ...lights]) {
    if (item.area) areaSet.add(item.area);
  }
  const areas = Array.from(areaSet).sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));

  return {
    updated_at: new Date().toISOString(),
    covers,
    lights,
    areas,
  };
}

async function getSmartHomeDevices() {
  // 1. Primär: leichtgewichtiges /api/template (nur cover.* & light.* inkl. Räumen)
  let templateErr = null;
  try {
    const viaTemplate = await fetchDevicesViaTemplate();
    if (viaTemplate) {
      return buildDevicesResponse(viaTemplate.covers, viaTemplate.lights);
    }
  } catch (err) {
    templateErr = err;
    console.warn('Home Assistant /api/template failed, falling back to /api/states:', err && err.message);
  }

  // 2. Fallback: klassisches /api/states
  try {
    const allStates = await requestHomeAssistant('/api/states', { timeoutMs: 12000 });
    const list = Array.isArray(allStates) ? allStates : [];
    const rawCovers = [];
    const rawLights = [];
    for (const state of list) {
      if (!state || typeof state !== 'object' || typeof state.entity_id !== 'string') continue;
      if (state.entity_id.startsWith('cover.')) rawCovers.push(state);
      else if (state.entity_id.startsWith('light.')) rawLights.push(state);
    }
    return buildDevicesResponse(rawCovers, rawLights);
  } catch (statesErr) {
    throw statesErr || templateErr;
  }
}

function validateDeviceAction(input) {
  const entityId = String((input && input.entity_id) || '').trim();
  const action = String((input && input.action) || '').trim();

  if (!ALLOWED_DEVICE_ID.test(entityId)) {
    throw new PublicError(400, 'Nur Rollläden (cover.*) und Lampen (light.*) dürfen gesteuert werden.', 'invalid_entity');
  }

  if (entityId.startsWith('cover.')) {
    const service = COVER_ACTIONS[action];
    if (!service) {
      throw new PublicError(400, 'Unbekannte Rollladen-Aktion.', 'unknown_action');
    }
    const body = { entity_id: entityId };
    if (action === 'set_position') {
      const position = normalizePosition(input.position);
      if (position === null) {
        throw new PublicError(400, 'Position muss zwischen 0 und 100 liegen.', 'invalid_position');
      }
      body.position = position;
    }
    return { domain: 'cover', service, body };
  }

  const service = LIGHT_ACTIONS[action];
  if (!service) {
    throw new PublicError(400, 'Unbekannte Lampen-Aktion.', 'unknown_action');
  }

  const body = { entity_id: entityId };
  if (action === 'turn_on') {
    if (input.brightness_pct !== undefined && input.brightness_pct !== null) {
      const pct = Number(input.brightness_pct);
      if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
        throw new PublicError(400, 'Helligkeit muss zwischen 1 und 100 % liegen.', 'invalid_brightness');
      }
      body.brightness_pct = Math.round(pct);
    }
    if (input.color_temp_kelvin !== undefined && input.color_temp_kelvin !== null) {
      const kelvin = Number(input.color_temp_kelvin);
      if (!Number.isFinite(kelvin) || kelvin < 1500 || kelvin > 9000) {
        throw new PublicError(400, 'Farbtemperatur muss zwischen 1500 K und 9000 K liegen.', 'invalid_color_temp');
      }
      body.color_temp_kelvin = Math.round(kelvin);
    }
    if (input.rgb_color !== undefined && input.rgb_color !== null) {
      if (!Array.isArray(input.rgb_color) || input.rgb_color.length !== 3) {
        throw new PublicError(400, 'RGB-Farbe muss aus 3 Werten (0–255) bestehen.', 'invalid_rgb');
      }
      const rgb = input.rgb_color.map((n) => Number(n));
      if (rgb.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
        throw new PublicError(400, 'RGB-Werte müssen zwischen 0 und 255 liegen.', 'invalid_rgb');
      }
      body.rgb_color = rgb.map((n) => Math.round(n));
    }
  }

  return { domain: 'light', service, body };
}

async function sendDeviceAction(input) {
  const { domain, service, body } = validateDeviceAction(input);
  await requestHomeAssistant(`/api/services/${domain}/${service}`, {
    method: 'POST',
    body,
  });
}

function normalizeCover(cover, state) {
  if (!state || typeof state !== 'object') {
    return {
      ...cover,
      state: 'unavailable',
      position: null,
      updated_at: null,
    };
  }

  const rawState = String(state.state || 'unavailable');

  return {
    ...cover,
    state: COVER_STATES.has(rawState) ? rawState : 'unavailable',
    position: normalizePosition(state.attributes && state.attributes.current_position),
    updated_at: state.last_updated || state.last_changed || null,
  };
}

async function getCoverStates() {
  const states = await Promise.all(
    COVERS.map(async (cover) => {
      const state = await requestHomeAssistant(`/api/states/${encodeURIComponent(cover.entity_id)}`, {
        allowNotFound: true,
      });
      return normalizeCover(cover, state);
    }),
  );

  return {
    updated_at: new Date().toISOString(),
    covers: states,
  };
}

function findCover(entityId) {
  const cover = COVERS.find((item) => item.entity_id === entityId);
  if (!cover) throw new PublicError(400, 'Unbekannter Rollladen.', 'unknown_cover');
  return cover;
}

function parseJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;

  try {
    return JSON.parse(req.body);
  } catch (_) {
    throw new PublicError(400, 'Ung\u00fcltiger Request-Body.', 'invalid_body');
  }
}

async function sendCoverAction(input) {
  const entityId = String(input.entity_id || '').trim();
  const action = String(input.action || '').trim();
  const service = COVER_ACTIONS[action];

  findCover(entityId);

  if (!service) {
    throw new PublicError(400, 'Unbekannte Rollladen-Aktion.', 'unknown_action');
  }

  const body = { entity_id: entityId };

  if (action === 'set_position') {
    const position = normalizePosition(input.position);
    if (position === null) {
      throw new PublicError(400, 'Position muss zwischen 0 und 100 liegen.', 'invalid_position');
    }
    body.position = position;
  }

  await requestHomeAssistant(`/api/services/cover/${service}`, {
    method: 'POST',
    body,
  });
}

function sendError(res, err) {
  if (err instanceof PublicError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }

  console.error('Unhandled Home Assistant API error:', err);
  return res.status(500).json({ error: 'Unerwarteter Serverfehler.', code: 'internal_error' });
}

module.exports = {
  PublicError,
  parseJsonBody,
  sendCoverAction,
  sendDeviceAction,
  sendError,
  setApiHeaders,
  getCoverStates,
  getSmartHomeDevices,
  normalizeCoverEntity,
  normalizeLightEntity,
  validateDeviceAction,
  verifyAdultUser,
};
