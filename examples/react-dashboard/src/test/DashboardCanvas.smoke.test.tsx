import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardCanvas } from "../dashboard/DashboardCanvas";

describe("DashboardCanvas smoke", () => {
  it("renders the empty-state helper when there are no nodes", () => {
    render(<DashboardCanvas nodes={[]} layoutType="masonry" />);

    expect(
      screen.getByText("Select components in the builder panel.")
    ).toBeInTheDocument();
  });
});
