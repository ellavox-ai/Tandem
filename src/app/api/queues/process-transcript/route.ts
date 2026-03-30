import { handleCallback } from "@vercel/queue";
import { processTranscript } from "@/lib/jobs/processors";
import type { TranscriptProcessingJob } from "@/lib/jobs/queue";

export const maxDuration = 300;

export const POST = handleCallback<TranscriptProcessingJob>(
  async (data) => {
    await processTranscript(data);
  }
);
