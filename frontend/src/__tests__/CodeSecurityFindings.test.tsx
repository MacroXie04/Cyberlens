import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import CodeSecurityFindings from "../components/SupplyChain/CodeSecurityFindings";
import type { CodeFinding } from "../types";

function makeFinding(overrides: Partial<CodeFinding> = {}): CodeFinding {
  return {
    id: 1,
    file_path: "src/app.py",
    line_number: 42,
    severity: "high",
    category: "sql_injection",
    title: "SQL Injection in query handler",
    description: "User input used directly in SQL query",
    code_snippet: "42 | cursor.execute(query % user_input)",
    recommendation: "Use parameterized queries",
    explanation: "",
    ...overrides,
  };
}

describe("CodeSecurityFindings", () => {
  it("renders empty state when no findings", () => {
    render(<CodeSecurityFindings findings={[]} />);
    expect(screen.getByText("No code security issues found")).toBeTruthy();
  });

  it("sorts findings by severity (critical first)", () => {
    const findings = [
      makeFinding({ id: 1, severity: "low", title: "Low issue" }),
      makeFinding({ id: 2, severity: "critical", title: "Critical issue" }),
      makeFinding({ id: 3, severity: "high", title: "High issue" }),
    ];
    render(<CodeSecurityFindings findings={findings} />);
    const buttons = screen.getAllByRole("button").filter((btn) =>
      btn.textContent?.includes("issue")
    );
    expect(buttons[0].textContent).toContain("Critical issue");
    expect(buttons[1].textContent).toContain("High issue");
    expect(buttons[2].textContent).toContain("Low issue");
  });

  it("expands a finding to show description and code", async () => {
    const user = userEvent.setup();
    const finding = makeFinding({
      description: "Dangerous SQL concatenation",
      code_snippet: "42 | cursor.execute(q)",
    });
    render(<CodeSecurityFindings findings={[finding]} />);

    // Click to expand
    const header = screen.getByText("SQL Injection in query handler");
    await user.click(header);

    expect(screen.getByText("Dangerous SQL concatenation")).toBeTruthy();
    expect(screen.getByText("cursor.execute(q)")).toBeTruthy();
  });

  it("shows explanation section when explanation is non-empty", async () => {
    const user = userEvent.setup();
    const finding = makeFinding({
      explanation:
        "User input from request.args flows to cursor.execute unsanitized.",
    });
    render(<CodeSecurityFindings findings={[finding]} />);

    await user.click(screen.getByText("SQL Injection in query handler"));

    expect(screen.getByText("Why This Is Vulnerable")).toBeTruthy();
    expect(
      screen.getByText(
        "User input from request.args flows to cursor.execute unsanitized."
      )
    ).toBeTruthy();
  });

  it("hides explanation section when explanation is empty", async () => {
    const user = userEvent.setup();
    const finding = makeFinding({ explanation: "" });
    render(<CodeSecurityFindings findings={[finding]} />);

    await user.click(screen.getByText("SQL Injection in query handler"));

    expect(screen.queryByText("Why This Is Vulnerable")).toBeNull();
  });

  it("filters findings by severity", async () => {
    const user = userEvent.setup();
    const findings = [
      makeFinding({ id: 1, severity: "critical", title: "Crit finding" }),
      makeFinding({ id: 2, severity: "low", title: "Low finding" }),
    ];
    render(<CodeSecurityFindings findings={findings} />);

    // Click "critical" severity filter pill
    const critBtn = screen.getAllByRole("button").find(
      (b) => {
        const text = b.textContent?.toLowerCase() || "";
        return text.includes("critical") && text.includes("1") && !text.includes("Crit finding");
      }
    );
    expect(critBtn).toBeTruthy();
    await user.click(critBtn!);

    expect(screen.getByText("Crit finding")).toBeTruthy();
    expect(screen.queryByText("Low finding")).toBeNull();
  });

  it("expand all / collapse all works", async () => {
    const user = userEvent.setup();
    const findings = [
      makeFinding({ id: 1, title: "Finding A", description: "Desc A" }),
      makeFinding({ id: 2, title: "Finding B", description: "Desc B" }),
    ];
    render(<CodeSecurityFindings findings={findings} />);

    await user.click(screen.getByText("Expand All"));
    expect(screen.getByText("Desc A")).toBeTruthy();
    expect(screen.getByText("Desc B")).toBeTruthy();

    await user.click(screen.getByText("Collapse All"));
    expect(screen.queryByText("Desc A")).toBeNull();
    expect(screen.queryByText("Desc B")).toBeNull();
  });

  it("groups by file when toggle is active", async () => {
    const user = userEvent.setup();
    const findings = [
      makeFinding({ id: 1, file_path: "src/auth.py", title: "Auth issue" }),
      makeFinding({ id: 2, file_path: "src/db.py", title: "DB issue" }),
      makeFinding({ id: 3, file_path: "src/auth.py", title: "Auth issue 2" }),
    ];
    render(<CodeSecurityFindings findings={findings} />);

    await user.click(screen.getByText("Group by File"));

    expect(screen.getByText("src/auth.py")).toBeTruthy();
    expect(screen.getByText("src/db.py")).toBeTruthy();
    expect(screen.getByText("2 findings")).toBeTruthy();
    expect(screen.getByText("1 finding")).toBeTruthy();
  });
});
