import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

afterEach(() => {
  cleanup();
});

const variants: ButtonVariant[] = ["primary", "secondary"];
const sizes: ButtonSize[] = ["sm", "md"];

describe("Button", () => {
  for (const variant of variants) {
    for (const size of sizes) {
      it(`renders the ${variant}/${size} combination without throwing`, () => {
        render(
          <Button variant={variant} size={size}>
            {variant} {size}
          </Button>,
        );

        expect(
          screen.getByRole("button", { name: `${variant} ${size}` }),
        ).toBeInTheDocument();
      });
    }
  }

  it("renders the documented defaults when variant/size are omitted", () => {
    render(<Button>Default</Button>);

    const button = screen.getByRole("button", { name: "Default" });
    expect(button.className).toContain("bg-accent");
    expect(button.className).toContain("px-4");
  });

  it("keeps its own rounded-sm/shadow-hard look, distinct from Card/Panel's shadow-float", () => {
    render(<Button>Default</Button>);

    const button = screen.getByRole("button", { name: "Default" });
    expect(button.className).toContain("rounded-sm");
    expect(button.className).toContain("shadow-hard");
    expect(button.className).not.toContain("shadow-float");
  });

  it("fires onClick exactly once per click", () => {
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Click me</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Click me" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("respects the disabled prop and does not fire onClick when disabled", () => {
    const onClick = vi.fn();

    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Disabled" });
    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  describe("icon variant", () => {
    for (const size of sizes) {
      it(`renders the icon/${size} combination with an accessible name from aria-label`, () => {
        render(
          <Button variant="icon" size={size} aria-label="Add item">
            <svg aria-hidden="true" />
          </Button>,
        );

        expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument();
      });
    }

    it("fires onClick exactly once per click", () => {
      const onClick = vi.fn();

      render(
        <Button variant="icon" aria-label="Add item" onClick={onClick}>
          <svg aria-hidden="true" />
        </Button>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Add item" }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("respects the disabled prop and does not fire onClick when disabled", () => {
      const onClick = vi.fn();

      render(
        <Button variant="icon" aria-label="Add item" disabled onClick={onClick}>
          <svg aria-hidden="true" />
        </Button>,
      );

      const button = screen.getByRole("button", { name: "Add item" });
      expect(button).toBeDisabled();

      fireEvent.click(button);

      expect(onClick).not.toHaveBeenCalled();
    });
  });
});
