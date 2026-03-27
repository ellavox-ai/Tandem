import { NextRequest, NextResponse } from "next/server";
import { releaseClaim } from "@/lib/services/interview-queue";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const user = await requireAuth(request);
    await releaseClaim(taskId, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, { route: "interviews/release", taskId });
  }
}
