import { Queue } from "bullmq";
import { logger } from "@/lib/logger";

const log = logger.child({ service: "jobs" });

// Redis connection config (reused across queues and rate limiter)
export function getRedisConnection() {
  const url = process.env.REDIS_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379", 10),
      password: parsed.password || undefined,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
      maxRetriesPerRequest: null as null,
    };
  }

  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === "true" ? {} : undefined,
    maxRetriesPerRequest: null as null,
  };
}

// ─── Queue Definitions ──────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  TRANSCRIPT_PROCESSING: "transcript-processing",
  JIRA_CREATION: "jira-creation",
  MAINTENANCE: "maintenance",
} as const;

export function createQueue(name: string): Queue {
  return new Queue(name, { connection: getRedisConnection() });
}

// Lazy-initialized queues
let transcriptQueue: Queue | null = null;
let jiraQueue: Queue | null = null;
let maintenanceQueue: Queue | null = null;

export function getTranscriptQueue(): Queue {
  if (!transcriptQueue) {
    transcriptQueue = createQueue(QUEUE_NAMES.TRANSCRIPT_PROCESSING);
  }
  return transcriptQueue;
}

export function getJiraQueue(): Queue {
  if (!jiraQueue) {
    jiraQueue = createQueue(QUEUE_NAMES.JIRA_CREATION);
  }
  return jiraQueue;
}

export function getMaintenanceQueue(): Queue {
  if (!maintenanceQueue) {
    maintenanceQueue = createQueue(QUEUE_NAMES.MAINTENANCE);
  }
  return maintenanceQueue;
}

// ─── Job Types ──────────────────────────────────────────────────────────────

export interface TranscriptProcessingJob {
  transcriptId: string;
  provider: string;
  externalId: string;
  /** The full normalized transcript (passed through the job for processing) */
  utterances: Array<{
    speaker: string;
    speakerEmail?: string;
    text: string;
    startTime: number;
    endTime: number;
  }>;
  meetingTitle: string;
  meetingDate: string;
  attendees: Array<{ name: string; email?: string }>;
  duration: number;
}

export interface JiraCreationJob {
  taskId: string;
  projectKey?: string;
  retryCount?: number;
}

export interface MaintenanceJob {
  type: "expire-claims" | "expire-interviews";
}

// ─── Job Dispatchers ────────────────────────────────────────────────────────

export async function enqueueTranscriptProcessing(
  data: TranscriptProcessingJob
): Promise<string> {
  const job = await getTranscriptQueue().add("process", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  });
  log.info(
    { jobId: job.id, transcriptId: data.transcriptId },
    "Enqueued transcript for processing"
  );
  return job.id!;
}

export async function enqueueJiraCreation(
  data: JiraCreationJob
): Promise<string> {
  const job = await getJiraQueue().add("create", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  });
  log.info(
    { jobId: job.id, taskId: data.taskId },
    "Enqueued Jira creation"
  );
  return job.id!;
}

export async function setupMaintenanceJobs(): Promise<void> {
  const queue = getMaintenanceQueue();

  // Expire stale claims every 5 minutes
  await queue.upsertJobScheduler(
    "expire-claims",
    { every: 5 * 60 * 1000 },
    { name: "maintenance", data: { type: "expire-claims" } }
  );

  // Expire old interviews every hour
  await queue.upsertJobScheduler(
    "expire-interviews",
    { every: 60 * 60 * 1000 },
    { name: "maintenance", data: { type: "expire-interviews" } }
  );

  log.info("Maintenance jobs scheduled");
}
