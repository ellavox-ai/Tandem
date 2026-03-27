import { NextRequest, NextResponse } from "next/server";
import { listTranscripts } from "@/lib/services/ingestion";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";
import { parseListQuery } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const { limit } = parseListQuery(searchParams);
    const status = searchParams.get("status") || undefined;

    const transcripts = await listTranscripts(status, limit);
    return NextResponse.json({ transcripts });
  } catch (err) {
    return apiError(err, { route: "transcripts" });
  }
}
