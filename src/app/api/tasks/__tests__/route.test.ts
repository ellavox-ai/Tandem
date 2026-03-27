import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { supabaseAdmin } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

function createTaskQueryMock(result: { data: unknown; error: { message: string } | null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
    catch: (onRejected: (e: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected),
  };
  return chain;
}

describe("GET /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with tasks array", async () => {
    const tasks = [{ id: "task-1", transcript_id: "t1" }];
    const query = createTaskQueryMock({ data: tasks, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(query as never);

    const response = await GET(
      new Request("http://localhost/api/tasks", { method: "GET" })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ tasks });
    expect(supabaseAdmin.from).toHaveBeenCalledWith("extracted_tasks");
    expect(query.select).toHaveBeenCalled();
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(50);
  });

  it("returns 500 when Supabase returns an error", async () => {
    const query = createTaskQueryMock({
      data: null,
      error: { message: "relation does not exist" },
    });
    vi.mocked(supabaseAdmin.from).mockReturnValue(query as never);

    const response = await GET(
      new Request("http://localhost/api/tasks", { method: "GET" })
    );

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({ error: "Internal server error" });
  });
});
