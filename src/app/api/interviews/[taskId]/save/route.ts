import { NextRequest, NextResponse } from "next/server";
import { saveInterviewProgress } from "@/lib/services/interview-queue";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";
import { parseBody } from "@/lib/validation";
import { interviewSaveBody } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const user = await requireAuth(request);
    const { responses } = await parseBody(interviewSaveBody, await request.json());

    await saveInterviewProgress(taskId, user.id, responses);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, { route: "interviews/save", taskId });
  }
}
