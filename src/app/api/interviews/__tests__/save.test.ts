import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/interview-queue", () => ({
  saveInterviewProgress: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../[taskId]/save/route";
import { saveInterviewProgress } from "@/lib/services/interview-queue";

const routeContext = { params: Promise.resolve({ taskId: "task-1" }) };

describe("POST /api/interviews/[taskId]/save", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 on valid save", async () => {
    const request = new NextRequest("http://localhost/api/interviews/task-1/save", {
      method: "POST",
      body: JSON.stringify({
        responses: { "Q1": "A1", "Q2": "A2" },
      }),
    });

    const response = await POST(request, routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(saveInterviewProgress).toHaveBeenCalledWith(
      "task-1",
      "test-user-id",
      { "Q1": "A1", "Q2": "A2" }
    );
  });

  it("returns 400 when responses is missing", async () => {
    const request = new NextRequest("http://localhost/api/interviews/task-1/save", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, routeContext);
    expect(response.status).toBe(400);
  });
});
