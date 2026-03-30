import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignOut = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signOut: () => mockSignOut(),
    },
  }),
}));

import { POST } from "../../auth/signout/route";

describe("POST /api/auth/signout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("signs out and returns ok", async () => {
    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockSignOut).toHaveBeenCalledOnce();
  });
});
