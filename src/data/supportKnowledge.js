export function getPlatformGuideResponse(question = '') {
  const q = String(question).toLowerCase();

  if (q.includes('client approval') || q.includes('new client') || q.includes('client sign up') || q.includes('client signup')) {
    return 'Client accounts are intentionally self-serve. A client can sign up, browse, create briefs, and move through booking without waiting for manual admin approval. The protection happens around authenticated briefs, platform messaging, Stripe payment flow, and dispute records rather than a manual client approval queue.';
  }

  if (q.includes('creator approval') || q.includes('creator apply') || q.includes('creator application') || q.includes('become a creator')) {
    return 'Creators go through manual review before they are visible as approved marketplace creators. The application asks for identity, bio, US location, one primary production pillar, 1 to 3 specialties, portfolio work, intro video, and required acknowledgments. Submitted listings start as pending review, then admin approves or rejects them.';
  }

  if (q.includes('admin') || q.includes('approve') || q.includes('approval') || q.includes('review creators') || q.includes('creator review')) {
    return 'Clients are self-serve and do not need manual approval to create an account. Creators are different: they submit an application, choose one primary pillar, add 1 to 3 specialties, upload portfolio proof, complete acknowledgments, and wait for manual review. Admin can review creators from Admin Dashboard or Admin Operations. Admin Operations is the stronger path because it records an approval reason.';
  }

  if (q.includes('dashboard') || q.includes('where do i manage') || q.includes('manage my account')) {
    return 'Clients manage briefs, matches, messages, and bookings from the client/project areas. Creators manage packages, availability, Stripe setup, earnings, and profile readiness from the creator dashboard. Admin users have separate guarded areas for creator review, support tickets, operations, finance, and analytics.';
  }

  if (q.includes('how does this platform work') || q.includes('how does creatorbridge work') || (q.includes('how does') && q.includes('work'))) {
    return 'Here is the short version: clients post a project brief, CreatorBridge surfaces verified creators who fit the budget, location, and production lane, the client pays a 50% retainer to lock in the booking, the creator delivers, the client approves, and the final payment releases. Creators keep 90% of every project at the starting tier.';
  }

  if (q.includes('login') || q.includes('log in') || q.includes('sign in') || q.includes('password') || q.includes('reset')) {
    return 'Use Sign In from the top navigation to access your account. If the password is not working, use the reset-password flow from the login screen. If you still cannot access the account, submit a support ticket with the account email and whether it is a client, creator, or admin account.';
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

  if (q.includes('what should i include') || q.includes('ask me questions') || q.includes('help with my brief') || q.includes('scope my project')) {
    return 'Start with these basics: what are we making, where is it happening, when is it due, how many final deliverables are needed, where will the work be used, what reference links show the style, what must be included, what is out of scope, and what budget range is realistic. The clearer the brief, the less room there is for scope creep.';
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

  if (q.includes('notification') || q.includes('notify') || q.includes('email alert') || q.includes('message alert')) {
    return 'CreatorBridge uses in-app notifications and email for important activity such as quote requests, direct messages, support tickets, payment release, and accepted proposals. Active project communication follows a 24-hour response standard so clients and creators are not left waiting.';
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

  if (q.includes('offline') || q.includes('generic') || q.includes('not smart') || q.includes('ai assistant') || q.includes('chatbot')) {
    return 'Bridge has two layers: a built-in platform guide for common support and an optional paid AI layer for custom questions. The guide handles known rules and workflows without spending AI credits. The paid AI layer should be enabled only with budget controls, rate limits, and fallback behavior so it stays useful without quietly draining credits.';
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
  const paidIntentTerms = [
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
    'confused',
    'stuck',
    'does this',
    'can you explain',
    'walk me through',
  ];
  if (paidIntentTerms.some(term => q.includes(term))) return true;
  if (getPlatformGuideResponse(q)) return false;
  return false;
}

export function getSupportFallbackResponse(question = '') {
  return getPlatformGuideResponse(question)
    || 'I can help with booking creators, platform fees, payments, project briefs, quote scope, change requests, disputes, verification, and support tickets. Try asking about one of those paths, or use the support form for account-specific help.';
}
