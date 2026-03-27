import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

import {
  ingestTranscript,
  updateTranscriptStatus,
  getTranscript,
  listTranscripts,
} from "../ingestion";
import type { NormalizedTranscript } from "@/lib/types";

function makeTranscript(overrides: Partial<NormalizedTranscript> = {}): NormalizedTranscript {
  return {
    provider: "manual",
    externalId: "ext-1",
    meetingTitle: "Test Meeting",
    meetingDate: new Date("2026-03-26T10:00:00Z"),
    duration: 600,
    attendees: [{ name: "Sean" }],
    utterances: [
      { speaker: "Sean", text: "Hello", startTime: 0, endTime: 5 },
    ],
    rawFormat: "text",
    metadata: {},
    ...overrides,
  };
}

describe("ingestTranscript", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns isDuplicate: true when transcript already exists", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "existing-id", status: "completed" },
              error: null,
            }),
          }),
        }),
      }),
    });

    const result = await ingestTranscript(makeTranscript());
    expect(result).toEqual({ id: "existing-id", isDuplicate: true });
  });

  it("inserts and returns isDuplicate: false for new transcripts", async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "new-id" },
          error: null,
        }),
      }),
    });

    mockFrom.mockImplementation(() => ({
      select: selectMock,
      insert: insertMock,
    }));

    const result = await ingestTranscript(makeTranscript());
    expect(result).toEqual({ id: "new-id", isDuplicate: false });
  });

  it("handles unique constraint violation (23505) as duplicate", async () => {
    const selectMock = vi.fn()
      .mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "dup-id" }, error: null }),
          }),
        }),
      });

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "23505", message: "unique violation" },
        }),
      }),
    });

    mockFrom.mockImplementation(() => ({
      select: selectMock,
      insert: insertMock,
    }));

    const result = await ingestTranscript(makeTranscript());
    expect(result).toEqual({ id: "dup-id", isDuplicate: true });
  });

  it("throws on non-duplicate DB errors", async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "42P01", message: "relation does not exist" },
        }),
      }),
    });

    mockFrom.mockImplementation(() => ({
      select: selectMock,
      insert: insertMock,
    }));

    await expect(ingestTranscript(makeTranscript())).rejects.toEqual(
      expect.objectContaining({ code: "42P01" })
    );
  });
});

describe("updateTranscriptStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets completed status with processed_at", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValue({ update: updateMock });

    await updateTranscriptStatus("t-1", "completed");

    const updates = updateMock.mock.calls[0][0];
    expect(updates.status).toBe("completed");
    expect(updates.processed_at).toBeDefined();
  });

  it("sets failed status with error_message", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValue({ update: updateMock });

    await updateTranscriptStatus("t-1", "failed", "Something broke");

    const updates = updateMock.mock.calls[0][0];
    expect(updates.status).toBe("failed");
    expect(updates.error_message).toBe("Something broke");
    expect(updates.processed_at).toBeUndefined();
  });

  it("throws on update error", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "update failed" } }),
    });
    mockFrom.mockReturnValue({ update: updateMock });

    await expect(updateTranscriptStatus("t-1", "processing")).rejects.toEqual(
      expect.objectContaining({ message: "update failed" })
    );
  });
});

describe("getTranscript", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns transcript row when found", async () => {
    const row = { id: "t-1", meeting_title: "Test" };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: row, error: null }),
        }),
      }),
    });

    const result = await getTranscript("t-1");
    expect(result).toEqual(row);
  });

  it("returns null when not found", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "not found" },
          }),
        }),
      }),
    });

    const result = await getTranscript("nonexistent");
    expect(result).toBeNull();
  });
});

describe("listTranscripts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns transcripts without status filter", async () => {
    const rows = [{ id: "t-1" }, { id: "t-2" }];
    const limitMock = vi.fn().mockResolvedValue({ data: rows, error: null });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: orderMock,
      }),
    });

    const result = await listTranscripts();
    expect(result).toEqual(rows);
  });

  it("applies status filter when provided", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const limitMock = vi.fn().mockReturnValue({ eq: eqMock });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ order: orderMock }),
    });

    await listTranscripts("completed", 10);
    expect(eqMock).toHaveBeenCalledWith("status", "completed");
  });

  it("throws on query error", async () => {
    const limitMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "query failed" },
    });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ order: orderMock }),
    });

    await expect(listTranscripts()).rejects.toEqual(
      expect.objectContaining({ message: "query failed" })
    );
  });
});
