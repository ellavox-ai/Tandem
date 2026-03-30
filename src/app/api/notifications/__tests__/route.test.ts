import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// The setup.ts already mocks supabaseAdmin, but we need to customize returns per test
const mockFrom = vi.mocked(supabaseAdmin.from);

import { GET, PATCH } from "../route";

describe("GET /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns notifications for authenticated user", async () => {
    const mockNotifications = [
      { id: "n-1", type: "interview_needed", title: "3 tasks", read: false },
      { id: "n-2", type: "auto_pushed", title: "Pushed", read: true },
    ];

    // Build the chain mock
    const chainMock = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
    };
    // Without unread filter, the chain ends at limit()
    chainMock.limit.mockResolvedValue({ data: mockNotifications, error: null });
    mockFrom.mockReturnValue(chainMock as never);

    const request = new NextRequest("http://localhost/api/notifications");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.notifications).toHaveLength(2);
  });

  it("filters unread when ?unread=true", async () => {
    const chainMock = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(chainMock as never);

    const request = new NextRequest("http://localhost/api/notifications?unread=true");
    await GET(request);

    expect(chainMock.eq).toHaveBeenCalledWith("read", false);
  });
});

describe("PATCH /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks all as read when all: true", async () => {
    const chainMock = {
      update: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockFrom.mockReturnValue(chainMock as never);

    const request = new NextRequest("http://localhost/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ all: true }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(chainMock.update).toHaveBeenCalledWith({ read: true });
  });

  it("marks specific IDs as read", async () => {
    const chainMock = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockFrom.mockReturnValue(chainMock as never);

    const request = new NextRequest("http://localhost/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ ids: ["n-1", "n-2"] }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    expect(chainMock.in).toHaveBeenCalledWith("id", ["n-1", "n-2"]);
  });
});
