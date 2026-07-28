import { useId, useState, type KeyboardEvent } from "react";
import { cn } from "../../lib/cn";
import { CalendarIcon } from "./calendar-icon";

export interface CalendarPopupProps {
  value: string; // "" | "YYYY-MM-DD"
  onChange: (date: string) => void;
  minDate?: string; // "YYYY-MM-DD" — inclusive lower bound, enforced in JS (see below)
  disabled?: boolean;
  "aria-label"?: string;
  id?: string; // applied to the trigger button — see CalendarPopup's own day-cell id
  // scheme below for why this can't also be reused as a prefix for those.
}

interface DateParts {
  year: number;
  month: number; // 0-indexed, matches Date's own convention
  day: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseDateString(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function todayParts(): DateParts {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

// A fixed, arbitrary known-Sunday reference date — not tied to "today" — used purely to
// derive locale-correct short weekday names programmatically instead of hardcoding a
// name array. Jan 1 2023 was a Sunday.
const WEEKDAY_REFERENCE_SUNDAY = new Date(2023, 0, 1);
const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(WEEKDAY_REFERENCE_SUNDAY);
  d.setDate(WEEKDAY_REFERENCE_SUNDAY.getDate() + i);
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d);
});

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});
const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

interface CalendarCell {
  day: number | null; // null = leading/trailing padding cell
}

// Days-in-month/first-weekday-of-month rows, padded to a multiple of 7 with blank
// (non-interactive) cells at the start/end — see plan §3.5 for why padding cells aren't
// clickable adjacent-month days.
function buildWeeks(year: number, month: number): CalendarCell[][] {
  const leading = firstWeekdayOfMonth(year, month);
  const total = daysInMonth(year, month);
  const cellCount = Math.ceil((leading + total) / 7) * 7;
  const cells: CalendarCell[] = Array.from({ length: cellCount }, (_, i) => {
    const day = i - leading + 1;
    return { day: day >= 1 && day <= total ? day : null };
  });
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

type Direction = 1 | -1;

// Internal implementation detail of DateTimePicker, not part of components/ui/'s public
// demo surface — same relationship chevron-down-icon.tsx has to select.tsx. See
// tickets/select-datepicker-refactor/plan.md §3.5 for the full focus/ARIA model this
// implements: the trigger button keeps real DOM focus for the entire open/interact/close
// lifecycle (never `element.focus()`s a day cell); popup content is navigated purely via
// `aria-activedescendant`. The grid's role="grid"/role="row"/role="gridcell" roles are
// structural only (correct ARIA shape for a 2D day grid), independent of that focus
// model — deliberately not the WAI-ARIA APG "Date Picker Dialog" pattern's real
// roving-tabindex focus, which is a different, incompatible mechanism.
export function CalendarPopup({
  value,
  onChange,
  minDate,
  disabled,
  "aria-label": ariaLabel,
  id,
}: CalendarPopupProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const parsed = parseDateString(value) ?? todayParts();
    return { year: parsed.year, month: parsed.month };
  });
  const [highlightedDay, setHighlightedDay] = useState<number | null>(null);
  const gridId = useId();

  const parsedValue = parseDateString(value);
  const daysCount = daysInMonth(view.year, view.month);
  const weeks = buildWeeks(view.year, view.month);
  const today = todayParts();

  function isDayDisabled(day: number): boolean {
    if (!minDate) return false;
    return formatDateString(view.year, view.month, day) < minDate;
  }

  function nextEnabledDay(start: number, direction: Direction): number | null {
    let d = start;
    while (d >= 1 && d <= daysCount) {
      if (!isDayDisabled(d)) return d;
      d += direction;
    }
    return null;
  }

  function openPopup() {
    if (disabled) return;
    const base = parsedValue ?? todayParts();
    setView({ year: base.year, month: base.month });
    setHighlightedDay(base.day);
    setOpen(true);
  }

  function closePopup() {
    setOpen(false);
    setHighlightedDay(null);
  }

  function commitDay(day: number) {
    if (disabled || isDayDisabled(day)) return;
    onChange(formatDateString(view.year, view.month, day));
    closePopup();
  }

  function goToMonth(delta: number) {
    if (disabled) return;
    setHighlightedDay(null);
    setView((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function moveHighlight(deltaDays: number) {
    if (disabled) return;
    if (!open) {
      openPopup();
      return;
    }
    const direction: Direction = deltaDays > 0 ? 1 : -1;
    setHighlightedDay((prev) => {
      const start =
        prev !== null
          ? prev + deltaDays
          : direction === 1
            ? 1
            : daysCount;
      const clampedStart = Math.min(Math.max(start, 1), daysCount);
      const found =
        nextEnabledDay(clampedStart, direction) ??
        nextEnabledDay(clampedStart, direction === 1 ? -1 : 1);
      return found ?? prev;
    });
  }

  function handleTriggerClick() {
    if (disabled) return;
    if (open) closePopup();
    else openPopup();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveHighlight(-1);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      moveHighlight(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-7);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(7);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) {
        if (highlightedDay !== null) commitDay(highlightedDay);
        else closePopup();
      } else {
        openPopup();
      }
      return;
    }
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        closePopup();
      }
      return;
    }
  }

  const activeDescendantId =
    open && highlightedDay !== null
      ? `${gridId}-day-${formatDateString(view.year, view.month, highlightedDay)}`
      : undefined;

  const classes = cn(
    "field-base",
    "flex items-center justify-between gap-2 px-3 py-2 text-base text-left",
  );

  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        className={classes}
        disabled={disabled}
        aria-haspopup="grid"
        aria-expanded={open}
        aria-activedescendant={activeDescendantId}
        aria-label={ariaLabel}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
        onBlur={closePopup}
      >
        <span className={cn("truncate", !parsedValue && "text-ink/40")}>
          {parsedValue
            ? DISPLAY_DATE_FORMATTER.format(new Date(parsedValue.year, parsedValue.month, parsedValue.day))
            : "Select a date"}
        </span>
        <CalendarIcon className="size-4 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-64 rounded-sm border-2 border-ink bg-paper p-2 shadow-hard">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              className="px-1"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => goToMonth(-1)}
            >
              ‹
            </button>
            <span className="text-sm font-medium">
              {MONTH_YEAR_FORMATTER.format(new Date(view.year, view.month, 1))}
            </span>
            <button
              type="button"
              aria-label="Next month"
              className="px-1"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => goToMonth(1)}
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink/60">
            {WEEKDAY_LABELS.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>

          <div role="grid" aria-label={MONTH_YEAR_FORMATTER.format(new Date(view.year, view.month, 1))}>
            {weeks.map((week, weekIndex) => (
              <div role="row" key={weekIndex} className="grid grid-cols-7 gap-1">
                {week.map((cell, cellIndex) => {
                  if (cell.day === null) {
                    return <div key={cellIndex} aria-hidden="true" />;
                  }

                  const day = cell.day;
                  const dateString = formatDateString(view.year, view.month, day);
                  const cellDisabled = isDayDisabled(day);
                  const isSelected = dateString === value;
                  const isHighlighted = day === highlightedDay;
                  const isToday =
                    view.year === today.year && view.month === today.month && day === today.day;

                  return (
                    <button
                      key={dateString}
                      type="button"
                      id={`${gridId}-day-${dateString}`}
                      role="gridcell"
                      tabIndex={-1}
                      aria-selected={isSelected}
                      aria-disabled={cellDisabled || undefined}
                      className={cn(
                        "rounded-sm px-1 py-1 text-sm",
                        cellDisabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
                        isSelected && "bg-accent text-paper",
                        !isSelected && isToday && "border border-dashed border-accent",
                        isHighlighted && "outline outline-2 outline-offset-1 outline-accent",
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => commitDay(day)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
