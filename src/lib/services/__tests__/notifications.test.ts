import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notifyNewInterviews, notifyAutoCreatedTasks } from "../notifications";
import type { TranscriptRow, ExtractedTaskRow } from "@/lib/types";

const mockFetch = vi.fn();

const transcript: TranscriptRow = {
  id: "t-1",
  provider: "manual",
  external_id: "ext-1",
  meeting_title: "Sprint Planning",
  meeting_date: "2026-03-26T10:00:00Z",
  duration: 3600,
  attendees: [],
  utterance_count: 10,
  status: "completed",
  error_message: null,
  processed_at: null,
  created_at: "2026-03-26T00:00:00Z",
  updated_at: "2026-03-26T00:00:00Z",
};

function makeTask(overrides: Partial<ExtractedTaskRow> = {}): ExtractedTaskRow {
  return {
    id: "task-1",
    transcript_id: "t-1",
    extracted_title: "Ship webhook",
    extracted_description: "desc",
    inferred_assignees: [],
    confidence: "high",
    missing_context: [],
    source_quotes: [],
    priority: "P1",
    labels: [],
    status: "pending_interview",
    claimed_by: null,
    claimed_at: null,
    claim_expires_at: null,
    dismissed_reason: null,
    interview_responses: null,
    jira_project: null,
    jira_issue_key: null,
    jira_error: null,
    created_at: "2026-03-26T00:00:00Z",
    updated_at: "2026-03-26T00:00:00Z",
    ...overrides,
  };
}

describe("notifyNewInterviews", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("sends Slack notification when webhook URL is set and tasks are pending", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    mockFetch.mockResolvedValue({ ok: true });

    await notifyNewInterviews(transcript, [makeTask()]);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://hooks.slack.com/test");
    const body = JSON.parse(options.body);
    expect(body.blocks).toBeDefined();
    expect(body.blocks[0].text.text).toContain("Sprint Planning");
  });

  it("returns without sending when SLACK_WEBHOOK_URL is not set", async () => {
    delete process.env.SLACK_WEBHOOK_URL;

    await notifyNewInterviews(transcript, [makeTask()]);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns without sending when no pending_interview tasks", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

    await notifyNewInterviews(transcript, [
      makeTask({ status: "completed" }),
    ]);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not throw on network error", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    mockFetch.mockRejectedValue(new Error("Network error"));

    await expect(
      notifyNewInterviews(transcript, [makeTask()])
    ).resolves.not.toThrow();
  });
});

describe("notifyAutoCreatedTasks", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("sends notification with Jira links", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    process.env.JIRA_BASE_URL = "https://test.atlassian.net";
    mockFetch.mockResolvedValue({ ok: true });

    await notifyAutoCreatedTasks(transcript, [
      { title: "Ship webhook", jiraKey: "ENG-123" },
    ]);

    expect(mockFetch).toHaveBeenCalledOnce();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.blocks[1].text.text).toContain("ENG-123");
  });

  it("returns silently when no webhook URL", async () => {
    delete process.env.SLACK_WEBHOOK_URL;

    await notifyAutoCreatedTasks(transcript, [
      { title: "Task", jiraKey: "ENG-1" },
    ]);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not throw on fetch failure", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    mockFetch.mockRejectedValue(new Error("Connection refused"));

    await expect(
      notifyAutoCreatedTasks(transcript, [{ title: "T", jiraKey: "K-1" }])
    ).resolves.not.toThrow();
  });
});
