import * as chrono from "chrono-node";

export interface QuickAddParseResult {
  title: string;
  tags: string[];
  dueDate?: Date;
  dueDateHasTime: boolean;
}

const TAG_PATTERN = /#([^\s#]+)/g;

// Parses a single quick-add line into a title plus optional due date/tags. Tags are
// stripped first so date parsing runs against tag-free text and its match indices line
// up with the string being mutated; only the first date/time phrase chrono finds is
// used — one due date per task is a deliberate scope decision, not a bug.
export function parseQuickAdd(
  raw: string,
  referenceDate: Date = new Date(),
): QuickAddParseResult {
  if (raw.trim() === "") {
    return { title: "", tags: [], dueDate: undefined, dueDateHasTime: false };
  }

  const tags: string[] = [];
  const seen = new Set<string>();
  let withoutTags = raw.replace(TAG_PATTERN, (_match, token: string) => {
    const key = token.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(token);
    }
    return "";
  });

  let dueDate: Date | undefined;
  let dueDateHasTime = false;

  const results = chrono.parse(withoutTags, referenceDate, { forwardDate: true });
  const first = results[0];
  if (first) {
    dueDate = first.start.date();
    dueDateHasTime = first.start.isCertain("hour");
    withoutTags =
      withoutTags.slice(0, first.index) + withoutTags.slice(first.index + first.text.length);
  }

  const title = withoutTags.replace(/\s+/g, " ").trim();

  return { title, tags, dueDate, dueDateHasTime };
}
