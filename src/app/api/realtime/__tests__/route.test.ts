import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

import { POST } from "../../realtime/[taskId]/route";

const mockFetch = vi.fn();
const validSdp = "v=0\r\no=- 12345 IN IP4 0.0.0.0\r\ns=-\r\n";

describe("POST /api/realtime/:taskId", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
    process.env.OPENAI_API_KEY = "test-openai-key";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function setupTaskMock() {
    const task = {
      id: "task-1",
      transcript_id: "t-1",
      extracted_title: "Ship webhook",
      extracted_description: "Description",
      confidence: "high",
      priority: "P1",
      missing_context: ["Who owns this?"],
      source_quotes: [{ text: "Ship by Friday" }],
      inferred_assignees: [{ name: "Alex" }],
    };
    const transcript = {
      id: "t-1",
      meeting_title: "Sprint Planning",
      meeting_date: "2026-03-26T10:00:00Z",
      attendees: [{ name: "Sean" }],
    };

    mockFrom.mockImplementation((table: string) => {
      const data = table === "extracted_tasks" ? task : transcript;
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data, error: null }),
          }),
        }),
      };
    });
  }

  it("proxies valid SDP to OpenAI and returns SDP answer", async () => {
    setupTaskMock();
    mockFetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue("answer-sdp-data"),
    });

    const request = new NextRequest("http://localhost/api/realtime/task-1", {
      method: "POST",
      body: validSdp,
    });

    const response = await POST(request, {
      params: Promise.resolve({ taskId: "task-1" }),
    });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/sdp");
    expect(text).toBe("answer-sdp-data");
  });

  it("returns 400 for empty SDP", async () => {
    const request = new NextRequest("http://localhost/api/realtime/task-1", {
      method: "POST",
      body: "",
    });

    const response = await POST(request, {
      params: Promise.resolve({ taskId: "task-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid SDP (no v=0)", async () => {
    const request = new NextRequest("http://localhost/api/realtime/task-1", {
      method: "POST",
      body: "not a valid sdp",
    });

    const response = await POST(request, {
      params: Promise.resolve({ taskId: "task-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 500 when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    const request = new NextRequest("http://localhost/api/realtime/task-1", {
      method: "POST",
      body: validSdp,
    });

    const response = await POST(request, {
      params: Promise.resolve({ taskId: "task-1" }),
    });

    expect(response.status).toBe(500);
  });

  it("returns 502 when OpenAI API fails", async () => {
    setupTaskMock();
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue("Internal Server Error"),
    });

    const request = new NextRequest("http://localhost/api/realtime/task-1", {
      method: "POST",
      body: validSdp,
    });

    const response = await POST(request, {
      params: Promise.resolve({ taskId: "task-1" }),
    });

    expect(response.status).toBe(502);
  });

  it("returns 500 when task is not found", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "not found" },
          }),
        }),
      }),
    });

    const request = new NextRequest("http://localhost/api/realtime/task-1", {
      method: "POST",
      body: validSdp,
    });

    const response = await POST(request, {
      params: Promise.resolve({ taskId: "task-1" }),
    });

    expect(response.status).toBe(500);
  });
});
