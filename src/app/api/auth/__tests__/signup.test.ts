import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSignUp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  }),
}));

import { POST } from "../../auth/signup/route";

describe("POST /api/auth/signup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user with session on auto-confirmed signup", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "u-1", email: "new@example.com" },
        session: { access_token: "token" },
      },
      error: null,
    });

    const request = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: "new@example.com",
        password: "pass123",
        displayName: "Test User",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.email).toBe("new@example.com");
    expect(data.session).toBe(true);
  });

  it("returns 400 on signup error", async () => {
    mockSignUp.mockResolvedValue({
      data: {},
      error: { message: "Email already registered" },
    });

    const request = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: "existing@example.com",
        password: "pass123",
        displayName: "Test",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
