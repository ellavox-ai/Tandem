import { handleCallback } from "@vercel/queue";
import { processJiraCreation } from "@/lib/jobs/processors";
import type { JiraCreationJob } from "@/lib/jobs/queue";

export const POST = handleCallback<JiraCreationJob>(
  async (data) => {
    await processJiraCreation(data);
  }
);
