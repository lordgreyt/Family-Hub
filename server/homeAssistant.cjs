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
const COVER_ACTIONS = {
  open: 'open_cover',
  close: 'close_cover',
  stop: 'stop_cover',
  set_position: 'set_cover_position',
};

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

async function requestHomeAssistant(path, options = {}) {
  const { url, token } = homeAssistantConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

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
      throw new PublicError(502, 'Home Assistant hat die Anfrage abgelehnt.', 'home_assistant_error');
    }

    if (!text) return null;

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
    console.error('Home Assistant request error:', { path, err });
    throw new PublicError(502, 'Home Assistant ist nicht erreichbar.', 'home_assistant_unreachable');
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePosition(value) {
  const position = Number(value);
  if (!Number.isFinite(position)) return null;
  return Math.max(0, Math.min(100, Math.round(position)));
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
  parseJsonBody,
  sendCoverAction,
  sendError,
  setApiHeaders,
  getCoverStates,
  verifyAdultUser,
};
