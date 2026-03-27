import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import { listTranscripts } from "@/lib/services/ingestion";

vi.mock("@/lib/services/ingestion", () => ({
  listTranscripts: vi.fn(),
}));

describe("GET /api/transcripts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with transcripts array", async () => {
    const rows = [{ id: "t1" } as never];
    vi.mocked(listTranscripts).mockResolvedValue(rows);

    const response = await GET(
      new NextRequest("http://localhost/api/transcripts", { method: "GET" })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ transcripts: rows });
    expect(listTranscripts).toHaveBeenCalledWith(undefined, 50);
  });

  it("passes status filter to the service", async () => {
    vi.mocked(listTranscripts).mockResolvedValue([]);

    const response = await GET(
      new NextRequest("http://localhost/api/transcripts?status=completed&limit=10", {
        method: "GET",
      })
    );

    expect(response.status).toBe(200);
    await response.json();
    expect(listTranscripts).toHaveBeenCalledWith("completed", 10);
  });

  it("returns 500 when the service throws", async () => {
    vi.mocked(listTranscripts).mockRejectedValue(new Error("db down"));

    const response = await GET(
      new NextRequest("http://localhost/api/transcripts", { method: "GET" })
    );

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({ error: "Internal server error" });
  });
});
