import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

import {
  claimInterview,
  completeInterview,
  dismissTask,
  releaseClaim,
  expireStaleClaims,
  expireOldInterviews,
  getPendingInterviews,
} from "../interview-queue";

describe("claimInterview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("claims an unclaimed pending_interview task", async () => {
    const task = { id: "t-1", status: "pending_interview", claimed_by: null };
    const updatedTask = { ...task, status: "claimed", claimed_by: "user-1" };

    const selectSingle = vi.fn().mockResolvedValue({ data: task, error: null });
    const updateSelectSingle = vi.fn().mockResolvedValue({ data: updatedTask, error: null });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: selectSingle }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: updateSelectSingle }),
        }),
      }),
    });

    const result = await claimInterview("t-1", "user-1");
    expect(result.status).toBe("claimed");
  });

  it("throws when task is already claimed by another user (not expired)", async () => {
    const futureDate = new Date(Date.now() + 60000).toISOString();
    const task = {
      id: "t-1",
      status: "claimed",
      claimed_by: "other-user",
      claim_expires_at: futureDate,
    };

    const selectSingle = vi.fn().mockResolvedValue({ data: task, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: selectSingle }),
      }),
    });

    await expect(claimInterview("t-1", "user-1")).rejects.toThrow("already claimed");
  });

  it("allows reclaim when previous claim has expired", async () => {
    const pastDate = new Date(Date.now() - 60000).toISOString();
    const task = {
      id: "t-1",
      status: "claimed",
      claimed_by: "other-user",
      claim_expires_at: pastDate,
    };
    const updated = { ...task, claimed_by: "user-1" };

    const selectSingle = vi.fn().mockResolvedValue({ data: task, error: null });
    const updateSelectSingle = vi.fn().mockResolvedValue({ data: updated, error: null });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: selectSingle }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: updateSelectSingle }),
        }),
      }),
    });

    const result = await claimInterview("t-1", "user-1");
    expect(result.claimed_by).toBe("user-1");
  });

  it("throws when task is in non-claimable status", async () => {
    const task = { id: "t-1", status: "completed", claimed_by: null };

    const selectSingle = vi.fn().mockResolvedValue({ data: task, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: selectSingle }),
      }),
    });

    await expect(claimInterview("t-1", "user-1")).rejects.toThrow("Cannot claim");
  });

  it("throws when task not found", async () => {
    const selectSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: selectSingle }),
      }),
    });

    await expect(claimInterview("nonexistent", "user-1")).rejects.toThrow("Task not found");
  });
});

describe("completeInterview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("completes interview with submission data", async () => {
    const task = { id: "t-1", status: "claimed", claimed_by: "user-1" };
    const updated = { ...task, status: "completed" };

    const selectSingle = vi.fn().mockResolvedValue({ data: task, error: null });
    const updateSelectSingle = vi.fn().mockResolvedValue({ data: updated, error: null });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: selectSingle }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: updateSelectSingle }),
        }),
      }),
    });

    const result = await completeInterview("t-1", "user-1", {
      responses: { "Q1": "A1" },
      assignee: "Alex",
      priority: "P1",
    });

    expect(result.status).toBe("completed");
  });

  it("throws when wrong user tries to complete", async () => {
    const task = { id: "t-1", claimed_by: "other-user" };

    const selectSingle = vi.fn().mockResolvedValue({ data: task, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: selectSingle }),
      }),
    });

    await expect(
      completeInterview("t-1", "user-1", { responses: {} })
    ).rejects.toThrow("do not have a claim");
  });
});

describe("dismissTask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets task to dismissed with reason", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValue({ update: updateMock });

    await dismissTask("t-1", "user-1", "Not a real task");

    const updates = updateMock.mock.calls[0][0];
    expect(updates.status).toBe("dismissed");
    expect(updates.dismissed_reason).toBe("Not a real task");
  });

  it("throws on DB error", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "fail" } }),
    });
    mockFrom.mockReturnValue({ update: updateMock });

    await expect(dismissTask("t-1", "user-1")).rejects.toEqual(
      expect.objectContaining({ message: "fail" })
    );
  });
});

describe("releaseClaim", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resets task to pending_interview", async () => {
    const selectSingle = vi.fn().mockResolvedValue({
      data: { claimed_by: "user-1" },
      error: null,
    });
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: selectSingle }),
      }),
      update: updateMock,
    });

    await releaseClaim("t-1", "user-1");
    const updates = updateMock.mock.calls[0][0];
    expect(updates.status).toBe("pending_interview");
    expect(updates.claimed_by).toBeNull();
  });

  it("throws when wrong user tries to release", async () => {
    const selectSingle = vi.fn().mockResolvedValue({
      data: { claimed_by: "other-user" },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: selectSingle }),
      }),
    });

    await expect(releaseClaim("t-1", "user-1")).rejects.toThrow("do not have a claim");
  });
});

describe("expireStaleClaims", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns count of expired claims", async () => {
    const selectMock = vi.fn().mockResolvedValue({
      data: [{ id: "t-1" }, { id: "t-2" }],
      error: null,
    });

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({ select: selectMock }),
        }),
      }),
    });

    const count = await expireStaleClaims();
    expect(count).toBe(2);
  });

  it("returns 0 on DB error", async () => {
    const selectMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "query failed" },
    });

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({ select: selectMock }),
        }),
      }),
    });

    const count = await expireStaleClaims();
    expect(count).toBe(0);
  });
});

describe("expireOldInterviews", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns count of expired interviews", async () => {
    const selectMock = vi.fn().mockResolvedValue({
      data: [{ id: "t-1" }],
      error: null,
    });

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({ select: selectMock }),
        }),
      }),
    });

    const count = await expireOldInterviews(48);
    expect(count).toBe(1);
  });
});

describe("getPendingInterviews", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns sorted interviews", async () => {
    const tasks = [
      { id: "t-1", priority: "P2", created_at: "2026-03-25T00:00:00Z", transcript: { attendees: [] } },
      { id: "t-2", priority: "P0", created_at: "2026-03-26T00:00:00Z", transcript: { attendees: [] } },
    ];

    const orderMock = vi.fn().mockResolvedValue({ data: tasks, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({ order: orderMock }),
      }),
    });

    const result = await getPendingInterviews();
    expect(result[0].id).toBe("t-2");
  });

  it("throws on query error", async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "query failed" },
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({ order: orderMock }),
      }),
    });

    await expect(getPendingInterviews()).rejects.toEqual(
      expect.objectContaining({ message: "query failed" })
    );
  });
});
