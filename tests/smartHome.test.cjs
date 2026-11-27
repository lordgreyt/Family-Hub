const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const {
  normalizeCoverEntity,
  normalizeLightEntity,
  validateDeviceAction,
} = require('../server/homeAssistant.cjs');

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

test('smart home devices endpoint rejects unauthenticated GET and POST with 401', async () => {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'api', 'home-assistant', 'devices.js')).href;
  const { default: handler } = await import(moduleUrl);

  const getRes = mockRes();
  await handler({ method: 'GET', headers: {} }, getRes);
  assert.equal(getRes.statusCode, 401);

  const postRes = mockRes();
  await handler(
    { method: 'POST', headers: {}, body: { entity_id: 'light.wohnzimmer', action: 'turn_on' } },
    postRes
  );
  assert.equal(postRes.statusCode, 401);
});

test('validateDeviceAction allows valid cover and light commands', () => {
  assert.deepEqual(
    validateDeviceAction({ entity_id: 'cover.wohnzimmer_links', action: 'set_position', position: 65 }),
    { domain: 'cover', service: 'set_cover_position', body: { entity_id: 'cover.wohnzimmer_links', position: 65 } }
  );

  assert.deepEqual(
    validateDeviceAction({
      entity_id: 'light.essbereich_decke',
      action: 'turn_on',
      brightness_pct: 75,
      color_temp_kelvin: 2700,
    }),
    {
      domain: 'light',
      service: 'turn_on',
      body: { entity_id: 'light.essbereich_decke', brightness_pct: 75, color_temp_kelvin: 2700 },
    }
  );

  assert.deepEqual(
    validateDeviceAction({
      entity_id: 'light.stehlampe',
      action: 'turn_on',
      rgb_color: [255, 145, 55],
    }),
    {
      domain: 'light',
      service: 'turn_on',
      body: { entity_id: 'light.stehlampe', rgb_color: [255, 145, 55] },
    }
  );
});

test('validateDeviceAction blocks non-cover/non-light domains and out-of-range parameters', () => {
  for (const entity_id of ['lock.haustuer', 'script.reboot', 'switch.steckdose', 'cover.BAD-ID!']) {
    assert.throws(
      () => validateDeviceAction({ entity_id, action: 'turn_on' }),
      err => err && err.status === 400
    );
  }

  assert.throws(
    () => validateDeviceAction({ entity_id: 'light.kueche', action: 'turn_on', brightness_pct: 120 }),
    err => err && err.status === 400
  );

  assert.throws(
    () => validateDeviceAction({ entity_id: 'light.kueche', action: 'turn_on', rgb_color: [255, 300, 0] }),
    err => err && err.status === 400
  );

  assert.throws(
    () => validateDeviceAction({ entity_id: 'cover.kueche', action: 'turn_on' }),
    err => err && err.status === 400
  );
});

test('normalizeLightEntity and normalizeCoverEntity extract attributes, areas, and capabilities', () => {
  const light = normalizeLightEntity(
    {
      entity_id: 'light.wohnzimmer_decke',
      state: 'on',
      attributes: {
        friendly_name: 'Wohnzimmer Decke',
        brightness: 128,
        supported_color_modes: ['color_temp', 'rgb'],
        color_temp_kelvin: 3000,
        min_color_temp_kelvin: 2200,
        max_color_temp_kelvin: 6500,
        rgb_color: [255, 200, 120],
        entity_id: ['light.spot_1', 'light.spot_2'],
      },
      last_updated: '2026-11-27T09:00:00Z',
    },
    { 'light.wohnzimmer_decke': 'Wohnzimmer' }
  );

  assert.equal(light.domain, 'light');
  assert.equal(light.name, 'Wohnzimmer Decke');
  assert.equal(light.area, 'Wohnzimmer');
  assert.equal(light.state, 'on');
  assert.equal(light.brightness_pct, 50);
  assert.equal(light.supports_brightness, true);
  assert.equal(light.supports_color_temp, true);
  assert.equal(light.supports_color, true);
  assert.equal(light.is_group, true);

  const cover = normalizeCoverEntity(
    {
      entity_id: 'cover.kueche_fenster',
      state: 'open',
      attributes: {
        friendly_name: 'Küche Fenster',
        current_position: 80,
        supported_features: 15,
      },
    },
    { 'cover.kueche_fenster': 'Küche' }
  );

  assert.equal(cover.domain, 'cover');
  assert.equal(cover.area, 'Küche');
  assert.equal(cover.position, 80);
  assert.equal(cover.supports_position, true);
});
