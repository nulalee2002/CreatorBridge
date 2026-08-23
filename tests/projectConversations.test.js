import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const utilityUrl = new URL('../src/utils/projectConversations.js', import.meta.url);
const migrationUrl = new URL('../supabase/migrations/20260823040512_project_conversations.sql', import.meta.url);

test('same participants stay in distinct project threads', async () => {
  assert.equal(existsSync(utilityUrl), true, 'project conversation utility must exist');
  const { buildProjectThreadKey } = await import(utilityUrl);
  const common = { senderId: 'client', recipientId: 'creator', remoteConversationId: 'shared' };
  assert.equal(buildProjectThreadKey({ ...common, projectId: 'project-a' }), 'project:project-a');
  assert.equal(buildProjectThreadKey({ ...common, projectId: 'project-b' }), 'project:project-b');
});

test('legacy non-project messages remain addressable', async () => {
  const { buildProjectThreadKey } = await import(utilityUrl);
  assert.equal(buildProjectThreadKey({ remoteConversationId: 'conversation-a' }), 'conversation:conversation-a');
  assert.equal(
    buildProjectThreadKey({ senderId: 'creator', recipientId: 'client' }),
    'participants:client_creator',
  );
});

test('database mapping and send RPC bind project parties to one conversation', () => {
  assert.equal(existsSync(migrationUrl), true, 'project conversation migration must exist');
  const sql = readFileSync(migrationUrl, 'utf8');
  assert.match(sql, /create table public\.project_conversations/i);
  assert.match(sql, /project_id uuid primary key/i);
  assert.match(sql, /conversation_id uuid not null unique/i);
  assert.match(sql, /create or replace function public\.get_or_create_project_conversation/i);
  assert.match(sql, /p_project_id uuid default null/i);
  assert.match(sql, /insert into public\.messages[\s\S]*project_id/i);
  assert.match(sql, /'project_id', p_project_id/i);
});
