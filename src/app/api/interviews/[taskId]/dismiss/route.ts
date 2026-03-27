import { NextRequest, NextResponse } from "next/server";
import { dismissTask } from "@/lib/services/interview-queue";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";
import { parseBody } from "@/lib/validation";
import { interviewDismissBody } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const user = await requireAuth(request);
    const { reason } = await parseBody(interviewDismissBody, await request.json());

    await dismissTask(taskId, user.id, reason);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, { route: "interviews/dismiss", taskId });
  }
}
