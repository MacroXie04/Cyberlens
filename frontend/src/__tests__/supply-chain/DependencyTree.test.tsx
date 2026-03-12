import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DependencyTree from "../../components/SupplyChain/dependencies/DependencyTree";
import type { Dependency } from "../../types";

// D3 force simulation runs asynchronously; we flush timers to let it tick.
vi.useFakeTimers();

function makeDep(overrides: Partial<Dependency> & { id: number; name: string }): Dependency {
  return {
    version: "1.0.0",
    ecosystem: "npm",
    is_vulnerable: false,
    vulnerabilities: [],
    ...overrides,
  };
}

describe("DependencyTree", () => {
  it("renders SVG text labels for dependency nodes", () => {
    const deps: Dependency[] = [
      makeDep({ id: 1, name: "react", version: "18.2.0" }),
      makeDep({ id: 2, name: "lodash", version: "4.17.21" }),
    ];

    const { container } = render(<DependencyTree dependencies={deps} />);

    // Advance timers so D3 simulation ticks and DOM is populated
    vi.advanceTimersByTime(500);

    const svg = container.querySelector("svg")!;
    const textElements = Array.from(svg.querySelectorAll("text"));
    const labels = textElements.map((el) => el.textContent);

    expect(labels).toContain("react");
    expect(labels).toContain("lodash");
    // Center and ecosystem labels should also be present
    expect(labels).toContain("Project");
    expect(labels).toContain("npm");
  });

  it("uses fullName in tooltip title elements", () => {
    const deps: Dependency[] = [
      makeDep({ id: 1, name: "react", version: "18.2.0" }),
    ];

    const { container } = render(<DependencyTree dependencies={deps} />);
    vi.advanceTimersByTime(500);

    const svg = container.querySelector("svg")!;
    const titles = Array.from(svg.querySelectorAll("title"));
    const titleTexts = titles.map((el) => el.textContent);

    expect(titleTexts.some((t) => t?.includes("react@18.2.0"))).toBe(true);
  });
});
