import { getPlatformGuideResponse, getSupportFallbackResponse, shouldUsePaidAi } from '../src/data/supportKnowledge.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const checks = [
  {
    name: 'fees',
    reply: getPlatformGuideResponse('How much are platform fees?'),
    mustInclude: ['5%', '10%', '8%', '6%'],
  },
  {
    name: 'payment',
    reply: getPlatformGuideResponse('When do creators get paid from the retainer?'),
    mustInclude: ['50%', 'approved delivery'],
  },
  {
    name: 'scope',
    reply: getPlatformGuideResponse('How do we stop scope creep and change orders?'),
    mustInclude: ['scope', 'change request'],
  },
  {
    name: 'brief',
    reply: getPlatformGuideResponse('Can clients submit reference links in the project brief?'),
    mustInclude: ['Reference links', 'deliverables'],
  },
  {
    name: 'response rule',
    reply: getPlatformGuideResponse('What is the 24 hour response rule?'),
    mustInclude: ['24-hour', 'active project communication'],
  },
  {
    name: 'support',
    reply: getPlatformGuideResponse('How do I contact support for a ticket?'),
    mustInclude: ['support ticket', 'drl33@creatorbridge.studio'],
  },
];

for (const check of checks) {
  assert(check.reply, `${check.name} did not produce a local guide response`);
  for (const text of check.mustInclude) {
    assert(check.reply.includes(text), `${check.name} response missing "${text}"`);
  }
}

assert(shouldUsePaidAi('Help me write a project brief for a product shoot'), 'writing help should be eligible for paid AI escalation');
assert(!shouldUsePaidAi('How much are fees?'), 'common FAQ should not use paid AI');
assert(getSupportFallbackResponse('random unknown question').includes('booking creators'), 'generic fallback should stay useful');

console.log(JSON.stringify({
  ok: true,
  freeGuideChecks: checks.map(check => check.name),
  paidAiOnlyForDeepHelp: true,
}, null, 2));
