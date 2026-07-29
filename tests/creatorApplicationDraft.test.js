import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearCreatorApplicationDraft,
  loadCreatorApplicationDraft,
  saveCreatorApplicationDraft,
} from '../src/utils/creatorApplicationDraft.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('restores a creator application draft only for its account', () => {
  const storage = memoryStorage();
  const form = {
    name: 'Avery Creator',
    bio: 'A professional creator biography.',
    portfolio: [{ title: 'Campaign', imageUrl: 'storage://creator-portfolio/user/campaign.jpg' }],
  };
  saveCreatorApplicationDraft(storage, 'user-a', form);

  assert.deepEqual(loadCreatorApplicationDraft(storage, 'user-a'), form);
  assert.equal(loadCreatorApplicationDraft(storage, 'user-b'), null);
});

test('ignores corrupted drafts and clears completed drafts', () => {
  const storage = memoryStorage();
  storage.setItem('creatorbridge:creator-application-draft:user-a', '{bad json');
  assert.equal(loadCreatorApplicationDraft(storage, 'user-a'), null);

  saveCreatorApplicationDraft(storage, 'user-a', { name: 'Avery' });
  clearCreatorApplicationDraft(storage, 'user-a');
  assert.equal(loadCreatorApplicationDraft(storage, 'user-a'), null);
});
