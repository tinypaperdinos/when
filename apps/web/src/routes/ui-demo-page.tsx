import { Button, type ButtonSize, type ButtonVariant } from "../components/ui/button";
import { Section } from "../components/ui/section";
import { Card, type CardPadding } from "../components/ui/card";
import { Panel } from "../components/ui/panel";

// Dev-only demo route (`/dev/ui`, registered only when `import.meta.env.DEV`) that
// renders every component in `components/ui/` along with its variants, for visual
// review while running the dev server. See `components/ui/README.md` for the
// convention: every new component here must get a section added below.

const variants: ButtonVariant[] = ["primary", "secondary"];
const sizes: ButtonSize[] = ["sm", "md"];

const cardPaddings: CardPadding[] = ["sm", "md"];

export function UiDemoPage() {
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
    </main>
  );
}
