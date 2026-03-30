import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSignIn = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
    },
  }),
}));

import { POST } from "../../auth/login/route";

describe("POST /api/auth/login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user on successful sign-in", async () => {
    mockSignIn.mockResolvedValue({
      data: { user: { id: "u-1", email: "test@example.com" } },
      error: null,
    });

    const request = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", password: "pass123" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.email).toBe("test@example.com");
  });

  it("returns 401 on invalid credentials", async () => {
    mockSignIn.mockResolvedValue({
      data: {},
      error: { message: "Invalid login credentials" },
    });

    const request = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "bad@example.com", password: "wrong" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain("Invalid");
  });
});
