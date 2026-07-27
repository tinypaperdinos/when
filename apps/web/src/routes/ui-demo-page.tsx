import { useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "../components/ui/button";
import { Section } from "../components/ui/section";
import { Card, type CardPadding } from "../components/ui/card";
import { Panel } from "../components/ui/panel";
import { TextInput, type TextInputSize } from "../components/ui/text-input";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Select } from "../components/ui/select";
import { DateTimePicker, type DateTimePickerValue } from "../components/ui/date-time-picker";
import { DateRangePicker, type DateRangeValue } from "../components/ui/date-range-picker";
import { Badge, type BadgeVariant } from "../components/ui/badge";
import { TagInput } from "../components/ui/tag-input";

// Dev-only demo route (`/dev/ui`, registered only when `import.meta.env.DEV`) that
// renders every component in `components/ui/` along with its variants, for visual
// review while running the dev server. See `components/ui/README.md` for the
// convention: every new component here must get a section added below.

const variants: ButtonVariant[] = ["primary", "secondary"];
const sizes: ButtonSize[] = ["sm", "md"];

const cardPaddings: CardPadding[] = ["sm", "md"];

const textInputSizes: TextInputSize[] = ["sm", "md"];

const badgeVariants: BadgeVariant[] = ["pop", "accent", "neutral"];
const badgeSampleText: Record<BadgeVariant, string> = {
  pop: "#backend",
  accent: "#personal",
  neutral: "#urgent",
};

const tagSuggestions = ["work", "urgent", "personal", "errand", "backend", "frontend"];

function PlusIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function UiDemoPage() {
  // DateTimePicker/DateRangePicker are controlled-only (components/ui/README.md), so —
  // unlike every other demo entry above, which uses defaultValue/defaultChecked and
  // needs no state — these need local useState wiring to be interactive at all.
  const [dueDate, setDueDate] = useState<DateTimePickerValue>({ date: "" });
  const [dueDateFixedTime, setDueDateFixedTime] = useState<DateTimePickerValue>({
    date: "",
    time: "",
  });
  const [eventRange, setEventRange] = useState<DateRangeValue>({
    start: { date: "2026-07-26" },
    end: { date: "" },
  });

  // TagInput is controlled-only, same reasoning as DateTimePicker/DateRangePicker above.
  const [seededTags, setSeededTags] = useState<string[]>(["work", "urgent"]);
  const [freeformTags, setFreeformTags] = useState<string[]>([]);
  const [disabledTags, setDisabledTags] = useState<string[]>(["errand", "frontend"]);

  return (
    <main>
      <h1>UI component library</h1>

      <section>
        <h2>Button</h2>
        {variants.map((variant) => (
          <div key={variant}>
            {sizes.map((size) => (
              <p key={size}>
                <span>{`${variant} / ${size}:`}</span>{" "}
                <Button variant={variant} size={size}>
                  {variant} {size}
                </Button>
              </p>
            ))}
          </div>
        ))}
      </section>

      <section>
        <h2>Button — icon variant</h2>
        <p>
          <span>{`icon / sm:`}</span>{" "}
          <Button variant="icon" size="sm" aria-label="Add item">
            <PlusIcon />
          </Button>
        </p>
        <p>
          <span>{`icon / md:`}</span>{" "}
          <Button variant="icon" size="md" aria-label="Remove item">
            <PlusIcon />
          </Button>
        </p>
        <p>
          <span>icon + label (existing primary/secondary variant, no new variant needed):</span>{" "}
          <Button variant="secondary" size="sm">
            <PlusIcon /> Add item to list
          </Button>
        </p>
      </section>

      <section>
        <h2>Section</h2>
        <p>title + actions, with Cards as children:</p>
        <Section
          title="Today"
          actions={<Button size="sm">+ new task</Button>}
        >
          <Card>Task one</Card>
          <Card>Task two</Card>
        </Section>

        <p>no title, no actions:</p>
        <Section>
          <Card>Untitled section content</Card>
        </Section>
      </section>

      <section>
        <h2>Card</h2>
        {cardPaddings.map((padding) => (
          <p key={padding}>
            <span>{`${padding}:`}</span>{" "}
            <Card padding={padding}>{padding} padding card</Card>
          </p>
        ))}
      </section>

      <section>
        <h2>Panel</h2>
        <p>title + description, lg padding:</p>
        <Panel title="Task details" description="Edit the task below" padding="lg">
          Panel body content
        </Panel>

        <p>title only, md padding:</p>
        <Panel title="Task details" padding="md">
          Panel body content
        </Panel>

        <p>neither title nor description:</p>
        <Panel>Panel body content</Panel>
      </section>

      <section>
        <h2>TextInput</h2>
        {textInputSizes.map((size) => (
          <p key={size}>
            <span>{`TextInput ${size}:`}</span>{" "}
            <TextInput size={size} placeholder={`${size} input`} />
          </p>
        ))}
        <p>
          <span>TextInput disabled:</span>{" "}
          <TextInput disabled placeholder="disabled input" />
        </p>
      </section>

      <section>
        <h2>Textarea</h2>
        <Textarea placeholder="Notes…" defaultValue={"First line\nSecond line"} />
      </section>

      <section>
        <h2>Checkbox</h2>
        <p>
          <Checkbox label="Unchecked example" />
        </p>
        <p>
          <Checkbox label="Checked by default" defaultChecked />
        </p>
        <p>
          <Checkbox label="Disabled example" disabled />
        </p>
      </section>

      <section>
        <h2>Select</h2>
        <p>
          <span>with placeholder:</span>{" "}
          <Select aria-label="Choose a tag" placeholder="Choose a tag…">
            <option value="work">Work</option>
            <option value="personal">Personal</option>
            <option value="errand">Errand</option>
          </Select>
        </p>
        <p>
          <span>with defaultValue:</span>{" "}
          <Select aria-label="Choose a priority" defaultValue="high">
            <option value="low">Low</option>
            <option value="high">High</option>
          </Select>
        </p>
      </section>

      <section>
        <h2>DateTimePicker</h2>
        <p>timeOptional default (true) — click "Add time" to reveal the time field:</p>
        <DateTimePicker value={dueDate} onChange={setDueDate} />

        <p>timeOptional=false — both fields always shown, no toggle:</p>
        <DateTimePicker
          value={dueDateFixedTime}
          onChange={setDueDateFixedTime}
          timeOptional={false}
        />
      </section>

      <section>
        <h2>DateRangePicker</h2>
        <p>
          seeded with a start date already set, to demonstrate the end date's min
          guardrail:
        </p>
        <DateRangePicker value={eventRange} onChange={setEventRange} />
      </section>

      <section>
        <h2>Badge</h2>
        {badgeVariants.map((variant) => (
          <p key={variant}>
            <span>{`${variant}:`}</span>{" "}
            <Badge variant={variant}>{badgeSampleText[variant]}</Badge>
          </p>
        ))}
      </section>

      <section>
        <h2>TagInput</h2>
        <p>seeded with tags + suggestions (some overlapping the seeded tags):</p>
        <TagInput value={seededTags} onChange={setSeededTags} suggestions={tagSuggestions} />

        <p>no suggestions supplied — pure freeform tag creation:</p>
        <TagInput value={freeformTags} onChange={setFreeformTags} label="Freeform tags" />

        <p>disabled:</p>
        <TagInput
          value={disabledTags}
          onChange={setDisabledTags}
          suggestions={tagSuggestions}
          label="Disabled tags"
          disabled
        />
      </section>
    </main>
  );
}
