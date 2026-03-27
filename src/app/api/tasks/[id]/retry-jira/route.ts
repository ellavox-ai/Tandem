import { NextRequest, NextResponse } from "next/server";
import { enqueueJiraCreation } from "@/lib/jobs/queue";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { apiError, NotFoundError, ValidationError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);

    const { id } = await params;

    const { data: task, error } = await supabaseAdmin
      .from("extracted_tasks")
      .select("id, status, jira_project")
      .eq("id", id)
      .single();

    if (error || !task) {
      throw new NotFoundError("Task not found");
    }

    if (task.status !== "jira_failed") {
      throw new ValidationError(
        `Cannot retry: task is in '${task.status}' status, expected 'jira_failed'`
      );
    }

    await supabaseAdmin
      .from("extracted_tasks")
      .update({ jira_error: null })
      .eq("id", id);

    await enqueueJiraCreation({ taskId: id, projectKey: task.jira_project || undefined });

    return NextResponse.json({ ok: true, taskId: id });
  } catch (err) {
    return apiError(err, { route: "retry-jira" });
  }
}
