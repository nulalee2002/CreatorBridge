export function getPlatformGuideResponse(question = '') {
  const q = String(question).toLowerCase();

  if (q.includes('how does this platform work') || q.includes('how does creatorbridge work') || (q.includes('how does') && q.includes('work'))) {
    return 'Here is the short version: clients post a project brief, CreatorBridge surfaces verified creators who fit the budget, location, and production lane, the client pays a 50% retainer to lock in the booking, the creator delivers, the client approves, and the final payment releases. Creators keep 90% of every project at the starting tier.';
  }

  if (q.includes('fee') || q.includes('cost') || q.includes('price') || q.includes('how much')) {
    return 'Clients pay a flat 5% booking fee. Creators start at a 10% platform cut, then drop to 8% after 10 completed projects and 6% after 25 completed projects. No subscriptions, no off-platform lead fees, and no surprise platform charges.';
  }

  if (q.includes('sign up') || q.includes('get started') || q.includes('join') || q.includes('register')) {
    return 'Clients can browse before creating an account. To book or message through a project, they need a free client account. Creators apply through the creator onboarding flow with portfolio review, identity verification, and production-lane setup.';
  }

  if (q.includes('payment') || q.includes('retainer') || q.includes('when do i get paid') || q.includes('when will i get paid')) {
    return 'The payment structure is 50% upfront and 50% after approved delivery. The upfront retainer secures the booking. The final payment releases after client approval, and if the client goes quiet after delivery, the platform can auto-release based on the project rules.';
  }

  if (q.includes('scope') || q.includes('scope creep') || q.includes('change order') || q.includes('extra work') || q.includes('add more') || q.includes('revision')) {
    return 'CreatorBridge is designed to prevent scope creep. The project brief should define the deliverables, timeline, usage, revision count, location, and references before booking. Work outside the approved scope should be treated as a change request, documented in the project thread, and priced before the creator starts the extra work.';
  }

  if (q.includes('brief') || q.includes('project details') || q.includes('reference') || q.includes('link') || q.includes('examples')) {
    return 'A strong brief should include the production lane, desired deliverables, timeline, shoot or edit location, budget range, brand references, must-have shots, usage needs, and any example links. Reference links are helpful, but the platform still needs the actual scope written clearly so both sides know what is included.';
  }

  if (q.includes('quote') || q.includes('estimate') || q.includes('proposal')) {
    return 'A quote should be based on the selected production pillar, specialty, deliverables, timeline, locations, usage rights, and experience level. The quote flow should keep the scope specific so the creator is not guessing and the client knows exactly what they are booking.';
  }

  if (q.includes('not happy') || q.includes('unhappy') || q.includes('not satisfied') || q.includes('dispute')) {
    return 'If delivery does not match the approved scope, start with the revision process. If the issue still is not resolved, the client can open a dispute inside the platform. The team reviews the project record, scope, messages, and delivery evidence before making a decision.';
  }

  if (q.includes('cancel') || q.includes('refund')) {
    return 'Cancellation and refund handling depends on project status. Before work starts, the client may recover part of the retainer. After work begins, the retainer protects the creator. Once work is delivered, the platform focuses on revisions and disputes rather than simple refunds.';
  }

  if (q.includes('match') || q.includes('how does matching work') || q.includes('how do i get matched')) {
    return 'Matching starts with the project brief. The platform uses the production pillar, specialty, budget, location, timeline, and creator profile data to surface creators who fit the work instead of sending the client to unrelated generalists.';
  }

  if (q.includes('verif') || q.includes('verified') || q.includes('trusted') || q.includes('legit')) {
    return 'Creators are reviewed before they can operate as verified marketplace creators. The profile should show a clear production lane, relevant specialties, portfolio evidence, and account verification status so clients know who they are booking.';
  }

  if (q.includes('tier') || q.includes('launch') || q.includes('proven') || q.includes('elite') || q.includes('signature')) {
    return 'Creator tiers are earned through platform history. Launch is for newer verified creators, Proven starts after completed project history, Elite and Signature signal stronger performance and trust. Tiers should help clients understand experience without letting anyone buy status.';
  }

  if (q.includes('24') || q.includes('respond') || q.includes('response time') || q.includes('reply')) {
    return 'CreatorBridge expects project messages and support requests to be handled quickly. The platform rule is a 24-hour response standard for active project communication, especially around bookings, delivery, disputes, and support tickets.';
  }

  if (q.includes('insurance')) {
    return 'CreatorBridge does not currently verify separate creator insurance. For any on-location shoot or venue requirement, ask the creator directly before booking and document the answer in the project messages.';
  }

  if (q.includes('contact') || q.includes('reach') || q.includes('email') || q.includes('phone') || q.includes('support') || q.includes('ticket')) {
    return 'For account-specific issues, billing questions, or anything private, submit a support ticket or email drl33@creatorbridge.studio. For urgent payment or dispute matters, include URGENT in the subject so the team can triage it quickly.';
  }

  if (q.includes('hello') || q.includes('hi') || q.includes('hey') || q.includes('what can you do') || q.includes('what can you help')) {
    return 'Hey, I am Bridge. I can help you understand booking, fees, payments, project briefs, quote scope, change requests, creator verification, disputes, and support tickets. I can also walk clients through the booking path or creators through the quote builder.';
  }

  return null;
}

export function shouldUsePaidAi(question = '') {
  const q = String(question).toLowerCase();
  return [
    'help me write',
    'draft',
    'rewrite',
    'compare',
    'recommend',
    'strategy',
    'plan',
    'which creator',
    'what should',
    'how should',
    'custom',
    'specific',
  ].some(term => q.includes(term));
}

export function getSupportFallbackResponse(question = '') {
  return getPlatformGuideResponse(question)
    || 'I can help with booking creators, platform fees, payments, project briefs, quote scope, change requests, disputes, verification, and support tickets. Try asking about one of those paths, or use the support form for account-specific help.';
}
