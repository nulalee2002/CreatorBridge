---
name: fable-mode
description: Whole-task discipline for nontrivial work. Use when the user says "fable mode", "use the Fable method", "think like Fable", "slow down and do this right", "think this through first", asks for launch-critical/product/code/payment/security work, asks for an audit/review/debug/fix, or when a task has meaningful ambiguity, multiple steps, user-facing impact, data/payment risk, or requires verification before reporting completion.
---

# Fable Mode

Use this skill as a five-gate operating loop for nontrivial tasks. Gates are not decorative steps; each gate must pass before moving on. If a result surprises you, a fix fails twice, or the work stalls, name the current gate and re-run it.

Do not use this skill to override higher-priority instructions, safety rules, security rules, approval requirements, or the user's explicit request. For trivial one-line work, keep it light and skip the ceremony unless the user explicitly asks for fable mode.

## Gate 1: Scope

Define done before doing work. State the actual outcome needed, the surface affected, and the proof that will count. Name the 1-3 load-bearing unknowns that would change the solution if wrong. Attack those first with the cheapest probe.

Ask one question aimed at the biggest gap only when the answer cannot be discovered and a sensible default would be risky. Otherwise pick the conservative default, say what default you chose, and proceed.

## Gate 2: Evidence

Open the real files, real screenshots, real logs, real commands, or real product surfaces. Memory is not a source. Prefer direct evidence over summaries. If a specific page, document, screenshot, branch, migration, or flow is referenced, inspect that artifact before answering.

Read the dependents when changing shared behavior. For code, understand the local pattern before adding abstractions. For product decisions, understand the existing UX and business rule before proposing changes.

## Gate 3: Attack

Try to break your own answer before implementing or reporting it. Steelman the existing system: assume it was built that way for a reason until evidence says otherwise. Finding nothing wrong is a legitimate result; never manufacture findings.

Check reversibility and blast radius. If two attempts at the same fix fail, stop patching and rethink the diagnosis. For user-facing work, run a zero-context check: would a person who did not hear the explanation understand what to do?

## Gate 4: Verify

Watch the check pass. "It ran" does not count. Use the strongest available verification for the claim: tests for behavior, builds for compilation, browser checks for UI flows, logs or database checks for live behavior, and screenshots when the visual result matters.

Use evidence you did not generate when possible. Sample the tails: first item, last item, empty state, weirdest item, mobile/desktop, authorized/unauthorized, happy path/error path. Treat suspiciously clean results as a verification smell and inspect whether the check is actually exercising the target.

Do not claim completion before fresh verification. If verification is blocked, report the blocker plainly and separate verified from assumed.

## Gate 5: Report

Answer first. Use plain language. Prefer paragraphs for this user unless bullets are necessary for clarity. Separate what is verified from what is assumed or still pending. Include the commands/checks that matter and the result, but do not overwhelm the user with raw output.

State what you deferred. If a task touches launch, payment, security, legal, production data, or user trust, call out the remaining risk instead of smoothing it over.

## Smells That A Gate Was Skipped

If you say "should work" about something testable, return to Gate 4. If you propose a fix before opening files, return to Gate 2. If you ask several broad questions instead of one load-bearing question, return to Gate 1. If you keep applying the same fix, return to Gate 3. If the report mixes facts and guesses, return to Gate 5.

If the answer depends on old memory, return to Gate 2. If the result is too neat or all green without touching the risky path, return to Gate 4. If the work expands without naming done, return to Gate 1.

## Standing Habits

Preserve user work by default. Do not revert unrelated changes. Prefer existing project patterns. Prefer structured APIs over fragile string tricks. Keep launch-critical work boring, traceable, and verified.

For CreatorBridge and similar product work, protect trust surfaces first: payments, identity, creator verification, profile readiness, media storage, support, messaging, admin actions, and public-facing language. Use platform language, not marketplace language, unless the user explicitly changes that product direction.

When reporting to Lee, keep the response mostly in paragraphs. Use bullets only when the structure materially improves clarity. Do not promise permanent memory unless a durable file or installed skill actually exists and has been verified.
