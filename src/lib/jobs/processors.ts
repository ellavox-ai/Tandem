import { Worker, Job } from "bullmq";
import { getRedisConnection, QUEUE_NAMES, enqueueJiraCreation } from "./queue";
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
import { notifyNewInterviews, notifyAutoCreatedTasks } from "@/lib/services/notifications";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import type { NormalizedTranscript, TranscriptProvider } from "@/lib/types";

const log = logger.child({ service: "worker" });

/** Safely parse a pipeline_config JSON value with a fallback. */
function safeParseConfig<T>(value: unknown, fallback: T): T {
  try {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return JSON.parse(value) as T;
    // Supabase stores jsonb as already-parsed objects
    return value as T;
  } catch {
    log.warn({ value }, "Failed to parse config value, using fallback");
    return fallback;
  }
}

/**
 * Process a transcript: extract tasks via Claude, store them, route to Jira or interview queue.
 */
async function processTranscript(job: Job<TranscriptProcessingJob>) {
  const { transcriptId, provider, meetingTitle, meetingDate, attendees, duration, utterances } =
    job.data;
  const jobLog = log.child({ transcriptId, jobId: job.id });

  jobLog.info("Starting transcript processing");

  // Mark as processing
  await updateTranscriptStatus(transcriptId, "processing");

  try {
    // Reconstruct the NormalizedTranscript for the extraction engine
    const transcript: NormalizedTranscript = {
      provider: provider as TranscriptProvider,
      externalId: job.data.externalId,
      meetingTitle,
      meetingDate: new Date(meetingDate),
      duration,
      attendees,
      utterances,
      rawFormat: "json",
      metadata: {},
    };

    // Extract tasks via Claude
    const result = await extractTasks(transcript, transcriptId);

    if (result.tasks.length === 0) {
      jobLog.info("No tasks extracted from transcript");
      await updateTranscriptStatus(transcriptId, "completed");
      return;
    }

    // Get auto-create threshold from config
    const { data: configRow } = await supabaseAdmin
      .from("pipeline_config")
      .select("value")
      .eq("key", "confidence_auto_create_threshold")
      .single();

    const autoCreateThreshold = safeParseConfig<string[]>(configRow?.value, ["high"]);

    // Store tasks and determine routing
    const taskIds = await storeAndRouteExtractedTasks(result, autoCreateThreshold);

    if (taskIds.length === 0) {
      jobLog.warn("No tasks were stored after extraction");
      await updateTranscriptStatus(transcriptId, "completed");
      return;
    }

    // Fetch the stored tasks to know which need Jira creation vs. interviews
    const { data: storedTasks, error: fetchError } = await supabaseAdmin
      .from("extracted_tasks")
      .select("*")
      .in("id", taskIds);

    if (fetchError) {
      jobLog.error({ error: fetchError }, "Failed to fetch stored tasks");
      throw new Error(`Failed to fetch stored tasks: ${fetchError.message}`);
    }

    if (storedTasks && storedTasks.length > 0) {
      // Enqueue Jira creation for auto-created tasks
      const autoCreated = storedTasks.filter((t) => t.status === "auto_created");
      for (const task of autoCreated) {
        await enqueueJiraCreation({ taskId: task.id });
      }

      // Send notifications for interview tasks
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
    throw err; // Let BullMQ handle retries
  }
}

/**
 * Create a Jira issue for an extracted task.
 */
async function processJiraCreation(job: Job<JiraCreationJob>) {
  const { taskId, projectKey } = job.data;
  const jobLog = log.child({ taskId, jobId: job.id });

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

    // Notify about auto-created tasks using the refined title
    const transcript = await getTranscript(task.transcript_id);
    if (transcript) {
      await notifyAutoCreatedTasks(transcript, [
        { title: result.refinedTitle, jiraKey: result.issueKey },
      ]);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    jobLog.error({ err }, "Jira creation failed");

    // Store the error on the task
    await supabaseAdmin
      .from("extracted_tasks")
      .update({ status: "jira_failed", jira_error: errorMessage })
      .eq("id", taskId);

    throw err; // Let BullMQ handle retries
  }
}

/**
 * Run maintenance tasks (claim expiry, interview expiry).
 */
async function processMaintenance(job: Job<MaintenanceJob>) {
  const { type } = job.data;

  switch (type) {
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

// ─── Worker Factory ─────────────────────────────────────────────────────────

export function startWorkers() {
  const connection = getRedisConnection();

  const transcriptWorker = new Worker(
    QUEUE_NAMES.TRANSCRIPT_PROCESSING,
    processTranscript,
    {
      connection,
      concurrency: 5, // Max 5 simultaneous Claude extraction jobs
      limiter: { max: 10, duration: 60000 }, // Rate limit: 10 per minute
    }
  );

  const jiraWorker = new Worker(QUEUE_NAMES.JIRA_CREATION, processJiraCreation, {
    connection,
    concurrency: 10,
  });

  const maintenanceWorker = new Worker(
    QUEUE_NAMES.MAINTENANCE,
    processMaintenance,
    { connection, concurrency: 1 }
  );

  // Error handlers
  for (const [name, worker] of [
    ["transcript", transcriptWorker],
    ["jira", jiraWorker],
    ["maintenance", maintenanceWorker],
  ] as const) {
    (worker as Worker).on("failed", (job, err) => {
      log.error(
        { worker: name, jobId: job?.id, err: err.message },
        "Job failed"
      );
    });
    (worker as Worker).on("completed", (job) => {
      log.debug({ worker: name, jobId: job.id }, "Job completed");
    });
  }

  log.info("All workers started");

  return { transcriptWorker, jiraWorker, maintenanceWorker };
}
