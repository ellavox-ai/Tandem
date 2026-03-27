import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/interview-queue", () => ({
  dismissTask: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../[taskId]/dismiss/route";
import { dismissTask } from "@/lib/services/interview-queue";

const routeContext = { params: Promise.resolve({ taskId: "task-1" }) };

describe("POST /api/interviews/[taskId]/dismiss", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 on valid dismiss", async () => {
    const request = new NextRequest("http://localhost/api/interviews/task-1/dismiss", {
      method: "POST",
      body: JSON.stringify({ reason: "Not a real task" }),
    });

    const response = await POST(request, routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(dismissTask).toHaveBeenCalledWith("task-1", "test-user-id", "Not a real task");
  });

  it("allows dismiss without reason", async () => {
    const request = new NextRequest("http://localhost/api/interviews/task-1/dismiss", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, routeContext);
    expect(response.status).toBe(200);
  });
});
