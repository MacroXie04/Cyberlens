import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DependencyList from "../../components/SupplyChain/dependencies/DependencyList";
import type { Dependency } from "../../types";

function makeDep(overrides: Partial<Dependency> & { id: number; name: string }): Dependency {
  return {
    version: "1.0.0",
    ecosystem: "npm",
    is_vulnerable: false,
    vulnerabilities: [],
    ...overrides,
  };
}

describe("DependencyList", () => {
  it("renders all dependencies with name and version", () => {
    const deps: Dependency[] = [
      makeDep({ id: 1, name: "react", version: "18.2.0" }),
      makeDep({ id: 2, name: "lodash", version: "4.17.21" }),
    ];

    render(<DependencyList dependencies={deps} />);

    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("18.2.0")).toBeInTheDocument();
    expect(screen.getByText("lodash")).toBeInTheDocument();
    expect(screen.getByText("4.17.21")).toBeInTheDocument();
  });

  it("sorts vulnerable dependencies first, then alphabetical", () => {
    const deps: Dependency[] = [
      makeDep({ id: 1, name: "zlib", version: "1.0.0" }),
      makeDep({
        id: 2,
        name: "axios",
        version: "0.21.0",
        is_vulnerable: true,
        vulnerabilities: [{ id: 1, cve_id: "CVE-2021-1", cvss_score: 7.5, severity: "high", summary: "", fixed_version: "0.22.0", osv_id: "" }],
      }),
      makeDep({ id: 3, name: "express", version: "4.18.0" }),
    ];

    const { container } = render(<DependencyList dependencies={deps} />);

    const names = Array.from(container.querySelectorAll("span"))
      .filter((el) => el.style.fontWeight === "500" && el.style.fontSize === "13px")
      .map((el) => el.textContent);

    expect(names).toEqual(["axios", "express", "zlib"]);
  });

  it("shows correct risk indicator colors", () => {
    const deps: Dependency[] = [
      makeDep({ id: 1, name: "safe-pkg" }),
      makeDep({
        id: 2,
        name: "moderate-pkg",
        is_vulnerable: true,
        vulnerabilities: [{ id: 1, cve_id: "CVE-1", cvss_score: 5, severity: "medium", summary: "", fixed_version: "", osv_id: "" }],
      }),
      makeDep({
        id: 3,
        name: "critical-pkg",
        is_vulnerable: true,
        vulnerabilities: [
          { id: 1, cve_id: "CVE-1", cvss_score: 9, severity: "critical", summary: "", fixed_version: "", osv_id: "" },
          { id: 2, cve_id: "CVE-2", cvss_score: 8, severity: "high", summary: "", fixed_version: "", osv_id: "" },
          { id: 3, cve_id: "CVE-3", cvss_score: 7, severity: "high", summary: "", fixed_version: "", osv_id: "" },
        ],
      }),
    ];

    render(<DependencyList dependencies={deps} />);

    const safeDot = screen.getByTestId("risk-dot-1");
    const moderateDot = screen.getByTestId("risk-dot-2");
    const criticalDot = screen.getByTestId("risk-dot-3");

    expect(safeDot.style.backgroundColor).toBe("rgb(19, 115, 51)"); // #137333
    expect(moderateDot.style.backgroundColor).toBe("rgb(255, 112, 67)"); // #FF7043
    expect(criticalDot.style.backgroundColor).toBe("rgb(179, 38, 30)"); // #B3261E
  });
});
