import { Button, type ButtonSize, type ButtonVariant } from "../components/ui/button";

// Dev-only demo route (`/dev/ui`, registered only when `import.meta.env.DEV`) that
// renders every component in `components/ui/` along with its variants, for visual
// review while running the dev server. See `components/ui/README.md` for the
// convention: every new component here must get a section added below.

const variants: ButtonVariant[] = ["primary", "secondary"];
const sizes: ButtonSize[] = ["sm", "md"];

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
    </main>
  );
}
