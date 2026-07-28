import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { EmptyState } from "./empty-state";
import { Button } from "./button";

afterEach(() => {
  cleanup();
});

describe("EmptyState", () => {
  it("renders with only the required title (no icon/description/action)", () => {
    render(<EmptyState title="No tasks yet" />);

    expect(screen.getByRole("heading", { name: "No tasks yet", level: 3 })).toBeInTheDocument();
  });

  it("renders an icon, description, and action when supplied", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={<svg data-testid="empty-icon" />}
        title="No tasks yet"
        description="Create your first task to get started"
        action={<Button onClick={onClick}>+ new task</Button>}
      />,
    );

    expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
    expect(
      screen.getByText("Create your first task to get started"),
    ).toBeInTheDocument();

    const actionButton = screen.getByRole("button", { name: "+ new task" });
    expect(actionButton).toBeInTheDocument();

    fireEvent.click(actionButton);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("exposes role=region with aria-labelledby pointing at the rendered title", () => {
    render(<EmptyState title="No tasks yet" />);

    expect(screen.getByRole("region", { name: "No tasks yet" })).toBeInTheDocument();
  });
});
