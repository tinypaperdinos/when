import { useState } from "react";
import { Button } from "../components/ui/button";

// Scratch design exploration (branch: explore/page-design) — NOT a real route or
// component. Throwaway mockup to judge the overall look (font, color, border/shadow
// language) across more than just a single Button before committing to a theme
// ticket. Delete this file once a direction is chosen and formalized.

// 4 squares, each holding still and pulsing in sequence (instant grow, slow shrink)
// around the four corners — the "spin" is implied by the phase offset, not motion.
function LoadingSpinner() {
  const delays = ["0ms", "-300ms", "-600ms", "-900ms"];
  const positions = ["top-0 left-0", "top-0 right-0", "right-0 bottom-0", "bottom-0 left-0"];

  return (
    <div className="relative size-8">
      {positions.map((position, i) => (
        <span
          key={position}
          className={`absolute size-2.5 animate-square-pulse bg-accent ${position}`}
          style={{ animationDelay: delays[i] }}
        />
      ))}
    </div>
  );
}

// Complete interaction: the one deliberate circle in a page full of squares and
// brackets — this is THE feature (completing tasks), so it gets to break the grid.
// Spring-overshoot pop + an expanding confirm ring, instead of the button's flat
// press-down — a stamp-of-approval feel rather than a checkbox tick.
function CompleteCheckbox() {
  const [checked, setChecked] = useState(false);

  return (
    <button
      aria-pressed={checked}
      className={
        "relative inline-flex size-11 items-center justify-center rounded-full border-2 border-ink transition-colors duration-150 " +
        (checked
          ? "animate-checkmark-pop bg-accent shadow-none"
          : "bg-paper shadow-hard")
      }
      onClick={() => setChecked((c) => !c)}
      type="button"
    >
      <svg className="size-6" fill="none" viewBox="0 0 24 24">
        <path
          d="M4 12.5l5 5L20 6"
          stroke={checked ? "var(--color-paper)" : "transparent"}
          strokeDasharray={24}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
          style={{
            strokeDashoffset: checked ? 0 : 24,
            transition: "stroke-dashoffset 250ms ease-out 150ms, stroke 0ms 150ms",
          }}
        />
      </svg>

      {checked && (
        <span className="pointer-events-none absolute inset-0 animate-ring-ping rounded-full border-2 border-accent" />
      )}
    </button>
  );
}

export function DesignExplorePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <header className="flex items-center justify-between border-b-2 border-ink pb-4">
        <h1 className="text-xl font-bold tracking-tight">when// task &amp; calendar</h1>
        <nav className="flex gap-2 text-sm">
          <a className="border-b-2 border-accent" href="#">
            tasks
          </a>
          <a className="text-ink/60" href="#">
            calendar
          </a>
        </nav>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Today</h2>
          <Button size="sm">+ new task</Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-start justify-between border-2 border-ink bg-paper p-3 shadow-hard">
            <div>
              <p className="font-medium">Write ticket for calendar sync</p>
              <p className="text-sm text-ink/60">due 5:00pm</p>
            </div>
            <span className="inline-flex items-center border-2 border-ink bg-pop px-2 py-1 text-xs font-bold tracking-wide text-paper uppercase">
              #backend
            </span>
          </div>

          <div className="flex items-start justify-between border-2 border-ink bg-paper p-3 shadow-hard opacity-60">
            <div>
              <p className="font-medium line-through">Review PR #22</p>
              <p className="text-sm text-ink/60">done</p>
            </div>
            <span className="inline-flex items-center border-2 border-ink bg-pop px-2 py-1 text-xs font-bold tracking-wide text-paper uppercase">
              #review
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Loading &amp; complete</h2>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <LoadingSpinner />
            <span className="text-xs text-ink/50">loading spinner</span>
          </div>
          <div className="flex items-center gap-2">
            <CompleteCheckbox />
            <span className="text-xs text-ink/50">click to complete</span>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Add a task</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 border-2 border-ink bg-paper px-3 py-2 font-mono shadow-input outline-none focus-visible:outline-dashed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            placeholder="type a task title..."
            type="text"
          />
          <Button variant="secondary">save</Button>
        </div>
      </section>
    </main>
  );
}
