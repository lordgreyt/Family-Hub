import type { SmartHomeLayout, SmartHomeSection } from '../services/mockDb';
import type { HomeAssistantDevice } from '../services/homeAssistant';

export type DeviceDomainFilter = 'all' | 'light' | 'cover' | 'active';

export const DEFAULT_SECTION_ID = 'favorites';
export const DEFAULT_SECTION_TITLE = 'Meine Geräte';

export function normalizeLayout(raw?: SmartHomeLayout | null): SmartHomeLayout {
  const rawSections = Array.isArray(raw?.sections) ? raw.sections : [];
  const sections: SmartHomeSection[] = [];
  const seenSectionIds = new Set<string>();

  for (const item of rawSections) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `sec_${sections.length + 1}`;
    if (seenSectionIds.has(id)) continue;
    seenSectionIds.add(id);

    const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : DEFAULT_SECTION_TITLE;
    const seenEntities = new Set<string>();
    const entityIds = (Array.isArray(item.entityIds) ? item.entityIds : [])
      .map(e => (typeof e === 'string' ? e.trim() : ''))
      .filter(e => {
        if (!e || seenEntities.has(e)) return false;
        seenEntities.add(e);
        return true;
      });

    sections.push({ id, title, entityIds });
  }

  if (sections.length === 0) {
    return {
      sections: [{ id: DEFAULT_SECTION_ID, title: DEFAULT_SECTION_TITLE, entityIds: [] }],
    };
  }

  return { sections };
}

export function getAllPinnedEntityIds(layout: SmartHomeLayout): Set<string> {
  const result = new Set<string>();
  for (const section of layout.sections) {
    for (const entityId of section.entityIds) {
      result.add(entityId);
    }
  }
  return result;
}

export function isEntityPinned(layout: SmartHomeLayout, entityId: string): boolean {
  return layout.sections.some(section => section.entityIds.includes(entityId));
}

/** Fügt ein Gerät zur Zielgruppe hinzu (oder entfernt es aus allen Gruppen, falls schon gepinnt). */
export function togglePinEntity(
  layout: SmartHomeLayout,
  entityId: string,
  targetSectionId?: string
): SmartHomeLayout {
  const normalized = normalizeLayout(layout);
  if (isEntityPinned(normalized, entityId)) {
    return {
      sections: normalized.sections.map(section => ({
        ...section,
        entityIds: section.entityIds.filter(id => id !== entityId),
      })),
    };
  }

  const targetId =
    targetSectionId && normalized.sections.some(s => s.id === targetSectionId)
      ? targetSectionId
      : normalized.sections[0].id;

  return {
    sections: normalized.sections.map(section =>
      section.id === targetId
        ? { ...section, entityIds: [...section.entityIds, entityId] }
        : section
    ),
  };
}

export function setSectionEntities(
  layout: SmartHomeLayout,
  sectionId: string,
  entityIds: string[]
): SmartHomeLayout {
  const normalized = normalizeLayout(layout);
  const unique = Array.from(new Set(entityIds.map(e => e.trim()).filter(Boolean)));
  return {
    sections: normalized.sections.map(section =>
      section.id === sectionId ? { ...section, entityIds: unique } : section
    ),
  };
}

export function removeEntityFromSection(
  layout: SmartHomeLayout,
  sectionId: string,
  entityId: string
): SmartHomeLayout {
  const normalized = normalizeLayout(layout);
  return {
    sections: normalized.sections.map(section =>
      section.id === sectionId
        ? { ...section, entityIds: section.entityIds.filter(id => id !== entityId) }
        : section
    ),
  };
}

export function moveEntityInSection(
  layout: SmartHomeLayout,
  sectionId: string,
  entityId: string,
  direction: -1 | 1
): SmartHomeLayout {
  const normalized = normalizeLayout(layout);
  return {
    sections: normalized.sections.map(section => {
      if (section.id !== sectionId) return section;
      const idx = section.entityIds.indexOf(entityId);
      const nextIdx = idx + direction;
      if (idx < 0 || nextIdx < 0 || nextIdx >= section.entityIds.length) return section;
      const next = [...section.entityIds];
      [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
      return { ...section, entityIds: next };
    }),
  };
}

export function addSection(layout: SmartHomeLayout, title: string, id?: string): SmartHomeLayout {
  const normalized = normalizeLayout(layout);
  const cleanTitle = title.trim();
  if (!cleanTitle) return normalized;
  const newId = id || `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    sections: [...normalized.sections, { id: newId, title: cleanTitle, entityIds: [] }],
  };
}

export function renameSection(layout: SmartHomeLayout, sectionId: string, newTitle: string): SmartHomeLayout {
  const normalized = normalizeLayout(layout);
  const cleanTitle = newTitle.trim();
  if (!cleanTitle) return normalized;
  return {
    sections: normalized.sections.map(section =>
      section.id === sectionId ? { ...section, title: cleanTitle } : section
    ),
  };
}

export function deleteSection(layout: SmartHomeLayout, sectionId: string): SmartHomeLayout {
  const normalized = normalizeLayout(layout);
  const remaining = normalized.sections.filter(section => section.id !== sectionId);
  if (remaining.length === 0) {
    return {
      sections: [{ id: DEFAULT_SECTION_ID, title: DEFAULT_SECTION_TITLE, entityIds: [] }],
    };
  }
  return { sections: remaining };
}

export function moveSection(layout: SmartHomeLayout, sectionId: string, direction: -1 | 1): SmartHomeLayout {
  const normalized = normalizeLayout(layout);
  const idx = normalized.sections.findIndex(section => section.id === sectionId);
  const nextIdx = idx + direction;
  if (idx < 0 || nextIdx < 0 || nextIdx >= normalized.sections.length) return normalized;
  const next = [...normalized.sections];
  [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
  return { sections: next };
}

export function isDeviceActive(device: HomeAssistantDevice): boolean {
  if (device.domain === 'light') return device.state === 'on';
  return device.state !== 'unavailable' && device.position !== null && device.position > 0;
}

export function filterSmartHomeDevices(
  devices: HomeAssistantDevice[],
  options: {
    domainFilter: DeviceDomainFilter;
    areaFilter: string;
    query: string;
  }
): HomeAssistantDevice[] {
  const q = options.query.trim().toLowerCase();
  return devices.filter(device => {
    if (options.domainFilter === 'light' && device.domain !== 'light') return false;
    if (options.domainFilter === 'cover' && device.domain !== 'cover') return false;
    if (options.domainFilter === 'active' && !isDeviceActive(device)) return false;

    if (options.areaFilter && options.areaFilter !== 'all') {
      if (options.areaFilter === '__none__') {
        if (device.area) return false;
      } else if (device.area !== options.areaFilter) {
        return false;
      }
    }

    if (q) {
      const hay = `${device.name} ${device.area || ''} ${device.entity_id}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}
