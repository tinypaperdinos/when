# Refiner notes: tags

## Round 1

Verified against `gh issue view 6 --json title,body,comments` (matches plan.md's quote of
the issue exactly, including the deferred-comment thread), `README.md`'s MVP list,
`apps/server/prisma/schema.prisma`, and the actual current state of every file the plan
claims to modify or leave untouched: `task-schema.ts`, `task-service.ts`, `task-router.ts`,
`event-service.ts`, `event-router.ts`, `app-router.ts`, `tasks-page.tsx`,
`task-create-form.tsx`, `task-list-item.tsx`, `tag-input.tsx`, `badge.tsx`, `trpc.ts`,
`task-service.test.ts`, `task-router.test.ts`, `tasks-page.test.tsx`, `seed.ts`, and the
sibling `shared-zod-schemas`/`tag-input-badge` plans this plan explicitly cross-references.
Also spot-checked the `httpBatchLink` batching claim directly against
`@trpc/client`'s source (`node_modules/@trpc/client/src/links/httpBatchLink.ts:41,55`:
`const path = batchOps.map((op) => op.path).join(',')`) — accurate, not fabricated.

This is a very strong, unusually well-substantiated plan. Every factual claim I checked
against the real codebase held up exactly as stated, including several fairly deep ones
(the `toEqual`/`toHaveBeenCalledWith` undefined-key-tolerance behavior the plan leans on
for backward test compatibility, the `httpBatchLink` URL-joining mechanics, and the
`Task` type being fully inferred so no manual `trpc.ts` edit is needed). Nothing here rises
to blocking. Findings below are all polish-level, in priority order.

### The four flagged scope calls — all hold up

1. **Task-only, not event-generic (§2.1).** Confirmed: the issue body says "tags on a
   **task**" twice, and README.md's MVP list independently and specifically says "Tags on
   tasks, to tell them apart" — no equivalent bullet exists for events. Unlike
   `shared-zod-schemas` (which had a real forcing argument — leaving `event-router.ts`
   with its own copy of a regex was an active drift risk), there's no analogous forcing
   argument here: an untagged `Entry.tags` relation on events isn't broken by this plan,
   it's just unbuilt. This is a legitimate, distinguishable case from `shared-zod-schemas`'s
   opposite call, not an inconsistent double standard, and the plan is honest about why the
   two tickets differ (§2.1's own comparison). Agreed.
2. **One full-array `tags: string[]` sync on `create`/`update`, not three procedures
   (§2.2).** Confirmed against the actual `tag-input.tsx` on `main`: `onChange` really does
   always fire with the complete next `value: string[]` (verified in the `commitTag`/
   `Backspace`/remove-button handlers — none of them emit a delta). Confirmed against
   `tag-input-badge/plan.md` §2.6 that freeform tag creation is allowed by design, which is
   exactly what makes "create" and "assign" the same user action and justifies not needing
   a separate creation endpoint. Agreed.
3. **Case-insensitive resolution, case-preserving storage, no DB collation change (§2.3).**
   Confirmed `Tag.name` has no `@db.Collation`/similar in `schema.prisma`, so SQLite's
   default exact-match `@unique` applies as claimed. This is genuinely the deferred decision
   `tag-input-badge/plan.md` §6 item 5 left open ("flagged since #6 could land on a
   different rule... this component doesn't attempt to anticipate") — this plan resolves it
   with the same case-insensitive-compare/case-preserving-store semantics `TagInput`
   already uses client-side, which is the right level of consistency. The concurrent-create
   race is real and reasonably deferred given the single-user/local-tool framing in
   `README.md`. Agreed, with one related edge case not mentioned — see below.
4. **`TasksPage` fetches `tags.list` once, threads `tagSuggestions` down as a prop (§2.4).**
   Confirmed the existing `tasks-page.test.tsx` mocks are single-procedure
   (`jsonResponse([{ result: { data } }])`, one array element) — adding an independent
   `tags.list` query to `TaskCreateForm`/`TaskListItem` would genuinely break every one of
   those mocks the way the plan describes, and the batching mechanics claim checks out
   against the real `httpBatchLink` source. The reversibility note in §6 item 2 is accurate.
   Agreed.

### Non-blocking findings

1. **Router filename breaks the established `task-router.ts`/`event-router.ts` naming
   convention.** Both existing routers use the *singular* entity name in the filename
   (`task-router.ts`, `event-router.ts`) despite exporting/registering a *plural* router
   variable (`tasksRouter`, `eventsRouter`, confirmed in `app-router.ts`). §1/§3.4/§3.10
   name the new file `tags-router.ts` (plural) and its test `tags-router.test.ts` — this is
   a real, checkable deviation from the file-naming half of that pattern, not a stylistic
   nitpick invented for its own sake (the task brief specifically asks to check "does the
   plan match how this codebase already does similar things"). Cheap fix: `tag-router.ts`/
   `tag-router.test.ts`, keeping the `tagsRouter` export name and `tags:` registration key
   as-is (those already correctly mirror `tasksRouter`/`eventsRouter`).

2. **`TaskService`'s new defaulted second constructor param
   (`tagService: TagService = new TagService(db)`) is a genuinely new DI shape for this
   codebase, not just "matches this codebase's plain-constructor-injection style" as §3.3
   asserts.** Checked every existing service (`TaskService`, `EventService`) and every
   router call site (`grep`'d all `new TaskService(...)`/`new EventService(...)` call
   sites) — every constructor in this codebase today takes exactly one param (`db`), and no
   service currently composes another service. A defaulted second constructor param that
   lets routers stay one-arg (`new TaskService(db)`) while tests inject a fake is a
   reasonable pattern, but it's a precedent-setting one, and the plan should say so
   explicitly (the same way it explicitly flags other judgment calls in §2/§6) rather than
   describing it as already-matching an existing style. Not a reason to redesign it — just
   flag it as new, the way this plan's own convention elsewhere is to surface exactly this
   kind of "first time we've done it this way" call.

3. **`tags.list`'s `orderBy: { name: "asc" }` will sort case-sensitively (ASCII order,
   all-uppercase-first-letter names before any lowercase ones), which is a direct, unstated
   consequence of §2.3's case-preserving-storage decision.** Since storage keeps whatever
   casing a user typed first (`"Work"` stays `"Work"`, `"urgent"` stays `"urgent"`), the
   `tags.list` suggestion list — and therefore `TagInput`'s `suggestions` prop, which does
   its own separate substring filter but not its own re-sort — will show "Work" sorted
   before "urgent" even though a human would expect w-after-u alphabetically. This isn't a
   bug introduced by a wrong `orderBy` call (case-insensitive collation was explicitly and
   correctly ruled out in §2.3 for the stated Postgres-migration reason), it's just an
   unacknowledged side effect of that already-made decision that's worth one line in §2.3
   or §5 so a future reader doesn't mistake the resulting suggestion order for a bug. Not
   worth blocking on — SQLite's Prisma client doesn't offer a portable case-insensitive
   `orderBy` mode anyway, so there's no cheap fix that wouldn't reopen the collation
   question §2.3 already closed.

4. **Sequential, non-transactional `resolveConnections` → `entry.create`/`entry.update` on
   `create`/`update` has a small partial-failure edge case the plan doesn't mention: if
   `resolveConnections` successfully creates one or more new `Tag` rows and the subsequent
   `db.entry.create`/`db.entry.update` call then fails for an unrelated reason (e.g. a
   `NOT_FOUND` race on `update`, or any other DB error), the newly-created `Tag` row(s)
   persist with zero attached entries.** The plan's §5 already accepts orphaned `Tag` rows
   as a general non-goal ("orphaned tags simply keep appearing in `tags.list` suggestions
   — arguably even useful"), so this partial-failure case is covered by that same accepted
   trade-off in spirit, but it's a distinct scenario from the one explicitly named (§2.3's
   concurrent-identical-create race) and isn't currently named anywhere. Worth a one-line
   addition to §2.3 or §5 for completeness, not a design change — the existing "orphaned
   tags are fine" reasoning already applies here without modification.

5. **Minor, very low severity: the new `seed.ts` (§3.6) is less idempotent than the
   `db.entry.createMany` it replaces.** Today, re-running the seed script against a
   non-empty DB just adds duplicate `Entry` rows (harmless, no unique constraint on
   `title`). After the change, re-running it would attempt to `db.tag.create` the same tag
   name(s) a second time and throw on `Tag.name`'s unique constraint. In practice this is
   unlikely to bite anyone — `prisma migrate dev` only triggers the seed hook when there
   are new migrations to apply or the DB is being created fresh, and this ticket adds no
   migration — but it's a real, if narrow, regression in the seed script's robustness that
   the plan doesn't mention. Not worth blocking on; flagging so it isn't a surprise if
   `reviewer-code`/`reviewer-tests` notices it independently.

None of the above changes the scope-fidelity verdict: the plan satisfies issue #6's literal
ask (expose `Tag` via tRPC, create/assign/remove on a task, show tags in the task list UI,
using the shared `TagInput`/`Badge` components) without under- or over-scoping, and all four
of the notable judgment calls the launching agent asked me to scrutinize are genuinely
well-reasoned against the issue text, the schema, and the real component APIs — not just
internally consistent with themselves.

VERDICT: APPROVED
