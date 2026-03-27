import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/interview-queue", () => ({
  releaseClaim: vi.fn(),
}));

import { POST } from "../[taskId]/release/route";
import { releaseClaim } from "@/lib/services/interview-queue";

const routeContext = { params: Promise.resolve({ taskId: "task-1" }) };

describe("POST /api/interviews/[taskId]/release", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 on valid release", async () => {
    vi.mocked(releaseClaim).mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost/api/interviews/task-1/release", {
      method: "POST",
    });

    const response = await POST(request, routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(releaseClaim).toHaveBeenCalledWith("task-1", "test-user-id");
  });

  it("returns 500 when releaseClaim throws", async () => {
    vi.mocked(releaseClaim).mockRejectedValue(new Error("You do not have a claim"));

    const request = new NextRequest("http://localhost/api/interviews/task-1/release", {
      method: "POST",
    });

    const response = await POST(request, routeContext);
    expect(response.status).toBe(500);
  });
});
