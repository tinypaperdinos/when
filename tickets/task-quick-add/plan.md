# Plan: Upgrade task creation prompt (issue #50)

## 1. What "done" means

Task **creation** (`TaskCreateForm`) collects everything — title, due date/time, tags —
through a single text input, instead of a title field plus a separate `DateTimePicker`.
As the user types:

- A relative date/time phrase anywhere in the input (`tomorrow`, `next monday`,
  `in 3 days`, `tomorrow at 5pm`, …) is detected via `chrono-node`, used to set the
  task's due date/time, and removed from the text that becomes the title.
- Any `#tagname` token is collected as a tag and removed from the text that becomes the
  title.
- A live preview under the input shows the currently-detected due date and tags (if
  any), updating on every keystroke, so a misparse is visible before the user submits.
- Notes/description is **not** collected at creation time (dropped from the create form
  entirely — it's edit-only).
- Submitting sends `{ title, dueDate?, tags? }` to the existing `tasks.create`
  procedure — no server/schema changes, since it already accepts exactly this shape.

Task **editing** (`TaskListItem`'s inline edit mode) is untouched: title field,
`DateTimePicker`, notes `Textarea`, and `TagInput` all stay exactly as they are today,
as the fallback/correction path the ticket calls for.

Out of scope (explicit in the ticket, restated here so reviewers don't flag them as
gaps): recurring-rule parsing, date-range parsing (e.g. "Mon–Fri" or two dates in one
result). Also out of scope, decided while planning (see §4): editing gaining any
quick-add behavior, autocomplete/suggestions in the create form, and any backend change.

## 2. Task breakdown

### 2.1 New dependency

- Add `chrono-node` (`^2.10.1`, MIT, zero runtime deps, ships its own `dist/esm/index.d.ts`
  types) to `apps/web/package.json` `dependencies`.
- Run `npm install` from the repo root (not a hand-edit) so the root `package-lock.json`
  picks up the new resolved entry — a stale lockfile fails CI's `npm ci` step.

### 2.2 New file: `apps/web/src/lib/quick-add-parse.ts`

Pure, framework-free parsing function — no React, easy to unit test directly, matching
this repo's existing `lib/task-due-date.ts` pattern for wire/domain conversions that
don't belong inside a component.

```ts
export interface QuickAddParseResult {
  title: string;
  tags: string[];
  dueDate?: Date;
  dueDateHasTime: boolean;
}

export function parseQuickAdd(raw: string, referenceDate: Date = new Date()): QuickAddParseResult
```

Algorithm:
1. If `raw.trim() === ""`, short-circuit and return
   `{ title: "", tags: [], dueDate: undefined, dueDateHasTime: false }` without invoking
   chrono.
2. **Tags first.** Match `/#([^\s#]+)/g` against `raw`. A token only counts if at least
   one non-whitespace, non-`#` character immediately follows the `#` — so a bare trailing
   `#`, `# tag` (space right after `#`), or `C#` (nothing usable after the `#`) are all
   left as literal text, not treated as tags.
   - De-dupe case-insensitively, keeping the first-seen casing — mirrors
     `TagInput`'s own dedup semantics (`tag-input.tsx`) and the server's
     `TagService.resolveConnections` (case-insensitive match, case-preserving storage),
     so what the live preview shows matches what will actually be created.
   - Build `withoutTags` = `raw` with every matched `#token` substring removed.
3. **Date/time second**, run against `withoutTags` (not the original `raw`) so match
   indices line up with the string being mutated:
   `chrono.parse(withoutTags, referenceDate, { forwardDate: true })`.
   - `forwardDate: true` so a bare, yearless phrase like "june 3" (no explicit
     relative word) resolves to the next *future* occurrence rather than possibly
     landing in the past — the more useful default for a task's due date.
   - Only `results[0]` is used; any additional matches in the same input are ignored.
     This is the deliberate "one date phrase per quick-add line" scope decision, in the
     same spirit as the ticket's explicit date-range exclusion — not a bug.
   - If a result exists: `dueDate = results[0].start.date()`,
     `dueDateHasTime = results[0].start.isCertain("hour")` (chrono's own certainty flag —
     true only when the phrase actually specified a time, e.g. "at 5pm"; false for a
     bare "tomorrow", which chrono still resolves to a Date but with an inferred/implied
     time-of-day). Remove `results[0].text` (via `results[0].index` +
     `results[0].text.length`) from `withoutTags`.
   - Else: no due date, text unchanged.
4. Collapse whitespace left behind by the two removals and trim:
   `.replace(/\s+/g, " ").trim()` → `title`.
5. Return `{ title, tags, dueDate, dueDateHasTime }`.

### 2.3 Extend `apps/web/src/lib/task-due-date.ts`

Add one new exported function, reusing the existing private `pad` helper (already used
by `dueDateValueFromWireDate`) instead of duplicating date-padding logic in
`quick-add-parse.ts`:

```ts
// Converts a JS Date + an explicit "was a time actually specified" flag into a wire
// dueDate string. Unlike dueDateValueFromWireDate's midnight-means-date-only heuristic
// (needed there because a wire string alone can't distinguish "no time" from
// "midnight"), quick-add has a real certainty signal from chrono, so hasTime is
// required rather than inferred.
export function wireDateTimeStringFromDate(date: Date, hasTime: boolean): string {
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return hasTime ? `${datePart}T${pad(date.getHours())}:${pad(date.getMinutes())}` : datePart;
}
```

Uses local-time getters (`getFullYear`/`getMonth`/`getDate`/`getHours`/`getMinutes`),
consistent with every other function in this file and this codebase's documented
"no timezone handling yet, round-trips in the dev/CI UTC environment" stance.

### 2.4 Rewrite `apps/web/src/routes/task-create-form.tsx`

- Drop the `tagSuggestions` prop entirely — the quick-add input has no autocomplete
  surface (see §4). New signature: `export function TaskCreateForm()`.
- Remove: `DateTimePicker`/`DateTimePickerValue` import, `Textarea` import, `TagInput`
  import, `dueDatePayload` import.
- Add: `Badge` import, `parseQuickAdd` (from the new lib file),
  `wireDateTimeStringFromDate` (from `task-due-date.ts`).
- State collapses to a single `const [rawInput, setRawInput] = useState("")`.
- Derive `const parsed = useMemo(() => parseQuickAdd(rawInput), [rawInput])`. The dep
  array is deliberately just `[rawInput]` (not also whatever `referenceDate` defaults
  to) — the parse should only re-run when the text actually changes, not on unrelated
  re-renders; this also guarantees the due date shown in the live preview is exactly
  the one that gets submitted (both reads come from the same memoized value in the same
  render), with no risk of "now" drifting between preview and submit inside one render.
- `handleSubmit`: guard on `parsed.title === ""` (covers empty input, whitespace-only
  input, and input that parsed entirely into a date phrase and/or tags with nothing left
  as a title) and return early, same shape as today's empty-title guard. Otherwise call
  `createMutation.mutate({ title: parsed.title, dueDate: parsed.dueDate ?
  wireDateTimeStringFromDate(parsed.dueDate, parsed.dueDateHasTime) : undefined, tags:
  parsed.tags.length > 0 ? parsed.tags : undefined })`. No `notes` field at all.
- `onSuccess`: reset with `setRawInput("")` (replaces the four-field reset).
- Render:
  - One `TextInput` (`aria-label="Task title"` — kept as-is so it doesn't ripple into
    `tasks-page.test.tsx`'s existing `getByLabelText("Task title")` assertion;
    `placeholder` updated to hint at the syntax, e.g.
    `Add a task… try "tomorrow 5pm #chores"`), `value={rawInput}`,
    `onChange={(e) => setRawInput(e.target.value)}`.
  - A live-preview block, rendered **only when there's something to show**
    (`parsed.dueDate || parsed.tags.length > 0`) — an empty phase shows nothing rather
    than a placeholder "nothing detected" message (keeps the form visually quiet while
    the user is still typing plain text). Wrapped in
    `<div role="status" aria-live="polite">`, mirroring the existing a11y pattern
    already established by `components/ui/loading-state.tsx`, so preview updates are
    announced to assistive tech without a new pattern.
    - `parsed.dueDate && <p>Due {parsed.dueDateHasTime ? parsed.dueDate.toLocaleString() : parsed.dueDate.toLocaleDateString()}</p>` —
      matches the plain `.toLocaleDateString()` convention `task-list-item.tsx` already
      uses for displaying `task.dueDate` (no new `Intl.DateTimeFormat` options
      introduced).
    - `parsed.tags.length > 0 && <div className="flex flex-wrap gap-2">{parsed.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>` —
      reuses `Badge` exactly as `task-list-item.tsx` does for read-only tag display (no
      remove button — these aren't editable chips, they're a preview of what the tag
      parser found).
  - Submit button (`Add task`) and inline mutation-error paragraph: unchanged.

### 2.5 `apps/web/src/routes/tasks-page.tsx`

Change `<TaskCreateForm tagSuggestions={tagSuggestions} />` to `<TaskCreateForm />`.
Keep the `trpc.tags.list` query and the `tagSuggestions` array exactly as they are —
`<TaskListItem>` still consumes them for its edit-mode `TagInput` autocomplete.

### 2.6 `apps/web/src/routes/task-list-item.tsx`

**No changes.** Explicit ticket requirement: editing keeps its existing
`DateTimePicker` + `Textarea` (notes) + `TagInput` as the fallback/correction path.

### 2.7 No backend changes

`taskCreateInput` (`apps/server/src/services/task-schema.ts`) already accepts
`{ title, dueDate?: wireDateTimeString, notes?, tags?: string[] }` with `dueDate`
optional and `notes` optional — the quick-add payload (title + optional dueDate +
optional tags, no notes) fits the existing schema with zero server-side edits.

### 2.8 No new `components/ui/` primitive

The quick-add input/preview is composed entirely from existing, already-registered
primitives (`TextInput`, `Badge`) plus feature-specific parsing logic tied to task
semantics — it isn't a generic, reusable UI primitive the way `DateTimePicker`/
`TagInput` are, so it stays inline in `task-create-form.tsx` (a `routes/` component) and
`lib/quick-add-parse.ts`, and does **not** need a new section in
`src/routes/ui-demo-page.tsx` (per `components/ui/README.md`'s "every component in
`components/ui/` must be in the demo page" rule — this isn't a `components/ui/`
addition).

## 3. Tests

### 3.1 New: `apps/web/src/lib/quick-add-parse.test.ts`

Pure function tests (no rendering), passing an explicit `referenceDate` to most cases
for determinism, matching one case against the `new Date()` default via
`vi.useFakeTimers()`/`vi.setSystemTime()` (same pattern already used in
`task-create-form.test.tsx`):

- Plain text, no date phrase, no tags → title unchanged, `dueDate` undefined,
  `dueDateHasTime` false, `tags` `[]`.
- `"tomorrow"` → `dueDate` is the next calendar day relative to `referenceDate`,
  `dueDateHasTime` false, phrase stripped, title `""`.
- `"tomorrow at 5pm"` → `dueDateHasTime` true, correct hour/minute.
- `"next monday"` with a `referenceDate` that's itself a Monday → resolves to the
  *following* Monday, not the same day. (This exercises chrono's own "next X" phrase
  resolution, which always looks forward regardless of `forwardDate` — verified
  empirically against chrono-node 2.10.1 that `forwardDate: true`/`false`/omitted all
  produce the identical result for this phrase. It is **not** a `forwardDate` test; see
  the dedicated bullet below for that.)
- `"in 3 days"` → correct day offset.
- `"june 3"` (a bare, non-relative phrase with no relative/ordinal word) with a
  `referenceDate` *after* June 3 in that year (e.g. August 20 of some year) → `dueDate`
  resolves to June 3 of the *following* year, not the already-past June 3 of the
  reference year. This is the test that actually exercises `forwardDate: true`: verified
  empirically that with the option omitted (or `forwardDate: false`) the same input
  resolves to the past June 3 instead. If a future change silently dropped
  `forwardDate: true` from the `chrono.parse` call in `quick-add-parse.ts`, this is the
  one test in this file that would fail and catch it.
- `"Call mom tomorrow at 5pm"` → title `"Call mom"`, correct `dueDate`/`dueDateHasTime`,
  no leftover double space.
- Single tag: `"Buy milk #errand"` → `tags: ["errand"]`, title `"Buy milk"`.
- Multiple tags in different positions: `"#urgent renew passport #home"` → `tags:
  ["urgent", "home"]` in order, title `"renew passport"`, whitespace collapsed at both
  the start and the gap.
- Duplicate tag differing only by case (`"#Home water plants #home"`) → `tags:
  ["Home"]` (first-seen casing kept, case-insensitive dedup).
- Combined phrase: `"Call mom tomorrow at 5pm #family"` → title `"Call mom"`, `dueDate`
  with time set, `tags: ["family"]`.
- Input that's *only* a date phrase (`"tomorrow"`) or *only* a tag (`"#chores"`) →
  documents `title: ""` as valid parser output (the component, not this function, is
  responsible for refusing to submit an empty title).
- `"#"` alone, `"# tag"` (space right after `#`), and `"C#"` → none treated as a tag;
  text left as-is (documents the "must have a non-whitespace char immediately after `#`"
  rule from §2.2).
- Empty string and whitespace-only string → both short-circuit to the all-empty result.
- One case using the default `referenceDate = new Date()` under `vi.setSystemTime(...)`
  to confirm the default parameter actually wires through to chrono (not just the
  explicit-`referenceDate` path).

**Deliberately not tested**: chrono's exact heuristics on ambiguous, non-date-intent
text (e.g. whether "May I call you" gets misparsed as the month "May"). That's
third-party parsing behavior we don't own and could shift on a `chrono-node` version
bump; pinning an assertion to it would make the test suite brittle for no real benefit.
The ticket's own mitigation for this class of false positive is the live preview, which
*is* tested (§3.3) — the user catches it, corrects the text, and resubmits.

### 3.2 Extend `apps/web/src/lib/task-due-date.test.ts`

`wireDateTimeStringFromDate`:
- `hasTime: false` → `"YYYY-MM-DD"`, even when the `Date` object's own clock fields are
  non-midnight (confirms `hasTime` — not the `Date`'s own time value — is the source of
  truth, unlike `dueDateValueFromWireDate`'s midnight heuristic).
- `hasTime: true` → `"YYYY-MM-DDTHH:mm"` with zero-padded single-digit hour and minute.

### 3.3 Rewrite `apps/web/src/routes/task-create-form.test.tsx`

Every existing test in this file targets fields (`Due date` picker, `Task notes`,
`TagInput`'s `Tags` field) that no longer exist in the create form, so this file gets a
substantial rewrite, not a patch. New cases, keeping the existing `successFetch`/
`jsonResponse`/fake-timer helpers/conventions from the current file:

- Submits the trimmed title with no `dueDate`/`tags` for plain text.
- Submits a `dueDate` payload (date-only) for a date-phrase input — pin system time via
  `vi.useFakeTimers()`/`vi.setSystemTime()` and assert the exact wire string, same
  approach the current file uses for the `DateTimePicker` case.
- Submits a `dueDate` payload with a time component when the phrase includes a time.
- Submits `tags` for one or more `#tag` tokens typed into the input.
- Omits `dueDate` from the payload when nothing parses.
- Omits `tags` from the payload when no `#tag` token is present.
- Does **not** call the mutation when the input is empty, whitespace-only, or resolves
  to an empty title (e.g. the input is only `"tomorrow"` or only `"#chores"`).
- Resets the input to `""` (and the live preview disappears) on success.
- Renders an inline error and **preserves the raw input text** on mutation failure
  (replaces the old title+notes preservation test — there's only one field now).
- Disables the submit button while the mutation is pending (unchanged pattern).
- Live preview:
  - Typing a date phrase shows a `"Due …"` line reflecting the resolved date.
  - Typing a `#tag` shows a `Badge` with that tag's text.
  - Preview shows nothing when neither a date phrase nor a tag is present.
  - Editing the text to change the detected phrase updates the preview in place (e.g.
    changing `"tomorrow"` to `"in 3 days"` swaps the previewed date rather than showing
    both).
  - The preview container exposes `role="status"`/`aria-live="polite"` — same assertion
    style as `components/ui/loading-state.test.tsx`.

### 3.4 `apps/web/src/routes/tasks-page.test.tsx`

Remove the `"threads the fetched tag list into the create form as suggestions"` test —
`TaskCreateForm` no longer accepts `tagSuggestions` or renders a `TagInput`. No
replacement needed here: `TaskListItem`'s own suggestion-threading behavior already has
dedicated coverage in `task-list-item.test.tsx`, and `TagInput`'s filtering logic itself
is covered in `tag-input.test.tsx` — this deleted test wasn't the only place either was
exercised. All other tests in this file only touch the create form via
`getByLabelText("Task title")`, which is preserved, so they need no changes.

## 4. Scope boundaries (deliberately not doing)

- **Recurring-rule parsing, date-range parsing** — explicit ticket exclusions.
- **Multiple date phrases in one input** — only the first `chrono.parse` match is used;
  this is a "one due date per task" scope decision, not a bug (see §2.2).
- **Editing (`TaskListItem`) does not gain quick-add parsing.** The ticket explicitly
  keeps the existing picker/notes/tags UI there as the fallback/correction path — this
  plan does not touch `task-list-item.tsx` at all.
- **No tag/date autocomplete or suggestion UI in the create form.** `#tagname` and date
  phrases are plain typed text, parsed on every keystroke; there's no dropdown (unlike
  `TagInput`'s combobox). This is also why `TaskCreateForm` drops the `tagSuggestions`
  prop rather than keeping it unused.
- **No notes/description at creation.** Explicit acceptance criterion; notes remain
  edit-only.
- **No i18n / non-English phrase parsing.** `chrono-node`'s default English parser is
  used; localization isn't mentioned in the ticket and isn't part of this pass.
- **No backend/schema changes.** The existing `tasks.create` procedure already accepts
  exactly the shape quick-add produces.
- **No new `components/ui/` component or demo-page registration** — see §2.8.
- **No attempt to "fix" chrono false positives** (e.g. stripping a word that merely
  looks date-like) beyond what the live preview already surfaces — this is inherent to
  any heuristic NLP date parser and the ticket's stated mitigation (the preview) is what
  gets built and tested (§3.1's "deliberately not tested" note, §3.3's preview tests).

## 5. Judgment calls worth flagging explicitly

These aren't left as open questions blocking implementation — each has a decision and a
rationale above — but are called out here since the ticket didn't spell out this level
of detail, so reviewers know they were considered rather than missed:

- **Preview shows the resolved date/time value, not the raw matched substring** (e.g.
  "Due Aug 21, 2026", not the literal text "tomorrow"). The ticket says the preview
  should show "the detected due date," which reads most naturally as the resolved
  value — that's what tells the user whether the parse was *correct*, which is the
  stated purpose ("so a bad parse can be caught").
- **Tag token character set**: `#` immediately followed by one or more non-whitespace,
  non-`#` characters, with no punctuation-trimming beyond that (e.g. `#urgent!` yields
  tag `"urgent!"`, not `"urgent"`). TickTick-style quick-add tools generally use the
  same simple rule; adding punctuation-stripping heuristics is exactly the kind of scope
  creep this plan avoids per §4.
- **`forwardDate: true`** is passed to `chrono.parse` so a yearless, non-relative phrase
  resolves forward rather than possibly into the past. Explicitly relative phrases
  ("tomorrow", "next monday", "in 3 days") are unaffected by this option either way — the
  `"june 3"` case in §3.1 is the one test that actually exercises this option (verified
  empirically against chrono-node 2.10.1); none of the ticket's own example phrases do,
  since all of them are relative.
