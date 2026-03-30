import { enqueueJiraCreation } from "./queue";
import type {
  TranscriptProcessingJob,
  JiraCreationJob,
  MaintenanceJob,
} from "./queue";
import { extractTasks, storeAndRouteExtractedTasks } from "@/lib/services/extraction";
import { updateTranscriptStatus, getTranscript } from "@/lib/services/ingestion";
import { createJiraIssueWithRequirements } from "@/lib/services/jira";
import { routeTaskToProject } from "@/lib/agents/routing-agent";
import { expireStaleClaims, expireOldInterviews } from "@/lib/services/interview-queue";
import { notifyNewInterviews, notifyAutoCreatedTasks, notifyPushFailed } from "@/lib/services/notifications";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import type { NormalizedTranscript, TranscriptProvider } from "@/lib/types";

const log = logger.child({ service: "worker" });

function safeParseConfig<T>(value: unknown, fallback: T): T {
  try {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return JSON.parse(value) as T;
    return value as T;
  } catch {
    log.warn({ value }, "Failed to parse config value, using fallback");
    return fallback;
  }
}

/**
 * Process a transcript: extract tasks via Claude, store them, route to Jira or interview queue.
 */
export async function processTranscript(data: TranscriptProcessingJob) {
  const { transcriptId, provider, meetingTitle, meetingDate, attendees, duration, utterances } = data;
  const jobLog = log.child({ transcriptId });

  jobLog.info("Starting transcript processing");
  await updateTranscriptStatus(transcriptId, "processing");

  try {
    const transcript: NormalizedTranscript = {
      provider: provider as TranscriptProvider,
      externalId: data.externalId,
      meetingTitle,
      meetingDate: new Date(meetingDate),
      duration,
      attendees,
      utterances,
      rawFormat: "json",
      metadata: {},
    };

    const result = await extractTasks(transcript, transcriptId);

    if (result.tasks.length === 0) {
      jobLog.info("No tasks extracted from transcript");
      await updateTranscriptStatus(transcriptId, "completed");
      return;
    }

    const { data: configRow } = await supabaseAdmin
      .from("pipeline_config")
      .select("value")
      .eq("key", "confidence_auto_create_threshold")
      .single();

    const autoCreateThreshold = safeParseConfig<string[]>(configRow?.value, ["high"]);
    const taskIds = await storeAndRouteExtractedTasks(result, autoCreateThreshold);

    if (taskIds.length === 0) {
      jobLog.warn("No tasks were stored after extraction");
      await updateTranscriptStatus(transcriptId, "completed");
      return;
    }

    const { data: storedTasks, error: fetchError } = await supabaseAdmin
      .from("extracted_tasks")
      .select("*")
      .in("id", taskIds);

    if (fetchError) {
      jobLog.error({ error: fetchError }, "Failed to fetch stored tasks");
      throw new Error(`Failed to fetch stored tasks: ${fetchError.message}`);
    }

    if (storedTasks && storedTasks.length > 0) {
      const autoCreated = storedTasks.filter((t) => t.status === "auto_created");
      for (const task of autoCreated) {
        await enqueueJiraCreation({ taskId: task.id });
      }

      const transcriptRow = await getTranscript(transcriptId);
      if (transcriptRow) {
        const interviewTasks = storedTasks.filter(
          (t) => t.status === "pending_interview"
        );
        if (interviewTasks.length > 0) {
          await notifyNewInterviews(transcriptRow, interviewTasks);
        }
      }
    }

    await updateTranscriptStatus(transcriptId, "completed");
    jobLog.info(
      { taskCount: result.tasks.length, processingTimeMs: result.processingTimeMs },
      "Transcript processing complete"
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    jobLog.error({ err }, "Transcript processing failed");
    await updateTranscriptStatus(transcriptId, "failed", errorMessage);
    throw err;
  }
}

/**
 * Create a Jira issue for an extracted task.
 */
export async function processJiraCreation(data: JiraCreationJob) {
  const { taskId, projectKey } = data;
  const jobLog = log.child({ taskId });

  jobLog.info("Creating Jira issue");

  const { data: task, error } = await supabaseAdmin
    .from("extracted_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (error || !task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  try {
    const resolvedProject = projectKey || await routeTaskToProject(task);
    const result = await createJiraIssueWithRequirements(task, resolvedProject);
    jobLog.info({ issueKey: result.issueKey, project: resolvedProject }, "Jira issue created");

    const transcript = await getTranscript(task.transcript_id);
    if (transcript) {
      await notifyAutoCreatedTasks(transcript, [
        { title: result.refinedTitle, jiraKey: result.issueKey },
      ]);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    jobLog.error({ err }, "Jira creation failed");

    await supabaseAdmin
      .from("extracted_tasks")
      .update({ status: "jira_failed", jira_error: errorMessage })
      .eq("id", taskId);

    await notifyPushFailed(taskId, task.extracted_title, errorMessage);
    throw err;
  }
}

/**
 * Run maintenance tasks (claim expiry, interview expiry).
 */
export async function processMaintenance(data: MaintenanceJob) {
  switch (data.type) {
    case "expire-claims": {
      const count = await expireStaleClaims();
      log.info({ count }, "Maintenance: expired stale claims");
      break;
    }
    case "expire-interviews": {
      const { data: configRow } = await supabaseAdmin
        .from("pipeline_config")
        .select("value")
        .eq("key", "interview_expiry_hours")
        .single();

      const expiryHours = safeParseConfig<number>(configRow?.value, 72);
      const count = await expireOldInterviews(expiryHours);
      log.info({ count, expiryHours }, "Maintenance: expired old interviews");
      break;
    }
  }
}
