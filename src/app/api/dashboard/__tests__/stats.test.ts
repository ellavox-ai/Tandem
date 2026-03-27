import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../stats/route";
import { supabaseAdmin } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe("GET /api/dashboard/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(supabaseAdmin.rpc).mockImplementation(((name: string) => {
      if (name === "count_tasks_by_status") {
        return Promise.resolve({
          data: [{ status: "pending", count: 5 }],
          error: null,
        });
      }
      if (name === "count_transcripts_by_status") {
        return Promise.resolve({
          data: [{ status: "completed", count: 8 }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    }) as never);

    vi.mocked(supabaseAdmin.from).mockImplementation(((table: string) => ({
      select: vi.fn((fields: string, opts?: { head?: boolean }) => {
        if (opts?.head) {
          if (table === "transcripts" && fields === "status") {
            return Promise.resolve({ count: 10, error: null });
          }
          if (table === "extracted_tasks" && fields === "status") {
            return Promise.resolve({ count: 20, error: null });
          }
          if (table === "extracted_tasks" && fields === "id") {
            return {
              in: vi.fn().mockResolvedValue({ count: 3, error: null }),
              eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
              gte: vi.fn().mockResolvedValue({ count: 6, error: null }),
            };
          }
          if (table === "transcripts" && fields === "id") {
            return {
              gte: vi.fn().mockResolvedValue({ count: 4, error: null }),
            };
          }
        }
        return {};
      }),
    })) as never);
  });

  it("returns 200 with totals, last24h, and breakdowns", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/dashboard/stats")
    );

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.totals).toEqual({
      transcripts: 10,
      tasks: 20,
      pendingInterviews: 3,
      failedJiraCreations: 2,
    });
    expect(data.last24h).toEqual({
      transcriptsProcessed: 4,
      tasksCreated: 6,
    });
    expect(data.breakdowns).toEqual({
      tasksByStatus: [{ status: "pending", count: 5 }],
      transcriptsByStatus: [{ status: "completed", count: 8 }],
    });
  });
});
