import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const [transcripts, tasks, interviews, failures] = await Promise.all([
      supabaseAdmin
        .from("transcripts")
        .select("status", { count: "exact", head: true }),
      supabaseAdmin
        .from("extracted_tasks")
        .select("status", { count: "exact", head: true }),
      supabaseAdmin
        .from("extracted_tasks")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending_interview", "claimed"]),
      supabaseAdmin
        .from("extracted_tasks")
        .select("id", { count: "exact", head: true })
        .eq("status", "jira_failed"),
    ]);

    const { data: tasksByStatus } = await supabaseAdmin.rpc("count_tasks_by_status");
    const { data: transcriptsByStatus } = await supabaseAdmin.rpc(
      "count_transcripts_by_status"
    );

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [recentTranscripts, recentTasks] = await Promise.all([
      supabaseAdmin
        .from("transcripts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", oneDayAgo),
      supabaseAdmin
        .from("extracted_tasks")
        .select("id", { count: "exact", head: true })
        .gte("created_at", oneDayAgo),
    ]);

    return NextResponse.json({
      totals: {
        transcripts: transcripts.count || 0,
        tasks: tasks.count || 0,
        pendingInterviews: interviews.count || 0,
        failedJiraCreations: failures.count || 0,
      },
      last24h: {
        transcriptsProcessed: recentTranscripts.count || 0,
        tasksCreated: recentTasks.count || 0,
      },
      breakdowns: {
        tasksByStatus: tasksByStatus || [],
        transcriptsByStatus: transcriptsByStatus || [],
      },
    });
  } catch (err) {
    return apiError(err, { route: "dashboard/stats" });
  }
}
