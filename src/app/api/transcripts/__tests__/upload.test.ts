import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/ingestion", () => ({
  ingestTranscript: vi.fn(),
}));

vi.mock("@/lib/jobs/queue", () => ({
  enqueueTranscriptProcessing: vi.fn().mockResolvedValue("job-1"),
}));

import { POST } from "../../transcripts/upload/route";
import { ingestTranscript } from "@/lib/services/ingestion";

describe("POST /api/transcripts/upload", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeFormData(
    overrides: Partial<{
      fileName: string;
      fileContent: string;
      meetingTitle: string;
      meetingDate: string;
    }> = {}
  ) {
    const formData = new FormData();
    const blob = new Blob([overrides.fileContent || "Sean: Hello"], {
      type: "text/plain",
    });
    const file = new File([blob], overrides.fileName || "test.txt", {
      type: "text/plain",
    });
    formData.set("file", file);
    if (overrides.meetingTitle !== undefined)
      formData.set("meetingTitle", overrides.meetingTitle);
    else formData.set("meetingTitle", "Test Meeting");

    if (overrides.meetingDate !== undefined)
      formData.set("meetingDate", overrides.meetingDate);
    else formData.set("meetingDate", "2026-03-26T10:00:00Z");

    return formData;
  }

  it("returns 201 for a valid upload", async () => {
    vi.mocked(ingestTranscript).mockResolvedValue({
      id: "t-1",
      isDuplicate: false,
    });

    const request = new NextRequest("http://localhost/api/transcripts/upload", {
      method: "POST",
      body: makeFormData(),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.transcriptId).toBe("t-1");
  });

  it("returns 400 when required fields are missing", async () => {
    const formData = new FormData();
    const request = new NextRequest("http://localhost/api/transcripts/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 200 with duplicate flag for duplicate upload", async () => {
    vi.mocked(ingestTranscript).mockResolvedValue({
      id: "t-1",
      isDuplicate: true,
    });

    const request = new NextRequest("http://localhost/api/transcripts/upload", {
      method: "POST",
      body: makeFormData(),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.duplicate).toBe(true);
  });
});
