import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAuthenticatedEmailRequest,
  SUPPORTED_EMAIL_TEMPLATES,
} from '../supabase/functions/_shared/emailAuthorizationPolicy.js';

const base = {
  callerEmail: 'client@creatorbridge.studio',
  to: 'client@creatorbridge.studio',
  data: {},
  supportEmail: 'support@creatorbridge.studio',
};

test('authenticated email callers can only send self-service templates to themselves', () => {
  assert.equal(classifyAuthenticatedEmailRequest({ ...base, template: 'welcome_client' }).allowed, true);
  assert.equal(classifyAuthenticatedEmailRequest({ ...base, template: 'welcome_client', to: 'other@creatorbridge.studio' }).allowed, false);
  assert.equal(classifyAuthenticatedEmailRequest({ ...base, template: 'final_paid' }).allowed, false);
});

test('support alerts are fixed to the support inbox and authenticated submitter', () => {
  const valid = classifyAuthenticatedEmailRequest({
    ...base,
    to: 'support@creatorbridge.studio',
    template: 'support_ticket_admin_alert',
    data: { submitter_email: base.callerEmail },
  });
  assert.equal(valid.allowed, true);
  assert.equal(classifyAuthenticatedEmailRequest({ ...base, to: 'attacker@example.net', template: 'support_ticket_admin_alert', data: { submitter_email: base.callerEmail } }).allowed, false);
});

test('cross-party project email requires server validation and unknown templates are rejected', () => {
  assert.equal(classifyAuthenticatedEmailRequest({ ...base, template: 'application_accepted', data: {} }).allowed, false);
  assert.equal(classifyAuthenticatedEmailRequest({ ...base, template: 'application_accepted', data: { project_id: 'project-id' } }).kind, 'project_application_accepted');
  assert.equal(classifyAuthenticatedEmailRequest({ ...base, template: 'arbitrary_message' }).allowed, false);
  assert.equal(SUPPORTED_EMAIL_TEMPLATES.has('arbitrary_message'), false);
});
