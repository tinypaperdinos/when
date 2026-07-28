# Plan: Calendar view (issue #9)

Issue #9's full text (fetched via `gh issue view 9 --comments`):

> FullCalendar wired to tasks and events, with drag-and-drop rescheduling (README MVP
> scope — this is why FullCalendar was chosen over a lighter alternative, see
> .claude/AGENT_RULES.md). Deliberately last in the backlog: drag-and-drop needs an
> update procedure to call, so this depends on both Task CRUD and Events existing first.
>
> Depends on: Task CRUD (#4), Events (#7).
>
> Comment (author, same session): Also depends on the component library (#14 setup, plus
> date-time picker #16 for drag-and-drop editing UI, feedback #19 for event create/edit).

All four dependencies (#4 Task CRUD, #7 Events, #14 component library setup, #16
date-time picker) are merged into `main`, which this branch is cut from (verified:
`git merge-base main feat/calendar-view` == `main`'s tip, `2dd41db`). The issue comment's
mention of "date-time picker for drag-and-drop editing UI" and "feedback for event
create/edit" describes possible *future* polish (an edit modal opened from a calendar
click), not something this ticket's own text asks for — see §5 non-goals for why this
plan doesn't build a click-to-edit modal.

## 1. What "done" means

- A new, reachable page (`/calendar`) rendering a FullCalendar instance (`@fullcalendar/react`)
  showing every task that has a due date and every event, using the **free** feature set
  only (month/week/day/list views via `dayGrid`/`timeGrid`/`list` plugins + drag-and-drop
  via the `interaction` plugin) — no resource-timeline/scheduler view, per
  `AGENT_RULES.md`.
- Dragging a task or event to a new date/time on the calendar persists the new date by
  calling the **existing** `trpc.tasks.update` / `trpc.events.update` mutations (no new
  tRPC procedure is needed or added — this is the concrete answer to the ticket's own
  framing, "drag-and-drop needs an update procedure to call": that procedure already
  exists on both routers).
- A failed reschedule (mutation error) visually reverts the dragged item to its original
  slot and surfaces an inline error message; a successful reschedule is reflected via
  query invalidation.
- The page is reachable from the app (a nav link), not just addressable by typing the URL.
- No `apps/server` changes at all: no schema/migration change, no new router/service
  method. This is a pure `apps/web` ticket, consuming procedures that already exist. (This
  boundary is revisited explicitly in §3.1's timezone write-up below — it's a deliberate,
  named scope line, not an oversight of the deeper bug that write-up describes.)
- CI (`lint`, `typecheck`, `test`, `build`) stays green.

## 2. Context: what exists today

- **Backend, already sufficient, unmodified by this plan:**
  - `tasksRouter`/`TaskService` (`apps/server/src/routers/task-router.ts`,
    `.../services/task-service.ts`): `list()` (all tasks, any due date, unfiltered by
    range), `update(id, { title?, dueDate?, notes? })` — `dueDate` optional-but-present
    replaces the existing value; omitted leaves it untouched. Exactly what a drag-reschedule
    needs: call with `{ id, dueDate: <new wire string> }`, nothing else.
  - `eventsRouter`/`EventService` (`apps/server/src/routers/event-router.ts`,
    `.../services/event-service.ts`): `list()` (all events), `update(id, { title?, date?,
    notes? })` — same shape, `date` field instead of `dueDate`, not nullable (events don't
    support "unset date", per `tickets/event-crud/plan.md` §3.1).
  - Both `list()` queries return **every** row of that kind, no date-range filtering —
    there is no `apps/server` precedent for range-scoped queries anywhere yet (task-crud
    plan explicitly lists "pagination/filtering of `list`" as a non-goal). This plan
    follows that precedent rather than introducing the first range-scoped endpoint (see
    §3.3 and §5).
  - `wireDateTimeString` (`apps/server/src/services/schema-helpers.ts`): shared Zod
    schema, `^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$` — the wire format both `dueDate` and
    `date` inputs must match. This is the exact string shape the drag-drop handler must
    produce client-side (§3.4). Notably, this regex has **no room for a timezone
    designator** (no trailing `Z`, no `+HH:mm` offset) — the wire *input* format is
    inherently offset-less. This is load-bearing for the timezone write-up in §3.1: the
    client cannot "just send UTC explicitly" to sidestep server-side parsing ambiguity,
    because the schema itself forbids it. Confirmed by reading
    `apps/server/src/services/task-service.ts` / `event-service.ts`: both `create`/`update`
    convert the validated string via a bare `new Date(input.dueDate)` / `new Date(input.date)`
    — no manual UTC-anchoring (`Date.UTC(...)`, appending `Z`, etc.) is done server-side
    either.
  - **The `Date`-boundary gotcha** (`AGENT_RULES.md`): what actually crosses the wire on
    `list()` responses is not the wire-input string described above, but a *full ISO
    instant string with a trailing `Z`* (e.g. `"2026-07-28T00:00:00.000Z"`), because
    Prisma's `DateTime` column is serialized via `JSON.stringify` on the way out
    regardless of how the original value was written in. Concretely: whatever was sent on
    `create`/`update` (date-only `"2026-07-28"` parsed as UTC midnight, or
    `"2026-07-28T14:30"` parsed as *local* time) always comes back from `list()` as a full
    UTC ISO string — the two input shapes become indistinguishable except by inspecting
    the resulting UTC time-of-day. This is the crux of the "all-day vs. timed" rendering
    decision in §3.1 below, and is new territory: no prior ticket had to turn a `dueDate`/
    `date` value into a *calendar placement*, only into a `toLocaleDateString()` display
    string (`task-list-item.tsx`) or a raw echo back into another `update` call. This
    ticket is the first consumer that must decide how to place these values on a grid.
    **§3.1 below now traces this precisely: which half of this round-trip is genuinely
    timezone-safe by spec, and which half isn't, with the corrected trigger condition
    (server runtime timezone) and consequence (possible day-shift, not just a mislabel).**
- **Frontend, pattern to follow:**
  - `TasksPage` (`apps/web/src/routes/tasks-page.tsx`) is the only existing page:
    loading/error/empty/populated states over `useQuery(trpc.tasks.list.queryOptions())`.
    `CalendarPage` follows the same shape, over two parallel queries (§3.3).
  - `apps/web/src/trpc.ts` exports one derived type, `Task` (`Awaited<ReturnType<typeof
    trpcClient.tasks.list.query>>[number]>`), with a comment establishing the "always
    treat `dueDate` as a runtime string despite its inferred `Date` type" rule. This plan
    adds a symmetric `EventEntry` export the same way (§3.2) — needed because the
    calendar merges both kinds into one event list.
  - `router.ts` (TanStack Router): flat `rootRoute.addChildren([tasksRoute, ...devRoutes])`.
    This plan adds one more sibling route, `/calendar`.
  - `root-route.tsx`: today only renders `<Outlet />` plus a dev-only link to `/dev/ui`.
    There is **no persistent nav today** — `TasksPage` is mounted at `/`, the only route
    a real user can reach. Adding `/calendar` without a way to get there would make it
    unreachable in practice; §3.5 adds a minimal two-link nav.
  - `dueDatePayload` (`apps/web/src/lib/task-due-date.ts`) is the existing
    `DateTimePickerValue -> wire string` converter, used by `TaskCreateForm`. Confirmed by
    reading it: it's pure string concatenation off the two native `<input type=date>` /
    `<input type=time>` values (`${value.date}T${value.time}` or bare `value.date`) — it
    never constructs a `Date` object or calls `toISOString()`, so there is no hidden
    client-side timezone bug feeding *into* the create/edit path today. `DateTimePicker`
    itself (`apps/web/src/components/ui/date-time-picker.tsx`) is the same: two
    uncontrolled-native-input string values passed straight through, no `Date` object
    anywhere. (A "CalendarPopup" component was flagged as worth checking during this
    round's revision — confirmed by grep that no such component exists anywhere in this
    repo; there is also no event-create form yet at all, matching §5's existing note that
    event creation UI isn't part of this or any merged ticket. Nothing to audit there.)
    This plan's own `wireDateFromDrop` (§3.1) is structurally parallel to `dueDatePayload`:
    build the string from local date/time *components*, never from
    `Date.prototype.toISOString()` (which reinterprets in UTC and can shift the calendar
    day near local midnight in non-UTC timezones — the exact bug class `task-crud/plan.md`
    §3.1 already flagged and deferred, not fixed here either, and distinct from the
    server-side parsing issue traced in §3.1 below).
  - `apps/web/package.json` has **no `@fullcalendar/*` packages installed today**
    (confirmed by reading the file) — this ticket's one new dependency, explicitly
    sanctioned by `AGENT_RULES.md`'s "Calendar UI" bullet.
  - Tailwind v4 is active with default preflight (`@import "tailwindcss"` in
    `index.css`, no `@config` disabling preflight) — see §3.6 for why this matters for
    FullCalendar's table-based grid layout.
  - `Entry.tags` (Prisma) is a relation, but neither `TaskService.list()` nor
    `EventService.list()` uses `include: { tags: true }`, so tag data isn't present on
    `tasks.list`/`events.list` responses at all today, on this branch or on `main`. There
    is nothing to display/filter by tag on the calendar yet — not a gap this ticket
    introduces or needs to fill (see §5).

## 3. Task breakdown

### 3.1 New file: `apps/web/src/lib/calendar-events.ts` (+ `.test.ts`)

Pure functions — no React, no tRPC calls — so the actual date-handling logic (the part
most likely to have subtle bugs, and the part `reviewer-tests` should hold to the highest
bar) is fully unit-testable without mounting FullCalendar or simulating a drag gesture
(see §3.4 on why a real drag gesture isn't simulated in tests at all).

```ts
import type { EventInput } from "@fullcalendar/core";
import type { Task, EventEntry } from "../trpc";

export type CalendarEntry = Task | EventEntry;

// A wire timestamp is treated as "no specific time" (rendered as an all-day calendar
// chip) exactly when its literal characters end in the fixed suffix "T00:00:00.000Z" —
// a plain string comparison against the raw wire value, deliberately NOT
// `new Date(iso).getUTCHours() === 0 && ...`. This is a corrected implementation choice
// from round 1 of plan review, not just a style preference — see the full trigger/blast-
// radius write-up right below this function for why "no `new Date()` at all" matters here.
//
// Why the string check is reliable for what it's actually trying to detect: `list()`
// always serializes a `DateTime` column via `JSON.stringify`'s default `Date#toJSON`
// (no superjson transformer configured, per `AGENT_RULES.md`), which is always the fixed-
// width `toISOString()` shape `YYYY-MM-DDTHH:mm:ss.sssZ`. So the literal suffix is exactly
// as informative as re-parsing the string into a `Date` and reading UTC getters back off
// it — the two approaches are mathematically equivalent on a well-formed input. The
// string form is still the correct choice: it structurally cannot fall into the classic
// footgun of a typo'd *local* getter (`getHours()` instead of `getUTCHours()`), which
// would silently make the classification depend on the *browser's* timezone. With the
// string check, that failure mode doesn't exist as a possible implementation mistake —
// timezone-independence (with respect to whoever is *reading* this string) is a property
// of the code, not of the implementer remembering to use the right method name.
export function isMidnightUtc(iso: string): boolean {
  return iso.endsWith("T00:00:00.000Z");
}
```

**What this check does and does not protect against (corrected per plan-refiner round 1,
finding 1 — this replaces the previous, understated framing in this section and in old §6):**

- **What it fixes:** the classification function itself is now provably safe against
  *reader*-side (client) timezone effects, by construction, with zero reliance on which
  `Date` getter an implementer happens to reach for. Same for extracting the placed day out
  of an all-day entry: `entryToCalendarEvent` slices the date portion directly
  (`iso.slice(0, 10)` → `"YYYY-MM-DD"`) rather than `new Date(iso).getUTCFullYear()` /
  `getUTCMonth() + 1` / `getUTCDate()` — again a literal-character operation, not a
  re-parse, for the same reason.
- **What it does NOT fix, and cannot fix from `apps/web` alone:** the wire string these
  functions receive may already encode the *wrong instant* by the time it reaches the
  browser, because of how it was written in `apps/server`. Traced precisely (this is the
  corrected version of the finding — the original framing in this plan understated both
  the trigger and the consequence):
  - `TaskService`/`EventService` (`create`/`update`) convert the validated wire-input
    string via a bare `new Date(input.dueDate)` / `new Date(input.date)`. Per the ECMAScript
    Date Time String Format spec, a **date-only** string (`"YYYY-MM-DD"`, no `T`) is always
    interpreted as UTC midnight, unconditionally — this half of the round-trip is genuinely
    timezone-independent, confirmed against the spec text, not just tested behaviorally.
    So a task/event that was actually created with no time (`TaskCreateForm`'s default
    "Add time" unchecked, or a drag that lands on an all-day slot) round-trips to the exact
    same UTC-midnight instant and the exact same calendar day, on any server, in any
    timezone, always. **No bug in this branch.**
  - A **date-time** string (`"YYYY-MM-DDTHH:mm"`, no offset — the only timed shape
    `wireDateTimeString`'s regex allows, since it has no room for a `Z`/offset suffix, see
    §2) is, per the same spec, interpreted as **local time in whichever timezone the
    parsing JS engine is running in** — here, that's the Node **server** process, not the
    browser, and not the user who picked the time. This repo pins no `TZ` anywhere (no env
    var in `.github/workflows/ci.yml`, no `Dockerfile`, confirmed by search), so that
    timezone is whatever the host/container defaults to at runtime — unknown, not
    necessarily UTC, and not necessarily the same as the browsing user's own timezone
    either way.
  - **Trigger condition (corrected):** it is the **server's** runtime offset that
    determines the risk, not "the user happens to be in UTC+0." Any user, in any
    timezone, hits this if the server process happens to be running in UTC (arguably the
    *more* likely default for a deployed Node service, not a narrow edge case) — a
    literally-midnight time entry collides with the all-day heuristic in that case.
  - **Consequence (corrected — this is the part the original plan text omitted
    entirely):** if the server's runtime offset is *non-zero* (e.g. a developer running the
    dev server locally in a non-UTC zone), the collision isn't limited to literal `00:00`
    inputs — it's whichever local wall-clock hour maps to UTC midnight under that offset
    (e.g. server TZ UTC-5 ⇒ local `19:00` maps to UTC midnight). When that happens, the
    entry isn't just mislabeled all-day instead of timed — the UTC date part of the
    resulting instant (which `isMidnightUtc`'s `true` branch uses as the placed day) is a
    **different calendar day** than the one the user actually picked in local time.
    Concretely: a task set for "July 28, 7pm" against a UTC-5 server renders as an untimed
    chip on **July 29**, silently, with no error surfaced anywhere (the mutation succeeds,
    `invalidateQueries` refetches, the item just appears to have moved).
  - **Drag-and-drop doesn't introduce a new bug class here — it's one more path into an
    existing one.** `wireDateFromDrop` (below) produces the exact same wire-input shape
    (`"YYYY-MM-DD"` or `"YYYY-MM-DDTHH:mm"`, no offset) that `TaskCreateForm`/`dueDatePayload`
    already produces today, and it's fed to the exact same `TaskService.update`/
    `EventService.update` code path. So a timed drag-drop reschedule is exactly as exposed
    to the server-timezone risk above as a timed entry created through the existing form —
    this ticket doesn't make the underlying issue worse, it just makes the drop path one
    more way to observe it (and, per the failure mode above, observe it with zero error
    surfaced, since the mutation itself succeeds).
  - **Why this plan doesn't fix the root cause:** the actual fix lives in `apps/server`
    (e.g. `TaskService`/`EventService` anchoring time-bearing wire strings to UTC
    explicitly — `Date.UTC(year, month - 1, day, hours, minutes)` built from the string's
    own captured groups, rather than a bare `new Date(possiblyLocalString)`) or in relaxing
    `wireDateTimeString`'s regex to accept an explicit offset and having the client always
    send one. Either change is an `apps/server` change, which this ticket's own scope (§1)
    deliberately excludes — this is a pure `apps/web` ticket layered on top of already-
    merged, already-reviewed server code, and reopening that code here would both blow the
    stated scope boundary and revisit a decision (`task-crud/plan.md` §3.1's "date-only vs.
    timed ambiguity, deferred") that predates this ticket. **This is flagged, not silently
    absorbed:** see §5 for this listed explicitly as an out-of-scope item with a suggested
    follow-up, and see the open question in §6 for the residual judgment call this leaves.

```ts
// Converts one Entry row (task or event) into a FullCalendar EventInput, or null if it
// has nothing to place (a task with no dueDate — never true for events, whose `date` is
// required on create per event-crud plan §3.1, but the null check is defensive).
export function entryToCalendarEvent(entry: CalendarEntry): EventInput | null { ... }

// Merges tasks + events into one FullCalendar `events` array, dropping nulls.
export function calendarEntries(
  tasks: Task[] | undefined,
  events: EventEntry[] | undefined,
): EventInput[] { ... }

// The inverse direction: a FullCalendar drop result -> a wireDateTimeString-compatible
// string, built from the dropped-to Date's *local* getters, zero-padded — never
// toISOString(). Getters used: `getFullYear()`, `getMonth() + 1` (note the `+ 1`
// explicitly: `getMonth()` is zero-indexed, Jan = `0` — a well-known JS footgun that's
// easy to get "digit-shaped but wrong," e.g. January silently becoming `"00"`, which is
// still valid against `wireDateTimeString`'s regex and silently wrong as a date; called
// out here by name rather than left implicit, per plan-refiner round 1 finding 2),
// `getDate()`, `getHours()`, `getMinutes()`. This matters for both branches: for a timed
// drop, toISOString() would convert to UTC and shift the hour (and potentially the day,
// near midnight) in any non-UTC *browser* timezone; for an all-day drop, FullCalendar's
// own `event.start` for an all-day event is already anchored to *local* midnight of the
// intended calendar day, so local getters recover the right day exactly (this is *not* a
// case where UTC getters would coincidentally also work). Note this is a client-side/
// browser-timezone concern, orthogonal to the server-side timezone issue traced above —
// `wireDateFromDrop` itself has no timezone bug; the string it hands off can still be
// misinterpreted one hop later, server-side, for the reasons documented above.
export function wireDateFromDrop(date: Date, allDay: boolean): string { ... }
```

`entryToCalendarEvent` also sets:
- `id: entry.id` — tasks and events share one `Entry` table / one cuid id space (Prisma
  `@id @default(cuid())` on the single `Entry` model), so a task id and an event id can
  never collide; no kind-prefixing of FullCalendar's `id` is needed.
- `extendedProps: { kind: entry.kind, completed: entry.kind === "task" ? entry.completed
  : undefined }` — read back in the drop handler (§3.3) to decide which mutation to call,
  and in `eventClassNames` to mute completed tasks visually (line-through / reduced
  opacity, echoing `task-list-item.tsx`'s existing `line-through` treatment — completed
  tasks stay visible and draggable on the calendar; rescheduling a completed task is odd
  but not disallowed, and the ticket gives no reason to filter it out).
- `durationEditable: false` — `Entry` has no end-date/duration field at all (single
  `dueDate`/`date` point in time), so FullCalendar's resize handle would have nothing
  meaningful to persist to. Set globally on the `<FullCalendar>` element too
  (`eventDurationEditable={false}`), not just per-event, so resize is never offered.

### 3.2 `apps/web/src/trpc.ts` (modified)

Add, alongside the existing `Task` export, following the exact same derivation pattern
and carrying the same "runtime string despite inferred `Date` type" comment forward:

```ts
export type EventEntry = Awaited<ReturnType<typeof trpcClient.events.list.query>>[number];
```

(Named `EventEntry`, not `Event`, to avoid shadowing the DOM's global `Event` type in any
file that imports it unqualified.)

### 3.3 New file: `apps/web/src/routes/calendar-page.tsx` (+ `.test.tsx`)

Structurally parallel to `TasksPage`:

```tsx
export function CalendarPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const tasksQuery = useQuery(trpc.tasks.list.queryOptions());
  const eventsQuery = useQuery(trpc.events.list.queryOptions());
  const [dragError, setDragError] = useState<string | null>(null);

  const events = useMemo(
    () => calendarEntries(tasksQuery.data, eventsQuery.data),
    [tasksQuery.data, eventsQuery.data],
  );

  const updateTask = useMutation(trpc.tasks.update.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.tasks.list.queryKey() }),
  }));
  const updateEvent = useMutation(trpc.events.update.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.events.list.queryKey() }),
  }));

  function handleEventDrop(info: EventDropArg) {
    setDragError(null);
    if (!info.event.start) { info.revert(); return; }
    const wireDate = wireDateFromDrop(info.event.start, info.event.allDay);
    const onError = (err: { message: string }) => { info.revert(); setDragError(err.message); };
    if (info.event.extendedProps.kind === "task") {
      updateTask.mutate({ id: info.event.id, dueDate: wireDate }, { onError });
    } else {
      updateEvent.mutate({ id: info.event.id, date: wireDate }, { onError });
    }
  }

  const isLoading = tasksQuery.isLoading || eventsQuery.isLoading;
  const isError = tasksQuery.isError || eventsQuery.isError;

  return (
    <>
      {isLoading && <p>Loading calendar…</p>}
      {isError && <p>Something went wrong loading the calendar.</p>}
      {dragError && <p>Couldn&apos;t reschedule: {dragError}</p>}
      {!isLoading && !isError && (
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
          }}
          editable
          eventDurationEditable={false}
          events={events}
          eventDrop={handleEventDrop}
        />
      )}
    </>
  );
}
```

Design notes:
- **Combined loading/error state, not per-query.** Mirrors `TasksPage`'s existing simple
  boolean style rather than a granular "tasks loaded but events failed" UI. Deliberate
  simplification (see §5), not an oversight.
- **No optimistic React Query cache patching.** On drop, FullCalendar already moves the
  DOM element itself before any network call resolves (that's native FullCalendar
  behavior, independent of React state). This plan relies on that + `info.revert()` on
  error + `invalidateQueries` on success to reconcile, rather than hand-rolling an
  optimistic cache update — simpler, and avoids a second place where the
  all-day/timed-string logic would need to be duplicated (see §5).
- `handleEventDrop` is kept intentionally thin (dispatch on `kind`, build the payload via
  `wireDateFromDrop`, call the right mutation) — the actual logic lives in the pure,
  unit-tested `calendar-events.ts` functions, mirroring `AGENT_RULES.md`'s "thin
  procedure, logic in a service class" convention translated to a frontend event handler.
- No `select`/`dateClick`/`eventClick` handlers — see §5 for why (no calendar-initiated
  create/edit this round).
- **`dragError` is deliberate local state, not the declarative
  `{mutation.isError && <p>{mutation.error.message}</p>}` pattern used elsewhere in this
  codebase** (`task-create-form.tsx`, `task-list-item.tsx`) — flagged by plan-refiner
  round 1 finding 3 as worth either justifying or matching. Justification: two separate
  mutation objects (`updateTask`, `updateEvent`) back this one error surface, and
  TanStack Query only resets a given mutation's own `isError`/`isSuccess` when *that same*
  mutation object's `.mutate()` is called again — not when a sibling mutation succeeds. A
  naive declarative combination, `(updateTask.isError || updateEvent.isError) && <p>...`,
  would leave a stale error banner visible after a failed task drag followed by an
  unrelated *successful* event drag, since `updateTask.isError` never gets cleared by
  `updateEvent`'s success. The local `dragError` state, reset unconditionally at the top of
  every `handleEventDrop` call regardless of which mutation is about to run, correctly
  clears the banner on *any* new drag attempt. This is a correctness reason, not a style
  preference — kept as local state rather than switched to match the declarative
  convention.

### 3.4 Testing strategy for drag-and-drop specifically

FullCalendar's drag-and-drop is driven by low-level pointer events on its own internal
DOM structure; reliably simulating a real drag gesture through it in jsdom + Testing
Library is not practical (this is a widely-known limitation, not specific to this repo)
and `AGENT_RULES.md` already steers `reviewer-code` away from spinning up a real browser
for this kind of thing unless nothing else can confirm a finding. This plan does not
attempt an end-to-end simulated-drag test. Instead:
- `calendar-events.test.ts` unit-tests `wireDateFromDrop` and `isMidnightUtc` directly and
  exhaustively (see §4) — this is where the real logic (and real bug risk) lives.
- `calendar-page.test.tsx` unit-tests `handleEventDrop`'s *dispatch* logic by calling it
  directly with a hand-built fake `EventDropArg`-shaped object (`{ event: { id, start,
  allDay, extendedProps: { kind } }, revert: vi.fn() }`) rather than triggering it via a
  simulated drag — confirms the task-vs-event mutation dispatch, the `revert()`-on-error
  call, and the error message rendering, without needing FullCalendar's real pointer
  machinery. This requires exporting `handleEventDrop`'s logic in a way that's callable
  from a test — either by extracting it into `calendar-events.ts` as one more pure
  function (`buildRescheduleMutationArgs(info) -> { kind, id, payload }`, with the
  component only left to call the right mutation and handle revert/error) or by testing
  it indirectly through a rendered `CalendarPage` and manually invoking the `eventDrop`
  prop function TestingLibrary/RTL captured off the mocked `<FullCalendar>` — the plan
  leaves the exact mechanic to the implementer, but the constraint ("cover the dispatch
  logic without a real simulated drag") is fixed.
- `calendar-page.test.tsx` also covers the non-drag states: loading, error, and a
  populated render (assert an event title from a mocked `tasks.list`/`events.list`
  response appears in the rendered output — FullCalendar renders real DOM text nodes for
  event titles, so `screen.findByText` works the same way it does for `TasksPage`).

### 3.5 `apps/web/src/router.ts` + `apps/web/src/routes/root-route.tsx` (modified)

- `router.ts`: add `calendarRoute` (path `/calendar`, component `CalendarPage`) as a
  sibling of `tasksRoute` in `rootRoute.addChildren([...])`.
- `root-route.tsx`: add a small persistent nav with two links, `Tasks` (`/`) and
  `Calendar` (`/calendar`), above `<Outlet />` — today there is genuinely no way for a
  user to reach any route other than `/` (the dev-only `/dev/ui` link is explicitly
  gated behind `import.meta.env.DEV`). Without this, `/calendar` would be shippable but
  practically unreachable, which this plan treats as failing "done" in spirit even though
  every other piece works. Kept minimal/unstyled beyond basic Tailwind utility classes,
  consistent with the existing dev-link's minimalism — no new nav component is
  introduced.

### 3.6 New dependency: FullCalendar packages, pinned to v6, not v7

`apps/web/package.json` dependencies gains:

```
"@fullcalendar/core": "^6.1.21",
"@fullcalendar/daygrid": "^6.1.21",
"@fullcalendar/interaction": "^6.1.21",
"@fullcalendar/list": "^6.1.21",
"@fullcalendar/react": "^6.1.21",
"@fullcalendar/timegrid": "^6.1.21"
```

`AGENT_RULES.md` names `@fullcalendar/react` as the chosen library without pinning a
major version; this plan makes that pin explicit and flags the reasoning since it's a
real, checked judgment call: FullCalendar's `latest` npm dist-tag is currently `7.0.2`
(confirmed via `npm view`, published within the last few days), but v7 is a breaking
change from v6 in ways that add real integration risk for no benefit here — it requires a
new `temporal-polyfill` peer dependency, and (unlike v6, which auto-injects its own CSS
via JS, confirmed via FullCalendar's own v6 upgrade notes) v7 **stops** bundling/injecting
CSS and requires the consumer to import stylesheets manually. v6.1.21's peer deps
(`react: '^16.7.0 || ^17 || ^18 || ^19'`) support this repo's React 19 cleanly, and v6 is
the version essentially all existing FullCalendar+React documentation and prior art
targets. Pinning to `^6.1.21` avoids taking on a days-old major version's rough edges for
a feature this ticket needs to land correctly the first time; revisiting the v7 upgrade
is a reasonable separate future ticket, not something to half-adopt here.

Confirmed sound by plan-refiner round 1: version, peer-dep compatibility, and the
`temporal-polyfill`/CSS-injection claims were independently verified. No change this
round.

No CSS import is added for FullCalendar itself (v6 auto-injects). See §3.7 for a
FullCalendar/Tailwind interaction risk that *does* need attention.

### 3.7 Tailwind preflight vs. FullCalendar's `<table>`-based grid — flagged risk, not pre-solved

`apps/web/src/index.css` uses `@import "tailwindcss"` with default preflight active (no
preflight-disabling config found). Tailwind's preflight resets base styles on
`table`/`th`/`td`/`button` etc. (e.g. `border-collapse`, margins), and FullCalendar's
`dayGrid`/`timeGrid` views are built on `<table>` layouts internally. This is a
well-known real-world friction point when combining FullCalendar with a Tailwind
preflight, independent of this codebase. This plan does not pre-emptively write override
CSS for a problem that hasn't been observed yet (that would be guessing at what's
actually broken); instead it's called out as a concrete implementation task: after wiring
`CalendarPage` up, run the dev server and visually confirm the grid renders with intact
borders/spacing (this is a visual-only check `reviewer-code` isn't expected to redo per
`AGENT_RULES.md`'s "don't spin up a browser unless nothing else can confirm a finding" —
the implementer does this once while building, not every reviewer/fixer round). If it
does look broken, the fix is a small, scoped CSS override in `index.css` (FullCalendar
documents CSS custom properties like `--fc-border-color` for exactly this, per v6's docs)
— not a preflight-disabling change, which would affect every other component.

## 4. Edge cases and error conditions

Unit-tested in `calendar-events.test.ts` unless noted:
1. Task with `dueDate: null` — `entryToCalendarEvent` returns `null`, excluded from the
   merged array (nothing to place on a grid).
2. Event with `date` present (the normal case; `date` is required on event creation).
3. A wire timestamp at exactly `T00:00:00.000Z` -> `isMidnightUtc` true (via the literal
   suffix check, §3.1) -> `entryToCalendarEvent` returns `{ start: "YYYY-MM-DD", allDay:
   true, ... }`, where the `"YYYY-MM-DD"` is the string's own first 10 characters, not a
   re-parsed `Date`'s getters.
4. A wire timestamp at any other UTC time-of-day -> `allDay: false`, `start` is the full
   ISO string.
5. **New this round:** near-miss strings that must *not* false-positive on the literal
   suffix check — `"...T00:00:00.001Z"` (one millisecond off) and `"...T00:00:01.000Z"`
   (one second off) both -> `isMidnightUtc` false. Confirms the check is an exact literal
   match on the fixed-width suffix, not a loose numeric comparison that happens to ignore
   sub-minute precision.
6. `calendarEntries(undefined, undefined)` (both queries still pending) -> `[]`, not a
   throw — `CalendarPage` guards this anyway via `isLoading`, but the pure function
   shouldn't assume non-undefined input.
7. `wireDateFromDrop` for an all-day drop -> date-only string, built from **local**
   `Date` getters (verify against a constructed `Date` whose local vs. UTC date would
   differ, to actually exercise the "not `toISOString()`" guarantee rather than a
   timezone-insensitive test case that would pass either way).
8. `wireDateFromDrop` for a timed drop -> `YYYY-MM-DDTHH:mm`, zero-padded single-digit
   hours/minutes (e.g. `9:05` -> `"09:05"`, not `"9:5"` — would otherwise fail
   `wireDateTimeString`'s server-side regex).
9. **New this round, directly targeting refiner round 1 finding 2:** `wireDateFromDrop`
   for a drop landing in **January** -> the wire string's month component is `"01"`, not
   `"00"` — a dedicated test case for the `getMonth() + 1` off-by-one, not left to be
   incidentally caught by test 8's arbitrary date.
10. Both tasks and an event present with the same literal id string across kinds is
    impossible by construction (§3.1) — documented, not tested as a runtime guard, since
    there's no code path that could produce it.

Covered in `calendar-page.test.tsx`:
11. Loading state (both queries pending).
12. Error state (either query rejects) — combined boolean, not per-source (§3.3, §5).
13. Populated render: a task and an event from mocked responses both appear.
14. Empty state: both lists resolve empty — FullCalendar renders an empty grid; test
    asserts the page renders without throwing (no special "no entries" text needed here,
    unlike `TasksPage`'s explicit "No tasks yet" — a calendar grid is self-evidently
    "empty" the way a list isn't).
15. Drop dispatch: dragging a `kind: "task"` entry calls `trpc.tasks.update` with
    `dueDate`; dragging a `kind: "event"` entry calls `trpc.events.update` with `date` —
    confirmed via mocked mutation calls (mechanism per §3.4).
16. Drop failure: mutation `onError` triggers `revert()` and sets/render the inline error
    message.
17. **New this round, targeting the local-state justification in §3.3:** after a failed
    task drag (banner visible), a *successful* event drag clears the banner — exercises
    the exact scenario §3.3's justification for local `dragError` state (over the
    declarative `mutation.isError` convention) is about; this is the test that would fail
    if the implementer "simplified" the error state back to the declarative combined-
    `isError` form.
18. Completed task still renders (with muted styling) and is still a valid drop target
    for the dispatch logic — no special-casing that excludes it.

Documented but deliberately **not** covered by a test in this ticket (see §3.1's write-up
and §5):
19. A timed reschedule landing on a server process whose runtime timezone offset causes
    the resulting UTC instant to collide with midnight (false all-day classification) or
    to fall on a different UTC calendar day than the user's local intent (day-shift). Not
    testable meaningfully at the `apps/web` unit level, since the corruption happens
    server-side, in code this ticket doesn't touch — a test here would either mock away
    the exact server behavior being described (proving nothing) or would need to be an
    `apps/server`-level test asserting on `TaskService`/`EventService`'s `Date` parsing,
    which is out of this ticket's scope per §1/§5. Recorded here so the gap is visible next
    to the other edge cases, not only in prose.

## 5. Explicitly out of scope (and why)

- **No server-side fix for timezone-dependent parsing of timed wire strings
  (`TaskService`/`EventService`'s `new Date(input.dueDate)` / `new Date(input.date)`).**
  Traced in full in §3.1: a wire string with a time component and no offset
  (`"YYYY-MM-DDTHH:mm"` — the only timed shape the schema allows) is parsed as local time
  in the **server process's** runtime timezone, which this repo pins nowhere. On a
  non-UTC server, this can silently misclassify a timed task/event as all-day, or worse,
  place it on the wrong calendar day, with no error surfaced — and drag-and-drop
  (`wireDateFromDrop`) reaches this exact same server code path, so it's exposed to it
  too. This is a real, verified bug, but its actual fix (anchoring server-side parsing to
  UTC explicitly, or extending `wireDateTimeString`'s regex to accept and require an
  explicit offset) is an `apps/server` change, and this ticket's own "done" definition
  (§1) is a pure `apps/web` ticket layered on already-merged, already-reviewed server
  code — reopening `TaskService`/`EventService` here would blow that boundary for a
  pre-existing gap this ticket didn't introduce (`task-crud/plan.md` §3.1 already flagged
  and deferred the date-only-vs-timed ambiguity this descends from). What this ticket
  *does* do: make its own classification logic (`isMidnightUtc`, the day-extraction in
  `entryToCalendarEvent`) provably immune to any *additional* timezone dependency of its
  own (the literal-string-check fix in §3.1), and document the residual server-side risk
  accurately (corrected trigger condition and consequence, §3.1) rather than
  under-describing it as the original version of this plan did. **Recommended follow-up:**
  a small, focused `apps/server` ticket — "anchor wire date-time parsing to UTC
  explicitly" — scoped narrowly enough to not need FullCalendar/frontend context at all.
- **No server-side date-range-scoped `list` query.** Both `tasks.list`/`events.list`
  already return every row unfiltered; this ticket doesn't add the first range-scoped
  endpoint in the app. Matches existing precedent (`task-crud/plan.md` lists
  "pagination/filtering of `list`" as a non-goal) and the app's actual current scale
  (single-user, local SQLite). Flagged as a future scaling concern if the dataset ever
  grows large, not a gap in this ticket.
- **No calendar-initiated creation** (clicking/dragging on an empty cell to create a new
  task/event via `dateClick`/`select`). The issue text asks for tasks/events "wired to"
  the calendar "with drag-and-drop rescheduling" — creation stays exclusively through the
  existing `TaskCreateForm` (there's no equivalent event-create form in `apps/web` at all
  yet, confirmed by grep — event creation UI isn't part of this ticket or any merged
  ticket so far). A follow-up ticket, not this one.
- **No click-to-edit modal** (`eventClick`) for title/notes/date editing beyond
  drag-reschedule. The issue comment's mention of "feedback #19 for event create/edit"
  reads as scoping a *future* editing-UI ticket's dependencies, not as this ticket's own
  requirement — issue #9's own text only asks for display + drag-and-drop reschedule.
- **No tag display or tag-based filtering on the calendar.** Not just deferred by choice —
  `tasks.list`/`events.list` don't even `include: { tags: true }` today, so there's no
  tag data in the API response to show yet, independent of this ticket.
- **No optimistic React Query cache patching on drag** — see §3.3's design note.
- **No FullCalendar v7 adoption** — see §3.6.
- **No resource-timeline/scheduler views** — explicitly excluded by `AGENT_RULES.md`
  (paid license).

## 6. Open question for refiner (flagging, not silently deciding)

Everything above is a concrete design call with reasoning attached, per this codebase's
existing planning convention (see `event-crud/plan.md` §3.1 for precedent: pick an
interpretation, document why, note what a reversal would cost). Round 1 of review raised
one real, confirmed gap (the all-day heuristic's mischaracterized risk) and two minor,
non-blocking notes; all three are addressed above (§3.1 for the risk write-up and the
literal-string fix, §3.1/pseudocode for `getMonth() + 1`, §3.3 for the `dragError`
justification). One item remains genuinely open, carried forward from round 1 rather than
newly introduced:

- **Given the corrected, wider blast-radius understanding of the server-side timezone gap
  (§3.1, §5), is "frontend-only, flag it, ship it" still the right call for *this*
  ticket, or should this plan instead pull in a minimal, narrowly-scoped `apps/server`
  fix** (e.g. just the `Date.UTC(...)`-anchoring change to `TaskService`/`EventService`,
  with no other server changes) **as part of this ticket, given that drag-and-drop is
  this ticket's headline feature and is a direct trigger path for the bug?** This plan's
  position is still "no" — the fix is a clean, separable, narrowly-scoped change that
  doesn't need any FullCalendar/calendar-page context to design or review, so bundling it
  into an otherwise pure-frontend ticket would mix concerns and make this ticket's diff
  harder to review for what it's actually about, without meaningfully de-risking the
  timeline (the bug is *reachable* via drag-and-drop, but it isn't *caused* by it — it's
  equally reachable today via the existing `TaskCreateForm` time picker, on any
  non-UTC-server deployment, independent of this ticket ever landing). But this is a
  judgment call about ticket boundaries, not a factual question, and it's flagged again
  explicitly here in case the answer should go the other way.
</content>
