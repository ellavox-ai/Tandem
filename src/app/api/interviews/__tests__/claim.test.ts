import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/interview-queue", () => ({
  claimInterview: vi.fn(),
}));

import { POST } from "../[taskId]/claim/route";
import { claimInterview } from "@/lib/services/interview-queue";

const routeContext = { params: Promise.resolve({ taskId: "task-1" }) };

describe("POST /api/interviews/[taskId]/claim", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with task on valid claim", async () => {
    const mockTask = { id: "task-1", status: "claimed" };
    vi.mocked(claimInterview).mockResolvedValue(mockTask as never);

    const request = new NextRequest("http://localhost/api/interviews/task-1/claim", {
      method: "POST",
    });

    const response = await POST(request, routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.task).toEqual(mockTask);
    expect(claimInterview).toHaveBeenCalledWith("task-1", "test-user-id");
  });

  it("returns 409 when task is already claimed", async () => {
    const { ConflictError } = await import("@/lib/errors");
    vi.mocked(claimInterview).mockRejectedValue(new ConflictError("already claimed"));

    const request = new NextRequest("http://localhost/api/interviews/task-1/claim", {
      method: "POST",
    });

    const response = await POST(request, routeContext);
    expect(response.status).toBe(409);
  });

  it("returns 500 when claim fails for other reasons", async () => {
    vi.mocked(claimInterview).mockRejectedValue(new Error("Task not found"));

    const request = new NextRequest("http://localhost/api/interviews/task-1/claim", {
      method: "POST",
    });

    const response = await POST(request, routeContext);
    expect(response.status).toBe(500);
  });
});
