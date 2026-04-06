import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

vi.mock("../dashboard/DashboardPage", () => ({
  DashboardPage: () => <div data-testid="dashboard-page-stub">Builder Page</div>,
}));

vi.mock("../about/AboutPage", () => ({
  AboutPage: () => <div data-testid="about-page-stub">About Page</div>,
}));

afterEach(() => {
  window.location.hash = "";
});

describe("App smoke", () => {
  it("shows builder view by default and switches to about view", () => {
    render(<App />);

    expect(screen.getByTestId("dashboard-page-stub")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "About" }));

    expect(window.location.hash).toBe("#about");
    expect(screen.getByTestId("about-page-stub")).toBeInTheDocument();
  });

  it("resolves initial hash to about view", () => {
    window.location.hash = "#about";
    render(<App />);

    expect(screen.getByTestId("about-page-stub")).toBeInTheDocument();
  });
});
