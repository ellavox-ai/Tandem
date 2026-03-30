import { describe, it, expect, vi, beforeEach } from "vitest";

const { workerInstances } = vi.hoisted(() => ({
  workerInstances: [] as Array<{ name: string; processor: Function; on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }>,
}));

vi.mock("bullmq", () => {
  class MockWorker {
    name: string;
    processor: Function;
    on = vi.fn();
    close = vi.fn().mockResolvedValue(undefined);
    constructor(name: string, processor: Function, _opts?: unknown) {
      this.name = name;
      this.processor = processor;
      workerInstances.push(this);
    }
  }
  return { Worker: MockWorker };
});

vi.mock("../queue", () => ({
  getRedisConnection: vi.fn().mockReturnValue({ host: "localhost", port: 6379 }),
  QUEUE_NAMES: {
    TRANSCRIPT_PROCESSING: "transcript-processing",
    JIRA_CREATION: "jira-creation",
    MAINTENANCE: "maintenance",
  },
  enqueueJiraCreation: vi.fn().mockResolvedValue("job-1"),
}));

vi.mock("@/lib/services/ingestion", () => ({
  updateTranscriptStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/extraction", () => ({
  extractTasks: vi.fn().mockResolvedValue({
    tasks: [],
    transcriptId: "t-1",
    processingTimeMs: 100,
  }),
  storeAndRouteExtractedTasks: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/services/jira", () => ({
  createJiraIssueWithRequirements: vi.fn().mockResolvedValue({
    issueKey: "ENG-1",
    issueUrl: "https://test.atlassian.net/browse/ENG-1",
    refinedTitle: "Refined Title",
  }),
}));

vi.mock("@/lib/agents/routing-agent", () => ({
  routeTaskToProject: vi.fn().mockResolvedValue("ENG"),
}));

vi.mock("@/lib/services/interview-queue", () => ({
  expireStaleClaims: vi.fn().mockResolvedValue(2),
  expireOldInterviews: vi.fn().mockResolvedValue(1),
}));

vi.mock("@/lib/services/notifications", () => ({
  notifyNewInterviews: vi.fn().mockResolvedValue(undefined),
  notifyAutoCreatedTasks: vi.fn().mockResolvedValue(undefined),
  notifyPushFailed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase", () => {
  const mockSingle = vi.fn().mockResolvedValue({
    data: {
      id: "t-1",
      meeting_title: "Test",
      meeting_date: "2026-03-26",
      attendees: [],
      utterances: [],
      provider: "manual",
      external_id: "ext-1",
      duration: 600,
    },
    error: null,
  });

  return {
    supabaseAdmin: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockSingle,
          }),
          order: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null }),
    },
  };
});

import { startWorkers } from "../processors";
import { expireStaleClaims, expireOldInterviews } from "@/lib/services/interview-queue";

describe("startWorkers", () => {
  beforeEach(() => {
    workerInstances.length = 0;
  });

  it("creates three workers", () => {
    const workers = startWorkers();
    expect(workerInstances).toHaveLength(3);
    expect(workers).toHaveProperty("transcriptWorker");
    expect(workers).toHaveProperty("jiraWorker");
    expect(workers).toHaveProperty("maintenanceWorker");
  });
});

describe("maintenance processor", () => {
  beforeEach(() => {
    workerInstances.length = 0;
  });

  it("calls expireStaleClaims for expire-claims job", async () => {
    startWorkers();
    const maintenanceWorker = workerInstances.find((w) => w.name === "maintenance");
    expect(maintenanceWorker).toBeDefined();

    await maintenanceWorker!.processor({ name: "maintenance", data: { type: "expire-claims" } });
    expect(expireStaleClaims).toHaveBeenCalled();
  });

  it("calls expireOldInterviews for expire-interviews job", async () => {
    startWorkers();
    const maintenanceWorker = workerInstances.find((w) => w.name === "maintenance");
    expect(maintenanceWorker).toBeDefined();

    await maintenanceWorker!.processor({ name: "maintenance", data: { type: "expire-interviews" } });
    expect(expireOldInterviews).toHaveBeenCalled();
  });
});
