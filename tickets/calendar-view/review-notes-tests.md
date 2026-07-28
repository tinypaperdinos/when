## reviewer-tests — round 1

Reviewed `git diff main...feat/calendar-view` (commit `f80e560`) against `plan.md` §4's
edge-case list and `ticket.md` (issue #9). Ran `npm run --workspace apps/web test -- --run`
locally: 224/224 pass. Focused on `calendar-events.test.ts` and `calendar-page.test.tsx`
per the review brief; also spot-checked `router.ts`/`root-route.tsx` coverage.

### Blocking

1. **`wireDateFromDrop`'s all-day test doesn't actually exercise the "not
   `toISOString()`" guarantee it claims to — because the CI/test runner's timezone is
   UTC.** `calendar-events.test.ts`'s test ("builds a date-only string for an all-day
   drop from local getters") uses `new Date(2026, 6, 28)` and its own comment says this is
   deliberately chosen to be "a date whose local-vs-UTC date would actually differ ... to
   actually exercise the guarantee rather than a timezone-insensitive case that would pass
   either way" — but it doesn't set/force a non-UTC timezone anywhere, and this repo's test
   runner (vitest, no `TZ` override in `vitest.config.ts` or `package.json`) plus CI
   (`ubuntu-latest`, no `TZ` env set in `ci.yml`) both default to UTC. Confirmed
   empirically in this sandbox: `Intl.DateTimeFormat().resolvedOptions().timeZone` reports
   `UTC` here too. I reproduced the exact comparison outside the repo (not editing
   `calendar-events.ts` — that's out of scope for this role): given
   `date = new Date(2026, 6, 28)`, the current local-getters implementation and a
   hypothetical `date.toISOString().slice(0, 10)` implementation produce the **identical**
   string (`"2026-07-28"`) under this TZ. So this test would pass unchanged even if
   `wireDateFromDrop` were rewritten to use `toISOString()` — exactly the regression class
   plan §3.1/§4 edge case 7 says this test is supposed to catch ("not a timezone-insensitive
   test case that would pass either way"). As written, it's a happy-path test with an
   adversarial-sounding comment attached, not an adversarial test. A genuine test needs
   either a `Date` constructed so its local vs. UTC calendar day differ *given the actual
   TZ the suite runs under* (not achievable by picking date literals alone when the suite
   always runs at UTC) or the test needs to pin `process.env.TZ` to a non-UTC zone for the
   duration of the assertion (e.g. `vi.stubEnv("TZ", "Pacific/Kiritimati")` or similar, with
   a date/time chosen so local and UTC genuinely disagree under that zone) to actually prove
   local getters are used. Same applies in spirit to the "builds a zero-padded date-time
   string for a timed drop" test, though that one's real purpose (zero-padding) doesn't
   depend on TZ, so it's not making a false claim the way the all-day one is.

2. **No test at all for `eventClassNames` (completed-task muted styling) — plan §4 edge
   case 18 explicitly requires it, and the diff's mocked `@fullcalendar/react` doesn't even
   capture the prop.** `calendar-page.tsx` passes `eventClassNames={(arg) =>
   arg.event.extendedProps.completed ? ["line-through"] : []}` to `<FullCalendar>`. The
   test file's mock (`vi.mock("@fullcalendar/react", ...)`) destructures only `events` and
   `eventDrop` off `props` — `eventClassNames` is passed through unused and never invoked or
   asserted anywhere in `calendar-page.test.tsx`. Grepped the whole `apps/web/src` tree for
   `eventClassNames` — the only occurrence is the definition site itself. The "still renders
   a completed task, as a valid drop target" test only asserts the task's title text is
   present; it says nothing about styling. This directly contradicts plan §4 item 18 ("with
   muted styling"), and — worth flagging explicitly since the fixer will read both notes
   files — `review-notes-code.md`'s round-1 entry states this *is* covered ("Completed-task
   styling (`eventClassNames` returning `["line-through"]`) matches plan's extendedProps
   note ... a completed task remains a valid drop target (test present, item 18)"), which is
   inaccurate: no test exercises `eventClassNames` at all. This is easily fixable — extend
   the mock to capture `props.eventClassNames` the same way it captures `props.eventDrop`,
   then assert it returns `["line-through"]` for a completed task's extendedProps and `[]`
   for an incomplete one.

### Non-blocking

3. **`isMidnightUtc`'s near-miss tests are good at proving exact-suffix-match (not a loose
   numeric comparison), but don't specifically prove the "timezone-independent for the
   reader" property that's the actual point of choosing a string check over
   `new Date(iso).getUTCHours()`.** The two near-miss cases present
   (`"...T00:00:00.001Z"`, `"...T00:00:01.000Z"`) are genuinely adversarial for what they
   target — they'd catch a regression to a loose/truncated comparison (e.g. an
   `.includes("T00:00")` substring check, or a check that ignores sub-minute precision).
   But none of the tests vary or pin the test runner's timezone, so none of them would catch
   a regression to a *correct-looking* `Date`-based reimplementation that swaps
   `getUTCHours()` for `getHours()` (the exact footgun the source comment calls out by
   name) — under this repo's UTC-pinned CI, `getHours() === getUTCHours()` always, so such a
   regression would pass silently. I'm not marking this blocking because, unlike finding 1,
   the current implementation (`iso.endsWith(...)`) contains no `Date` construction at all,
   so the failure mode is structurally impossible today, not just untested-but-latent — the
   design itself (confirmed by `reviewer-code`'s notes: "No `new Date(iso).getUTCHours()`
   ... anywhere in the diff") is the actual safeguard here, and a future regression back to
   a `Date`-based check would be a visible diff for the next code reviewer to catch even
   without a TZ-varying test. Worth strengthening later, not worth blocking this ticket on.

4. **No test exercises `handleEventDrop`'s `!info.event.start` guard branch**
   (`info.revert()` called with no mutation attempted). Not called out in plan §4's edge
   case list, and in practice FullCalendar always populates `event.start` on a real drop, so
   real-world risk is low — but it is an untested branch introduced by this diff. Worth a
   one-line test (`capturedEventDrop?.({ event: { start: null, ... }, revert })` →
   `revert` called, no fetch issued) if picked up.

5. **Combined `isError`/`isLoading` booleans (`tasksQuery.isError || eventsQuery.isError`)
   are only tested with both queries failing/pending together**, never with exactly one of
   the two failing while the other succeeds. Because `tasks.list`/`events.list` are batched
   into a single tRPC HTTP request, a per-procedure partial failure (one erroring, one
   succeeding in the same batch response) is a realistic scenario, not a theoretical one,
   and the current tests can't distinguish `||` from `&&` in `isError`'s definition — a
   mutation from `||` to `&&` would still pass every current test (both fail together in
   the one test that exercises the error path). Low severity (one-line boolean, easy to
   spot in code review) but worth a partial-failure test case if there's a next round.

6. **No test for the new `root-route.tsx` nav (`Tasks`/`Calendar` links) actually
   rendering/being reachable.** Not required by plan §4's edge-case list (which is scoped to
   `calendar-events.ts`/`calendar-page.tsx`), and there was no `root-route.test.tsx` before
   this ticket either, so this isn't a regression this diff introduces — noting it only
   because plan §1's "done" definition explicitly calls out "reachable from the app (a nav
   link), not just addressable by typing the URL" as a requirement, and nothing in the diff
   verifies that claim automatically. Non-blocking.

### On the manual Playwright/Tailwind-preflight check (review brief point 3)

Per `AGENT_RULES.md`, `reviewer-code` is explicitly steered away from spinning up a browser
unless nothing else can confirm a finding, and plan §3.7 frames the grid-rendering check as
a one-time implementer task, not a per-review-round obligation. `review-notes-code.md`
confirms there's no CSS override anywhere in the diff (`index.css` untouched), which is
consistent with either "the check happened and nothing was broken" or "it wasn't done" —
it can't fully distinguish those from the diff alone, and says so. From a test-coverage
angle: this is exactly the kind of layout/visual concern that a jsdom-based unit/component
test genuinely cannot exercise (jsdom doesn't do CSS layout), so there's nothing
"automatable that was skipped" here — a real assertion would require an actual browser
(Playwright) taking a screenshot or checking computed styles, which is precisely the
expensive, low-signal-per-cost check `AGENT_RULES.md` says to avoid absent a specific,
concrete finding to confirm. Nothing here needs a test; the risk is real but appropriately
left as a one-time manual/visual check rather than automated coverage.

VERDICT: BLOCKING FINDINGS

## reviewer-tests — round 2

Scoped per `AGENT_RULES.md`'s re-review rule to the fix commit `73eae1f` (the only
commit after `f80e560`), verifying it addresses round 1's two blocking findings. Ran the
full suite (`npm run --workspace apps/web test -- --run`): 227/227 pass (up from 224 —
+3 net: +1 in `calendar-events.test.ts`, +2 in `calendar-page.test.tsx`, matching the
diff).

### Finding 1 (wireDateFromDrop all-day TZ blindness) — verified fixed

The fixer added a second test, "uses local Date getters, not toISOString(), to build an
all-day drop's date string," passing a plain object (`as unknown as Date`) with
`getFullYear`/`getMonth`/`getDate`/`getHours`/`getMinutes` all agreeing on "local July
28" while `toISOString()` is hardcoded to `"2026-07-27T23:00:00.000Z"` (July 27). This
sidesteps the TZ-pinned-CI problem cleanly: it no longer depends on the runner's actual
timezone at all, since the fake object's getters and `toISOString()` are independently
scripted to disagree.

Reproduced the mutation-testing claim myself rather than trusting the commit message:
temporarily edited `wireDateFromDrop`'s all-day branch in
`apps/web/src/lib/calendar-events.ts` from `return dateString;` to
`return date.toISOString().slice(0, 10);` and reran just
`calendar-events.test.ts`. Result: exactly one test failed — the new one
(`"2026-07-27"` !== expected `"2026-07-28"`) — and the original round-1-flagged test
("builds a date-only string for an all-day drop from local getters", still using
`new Date(2026, 6, 28)`) continued to pass, exactly as round 1 predicted (that test
remains timezone-insensitive and doesn't itself distinguish the two implementations —
it's the new test alone doing the work now). Restored the original implementation
afterward and confirmed the full suite (227/227) passes again. This closes finding 1:
the suite would now catch a regression to `toISOString()`.

Minor, non-blocking observation: the original test's misleading "local getters" comment
was deleted rather than corrected to note it no longer proves the guarantee on its own
(it's now a plain happy-path check, redundant with the new test's happy-path assertion
for the same date). Not worth another round over — the actual coverage gap is closed by
the second test.

### Finding 2 (no eventClassNames coverage) — verified fixed

The fixer extended the `@fullcalendar/react` mock in `calendar-page.test.tsx` to capture
`props.eventClassNames` (mirroring the existing `eventDrop` capture pattern) and added
two tests: one asserting `capturedEventClassNames({ event: { extendedProps: { completed:
true } } })` returns `["line-through"]`, one asserting `completed: false` returns `[]`.

Reproduced both directions of the mutation-testing claim: temporarily changed
`calendar-page.tsx`'s `eventClassNames` prop to `() => []` (always no styling) — only
the new "applies muted line-through styling to a completed task" test failed, all others
passed. Reverted, then changed it to `() => ["line-through"]` (always styled) — only the
new "does not apply line-through styling to an incomplete task" test failed. Restored
the original conditional implementation afterward; full suite (227/227) passes again.
Both new tests are genuinely load-bearing, not each other's redundant twin — each one
independently pins one side of the boolean branch, so a regression to either
always-on or always-off styling is caught. This closes finding 2 and plan §4 edge case
18 is now covered.

### Non-blocking items from round 1

Not re-litigated per the re-review scope rule — the fix commit didn't touch
`isMidnightUtc`, the `!info.event.start` guard, per-query error partial-failure, or
`root-route.tsx` nav coverage, and the fixer's commit message explicitly notes these were
left as-is per the reviewer's own severity call in round 1. No new findings in this
round.

VERDICT: APPROVED
