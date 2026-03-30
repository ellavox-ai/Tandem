import { NextRequest, NextResponse } from "next/server";
import { getIssueTracker } from "@/lib/issue-tracker";
import { routeTaskToProject } from "@/lib/agents/routing-agent";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth";
import { apiError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseBody } from "@/lib/validation";
import { pushJiraBody } from "@/lib/validation";

const log = logger.child({ route: "push-jira" });

/**
 * POST /api/tasks/:id/push-jira
 *
 * Push a completed or auto_created task to Jira.
 * Unlike retry-jira (which only handles jira_failed), this handles
 * the initial push for tasks that have been through the interview flow.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAuth(request);

    const body = await request.json().catch(() => ({}));
    const { projectKey: overrideProject } = parseBody(pushJiraBody, body);

    const { data: task, error } = await supabaseAdmin
      .from("extracted_tasks")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !task) {
      throw new NotFoundError("Task not found");
    }

    const pushableStatuses = ["completed", "auto_created", "jira_failed"];
    if (!pushableStatuses.includes(task.status)) {
      throw new ValidationError(
        `Cannot push to Jira: task is in '${task.status}' status. Expected one of: ${pushableStatuses.join(", ")}`
      );
    }

    if (task.tracker_issue_key) {
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        issueKey: task.tracker_issue_key,
        issueUrl: `${process.env.JIRA_BASE_URL}/browse/${task.tracker_issue_key}`,
      });
    }

    if (task.tracker_error) {
      await supabaseAdmin
        .from("extracted_tasks")
        .update({ tracker_error: null })
        .eq("id", id);
    }

    if (overrideProject) {
      await supabaseAdmin
        .from("extracted_tasks")
        .update({ tracker_project: overrideProject })
        .eq("id", id);
      task.tracker_project = overrideProject;
    }

    const resolvedProject = await routeTaskToProject(task);
    const result = await getIssueTracker().createIssue(task, resolvedProject);

    log.info({ taskId: id, issueKey: result.issueKey, project: resolvedProject }, "Task pushed to Jira");

    return NextResponse.json({
      ok: true,
      issueKey: result.issueKey,
      issueUrl: result.issueUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to push to Jira";
    log.error({ err, taskId: id }, "Push to Jira failed");

    await supabaseAdmin
      .from("extracted_tasks")
      .update({ status: "jira_failed", tracker_error: message })
      .eq("id", id)
      .then(() => {});

    return apiError(err, { route: "push-jira" });
  }
}
