import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("bullmq", () => {
  const mockAdd = vi.fn().mockResolvedValue({ id: "job-1" });
  const mockUpsertJobScheduler = vi.fn().mockResolvedValue({});
  class MockQueue {
    add = mockAdd;
    upsertJobScheduler = mockUpsertJobScheduler;
  }
  return { Queue: MockQueue };
});

import { getRedisConnection, enqueueTranscriptProcessing, enqueueJiraCreation } from "../queue";

describe("getRedisConnection", () => {
  it("returns default host and port when env not set", () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;

    const conn = getRedisConnection();
    expect(conn.host).toBe("localhost");
    expect(conn.port).toBe(6379);
  });

  it("reads host and port from env", () => {
    process.env.REDIS_HOST = "redis.example.com";
    process.env.REDIS_PORT = "6380";

    const conn = getRedisConnection();
    expect(conn.host).toBe("redis.example.com");
    expect(conn.port).toBe(6380);

    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
  });
});

describe("enqueueTranscriptProcessing", () => {
  it("returns a job ID", async () => {
    const jobId = await enqueueTranscriptProcessing({
      transcriptId: "t-1",
      provider: "manual",
      externalId: "ext-1",
      meetingTitle: "Test",
      meetingDate: "2026-03-26T10:00:00Z",
      attendees: [],
      duration: 600,
      utterances: [],
    });

    expect(jobId).toBeDefined();
  });
});

describe("enqueueJiraCreation", () => {
  it("returns a job ID", async () => {
    const jobId = await enqueueJiraCreation({ taskId: "task-1" });
    expect(jobId).toBeDefined();
  });
});
