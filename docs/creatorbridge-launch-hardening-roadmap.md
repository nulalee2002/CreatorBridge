# CreatorBridge Launch-Hardening Roadmap — deep-dive operating prompt

**Status:** ACTIVE roadmap (2026-07). **Locked scope: W1, W2, W3, W6.** W5
(orchestration method) runs throughout; W4 (recap dossier) is the end
consolidation. W3's honesty artifact is **internal only** (not published on the
site). Read this whole file, then execute the active workstreams in order
(W1 → W2 → W3 → W6). This is the operating prompt for hardening
CreatorBridge to launch strength. Adapted from the "company-builder" master
prompt, but re-authored for our reality: **CreatorBridge already exists and is
near launch. We are not building a company from scratch — we are proving it is
launch-ready and making everything on it functional, true, and verified.**

---

## Mission

Take CreatorBridge from "mostly built" to "launch-ready and provable." Every
screen functional, every public claim true and sourced, no placeholders
pretending to be finished, trust demonstrable, and every claim of "done" backed
by evidence a stranger could re-check. Then produce the proof of why it is ready.

Success is not "it looks finished." Success is: a stranger could open the
platform, use the real client and creator paths end to end, and either be
convinced it's a trustworthy verified-media platform or be precisely told what
isn't ready yet.

## Operating discipline (guardrails that apply to us)

1. **Run fable-mode on every non-trivial task** — Scope (define done + how you'll
   check it) → Evidence (open real files/DB/tool output; memory isn't a source)
   → Attack (try to break your own answer; check dependents; weigh reversibility)
   → Verify (a real check passed — build, live browser, DB query, screenshot;
   "it ran" doesn't count) → Report (answer first; verified vs assumed).
2. **Invent nothing.** Every public-facing claim (marketing copy, stats, "verified
   creators," trust/payment language) must trace to something real. If it can't
   be verified, label it or cut it. A smaller true claim beats a grand unproven
   one.
3. **No placeholder may masquerade as finished work.** No dummy/seed creator data,
   blank sections, or decorative elements posing as features on any surface a
   real user can reach.
4. **Evidence over assertion.** Verify against the tails, not just the happy path.
   Treat suspiciously clean results as broken verification until explained.
5. **Enhance, don't strip.** Surgical changes; match existing style; back up before
   overwriting anything you didn't create; if something risks the platform's
   integrity, enhance it rather than remove it.
6. **Brand rules are hard constraints.** Verified-humans brand: never generate
   people/faces. Dark mode only. Promote no outside social media on the platform.
7. **Live infrastructure stays supervised/authorized.** Production Supabase (db
   push), edge-function deploys, and live Stripe are never flipped unsupervised.
8. **Right-size and keep moving.** Ship the strong 80%, note what got cut, keep a
   decision/build log. Don't stall; find another route. Don't over-process a
   two-minute fix.

## Not using (deliberately ignored from the source, with reasons)

- **"Build a company from scratch / hunt a new pain / idea tournament to pick a
  winner."** CreatorBridge's problem and product already exist. (The adversarial
  *scoring* method can still inform feature decisions.)
- **AI-generated founder/launch video (avatar + cloned voice).** Conflicts with
  the verified-humans brand rule. A real human founder video is fine; a synthetic
  one is not.
- **Sandbox guardrails** (no-spending experiment mode, publish-nothing, `run-1/`
  working folder) and **foreign APIs** (Kie.ai, HeyGen) — experiment-only.
- **Domain-name hunting / brand naming from scratch.** Already named and branded.

## Workstreams (the seven patterns we're borrowing, ordered by launch leverage)

Each workstream states: what it is, how it maps to CreatorBridge, and its
done-check. Specifics marked *(audit)* are to be discovered during the work, not
assumed now.

### W1 — Graded Definition of Done for launch  *(highest leverage)*
Turn the existing launch-readiness list into a **gradable checklist**: each item
gets a concrete check, the evidence required, and a pass/fail — self-graded
before "done" is claimed. Covers the known blockers (Bunny paid readiness, Twilio
production sending, Stripe test→live, chatbot mode decision, Resend bounce
cleanup) and the QA passes (client, creator, admin, collaboration).
**Done-check:** every launch item has a written check + captured evidence; no item
is "done" without an observation, not an intention.

### W2 — No-placeholder + every-claim-sourced audit
Sweep every public surface for (a) dummy/incomplete/seed data and (b) unsourced
claims. Fix, label, or quarantine. Includes incomplete approved creator rows,
blank profile sections, and marketing/trust copy. *(audit: which rows, which
claims.)*
**Done-check:** no reachable public surface shows placeholder/dummy content; every
public claim traces to a real source or is removed.

### W3 — Red-team pass + honesty/trust artifact
Adversarially attack the launch: the fee model, the "verified creators" and
"protected payment" claims, the cancellation/dispute terms, privacy/anti-poaching.
Re-fetch/re-check every load-bearing claim, apply fixes. The surviving honest
limitations are kept as an **internal** launch document (decision: not published
on the site).
**Done-check:** every attack is ruled on and fixes applied; surviving objections
are documented (and, if we choose, published) rather than hidden.

### W4 — Launch recap / dossier
One navigable page that links every verification artifact, QA result, and the
decision log — stranger-readable, every link works. The single source of "is it
ready and how do we know."
**Done-check:** a stranger could open it, understand launch state in five minutes,
and click through to real evidence; no dead links; no placeholders.

### W5 — Orchestration method (the HOW behind W1–W4)
Standardize how we execute the hard workstreams: parallel research/review agents,
adversarial verifiers whose job is to refute, and a completeness critic before any
workstream is called done. (This is the engine; it powers the others.)
**Done-check:** each workstream above is closed by an independent completeness
check, not by the same pass that did the work.

### W6 — Complete brand guidelines
A stranger-usable brand guide: logo usage/spacing, palette (oxblood/forest/dark),
typography, voice, and the core component patterns — complete enough that a
teammate or tool could produce a new on-brand asset from it alone.
**Done-check:** someone with no prior context can make a correct on-brand asset
using only the guide.

## Definition of done (for this roadmap)

CreatorBridge is launch-ready when: W1's graded checklist passes with captured
evidence for every item; no placeholder/dummy content is reachable on any public
surface (W2); every public claim is sourced or cut (W2); the red team ran, every
attack was ruled on, and surviving objections are visible/addressed (W3); the
recap dossier links every artifact and every link works (W4); each workstream was
closed by an independent completeness critic (W5); the brand guide is
stranger-complete (W6); and the site is screenshot-verified on mobile and desktop
(dark mode) with a clean console. Live Stripe is enabled only after all paid-
service and QA gates pass.

## Start here

Recommended first workstream: **W1 (graded Definition of Done)** — it converts the
launch list into the scorecard every other workstream reports into, so nothing
gets called done on assumption. Alternative entry: **W2** if you'd rather clean
the public surface first.

**Open decision:** which workstream do we start, and do we want W3's honesty
artifact to be *internal only* or *published on the site*?
