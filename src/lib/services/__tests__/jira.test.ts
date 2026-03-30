import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/agents/requirements-agent", () => ({
  refineRequirements: vi.fn().mockResolvedValue({
    title: "Refined Task",
    issueType: "Task",
    description: "Refined description",
    acceptanceCriteria: ["AC1"],
    priority: "P1",
    labels: ["backend"],
    assignee: null,
  }),
}));

import {
  createJiraIssue,
  retryJiraCreation,
  checkForDuplicates,
} from "../jira";
import type { ExtractedTaskRow } from "@/lib/types";

const mockFetch = vi.fn();

function makeTask(overrides: Partial<ExtractedTaskRow> = {}): ExtractedTaskRow {
  return {
    id: "task-1",
    transcript_id: "t-1",
    extracted_title: "Ship webhook",
    extracted_description: "Full description",
    inferred_assignees: [],
    confidence: "high",
    missing_context: [],
    source_quotes: [],
    priority: "P1",
    labels: ["backend"],
    status: "completed",
    claimed_by: null,
    claimed_at: null,
    claim_expires_at: null,
    dismissed_reason: null,
    interview_responses: null,
    jira_project: null,
    jira_issue_key: null,
    jira_error: null,
    suggested_interviewer: null,
    created_at: "2026-03-26T00:00:00Z",
    updated_at: "2026-03-26T00:00:00Z",
    ...overrides,
  };
}

describe("createJiraIssue", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
    process.env.JIRA_BASE_URL = "https://test.atlassian.net";
    process.env.JIRA_EMAIL = "test@example.com";
    process.env.JIRA_API_TOKEN = "test-token";
    process.env.JIRA_DEFAULT_PROJECT = "TEST";

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates a Jira issue and returns key + URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ key: "TEST-1", self: "..." }),
    });

    const result = await createJiraIssue(makeTask());

    expect(result.issueKey).toBe("TEST-1");
    expect(result.issueUrl).toBe("https://test.atlassian.net/browse/TEST-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.atlassian.net/rest/api/3/issue",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws when Jira config is missing", async () => {
    delete process.env.JIRA_BASE_URL;

    await expect(createJiraIssue(makeTask())).rejects.toThrow("JIRA_BASE_URL");
  });

  it("throws when Jira API returns non-OK", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue("Bad Request"),
    });

    await expect(createJiraIssue(makeTask())).rejects.toThrow("Jira API error 400");
  });

  it("creates without assignee when lookup fails", async () => {
    const task = makeTask({
      inferred_assignees: [{ name: "Alex", email: "alex@example.com" }],
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ key: "TEST-2", self: "..." }),
      });

    const result = await createJiraIssue(task);
    expect(result.issueKey).toBe("TEST-2");
  });
});

describe("retryJiraCreation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
    process.env.JIRA_BASE_URL = "https://test.atlassian.net";
    process.env.JIRA_EMAIL = "test@example.com";
    process.env.JIRA_API_TOKEN = "test-token";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when task not in jira_failed status", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "task-1", status: "completed" },
            error: null,
          }),
        }),
      }),
    });

    await expect(retryJiraCreation("task-1")).rejects.toThrow("not in jira_failed");
  });

  it("throws when task not found", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
        }),
      }),
    });

    await expect(retryJiraCreation("nonexistent")).rejects.toThrow("Task not found");
  });
});

describe("checkForDuplicates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
  });

  it("finds similar issues above 0.7 threshold", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        issues: [
          { key: "TEST-1", fields: { summary: "Ship webhook integration" } },
          { key: "TEST-2", fields: { summary: "Completely different task" } },
        ],
      }),
    });

    const config = {
      baseUrl: "https://test.atlassian.net",
      email: "test@example.com",
      apiToken: "token",
      defaultProject: "TEST",
    };

    const result = await checkForDuplicates(
      config,
      "Ship webhook integration",
      "TEST"
    );

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].similarity).toBeGreaterThan(0.7);
  });

  it("returns empty array when no matches", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        issues: [
          { key: "TEST-1", fields: { summary: "Completely unrelated item" } },
        ],
      }),
    });

    const config = {
      baseUrl: "https://test.atlassian.net",
      email: "test@example.com",
      apiToken: "token",
      defaultProject: "TEST",
    };

    const result = await checkForDuplicates(
      config,
      "Add retry logic to webhook pipeline",
      "TEST"
    );

    expect(result).toEqual([]);
  });

  it("returns empty array when API fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const config = {
      baseUrl: "https://test.atlassian.net",
      email: "test@example.com",
      apiToken: "token",
      defaultProject: "TEST",
    };

    const result = await checkForDuplicates(config, "Some task", "TEST");
    expect(result).toEqual([]);
  });
});
