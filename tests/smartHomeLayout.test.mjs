import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SECTION_ID,
  addSection,
  deleteSection,
  filterSmartHomeDevices,
  getAllPinnedEntityIds,
  moveEntityInSection,
  moveSection,
  normalizeLayout,
  removeEntityFromSection,
  renameSection,
  setSectionEntities,
  togglePinEntity,
} from '../src/pages/smartHomeLayout.ts';

test('normalizeLayout legt eine Standardgruppe an und dedupliziert Einträge', () => {
  const empty = normalizeLayout(undefined);
  assert.equal(empty.sections.length, 1);
  assert.equal(empty.sections[0].id, DEFAULT_SECTION_ID);
  assert.deepEqual(empty.sections[0].entityIds, []);

  const cleaned = normalizeLayout({
    sections: [
      { id: 'eg', title: ' Erdgeschoss ', entityIds: ['light.a', 'light.a', '', 'cover.b'] },
    ],
  });
  assert.equal(cleaned.sections[0].title, 'Erdgeschoss');
  assert.deepEqual(cleaned.sections[0].entityIds, ['light.a', 'cover.b']);
});

test('Geräte pinnen, sortieren, entfernen und Gruppen verwalten', () => {
  let layout = normalizeLayout(null);
  layout = togglePinEntity(layout, 'light.wohnzimmer');
  layout = togglePinEntity(layout, 'cover.terrasse');
  assert.deepEqual(layout.sections[0].entityIds, ['light.wohnzimmer', 'cover.terrasse']);

  layout = moveEntityInSection(layout, DEFAULT_SECTION_ID, 'cover.terrasse', -1);
  assert.deepEqual(layout.sections[0].entityIds, ['cover.terrasse', 'light.wohnzimmer']);

  layout = addSection(layout, 'Abends', 'abends');
  layout = setSectionEntities(layout, 'abends', ['light.flur', 'cover.schlafzimmer']);
  layout = renameSection(layout, 'abends', 'Gute Nacht');
  assert.equal(layout.sections[1].title, 'Gute Nacht');

  layout = moveSection(layout, 'abends', -1);
  assert.equal(layout.sections[0].id, 'abends');

  const pinned = getAllPinnedEntityIds(layout);
  assert.equal(pinned.size, 4);

  layout = removeEntityFromSection(layout, 'abends', 'light.flur');
  assert.deepEqual(layout.sections[0].entityIds, ['cover.schlafzimmer']);

  layout = togglePinEntity(layout, 'light.wohnzimmer');
  assert.equal(getAllPinnedEntityIds(layout).has('light.wohnzimmer'), false);

  layout = deleteSection(layout, 'abends');
  assert.equal(layout.sections.length, 1);
});

test('filterSmartHomeDevices filtert nach Typ, Raum, Aktiv-Status und Suche', () => {
  const devices = [
    {
      entity_id: 'light.wohnzimmer_decke',
      domain: 'light',
      name: 'Wohnzimmer Decke',
      area: 'Wohnzimmer',
      state: 'on',
      brightness_pct: 80,
      supports_brightness: true,
      supports_color_temp: false,
      color_temp_kelvin: null,
      min_color_temp_kelvin: 2200,
      max_color_temp_kelvin: 6500,
      supports_color: false,
      rgb_color: null,
      is_group: false,
      updated_at: null,
    },
    {
      entity_id: 'light.kueche_spot',
      domain: 'light',
      name: 'Küche Spot',
      area: 'Küche',
      state: 'off',
      brightness_pct: null,
      supports_brightness: false,
      supports_color_temp: false,
      color_temp_kelvin: null,
      min_color_temp_kelvin: 2200,
      max_color_temp_kelvin: 6500,
      supports_color: false,
      rgb_color: null,
      is_group: false,
      updated_at: null,
    },
    {
      entity_id: 'cover.wohnzimmer_links',
      domain: 'cover',
      name: 'Wohnzimmer Links',
      area: 'Wohnzimmer',
      device_class: 'shutter',
      state: 'open',
      position: 100,
      supports_position: true,
      is_group: false,
      updated_at: null,
    },
  ];

  assert.equal(filterSmartHomeDevices(devices, { domainFilter: 'light', areaFilter: 'all', query: '' }).length, 2);
  assert.equal(filterSmartHomeDevices(devices, { domainFilter: 'cover', areaFilter: 'all', query: '' }).length, 1);
  assert.equal(filterSmartHomeDevices(devices, { domainFilter: 'active', areaFilter: 'all', query: '' }).length, 2);
  assert.equal(filterSmartHomeDevices(devices, { domainFilter: 'all', areaFilter: 'Wohnzimmer', query: '' }).length, 2);
  assert.equal(filterSmartHomeDevices(devices, { domainFilter: 'all', areaFilter: 'all', query: 'küche' }).length, 1);
});
