import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

const mockFrom = vi.mocked(supabaseAdmin.from);

import { GET } from "../../auth/me/route";

describe("GET /api/auth/me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user and profile when authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1", email: "test@example.com", user_metadata: {} } },
    });

    const chainMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "u-1", email: "test@example.com", display_name: "Test", role: "admin" },
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chainMock as never);

    const request = new NextRequest("http://localhost/api/auth/me");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.email).toBe("test@example.com");
    expect(data.profile.display_name).toBe("Test");
  });

  it("returns null user when not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
    });

    const request = new NextRequest("http://localhost/api/auth/me");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toBeNull();
    expect(data.profile).toBeNull();
  });

  it("returns fallback profile when users table has no row", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "u-1",
          email: "new@example.com",
          user_metadata: { display_name: "New User" },
        },
      },
    });

    const chainMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockFrom.mockReturnValue(chainMock as never);

    const request = new NextRequest("http://localhost/api/auth/me");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.profile.display_name).toBe("New User");
    expect(data.profile.role).toBe("member");
  });
});
