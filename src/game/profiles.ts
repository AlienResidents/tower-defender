/**
 * Operator profiles — multiple named saves on one browser.
 *
 * A profile is a named pointer at a per-profile meta blob; the MetaState
 * schema itself is untouched. The registry lives at REGISTRY_KEY, each
 * profile's save at META_PREFIX + id, and meta.ts resolves the active
 * profile's key via activeMetaKey(). That indirection is the seam for a
 * future server backend: swap key→localStorage for id→fetch without
 * touching MetaState callers.
 *
 * Legacy saves (single anonymous blob at the pre-profiles key) are adopted
 * into OPERATOR-01 on first load — nothing is lost.
 */

export interface Profile {
  id: string;
  name: string;
  createdAt: number;
  lastPlayedAt: number;
}

interface ProfileRegistry {
  profiles: Profile[];
  activeId: string | null;
}

const REGISTRY_KEY = 'phosphor.profiles.v1';
/** Pre-profiles single-save key — adopted into OPERATOR-01, then removed. */
export const LEGACY_META_KEY = 'phosphor.meta.v1';
const META_PREFIX = 'phosphor.meta.v1.p_';

export function metaKeyFor(profileId: string): string {
  return META_PREFIX + profileId;
}

function newId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nextDefaultName(registry: ProfileRegistry): string {
  let n = registry.profiles.length + 1;
  const names = new Set(registry.profiles.map((p) => p.name));
  while (names.has(`OPERATOR-${String(n).padStart(2, '0')}`)) n++;
  return `OPERATOR-${String(n).padStart(2, '0')}`;
}

function loadRegistry(): ProfileRegistry | null {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProfileRegistry>;
    if (!Array.isArray(parsed.profiles)) return null;
    return {
      profiles: parsed.profiles.filter(
        (p): p is Profile => typeof p?.id === 'string' && typeof p?.name === 'string',
      ),
      activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
    };
  } catch {
    return null; // corrupt or unavailable — rebuilt fresh
  }
}

function saveRegistry(registry: ProfileRegistry): void {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // storage unavailable — session-only profiles
  }
}

function adoptLegacy(registry: ProfileRegistry): void {
  try {
    const legacy = localStorage.getItem(LEGACY_META_KEY);
    if (legacy === null) return;
    const profile: Profile = {
      id: newId(),
      name: nextDefaultName(registry),
      createdAt: Date.now(),
      lastPlayedAt: Date.now(),
    };
    registry.profiles.push(profile);
    registry.activeId = profile.id;
    localStorage.setItem(metaKeyFor(profile.id), legacy);
    localStorage.removeItem(LEGACY_META_KEY);
  } catch {
    // storage unavailable — registry still valid, legacy copy skipped
  }
}

function ensureRegistry(): ProfileRegistry {
  let registry = loadRegistry();
  if (!registry) registry = { profiles: [], activeId: null };
  if (registry.profiles.length === 0) {
    adoptLegacy(registry);
    if (registry.profiles.length === 0) {
      const now = Date.now();
      registry.profiles.push({ id: newId(), name: 'OPERATOR-01', createdAt: now, lastPlayedAt: now });
    }
    registry.activeId ??= registry.profiles[0].id;
    saveRegistry(registry);
  }
  if (!registry.activeId || !registry.profiles.some((p) => p.id === registry.activeId)) {
    registry.activeId = registry.profiles[0].id;
    saveRegistry(registry);
  }
  return registry;
}

/** Storage key for the active profile's meta blob — the meta.ts seam. */
export function activeMetaKey(): string {
  return metaKeyFor(ensureRegistry().activeId!);
}

export function listProfiles(): Profile[] {
  return [...ensureRegistry().profiles];
}

export function getActiveProfile(): Profile {
  const registry = ensureRegistry();
  return registry.profiles.find((p) => p.id === registry.activeId)!;
}

export function createProfile(name?: string): Profile {
  const registry = ensureRegistry();
  const trimmed = name?.trim();
  const now = Date.now();
  const profile: Profile = {
    id: newId(),
    name: trimmed && trimmed.length > 0 ? trimmed.slice(0, 24) : nextDefaultName(registry),
    createdAt: now,
    lastPlayedAt: now,
  };
  registry.profiles.push(profile);
  saveRegistry(registry);
  return profile;
}

export function switchProfile(id: string): boolean {
  const registry = ensureRegistry();
  const profile = registry.profiles.find((p) => p.id === id);
  if (!profile) return false;
  registry.activeId = id;
  profile.lastPlayedAt = Date.now();
  saveRegistry(registry);
  return true;
}

/**
 * Deletes a profile and its meta blob. Deleting the active profile falls
 * back to the next remaining profile, or a fresh OPERATOR-01 when the last
 * one goes. Returns the id that is active afterwards.
 */
export function deleteProfile(id: string): string {
  const registry = ensureRegistry();
  registry.profiles = registry.profiles.filter((p) => p.id !== id);
  try {
    localStorage.removeItem(metaKeyFor(id));
  } catch {
    // ignore
  }
  if (registry.activeId === id) registry.activeId = registry.profiles[0]?.id ?? null;
  if (registry.profiles.length === 0) {
    const now = Date.now();
    registry.profiles.push({ id: newId(), name: 'OPERATOR-01', createdAt: now, lastPlayedAt: now });
    registry.activeId = registry.profiles[0].id;
  }
  saveRegistry(registry);
  return registry.activeId!;
}
