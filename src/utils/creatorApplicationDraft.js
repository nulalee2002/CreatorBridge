const DRAFT_PREFIX = 'creatorbridge:creator-application-draft:';

function keyFor(userId) {
  const normalized = String(userId || '').trim();
  if (!normalized) return null;
  return `${DRAFT_PREFIX}${normalized}`;
}

export function loadCreatorApplicationDraft(storage, userId) {
  const key = keyFor(userId);
  if (!storage || !key) return null;
  try {
    const parsed = JSON.parse(storage.getItem(key) || 'null');
    return parsed?.version === 1 && parsed.form && typeof parsed.form === 'object'
      ? parsed.form
      : null;
  } catch {
    return null;
  }
}

export function saveCreatorApplicationDraft(storage, userId, form) {
  const key = keyFor(userId);
  if (!storage || !key || !form || typeof form !== 'object') return false;
  storage.setItem(key, JSON.stringify({
    version: 1,
    savedAt: new Date().toISOString(),
    form,
  }));
  return true;
}

export function clearCreatorApplicationDraft(storage, userId) {
  const key = keyFor(userId);
  if (!storage || !key) return false;
  storage.removeItem(key);
  return true;
}
