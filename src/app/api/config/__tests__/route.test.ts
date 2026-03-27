import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { PATCH } from "../[key]/route";
import { supabaseAdmin } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe("GET /api/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with a config map", async () => {
    const rows = [
      { key: "feature_x", value: true },
      { key: "max_tasks", value: 10 },
    ];
    const resolved = Promise.resolve({ data: rows, error: null });
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        resolved.then(onFulfilled, onRejected),
      catch: (onRejected: (e: unknown) => unknown) => resolved.catch(onRejected),
    };
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as never);

    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      config: {
        feature_x: true,
        max_tasks: 10,
      },
    });
    expect(supabaseAdmin.from).toHaveBeenCalledWith("pipeline_config");
  });

  it("returns 500 when Supabase returns an error", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve({ data: null, error: { message: "timeout" } }).then(onFulfilled),
    };
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as never);

    const response = await GET();

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({ error: "Internal server error" });
  });
});

describe("PATCH /api/config/[key]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the updated row", async () => {
    const row = {
      key: "max_tasks",
      value: 20,
      updated_by: "user-1",
    };
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: row, error: null }),
    };
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as never);

    const response = await PATCH(
      new Request("http://localhost/api/config/max_tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 20, userId: "user-1" }),
      }),
      { params: Promise.resolve({ key: "max_tasks" }) }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ config: row });
    expect(chain.update).toHaveBeenCalledWith({ value: 20, updated_by: "test-user-id" });
    expect(chain.eq).toHaveBeenCalledWith("key", "max_tasks");
  });

  it("returns 400 when value is missing", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/config/max_tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-1" }),
      }),
      { params: Promise.resolve({ key: "max_tasks" }) }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: "value: value is required" });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it("returns 404 when the config key is not found", async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as never);

    const response = await PATCH(
      new Request("http://localhost/api/config/missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 1 }),
      }),
      { params: Promise.resolve({ key: "missing" }) }
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toEqual({ error: "Config key not found" });
  });
});
