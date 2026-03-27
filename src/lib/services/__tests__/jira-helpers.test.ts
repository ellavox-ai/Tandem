import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeString,
  levenshteinDistance,
  levenshteinSimilarity,
  mapPriority,
  getJiraConfig,
  buildRequirementsAdf,
  buildLegacyAdf,
} from "../jira";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/agents/requirements-agent", () => ({
  refineRequirements: vi.fn(),
}));

describe("normalizeString", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeString("Hello, World!")).toBe("hello world");
  });

  it("collapses whitespace", () => {
    expect(normalizeString("  multiple   spaces  ")).toBe("multiple spaces");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeString("")).toBe("");
  });

  it("strips special characters", () => {
    expect(normalizeString("Ship [AppFolio] webhook (v2)")).toBe("ship appfolio webhook v2");
  });
});

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("hello", "hello")).toBe(0);
  });

  it("returns max length for completely different strings", () => {
    expect(levenshteinDistance("abc", "xyz")).toBe(3);
  });

  it("returns 1 for single insertion", () => {
    expect(levenshteinDistance("cat", "cats")).toBe(1);
  });

  it("returns 1 for single deletion", () => {
    expect(levenshteinDistance("cats", "cat")).toBe(1);
  });

  it("returns 1 for single replacement", () => {
    expect(levenshteinDistance("cat", "car")).toBe(1);
  });

  it("handles empty strings", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
    expect(levenshteinDistance("", "")).toBe(0);
  });
});

describe("levenshteinSimilarity", () => {
  it("returns 1.0 for identical strings", () => {
    expect(levenshteinSimilarity("hello", "hello")).toBe(1);
  });

  it("returns 1.0 for two empty strings", () => {
    expect(levenshteinSimilarity("", "")).toBe(1);
  });

  it("returns low value for completely different strings", () => {
    const sim = levenshteinSimilarity("abcdef", "xyzwvq");
    expect(sim).toBeLessThan(0.2);
  });

  it("returns reasonable similarity for similar strings", () => {
    const sim = levenshteinSimilarity(
      "ship appfolio webhook",
      "ship appfolio webhooks"
    );
    expect(sim).toBeGreaterThan(0.9);
  });

  it("correctly identifies 0.7 threshold boundary", () => {
    const sim = levenshteinSimilarity(
      "implement webhook integration",
      "implement webhook handler"
    );
    expect(sim).toBeGreaterThan(0.6);
  });
});

describe("mapPriority", () => {
  it("maps P0 to Highest", () => expect(mapPriority("P0")).toBe("Highest"));
  it("maps P1 to High", () => expect(mapPriority("P1")).toBe("High"));
  it("maps P2 to Medium", () => expect(mapPriority("P2")).toBe("Medium"));
  it("maps P3 to Low", () => expect(mapPriority("P3")).toBe("Low"));
  it("maps unknown value to Medium", () => expect(mapPriority("P4")).toBe("Medium"));
  it("maps empty string to Medium", () => expect(mapPriority("")).toBe("Medium"));
});

describe("getJiraConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns config when all env vars are set", () => {
    process.env.JIRA_BASE_URL = "https://test.atlassian.net";
    process.env.JIRA_EMAIL = "test@example.com";
    process.env.JIRA_API_TOKEN = "token-123";
    process.env.JIRA_DEFAULT_PROJECT = "ENG";

    const config = getJiraConfig();
    expect(config).toEqual({
      baseUrl: "https://test.atlassian.net",
      email: "test@example.com",
      apiToken: "token-123",
      defaultProject: "ENG",
    });
  });

  it("defaults project to SCRUM when not set", () => {
    process.env.JIRA_BASE_URL = "https://test.atlassian.net";
    process.env.JIRA_EMAIL = "test@example.com";
    process.env.JIRA_API_TOKEN = "token";
    delete process.env.JIRA_DEFAULT_PROJECT;

    const config = getJiraConfig();
    expect(config.defaultProject).toBe("SCRUM");
  });

  it("throws when JIRA_BASE_URL is missing", () => {
    delete process.env.JIRA_BASE_URL;
    expect(() => getJiraConfig()).toThrow("JIRA_BASE_URL");
  });

  it("throws when JIRA_EMAIL is missing", () => {
    process.env.JIRA_BASE_URL = "https://x.atlassian.net";
    delete process.env.JIRA_EMAIL;
    expect(() => getJiraConfig()).toThrow();
  });

  it("throws when JIRA_API_TOKEN is missing", () => {
    process.env.JIRA_BASE_URL = "https://x.atlassian.net";
    process.env.JIRA_EMAIL = "e@e.com";
    delete process.env.JIRA_API_TOKEN;
    expect(() => getJiraConfig()).toThrow();
  });
});

describe("buildRequirementsAdf", () => {
  it("generates a valid ADF doc with description paragraphs", () => {
    const requirements = {
      title: "Test",
      issueType: "Task" as const,
      description: "First paragraph.\n\nSecond paragraph.",
      acceptanceCriteria: [],
      priority: "P2" as const,
      labels: [],
      assignee: null,
    };

    const adf = buildRequirementsAdf(requirements);
    expect(adf.type).toBe("doc");
    expect(adf.version).toBe(1);
    const content = (adf as { content: unknown[] }).content;
    expect(content.length).toBe(2);
    expect((content[0] as { type: string }).type).toBe("paragraph");
  });

  it("includes acceptance criteria as a task list", () => {
    const requirements = {
      title: "Test",
      issueType: "Task" as const,
      description: "Description",
      acceptanceCriteria: ["Criterion 1", "Criterion 2"],
      priority: "P2" as const,
      labels: [],
      assignee: null,
    };

    const adf = buildRequirementsAdf(requirements);
    const content = (adf as { content: unknown[] }).content;
    const taskListNode = content.find((n: unknown) => (n as { type: string }).type === "taskList");
    expect(taskListNode).toBeDefined();
  });

  it("includes technical notes section when present", () => {
    const requirements = {
      title: "Test",
      issueType: "Task" as const,
      description: "Desc",
      acceptanceCriteria: [],
      technicalNotes: "Use Redis for caching",
      priority: "P2" as const,
      labels: [],
      assignee: null,
    };

    const adf = buildRequirementsAdf(requirements);
    const content = (adf as { content: unknown[] }).content;
    const headings = content.filter(
      (n: unknown) => (n as { type: string }).type === "heading"
    );
    const techHeading = headings.find((h: unknown) =>
      JSON.stringify(h).includes("Technical Notes")
    );
    expect(techHeading).toBeDefined();
  });

  it("includes blockedBy as bullet list", () => {
    const requirements = {
      title: "Test",
      issueType: "Task" as const,
      description: "Desc",
      acceptanceCriteria: [],
      priority: "P2" as const,
      labels: [],
      assignee: null,
      blockedBy: ["ENG-123"],
    };

    const adf = buildRequirementsAdf(requirements);
    const content = (adf as { content: unknown[] }).content;
    const bulletListNode = content.find(
      (n: unknown) => (n as { type: string }).type === "bulletList"
    );
    expect(bulletListNode).toBeDefined();
  });
});

describe("buildLegacyAdf", () => {
  it("generates ADF with description paragraphs", () => {
    const task = {
      id: "t-1",
      extracted_description: "First para.\n\nSecond para.",
      source_quotes: [],
      interview_responses: null,
    } as never;

    const adf = buildLegacyAdf(task);
    expect(adf.type).toBe("doc");
    const content = (adf as { content: unknown[] }).content;
    expect(content.length).toBe(2);
  });

  it("includes source quotes as blockquotes", () => {
    const task = {
      id: "t-1",
      extracted_description: "Description",
      source_quotes: [
        { text: "We need to ship this", timestamp: 65 },
      ],
      interview_responses: null,
    } as never;

    const adf = buildLegacyAdf(task);
    const content = (adf as { content: unknown[] }).content;
    const bq = content.find(
      (n: unknown) => (n as { type: string }).type === "blockquote"
    );
    expect(bq).toBeDefined();
  });

  it("includes interview responses as bold Q + answer paragraphs", () => {
    const task = {
      id: "t-1",
      extracted_description: "Desc",
      source_quotes: [],
      interview_responses: {
        "Who owns this?": "Alex",
        "When is it due?": "Friday",
      },
    } as never;

    const adf = buildLegacyAdf(task);
    const content = (adf as { content: unknown[] }).content;
    const paragraphs = content.filter(
      (n: unknown) => (n as { type: string }).type === "paragraph"
    );
    expect(paragraphs.length).toBeGreaterThanOrEqual(5);
  });
});
