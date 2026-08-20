# Refiner notes: task-quick-add (issue #50)

## Round 1

Verified against the live codebase (not just plan prose): `apps/web/src/routes/task-create-form.tsx`,
`task-list-item.tsx`, `tasks-page.tsx`, `apps/web/src/lib/task-due-date.ts`,
`apps/server/src/services/task-schema.ts` + `schema-helpers.ts` + `task-service.ts`,
`apps/server/src/services/tag-service.ts`, `apps/web/src/components/ui/tag-input.tsx`,
`components/ui/README.md`'s demo-page rule, and `chrono-node@2.10.1`'s actual published
`package.json`/API (installed it in a scratch dir and ran `chrono.parse` directly). All of
the plan's factual claims about existing code checked out:

- `taskCreateInput`/`wireDateTimeString` regex (`^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$`)
  exactly matches the wire format `wireDateTimeStringFromDate` is designed to produce.
- `notes` is optional end-to-end server-side (`task-service.ts` lines 41/65) — dropping it
  from the create payload requires zero backend changes, as claimed.
- `TagService.resolveConnections` is genuinely case-insensitive/case-preserving, matching
  the plan's tag-dedup rationale.
- `components/ui/README.md` line 112 confirms the "every `components/ui/` component must
  be in the demo page" rule the plan cites to justify *not* adding a demo-page entry.
- `chrono-node` is zero-runtime-deps, MIT-licensed, ships proper ESM (`exports` map with
  `import`/`require` conditions) — no bundler surprises expected.
- The single caller of `TaskCreateForm` (`tasks-page.tsx`) and the single test exercising
  `tagSuggestions` threading (`tasks-page.test.tsx:114`) are both accounted for in the plan.

No scope gaps found against the ticket's acceptance criteria: single-line input (no
picker) ✓, chrono-node-powered relative-phrase parsing that sets due date and strips from
title ✓, `#tag` parsing that strips from title ✓, live preview under the input ✓, notes
excluded from creation ✓, editing left untouched with picker/notes/tags as fallback ✓,
recurring-rule and date-range parsing explicitly excluded ✓. No over-scoping — the plan
resists adding autocomplete/suggestion UI to quick-add, a new `components/ui/` primitive,
or a superjson/backend change, all of which would have been unrequested extra surface.

### Finding: the plan's own test for `forwardDate: true` doesn't test what it claims to (and the real behavior it protects is untested)

This is a concrete, verified defect in §3.1 and §5, not a style nitpick — reproduced directly against chrono-node 2.10.1:

- §3.1 lists this test case: `"next monday" with a referenceDate that's itself a Monday →
  resolves to the following Monday, not the same day (exercises forwardDate: true)`.
- §5 says, about the same option: `Explicitly relative phrases ("tomorrow", "next monday",
  "in 3 days") are unaffected by this option either way.`

These two statements contradict each other, and I confirmed §5 is the one that's correct:

```js
chrono.parse('next monday', new Date(2026,6,6) /* a Monday */, { forwardDate: true })
// -> 2026-07-13T12:00:00.000Z
chrono.parse('next monday', new Date(2026,6,6), {}) // forwardDate omitted entirely
// -> 2026-07-13T12:00:00.000Z  (identical result)
```

`forwardDate` has zero effect on "next monday" — chrono's "next X" phrasing already always
looks forward regardless of the option. The option's actual, documented effect is on
*bare, non-relative* phrases (a date with no relative/ordinal word), where it changes which
year gets picked:

```js
chrono.parse('june 3', new Date(2026,7,20), { forwardDate: true })  // -> 2027-06-03
chrono.parse('june 3', new Date(2026,7,20), {})                     // -> 2026-06-03
```

Net effect: as specified, the test suite in §3.1 has **no test that actually exercises
`forwardDate: true`** — every listed case (`tomorrow`, `next monday`, `in 3 days`, `tomorrow
at 5pm`) is either absolute-relative or otherwise unaffected by the option. This is a real
gap tied to a deliberate design decision the plan itself calls out in §5 as worth flagging
to reviewers "since it was considered rather than missed" — but the test meant to protect
that decision doesn't, and a future refactor that silently dropped `forwardDate: true` (or
flipped it to `false`) would pass every test in this plan without detection.

Also worth noting: none of the ticket's own example phrases (`tomorrow`, `next monday`, `in
3 days`, `tomorrow at 5pm`) are bare/non-relative, so `forwardDate: true` isn't actually
exercised by anything the ticket asked for either — it's solely the plan's own addition for
an input shape (`"june 3"`-style bare dates) the ticket doesn't mention. That's a reasonable
default to pick, but it should either get a real test (a bare non-relative phrase whose
resolved year differs with/without the option) or the misleading "(exercises forwardDate:
true)" parenthetical on the "next monday" test should be removed so nobody reads it as
coverage that doesn't exist.

**Requested fix**: replace or supplement the "next monday" test's `forwardDate` claim in
§3.1 with a test case using a bare, non-relative phrase (e.g. `"june 3"` or `"3/15"`) run
against a `referenceDate` where the naive same-year resolution would land in the past,
asserting the result resolves into the *next* occurrence of that date rather than the past
one. This is a small addition, not a rework of the plan.

### Minor observations (not blocking, flagging so they're visibly considered)

- **`aria-live="polite"` on a container that updates on every keystroke**: `LoadingState`
  (the pattern being mirrored) announces once, on mount/prop-change, not continuously while
  the user is actively typing. In practice the *rendered text* of the preview only changes
  when the parsed phrase's resolved value actually changes (not on every keystroke — e.g.
  typing out "tomorrow at 5pm" letter by letter only updates the DOM text twice: once when
  "tomorrow" first resolves, once when "at 5pm" adds a time), so this is unlikely to be as
  noisy as a naive reading suggests. Still, worth the implementer double-checking with a
  screen reader (or at minimum sanity-checking VoiceOver/NVDA behavior isn't jarring) since
  this is a new interaction pattern (continuous parse-and-announce) that doesn't have a
  precedent in this codebase the way a one-shot loading announcement does.
- **`aria-label="Task title"` no longer accurately describes the field** now that it also
  drives due date and tags. The plan explicitly weighs this (keeping the old label to avoid
  rippling `tasks-page.test.tsx`'s `getByLabelText("Task title")` assertion) and that's a
  defensible call, not an oversight — flagging only so it's visibly a considered trade-off,
  not something to independently re-litigate.

## Verdict

The forwardDate test-coverage/reasoning defect is concrete, verified, and cheap to fix (a
plan-text edit, not an implementation rework) — but it means the plan as written would ship
a design decision (§5's stated rationale for `forwardDate: true`) with a test that doesn't
actually protect it, silently regressable. Requesting one revision round to fix the test
case before implementation starts.

VERDICT: REVISE

## Round 2

### Round-1 finding verified fixed

Re-derived the round-1 `forwardDate` claim independently against the actual installed
`chrono-node@2.10.1` (not just re-reading the plan prose):

```
ref = Aug 20, 2026
chrono.parse('june 3', ref, { forwardDate: true })  -> 2027-06-03
chrono.parse('june 3', ref, { forwardDate: false }) -> 2026-06-03
chrono.parse('june 3', ref, {})                     -> 2026-06-03 (same as false)

ref = a Monday (Jul 6, 2026)
chrono.parse('next monday', ref, { forwardDate: true })  -> 2026-07-13
chrono.parse('next monday', ref, { forwardDate: false }) -> 2026-07-13 (identical)
```

This confirms both halves of the fix are now correct and mutually consistent:
- §3.1's "next monday" bullet no longer claims to exercise `forwardDate`; it now
  explicitly says "It is **not** a `forwardDate` test" and points to the dedicated
  bullet — matches the empirical result above (option has zero effect on this phrase).
- §3.1's new "june 3" bullet is the one that actually exercises the option, and its
  claimed year values (2027 with the option, 2026 without) match what really comes back
  from the library.
- §5's rationale paragraph was also updated in sync — it now says "the `june 3` case in
  §3.1 is the one test that actually exercises this option," consistent with §3.1, so
  there's no longer a contradiction between the two sections.

The round-1 defect is genuinely fixed, not just reworded around.

### Round-2 pass (normal, not exhaustive)

Spot-checked a handful of other factual claims in the revised plan directly against the
issue and the library, rather than re-auditing everything already covered in round 1:

- Pulled the live issue text with `gh issue view 50` and diffed it against §1/§4 of the
  plan by eye: single-line input, chrono-node-powered relative-phrase parsing stripped
  from title, `#tagname` stripped from title, live preview under the input, notes
  excluded from creation, editing unchanged as fallback, recurring-rule/date-range
  parsing out of scope — the plan's restated scope in §1/§4 still matches the issue text
  verbatim in substance. No drift introduced by the round-2 edit.
- Verified `isCertain("hour")` empirically: `false` for "tomorrow", `true` for "tomorrow
  at 5pm" (referenced by §2.2/§3.1's `dueDateHasTime` logic) — matches the plan's claim.
- Confirmed `pad` is a real, already-private helper in `apps/web/src/lib/task-due-date.ts`
  (not exported, used internally by `dueDateValueFromWireDate`), so §2.3's plan to reuse
  it from `wireDateTimeStringFromDate` in the same file is accurate, not a claim about
  code that doesn't exist.
- The only change between round-1 and round-2 plan text is confined to the `forwardDate`
  test case and its accompanying prose in §3.1/§5; no other section was touched, so there
  was no new surface introduced that needed a fresh look this round.

No new findings. The round-1 issue was the only concrete defect found across both rounds,
and it's now fixed and independently re-verified.

## Verdict

VERDICT: APPROVED
