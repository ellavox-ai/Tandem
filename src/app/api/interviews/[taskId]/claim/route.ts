import { NextRequest, NextResponse } from "next/server";
import { claimInterview } from "@/lib/services/interview-queue";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const user = await requireAuth(request);
    const task = await claimInterview(taskId, user.id);
    return NextResponse.json({ task });
  } catch (err) {
    return apiError(err, { route: "interviews/claim", taskId });
  }
}
