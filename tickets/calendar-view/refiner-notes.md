# Refiner notes: calendar-view

## Round 1

### Verified as sound (no issue found)

- **Reusing `trpc.tasks.update`/`trpc.events.update` for drag-reschedule** (item 2 in the
  review brief): confirmed against the actual zod schemas
  (`apps/server/src/services/task-schema.ts` `taskUpdateFields`,
  `apps/server/src/services/event-schema.ts` `eventUpdateFields`) — every field besides
  `id` is `.optional()` (and `dueDate` is additionally `.nullable()`), so `{ id, dueDate }`
  / `{ id, date }` is a fully valid partial payload against both routers as-is. No new
  procedure needed, matches the plan's claim exactly.
- **The all-day round-trip is internally consistent.** Traced the full cycle: a date-only
  wire string (`"YYYY-MM-DD"`) is parsed server-side as UTC midnight
  (`new Date("2026-07-28")` → UTC semantics per spec for date-only ISO strings), and
  FullCalendar treats a bare `"YYYY-MM-DD"` `start` as that literal calendar day with no
  timezone conversion applied on render. So a task/event that's genuinely all-day
  round-trips to the same calendar cell regardless of the browser's timezone. No bug here.
- **`wireDateFromDrop`'s use of `info.event.allDay` (not a recomputed `isMidnightUtc`
  check) to decide format on the way back out** correctly handles FullCalendar's
  week/day-view interaction where a user can drag an item between the "all-day" row and a
  specific time slot (this flips `allDay` on the drop info) — the plan doesn't need to
  special-case this, and doesn't. Good design, worth confirming the implementer doesn't
  "simplify" this into re-deriving all-day-ness from the dropped date instead of trusting
  `info.event.allDay`.
- **FullCalendar v6.1.21 pin**: confirmed via `npm view @fullcalendar/react versions` that
  `6.1.21` is real and is the latest 6.x release, and its peer deps
  (`react: '^16.7.0 || ^17 || ^18 || ^19'`) do cover this repo's React 19.2.8. Confirmed
  independently (web search) that v7 does add `temporal-polyfill` as a required peer
  dependency, matching the plan's stated reasoning. The version-pin judgment call is sound
  and appropriately (not excessively) cautious given v7 is days old.
- Route/nav additions (`router.ts`, `root-route.tsx`) match the plan's description of the
  current state — verified there is genuinely no persistent nav today and `/` is the only
  reachable route pre-ticket.

### Finding 1 (real bug, needs plan correction before build) — the `isMidnightUtc`
heuristic's false positive is mischaracterized, and its consequence is understated

The plan's own flagged risk (§3.1, §6) describes the false positive as: *"a task/event
explicitly given a real time of exactly local midnight by a user in a UTC+0 timezone."*
This gets the mechanism wrong in a way that matters for how risky this actually is:

The relevant timezone is **the server process's runtime timezone**, not the browsing
user's timezone. `taskUpdateFields`/`eventUpdateFields` accept a date-time string with no
offset (`"YYYY-MM-DDTHH:mm"`), and both `TaskService`/`EventService` convert it via plain
`new Date(theString)`. Per the JS spec, a date-time string with no timezone designator is
parsed as local time **in whatever environment is running the JS engine** — i.e. the
Node server process, not the client. I confirmed there is no `TZ` env var pinned anywhere
in this repo (checked `.github/workflows/ci.yml`, searched for `Dockerfile`/`TZ`
references — none exist), so the server's interpretation timezone is whatever the host
machine/container defaults to (commonly UTC for containers/CI, but not guaranteed, and
not necessarily the same as the browsing user's own timezone either way).

Two consequences the plan doesn't currently capture:

1. **The false positive isn't gated on "the user happens to be in UTC+0."** It's gated on
   "the server happens to be running in UTC" (independent of where the user physically
   is), which is arguably the *more* likely default for a deployed Node service, not a
   narrow edge case. Any user, in any timezone, who explicitly picks a time of `00:00` in
   `DateTimePicker` will hit this if the server runs in UTC.
2. **A more severe variant exists that the plan doesn't mention at all: a day-shift, not
   just a display-mode misclassification.** If the server's runtime timezone has a
   non-zero offset (e.g. a developer running the dev server locally in a non-UTC zone),
   then it isn't only literal `00:00` that collides with UTC midnight — it's whichever
   local wall-clock hour equals UTC midnight under that offset (e.g. server tz UTC-5 ⇒
   local `19:00` maps to UTC midnight). When that happens, `entryToCalendarEvent` doesn't
   just mislabel the entry as all-day instead of timed — it also takes the *UTC* date part
   of the timestamp as the placed day (per §3.1's `isMidnightUtc`-true branch), which is a
   **different calendar day** than the one the user actually picked in their local time.
   Concretely: a task set for "July 28, 7pm" (as entered against a UTC-5 server) would
   silently render as an untimed chip on **July 29**. This happens with zero error
   surfaced anywhere — the mutation succeeds, `invalidateQueries` refetches, and the item
   just appears to have silently moved. This is a materially worse failure mode than "shows
   a redundant 12:00 AM label," and it's directly triggered by drag-and-drop (this ticket's
   headline feature) landing an item back through the exact same wire contract.

This doesn't necessarily mean the heuristic must be abandoned or the underlying
server/browser timezone ambiguity must be fixed in this ticket — the plan's position that
the *root* ambiguity is pre-existing and deliberately deferred (`task-crud/plan.md` §3.1)
is reasonable to keep holding. But the plan's own risk write-up needs to state the actual
trigger condition (server runtime timezone, not user timezone) and the actual worst-case
consequence (possible day-shift on re-render, not just an all-day/timed label swap) before
this is safe to build from — an implementer or reviewer reading the current §3.1/§6 text
would reasonably conclude the blast radius is much narrower than it is. At minimum this
needs:
- Corrected wording of the false-positive trigger in §3.1's inline comment and §6.
- An explicit statement of the day-shift consequence (not just the label-swap one).
- A note in §4 covering this as a documented-but-unfixed edge case (doesn't need a new
  test if the true fix is out of scope, but the gap should be visible next to the other
  edge cases, not just in prose).

### Finding 2 (minor, non-blocking) — `wireDateFromDrop`'s getter list omits the classic
`getMonth()` off-by-one trap

§3.1's pseudocode says to build the wire string from
"`getFullYear/getMonth/getDate/getHours/getMinutes`, zero-padded" but doesn't call out
that `getMonth()` is zero-indexed (Jan = `0`) and needs `+ 1` before zero-padding into the
`MM` slot of `wireDateTimeString`'s format. This is a well-known JS footgun and worth
being explicit about in the plan rather than trusting the implementer to remember it
unprompted — the format is easy to get "digit-shaped but wrong" (e.g. January becoming
`"00"`, silently valid against the regex, silently wrong as a date) in a way validation
won't catch. Edge cases 6/7 in §4 do test against concrete expected strings, which should
catch this in review if the implementer writes the test first — but the plan itself should
say `getMonth() + 1` explicitly rather than relying on the test suite as the only backstop.

### Finding 3 (minor, non-blocking) — drag-error state is a new pattern vs. the rest of
the codebase's mutation-error convention

Every existing mutation-error render in this codebase (`task-create-form.tsx`,
`task-list-item.tsx`) is declarative: `{mutation.isError && <p>{mutation.error.message}</p>}`,
relying on TanStack Query's own state. §3.3 instead introduces an imperative pattern —
a local `dragError` state variable set from a per-call `onError` callback, manually reset
at the top of `handleEventDrop`. This isn't wrong (TanStack Query does reset
`isError`/`isSuccess` on a new `.mutate()` call, so `{(updateTask.isError ||
updateEvent.isError) && <p>{(updateTask.error ?? updateEvent.error)?.message}</p>}` would
achieve the same effect with less new state and matching the established convention), but
it is a quiet, unexplained deviation from how every other mutation error is surfaced in
this app. Worth either switching to the declarative form for consistency, or adding one
sentence explaining why this case needs its own state (e.g. tying the error message to the
specific failed drag rather than "whichever of the two mutations most recently ran").
Not blocking — doesn't affect correctness — but flagged under "existing codebase fit."

## Summary

Findings 2 and 3 are minor/non-blocking. Finding 1 is a real, verified gap: the plan's own
flagged risk section understates both the trigger condition and the worst-case consequence
of the `isMidnightUtc` heuristic in a way that would mislead an implementer or reviewer
about how narrow this edge case actually is. Given this ticket's core deliverable is
drag-and-drop rescheduling, and the miscategorized risk sits directly in that path, the
plan's risk write-up (§3.1, §6) needs correcting before this is ready to build from — not
necessarily a design change, but the documented reasoning needs to be accurate.

VERDICT: REVISE

## Round 2

### Verified: the client-side `isMidnightUtc` / day-extraction fix is correctly implemented

Re-read `apps/server/src/services/task-service.ts`, `apps/server/src/services/event-service.ts`,
and `apps/server/src/services/schema-helpers.ts` directly (not just trusting the plan's
quotes of them) to confirm the plan's factual claims still hold:

- `TaskService.create`/`update` and `EventService.create`/`update` do convert the wire
  string via a bare `new Date(input.dueDate)` / `new Date(input.date)` — no manual
  UTC-anchoring anywhere. Confirmed verbatim in both files.
- `wireDateTimeString`'s regex (`^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$`) genuinely has no
  offset slot — confirmed, the client cannot "just send `Z`" to sidestep this even if it
  wanted to.
- No `TZ` env var, `Dockerfile`, or deployment config exists anywhere in the repo
  (re-checked). `.github/workflows/ci.yml` runs on `ubuntu-latest` with no `TZ` override,
  so CI's own runtime is UTC by GitHub Actions' documented default — this specific claim
  in the plan is accurate for at least the CI environment.
- `README.md`'s MVP scope section states deployment target is explicitly "not decided
  yet... running locally for now" — worth noting this actually *softens* the plan's "UTC
  is the more likely deployed-service default" framing slightly (there's no deployment to
  reason about yet), but doesn't change the underlying conclusion: the bug is real,
  pre-existing, and orthogonal to this ticket regardless of which timezone eventually runs
  the server.

`isMidnightUtc(iso) { return iso.endsWith("T00:00:00.000Z"); }` is correct: `JSON.stringify`
on a Prisma `DateTime` always goes through `Date#toJSON` → `toISOString()`, which is always
the fixed-width `YYYY-MM-DDTHH:mm:ss.sssZ` shape — no variable-width component that could
make a literal suffix match unreliable. The companion `entryToCalendarEvent` day-extraction
(`iso.slice(0, 10)`) is the same class of fix, for the same reason. Both are provably
timezone-independent with respect to the *reader* (browser), which is the property the
plan claims and the only property claimed. Confirmed sound, no new issue found.

### Verified: `getMonth()` and drag-error minor items (round 1, findings 2 and 3) are properly closed

- Finding 2: the plan's `wireDateFromDrop` pseudocode now explicitly calls out
  `getMonth() + 1` by name with the off-by-one footgun spelled out, and edge case 9 is a
  dedicated January-specific test (not just incidentally covered by an arbitrary date in
  test 8). This is exactly what was asked for.
- Finding 3: §3.3 now gives a correctness-based justification (not just a style preference)
  for why `dragError` is local state rather than the declarative
  `mutation.isError`-combination pattern used elsewhere — TanStack Query only resets a
  given mutation object's own `isError` on that same object's next `.mutate()` call, so a
  naive `(updateTask.isError || updateEvent.isError)` would leave a stale banner visible
  after a failed task-drag followed by an unrelated successful event-drag. Edge case 17 is
  a test built specifically to fail if this got "simplified" back to the declarative form.
  This is a real, checked argument, not a hand-wave, and it's the right call — approved.

### The core question: is declining the server-side fix a legitimate scope call?

Legitimate. Reasoning:

1. **The bug predates this ticket and is not introduced or worsened by it.**
   `tickets/task-crud/plan.md` (already merged, already reviewed, cited accurately by this
   plan) already documents this exact date-only-vs-timed `Date`-parsing inconsistency as a
   known, deliberately deferred limitation — "flagged for whichever future ticket first
   needs timezone-correct dates." This ticket is not the first to notice it; it's
   correctly identified as an existing gap being inherited, and the plan cites that prior
   ticket by name rather than presenting the discovery as novel.
2. **It's reachable today, independent of this ticket ever landing**, via the existing,
   already-merged `TaskCreateForm` time picker on any non-UTC-server deployment — drag-drop
   reaches the *same* `TaskService.update`/`EventService.update` code path, it doesn't open
   a new one. The plan's claim that "drag-and-drop doesn't introduce a new bug class, it's
   one more path into an existing one" checks out against the actual service code.
3. **The persisted-data consequence (not just a display glitch) is real** — since the
   parsing happens at write time, a wrong instant can already be silently written to the DB
   today via the create form, independent of the calendar page. That's arguably a reason
   this deserves a *prioritized* follow-up ticket, not a reason it must block a
   frontend-only ticket that didn't cause it and can't fix it (the wire schema itself has
   no offset slot for `apps/web` to work around).
4. **It's surfaced transparently, not buried.** §3.1 traces the mechanism in full with the
   corrected trigger/consequence from round 1, §4 lists it as edge case 19 next to the
   tested cases instead of only in prose, §5 lists it as an explicit out-of-scope item with
   a named, scoped follow-up ticket suggestion, and §6 poses it as an open question rather
   than quietly deciding it. This matches this repo's established planning convention
   (`event-crud/plan.md`'s "pick an interpretation, document why, flag for reversal cost")
   and is the opposite of a hidden assumption.
5. **A fix from within this ticket isn't available anyway.** `apps/web` cannot anchor the
   parse itself (that code is server-side) and cannot send an offset (the wire schema
   forbids it). The only in-scope mitigations this ticket *could* add — e.g. warning users
   who pick exactly `00:00` — would be superficial (it doesn't address the day-shift case
   at non-zero server offsets at all) and would misdirect effort toward papering over a
   symptom instead of the real fix living in `apps/server`.

Whether shipping this ticket makes the bug *more visible*: yes, somewhat — a calendar grid
makes a wrong day visually obvious in a way `task-list-item.tsx`'s text rendering doesn't,
and drag-and-drop is an interactive moment where a user is actively watching the result.
But that increased visibility is a property of building a calendar view at all (any timed
entry already in the DB would render on the wrong day on first load, with zero dragging
involved) — it is not specifically caused by the drag-and-drop feature, and "this ticket
makes a latent bug more discoverable" is a reason to prioritize the follow-up ticket, not a
reason to block this one or to smuggle a backend fix into a ticket whose stated, sensible
boundary is "pure `apps/web`, consumes existing procedures as-is."

**Recommendation (non-blocking):** the suggested follow-up ticket in §5 should be filed for
real once this merges, and given what round 1 + round 2 established about severity (a
possible silent day-shift, not just a redundant label), it's worth flagging to the human as
higher-priority than a routine "nice to have" follow-up — but that's a triage note for after
this ticket, not a gate on it.

## Summary

Both round-1 blocking and non-blocking findings are correctly and completely addressed:
the `isMidnightUtc`/day-extraction fix is genuinely timezone-independent by construction
and verified against the actual service/schema code; the `getMonth()` and drag-error items
are properly closed with real justification and dedicated tests; and the decision to
document-but-not-fix the deeper pre-existing server-side timezone bug is a legitimate,
well-precedented, transparently-flagged scope call rather than a dodge — it's not a bug
this ticket introduces, it can't be fixed from `apps/web` alone, and it's already the
established pattern in this codebase (`task-crud/plan.md`) to flag and defer this exact
class of gap.

VERDICT: APPROVED
