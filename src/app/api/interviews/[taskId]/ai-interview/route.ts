import { NextRequest, NextResponse } from "next/server";
import {
  startAIInterview,
  continueAIInterview,
  applyInterviewCompletion,
} from "@/lib/services/ai-interview";
import { enqueueJiraCreation } from "@/lib/jobs/queue";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";
import { parseBody, aiInterviewBody } from "@/lib/validation";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const log = logger.child({ route: "ai-interview" });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    await requireAuth(request);
    await rateLimit(`ai-interview:${getClientIp(request)}`, {
      windowMs: 60_000,
      max: 20,
    });

    const body = parseBody(aiInterviewBody, await request.json());

    if (body.action === "start") {
      const { message } = await startAIInterview(taskId);
      return NextResponse.json({ message });
    }

    const updatedHistory = [
      ...body.history,
      { role: "user" as const, content: body.message },
    ];

    const { message, completion } = await continueAIInterview(
      taskId,
      updatedHistory
    );

    if (completion) {
      const fullHistory = [
        ...updatedHistory,
        { role: "assistant" as const, content: message },
      ];
      await applyInterviewCompletion(taskId, completion, fullHistory);
      if (completion.should_create) {
        await enqueueJiraCreation({ taskId });
      }
    }

    return NextResponse.json({ message, completion });
  } catch (err) {
    return apiError(err, { route: "ai-interview", taskId });
  }
}
