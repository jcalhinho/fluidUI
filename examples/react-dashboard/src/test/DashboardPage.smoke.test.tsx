import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../dashboard/DashboardPage";

vi.mock("../dashboard/DashboardCanvas", () => ({
  DashboardCanvas: () => <div data-testid="dashboard-canvas-stub" />,
}));

describe("DashboardPage smoke", () => {
  it("renders header controls and can switch template from dropdown", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: "Engine Builder" })).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-canvas-stub")).toBeInTheDocument();

    const select = screen.getByLabelText(/Template/i);
    fireEvent.change(select, { target: { value: "executive-beta" } });

    expect(select).toHaveValue("executive-beta");
  });
});
