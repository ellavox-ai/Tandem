import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

import { GET } from "../../transcripts/[id]/route";

describe("GET /api/transcripts/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with transcript and tasks", async () => {
    const transcript = { id: "t-1", meeting_title: "Sprint Planning" };
    const tasks = [{ id: "task-1", transcript_id: "t-1" }];

    mockFrom.mockImplementation((table: string) => {
      if (table === "transcripts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: transcript, error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: tasks, error: null }),
          }),
        }),
      };
    });

    const request = new NextRequest("http://localhost/api/transcripts/t-1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "t-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transcript).toEqual(transcript);
    expect(data.tasks).toEqual(tasks);
  });

  it("returns 404 when transcript not found", async () => {
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

    const request = new NextRequest("http://localhost/api/transcripts/nonexistent");
    const response = await GET(request, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns empty tasks array when no tasks for transcript", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transcripts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "t-1" }, error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    const request = new NextRequest("http://localhost/api/transcripts/t-1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "t-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tasks).toEqual([]);
  });
});
