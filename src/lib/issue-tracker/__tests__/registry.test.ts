import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getIssueTracker, resetIssueTracker } from "../registry";
import { JiraProvider } from "../jira/jira-provider";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/agents/requirements-agent", () => ({
  refineRequirements: vi.fn(),
}));

describe("getIssueTracker", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetIssueTracker();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetIssueTracker();
  });

  it("returns JiraProvider by default when ISSUE_TRACKER is not set", () => {
    delete process.env.ISSUE_TRACKER;
    const tracker = getIssueTracker();
    expect(tracker).toBeInstanceOf(JiraProvider);
    expect(tracker.name).toBe("jira");
  });

  it("returns JiraProvider when ISSUE_TRACKER is 'jira'", () => {
    process.env.ISSUE_TRACKER = "jira";
    const tracker = getIssueTracker();
    expect(tracker).toBeInstanceOf(JiraProvider);
  });

  it("is case-insensitive", () => {
    process.env.ISSUE_TRACKER = "JIRA";
    const tracker = getIssueTracker();
    expect(tracker).toBeInstanceOf(JiraProvider);
  });

  it("throws for unknown provider", () => {
    process.env.ISSUE_TRACKER = "asana";
    expect(() => getIssueTracker()).toThrow('Unknown issue tracker provider: "asana"');
  });

  it("caches the instance across calls", () => {
    delete process.env.ISSUE_TRACKER;
    const first = getIssueTracker();
    const second = getIssueTracker();
    expect(first).toBe(second);
  });

  it("returns a fresh instance after resetIssueTracker()", () => {
    delete process.env.ISSUE_TRACKER;
    const first = getIssueTracker();
    resetIssueTracker();
    const second = getIssueTracker();
    expect(first).not.toBe(second);
  });
});
